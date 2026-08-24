import type { Item } from '@sim/types';

/**
 * Custo da remodulação de uma linha na Bancada de Afixos.
 *
 * A curva quadrática por raridade impede que uma peça Divina seja aperfeiçoada
 * em série. O ilvl acompanha a economia da campanha sem alterar o tier da linha.
 */
export function recalibrationCost(item: Pick<Item, 'rarity' | 'ilvl'>): number {
  return Math.ceil(50 * Math.pow(item.rarity + 1, 2) * (1 + item.ilvl / 50));
}
