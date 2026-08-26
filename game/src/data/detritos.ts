/**
 * Detritos: asteroides e lixo espacial.
 *
 * ## O que eles NÃO são
 *
 * Não são inimigos. Não dão XP, não dão recurso, não soltam item, não contam
 * como abate e não entram na contagem que fecha a onda. Destruir um detrito não
 * aproxima o jogador de nada — é exatamente por isso que eles funcionam como
 * cenário: se rendessem qualquer coisa, virariam mais uma fila de coisas a
 * moer, e a fase teria dois objetivos competindo.
 *
 * ## O que eles são
 *
 * Obstáculo. Comem projétil — o seu e o do inimigo — e machucam no encontrão.
 * É o que os separa de um plano de fundo: um cenário que não interfere é
 * decoração, e a nave passaria por ele sem nunca reparar.
 *
 * ## Por que o dano vem da curva do setor
 *
 * O encontrão usa uma FRAÇÃO do dano que o próprio setor já aplica, e não um
 * número próprio. Uma constante fixa seria trivial no setor 200 e letal no 2;
 * puxar da curva faz o detrito acompanhar o resto do jogo sem inventar uma
 * segunda régua de dificuldade.
 */

import type { Rng } from '@core/math';

export type TamanhoDeDetrito = 'p' | 'm' | 'g';
export type FamiliaDeDetrito = 'asteroide' | 'lixo';

export interface PerfilDeDetrito {
  /** Raio de colisão, em unidades lógicas. */
  raio: number;
  /** Golpes que aguenta antes de quebrar. */
  vida: number;
  /** Velocidade de descida, multiplicando a base. */
  velocidade: number;
  /** Rotação, em voltas por segundo. */
  giro: number;
  /** Fração do dano do setor aplicada no encontrão. */
  impacto: number;
}

/**
 * O perfil de cada tamanho.
 *
 * Grande é lento, duro e dói; pequeno é rápido, frágil e mal arranha. A relação
 * é a que o olho espera de massa — e é ela que faz o jogador tratar um
 * asteroide grande como parede e um cascalho como poeira, sem precisar de
 * tutorial.
 */
export const PERFIL_DE_DETRITO: Record<TamanhoDeDetrito, PerfilDeDetrito> = {
  p: { raio: 11, vida: 1, velocidade: 1.35, giro: 0.55, impacto: 0.25 },
  m: { raio: 21, vida: 3, velocidade: 1.0, giro: 0.3, impacto: 0.5 },
  g: { raio: 38, vida: 8, velocidade: 0.72, giro: 0.14, impacto: 1.0 },
};

/** Quantas variações de arte cada grupo tem no atlas. */
export const VARIACOES: Record<FamiliaDeDetrito, Record<TamanhoDeDetrito, number>> = {
  asteroide: { p: 25, m: 15, g: 4 },
  lixo: { p: 3, m: 11, g: 8 },
};

export const spriteDeDetrito = (
  familia: FamiliaDeDetrito,
  tamanho: TamanhoDeDetrito,
  variacao: number,
): string => `detrito/${familia}/${tamanho}_${variacao % VARIACOES[familia][tamanho]}`;

/**
 * O clima de detrito de um trecho do setor.
 *
 * `esparso` é o estado normal — um detrito aqui e ali, para o espaço não ser um
 * vazio liso. Os dois outros são MOMENTOS: começam, apertam e passam.
 */
export type ClimaDeDetrito = 'esparso' | 'chuva_meteoros' | 'chuva_lixo';

export interface Clima {
  id: ClimaDeDetrito;
  nome: string;
  /** Detritos por segundo. */
  taxa: number;
  /** Duração do momento, em segundos. `0` = permanente. */
  duracao: number;
  /** Peso do sorteio. `0` = nunca sai por acaso. */
  peso: number;
  familia: FamiliaDeDetrito | 'ambas';
  /** Distribuição de tamanho: pequeno, médio, grande. */
  mistura: readonly [number, number, number];
}

/**
 * A chuva de meteoros é o momento mais denso do jogo.
 *
 * Quarenta detritos em oito segundos dá cinco por segundo — o suficiente para a
 * tela encher e o jogador ter de se mover de verdade, e curto o bastante para
 * ser um evento e não um regime. Um minuto disso viraria a fase inteira.
 *
 * A mistura pende para o pequeno de propósito: quarenta asteroides grandes
 * seriam uma parede intransponível, quarenta cascalhos são uma chuva. O punhado
 * de grandes é o que dá peso ao momento.
 */
export const CLIMAS: readonly Clima[] = [
  {
    id: 'esparso', nome: 'Campo de detritos',
    taxa: 0.35, duracao: 0, peso: 0, familia: 'ambas',
    mistura: [0.6, 0.32, 0.08],
  },
  {
    id: 'chuva_meteoros', nome: 'CHUVA DE METEOROS',
    taxa: 5, duracao: 8, peso: 55, familia: 'asteroide',
    mistura: [0.62, 0.3, 0.08],
  },
  {
    id: 'chuva_lixo', nome: 'CAMPO DE SUCATA',
    taxa: 3.2, duracao: 9, peso: 45, familia: 'lixo',
    mistura: [0.4, 0.42, 0.18],
  },
];

export const CLIMA_POR_ID = new Map(CLIMAS.map((c) => [c.id, c]));

/** Sorteia um tamanho segundo a mistura do clima. */
export function tamanhoSorteado(rng: Rng, mistura: readonly [number, number, number]): TamanhoDeDetrito {
  const r = rng.next();
  if (r < mistura[0]) return 'p';
  if (r < mistura[0] + mistura[1]) return 'm';
  return 'g';
}

/**
 * Intervalo entre momentos, em segundos.
 *
 * Larga de propósito: um evento que chega em relógio fixo deixa de ser evento e
 * vira fase. A variação é o que faz o jogador não saber quando vem.
 */
export const INTERVALO_MIN = 22;
export const INTERVALO_MAX = 48;

/** Velocidade base de descida, em unidades por segundo. */
export const VELOCIDADE_BASE = 120;

/**
 * Teto de detritos vivos ao mesmo tempo.
 *
 * A chuva de meteoros solta 40, mas eles não coexistem: os primeiros já saíram
 * de tela quando os últimos entram. O teto existe para o caso patológico — um
 * jogador parado no topo, que não deixa nenhum passar.
 */
export const DETRITOS_MAX = 70;
