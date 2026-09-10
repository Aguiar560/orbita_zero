import { CRYSTAL_PACKAGES, cristaisDoPacote, type CrystalPackage } from '@sim/vip';

/**
 * A compra de cristais com dinheiro de verdade.
 *
 * ## A regra que organiza tudo aqui
 *
 * **O jogador nunca é creditado por dizer que pagou.** Ele pede uma cobrança; o
 * PROVEDOR diz que ela foi paga; só então o livro-caixa registra. É a mesma
 * forma do resto do servidor — o cliente declara intenção, nunca resultado —, e
 * é por isso que `movimentar` já recusava `motivo: 'compra'` vindo dele com
 * 403, muito antes de existir uma compra.
 *
 * ## Por que este arquivo é quase todo puro
 *
 * Dinheiro de verdade é a única área do projeto onde um defeito não se conserta
 * com um deploy: creditar errado significa que alguém pagou e não recebeu.
 * Tudo o que dá para decidir sem rede — o preço, a verificação da assinatura, a
 * transição de estado — mora aqui, testável sem provedor, sem banco e sem sorte.
 *
 * O que sobra de impuro são duas chamadas de rede e três consultas, em
 * `index.ts`.
 */

export type EstadoDaCompra = 'pendente' | 'paga' | 'expirada' | 'cancelada';

export interface Compra {
  id: string;
  usuario: string;
  pacote: string;
  cristais: number;
  centavos: number;
  estado: EstadoDaCompra;
  provedorId: string | null;
  criadaEm: number;
  pagaEm: number | null;
}

export type RecusaDeCompra =
  | 'pacote_desconhecido'
  | 'compra_desconhecida'
  | 'compra_ja_encerrada'
  | 'assinatura_invalida'
  | 'valor_divergente';

/**
 * Quanto tempo uma cobrança fica de pé.
 *
 * Trinta minutos é folgado para abrir o app do banco e pagar um Pix, e curto o
 * bastante para o painel não encher de cobranças mortas. Passado isso ela vira
 * `expirada` — e uma paga depois disso continua sendo honrada, ver `podePagar`.
 */
export const VALIDADE_DA_COBRANCA = 30 * 60;

/** O pacote, do catálogo do JOGO. Nunca do corpo da requisição. */
export function pacotePorId(id: unknown): CrystalPackage | null {
  if (typeof id !== 'string') return null;
  return CRYSTAL_PACKAGES.find((p) => p.id === id) ?? null;
}

/**
 * O que uma cobrança nova guarda.
 *
 * Congela cristais e centavos: entre criar e pagar passam minutos, e nesse
 * intervalo o catálogo pode mudar. O jogador recebe o que foi anunciado quando
 * pagou — ver o cabeçalho da migração `0017`.
 */
export function novaCompra(
  id: string,
  usuario: string,
  pacote: CrystalPackage,
  agora: number,
): Compra {
  return {
    id,
    usuario,
    pacote: pacote.id,
    cristais: cristaisDoPacote(pacote),
    centavos: pacote.priceCents,
    estado: 'pendente',
    provedorId: null,
    criadaEm: agora,
    pagaEm: null,
  };
}

/**
 * Esta compra pode ser paga agora?
 *
 * ## Por que a expirada AINDA pode ser paga
 *
 * Parece contraditório e é a decisão certa. A validade existe para limpar o
 * painel, não para recusar dinheiro que entrou: se o Pix caiu, o dinheiro é
 * real, saiu da conta de alguém, e recusar o crédito transforma um atraso de
 * trinta minutos num jogador lesado.
 *
 * O que NÃO pode ser paga é a que já foi — e essa proteção não depende daqui:
 * o índice único `(motivo, origem)` do livro-caixa recusa o segundo crédito do
 * mesmo pagamento mesmo que este código erre.
 */
export function podePagar(compra: Compra): RecusaDeCompra | null {
  if (compra.estado === 'paga') return 'compra_ja_encerrada';
  if (compra.estado === 'cancelada') return 'compra_ja_encerrada';
  return null;
}

/** Já passou da validade? Só decide o rótulo do painel. */
export const expirou = (compra: Compra, agora: number): boolean =>
  compra.estado === 'pendente' && agora - compra.criadaEm > VALIDADE_DA_COBRANCA;

