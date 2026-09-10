/**
 * Descobrir que saiu versão nova, sem o jogador apertar F5.
 *
 * ## O problema, concreto
 *
 * Este é um jogo idle: a aba fica aberta por horas, às vezes dias. Um deploy
 * não alcança quem já está dentro — o bundle antigo continua rodando até
 * alguém recarregar, e ninguém recarrega, porque ninguém tem como saber que
 * precisa. O jogador segue jogando uma versão com o defeito que acabou de ser
 * corrigido, e reporta de novo o mesmo problema.
 *
 * ## Como se sabe
 *
 * O build carimba um número em duas partes: dentro do bundle
 * (`__VERSAO_DO_BUNDLE__`) e num arquivo à parte (`/versao.json`). O cliente
 * pergunta pelo arquivo de tempos em tempos e compara com o próprio carimbo.
 * Diferente quer dizer: o servidor já tem outra versão, e esta aba está velha.
 *
 * ## Por que não Service Worker
 *
 * É a resposta padrão para isto e seria a errada aqui. Um SW acrescenta um
 * cache que o jogo não tem hoje, com um ciclo de vida próprio (`installing`,
 * `waiting`, `skipWaiting`) que é fonte conhecida de versões presas — o
 * defeito que ele viria resolver, agora com mais peças. Um GET de trinta bytes
 * a cada cinco minutos resolve o mesmo, e o que ele pode quebrar cabe nesta
 * página.
 *
 * ## O que este arquivo NÃO faz
 *
 * Ele não recarrega nada. Só avisa. Quando recarregar é decisão do `Game`, que
 * é quem sabe se o jogador está no meio de um chefe ou se a aba está escondida
 * há uma hora — ver `aoDescobrirVersao`.
 */

/** De quanto em quanto tempo perguntar. */
export const INTERVALO_DA_CHECAGEM = 5 * 60 * 1000;

/** Onde o build publica o carimbo. */
export const CAMINHO_DA_VERSAO = '/versao.json';

/**
 * A memória da tentativa mora na ABA (`sessionStorage`), não no navegador.
 *
 * Duas abas abertas são duas partidas, e cada uma decide sozinha quando
 * recarregar. Guardar em `localStorage` faria a primeira a recarregar calar a
 * segunda, que continuaria velha sem nunca mais ser avisada.
 */
export const CHAVE_DA_TENTATIVA = 'oz:recarregou-para';

/** O carimbo deste bundle. `dev` quando não houve build. */
export const VERSAO_DO_BUNDLE: string =
  typeof __VERSAO_DO_BUNDLE__ === 'string' && __VERSAO_DO_BUNDLE__ ? __VERSAO_DO_BUNDLE__ : 'dev';

/**
 * O que o servidor está publicando agora, ou `null`.
 *
 * `null` cobre tudo o que pode dar errado — rede fora, 404, JSON torto, deploy
 * no meio do caminho — e o chamador trata os quatro do mesmo jeito: não faz
 * nada. Uma checagem de versão que quebra o jogo seria pior que a versão velha.
 */
export async function versaoPublicada(buscar: typeof fetch = fetch): Promise<string | null> {
  try {
    // A query anti-cache é cinto e suspensório junto com o `no-store`: o
    // cabeçalho depende da hospedagem estar configurada, e um proxy no meio do
    // caminho não obedece a nenhum dos dois — mas obedece a uma URL diferente.
    const r = await buscar(`${CAMINHO_DA_VERSAO}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const dados = (await r.json()) as { versao?: unknown };
    return typeof dados.versao === 'string' && dados.versao ? dados.versao : null;
  } catch {
    return null;
  }
}

/** Saiu versão nova? */
export const mudouDeVersao = (atual: string, publicada: string | null): boolean =>
  !!publicada && publicada !== atual;

const memoriaPadrao = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    // Janela anônima com dados de site bloqueados: o acesso ESTOURA, não
    // devolve nulo. Sem memória a guarda do laço não existe, e é por isso que
    // ela não é a única defesa — ver `devoRecarregar`.
    return null;
  }
};

/**
 * Já tentamos recarregar por causa desta versão, nesta aba?
 *
 * ## O laço que isto fecha
 *
 * Deploy em CDN não propaga tudo no mesmo instante. Existe uma janela em que
 * `/versao.json` já é o novo e o `index.html` ainda é o velho — e aí o bundle
 * que volta depois do reload continua com o carimbo antigo, discorda de novo,
 * e recarrega de novo. Um jogador nessa janela veria a página piscando sem
 * parar até a propagação terminar.
 *
 * Uma tentativa por versão por aba. Se não resolveu, o aviso continua na tela
 * e a decisão volta a ser dele.
 */
export function devoRecarregar(nova: string, memoria = memoriaPadrao()): boolean {
  if (!memoria) return true;
  try {
    return memoria.getItem(CHAVE_DA_TENTATIVA) !== nova;
  } catch {
    return true;
  }
}

/** Marca a tentativa ANTES de recarregar — depois não existe "depois". */
export function marcarTentativa(nova: string, memoria = memoriaPadrao()): void {
  try {
    memoria?.setItem(CHAVE_DA_TENTATIVA, nova);
  } catch {
    // Sem memória, a guarda do laço se perde e o pior caso é uma segunda
    // recarga. Estourar aqui impediria a primeira, que é a que interessa.
  }
}

export interface OpcoesDaVigia {
  intervalo?: number;
  atual?: string;
  buscar?: typeof fetch;
  /** Injetável para o teste não depender de `window`. */
  agendar?: (f: () => void, ms: number) => number;
  cancelar?: (id: number) => void;
  aoVoltarParaAba?: (f: () => void) => () => void;
}

/**
 * Pergunta pela versão de tempos em tempos, e quando a aba volta a aparecer.
 *
 * A segunda parte é a que mais importa num idle: a aba fica escondida por
 * horas, e o navegador estrangula os temporizadores de fundo — a checagem
 * agendada pode simplesmente não acontecer. O jogador voltando para a aba é o
 * momento em que ele está prestes a jogar de novo, e é onde a pergunta tem de
 * ser feita de qualquer jeito.
 *
 * Devolve a função que desliga tudo.
 */
export function vigiarVersao(
  aoMudar: (nova: string) => void,
  opcoes: OpcoesDaVigia = {},
): () => void {
  const {
    intervalo = INTERVALO_DA_CHECAGEM,
    atual = VERSAO_DO_BUNDLE,
    buscar = fetch,
    agendar = (f, ms) => window.setInterval(f, ms),
    cancelar = (id) => window.clearInterval(id),
    aoVoltarParaAba = (f) => {
      const ouvinte = (): void => { if (!document.hidden) f(); };
      document.addEventListener('visibilitychange', ouvinte);
      return () => document.removeEventListener('visibilitychange', ouvinte);
    },
  } = opcoes;

  let vivo = true;
  const conferir = async (): Promise<void> => {
    if (!vivo) return;
    const publicada = await versaoPublicada(buscar);
    if (!vivo || !mudouDeVersao(atual, publicada)) return;
    aoMudar(publicada!);
  };

  const relogio = agendar(() => void conferir(), intervalo);
  const soltarAba = aoVoltarParaAba(() => void conferir());

  return () => {
    vivo = false;
    cancelar(relogio);
    soltarAba();
  };
}
