import { describe, expect, it } from 'vitest';
import { getElement } from '@data/elements';
import { HULLS, HULL_BY_ID } from '@data/hulls';
import {
  HULL_ARCHETYPES,
  HULL_TUNINGS,
  HULL_WEAPONS,
  SPACESHIPS2_HULLS,
  SPACESHIPS2_HULL_SPECS,
  SPACESHIPS2_HULL_SPEC_BY_ID,
} from '@data/hulls-spaceships2';
import { SPACESHIPS2_LEGACY_PLAYER_ART, SPACESHIPS2_PLAYER_ART } from '@data/spaceships2';

const attack = (hull: (typeof SPACESHIPS2_HULLS)[number]): number => {
  const stats = hull.stats;
  return (stats.dano ?? 0) * (stats.cadencia ?? 0) * Math.max(1, stats.projeteis ?? 1)
    * (1 + (stats.critChance ?? 0) * (stats.critDano ?? 0));
};

const defense = (hull: (typeof SPACESHIPS2_HULLS)[number]): number =>
  (hull.stats.vida ?? 0) + (hull.stats.escudo ?? 0) * 1.1 + (hull.stats.regen ?? 0) * 18;

describe('catálogo de cascos Spaceships 2.0', () => {
  it('transforma cada uma das 29 artes de jogador em exatamente um casco', () => {
    const art = [...SPACESHIPS2_PLAYER_ART, ...SPACESHIPS2_LEGACY_PLAYER_ART];
    expect(art).toHaveLength(29);
    expect(SPACESHIPS2_HULL_SPECS).toHaveLength(29);
    expect(SPACESHIPS2_HULLS).toHaveLength(29);
    expect(HULLS).toHaveLength(49);
    expect(new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.artId)))
      .toEqual(new Set(art.map((entry) => entry.id)));
  });

  it('usa ids, nomes, sprites e fichas únicas e mantém o Bastião 8 compatível', () => {
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.id)).size).toBe(29);
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.name)).size).toBe(29);
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.sprite)).size).toBe(29);
    expect(new Set(HULLS.map((hull) => hull.id)).size).toBe(HULLS.length);
    for (const hull of SPACESHIPS2_HULLS) {
      expect(hull.id).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(HULL_BY_ID.get(hull.id)).toBe(hull);
      expect(SPACESHIPS2_HULL_SPEC_BY_ID.get(hull.id)?.name).toBe(hull.name);
    }
    expect(HULL_BY_ID.get('bastiao_8')?.sprite).toBe('s2/player/p_11');
  });

  it('libera os 29 cascos para Hangar e campanha sem antecipar o sistema de desbloqueio', () => {
    for (const hull of SPACESHIPS2_HULLS) {
      expect(hull.tier).toBe(4);
      expect(hull.cost).toBe(0);
      expect(hull.requiresSector).toBe(0);
      expect(hull.prototype).not.toBe(true);
    }
  });

  it('liga elemento, projétil, cor e rastro na mesma identidade visual', () => {
    for (const hull of SPACESHIPS2_HULLS) {
      const element = getElement(hull.element);
      expect(element.bullet).toContain(hull.shot.sprite);
      expect(hull.shot.color).toBe(element.color);
      expect(hull.trail).toBe(element.glow);
      expect(hull.shot.speed).toBeGreaterThanOrEqual(600);
      expect(hull.shot.speed).toBeLessThanOrEqual(1200);
    }
  });

  it('usa todos os arquétipos, ajustes e armamentos cadastrados', () => {
    const archetypes = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.archetype));
    const tunings = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.tuning));
    const weapons = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.weapon));
    for (const entry of HULL_ARCHETYPES) expect(archetypes.has(entry.id), entry.id).toBe(true);
    for (const entry of HULL_TUNINGS) expect(tunings.has(entry.id), entry.id).toBe(true);
    for (const entry of HULL_WEAPONS) expect(weapons.has(entry.id), entry.id).toBe(true);
  });

  it('dá custo mecânico próprio a cada família de tiro', () => {
    for (const weapon of HULL_WEAPONS) {
      expect(weapon.damageMul, `${weapon.id}: dano`).toBeGreaterThan(0);
      expect(weapon.cadenceMul, `${weapon.id}: cadência`).toBeGreaterThan(0);
      expect(weapon.spread, `${weapon.id}: dispersão`).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(HULL_WEAPONS.map((weapon) => `${weapon.damageMul}:${weapon.cadenceMul}`)).size)
      .toBe(HULL_WEAPONS.length);
  });

  it('fica numa única faixa de poder, com extremos pagos por outro eixo', () => {
    const attacks = SPACESHIPS2_HULLS.map(attack);
    const defenses = SPACESHIPS2_HULLS.map(defense);
    const speeds = SPACESHIPS2_HULLS.map((hull) => hull.stats.velocidade ?? 0);
    // O orçamento ofensivo admite especialização, mas continua muito aquém de
    // uma escada vertical. A prova real está na bateria dos três cenários.
    expect(Math.max(...attacks) / Math.min(...attacks)).toBeLessThan(2.45);
    expect(Math.max(...defenses) / Math.min(...defenses)).toBeLessThan(4.5);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(2.5);
  });
});
