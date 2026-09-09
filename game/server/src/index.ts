import { usuarioDoToken } from './auth';
import { apelidoValido, conferir, lerPlacar, normalizar, type MarcaRecebida } from './placar';
import { podeGravar, podeLer, podeUsar, type NomeDeBalde } from './ritmo';
import {
  MOEDAS, TETO_POR_LANCAMENTO, VIP_CUSTO_CRISTAIS, conferirLancamento, podeDebitar,
  renovar, saldosDoLivro,
  type Lancamento, type Moeda, type Motivo, type Recusa,
} from './carteira';
import { excedeu } from './teto';
import {
  assinaturaConfere, expirou, manifestoDoMP, novaCompra, pacotePorId,
  partesDaAssinatura, podePagar, valorConfere, type Compra,
} from './compras';
import {
  ITENS_POR_POOL, TIPOS, novaSemente, precisaDeLoteNovo,
  rolarDoCursor, setorValido, sorteValida,
  type TipoDeDrop,
} from './lote';
import { conferirComandos, derivarColeta, planejarEquipar, type Comandos } from './inventario';
import {
  cascoDoPiloto, conferirCompraDeCasco, conferirFusao, fundir,
} from './fabrica';
import {
  conferirDelta, conferirMatriz, melhorSetor, nivelDoPiloto,
} from './progresso';
import { montarEstado, simDoServidor, type ContextoDoCliente } from './estado';
import { HULL_BY_ID } from '@data/hulls';
import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { xpAcumuladoDe } from '@sim/nivel';
import { excedeuPorReplica } from './replica';
import { precificarEncontros } from './encontros';
import {
  IGNORADOS, acumular, horaDe, motivoDaResposta, novoLivro,
} from './recusas';
import {
  enviarAviso, formaDoValor, hostDoAviso, montarAviso, type LinhaDeRecusa,
} from './alerta';
import { CABECALHO_DE_RECUSA, contarRecusas, lerRecusas } from './recusa-no-corpo';
import { lerPainelAdmin, podeLerPainelAdmin } from './painel-admin';
import {
  MISSOES_MAX, confiancaDerivada, linhaSa, mesclarMissao, podeEntregar,
  type LinhaDeMissao,
} from './missoes';
import type { Item } from '@sim/types';

/**
 * A API do Órbita Zero.
 *
 * ## O princípio, e ele governa tudo aqui
 *
 * **O servidor não confia no cliente.** A simulação roda no navegador, então
 * todo número que chega aqui foi calculado por uma máquina que o jogador
 * controla. Este Worker guarda o save e, no passo seguinte, vai conferir a
 * PLAUSIBILIDADE do que recebe contra as mesmas tabelas que o jogo usa.
 *
 * Guardar sem conferir já vale a pena — sincroniza entre dispositivos e
 * sobrevive a limpar o navegador. O que não vale é publicar um placar antes de
 * a conferência existir: um placar que aceita o que o cliente relata é
 * decoração.
 *
 * ## Orçamento da camada gratuita
 *
 * Workers dá 100 mil requisições por dia e D1 dá 100 mil ESCRITAS de linha por
 * dia. Com mil jogadores registrados e uns oitenta simultâneos no pico, salvar
 * a cada 60s daria ~115 mil — estoura os dois.
 *
 * Por isso o ritmo de gravação é limitado (ver `ritmo.ts`). Num jogo idle isso não
 * custa quase nada: o progresso é função do TEMPO, e o cliente recalcula o que
 * passou desde o último save. Perder dois minutos de relógio não é perder duas
 * jogadas.
 */

export interface Env {
  DB: D1Database;
  /** `https://<ref>.supabase.co`. Não é segredo — é o endereço do JWKS. */
  SUPABASE_URL: string;
  /** Origens que podem chamar esta API, separadas por vírgula. */
  ORIGENS: string;
  /**
   * Para onde mandar o aviso de recusas. SEGREDO, e opcional.
   *
   * Opcional porque o livro `recusas` vale por si: sem esta variável o gatilho
   * de tempo não faz nada e a consulta ao D1 continua respondendo tudo. Ligar o
   * aviso é `wrangler secret put ALERTA_WEBHOOK`.
   *
   * É segredo de verdade — quem tem a URL escreve no canal —, então ela nunca
   * entra em `wrangler.toml`, que é versionado.
   */
  ALERTA_WEBHOOK?: string;
  /**
   * As credenciais do provedor de pagamento. SEGREDOS, e opcionais.
   *
   * Opcionais porque o jogo inteiro funciona sem elas: sem `MP_ACCESS_TOKEN` a
   * rota de checkout responde `pagamento_indisponivel` e a vitrine continua
   * mostrando os pacotes. É o que permite construir e testar tudo antes de
   * existir uma conta ativa.
   *
   * `MP_WEBHOOK_SECRET` é a chave que verifica a assinatura do webhook — sem
   * ela, NENHUM pagamento é aceito, porque a alternativa seria aceitar qualquer
   * requisição que chegue naquela URL.
   */
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
}

// O ritmo de gravação mora em `ritmo.ts`: é um balde de fichas, não um
// intervalo fixo. Ver lá o defeito que a mudança conserta.

/** Teto do corpo do save, em bytes. */
const SAVE_MAX_BYTES = 512 * 1024;

/**
 * Teto de corpo das rotas pequenas.
 *
 * 64 KB cabe oitenta marcas com folga larga e não cabe um corpo inflado de
 * propósito. O `/save` tem teto próprio porque ele é grande por natureza.
 */
const CORPO_MAX_BYTES = 64 * 1024;

/**
 * Desde quando o servidor conhece esta conta, em epoch de segundos.
 *
 * ## Por que o valor nunca vem do cliente
 *
 * É o orçamento de progresso: uma conta de dez minutos não pode ter chegado ao
 * topo da Provação. Se o cliente pudesse dizer sua própria idade, bastaria
 * mentir aqui para liberar qualquer marca — o número perderia justamente a
 * propriedade que o torna útil.
 *
 * ## O que acontece com quem já existia
 *
 * A tabela nasceu depois de haver jogadores. Para esses, a idade é semeada de
 * `saves.atualizado_em`, que também é relógio do SERVIDOR e é um limite
 * inferior honesto: quem já gravou um save há três dias existe há pelo menos
 * três dias.
 *
 * Sem isso, todo jogador atual viraria "conta nova" no dia do deploy e teria a
 * própria marca recusada — o modo de falhar mais fácil de causar aqui, e o mais
 * difícil de entender pelo lado de quem joga.
 */
async function contaDesde(env: Env, usuario: string, agora: number): Promise<number> {
  const existente = await env.DB
    .prepare('SELECT primeiro_em FROM contas WHERE usuario = ?')
    .bind(usuario)
    .first<{ primeiro_em: number }>();
  if (existente) return existente.primeiro_em;

  // Conta nova nasce AGORA. Não há semente a buscar, e a primeira versão disto
  // buscava: ela usava `saves.atualizado_em`, e estava errada de dois jeitos.
  //
  // Errada de fato, porque `atualizado_em` é a gravação MAIS RECENTE — medido
  // contra o banco de produção antes de publicar, a conta existente tinha save
  // de 94 segundos atrás e marca de galáxia 201; o orçamento dela teria sido
  // ~61, e a próxima sincronização seria recusada em silêncio.
  //
  // E errada de princípio, porque qualquer semente derivada do estado atual do
  // jogador vira brecha: bastaria gravar um save antes de mandar a primeira
  // marca para comprar idade.
  //
  // Quem já existia antes desta tabela foi apadrinhado na migração 0004 — o
  // único lugar onde isso pode acontecer sem virar porta, porque roda uma vez.
  const primeiro = agora;

  await env.DB
    .prepare('INSERT INTO contas (usuario, primeiro_em) VALUES (?, ?) ON CONFLICT(usuario) DO NOTHING')
    .bind(usuario, primeiro)
    .run();

  return primeiro;
}

/**
 * Consome uma ficha do balde do jogador, ou diz quanto falta esperar.
 *
 * O balde vive em `limites`, uma linha por (usuário, assunto) — ver a migração
 * 0003 para o motivo de não ser mais colunas em `saves`.
 *
 * Custa uma leitura e uma escrita por chamada. Vale a pena nas rotas que
 * ESCREVEM (uma chamada de `/marcas` pode virar oitenta linhas); não valeria
 * numa rota de leitura, e por isso `GET /placar` usa balde em memória.
 */
async function consumirFicha(
  env: Env,
  usuario: string,
  balde: NomeDeBalde,
  agora: number,
): Promise<{ pode: true } | { pode: false; esperar: number }> {
  const linha = await env.DB
    .prepare('SELECT fichas, em FROM limites WHERE usuario = ? AND balde = ?')
    .bind(usuario, balde)
    .first<{ fichas: number; em: number }>();

  const v = podeUsar(balde, linha ? { fichas: linha.fichas, em: linha.em } : null, agora);
  if (!v.pode) return { pode: false, esperar: v.esperar };

  await env.DB.prepare(`
    INSERT INTO limites (usuario, balde, fichas, em) VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario, balde) DO UPDATE SET fichas = excluded.fichas, em = excluded.em
  `).bind(usuario, balde, v.fichasRestantes, agora).run();

  return { pode: true };
}

const json = (dados: unknown, status = 200, origem = ''): Response => {
  /**
   * A recusa que viaja DENTRO de um 200 também vai para o livro.
   *
   * Quatro rotas respondem "deu certo" carregando o que NÃO deu: `/inventario`
   * devolve `recusados` e `faltaram`, `/missoes` devolve `recusadas`, `/marcas`
   * idem, e `/progresso` conta encontros recusados. É de propósito — um comando
   * ruim não pode derrubar o lote —, mas isso as tornava invisíveis duas vezes:
   * o status é 200, então `anotarRecusa` não olhava, e o cliente ignorava os
   * campos. Erro escondido dentro de sucesso é o pior lugar para um erro estar.
   *
   * O cabeçalho é montado AQUI porque aqui o objeto ainda é objeto: contar as
   * recusas custa um `for`, enquanto reabrir o corpo lá na frente custaria um
   * `JSON.parse` em toda resposta — inclusive nos 512 KB do save.
   *
   * E fica num lugar só. Marcar rota por rota seria dezenas de chamadas para
   * alguém esquecer na próxima que entrar, e a esquecida seria justo a que
   * ninguém ia procurar. Ver `CAMPOS_DE_RECUSA`.
   */
  const marcadas = contarRecusas(dados);

  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      'content-type': 'application/json',
      ...cabecalhosDeOrigem(origem),
      // O save é dado de conta: nenhum intermediário deve guardá-lo.
      'cache-control': 'no-store',
      ...(marcadas ? { [CABECALHO_DE_RECUSA]: marcadas } : {}),
    },
  });
};

/**
 * CORS por lista, nunca `*`.
 *
 * `*` seria mais simples e erraria feio: qualquer página aberta pelo jogador
 * poderia falar com esta API usando as credenciais dele.
 */
function cabecalhosDeOrigem(origem: string): Record<string, string> {
  if (!origem) return {};
  return {
    'access-control-allow-origin': origem,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'vary': 'origin',
  };
}

/**
 * A origem, se ela estiver na lista.
 *
 * ## Por que existe um padrão, e por que ele é estreito
 *
 * A lista literal não cobre os deploys de PREVIEW da Vercel: cada um ganha um
 * host próprio (`orbita-zero-a1b2c3-conta.vercel.app`), e testar numa branch
 * batia em CORS — a sincronização falhava calada e o jogador via o save preso
 * no navegador sem nenhuma mensagem.
 *
 * A entrada `https://*.vercel.app` NÃO seria aceitável: qualquer pessoa publica
 * um site em `vercel.app` e passaria a poder falar com esta API usando as
 * credenciais de quem abrisse a página. O padrão aceito aqui exige o PREFIXO do
 * projeto — `orbita-zero-…` — que só quem tem acesso ao projeto consegue
 * produzir.
 *
 * Continua sem `*` em nenhuma hipótese.
 */
export const origemPermitida = (req: Request, env: Env): string => {
  const origem = req.headers.get('origin') ?? '';
  if (!origem) return '';

  for (const bruto of env.ORIGENS.split(',')) {
    const permitida = bruto.trim();
    if (!permitida) continue;
    if (permitida === origem) return origem;

    // Um `*` só vale como prefixo de host, e só num host completo. Nunca como
    // curinga solto.
    if (permitida.includes('*') && casaComPadrao(origem, permitida)) return origem;
  }
  return '';
};

/** `https://orbita-zero-*.vercel.app` casa com um preview, e só com ele. */
export function casaComPadrao(origem: string, padrao: string): boolean {
  const [antes, depois, ...resto] = padrao.split('*');
  // Um curinga só, e ele precisa de texto dos dois lados: `https://*` casaria
  // com o mundo inteiro.
  if (resto.length || !antes || !depois) return false;
  if (!antes.startsWith('https://')) return false;
  return origem.startsWith(antes)
    && origem.endsWith(depois)
    && origem.length > antes.length + depois.length
    // O miolo é um rótulo de host: nada de barra, ponto ou arroba lá dentro.
    && /^[a-z0-9-]+$/i.test(origem.slice(antes.length, origem.length - depois.length));
}

/**
 * O livro das recusas deste isolado. Ver `recusas.ts`.
 *
 * Módulo e não campo: o Workers recicla isolados, e o acumulado morrer junto
 * com um deles é aceitável — o que se perde é a contagem exata de um minuto,
 * nunca o fato de que algo está falhando.
 */
const LIVRO_DE_RECUSAS = novoLivro();

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const resposta = await responder(req, env);

    /**
     * TODA recusa passa por aqui, e é de propósito que seja um lugar só.
     *
     * Anotar dentro de cada rota seria dezenas de chamadas para esquecer uma na
     * próxima rota que entrar — e a que faltasse seria justamente a que ninguém
     * ia procurar. Aqui não há como escapar.
     *
     * `waitUntil` porque o livro não pode atrasar a resposta do jogador: ele é
     * ferramenta de quem conserta, não do jogo.
     */
    const rota = new URL(req.url).pathname;

    if (resposta.status >= 400) {
      ctx.waitUntil(anotarRecusa(env, rota, resposta));
    }

    /**
     * E a recusa que vem DENTRO de um 200 também.
     *
     * Quatro rotas respondem "deu certo" carregando o que não deu — equipar
     * recusado, entrega barrada pela validação B, marca implausível, pote que
     * deu menos. É de propósito: um comando ruim não derruba o lote. Mas o
     * status 200 fazia o livro não olhar e o cliente ignorar o campo, e erro
     * escondido dentro de sucesso é o pior lugar para um erro estar.
     *
     * O cabeçalho vem contado de `json()`, onde o corpo ainda era objeto — ler
     * aqui não custa um `JSON.parse` por resposta. Ver `recusa-no-corpo.ts`.
     */
    const noCorpo = lerRecusas(resposta.headers.get(CABECALHO_DE_RECUSA));
    if (noCorpo.length) ctx.waitUntil(anotarVarias(env, rota, noCorpo));

    return resposta;
  },

  /**
   * O gatilho de tempo: lê o que ainda não foi avisado e conta a alguém.
   *
   * É a peça que fecha o ciclo aberto em 08/09. O livro `recusas` respondeu "o
   * que está quebrado" em cinco segundos, mas continuava dependendo de alguém
   * SUSPEITAR e ir olhar. Aqui o sistema deixa de depender de quem olha.
   *
   * Sem `ALERTA_WEBHOOK` configurado ele não faz nada, de propósito: o livro
   * continua sendo escrito e consultável, e ligar o aviso é colar uma URL.
   */
  async scheduled(_evento: ScheduledController, env: Env): Promise<void> {
    await avisarDasRecusas(env);
    await varrerCobrancas(env);
  },
} satisfies ExportedHandler<Env>;

