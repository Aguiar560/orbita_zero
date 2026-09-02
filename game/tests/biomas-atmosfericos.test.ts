import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIOMAS_ATMOSFERICOS, biomaAtmosfericoDaGalaxia } from '@data/biomas-atmosfericos';
import { describeGalaxy } from '@data/galaxies';

describe('biomas atmosféricos da campanha', () => {
  it('promove cada arte longa para uma única galáxia', () => {
    expect(BIOMAS_ATMOSFERICOS).toHaveLength(6);
    expect(BIOMAS_ATMOSFERICOS.map((bioma) => bioma.galaxia)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(BIOMAS_ATMOSFERICOS.map((bioma) => bioma.galaxia)).size).toBe(6);
    expect(new Set(BIOMAS_ATMOSFERICOS.map((bioma) => bioma.src)).size).toBe(6);

    for (const bioma of BIOMAS_ATMOSFERICOS) {
      expect(biomaAtmosfericoDaGalaxia(bioma.galaxia)).toBe(bioma);
      expect(existsSync(new URL(`../public/assets/${bioma.src}`, import.meta.url)), bioma.src).toBe(true);
    }
  });

  it('as 30 galáxias não repetem o mesmo arquivo de fundo', () => {
    const fundos = Array.from({ length: 30 }, (_, galaxia) => {
      const info = describeGalaxy(galaxia);
      return biomaAtmosfericoDaGalaxia(galaxia)?.src ?? info.fundoId ?? info.backdrop;
    });

    expect(new Set(fundos).size).toBe(fundos.length);
  });
});
