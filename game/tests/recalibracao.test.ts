import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { recalibrationCost } from '@data/balance/recalibracao';
import { recalibrationCandidates, rollItem } from '@sim/loot';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

function prepared(seed = 1): Sim {
  const state = createState(seed);
  state.command.nivel = 100;
  state.universe.bestSector = 100;
  state.universe.bestSectorEver = 100;
  state.resources = { sucata: 1_000_000, nucleo: 1_000_000, cristal: 10_000 };
  return new Sim(state);
}

describe('Bancada de Afixos', () => {
  it('expõe somente destinos compatíveis e diferentes da linha atual', () => {
    const item = rollItem(new Rng(4321), 80, 0, 0, { exata: 3, slot: 'principal' });
    const atual = item.affixes[0]!;
    const candidatos = recalibrationCandidates(item, 0);
    expect(candidatos.length).toBeGreaterThan(0);
    expect(candidatos.some((def) => def.id === atual.id)).toBe(false);
  });

  it('troca a identidade e preserva raridade, ilvl, elemento, conjunto e tier', () => {
    const sim = prepared(8);
    const item = rollItem(new Rng(8128), 80, 0, 0, { exata: 3, slot: 'principal' });
    sim.state.inventory.push(item);
    const index = 0;
    const original = item.affixes[index]!;
    const snapshot = {
      rarity: item.rarity, ilvl: item.ilvl, element: item.element,
      set: item.set, baseId: item.baseId, tier: original.tier,
    };
    const cost = recalibrationCost(item);
    const before = sim.state.resources.nucleo;

    const rolled = sim.recalibrateItemAffix(item.uid, index);
    expect(rolled).not.toBeNull();
    expect(rolled!.id).not.toBe(original.id);
    expect(rolled!.tier).toBe(snapshot.tier);
    expect({
      rarity: item.rarity, ilvl: item.ilvl, element: item.element,
      set: item.set, baseId: item.baseId, tier: item.affixes[index]!.tier,
    }).toEqual(snapshot);
    expect(new Set(item.affixes.map((a) => a.id)).size).toBe(item.affixes.length);
    expect(sim.state.resources.nucleo).toBe(before - cost);
  });

  it('recusa sem núcleos e não toca na linha', () => {
    const sim = prepared(9);
    const item = rollItem(new Rng(99), 50, 0, 0, { exata: 2, slot: 'escudo' });
    sim.state.inventory.push(item);
    sim.state.resources.nucleo = 0;
    const before = { ...item.affixes[0]! };
    expect(sim.recalibrateItemAffix(item.uid, 0)).toBeNull();
    expect(item.affixes[0]).toEqual(before);
  });
});
