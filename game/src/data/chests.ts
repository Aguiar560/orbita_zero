import type { Rarity, ResourceId } from '@sim/types';

export interface ChestDef {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Itens sorteados por abertura. */
  items: [number, number];
  /** Bônus somado ao ilvl base do setor. */
  ilvlBonus: number;
  /** Raridade mínima garantida em pelo menos um item. */
  floor: Rarity;
  /** Multiplicador nos pesos das raridades altas. */
  luck: number;
  /** Recursos concedidos junto, como fração do rendimento de um setor. */
  resources: Partial<Record<ResourceId, number>>;
  /** Custo em cristais para comprar direto na loja (0 = não vendável). */
  buy: number;
}

export const CHESTS: readonly ChestDef[] = [
  {
    id: 'bronze', name: 'Cápsula de Bronze', color: '#c98a52', icon: 'bau/a_0',
    items: [1, 2], ilvlBonus: 0, floor: 0, luck: 1.0,
    resources: { sucata: 90, nucleo: 6 }, buy: 0,
  },
  {
    id: 'prata', name: 'Cápsula de Prata', color: '#cdd8e6', icon: 'bau/a_2',
    items: [2, 3], ilvlBonus: 2, floor: 1, luck: 1.6,
    resources: { sucata: 300, nucleo: 22, cristal: 1 }, buy: 15,
  },
  {
    id: 'ouro', name: 'Cápsula de Ouro', color: '#ffb638', icon: 'bau/b_5',
    items: [3, 4], ilvlBonus: 5, floor: 2, luck: 3.0,
    resources: { sucata: 1100, nucleo: 90, cristal: 4 }, buy: 60,
  },
  {
    id: 'singularidade', name: 'Singularidade', color: '#c060ff', icon: 'bau/c_2',
    // Piso subiu de Épico para Lendário quando as raridades passaram de cinco
    // para sete: garantir Épico era o penúltimo degrau e virou o do meio, o que
    // esvaziava a identidade do baú mais caro do jogo.
    items: [4, 6], ilvlBonus: 10, floor: 4, luck: 7.0,
    resources: { sucata: 5000, nucleo: 420, cristal: 18 }, buy: 240,
  },
];

export const CHEST_BY_ID = new Map(CHESTS.map((c) => [c.id, c]));

/**
 * Abates de patrulha por cápsula de bronze.
 *
 * Calibrado para ~7 minutos de patrulha no início. Um valor baixo demais faz o
 * jogador voltar de uma ausência curta com dezenas de baús na fila, o que
 * transforma a recompensa em tarefa.
 */
export const PATROL_CACHE_KILLS = 500;