/**
 * O valor que o provedor confirmou bate com o que foi cobrado?
 *
 * ## O ataque que isto fecha
 *
 * Nada impede alguém de criar a cobrança do pacote de R$ 99,90 e pagar R$ 0,01
 * — o Pix aceita valor diferente do cobrado em várias configurações. Sem esta
 * conferência, o webhook chegaria dizendo "pago" e o servidor creditaria 2.400
 * cristais por um centavo.
 *
 * Comparar em CENTAVOS inteiros, nunca em reais com ponto: `24.90` não existe
 * em ponto flutuante, e uma diferença de um centésimo de centavo recusaria uma
 * compra legítima.
 */
export function valorConfere(compra: Compra, centavosPagos: unknown): boolean {
  const pago = Math.round(Number(centavosPagos));
  return Number.isFinite(pago) && pago >= compra.centavos;
}

/**
 * O motivo de uma recusa do Mercado Pago, pronto para o livro das recusas.
 *
 * ## Por que existe
 *
 * O livro guardava só `http_401`, e o 401 do Mercado Pago tem pelo menos três
 * causas com consertos diferentes: token inválido, credencial de produção usada
 * onde se pede teste, aplicação sem permissão. Em 10/09/2026 foram três
 * tentativas seguidas de 401 e nenhuma forma de saber qual — o provedor manda o
 * motivo no corpo e ninguém o lia.
 *
 * Só o texto que o PROVEDOR escreveu entra aqui; o token nunca passa por esta
 * função. O resultado é cortado e limpo porque vira chave de agrupamento no
 * livro, e um texto livre ali multiplicaria as linhas.
 */
export function motivoDoMP(status: number, corpo: string): string {
  let texto = '';
  try {
    const d = JSON.parse(corpo) as {
      message?: unknown; error?: unknown; cause?: { code?: unknown; description?: unknown }[];
    };
    const causa = Array.isArray(d.cause) ? d.cause[0] : undefined;
    texto = String(d.message ?? causa?.description ?? d.error ?? causa?.code ?? '');
  } catch { /* corpo que não é JSON: fica só o status */ }
  const limpo = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (limpo ? `http_${status}_${limpo}` : `http_${status}`).slice(0, 48).replace(/_+$/, '');
}

// ── a assinatura do provedor ────────────────────────────────────────────────

/**
 * O manifesto que o Mercado Pago assina.
 *
 * ## Por que o formato mora aqui, isolado
 *
 * É a única parte deste arquivo que é do MERCADO PAGO e não do jogo. Trocar de
 * provedor um dia significa reescrever esta função e mais nada — o resto do
 * fluxo (cobrança, estado, crédito, idempotência) não sabe quem processa o
 * pagamento.
 *
 * O formato é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, com o `ts`
 * vindo do próprio cabeçalho `x-signature`. A ordem e os pontos e vírgulas
 * importam: é uma string exata, não um objeto.
 */
export function manifestoDoMP(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

/** As partes de `x-signature: ts=...,v1=...`. Nulo quando vier deformado. */
export function partesDaAssinatura(cabecalho: string | null): { ts: string; v1: string } | null {
  if (!cabecalho) return null;
  const partes = new Map<string, string>();

  for (const pedaco of cabecalho.split(',').slice(0, 8)) {
    const [chave, valor] = pedaco.split('=');
    if (chave && valor) partes.set(chave.trim(), valor.trim());
  }

  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  // Hexadecimal de tamanho de SHA-256. Recusar aqui evita mandar lixo para o
  // `crypto.subtle`, que só devolveria `false` mais devagar.
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return null;
  return { ts, v1 };
}

/**
 * A assinatura confere?
 *
 * ## Por que `crypto.subtle.verify`, e não comparar strings
 *
 * Comparar hash com `===` vaza tempo: a comparação para no primeiro byte
 * diferente, e medir esse tempo permite descobrir a assinatura byte a byte. É
 * um ataque velho e conhecido, e o Web Crypto já resolve — `verify` compara em
 * tempo constante.
 *
 * Esta é a ÚNICA autenticação do webhook. Ele não tem token de jogador: quem
 * chama é o provedor, e a prova de que é ele é esta.
 */
export async function assinaturaConfere(
  segredo: string,
  manifesto: string,
  v1: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const chave = await crypto.subtle.importKey(
      'raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );

    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(v1.slice(i * 2, i * 2 + 2), 16);

    return await crypto.subtle.verify('HMAC', chave, bytes, enc.encode(manifesto));
  } catch {
    // Segredo ausente, hex torto, ambiente sem Web Crypto: em todos os casos a
    // resposta segura é a mesma, e é esta.
    return false;
  }
}