/**
 * Fecha as cobranças que o webhook não fechou.
 *
 * ## Por que existe um terceiro caminho
 *
 * Já são três, e nenhum dos outros dois cobre este caso. O webhook é rápido e
 * depende de outra empresa acertar a URL; a tela do Pix pergunta enquanto o
 * jogador está olhando — e ele fecha a aba. Se o webhook falhar E a aba fechar,
 * o dinheiro saiu da conta de alguém e nós não sabemos.
 *
 * Este laço roda no gatilho de cinco minutos que já existe para os avisos. É o
 * único caminho que funciona com ninguém olhando.
 *
 * ## A janela, e por que ela tem os DOIS lados
 *
 * Mais nova que um minuto é trabalho do webhook: perguntar ao provedor sobre
 * uma cobrança recém-criada dobra o tráfego para não adiantar nada.
 *
 * Mais velha que quatro horas vira `expirada` e sai da varredura — senão a
 * lista só cresce, e a cada cinco minutos perguntaríamos ao Mercado Pago sobre
 * toda cobrança abandonada da semana. Quatro horas é oito vezes o que a tela
 * promete, e um Pix pago depois disso ainda é honrado: `podePagar` aceita a
 * expirada de propósito, e o webhook continua chegando.
 */
async function varrerCobrancas(env: Env): Promise<void> {
  if (!env.MP_ACCESS_TOKEN) return;
  const agora = Math.floor(Date.now() / 1000);
  const JANELA = 4 * 60 * 60;

  const { results } = await env.DB.prepare(`
    SELECT provedor_id FROM compras
     WHERE estado = 'pendente' AND provedor_id IS NOT NULL
       AND criada_em BETWEEN ? AND ?
     ORDER BY criada_em DESC
     LIMIT 20
  `).bind(agora - JANELA, agora - 60).all<{ provedor_id: string }>();

  for (const linha of results) {
    // Uma cobrança que estoura não pode levar as outras junto: a próxima da
    // lista pode ser a que tem dinheiro parado.
    try {
      await creditarPagamento(env, linha.provedor_id);
    } catch (erro) {
      await anotarExcecaoDeAuditoria(env, '/varredura/compras', erro);
    }
  }

  await env.DB.prepare(
    "UPDATE compras SET estado = 'expirada' WHERE estado = 'pendente' AND criada_em < ?",
  ).bind(agora - JANELA).run();
}

/**
 * Junta o que falta avisar, manda, e só então marca como avisado.
 *
 * A ordem é a disciplina da fila da carteira: só se apaga o que se confirmou
 * ter entregado. Um aviso perdido por rede fora reaparece no ciclo seguinte —
 * porque o defeito continua lá, e sumir com a marca seria o pior dos mundos.
 */
async function avisarDasRecusas(env: Env): Promise<void> {
  if (!env.ALERTA_WEBHOOK) return;

  /**
   * `primeiraHora` vem de uma subconsulta, e é ela que marca o motivo NOVO.
   *
   * Um par rota+motivo que nunca existiu antes é a assinatura de "um deploy
   * quebrou alguma coisa" — foi exatamente assim que `no such column: semente`
   * apareceu. Sem isso, um erro inédito chegaria com o mesmo peso de um
   * conhecido.
   */
  const { results } = await env.DB.prepare(`
    SELECT r.rota, r.motivo, r.hora, r.n, r.avisado,
           (SELECT MIN(p.hora) FROM recusas p
             WHERE p.rota = r.rota AND p.motivo = r.motivo) AS primeiraHora
      FROM recusas r
     WHERE r.n > r.avisado
     ORDER BY r.hora DESC
     LIMIT 200
  `).all<LinhaDeRecusa>();

  const aviso = montarAviso(results);
  if (!aviso) return;

  const status = await enviarAviso(env.ALERTA_WEBHOOK, aviso);

  /**
   * O aviso que não sai também vira linha no livro.
   *
   * Sem isto, o sistema de avisos era o único componente do servidor incapaz de
   * avisar que estava quebrado — e foi exatamente o que aconteceu em 09/09: o
   * segredo configurado, o gatilho publicado, e nada chegando. Do lado de fora
   * não havia como distinguir "o gatilho nunca rodou" de "rodou e o destino
   * recusou".
   *
   * Agora a diferença se lê na tabela: sem linha `/alerta`, o gatilho não
   * rodou; com `envio_400`, ele rodou e o Discord recusou o corpo.
   */
  if (status < 200 || status >= 300) {
    /**
     * `envio_0` sozinho não fecha o diagnóstico: ele diz que o `fetch` nem
     * recebeu resposta, e isso tem duas causas bem diferentes — a URL não é uma
     * URL, ou é e o destino não respondeu. O host separa as duas.
     *
     * O host é seguro de gravar (`discord.com` não identifica ninguém). O
     * CAMINHO é que carrega o token do webhook, e ele nunca sai do segredo.
     */
    const host = hostDoAviso(env.ALERTA_WEBHOOK);
    // Não sendo URL, o que interessa é a FORMA do valor: é ela que diz se a
    // colagem trouxe aspas, BOM ou espaço. Nenhum caractere do segredo sai.
    const alvo = host
      ? `alvo_${host.replace(/[^a-z0-9.]/gi, '')}`
      : `valor_${formaDoValor(env.ALERTA_WEBHOOK)}`;

    await Promise.all([
      anotarMotivo(env, '/alerta', `envio_${status}`, 500),
      anotarMotivo(env, '/alerta', alvo.slice(0, 48), 500),
    ]).catch(() => { /* o livro nunca derruba o gatilho */ });
    return;
  }

  await env.DB.batch(results.map((l) => env.DB
    .prepare('UPDATE recusas SET avisado = ? WHERE rota = ? AND motivo = ? AND hora = ?')
    .bind(l.n, l.rota, l.motivo, l.hora)));
}

/**
 * Roteia, e transforma em resposta o que escapar como exceção.
 *
 * ## A brecha que isto fecha
 *
 * `anotarRecusa` só enxerga o que VIRA resposta. Uma exceção não tratada dentro
 * de uma rota escapava do `fetch` inteiro: o runtime devolvia o erro dele, o
 * livro não registrava nada e o aviso nunca saía.
 *
 * Ou seja, justamente a falha que ninguém previu — a única que não tem um
 * `catch` escrito à mão em algum lugar — era a única invisível. Agora ela vira
 * `http_500` no livro, com o nome da exceção junto, e o aviso a trata como
 * urgente.
 *
 * O nome do erro entra; a pilha, não. Ela pode carregar dado do jogador, e um
 * livro de operação não é lugar para isso.
 */
async function responder(req: Request, env: Env): Promise<Response> {
  try {
    return await rotear(req, env);
  } catch (erro) {
    /**
     * O nome sozinho não diagnostica nada.
     *
     * Em 09/09 apareceu `/admin/painel · excecao_Error` — uma linha que prova
     * que houve exceção e não diz uma palavra sobre qual. Rodar cada consulta
     * do painel à mão contra a produção não achou nada, e aí o rastro acabou.
     *
     * A mensagem entra **saneada**, com a mesma régua do erro do navegador:
     * letras e pontuação, sem dígito e sem símbolo. Aqui a mensagem é do NOSSO
     * código, não do jogador, mas o cuidado é o mesmo — um id ou um token pode
     * ter sido interpolado nela por alguém que não pensou nisso.
     *
     * A pilha continua fora, sempre.
     */
    const nome = erro instanceof Error ? erro.name : 'erro';
    const msg = erro instanceof Error ? erro.message : '';
    const motivo = motivoSaneado(`excecao ${nome} ${msg}`) || `excecao_${nome}`;

    return json({ erro: motivo.slice(0, 64) }, 500, origemPermitida(req, env));
  }
}

/**
 * Grava a recusa, agregada por rota, motivo e hora.
 *
 * Engole o próprio erro — e desta vez é a escolha certa, pelo motivo contrário
 * ao de `registrarExcedentes`: aqui não há pagamento nenhum acontecido, e um
 * livro de operação que derrube a resposta do jogador é pior que a cegueira que
 * ele veio curar.
 */
async function anotarRecusa(env: Env, rota: string, resposta: Response): Promise<void> {
  try {
    if (IGNORADOS.has(resposta.status)) return;

    let corpo: unknown = null;
    // `clone` porque ler o corpo consome o fluxo, e este é o corpo que já está
    // a caminho do jogador.
    try { corpo = await resposta.clone().json(); } catch { /* corpo não-JSON */ }

    await anotarMotivo(env, rota, motivoDaResposta(corpo, resposta.status), resposta.status);
  } catch { /* ver o cabeçalho */ }
}

/**
 * Escreve UM motivo no livro, respeitando o acúmulo em memória.
 *
 * Existe porque três caminhos chegam aqui — a resposta ≥ 400, a recusa dentro
 * de um 200, e a exceção que uma auditoria engoliu — e escrever a mesma coisa
 * em três lugares seria três chances de divergir na próxima mudança.
 *
 * Ver `recusas.ts` para o porquê de o acúmulo existir: uma tempestade não pode
 * gastar a cota de escrita registrando a si mesma.
 */
async function anotarMotivo(
  env: Env, rota: string, motivo: string, status: number, vezes = 1,
): Promise<void> {
  const agora = Math.floor(Date.now() / 1000);
  const n = acumular(LIVRO_DE_RECUSAS, { rota, motivo, status }, agora, vezes);
  if (!n) return;

  await env.DB.prepare(`
    INSERT INTO recusas (rota, motivo, hora, n) VALUES (?, ?, ?, ?)
    ON CONFLICT(rota, motivo, hora) DO UPDATE SET n = recusas.n + excluded.n
  `).bind(rota.slice(0, 64), motivo, horaDe(agora), n).run();
}

/**
 * O erro de JavaScript que aconteceu no navegador do jogador.
 *
 * ## Por que existe
 *
 * Era o último buraco. O servidor conta tudo o que ELE recusa e avisa a cada
 * cinco minutos; um `TypeError` num painel acontece inteiro do outro lado, a
 * tela quebra, o jogador fecha a aba, e aqui não sobra rastro nenhum. É a
 * classe **mais visível para quem joga e menos visível para quem conserta** — e
 * os quatro defeitos de 08/09 foram todos de interação.
 *
 * ## O que esta rota NÃO aceita
 *
 * Pilha, mensagem crua, URL, nome de arquivo. O cliente já manda o motivo
 * saneado (letras e pontuação, sem dígito e sem símbolo), e aqui ele é saneado
 * **de novo** — o cliente é a parte do sistema que não se confia, e essa é a
 * regra que sustenta a Fase 3 inteira. Sem isso, esta seria a única rota do
 * jogo capaz de escrever texto arbitrário numa coluna.
 *
 * Não há coluna `usuario`, como no resto do livro: a pergunta é "o que está
 * quebrado", nunca "quem quebrou".
 */
async function receberErroDoCliente(
  req: Request, env: Env, id: string, origem: string,
): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'cliente', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  // Mil vezes menor que o teto normal: o que cabe aqui é uma frase.
  if (bruto.length > 2048) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { motivo?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const motivo = motivoSaneado(String(corpo.motivo ?? ''));
  if (!motivo) return json({ erro: 'motivo_invalido' }, 400, origem);

  await anotarMotivo(env, '/cliente', motivo, 500)
    .catch(() => { /* o livro nunca derruba nada */ });

  return json({ ok: true }, 200, origem);
}

/**
 * O motivo, saneado do lado de cá também.
 *
 * O cliente já sane, e mesmo assim: **o cliente é a parte que não se confia.**
 * Um envio forjado passaria direto pelo saneador dele, e esta é a única coluna
 * do banco alimentada por texto que veio de fora.
 */
