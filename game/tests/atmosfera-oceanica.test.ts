import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARTES_ATMOSFERA_OCEANICA, NUVENS_OCEANICAS, atmosferaOceanicaAtiva, passagemAtmosferica } from '@data/atmosfera-oceanica';

describe('atmosfera oceânica da campanha', () => {
  it('liga na galáxia 1 sem depender do teste, fora da Provação e do laboratório', () => {
    for (let galaxia = 0; galaxia < 30; galaxia++) {
      expect(atmosferaOceanicaAtiva(galaxia, false, false)).toBe(galaxia === 0);
      expect(atmosferaOceanicaAtiva(galaxia, true, false)).toBe(false);
      expect(atmosferaOceanicaAtiva(galaxia, false, true)).toBe(false);
    }
  });
  it('carrega apenas a nuvem aprovada, sem satélite', () => {
    expect(Object.keys(ARTES_ATMOSFERA_OCEANICA)).toEqual(['nuvem']);
  });
  it('conserva as artes na origem estática e no diretório servido', () => {
    for (const src of Object.values(ARTES_ATMOSFERA_OCEANICA)) {
      const original = new URL(`../assets-static/${src}`, import.meta.url);
      const servido = new URL(`../public/assets/${src}`, import.meta.url);
      expect(existsSync(original)).toBe(true);
      expect(readFileSync(original).equals(readFileSync(servido))).toBe(true);
    }
  });
  it('rolagem determinística desce e reentra fora da área visível', () => {
    expect(passagemAtmosferica(1, 30, .4, 960, 500) - passagemAtmosferica(0, 30, .4, 960, 500)).toBeCloseTo(30);
    for (const tempo of [0, 1, 100, 10000, -1]) {
      const y = passagemAtmosferica(tempo, 53, .2, 960, 500);
      expect(y).toBeGreaterThanOrEqual(-500);
      expect(y).toBeLessThan(1460);
      expect(passagemAtmosferica(tempo, 53, .2, 960, 500)).toBe(y);
    }
  });
  it('mantém velocidades crescentes e primeiro plano fora do corredor central', () => {
    const baixo = NUVENS_OCEANICAS.filter(n => n.plano === 'baixo');
    const medio = NUVENS_OCEANICAS.filter(n => n.plano === 'medio');
    const frente = NUVENS_OCEANICAS.filter(n => n.plano === 'frente');
    expect(Math.max(...baixo.map(n => n.velocidade))).toBeLessThan(Math.min(...medio.map(n => n.velocidade)));
    expect(Math.max(...medio.map(n => n.velocidade))).toBeLessThan(Math.min(...frente.map(n => n.velocidade)));
    for (const n of frente) {
      expect(n.x < 0 || n.x > 1).toBe(true);
      expect(n.alfa).toBeLessThanOrEqual(.22);
    }
  });
});
