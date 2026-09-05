import { describe, expect, it } from 'vitest';
import { HULLS } from '@data/hulls';
import { ALL_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import { abrirDesafio, bossDoPiso } from '@sim/desafio';
import { perfilDaNave, perfilDoInimigo, perfilDoChefe, sintetizarDisparo, sintetizarExplosao } from '@render/SinteseSonora';
import type { ElementId } from '@sim/types';

const medir = (pcm: Float32Array) => {
  let pico = 0, energia = 0;
  for (const v of pcm) { pico = Math.max(pico, Math.abs(v)); energia += v * v; }
  return { pico, rms: Math.sqrt(energia / pcm.length) };
};

describe('matrizes sonoras', () => {
  it('cobre cada casco com PCM audível, finito e sem clipping', () => {
    const ids = new Set<string>();
    for (const nave of HULLS) {
      const perfil = perfilDaNave(nave);
      ids.add(perfil.id);
      const pcm = sintetizarDisparo(perfil);
      const { pico, rms } = medir(pcm);
      expect(pico, nave.id).toBeLessThan(1);
      expect(rms, nave.id).toBeGreaterThan(.02);
      expect(pcm[0]).toBe(0);
      expect(pcm.at(-1)).toBe(0);
      expect(perfil.duracao * perfil.cadencia, nave.id).toBeLessThanOrEqual(.8);
    }
    expect(ids.size).toBe(HULLS.length);
  });

  it('tem síntese determinística independente do RNG de combate', () => {
    const p = perfilDaNave(HULLS[0]);
    expect(sintetizarDisparo(p)).toEqual(sintetizarDisparo(p));
    expect(sintetizarDisparo(p)).not.toEqual(sintetizarDisparo(perfilDaNave(HULLS[1])));
  });

  it('cobre inimigos e cada estágio dos chefes de campanha e dos cem pisos', () => {
    const perfis = ALL_ENEMIES.filter(n => n.fireRate > 0).map(n => perfilDoInimigo(n));
    const chefes = [...BOSSES];
    for (let piso = 1; piso <= 100; piso++) {
      const d = abrirDesafio(piso);
      chefes.push(bossDoPiso(d.chefe, d.efeitos));
    }
    for (const chefe of chefes) chefe.phases.forEach((_, i) => perfis.push(perfilDoChefe(chefe, i)));
    for (const p of perfis) {
      expect(Number.isFinite(p.frequencia), p.id).toBe(true);
      expect(medir(sintetizarDisparo(p)).rms, p.id).toBeGreaterThan(.01);
    }
  });

  it('explosões têm cauda de destroços e margem abaixo de 0 dBFS', () => {
    for (const elemento of ['padrao', 'fogo', 'gelo', 'raio', 'cosmico', 'quimico'] as ElementId[]) {
      const pcm = sintetizarExplosao(elemento);
      expect(pcm.length).toBe(24000 * 2.4);
      expect(medir(pcm).pico).toBeLessThan(.85);
      expect(medir(pcm.slice(24000, 36000)).rms).toBeGreaterThan(.003);
      expect(medir(pcm.slice(0, 6000)).rms).toBeGreaterThan(medir(pcm.slice(24000)).rms);
      expect(pcm.at(-1)).toBe(0);
    }
  });
});