export function motivoSaneado(bruto: string): string {
  const limpo = bruto
    .replace(/[^A-Za-z ,.:'()_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  // Uma letra só não descreve erro nenhum; é ruído ou tentativa.
  return limpo.length >= 3 ? limpo : '';
}

/** As recusas que vieram dentro de um 200, cada uma com a contagem dela. */
async function anotarVarias(
  env: Env, rota: string, itens: readonly { motivo: string; n: number }[],
): Promise<void> {
  try {
    for (const i of itens) await anotarMotivo(env, rota, i.motivo, 200, i.n);
  } catch { /* o livro nunca derruba nada */ }
}

/**
 * A exceção que uma auditoria engoliu — porque engolir continua sendo o certo.
 *
 * `registrarExcedentes` e a precificação de encontros rodam DEPOIS do
 * pagamento: uma exceção delas não pode virar erro para quem já recebeu. Só que
 * engolir em silêncio foi exatamente o que deixou a auditoria de teto rodando
 * meses sem gravar uma linha, com um `SELECT setor` numa coluna chamada
 * `melhor_setor`.
 *
 * Agora ela continua sendo engolida para o jogador e passa a ser CONTADA para
 * quem conserta. É o único jeito de as duas coisas serem verdade ao mesmo tempo.
 */
async function anotarExcecaoDeAuditoria(
  env: Env, rota: string, erro: unknown,
): Promise<void> {
  const nome = erro instanceof Error ? erro.name : 'erro';
  await anotarMotivo(env, rota, `auditoria_${nome}`.slice(0, 48), 500)
    .catch(() => { /* nem isto pode estourar: seria trocar cegueira por queda */ });
}

async function rotear(req: Request, env: Env): Promise<Response> {
    const origem = origemPermitida(req, env);
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecalhosDeOrigem(origem) });
    }

    // Saúde: sem autenticação de propósito. É o endpoint que prova que a
    // infraestrutura subiu, e exigir login para isso faria depurar um deploy
    // depender de o login já funcionar.
    if (url.pathname === '/saude') {
      return json({ ok: true, agora: new Date().toISOString() }, 200, origem);
    }

    /**
     * O webhook do provedor de pagamento — a ÚNICA rota sem token de jogador.
     *
     * Ela precisa vir antes da checagem de autenticação porque quem chama não é
     * um jogador: é o Mercado Pago, de um servidor que não tem sessão nenhuma.
     * A prova de identidade dela é a **assinatura HMAC** do corpo, verificada em
     * `receberPagamento`, e não um JWT.
     *
     * Estar aqui em cima é deliberado e perigoso na mesma medida: qualquer erro
     * neste caminho é uma porta aberta para creditar cristais de graça. Por isso
     * a verificação é a primeira coisa que ela faz, e por isso o valor pago é
     * conferido contra o valor cobrado mesmo depois de a assinatura passar.
     */
    if (url.pathname === '/webhook/pagamento' && req.method === 'POST') {
      return receberPagamento(req, env);
    }

    const usuario = await usuarioDoToken(req.headers.get('authorization'), env.SUPABASE_URL);
    if (!usuario) return json({ erro: 'nao_autenticado' }, 401, origem);

    if (url.pathname === '/save') {
      if (req.method === 'GET') return baixarSave(env, usuario.id, origem);
      if (req.method === 'PUT') return subirSave(req, env, usuario.id, origem);
    }

    if (url.pathname === '/apelido' && req.method === 'PUT') {
      return definirApelido(req, env, usuario.id, origem);
    }

    if (url.pathname === '/marcas' && req.method === 'PUT') {
      return enviarMarcas(req, env, usuario.id, origem);
    }

    if (url.pathname === '/placar' && req.method === 'GET') {
      // Leitura barata, mas não de graça: são três consultas por chamada, e o
      // painel pergunta a cada vinte segundos com a tela aberta. O balde em
      // memória cabe isso e não cabe um laço.
      if (!podeLer(usuario.id, Math.floor(Date.now() / 1000))) {
        return json({ erro: 'rapido_demais' }, 429, origem);
      }
      const qual = url.searchParams.get('id') ?? '';
      const casco = (url.searchParams.get('casco') ?? '').slice(0, 40);
      const dados = await lerPlacar(env, qual, usuario.id, casco);
      return json(dados, 200, origem);
    }

    if (url.pathname === '/online' && req.method === 'GET') {
      /**
       * Quantos jogadores falaram com o servidor há pouco.
       *
       * ## O que este número É, exatamente
       *
       * Contagem de contas cujo save subiu nos últimos cinco minutos. Não é
       * "sockets abertos": o jogo sobe sozinho a cada poucos minutos, então
       * quem está jogando aparece aqui mesmo sem o chat aberto — e o chat só
       * conecta para quem já escolheu apelido, o que deixaria de fora
       * justamente o jogador novo.
       *
       * A janela é maior que o intervalo de subida de propósito. Menor que
       * ele, alguém jogando sem parar piscaria entre dentro e fora da conta.
       *
       * ## Por que a rota não confere se quem pergunta é admin
       *
       * Porque a lista de admins mora no pacote do cliente, e duplicá-la aqui
       * criaria duas verdades que se desencontram na primeira mudança. O que
       * sai daqui é um NÚMERO agregado, sem identidade de ninguém — e a rota
       * já exige sessão válida. Esconder o selo de quem não é admin é decisão
       * de interface, e é onde ela está.
       */
      if (!podeLer(usuario.id, Math.floor(Date.now() / 1000))) {
        return json({ erro: 'rapido_demais' }, 429, origem);
      }
      const desde = Math.floor(Date.now() / 1000) - 300;
      const r = await env.DB
        .prepare('SELECT COUNT(*) AS n FROM saves WHERE atualizado_em > ?')
        .bind(desde)
        .first<{ n: number }>();
      return json({ online: r?.n ?? 0, janelaSegundos: 300 }, 200, origem);
    }

    /**
     * Visão operacional completa: identidade pública, atividade e progresso.
     *
     * Diferente de `/online`, esta rota revela linhas por pessoa. Por isso o
     * portão não pode morar apenas no cliente: qualquer conta poderia chamar a
     * URL direto pelo console. A autorização acontece depois da validação do
     * JWT, usando o id assinado pelo Supabase.
     */
    if (url.pathname === '/admin/painel' && req.method === 'GET') {
      if (!podeLerPainelAdmin(usuario.id)) return json({ erro: 'nao_autorizado' }, 403, origem);
      return json(await lerPainelAdmin(env, Math.floor(Date.now() / 1000)), 200, origem);
    }

    if (url.pathname === '/carteira' && req.method === 'GET') {
      // Mesma defesa do placar: leitura barata, mas perguntada com frequência
      // pela tela da Loja. Balde em memória, não linha no banco.
      if (!podeLer(usuario.id, Math.floor(Date.now() / 1000))) {
        return json({ erro: 'rapido_demais' }, 429, origem);
      }
      return json(await carteiraDe(env, usuario.id), 200, origem);
    }

    if (url.pathname === '/carteira' && req.method === 'POST') {
      return movimentar(req, env, usuario.id, origem);
    }

    if (url.pathname === '/vip' && req.method === 'POST') {
      return comprarVip(env, usuario.id, origem);
    }

    if (url.pathname === '/lote' && req.method === 'POST') {
      return entregarLote(req, env, usuario.id, origem);
    }

    if (url.pathname === '/inventario') {
      if (req.method === 'GET') return json({ itens: await inventarioDe(env, usuario.id) }, 200, origem);
      if (req.method === 'POST') return aplicarComandos(req, env, usuario.id, origem);
    }

    if (url.pathname === '/sintetizar' && req.method === 'POST') {
      return sintetizar(req, env, usuario.id, origem);
    }

    if (url.pathname === '/frota') {
      if (req.method === 'GET') return json({ frota: await frotaDe(env, usuario.id) }, 200, origem);
      if (req.method === 'POST') return adquirirCasco(req, env, usuario.id, origem);
    }

    if (url.pathname === '/missoes') {
      if (req.method === 'GET') return json(await missoesDe(env, usuario.id), 200, origem);
      if (req.method === 'POST') return gravarMissoes(req, env, usuario.id, origem);
    }

    if (url.pathname === '/progresso') {
      if (req.method === 'GET') return json(await progressoDe(env, usuario.id), 200, origem);
      if (req.method === 'POST') return gravarProgresso(req, env, usuario.id, origem);
    }

    if (url.pathname === '/checkout' && req.method === 'POST') {
      return abrirCobranca(req, env, usuario.id, origem);
    }

    if (url.pathname === '/compra' && req.method === 'POST') {
      return estadoDaCompra(req, env, usuario.id, origem);
    }

    if (url.pathname === '/erro-do-cliente' && req.method === 'POST') {
      return receberErroDoCliente(req, env, usuario.id, origem);
    }

    if (url.pathname === '/ausencia' && req.method === 'POST') {
      return creditarAusencia(req, env, usuario.id, origem);
    }

    return json({ erro: 'nao_encontrado' }, 404, origem);
}

// ── carteira ────────────────────────────────────────────────────────────────

/**
 * Os saldos do jogador, do cache.
 *
 * Lê `saldos` e não soma `transacoes`: somar a história inteira a cada
 * requisição funciona no primeiro mês e fica caro no primeiro ano. O livro
 * continua sendo a verdade — `saldosDoLivroDe` reconstrói quando é preciso
 * conferir, e é o que a auditoria do pódio vai usar.
 */
async function saldosDe(env: Env, usuario: string): Promise<Record<Moeda, number>> {
  const { results } = await env.DB
    .prepare('SELECT moeda, quantia FROM saldos WHERE usuario = ?')
    .bind(usuario)
    .all<{ moeda: string; quantia: number }>();

  const r = {} as Record<Moeda, number>;
  for (const m of MOEDAS) r[m] = 0;
  for (const linha of results) {
    if ((MOEDAS as readonly string[]).includes(linha.moeda)) r[linha.moeda as Moeda] = linha.quantia;
  }
  return r;
}

/** Saldos e passe numa resposta só: a tela da Loja precisa dos dois juntos. */
async function carteiraDe(env: Env, usuario: string): Promise<{ saldos: Record<Moeda, number>; vipExpiraEm: number }> {
  const [saldos, assinatura] = await Promise.all([
    saldosDe(env, usuario),
    env.DB.prepare('SELECT expira_em FROM assinaturas WHERE usuario = ?')
      .bind(usuario).first<{ expira_em: number }>(),
  ]);
  return { saldos, vipExpiraEm: assinatura?.expira_em ?? 0 };
}

/**
 * Aplica um lote de movimentos, tudo ou nada.
 *
 * ## Por que um lote e não um movimento por chamada
 *
 * A recompensa de missão entrega sucata, núcleo e cristal JUNTOS. Em três
 * chamadas, a segunda pode falhar e deixar o jogador com um terço do prêmio e
 * um livro que registra uma entrega que não aconteceu inteira. O lote resolve
 * pela raiz: ou os três entram, ou nenhum.
 *
 * ## Por que o cliente ainda declara o valor
 *
 * Porque nesta fase ele ainda é quem calcula o combate. O que o servidor
 * garante AGORA é que o saldo não é editável, que gastar exige o livro
 * concordar, e que todo ganho fica registrado com motivo e hora.
 *
 * ## E o que ele passou a MEDIR (Fase 5, passo 4)
 *
 * Conferir se o ganho foi merecido continua não acontecendo, e de propósito:
 * duas fórmulas de recusa foram medidas e as duas falharam — a menos ruim
 * recusaria todo jogador novo no setor 1, em silêncio. O `PLANO` deixou o
 * caminho escrito: *medir antes de impedir*.
 *
 * Então o lançamento entra sempre, e quando o declarado passa do teto físico
 * com dez vezes de folga, uma linha vai para `excedentes`. Ver `teto.ts` para
 * por que a margem é absurda de propósito e por que isso não custa cota.
 */
