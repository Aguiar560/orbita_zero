import type { ResourceId } from '@sim/types';

export interface ChestDef {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Arte dedicada da cápsula, relativa a `/assets/ui/baus/chests`. */
  art: string;
  /** Itens sorteados por abertura. */
  items: [number, number];
  /** Bônus somado ao ilvl base do setor. */
  ilvlBonus: number;
  /** Distribuição exata de Comum a Divino. Deve somar 1. */
  raridades: readonly [number, number, number, number, number, number, number];
  /** Recursos concedidos junto, como fração do rendimento de um setor. */
  resources: Partial<Record<ResourceId, number>>;
  /** Custo em cristais para comprar direto na loja (0 = não vendável). */
  buy: number;
}

export const CHESTS: readonly ChestDef[] = [
  {
    id: 'bronze', name: 'Cápsula de Bronze', color: '#c98a52', icon: 'bau/a_0', art: 'bau_bronze.webp',
    items: [1, 2], ilvlBonus: 0,
    raridades: [0.86, 0.12, 0.018, 0.00195, 0.000045, 0.0000045, 0.0000005],
    resources: { sucata: 90, nucleo: 6 }, buy: 0,
  },
  {
    id: 'prata', name: 'Cápsula de Prata', color: '#cdd8e6', icon: 'bau/a_2', art: 'bau_prata.webp',
    items: [2, 3], ilvlBonus: 2,
    raridades: [0.62, 0.30, 0.07, 0.0098, 0.00018, 0.000018, 0.000002],
    resources: { sucata: 300, nucleo: 22, cristal: 1 }, buy: 15,
  },
  {
    id: 'ouro', name: 'Cápsula de Ouro', color: '#ffb638', icon: 'bau/b_5', art: 'bau_ouro.webp',
    items: [3, 4], ilvlBonus: 5,
    raridades: [0.35, 0.40, 0.20, 0.048, 0.0018, 0.000192, 0.000008],
    resources: { sucata: 1100, nucleo: 90, cristal: 4 }, buy: 60,
  },
  {
    id: 'singularidade', name: 'Cápsula de Singularidade', color: '#a978ff', icon: 'bau/c_2', art: 'bau_singularidade.webp',
    items: [4, 6], ilvlBonus: 10,
    raridades: [0.08, 0.24, 0.38, 0.27, 0.028, 0.001992, 0.000008],
    resources: { sucata: 5000, nucleo: 420, cristal: 18 }, buy: 240,
  },
];

export const CHEST_BY_ID = new Map(CHESTS.map((c) => [c.id, c]));

