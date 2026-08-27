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
