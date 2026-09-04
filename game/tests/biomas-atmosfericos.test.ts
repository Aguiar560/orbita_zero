import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIOMAS_ATMOSFERICOS, BIOMAS_ATMOSFERICOS_DE_TESTE, biomaAtmosfericoDaGalaxia } from '@data/biomas-atmosfericos';
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

describe('prévias de biomas no modo de teste', () => {
  it('reserva cinco artes diferentes para as galáxias 6–10', () => {
    expect(BIOMAS_ATMOSFERICOS_DE_TESTE.map((bioma) => bioma.galaxia)).toEqual([5, 6, 7, 8, 9]);
    expect(BIOMAS_ATMOSFERICOS_DE_TESTE.map((bioma) => bioma.id)).toEqual([
      'bosque-fotonico', 'necropole-mecanica', 'tempestade-de-ambar', 'recife-carmesim', 'mar-de-regolito',
    ]);
    expect(new Set(BIOMAS_ATMOSFERICOS_DE_TESTE.map((bioma) => bioma.src)).size).toBe(5);
    for (const bioma of BIOMAS_ATMOSFERICOS_DE_TESTE) {
      expect(biomaAtmosfericoDaGalaxia(bioma.galaxia, true)).toBe(bioma);
      const servido = readFileSync(new URL(`../public/assets/${bioma.src}`, import.meta.url));
      const permanente = readFileSync(new URL(`../assets-static/${bioma.src}`, import.meta.url));
      expect(servido.equals(permanente), bioma.src).toBe(true);
    }
  });

  it('ao desligar o teste, restaura os fundos da campanha sem alterar o catálogo', () => {
    for (let galaxia = 0; galaxia < 30; galaxia++) {
      const original = BIOMAS_ATMOSFERICOS.find((bioma) => bioma.galaxia === galaxia) ?? null;
      biomaAtmosfericoDaGalaxia(galaxia, true);
      expect(biomaAtmosfericoDaGalaxia(galaxia, false)).toBe(original);
      expect(biomaAtmosfericoDaGalaxia(galaxia)).toBe(original);
      if (galaxia < 5 || galaxia > 9) expect(biomaAtmosfericoDaGalaxia(galaxia, true)).toBe(original);
    }
    expect(biomaAtmosfericoDaGalaxia(5)?.id).toBe('cristalina');
  });

  it('mantém fundos únicos entre as 30 galáxias também em teste', () => {
    const fundos = Array.from({ length: 30 }, (_, galaxia) => {
      const info = describeGalaxy(galaxia);
      return biomaAtmosfericoDaGalaxia(galaxia, true)?.src ?? info.fundoId ?? info.backdrop;
    });
    expect(new Set(fundos).size).toBe(30);
  });
});
