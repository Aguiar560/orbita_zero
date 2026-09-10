import { describe, expect, it } from 'vitest';

import { CARGA_MAXIMA } from '@data/balance/capacidade';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

const peca = (uid: string, rarity: number, ilvl: number, favorite = false) => ({
  uid,
  baseId: 'b',
  slot: 'principal' as const,
  rarity,
  ilvl,
  affixes: [],
  icon: 'i',
  origin: 0,
  favorite,
});

describe('carga da conta de teste', () => {
  it('normaliza inventário local antigo para 70/70', () => {
    const sim = new Sim(createState(601));
    sim.state.inventory = Array.from({ length: 125 }, (_, i) => peca(`item-${i}`, i % 6, i));
    sim.state.inventory[3]!.favorite = true;

    expect(sim.cargoSlots).not.toBe(CARGA_MAXIMA);
    sim.setTestMode(true);

    expect(sim.cargoSlots).toBe(CARGA_MAXIMA);
    expect(sim.state.inventory).toHaveLength(CARGA_MAXIMA);
    expect(sim.state.inventory.some((item) => item.uid === 'item-3')).toBe(true);
  });

  it('não reduz o inventário de um jogador fora do modo de teste', () => {
    const sim = new Sim(createState(602));
    sim.state.inventory = Array.from({ length: 125 }, (_, i) => peca(`item-${i}`, 1, i));

    sim.setTestMode(false);

    expect(sim.state.inventory).toHaveLength(125);
  });
});
