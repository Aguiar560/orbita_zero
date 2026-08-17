import type { Rarity } from '@sim/types';

/**
 * As sete raridades, de Comum a Divino (§9).
 *
 * As cores vêm da folha `novos itens.png`, que já traz as sete colunas — é ela
 * que vai fornecer as molduras na Fase 3.
 *
 * Três eixos crescem junto com a raridade, e de propósito em ritmos diferentes:
 *
 * - `afixos` cresce de um em um: é a quantidade de linhas na ficha.
 * - `power` cresce mais rápido: cada linha vale mais. Sem isso a raridade alta
 *   viraria "mais texto" em vez de salto de poder.
 * - `tierMax` limita QUÃO alto cada linha pode rolar (§6). É o eixo que impede
 *   um item Comum de nível 300 de competir com um Divino.
 *
 * O §9 é explícito: raridade alta não significa item perfeito. Um Divino com
 * sete linhas em T4 pode perder para um Épico com quatro em T7 — a variação de
 * rolagem continua existindo dentro de cada faixa.
 */
export interface RarityInfo {
  id: Rarity;
  /** Nome de exibição. MUDA com tradução e polimento de texto. */
  name: string;
  /**
   * Identificador estável, não-visual.
   *
   * Existe porque a arte é indexada por raridade (§23) e o pipeline roda em
   * Node puro, sem importar `src/`. Sem um id próprio, o único jeito de casar
   * ícone com raridade era normalizar `name` — tirar acento, pôr em minúsculas
   * — e aí renomear "Divino" para "Divindade" trocaria silenciosamente o ícone
   * de todos os itens da raridade máxima.
   */
  slug: string;
  color: string;
  glow: string;
  /** Sprite do hexágono na folha `Itens.png`. Só existem cinco. */
  gem: string;
  /** Quantos afixos o item recebe. */
  afixos: number;
  /** Multiplicador no valor rolado de cada afixo. */
  power: number;
  /** Peso na tabela de drop, antes dos modificadores de sorte. */
  weight: number;
  /**
   * Expoente com que a sorte multiplica o peso desta raridade.
   *
   * Era o próprio índice, e isso quebrou quando as raridades passaram de cinco
   * para sete: `sorte^6` em vez de `sorte^4` é 64 vezes mais forte, e um baú de
   * Singularidade passou a soltar Divino em **um de cada seis** itens. O §10
   * quer o oposto disso.
   *
   * Separar o expoente do índice deixa a sorte render bastante até o Lendário e
   * perder força no topo — investir em sorte continua valendo, mas não compra
   * o item mais raro do jogo.
   */
  sorteExpo: number;
  /** Teto de tier que os afixos deste item podem alcançar (§6). */
  tierMax: number;
  /** Chance de o item pertencer a um conjunto. */
  setChance: number;
}

/**
 * Os pesos formam uma cauda longa: cada degrau é ~3× a ~12× mais raro que o
 * anterior, e o salto cresce no topo. Divino sai a cerca de **1 em 36 500**
 * rolagens com sorte zero — o §10 quer "sensação real de conquista" sem cair no
 * matematicamente impossível.
 */
export const RARITIES: readonly RarityInfo[] = [
  { id: 0, name: 'Comum', slug: 'comum',      color: '#a8b6c8', glow: 'rgba(168,182,200,.30)', gem: 'gem/0', afixos: 1, power: 1.0,  weight: 10000, sorteExpo: 0, tierMax: 3,  setChance: 0 },
  { id: 1, name: 'Incomum', slug: 'incomum',    color: '#7ed957', glow: 'rgba(126,217,87,.38)',  gem: 'gem/1', afixos: 2, power: 1.3,  weight: 3400, sorteExpo: 1,  tierMax: 4,  setChance: 0.04 },
  { id: 2, name: 'Raro', slug: 'raro',       color: '#38a9ff', glow: 'rgba(56,169,255,.44)',  gem: 'gem/2', afixos: 3, power: 1.75, weight: 960, sorteExpo: 2,   tierMax: 6,  setChance: 0.14 },
  { id: 3, name: 'Épico', slug: 'epico',      color: '#c060ff', glow: 'rgba(192,96,255,.50)',  gem: 'gem/3', afixos: 4, power: 2.4,  weight: 220, sorteExpo: 3,   tierMax: 7,  setChance: 0.3 },
  { id: 4, name: 'Lendário', slug: 'lendario',   color: '#ff9a1f', glow: 'rgba(255,154,31,.56)',  gem: 'gem/4', afixos: 5, power: 3.4,  weight: 40, sorteExpo: 4,    tierMax: 8,  setChance: 0.55 },
  // Mítico e Divino reaproveitam o hexágono do Lendário: a folha `Itens.png` só
  // tem cinco. As molduras próprias chegam na Fase 3, com `novos itens.png`.
  { id: 5, name: 'Mítico', slug: 'mitico',     color: '#ff4d5e', glow: 'rgba(255,77,94,.62)',   gem: 'gem/4', afixos: 6, power: 4.9,  weight: 5, sorteExpo: 4.6,     tierMax: 9,  setChance: 0.75 },
  { id: 6, name: 'Divino', slug: 'divino',     color: '#ffd76a', glow: 'rgba(255,215,106,.70)', gem: 'gem/4', afixos: 7, power: 7.0,  weight: 0.4, sorteExpo: 5.2,   tierMax: 10, setChance: 0.9 },
];

export const rarityInfo = (r: Rarity): RarityInfo => RARITIES[r] ?? RARITIES[0]!;

export const MAX_RARITY = 6 as const;

/** Soma dos pesos, para converter peso em probabilidade sem recontar. */
export const PESO_TOTAL = RARITIES.reduce((s, r) => s + r.weight, 0);