async function movimentar(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { movimentos?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const lista = Array.isArray(corpo.movimentos) ? corpo.movimentos : null;
  // Teto de itens no lote: uma recompensa toca no máximo as três moedas, e o
  // dobro disso já cobre qualquer combinação futura sem virar caminho barato
  // para inflar uma requisição.
  if (!lista || lista.length === 0 || lista.length > 6) {
    return json({ erro: 'movimentos_invalidos' }, 400, origem);
  }

  const lancamentos: Lancamento[] = [];
  for (const m of lista as { moeda?: unknown; quantia?: unknown; motivo?: unknown }[]) {
    const l: Lancamento = {
      usuario: id,
      moeda: m.moeda as Moeda,
      quantia: Math.trunc(Number(m.quantia)),
      motivo: m.motivo as Motivo,
      em: agora,
    };
    const recusa = conferirLancamento(l);
    if (recusa) return json({ erro: recusa }, 400, origem);
    // `compra` e `estorno` nascem do provedor de pagamento, no servidor. Aceitar
    // do cliente seria deixar qualquer um declarar que pagou.
    if (l.motivo === 'compra' || l.motivo === 'estorno') {
      return json({ erro: 'motivo_so_do_servidor' }, 403, origem);
    }
    lancamentos.push(l);
  }

  for (const l of lancamentos) {
    const r = await lancar(env, l);
    if (!r.ok) return json({ erro: r.erro, saldos: (await carteiraDe(env, id)).saldos }, 409, origem);
  }

  // Depois de pagar, nunca antes: a auditoria não pode atrasar nem derrubar o
  // caminho do dinheiro. Se ela falhar, o jogador recebe igual.
  await registrarExcedentes(env, id, lancamentos, agora);

  return json(await carteiraDe(env, id), 200, origem);
}

/**
 * Registra o que passou do teto físico. Não recusa nada — ver `teto.ts`.
 *
 * ## Duas leituras, nenhuma escrita no caso normal
 *
 * O teto depende do SETOR (o quanto um abate pode render ali) e da JANELA (o
 * quanto de tempo o ganho cobre). Nenhum dos dois vem do cliente: o setor sai
 * de `progresso`, que só sobe e é do servidor, e a janela sai do próprio livro
 * — o intervalo desde o lançamento anterior. Aceitar qualquer um dos dois do
 * cliente daria ao trapaceiro o botão de afrouxar o próprio teto.
 *
 * Leitura é barata na cota (5 milhões por dia contra 100 mil escritas), e no
 * caso normal isto termina sem gravar nada.
 *
 * ## Por que engole o próprio erro
 *
 * Porque ela roda DEPOIS do pagamento. Uma exceção aqui devolveria 500 para um
 * jogador que já recebeu — ele veria erro, tentaria de novo, e a idempotência
 * do livro é o que o salvaria. Auditoria que quebra o jogo não é auditoria.
 */
async function registrarExcedentes(
  env: Env, id: string, lancamentos: readonly Lancamento[], agora: number,
): Promise<void> {
  try {
    const ganhos = lancamentos.filter((l) => l.quantia > 0);
    if (!ganhos.length) return;

    const ctx = await env.DB
      .prepare(
        'SELECT (SELECT melhor_setor FROM progresso WHERE usuario = ?1) AS setor,'
        + ' (SELECT MAX(em) FROM transacoes WHERE usuario = ?1 AND em < ?2) AS anterior',
      )
      .bind(id, agora)
      .first<{ setor: number | null; anterior: number | null }>();

    // Sem progresso gravado, o setor 1 é o mais CONSERVADOR possível: é onde o
    // teto é mais baixo, então usá-lo nunca deixa passar o que deveria pegar.
    const setor = ctx?.setor ?? 1;
    // Primeira transação da conta não tem janela anterior. Uma janela de zero
    // faria qualquer valor exceder, então ela vale o intervalo mínimo do
    // balde de fichas — o menor tempo real entre duas declarações.
    const segundos = ctx?.anterior ? Math.max(1, agora - ctx.anterior) : 120;

    const escritas: D1PreparedStatement[] = [];
    for (const l of ganhos) {
      const e = excedeu(l.quantia, setor, segundos);
      if (!e) continue;
      escritas.push(env.DB
        .prepare(
          'INSERT INTO excedentes (usuario, em, moeda, motivo, quantia, teto, folga, setor, segundos)'
          + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, agora, l.moeda, l.motivo, e.quantia, e.teto, e.folga, e.setor, e.segundos));
    }
    if (escritas.length) await env.DB.batch(escritas);
  } catch (erro) {
    // Ver o cabeçalho: o pagamento já aconteceu, e a auditoria não pode
    // transformar um erro dela num erro dele.
    //
    // Mas ENGOLIR EM SILÊNCIO foi o que deixou esta função meses sem gravar uma
    // linha, com um `SELECT setor` numa coluna chamada `melhor_setor`. Continua
    // engolida para o jogador, e passa a ser contada para quem conserta.
    await anotarExcecaoDeAuditoria(env, '/carteira:excedentes', erro);
  }
}

/**
 * Compra ou renova o passe.
 *
 * O débito e a extensão são do SERVIDOR: o cliente só pede. Era a última peça
 * em que `state.vip.expiresAt` no save bastava para ter passe de graça.
 */
async function comprarVip(env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'acao', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const r = await lancar(env, {
    usuario: id, moeda: 'cristal', quantia: -VIP_CUSTO_CRISTAIS, motivo: 'vip', em: agora,
  });
  if (!r.ok) return json({ erro: r.erro }, 409, origem);

  const atual = await env.DB.prepare('SELECT expira_em FROM assinaturas WHERE usuario = ?')
    .bind(id).first<{ expira_em: number }>();
  const novo = renovar(atual?.expira_em ?? 0, agora);

  await env.DB.prepare(`
    INSERT INTO assinaturas (usuario, expira_em) VALUES (?, ?)
    ON CONFLICT(usuario) DO UPDATE SET expira_em = excluded.expira_em
  `).bind(id, novo).run();

  return json(await carteiraDe(env, id), 200, origem);
}

/** Reconstrói os saldos a partir do livro. A verdade, para conferir o cache. */
export async function saldosDoLivroDe(env: Env, usuario: string): Promise<Record<Moeda, number>> {
  const { results } = await env.DB
    .prepare('SELECT usuario, moeda, quantia, motivo, origem, em FROM transacoes WHERE usuario = ?')
    .bind(usuario)
    .all<Lancamento>();
  return saldosDoLivro(results);
}

/**
 * Grava um lançamento e move o saldo, atomicamente.
 *
 * ## Por que `batch` e não duas chamadas
 *
 * `batch` do D1 é uma transação: ou as duas linhas entram, ou nenhuma. Sem
 * isso existiria o intervalo em que o saldo já mudou e o livro ainda não sabe
 * — e é exatamente o estado que torna a auditoria impossível, porque não há
 * como distinguir "faltou gravar" de "alguém mexeu".
 *
 * ## Por que o débito é condicional
 *
 * O `WHERE quantia >= ?` recusa no próprio banco em vez de ler o saldo antes e
 * decidir aqui. Ler-decidir-escrever tem uma janela entre a leitura e a
 * escrita, e dois pedidos ao mesmo tempo passariam os dois pela mesma leitura.
 * Com a condição no UPDATE, o segundo encontra o saldo já baixado e não muda
 * linha nenhuma.
 */
export async function lancar(env: Env, l: Lancamento): Promise<{ ok: true } | { ok: false; erro: Recusa | 'repetido' }> {
  const recusa = conferirLancamento(l);
  if (recusa) return { ok: false, erro: recusa };

  if (l.quantia < 0) {
    const saldo = (await saldosDe(env, l.usuario))[l.moeda];
    if (!podeDebitar(saldo, -l.quantia)) return { ok: false, erro: 'saldo_insuficiente' };
  }

  const inserir = env.DB.prepare(
    'INSERT INTO transacoes (usuario, moeda, quantia, motivo, origem, em) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(l.usuario, l.moeda, l.quantia, l.motivo, l.origem ?? null, l.em);

  // O crédito cria a linha se não existir; o débito exige que ela exista COM
  // saldo suficiente, e por isso não pode usar `ON CONFLICT`.
  const mover = l.quantia > 0
    ? env.DB.prepare(`
        INSERT INTO saldos (usuario, moeda, quantia, atualizado_em) VALUES (?, ?, ?, ?)
        ON CONFLICT(usuario, moeda) DO UPDATE SET
          quantia = quantia + excluded.quantia, atualizado_em = excluded.atualizado_em
      `).bind(l.usuario, l.moeda, l.quantia, l.em)
    : env.DB.prepare(`
        UPDATE saldos SET quantia = quantia - ?, atualizado_em = ?
         WHERE usuario = ? AND moeda = ? AND quantia >= ?
      `).bind(-l.quantia, l.em, l.usuario, l.moeda, -l.quantia);

  try {
    const [, r] = await env.DB.batch([inserir, mover]);
    // Débito que não moveu linha perdeu a corrida: o saldo caiu entre a
    // conferência acima e este UPDATE. A transação inteira é revertida pelo
    // `batch`, então não sobra lançamento órfão.
    if (l.quantia < 0 && r.meta.changes === 0) return { ok: false, erro: 'saldo_insuficiente' };
    return { ok: true };
  } catch {
    // O índice único em (motivo, origem) barrou: este evento externo já foi
    // processado. É o caminho normal quando o provedor de pagamento reenvia o
    // webhook, e não um erro.
    return { ok: false, erro: 'repetido' };
  }
}

async function baixarSave(env: Env, id: string, origem: string): Promise<Response> {
  const linha = await env.DB
    .prepare('SELECT estado, versao, atualizado_em, versao_servidor FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ estado: string; versao: number; atualizado_em: number; versao_servidor: number }>();

  // `versaoServidor: 0` para quem nunca gravou. É o valor que o cliente manda de
  // volta no primeiro PUT, e é o que o INSERT espera encontrar.
  if (!linha) return json({ vazio: true, versaoServidor: 0 }, 200, origem);
  return json({
    estado: JSON.parse(linha.estado),
    versao: linha.versao,
    atualizadoEm: linha.atualizado_em,
    versaoServidor: linha.versao_servidor,
  }, 200, origem);
}

/**
 * Grava o save, se a versão bater e houver ficha.
 *
 * ## Concorrência otimista, e por que ela é necessária aqui
 *
 * O cliente manda `base`: a `versao_servidor` que ele conhecia. Se não for a
 * atual, ALGUÉM gravou no meio — outro PC, outra aba — e gravar por cima
 * apagaria aquele progresso sem ninguém notar. O 409 devolve o save do
 * servidor para o cliente decidir, em vez de escolher escondido.
 *
 * A alternativa era comparar carimbos de tempo do cliente, que foi o que havia
 * antes: dois computadores com relógios diferentes decidem errado, e o relógio
 * adiantado ganha sempre, inclusive contra progresso mais novo.
 */
async function subirSave(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > SAVE_MAX_BYTES) return json({ erro: 'save_grande_demais' }, 413, origem);

  let corpo: { estado?: unknown; versao?: number; base?: number };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!corpo.estado || typeof corpo.versao !== 'number') {
    return json({ erro: 'corpo_incompleto' }, 400, origem);
  }

  // Estado sem piloto é o save técnico inicial, permitido para a conta poder
  // abrir em outro aparelho. A partir do momento que existe uma nave escolhida,
  // contudo, não há jogo sem identidade: o apelido precisa estar no servidor,
  // e não apenas escondido por uma tela do cliente.
  const piloto = typeof corpo.estado === 'object' && corpo.estado !== null
    ? (corpo.estado as { piloto?: unknown }).piloto
    : null;
  if (typeof piloto === 'string' && piloto.trim()) {
    const temApelido = await env.DB.prepare('SELECT 1 FROM apelidos WHERE usuario = ?').bind(id).first();
    if (!temApelido) return json({ erro: 'apelido_obrigatorio' }, 403, origem);
  }

  const agora = Math.floor(Date.now() / 1000);
  const atual = await env.DB
    .prepare('SELECT versao_servidor, fichas, fichas_em, estado, atualizado_em FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ versao_servidor: number; fichas: number; fichas_em: number; estado: string; atualizado_em: number }>();

  const versaoAtual = atual?.versao_servidor ?? 0;
  const base = typeof corpo.base === 'number' ? corpo.base : versaoAtual;

  if (base !== versaoAtual) {
    // Conflito. Devolve o que está guardado para o cliente reconciliar — ele
    // sabe comparar progresso (tempo jogado), coisa que este Worker não faz de
    // propósito: abrir o save aqui obrigaria o servidor a entender o formato do
    // jogo, e toda mudança de save viraria deploy de servidor.
    return json({
      erro: 'conflito',
      versaoServidor: versaoAtual,
      estado: atual ? JSON.parse(atual.estado) : null,
      atualizadoEm: atual?.atualizado_em ?? 0,
    }, 409, origem);
  }

  const permissao = podeGravar(
    atual ? { fichas: atual.fichas, em: atual.fichas_em } : null,
    agora,
  );
  if (!permissao.pode) {
    // 429 e não 400: não é erro do cliente, é ritmo. A resposta diz quanto
    // falta para ele não ficar tentando.
    return json({ erro: 'cedo_demais', esperar: permissao.esperar }, 429, origem);
  }

  const nova = versaoAtual + 1;
  await env.DB
    .prepare(`INSERT INTO saves (usuario, estado, versao, atualizado_em, versao_servidor, fichas, fichas_em)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(usuario) DO UPDATE SET
                estado = excluded.estado,
                versao = excluded.versao,
                atualizado_em = excluded.atualizado_em,
                versao_servidor = excluded.versao_servidor,
                fichas = excluded.fichas,
                fichas_em = excluded.fichas_em`)
    .bind(id, JSON.stringify(corpo.estado), corpo.versao, agora, nova, permissao.fichasRestantes, agora)
    .run();

  return json({ ok: true, atualizadoEm: agora, versaoServidor: nova }, 200, origem);
}

// ── placar ─────────────────────────────────────────────────────────────────

/**
 * Reivindica o apelido público do jogador.
 *
 * A unicidade é do banco (`apelido_normal UNIQUE`) e não de um SELECT antes do
 * INSERT: entre a checagem e a escrita cabem duas requisições simultâneas, e o
 * segundo lugar levaria o mesmo nome. Deixar a restrição falhar é a única forma
 * que não tem janela.
 */
async function definirApelido(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { apelido?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const apelido = apelidoValido(corpo.apelido);
  if (!apelido) return json({ erro: 'apelido_invalido' }, 400, origem);

  // A ficha é cobrada DEPOIS da validação de formato: recusar um nome mal
  // digitado não pode gastar a cota de quem está tentando escolher um. Mas
  // ANTES da escrita, que é o que precisa ser limitado — inclusive a tentativa
  // de varrer nomes livres um por um.
  const ritmo = await consumirFicha(env, id, 'apelido', Math.floor(Date.now() / 1000));
  if (!ritmo.pode) return json({ erro: 'cedo_demais', esperar: ritmo.esperar }, 429, origem);

  try {
    await env.DB.prepare(`
      INSERT INTO apelidos (usuario, apelido, apelido_normal, criado_em)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(usuario) DO UPDATE SET
        apelido = excluded.apelido,
        apelido_normal = excluded.apelido_normal
    `).bind(id, apelido, normalizar(apelido), Math.floor(Date.now() / 1000)).run();
  } catch {
    // A única restrição que pode estourar aqui é a de `apelido_normal`.
    return json({ erro: 'apelido_em_uso' }, 409, origem);
  }

  return json({ ok: true, apelido }, 200, origem);
}

/**
 * Recebe as marcas do jogador, uma por placar.
 *
 * Cada marca é conferida SOZINHA: uma recusada não derruba as outras. O
 * jogador que subiu de nível legitimamente e tem um andar de Provação
 * implausível deve ter o nível registrado — e a resposta diz o que foi recusado.
 */
async function enviarMarcas(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { marcas?: MarcaRecebida[] };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!Array.isArray(corpo.marcas)) return json({ erro: 'corpo_incompleto' }, 400, origem);
  // Teto de itens: o placar de naves tem uma marca por casco, e são ~50.
  if (corpo.marcas.length > 80) return json({ erro: 'marcas_demais' }, 413, origem);

  const temApelido = await env.DB.prepare('SELECT 1 FROM apelidos WHERE usuario = ?').bind(id).first();
  if (!temApelido) return json({ erro: 'sem_apelido' }, 409, origem);

  const agora = Math.floor(Date.now() / 1000);
  const desde = await contaDesde(env, id, agora);

  // Esta é a rota mais cara do servidor: uma chamada podia virar oitenta
  // leituras e oitenta escritas. Sem limite, um cliente em laço queimava a cota
  // diária de escrita do D1 — que é COMPARTILHADA por todos os jogadores.
  const ritmo = await consumirFicha(env, id, 'marcas', agora);
  if (!ritmo.pode) return json({ erro: 'cedo_demais', esperar: ritmo.esperar }, 429, origem);

  /**
   * As marcas atuais do jogador, numa consulta só.
   *
   * Eram oitenta `SELECT`, um por marca, dentro do laço. O jogador tem no
   * máximo algumas dezenas de linhas no total — trazer todas de uma vez custa
   * uma consulta e evita as outras setenta e nove.
   */
  const atuais = new Map<string, { valor: number; desempate: number; atualizado_em: number }>();
  const linhas = await env.DB
    .prepare('SELECT placar, casco, valor, desempate, atualizado_em FROM marcas WHERE usuario = ?')
    .bind(id)
    .all<{ placar: string; casco: string; valor: number; desempate: number; atualizado_em: number }>();
  for (const l of linhas.results ?? []) atuais.set(`${l.placar}:${l.casco}`, l);

  const aceitas: string[] = [];
  const recusadas: { placar: string; casco: string; motivo: string }[] = [];

  for (const m of corpo.marcas) {
    const casco = typeof m.casco === 'string' ? m.casco.slice(0, 40) : '';
    const anterior = atuais.get(`${m.placar}:${casco}`) ?? null;

    const v = conferir(m, anterior, agora, desde);
    if (!v.ok) {
      recusadas.push({ placar: String(m.placar), casco, motivo: v.motivo });
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO marcas (usuario, placar, casco, valor, desempate, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario, placar, casco) DO UPDATE SET
        valor = excluded.valor,
        desempate = excluded.desempate,
        atualizado_em = excluded.atualizado_em
    `).bind(id, m.placar, casco, v.valor, v.desempate, agora).run();
    aceitas.push(`${m.placar}${casco ? ':' + casco : ''}`);
  }

  return json({ ok: true, aceitas, recusadas }, 200, origem);
}

// ── lote de itens ───────────────────────────────────────────────────────────

/**
 * Entrega o lote de itens do setor em curso.
 *
 * ## O contrato
 *
 * Mesmo setor → MESMO lote, sempre. Setor diferente → lote novo, com semente e
 * sorte novas. É esse par que fecha o re-rolar: reiniciar, morrer ou recarregar
 * a aba devolve os mesmos itens, e conseguir outros exige jogar outro setor.
 *
 * ## Por que a sorte só é lida na PRIMEIRA chamada
 *
 * Porque sorte diferente muda o resultado da mesma semente. Se cada chamada
 * aceitasse um valor novo, bastaria pedir o lote com sorte 0.1, 0.2, 0.3… até
 * gostar do que veio — o re-rolar de volta, por outra porta.
 *
 * ## Por que o balde da carteira, e não um próprio
 *
 * O lote é pedido no MESMO evento que move dinheiro: o setor caiu. Dois baldes
 * independentes dobrariam o teto sem dobrar a atividade legítima.
 */
async function entregarLote(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { setor?: unknown; sorte?: unknown; universo?: unknown; pagina?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const setor = setorValido(corpo.setor);
  if (setor === null) return json({ erro: 'setor_invalido' }, 400, origem);

  // O último lançamento é a EVIDÊNCIA de progresso que destrava um lote novo.
  // Sem ela, alternar entre dois setores re-rolava de graça — ver o comentário
  // de `precisaDeLoteNovo`.
  const [guardado, ultimo] = await Promise.all([
    env.DB
      .prepare('SELECT setor, semente, sorte, criado_em FROM lotes WHERE usuario = ?')
      .bind(id)
      .first<{ setor: number; semente: number; sorte: number; criado_em: number }>(),
    env.DB
      .prepare('SELECT MAX(em) AS em FROM transacoes WHERE usuario = ?')
      .bind(id)
      .first<{ em: number | null }>(),
  ]);

  let semente: number;
  let sorte: number;
  if (precisaDeLoteNovo(guardado, setor, ultimo?.em ?? 0)) {
    semente = novaSemente();
    sorte = sorteValida(corpo.sorte);
    await env.DB.prepare(`
      INSERT INTO lotes (usuario, setor, semente, sorte, criado_em) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(usuario) DO UPDATE SET
        setor = excluded.setor, semente = excluded.semente,
        sorte = excluded.sorte, criado_em = excluded.criado_em
    `).bind(id, setor, semente, sorte, agora).run();
  } else {
    semente = guardado!.semente;
    sorte = guardado!.sorte;
  }

  /**
   * O CURSOR decide o que entregar, não a página que o cliente pede.
   *
   * Enquanto o cliente escolhia a página e a coleta derivava outra do cursor,
   * os dois lados olhavam para itens diferentes: o jogador via na mochila uma
   * peça que o servidor nunca criou, e ela sumia na sincronização seguinte. Era
   * o `faltaram_*` do livro das recusas.
   *
   * Derivando dos dois lados do mesmo cursor, discordar deixa de ser possível
   * — e o cliente perde uma alavanca de escolha que nunca deveria ter tido.
   * `corpo.pagina` continua sendo aceito e ignorado, para um cliente antigo não
   * quebrar no meio de uma sessão.
   */
  const cursor = await cursorDoLote(env, id);
  const lote = rolarDoCursor(semente, setor, sorte, Number(corpo.universo), cursor);

  return json({ setor, cursor, lote, porPool: ITENS_POR_POOL }, 200, origem);
}

/**
 * Até onde cada pote já foi consumido. Zero quando não há lote guardado.
 *
 * Um por TIPO, e é essa independência que a rota antiga não respeitava: ela
 * escolhia uma página só, pelo cursor mais adiantado, e aplicava aos três.
 */
async function cursorDoLote(env: Env, id: string): Promise<Record<TipoDeDrop, number>> {
  const l = await env.DB
    .prepare('SELECT usados_onda, usados_elite, usados_chefe FROM lotes WHERE usuario = ?')
    .bind(id)
    .first<{ usados_onda: number; usados_elite: number; usados_chefe: number }>();

  return {
    onda: Math.max(0, l?.usados_onda ?? 0),
    elite: Math.max(0, l?.usados_elite ?? 0),
    chefe: Math.max(0, l?.usados_chefe ?? 0),
  } as Record<TipoDeDrop, number>;
}

// ── compra de cristais ──────────────────────────────────────────────────────

/**
 * Abre uma cobrança Pix. NÃO credita nada.
 *
 * ## O que o cliente escolhe, e o que ele não escolhe
 *
 * Ele escolhe o PACOTE, pelo id. O preço e a quantidade de cristais saem de
 * `CRYSTAL_PACKAGES`, que é tabela do jogo e o Worker importa — a mesma que a
 * tela desenha, sem cópia. Aceitar `centavos` do corpo seria deixar o jogador
 * dizer quanto vai pagar por 2.400 cristais.
 *
 * ## Por que o balde é o da AÇÃO
 *
 * Abrir cobrança é clique deliberado, com o jogador olhando — recusada, é um
 * botão que não funciona. Mesma natureza de fundir e comprar casco.
 */
async function abrirCobranca(
  req: Request, env: Env, id: string, origem: string,
): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'acao', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > 2048) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { pacote?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const pacote = pacotePorId(corpo.pacote);
  if (!pacote) return json({ erro: 'pacote_desconhecido' }, 400, origem);

  if (!env.MP_ACCESS_TOKEN) return json({ erro: 'pagamento_indisponivel' }, 503, origem);

  const compra = novaCompra(crypto.randomUUID(), id, pacote, agora);

  // A linha nasce ANTES de falar com o provedor. Se a cobrança for criada lá e
  // a resposta se perder no caminho, o webhook ainda encontra a compra por
  // `external_reference` — o contrário deixaria dinheiro pago sem dono.
  await env.DB.prepare(`
    INSERT INTO compras (id, usuario, pacote, cristais, centavos, estado, criada_em)
    VALUES (?, ?, ?, ?, ?, 'pendente', ?)
  `).bind(compra.id, id, compra.pacote, compra.cristais, compra.centavos, agora).run();

  const cobranca = await criarPixNoMP(env, compra);
  if (!cobranca) {
    await env.DB.prepare("UPDATE compras SET estado = 'cancelada' WHERE id = ?")
      .bind(compra.id).run();
    return json({ erro: 'provedor_indisponivel' }, 502, origem);
  }

  /**
   * O id do pagamento é guardado AGORA, e não quando o webhook chegar.
   *
   * Ele é a única forma de perguntar ao provedor "esta cobrança foi paga?".
   * Guardá-lo só na chegada do webhook faz a resposta depender da pergunta:
   * se o webhook nunca chegar — URL mal configurada, nosso Worker fora do ar
   * nos segundos errados —, não haveria por onde consultar, e o jogador teria
   * pago sem caminho automático de conserto.
   *
   * Com ele aqui, `estadoDaCompra` fecha a compra sozinha na próxima vez que a
   * tela perguntar.
   */
  await env.DB.prepare('UPDATE compras SET provedor_id = ? WHERE id = ?')
    .bind(cobranca.provedorId, compra.id).run();

  return json({
    compra: compra.id,
    cristais: compra.cristais,
    centavos: compra.centavos,
    ...cobranca,
  }, 200, origem);
}

/**
 * Cria o Pix no Mercado Pago e devolve o que a tela precisa mostrar.
 *
 * `X-Idempotency-Key` é o nosso id da compra: uma retentativa de rede não pode
 * virar duas cobranças para o mesmo jogador.
 *
 * Devolve o QR e o copia-e-cola, que é como se paga um Pix — nada de redirecionar
 * o jogador para fora do jogo.
 */
async function criarPixNoMP(
  env: Env, compra: { id: string; centavos: number; cristais: number },
): Promise<{ qr: string; copiaECola: string; provedorId: string } | null> {
  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MP_ACCESS_TOKEN ?? ''}`,
        'content-type': 'application/json',
        'X-Idempotency-Key': compra.id,
      },
      body: JSON.stringify({
        transaction_amount: compra.centavos / 100,
        description: `Órbita Zero — ${compra.cristais} cristais`,
        payment_method_id: 'pix',
        external_reference: compra.id,
        payer: { email: 'comprador@orbitazero.dev' },
      }),
    });
    if (!r.ok) {
      // Token vencido, conta suspensa, valor recusado: o jogador vê um botão
      // que não funciona, e do lado de cá isto precisa ter nome.
      await anotarMotivo(env, '/mp/criar', `http_${r.status}`, 502).catch(() => {});
      return null;
    }

    const d = await r.json() as {
      id?: number | string;
      point_of_interaction?: { transaction_data?: { qr_code_base64?: string; qr_code?: string } };
    };
    const t = d.point_of_interaction?.transaction_data;
    if (!d.id || !t?.qr_code) return null;

    return { qr: t.qr_code_base64 ?? '', copiaECola: t.qr_code, provedorId: String(d.id) };
  } catch { // contado como `sem_resposta`: provedor fora do ar é fato operacional
    await anotarMotivo(env, '/mp/criar', 'sem_resposta', 502).catch(() => {});
    return null;
  }
}

