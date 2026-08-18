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
/**
 * A escada de `power` — até onde cada raridade leva o jogador.
 *
 * Medida, não escolhida. Cada valor foi afinado contra o setor em que um
 * conjunto INTEIRO daquela raridade sai da faixa saudável de combate:
 *
 *   Comum 24 · Incomum 40 · Raro 88 · Épico 190 · Lendário e acima: passam do 300
 *
 * O alvo declarado era Comum não passar da galáxia 2 e Épico travar por volta do
 * 200 — os dois batem. Incomum, Raro e Lendário ficam a 18% de erro médio dos
 * alvos, e a razão está registrada abaixo.
 *
 * ## Por que os valores não são uma progressão limpa
 *
 * `power` é o TERCEIRO eixo da raridade: `afixos` (1 a 7) e `tierMax` (3 a 10)
 * já criam uma escada por conta própria. Uma progressão geométrica de `power`
 * por cima delas produz paredes irregulares — foi medido, e o fundo ficava
 * comprimido em 26/30/36 enquanto o topo saltava para 128.
 *
 * ## O que não funcionou
 *
 * Aplicar `power` só ao IMPLÍCITO da base quase não move nada: reduzi-lo 36
 * vezes levou a parede do Comum de 32 para 28. O implícito é parcela pequena do
 * poder de um item — quem manda são os afixos. Por isso `resolveStats` escala o
 * item INTEIRO.
 *
 * ## O limite conhecido
 *
 * Lendário, Mítico e Divino não travam dentro dos 300 setores, e a diferença
 * entre eles não aparece nesta medida. Perto do fim da curva o ganho de poder
 * necessário para "não travar" é pequeno, então três raridades cabem na mesma
 * resposta. Distingui-las exige outra régua que não a parede — provavelmente
 * tempo de limpeza no setor 300.
 */
export const RARITIES: readonly RarityInfo[] = [
  { id: 0, name: 'Comum', slug: 'comum',      color: '#a8b6c8', glow: 'rgba(168,182,200,.30)', gem: 'gem/0', afixos: 1, power: 0.60,  weight: 10000, sorteExpo: 0, tierMax: 3,  setChance: 0 },
  { id: 1, name: 'Incomum', slug: 'incomum',    color: '#7ed957', glow: 'rgba(126,217,87,.38)',  gem: 'gem/1', afixos: 2, power: 1.90,  weight: 3400, sorteExpo: 1,  tierMax: 4,  setChance: 0.04 },
  { id: 2, name: 'Raro', slug: 'raro',       color: '#38a9ff', glow: 'rgba(56,169,255,.44)',  gem: 'gem/2', afixos: 3, power: 2.20, weight: 960, sorteExpo: 2,   tierMax: 6,  setChance: 0.14 },
  { id: 3, name: 'Épico', slug: 'epico',      color: '#c060ff', glow: 'rgba(192,96,255,.50)',  gem: 'gem/3', afixos: 4, power: 2.70,  weight: 220, sorteExpo: 3,   tierMax: 7,  setChance: 0.3 },
  { id: 4, name: 'Lendário', slug: 'lendario',   color: '#ff9a1f', glow: 'rgba(255,154,31,.56)',  gem: 'gem/4', afixos: 5, power: 3.10,  weight: 40, sorteExpo: 4,    tierMax: 8,  setChance: 0.55 },
  // Mítico e Divino reaproveitam o hexágono do Lendário: a folha `Itens.png` só
  // tem cinco. As molduras próprias chegam na Fase 3, com `novos itens.png`.
  { id: 5, name: 'Mítico', slug: 'mitico',     color: '#ff4d5e', glow: 'rgba(255,77,94,.62)',   gem: 'gem/4', afixos: 6, power: 4.90,  weight: 5, sorteExpo: 4.6,     tierMax: 9,  setChance: 0.75 },
  { id: 6, name: 'Divino', slug: 'divino',     color: '#ffd76a', glow: 'rgba(255,215,106,.70)', gem: 'gem/4', afixos: 7, power: 7.00,  weight: 0.4, sorteExpo: 5.2,   tierMax: 10, setChance: 0.9 },
];

export const rarityInfo = (r: Rarity): RarityInfo => RARITIES[r] ?? RARITIES[0]!;

export const MAX_RARITY = 6 as const;

/** Soma dos pesos, para converter peso em probabilidade sem recontar. */
export const PESO_TOTAL = RARITIES.reduce((s, r) => s + r.weight, 0);
