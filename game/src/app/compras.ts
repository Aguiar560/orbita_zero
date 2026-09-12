import { API_URL } from '@data/servidor';

import { adotarCarteira, type EstadoDaCarteira } from './carteira';
import { tokenValido } from './conta';
import { relatarFalha, relatarSucesso } from './recusa';

/**
 * A compra de cristais com dinheiro de verdade, do lado da tela.
 *
 * ## O que este arquivo NÃO faz
 *
 * Ele não credita nada, e não sabe se o Pix foi pago. Ele pede uma cobrança e
 * pergunta o estado dela — as duas respostas vêm do servidor, que por sua vez
 * pergunta ao provedor. É a mesma disciplina do resto de `app/`: o cliente
 * declara intenção, nunca resultado.
 *
 * Escrever `estado: 'paga'` no console daqui muda o texto da tela por um
 * segundo e nada mais: o saldo que aparece é o que o servidor devolveu.
 */

export interface Cobranca {
  /** O nosso id, que a tela usa para perguntar o estado depois. */
  compra: string;
  cristais: number;
  centavos: number;
  /** PNG do QR em base64, sem o prefixo `data:`. Pode vir vazio. */
  qr: string;
  /** O código copia-e-cola. É o caminho que funciona em qualquer banco. */
  copiaECola: string;
}

export interface EstadoDaCompra {
  compra: string;
  estado: 'pendente' | 'paga' | 'expirada' | 'cancelada' | 'reembolsada';
  cristais: number;
  centavos: number;
  /** Passou da validade. Não impede o pagamento — ver `podePagar` no servidor. */
  expirada: boolean;
  carteira: EstadoDaCarteira;
}

/**
 * O motivo em português, para a tela.
 *
 * Existe porque a alternativa é o painel decidir o texto por código de erro, e
 * aí a mesma recusa ganha três frases diferentes em três telas. A regra do
 * projeto é que toda recusa seja AUDÍVEL — e audível quer dizer legível.
 */
const RECUSA: Record<string, string> = {
  pagamento_indisponivel: 'PAGAMENTO AINDA NÃO ESTÁ LIGADO. TENTE MAIS TARDE.',
  provedor_indisponivel: 'O PROVEDOR DE PAGAMENTO NÃO RESPONDEU. TENTE DE NOVO.',
  pacote_desconhecido: 'ESTE PACOTE NÃO EXISTE MAIS.',
  rapido_demais: 'ESPERE UNS SEGUNDOS ANTES DE ABRIR OUTRA COBRANÇA.',
  nao_autenticado: 'ENTRE NA CONTA PARA COMPRAR CRISTAIS.',
};

export const motivoLegivel = (erro: string): string =>
  RECUSA[erro] ?? 'NÃO FOI POSSÍVEL ABRIR A COBRANÇA. TENTE DE NOVO.';

/**
 * Pede uma cobrança Pix.
 *
 * Manda só o ID DO PACOTE. Preço e quantidade são do catálogo, no servidor —
 * mandar `centavos` daqui seria deixar o jogador dizer quanto vai pagar.
 */
export async function abrirCobranca(
  pacote: string,
): Promise<{ ok: true; cobranca: Cobranca } | { ok: false; motivo: string }> {
  const token = await tokenValido();
  if (!token) return { ok: false, motivo: motivoLegivel('nao_autenticado') };

  try {
    const r = await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ pacote }),
    });
    if (!r.ok) return { ok: false, motivo: motivoLegivel(await relatarFalha('/checkout', 'acao', r)) };

    const dados = (await r.json()) as Cobranca;
    relatarSucesso('/checkout', dados);
    // Sem copia-e-cola não há como pagar, e uma tela de QR vazio é pior que uma
    // recusa: o jogador fica esperando um dinheiro que nunca vai sair.
    if (!dados.copiaECola) return { ok: false, motivo: motivoLegivel('provedor_indisponivel') };
    return { ok: true, cobranca: dados };
  } catch {
    await relatarFalha('/checkout', 'acao', null);
    return { ok: false, motivo: motivoLegivel('provedor_indisponivel') };
  }
}

/**
 * O Pix caiu?
 *
 * ## Por que a carteira volta junto
 *
 * Porque o instante em que o jogador quer ver o saldo novo é exatamente este.
 * Adotar aqui evita uma segunda requisição no momento de maior ansiedade da
 * tela inteira — e evita o piscar de "recebido!" com o saldo antigo ainda no
 * topo.
 *
 * ## Por que a falha é de FUNDO
 *
 * Ela se repete a cada poucos segundos. Falar a cada tentativa encheria a tela
 * de avisos enquanto o jogador espera; a regra do `recusa.ts` já fala no
 * terceiro tropeço seguido, que é quando de fato há algo errado.
 */
export async function conferirCompra(id: string): Promise<EstadoDaCompra | null> {
  const token = await tokenValido();
  if (!token) return null;

  try {
    const r = await fetch(`${API_URL}/compra`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ compra: id }),
    });
    if (!r.ok) { await relatarFalha('/compra', 'fundo', r); return null; }

    const dados = (await r.json()) as EstadoDaCompra;
    relatarSucesso('/compra', dados);
    if (dados.carteira) adotarCarteira(dados.carteira);
    return dados;
  } catch {
    await relatarFalha('/compra', 'fundo', null);
    return null;
  }
}