/**
 * O estado de uma cobrança, para a tela que espera o Pix cair.
 *
 * ## Por que uma leitura ESCREVE
 *
 * Porque ela não é só leitura: quando a compra ainda está pendente, esta rota
 * pergunta ao provedor e credita — exatamente o que o webhook faria.
 *
 * O webhook é o caminho rápido e não é garantia de nada. Ele depende de uma
 * URL configurada certo no painel de outra empresa, de o nosso Worker estar de
 * pé no segundo em que ele sai, e de a assinatura conferir. Qualquer um dos
 * três falha calado — e o sintoma é a pior frase que este jogo pode receber:
 * *paguei e não recebi*.
 *
 * Enquanto o jogador olha a tela do Pix, ele mesmo é o gatilho do conserto.
 *
 * ## Os dois ritmos
 *
 * A tela pergunta a cada cinco segundos (balde `cobranca`) e é respondida do
 * nosso banco. Sair para a API do Mercado Pago é bem mais raro (balde
 * `provedor`, ~3/min): a consulta cara é a exceção, a barata é a regra.
 *
 * ## Por que POST numa pergunta
 *
 * Porque o id da cobrança não tem por que aparecer em URL, histórico ou log de
 * proxy — e porque a rota muda estado. As duas coisas apontam para o mesmo verbo.
 */
async function estadoDaCompra(
  req: Request, env: Env, usuario: string, origem: string,
): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, usuario, 'cobranca', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > 2048) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { compra?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const id = typeof corpo.compra === 'string' ? corpo.compra : '';
  if (!id || id.length > 64) return json({ erro: 'compra_desconhecida' }, 404, origem);

  // `AND usuario = ?` é a autorização inteira: sem isso, um id vazado deixaria
  // qualquer conta ler a compra de outra pessoa.
  const linha = await lerCompra(env, id, usuario);
  if (!linha) return json({ erro: 'compra_desconhecida' }, 404, origem);

  if (linha.estado === 'pendente' && linha.provedor_id) {
    const podeConsultar = await consumirFicha(env, usuario, 'provedor', agora);
    if (podeConsultar.pode) await creditarPagamento(env, linha.provedor_id);
  }

  // Relê SEMPRE: `creditarPagamento` pode ter acabado de marcar a compra como
  // paga, e responder com a linha de antes mandaria a tela continuar esperando
  // um dinheiro que já entrou.
  const atual = await lerCompra(env, id, usuario) ?? linha;

  return json({
    compra: atual.id,
    estado: atual.estado,
    cristais: atual.cristais,
    centavos: atual.centavos,
    // Vencida não é recusada: ver `podePagar`. Este campo só diz à tela que
    // parar de esperar — um Pix pago depois disso continua sendo creditado.
    expirada: expirou(paraCompra(atual), agora),
    // A carteira vem junto para a tela não precisar de uma segunda requisição
    // no exato instante em que o jogador quer ver o saldo novo.
    carteira: await carteiraDe(env, usuario),
  }, 200, origem);
}

interface LinhaDeCompra {
  id: string; usuario: string; pacote: string; cristais: number; centavos: number;
  estado: string; provedor_id: string | null; criada_em: number; paga_em: number | null;
}

/** A linha da compra. Com `usuario`, é também a autorização. */
async function lerCompra(
  env: Env, id: string, usuario?: string,
): Promise<LinhaDeCompra | null> {
  const q = usuario
    ? env.DB.prepare('SELECT * FROM compras WHERE id = ? AND usuario = ?').bind(id, usuario)
    : env.DB.prepare('SELECT * FROM compras WHERE id = ?').bind(id);
  return (await q.first<LinhaDeCompra>()) ?? null;
}

/** Da linha do banco para o tipo puro de `compras.ts`. */
const paraCompra = (l: LinhaDeCompra): Compra => ({
  id: l.id,
  usuario: l.usuario,
  pacote: l.pacote,
  cristais: l.cristais,
  centavos: l.centavos,
  estado: l.estado as Compra['estado'],
  provedorId: l.provedor_id,
  criadaEm: l.criada_em,
  pagaEm: l.paga_em,
});

/**
 * O provedor avisa que um pagamento mudou de estado.
 *
 * ## A ordem aqui é a segurança inteira
 *
 * 1. **Assinatura** — é a única prova de que quem chama é o provedor.
 * 2. **Busca o pagamento NA API DELES** — o corpo do webhook diz só o id. Quem
 *    responde "foi pago, e de quanto" é a consulta autenticada, não o corpo que
 *    chegou pela rede.
 * 3. **Confere o valor** contra o que foi cobrado. Pix aceita valor diferente
 *    do combinado em várias configurações; sem isto, pagar um centavo pelo
 *    pacote de R$ 99,90 creditaria 2.400 cristais.
 * 4. **Credita** com `motivo: 'compra'` e `origem` = o id do pagamento. O
 *    índice único do livro recusa o segundo — e o provedor REENVIA por desenho.
 *
 * Responde 200 mesmo quando ignora: um 4xx faz o Mercado Pago reenviar por
 * horas. O que interessa registrar fica no livro das recusas.
 */
async function receberPagamento(req: Request, env: Env): Promise<Response> {
  const ok = json({ ok: true }, 200, '');

  const partes = partesDaAssinatura(req.headers.get('x-signature'));
  const requestId = req.headers.get('x-request-id') ?? '';
  const bruto = await req.text();
  if (bruto.length > 8192) return ok;

  let corpo: { data?: { id?: unknown } };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return ok;
  }

  const dataId = String(corpo.data?.id ?? '');
  if (!partes || !dataId || !env.MP_WEBHOOK_SECRET) {
    await anotarMotivo(env, '/webhook/pagamento', 'assinatura_ausente', 400).catch(() => {});
    return ok;
  }

  const confere = await assinaturaConfere(
    env.MP_WEBHOOK_SECRET, manifestoDoMP(dataId, requestId, partes.ts), partes.v1,
  );
  if (!confere) {
    // Alguém tentando creditar de graça, ou o segredo configurado errado. As
    // duas coisas precisam aparecer no aviso de cinco minutos.
    await anotarMotivo(env, '/webhook/pagamento', 'assinatura_invalida', 401).catch(() => {});
    return ok;
  }

  await creditarPagamento(env, dataId);
  return ok;
}

