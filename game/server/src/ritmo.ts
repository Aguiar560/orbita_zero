/**
 * Quanto cada jogador pode gravar, e por quê não é um intervalo fixo.
 *
 * ## O defeito que isto conserta
 *
 * A regra anterior era "uma gravação a cada 120s, ponto". Ela protegia a cota,
 * e quebrava o caso mais importante do jogo: **a gravação de fim de sessão**.
 *
 *   entra no PC A          grava    (t=0)
 *   joga 90 segundos
 *   fecha a aba            RECUSADA (t=90, faltavam 30s)
 *   abre no PC B           recebe o save de t=0
 *
 * Os 90 segundos sumiram. E não é um caso raro: a última gravação de TODA
 * sessão cai nessa janela, então até dois minutos de jogo se perdiam sempre
 * que a pessoa trocava de máquina. Era o "no PC não dá certo".
 *
 * ## Balde de fichas, e por que ele não custa mais caro
 *
 * O que a cota precisa é do rate MÉDIO baixo; o que o jogo precisa é de poder
 * gravar DUAS vezes seguidas de vez em quando. Um balde dá as duas coisas: o
 * refil é a mesma taxa de antes (uma ficha a cada 120s), então o custo médio
 * não muda, mas a capacidade de 3 deixa passar a rajada de fim de sessão.
 *
 * Com mil registrados e ~80 simultâneos no pico, a média continua ~30
 * gravações por hora por jogador ativo — os mesmos 57 mil por dia do desenho
 * anterior, dentro dos 100 mil do D1 gratuito.
 */

/** Segundos para repor uma ficha. É a taxa MÉDIA de gravação. */
export const INTERVALO_DE_REFIL = 120;

/** Quantas fichas cabem no balde. É o tamanho da rajada permitida. */
export const FICHAS_MAX = 3;

export interface Balde {
  fichas: number;
  em: number;
}

/**
 * O balde depois de repor o que o tempo devolveu.
 *
 * `null` para quem nunca gravou: começa cheio, senão a primeira gravação de uma
 * conta nova esperaria dois minutos sem motivo.
 */
export function repor(balde: Balde | null, agora: number): number {
  if (!balde) return FICHAS_MAX;
  const decorrido = Math.max(0, agora - balde.em);
  return Math.min(FICHAS_MAX, balde.fichas + decorrido / INTERVALO_DE_REFIL);
}

export type Permissao =
  | { pode: true; fichasRestantes: number }
  | { pode: false; esperar: number };

/** Dá para gravar agora? */
export function podeGravar(balde: Balde | null, agora: number): Permissao {
  const fichas = repor(balde, agora);
  if (fichas >= 1) return { pode: true, fichasRestantes: fichas - 1 };

  // Quanto falta para a próxima ficha. Dizer isto evita o cliente ficar
  // batendo na porta — sem o número ele só sabe "não", e tenta de novo.
  return { pode: false, esperar: Math.ceil((1 - fichas) * INTERVALO_DE_REFIL) };
}


// ── baldes por assunto ──────────────────────────────────────────────────────

/**
 * Os ritmos de cada rota, e de onde cada número saiu.
 *
 * Todos generosos para o uso REAL e apertados para o laço. O cliente sobe
 * marcas junto com o save (a cada 150s) e busca o placar a cada 20s enquanto a
 * tela está aberta — os limites cabem isso com folga e não cabem um laço.
 */
export const BALDES = {
  /**
   * Marcas: uma chamada pode custar até 80 linhas.
   *
   * É a rota mais cara do servidor, e a única em que uma requisição vira
   * dezenas de escritas. Ritmo do save, capacidade menor.
   */
  marcas: { refil: 120, capacidade: 3 },
  /**
   * Apelido: escolhido uma vez, trocado quase nunca.
   *
   * Cinco minutos entre trocas não incomoda ninguém que esteja escolhendo um
   * nome de verdade, e fecha a porta de quem varre nomes livres um por um.
   */
  apelido: { refil: 300, capacidade: 2 },
  /**
   * Carteira: um depósito por setor concluído, mais missões e Provação.
   *
   * Medido no jogo em 03/09: cinco ondas por setor, cerca de três minutos por
   * setor — **20 depósitos por hora** no ritmo normal. É baixo porque o ganho
   * de combate entra em `run.carga` e só é bancado quando o setor inteiro cai;
   * abate não deposita nada.
   *
   * Um a cada 30 s com estouro de 6 dá folga de 9× sobre o ritmo real, o que
   * cobre missão e Provação caindo junto do setor, e ainda assim recusa um
   * laço que chame a rota em série.
   */
  carteira: { refil: 30, capacidade: 6 },
} as const;

export type NomeDeBalde = keyof typeof BALDES;

/** O mesmo cálculo de `podeGravar`, com os números do balde escolhido. */
export function podeUsar(
  nome: NomeDeBalde,
  balde: Balde | null,
  agora: number,
): Permissao {
  const { refil, capacidade } = BALDES[nome];
  const fichas = balde
    ? Math.min(capacidade, balde.fichas + Math.max(0, agora - balde.em) / refil)
    : capacidade;

  if (fichas >= 1) return { pode: true, fichasRestantes: fichas - 1 };
  return { pode: false, esperar: Math.ceil((1 - fichas) * refil) };
}

// ── leitura: balde em memória ───────────────────────────────────────────────

/**
 * O limite do `GET /placar`, guardado no ISOLADO e não no banco.
 *
 * Um limitador que grava no banco a cada LEITURA custa mais que o que ele
 * protege — trocaria uma consulta barata por uma escrita cara, e a escrita é
 * justamente a cota que está em jogo.
 *
 * Em memória não é à prova de tudo: o Workers cria isolados por região e os
 * recicla, então um cliente distribuído escapa. Mas o caso que isto existe para
 * pegar — um laço de um cliente só — cai no mesmo isolado quase sempre, e essa
 * é a diferença entre "gasta a cota de todos numa tarde" e "não gasta".
 */
const LEITURAS_POR_MINUTO = 30;
const leituras = new Map<string, { fichas: number; em: number }>();

export function podeLer(usuario: string, agora: number): boolean {
  const b = leituras.get(usuario);
  const fichas = b
    ? Math.min(LEITURAS_POR_MINUTO, b.fichas + ((agora - b.em) / 60) * LEITURAS_POR_MINUTO)
    : LEITURAS_POR_MINUTO;

  if (fichas < 1) return false;

  // O mapa não pode crescer para sempre: um isolado longevo com muitos
  // jogadores viraria vazamento. Acima do teto, esquece os mais antigos.
  if (leituras.size > 5000) {
    for (const [k] of leituras) {
      leituras.delete(k);
      if (leituras.size <= 4000) break;
    }
  }

  leituras.set(usuario, { fichas: fichas - 1, em: agora });
  return true;
}
