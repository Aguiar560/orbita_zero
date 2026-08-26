/**
 * Combustível: quanto tempo uma nave aguenta em campo, e quanto custa voltar.
 *
 * ## Por que existe
 *
 * Sem ele, a frota é decoração. O jogador compra o casco mais forte que pode e
 * voa só com ele até comprar o próximo — os outros quarenta ficam no hangar sem
 * nunca sair. Combustível força ROTAÇÃO: a nave boa acaba, e enquanto ela se
 * reabastece o jogador voa outra.
 *
 * É por isso que a autonomia é INVERSA ao poder. Uma nave forte que também
 * durasse mais seria estritamente melhor, e a rotação nunca aconteceria.
 *
 * ## Por que a escala é logarítmica
 *
 * O poder dos cascos vai de 79 a 13.691 — 173× entre a primeira e a última.
 * Numa escala linear, TODOS os cascos abaixo do tier 6 cairiam praticamente no
 * mesmo ponto da curva e teriam a mesma autonomia. O poder cresce por tier de
 * forma geométrica, então a autonomia tem de ler o poder do mesmo jeito.
 *
 * Medido, o que a interpolação em log entrega por tier:
 *
 * ```
 *   T1  ~19,9 h      T5  ~10,6 h
 *   T2  ~18,0 h      T6   ~9,3 h
 *   T3  ~16,5 h      T7   ~7,3 h
 *   T4  ~12,9 h      máx   6,0 h
 * ```
 */

/** Autonomia do casco mais fraco do jogo, em segundos. */
export const AUTONOMIA_MAX = 20 * 3600;

/**
 * Autonomia do casco mais forte, em segundos.
 *
 * Seis horas não é número redondo por acaso: é o mesmo teto de ausência diária
 * que o §placar define. A nave mais forte do jogo carrega exatamente uma janela
 * de offline — nem mais, para não haver nave que dispense rotação, nem menos,
 * para o teto de ausência não ser inalcançável com a melhor frota.
 */
export const AUTONOMIA_MIN = 6 * 3600;

/**
 * Horas paradas no hangar para encher do zero.
 *
 * Também inversa ao poder, e por um motivo diferente da autonomia: se a nave
 * forte enchesse tão rápido quanto a fraca, bastaria ter duas fortes e alternar
 * — a rotação viraria um par, não uma frota. Com recarga lenta, o jogador
 * precisa de gente para voar enquanto a melhor descansa.
 */
export const RECARGA_MIN_H = 4;
export const RECARGA_MAX_H = 12;

/**
 * Custo de reabastecer do zero, em núcleos, para o casco mais fraco e o mais
 * forte.
 *
 * A recarga do hangar é grátis e lenta; pagar é comprar TEMPO. O preço cresce
 * com o poder pela mesma razão que a autonomia encolhe: quem quer voar a melhor
 * nave o tempo todo pode, e paga por isso.
 */
export const CUSTO_MIN = 40;
export const CUSTO_MAX = 4200;

/**
 * Fração de combustível abaixo da qual a nave não decola.
 *
 * Não é zero. Uma nave que decola com 0,5% cai em vinte segundos e devolve o
 * jogador à mesma tela — o piso existe para "sem combustível" ser um estado que
 * se resolve, e não um ciclo de decolar e cair.
 */
export const PISO_PARA_DECOLAR = 0.05;

/** Posição do casco na escala de poder, 0 = mais fraco, 1 = mais forte. */
export function fracaoDePoder(nota: number, notaMin: number, notaMax: number): number {
  if (!(nota > 0) || !(notaMin > 0) || notaMax <= notaMin) return 0;
  const t = (Math.log(nota) - Math.log(notaMin)) / (Math.log(notaMax) - Math.log(notaMin));
  return Math.min(1, Math.max(0, t));
}

const entre = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Segundos de voo que o casco aguenta com o tanque cheio. */
export const autonomiaDe = (fracao: number): number =>
  entre(AUTONOMIA_MAX, AUTONOMIA_MIN, fracao);

/** Segundos parado no hangar para encher do zero. */
export const recargaDe = (fracao: number): number =>
  entre(RECARGA_MIN_H, RECARGA_MAX_H, fracao) * 3600;

/** Núcleos para encher do zero. */
export const custoDe = (fracao: number): number =>
  Math.round(entre(CUSTO_MIN, CUSTO_MAX, fracao));