/** Consulta o pagamento no provedor e credita, se for o caso. */
async function creditarPagamento(env: Env, pagamentoId: string): Promise<void> {
  const pago = await lerPagamentoNoMP(env, pagamentoId);
  // Ainda não aprovado é o caminho normal: o MP avisa a cada mudança de estado.
  if (!pago || pago.estado !== 'approved') return;

  const linha = await lerCompra(env, pago.referencia);
  if (!linha) {
    await anotarMotivo(env, '/webhook/pagamento', 'compra_desconhecida', 404).catch(() => {});
    return;
  }

  const compra = paraCompra(linha);

  const recusa = podePagar(compra);
  if (recusa) return; // já encerrada: o reenvio do webhook é o caminho normal

  if (!valorConfere(compra, pago.centavos)) {
    await anotarMotivo(env, '/webhook/pagamento', 'valor_divergente', 409).catch(() => {});
    return;
  }

  const agora = Math.floor(Date.now() / 1000);

  /**
   * O crédito vem ANTES de marcar a compra como paga.
   *
   * Se a ordem fosse a inversa e a escrita do livro falhasse, a compra ficaria
   * marcada como paga sem os cristais terem entrado — e um reenvio do webhook
   * seria recusado por `compra_ja_encerrada`. O jogador pagaria e não receberia,
   * sem caminho de conserto automático.
   *
   * Nesta ordem, uma falha entre as duas deixa o crédito feito e a compra ainda
   * pendente: o reenvio tenta de novo, o livro recusa por `repetido` — é o
   * índice único fazendo o trabalho dele — e a marcação se completa.
   */
  const r = await lancar(env, {
    usuario: compra.usuario,
    moeda: 'cristal',
    quantia: compra.cristais,
    motivo: 'compra',
    origem: pagamentoId,
    em: agora,
  });

  if (!r.ok && r.erro !== 'repetido') {
    await anotarMotivo(env, '/webhook/pagamento', `credito_${r.erro}`, 500).catch(() => {});
    return;
  }

  await env.DB.prepare(
    "UPDATE compras SET estado = 'paga', provedor_id = ?, paga_em = ? WHERE id = ?",
  ).bind(pagamentoId, agora, compra.id).run();
}

/** O estado e o valor de um pagamento, direto da API do provedor. */
async function lerPagamentoNoMP(
  env: Env, id: string,
): Promise<{ estado: string; centavos: number; referencia: string } | null> {
  if (!env.MP_ACCESS_TOKEN) return null;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    });
    if (!r.ok) {
      /**
       * Aqui é pior que no criar: alguém PAGOU e nós não conseguimos confirmar.
       * O provedor reenvia o webhook por horas, então o crédito ainda sai — mas
       * se não sair, esta linha é a única pista de que houve dinheiro parado.
       */
      await anotarMotivo(env, '/mp/consultar', `http_${r.status}`, 502).catch(() => {});
      return null;
    }

    const d = await r.json() as {
      status?: string; transaction_amount?: number; external_reference?: string;
    };
    return {
      estado: String(d.status ?? ''),
      // Reais viram centavos INTEIROS aqui, no ponto de entrada. Deixar o
      // decimal circular pelo resto do código é como um centavo se perde.
      centavos: Math.round((Number(d.transaction_amount) || 0) * 100),
      referencia: String(d.external_reference ?? ''),
    };
  } catch { // contado como `sem_resposta`: ver o `if (!r.ok)` acima
    await anotarMotivo(env, '/mp/consultar', 'sem_resposta', 502).catch(() => {});
    return null;
  }
}

// ── inventário ──────────────────────────────────────────────────────────────

interface LinhaDeItem { uid: string; dados: string; nave: string | null; slot: string | null }

/** A mochila e o equipado, do jeito que o cliente desenha. */
async function inventarioDe(env: Env, usuario: string) {
  const { results } = await env.DB
    .prepare('SELECT uid, dados, nave, slot FROM itens WHERE usuario = ?')
    .bind(usuario)
    .all<LinhaDeItem>();

  return results.map((l) => ({
    item: JSON.parse(l.dados) as Item,
    nave: l.nave,
    slot: l.slot,
  }));
}

/**
 * Aplica coletar, descartar e equipar num lote só.
 *
 * ## O item nunca sobe
 *
 * `coletar` diz QUANTOS de cada tipo, nunca QUAIS. O servidor tem a semente, a
 * página e o cursor, então deriva os itens sozinho. Nenhum byte de item viaja
 * do cliente para cá — e o que não trafega não pode ser forjado.
 *
 * ## Por que tudo numa transação
 *
 * Coletar avança o cursor. Se o avanço gravasse e a inserção dos itens não,
 * o jogador perderia o lote inteiro daquele setor sem nada explicando. O
 * `batch` do D1 é transação: ou tudo entra, ou nada.
 */
