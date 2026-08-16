import type { Rarity } from '@sim/types';

export interface RarityInfo {
  id: Rarity;
  name: string;
  color: string;
  glow: string;
  /** Sprite do hexágono correspondente na folha de itens. */
  gem: string;
  /** Quantos afixos o item recebe. */
  affixes: number;
  /** Multiplicador no valor rolado de cada afixo. */
  power: number;
  /** Peso relativo na tabela de drop antes dos modificadores de sorte. */
  weight: number;
  /** Chance de o item pertencer a um conjunto. */
  setChance: number;
}

/**
 * Cinco raridades, nas cores da folha `Itens.png`.
 *
 * `power` cresce mais rápido que `affixes` de propósito: um lendário não é só
 * "mais linhas", é cada linha valendo bem mais — senão a raridade alta viraria
 * ruído em vez de salto.
 */
export const RARITIES: readonly RarityInfo[] = [
  { id: 0, name: 'Comum',    color: '#a8b6c8', glow: 'rgba(168,182,200,.30)', gem: 'gem/0', affixes: 1, power: 1.0,  weight: 1000, setChance: 0 },
  { id: 1, name: 'Incomum',  color: '#7ed957', glow: 'rgba(126,217,87,.38)',  gem: 'gem/1', affixes: 2, power: 1.3,  weight: 340,  setChance: 0.05 },
  { id: 2, name: 'Raro',     color: '#38a9ff', glow: 'rgba(56,169,255,.44)',  gem: 'gem/2', affixes: 3, power: 1.75, weight: 96,   setChance: 0.16 },
  { id: 3, name: 'Épico',    color: '#c060ff', glow: 'rgba(192,96,255,.50)',  gem: 'gem/3', affixes: 4, power: 2.4,  weight: 22,   setChance: 0.34 },
  { id: 4, name: 'Lendário', color: '#ff9a1f', glow: 'rgba(255,154,31,.56)',  gem: 'gem/4', affixes: 5, power: 3.4,  weight: 4,    setChance: 0.6 },
];

export const rarityInfo = (r: Rarity): RarityInfo => RARITIES[r] ?? RARITIES[0]!;

export const MAX_RARITY = 4 as const;
