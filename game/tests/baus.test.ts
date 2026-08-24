import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { CHESTS } from '@data/chests';
import { rollChestRarity } from '@sim/loot';

describe('distribuições próprias dos baús', () => {
  it('cada tabela tem sete probabilidades válidas que somam 100%', () => {
    for (const chest of CHESTS) {
      expect(chest.raridades).toHaveLength(7);
      expect(chest.raridades.every((p) => p >= 0 && p <= 1), chest.id).toBe(true);
      expect(chest.raridades.reduce((sum, p) => sum + p, 0), chest.id).toBeCloseTo(1, 12);
      expect('luck' in chest, chest.id).toBe(false);
      expect('floor' in chest, chest.id).toBe(false);
    }
  });

  it('o baú mais caro mantém Divino além de um em cem mil', () => {
    for (const chest of CHESTS) {
      expect(chest.raridades[6], chest.id).toBeLessThanOrEqual(1 / 100_000);
    }
  });

  it('200 mil sorteios reproduzem os percentuais anunciados', () => {
    const N = 200_000;
    for (const [index, chest] of CHESTS.entries()) {
      const rng = new Rng(0xba0000 + index);
      const counts = Array.from({ length: 7 }, () => 0);
      for (let i = 0; i < N; i++) counts[rollChestRarity(rng, chest)]!++;

      for (let rarity = 0; rarity < 7; rarity++) {
        const measured = counts[rarity]! / N;
        const expected = chest.raridades[rarity]!;
        expect(Math.abs(measured - expected), `${chest.id} raridade ${rarity}`).toBeLessThan(0.01);
      }
    }
  });
});