async function aplicarComandos(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let comandos: Comandos;
  try {
    comandos = JSON.parse(bruto) as Comandos;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const recusa = conferirComandos(comandos);
  if (recusa) return json({ erro: recusa }, 400, origem);

  const escritas: D1PreparedStatement[] = [];

  /**
   * COLETA LÍQUIDA: o que cai e é descartado no mesmo lote nunca é gravado.
   *
   * ## O desperdício
   *
   * Medido no jogo: caem ~186 itens por hora, cerca de 8 por ciclo de 150 s, e
   * o inventário NÃO cresce — o descarte automático some com quase todos. O
   * servidor então inseria 8 linhas e apagava 8 linhas por ciclo para o
   * inventário terminar igual ao que começou.
   *
   * Eram ~16 das ~33 linhas escritas por ciclo: metade do custo de D1 do jogo
   * inteiro, gasta para não guardar nada.
   *
   * ## Por que o servidor resolve isto sozinho
   *
   * Ele DERIVA quais itens a coleta produziu (é a semente mais o cursor) e
   * recebe a lista de descarte. A interseção dos dois é exatamente o que
   * nasceu e morreu no mesmo lote. Não é preciso mudar o protocolo nem o
   * cliente — a informação já está toda aqui.
   *
   * O cursor avança do mesmo jeito: o item FOI consumido do lote, e ele não
   * pode voltar a ser oferecido. O que muda é só não gravar uma linha que
   * seria apagada três instruções depois.
   */
  const descartados = new Set(comandos.descartar ?? []);
  const nascidosEMortos = new Set<string>();
  /** O que nasceu NESTE lote e ainda não está no banco. */
  const nascidos = new Map<string, Item>();
  /**
   * Quanto o cliente pediu além do que o pote tinha.
   *
   * Sobe na resposta em vez de virar 409. Ver `derivarColeta`: o 409 derrubava
   * o lote inteiro e o cliente reenviava o mesmo lote envenenado para sempre,
   * o que deixava o inventário dele permanentemente à frente do servidor.
   */
  let faltaram: Partial<Record<TipoDeDrop, number>> = {};

  // ── coletar ───────────────────────────────────────────────────────────────
  const pedido = comandos.coletar ?? {};
  const querColetar = TIPOS.some((t) => (pedido[t] ?? 0) > 0);
  if (querColetar) {
    const lote = await env.DB
      .prepare('SELECT setor, semente, sorte, usados_onda, usados_elite, usados_chefe FROM lotes WHERE usuario = ?')
      .bind(id)
      .first<{
        setor: number; semente: number; sorte: number;
        usados_onda: number; usados_elite: number; usados_chefe: number;
      }>();
    if (!lote) return json({ erro: 'lote_esgotado' }, 409, origem);

    /**
     * Cada tipo é rolado a partir do PRÓPRIO cursor.
     *
     * A versão anterior escolhia UMA página, pelo cursor mais adiantado, e
     * aplicava aos três. Como os potes andam em ritmos muito diferentes — uma
     * elite a cada cinco ondas, um chefe a cada dez setores —, os atrasados
     * eram arrastados para a página do líder. Medido em 09/09: o cursor da
     * elite pulava de 6 para 27 num envio, queimando o pote quatro vezes mais
     * rápido, e perto da virada de página a coleta era aparada — o `faltaram_*`
     * do livro, e o item que o jogador via aparecer e sumir.
     *
     * `rolarDoCursor` devolve, por tipo, os próximos itens a partir de onde
     * aquele tipo parou. Com isso o deslocamento vira zero e o cursor novo é o
     * antigo mais o que saiu — sem base, sem página, sem o que divergir.
     */
    const cursor = {
      onda: lote.usados_onda, elite: lote.usados_elite, chefe: lote.usados_chefe,
    } as Record<TipoDeDrop, number>;
    const rolado = rolarDoCursor(lote.semente, lote.setor, lote.sorte, 0, cursor);

    const zerado = { onda: 0, elite: 0, chefe: 0 } as Record<TipoDeDrop, number>;
    const coleta = derivarColeta(rolado, zerado, pedido);
    faltaram = coleta.faltaram;

    for (const item of coleta.itens) {
      // Caiu e já foi descartado neste mesmo lote: não grava.
      if (descartados.has(item.uid)) { nascidosEMortos.add(item.uid); continue; }
      // O `equipar` deste mesmo lote precisa ENXERGAR o que acabou de cair. As
      // escritas só rodam no fim, então um `SELECT` não encontraria a peça — e
      // era isso que derrubava o lote inteiro. Ver `planejarEquipar`.
      nascidos.set(item.uid, item);
      escritas.push(env.DB
        .prepare('INSERT OR IGNORE INTO itens (uid, usuario, dados, nave, slot, em) VALUES (?, ?, ?, NULL, NULL, ?)')
        .bind(item.uid, id, JSON.stringify(item), agora));
    }
    // O cursor novo é o antigo MAIS o que saiu de cada tipo. Antes havia uma
    // `base` comum aqui, e era ela que fazia o cursor da elite pular.
    escritas.push(env.DB
      .prepare('UPDATE lotes SET usados_onda = ?, usados_elite = ?, usados_chefe = ? WHERE usuario = ?')
      .bind(
        cursor.onda + coleta.cursor.onda,
        cursor.elite + coleta.cursor.elite,
        cursor.chefe + coleta.cursor.chefe,
        id,
      ));
  }

  // ── descartar ─────────────────────────────────────────────────────────────
  for (const uid of comandos.descartar ?? []) {
    // Nunca foi gravado: não há o que apagar. É a outra metade da economia —
    // sem esta linha, o DELETE inútil continuaria custando uma escrita.
    if (nascidosEMortos.has(uid)) continue;
    // `usuario` no WHERE não é zelo: sem ele, um uid alheio apagaria o item de
    // outra pessoa. O crédito em sucata NÃO acontece aqui — ele já sobe pela
    // fila da carteira, e creditar nos dois lugares pagaria em dobro.
    escritas.push(env.DB.prepare('DELETE FROM itens WHERE uid = ? AND usuario = ?').bind(uid, id));
  }

  // ── equipar ───────────────────────────────────────────────────────────────
  //
  // A peça vem de `nascidos` (caiu neste lote) ou do banco. Buscar só o que
  // ainda não se conhece mantém o número de consultas igual ao de antes.
  const conhecidas = new Map<string, Item>(nascidos);
  for (const e of comandos.equipar ?? []) {
    if (conhecidas.has(e.uid)) continue;
    const linha = await env.DB
      .prepare('SELECT dados FROM itens WHERE uid = ? AND usuario = ?')
      .bind(e.uid, id)
      .first<{ dados: string }>();
    if (linha) conhecidas.set(e.uid, JSON.parse(linha.dados) as Item);
  }

  const plano = planejarEquipar(
    comandos.equipar ?? [],
    (uid) => conhecidas.get(uid) ?? null,
    (nave) => HULL_BY_ID.get(nave)?.element ?? null,
  );

  for (const uid of plano.desequipar) {
    escritas.push(env.DB
      .prepare('UPDATE itens SET nave = NULL, slot = NULL WHERE uid = ? AND usuario = ?')
      .bind(uid, id));
  }
  for (const t of plano.aplicar) {
    // Desequipa o que estiver no slot antes de ocupar: o índice único recusaria
    // a segunda peça, e o jogador veria "falhou" onde o jogo sempre trocou.
    escritas.push(env.DB
      .prepare('UPDATE itens SET nave = NULL, slot = NULL WHERE usuario = ? AND nave = ? AND slot = ?')
      .bind(id, t.nave, t.slot));
    escritas.push(env.DB
      .prepare('UPDATE itens SET nave = ?, slot = ? WHERE uid = ? AND usuario = ?')
      .bind(t.nave, t.slot, t.uid, id));
  }

  if (escritas.length) await env.DB.batch(escritas);
  // Os recusados vão na resposta em vez de derrubarem o lote. O cliente adota a
  // lista que volta, então uma peça recusada simplesmente aparece desequipada —
  // que é a verdade.
  return json({
    itens: await inventarioDe(env, id), recusados: plano.recusados, faltaram,
  }, 200, origem);
}
// ── síntese e frota ─────────────────────────────────────────────────────────

/**
 * Funde itens. Era a última porta por onde um item nascia fora do servidor.
 *
 * A 3a fechou o drop e a 3b fechou o inventário, mas a fusão continuava
 * rodando no cliente com `rollItem` local — bastava fundir lixo até o resultado
 * agradar, e o item saía legítimo pelos olhos de todo o resto do sistema.
 *
 * ## Não há re-rolagem mesmo com semente nova a cada chamada
 *
 * A fusão CONSOME as peças. Repetir não encontra mais os `uid`s, então não
 * existe segunda tentativa para comparar com a primeira.
 *
 * ## O que continua no cliente
 *
 * O custo em MATERIAIS (`armazem`). Materiais ainda moram no save, e cobrá-los
 * aqui exigiria movê-los junto — trabalho da Fase 4. O núcleo, que é moeda, é
 * debitado pela fila da carteira como qualquer outro gasto.
 */
async function sintetizar(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'acao', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { uids?: unknown; sorte?: unknown; universo?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const uids = Array.isArray(corpo.uids) ? corpo.uids.filter((u): u is string => typeof u === 'string') : [];
  if (!uids.length || uids.length > 40) return json({ erro: 'uids_invalidos' }, 400, origem);

  // Carrega do BANCO, nunca do corpo: o item que entra na conta é o que o
  // servidor tem, não o que o cliente diz ter.
  const marcas = uids.map(() => '?').join(',');
  const { results } = await env.DB
    .prepare(`SELECT uid, dados FROM itens WHERE usuario = ? AND uid IN (${marcas})`)
    .bind(id, ...uids)
    .all<{ uid: string; dados: string }>();

  const itens = results.map((l) => JSON.parse(l.dados) as Item);
  const conferido = conferirFusao(itens, uids);
  if ('erro' in conferido) return json({ erro: conferido.erro }, 409, origem);

  const saida = fundir(itens, conferido.receita, Number(corpo.sorte), Number(corpo.universo));

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM itens WHERE usuario = ? AND uid IN (${marcas})`).bind(id, ...uids),
    env.DB
      .prepare('INSERT OR IGNORE INTO itens (uid, usuario, dados, nave, slot, em) VALUES (?, ?, ?, NULL, NULL, ?)')
      .bind(saida.uid, id, JSON.stringify(saida), agora),
  ]);

  return json({ item: saida, receita: conferido.receita.id, itens: await inventarioDe(env, id) }, 200, origem);
}

/** Os cascos que são desta pessoa. */
async function frotaDe(env: Env, usuario: string): Promise<string[]> {
  const { results } = await env.DB
    .prepare('SELECT casco FROM frota WHERE usuario = ?')
    .bind(usuario)
    .all<{ casco: string }>();
  return results.map((l) => l.casco);
}

/**
 * Adiciona um casco à frota: comprado, ou o inicial do piloto escolhido.
 *
 * Casco é PODER — cada um tem atributos-base próprios, e os melhores custam
 * cristal. Escrever um id em `state.fleet` entregava de graça o que a loja
 * cobra, e era o que sobrava depois de a 3b fechar o item.
 */
async function adquirirCasco(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'acao', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { casco?: unknown; piloto?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const frota = await frotaDe(env, id);

  // O casco do piloto entra SEM custo e só uma vez: é a escolha da primeira
  // tela, não uma compra. `INSERT OR IGNORE` faz a segunda chamada não
  // conceder nada, então repetir o pedido não rende um casco extra.
  if (typeof corpo.piloto === 'string') {
    const casco = cascoDoPiloto(corpo.piloto);
    if (!casco) return json({ erro: 'casco_desconhecido' }, 400, origem);
    // Só concede se a frota está VAZIA. Depois disso, escolher piloto de novo
    // seria um casco grátis por chamada.
    if (frota.length) return json({ erro: 'casco_ja_e_seu' }, 409, origem);
    await env.DB
      .prepare("INSERT OR IGNORE INTO frota (usuario, casco, origem, em) VALUES (?, ?, 'piloto', ?)")
      .bind(id, casco, agora).run();
    return json({ frota: await frotaDe(env, id) }, 200, origem);
  }

  if (typeof corpo.casco !== 'string') return json({ erro: 'casco_desconhecido' }, 400, origem);
  const conferido = conferirCompraDeCasco(corpo.casco, frota.includes(corpo.casco));
  if ('erro' in conferido) return json({ erro: conferido.erro }, 409, origem);

  // O preço sai do livro-caixa, que é real. Se o saldo não cobrir, nada muda.
  const pago = await lancar(env, {
    usuario: id, moeda: 'cristal', quantia: -conferido.custo, motivo: 'loja', em: agora,
  });
  if (!pago.ok && conferido.custo > 0) return json({ erro: pago.erro }, 409, origem);

  await env.DB
    .prepare("INSERT OR IGNORE INTO frota (usuario, casco, origem, em) VALUES (?, ?, 'compra', ?)")
    .bind(id, corpo.casco, agora).run();

  return json({ frota: await frotaDe(env, id) }, 200, origem);
}
// ── missões ─────────────────────────────────────────────────────────────────

/**
 * As missões do jogador, mais a confiança DERIVADA delas.
 *
 * A confiança não tem coluna: somar `confiancaDaMissao` sobre o que foi
 * entregue devolve o mesmo número que o cliente mantinha. Guardá-la seria a
 * mesma informação duas vezes — o argumento que `progresso.ts` já usa para o
 * nível não ter coluna.
 */
async function missoesDe(env: Env, usuario: string) {
  const { results } = await env.DB
    .prepare('SELECT missao, passos, iniciada, entregue_em FROM missoes WHERE usuario = ?')
    .bind(usuario)
    .all<{ missao: string; passos: string; iniciada: number; entregue_em: number | null }>();

  const missoes: Record<string, LinhaDeMissao> = {};
  const entregues: string[] = [];
  /**
   * Linhas cujo `passos` não abriu — e por que isso não podia ser silencioso.
   *
   * O `catch` cai para `[]`, que é o certo: uma linha corrompida não pode
   * derrubar as missões inteiras do jogador. Mas cair para `[]` **apaga o
   * progresso daquela missão**, e sem contar ninguém saberia — nem o jogador,
   * que veria a barra voltar a zero, nem quem conserta.
   *
   * Achado pela varredura de `tests/o-erro-escondido-no-sucesso.test.ts`, que
   * cobra que todo `catch` do servidor reporte, devolva erro, ou explique por
   * escrito por que não faz nem uma coisa nem outra.
   */
  let ilegiveis = 0;

  for (const l of results) {
    let passos: number[] = [];
    try {
      passos = JSON.parse(l.passos) as number[];
    } catch { // contado em `ilegiveis`, e vira `passos_ilegiveis` no livro
      passos = [];
      ilegiveis++;
    }
    missoes[l.missao] = {
      passos: Array.isArray(passos) ? passos : [],
      iniciada: l.iniciada === 1,
      entregueEm: l.entregue_em,
    };
    if (l.entregue_em !== null) entregues.push(l.missao);
  }

  if (ilegiveis) {
    await anotarMotivo(env, '/missoes', 'passos_ilegiveis', 500, ilegiveis)
      .catch(() => { /* o livro nunca derruba a leitura */ });
  }

  return { missoes, confianca: confiancaDerivada(entregues) };
}

/**
 * Recebe o que o cliente avançou e MESCLA — nunca sobrescreve.
 *
 * A mescla é monotônica (ver `missoes.ts`), então duas máquinas em paralelo
 * somam em vez de uma vencer. E é idempotente, que é o que torna a semeadura
 * dos saves atuais segura: mandar o mapa inteiro duas vezes dá o mesmo.
 *
 * A ENTREGA passa pela validação B: a missão existe, ainda não foi entregue, e
 * os passos alcançam o alvo do catálogo. Uma entrega recusada não derruba o
 * envio — o progresso que veio junto é legítimo, e derrubar o lote por causa
 * dela transformaria um erro num bloqueio permanente. É a lição de
 * `planejarEquipar`.
 */
async function gravarMissoes(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { missoes?: Record<string, unknown> };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const guardadas = (await missoesDe(env, id)).missoes;
  const escritas: D1PreparedStatement[] = [];
  const recusadas: { missao: string; motivo: string }[] = [];
  let n = 0;

  for (const [missaoId, bruta] of Object.entries(corpo.missoes ?? {})) {
    if (n >= MISSOES_MAX) break;
    if (missaoId.length > 64) continue;

    const recebida = linhaSa(bruta);
    if (!recebida) { recusadas.push({ missao: missaoId, motivo: 'linha_invalida' }); continue; }

    const guardada = guardadas[missaoId] ?? null;
    const junta = mesclarMissao(guardada, recebida);

    // A entrega só vale se passar na conferência. Recusada, o PROGRESSO dela
    // continua valendo — o jogador avançou de verdade, só não terminou.
    if (junta.entregueEm !== null && guardada?.entregueEm == null) {
      const mau = podeEntregar(missaoId, { ...junta, entregueEm: null });
      if (mau) {
        recusadas.push({ missao: missaoId, motivo: mau });
        junta.entregueEm = null;
      } else {
        junta.entregueEm = agora;
      }
    }

    escritas.push(env.DB.prepare(`
      INSERT INTO missoes (usuario, missao, passos, iniciada, entregue_em)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(usuario, missao) DO UPDATE SET
        passos = excluded.passos, iniciada = excluded.iniciada,
        entregue_em = COALESCE(missoes.entregue_em, excluded.entregue_em)
    `).bind(id, missaoId, JSON.stringify(junta.passos), junta.iniciada ? 1 : 0, junta.entregueEm));
    n++;
  }

  if (escritas.length) await env.DB.batch(escritas);
  return json({ ...(await missoesDe(env, id)), recusadas }, 200, origem);
}

// ── progressão ──────────────────────────────────────────────────────────────

/** XP, Matriz, setor alcançado, XP por nave e materiais. */
async function progressoDe(env: Env, usuario: string) {
  const [linha, naves, mats] = await Promise.all([
    env.DB
      .prepare('SELECT xp, melhor_setor, matriz, casco_em_campo, atualizado_em, semente FROM progresso WHERE usuario = ?')
      .bind(usuario)
      .first<{
        xp: number; melhor_setor: number; matriz: string;
        casco_em_campo: string; atualizado_em: number; semente: number;
      }>(),
    env.DB
      .prepare('SELECT casco, xp FROM naves_progresso WHERE usuario = ?')
      .bind(usuario).all<{ casco: string; xp: number }>(),
    env.DB
      .prepare('SELECT material, quantia FROM materiais WHERE usuario = ?')
      .bind(usuario).all<{ material: string; quantia: number }>(),
  ]);

  return {
    xp: linha?.xp ?? 0,
    melhorSetor: linha?.melhor_setor ?? 1,
    // O nível vem JUNTO, derivado aqui. O cliente não recalcula: se ele
    // derivasse por conta própria e a curva mudasse numa entrega, os dois
    // discordariam e o jogador veria um nível que o servidor não reconhece.
    nivel: nivelDoPiloto(linha?.xp ?? 0),
    /**
     * O casco EM CAMPO, que agora é do servidor.
     *
     * Vazio significa "nunca escolheu" — save de antes da coluna. Quem lê cai
     * na frota, como sempre caiu. Ver `migrations/0012-casco-em-campo.sql`.
     */
    cascoEmCampo: linha?.casco_em_campo ?? '',
    /** O carimbo do último envio, que dá a JANELA sobre a qual o ganho foi declarado. */
    atualizadoEm: linha?.atualizado_em ?? 0,
    /**
     * A semente do universo. Zero = ainda não sei.
     *
     * É ela que faz o servidor montar as MESMAS ondas do jogador. Sem ela, a
     * ausência era simulada num mundo diferente — outros inimigos, outra
     * densidade, outra contagem. Ver `migrations/0013-semente.sql`.
     */
    semente: linha?.semente ?? 0,
    matriz: JSON.parse(linha?.matriz ?? '[]') as string[],
    naves: Object.fromEntries(naves.results.map((n) => [n.casco, n.xp])),
    materiais: Object.fromEntries(mats.results.map((m) => [m.material, m.quantia])),
  };
}

/**
 * Aplica os ganhos de progressão e a alocação da Matriz.
 *
 * ## Deltas para o que ACUMULA, valor absoluto para o que é ESCOLHA
 *
 * XP e materiais chegam como delta: são somas, e mandar o total faria duas
 * abas abertas sobrescreverem uma à outra com o valor mais velho. A Matriz
 * chega inteira porque não é acúmulo — é uma escolha que se refaz por completo
 * a cada respec, e enviar "aloquei o nó X" exigiria que o servidor conhecesse a
 * ordem dos comandos para validar o orçamento no meio do caminho.
 *
 * ## A Matriz é validada contra o nível DERIVADO, e nessa ordem
 *
 * O XP entra primeiro, o nível sai da curva, e só então a alocação é conferida
 * contra os pontos desse nível. Conferir antes recusaria a alocação legítima de
 * quem acabou de subir de nível no mesmo envio.
 */
async function gravarProgresso(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: {
    xp?: unknown; setor?: unknown; matriz?: unknown;
    naves?: Record<string, unknown>; materiais?: Record<string, unknown>;
    casco?: unknown; semente?: unknown;
    encontros?: Record<string, unknown>;
  };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const atual = await progressoDe(env, id);
  const escritas: D1PreparedStatement[] = [];

  // ── XP do piloto ──────────────────────────────────────────────────────────
  let xp = atual.xp;
  if (corpo.xp !== undefined) {
    const d = conferirDelta(corpo.xp);
    if (typeof d !== 'number') return json({ erro: d }, 400, origem);
    xp = Math.max(0, atual.xp + d);
  }

  // ── setor alcançado ───────────────────────────────────────────────────────
  let setor = atual.melhorSetor;
  if (corpo.setor !== undefined) {
    const s = melhorSetor(atual.melhorSetor, corpo.setor);
    if (typeof s !== 'number') return json({ erro: s }, 400, origem);
    setor = s;
  }

  /**
   * ── casco EM CAMPO ────────────────────────────────────────────────────────
   *
   * Aceito só se for DA PESSOA. É a mesma conferência que `montarEstado` já
   * fazia com o casco que o cliente informava — a diferença é que agora o valor
   * FICA, em vez de valer para uma requisição só.
   *
   * Sem isto, "qual nave está em campo" vivia apenas no save, e o save que sobe
   * para a nuvem tem a frota arrancada. A regra "casco em campo tem de estar na
   * frota" então derrubava a escolha do jogador em toda recarga.
   *
   * Valor desconhecido não derruba o resto do envio: o progresso que veio junto
   * é legítimo, e recusar tudo por causa de um campo faria o jogador perder XP
   * por ter clicado numa nave.
   */
  /**
   * A semente é gravada UMA vez, e depois é imutável.
   *
   * Ela não decide poder — decide o LAYOUT do mundo. Mas o perfil que ela
   * sorteia muda `abatesDeReferencia` em 6× (medido em 09/09), então quem
   * pudesse re-sorteá-la ficaria repetindo até cair no perfil que paga mais.
   * O primeiro valor vence; os seguintes são ignorados em silêncio, porque
   * recusar o envio inteiro por causa dele faria o jogador perder progresso
   * legítimo por um campo que ele nem sabe que existe.
   */
  let semente = atual.semente;
  if (semente === 0 && typeof corpo.semente === 'number' && Number.isFinite(corpo.semente)) {
    semente = Math.max(0, Math.floor(corpo.semente)) >>> 0;
  }

  let cascoEmCampo = atual.cascoEmCampo;
  if (typeof corpo.casco === 'string' && corpo.casco.length <= 64) {
    const frota = await frotaDe(env, id);
    if (frota.includes(corpo.casco) && HULL_BY_ID.has(corpo.casco)) cascoEmCampo = corpo.casco;
  }

  // ── Matriz, contra o nível JÁ atualizado ──────────────────────────────────
  let matriz = atual.matriz;
  if (corpo.matriz !== undefined) {
    const lista = corpo.matriz as string[];
    const mau = conferirMatriz(lista, nivelDoPiloto(xp));
    if (mau) return json({ erro: mau }, 409, origem);
    matriz = lista;
  }

  /**
   * O teto por RÉPLICA mede o XP declarado. Ainda não recusa.
   *
   * Mesma disciplina de `teto.ts` e do `PLANO` (Fase 5, passo 4): medir antes
   * de impedir. A diferença é que agora há DOIS tetos registrando lado a lado —
   * o antigo, por fórmula, e este, que replica o jogo — e a decisão de ligar a
   * recusa vai sair de qual deles acerta em tráfego real.
   *
   * O setor usado é o MELHOR já alcançado, e não o atual: esta rota não recebe
   * o atual. Como um setor mais alto paga mais, o teto sai generoso — e um teto
   * generoso demais registra de menos, nunca recusa de mais. Errar para o lado
   * de deixar passar é o certo enquanto isto só mede.
   */
  /**
   * O servidor PRECIFICA o que o cliente declarou ter enfrentado.
   *
   * Ainda não é o pagamento: por enquanto ele compara com o XP declarado e
   * registra a diferença. É o último desconhecido antes de virar a chave — o
   * invariante já foi provado em teste, mas ali cliente e servidor partem do
   * MESMO estado. Em produção o servidor pode ter um item a menos (equipado e
   * ainda não sincronizado), e aí o multiplicador `xpGanho` difere.
   *
   * Uma divergência aqui é exatamente o XP que o jogador perderia se a chave
   * virasse hoje. Por isso ela é medida antes, e não depois.
   */
  /** Encontros declarados que nao correspondem a onda nenhuma daquele mundo. */
  let recusados = 0;

  if (corpo.encontros && typeof corpo.encontros === 'object') {
    try {
      const [frota, itens] = await Promise.all([frotaDe(env, id), inventarioDe(env, id)]);
      const estado = montarEstado(
        {
          saldos: { sucata: 0, nucleo: 0, cristal: 0 },
          xp: atual.xp, nivel: atual.nivel, matriz: atual.matriz,
          melhorSetor: atual.melhorSetor, materiais: atual.materiais,
          naves: atual.naves, frota, itens, cascoEmCampo, semente,
        },
        { hull: cascoEmCampo },
      );
      const preco = precificarEncontros(corpo.encontros, estado, atual.melhorSetor);
      /**
       * O encontro que NÃO cabe no mundo era calculado e jogado fora.
       *
       * `precificarEncontros` recusa em silêncio a chave que não corresponde a
       * nenhuma onda daquela semente — cliente adulterado, ou save de antes de
       * um rebalanceamento. O número existia e morria dentro da função: nem o
       * jogador via, nem o livro contava. Agora ele sobe na resposta e o
       * cabeçalho de `json()` o leva para o livro.
       */
      recusados = preco.recusados;
      const declarado = xp - atual.xp;
      // Só registra quando a diferença é grande: 1,2× é ruído de item fora de
      // sincronia; 40× é outra coisa. A folga é a mesma leitura de sempre.
      const folga = declarado / Math.max(1, preco.xp);
      if (preco.encontros > 0 && (folga > 2 || folga < 0.5)) {
        escritas.push(env.DB
          .prepare(
            'INSERT INTO excedentes (usuario, em, moeda, motivo, quantia, teto, folga, setor, segundos)'
            + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(id, agora, 'xp', 'encontros', declarado, preco.xp, folga, setor, preco.encontros));
      }
    } catch (erro) {
      // Precificar é auditoria: uma falha aqui não pode custar o progresso
      // legítimo que veio no mesmo envio — mas some do radar se for calada.
      await anotarExcecaoDeAuditoria(env, '/progresso:encontros', erro);
    }
  }

  if (corpo.xp !== undefined) {
    const janela = atual.atualizadoEm ? Math.max(1, agora - atual.atualizadoEm) : 120;
    const e = excedeuPorReplica(xp - atual.xp, setor, janela);
    if (e) {
      escritas.push(env.DB
        .prepare(
          'INSERT INTO excedentes (usuario, em, moeda, motivo, quantia, teto, folga, setor, segundos)'
          + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, agora, 'xp', 'replica', e.quantia, e.teto, e.folga, e.setor, e.segundos));
    }
  }

  escritas.push(env.DB.prepare(`
    INSERT INTO progresso (usuario, xp, melhor_setor, matriz, casco_em_campo, semente, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(usuario) DO UPDATE SET
      xp = excluded.xp, melhor_setor = excluded.melhor_setor,
      matriz = excluded.matriz, casco_em_campo = excluded.casco_em_campo,
      semente = excluded.semente, atualizado_em = excluded.atualizado_em
  `).bind(id, xp, setor, JSON.stringify(matriz), cascoEmCampo, semente, agora));

  // ── XP por nave ───────────────────────────────────────────────────────────
  for (const [casco, valor] of Object.entries(corpo.naves ?? {})) {
    const d = conferirDelta(valor);
    if (typeof d !== 'number') return json({ erro: d }, 400, origem);
    if (casco.length > 64) continue;
    escritas.push(env.DB.prepare(`
      INSERT INTO naves_progresso (usuario, casco, xp) VALUES (?, ?, MAX(0, ?))
      ON CONFLICT(usuario, casco) DO UPDATE SET xp = MAX(0, xp + ?)
    `).bind(id, casco, d, d));
  }

  // ── materiais ─────────────────────────────────────────────────────────────
  for (const [material, valor] of Object.entries(corpo.materiais ?? {})) {
    const d = conferirDelta(valor);
    if (typeof d !== 'number') return json({ erro: d }, 400, origem);
    if (material.length > 64) continue;
    // `MAX(0, ...)` no próprio SQL: material nunca fica negativo, e resolver
    // isso aqui evita ler antes de escrever — que teria janela entre as duas.
    escritas.push(env.DB.prepare(`
      INSERT INTO materiais (usuario, material, quantia) VALUES (?, ?, MAX(0, ?))
      ON CONFLICT(usuario, material) DO UPDATE SET quantia = MAX(0, quantia + ?)
    `).bind(id, material, Math.trunc(d), Math.trunc(d)));
  }

  await env.DB.batch(escritas);
  return json({ ...(await progressoDe(env, id)), recusados }, 200, origem);
}
// ── ausência: o servidor simula o que aconteceu ─────────────────────────────

/**
 * Teto de ausência creditada.
 *
 * Doze horas. Não é anti-trapaça — o relógio é do servidor —, é custo: cada
 * hora simulada são ~8 ms de CPU, e sem teto uma conta parada por um mês
 * pediria quase seis segundos de Worker numa requisição só.
 */
const AUSENCIA_MAX = 12 * 3600;

/** Abaixo disto não vale simular: o cliente já cobre com o laço ao vivo. */
const AUSENCIA_MIN = 120;

/**
 * Credita o progresso de quem esteve fora.
 *
 * ## O que muda de dono aqui
 *
 * O cálculo. Ele rodava no CLIENTE: `applyOffline` simulava a ausência e o
 * resultado subia como ganho declarado. Era o maior buraco que sobrava, e a
 * medição registrada no PLANO mostra o tamanho — offline rendia **368 itens
 * contra 44** do jogo ao vivo no mesmo trecho.
 *
 * ## O cliente não diz quanto tempo ficou fora
 *
 * É a peça central. A ausência sai da diferença entre AGORA e o último
 * carimbo que o servidor gravou — `progresso.atualizado_em`. Alegar dez horas
 * depois de cinco minutos não funciona, porque ninguém pergunta ao cliente.
 *
 * ## O que o cliente ainda informa
 *
 * Casco em campo, setor, onda e postura. Nenhum decide poder, e os dois que
 * poderiam ser abusados são aparados contra o que o servidor sabe: o casco
 * precisa estar na frota, e o setor não passa do melhor já alcançado.
 */
async function creditarAusencia(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const permissao = await consumirFicha(env, id, 'sincronia', agora);
  if (!permissao.pode) {
    return json({ erro: 'rapido_demais', esperar: permissao.esperar }, 429, origem);
  }

  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);
  let ctx: ContextoDoCliente;
  try {
    ctx = JSON.parse(bruto) as ContextoDoCliente;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const marca = await env.DB
    .prepare('SELECT atualizado_em FROM progresso WHERE usuario = ?')
    .bind(id)
    .first<{ atualizado_em: number }>();

  // Conta sem carimbo é conta nova: não há ausência a creditar, e inventar uma
  // daria progresso de graça a quem acabou de entrar.
  const desde = marca?.atualizado_em ?? agora;
  const fora = Math.min(AUSENCIA_MAX, Math.max(0, agora - desde));
  if (fora < AUSENCIA_MIN) {
    return json({ segundos: 0, motivo: !marca ? 'conta_nova' : 'curta_demais' }, 200, origem);
  }

  const [carteira, prog, frota, itens] = await Promise.all([
    carteiraDe(env, id), progressoDe(env, id), frotaDe(env, id), inventarioDe(env, id),
  ]);

  const lote = await env.DB
    .prepare('SELECT semente FROM lotes WHERE usuario = ?')
    .bind(id).first<{ semente: number }>();

  const sim = simDoServidor(
    {
      saldos: carteira.saldos,
      xp: prog.xp, nivel: prog.nivel, matriz: prog.matriz,
      melhorSetor: prog.melhorSetor, materiais: prog.materiais,
      naves: prog.naves, frota, itens, semente: prog.semente,
      // Qual nave esta em campo e do servidor desde 08/09. Sem passar isto, a
      // ausencia de quem nao informou nada caia no primeiro casco da frota --
      // quase sempre o do piloto, e nao a nave que o jogador deixou voando.
      cascoEmCampo: prog.cascoEmCampo,
    },
    ctx,
    lote?.semente ?? novaSemente(),
  );

  /**
   * A carga declarada pelo cliente entra na incursão ANTES de simular.
   *
   * Aparada contra `TETO_POR_LANCAMENTO`, que é o mesmo teto de sanidade da
   * carteira: a carga vira lançamento quando o setor cai, então aceitar aqui
   * mais do que se aceita lá seria uma porta lateral para o mesmo lugar.
   */
  const declarada = (ctx as { carga?: Record<string, unknown> }).carga ?? {};
  for (const moeda of MOEDAS) {
    const v = Number(declarada[moeda]);
    sim.state.run.carga[moeda] = Number.isFinite(v) && v > 0
      ? Math.min(v, TETO_POR_LANCAMENTO) : 0;
  }

  const antes = {
    saldos: { ...sim.state.resources },
    // ACUMULADO, não o campo `xp` — ele é o resto dentro do nível, e cai
    // quando a simulação sobe um nível. A diferença de restos daria um número
    // negativo justamente na ausência mais generosa.
    xp: xpAcumuladoDe(sim.state.command, curvaXpPersonagem),
    uids: new Set(sim.state.inventory.map((i) => i.uid)),
  };

  const relatorio = sim.applyOffline(fora);

  // ── escreve de volta ──────────────────────────────────────────────────────
  const escritas: D1PreparedStatement[] = [];

  for (const moeda of MOEDAS) {
    const d = Math.trunc(sim.state.resources[moeda] - antes.saldos[moeda]);
    if (d !== 0) {
      const r = await lancar(env, { usuario: id, moeda, quantia: d, motivo: 'drop', em: agora });
      // Um lançamento recusado não derruba a ausência inteira: o resto do
      // progresso é legítimo e já foi simulado.
      void r;
    }
  }

  /**
   * O que se grava é o ACUMULADO, e era isto que vazava.
   *
   * A coluna guarda XP acumulado — é dela que o nível é derivado. Mas o campo
   * `xp` do `GameState` é o RESTO dentro do nível, e estas duas escritas
   * gravavam o resto por cima do acumulado. Efeito: **cada crédito de ausência
   * truncava o XP do jogador**, jogando-o de volta para o começo do nível em
   * que ele estava. Quanto mais alto o nível, mais se perdia.
   */
  escritas.push(env.DB.prepare(`
    INSERT INTO progresso (usuario, xp, melhor_setor, matriz, casco_em_campo, semente, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(usuario) DO UPDATE SET
      xp = excluded.xp, melhor_setor = excluded.melhor_setor, atualizado_em = excluded.atualizado_em
  `).bind(
    id, xpAcumuladoDe(sim.state.command, curvaXpPersonagem),
    Math.max(prog.melhorSetor, sim.state.run.sector),
    // A ausência não escolhe nave: o `DO UPDATE` acima não toca na coluna, e
    // estes valores só existem para o caso de a linha ainda não existir.
    JSON.stringify(prog.matriz), prog.cascoEmCampo, prog.semente, agora,
  ));

  for (const [casco, nave] of Object.entries(sim.state.naves)) {
    escritas.push(env.DB.prepare(`
      INSERT INTO naves_progresso (usuario, casco, xp) VALUES (?, ?, ?)
      ON CONFLICT(usuario, casco) DO UPDATE SET xp = excluded.xp
    `).bind(id, casco, xpAcumuladoDe(nave, curvaXpNave)));
  }

  for (const [material, quantia] of Object.entries(sim.state.armazem)) {
    escritas.push(env.DB.prepare(`
      INSERT INTO materiais (usuario, material, quantia) VALUES (?, ?, ?)
      ON CONFLICT(usuario, material) DO UPDATE SET quantia = excluded.quantia
    `).bind(id, material, Math.max(0, Math.trunc(quantia))));
  }

  // Itens: entra o que nasceu, sai o que a automação descartou. Diferença de
  // conjuntos, e não "insere tudo": o descarte automático consome a maior
  // parte do que cai, e sem a remoção o inventário do servidor cresceria com
  // peças que o jogador nunca teve.
  const depois = new Set(sim.state.inventory.map((i) => i.uid));
  for (const item of sim.state.inventory) {
    if (antes.uids.has(item.uid)) continue;
    escritas.push(env.DB
      .prepare('INSERT OR IGNORE INTO itens (uid, usuario, dados, nave, slot, em) VALUES (?, ?, ?, NULL, NULL, ?)')
      .bind(item.uid, id, JSON.stringify(item), agora));
  }
  for (const uid of antes.uids) {
    if (depois.has(uid)) continue;
    escritas.push(env.DB.prepare('DELETE FROM itens WHERE uid = ? AND usuario = ? AND nave IS NULL').bind(uid, id));
  }

  await env.DB.batch(escritas);

  return json({
    segundos: relatorio.seconds,
    limitado: relatorio.capped || fora >= AUSENCIA_MAX,
    ganhou: relatorio.gained,
    setores: relatorio.sectorsCleared,
    abates: relatorio.kills,
    baus: relatorio.chests,
    xp: Math.round(xpAcumuladoDe(sim.state.command, curvaXpPersonagem) - antes.xp),
    itensNovos: [...depois].filter((u) => !antes.uids.has(u)).length,
    // A incursão como ficou. O cliente adota — é o que faz morrer perder a
    // carga e concluir o setor guardá-la, igual ao jogo ao vivo.
    incursao: {
      setor: sim.state.run.sector,
      onda: sim.state.run.wave,
      carga: sim.state.run.carga,
    },
  }, 200, origem);
}
