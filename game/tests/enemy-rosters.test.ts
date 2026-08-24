import { describe, expect, it } from 'vitest';
import {
  ALL_ENEMIES,
  ENEMY_BY_ID,
  GALAXY_ENEMY_ROSTERS,
  enemiesForSector,
  enemyRosterForGalaxy,
} from '@data/enemies';
import {
  SPACESHIPS2_ELITE_ENEMIES,
  SPACESHIPS2_ENEMIES,
  SPACESHIPS2_REGULAR_ENEMIES,
} from '@data/enemies-spaceships2';
import { ELEMENT_IDS } from '@sim/types';

const intersection = (a: readonly string[], b: readonly string[]): number => {
  const right = new Set(b);
  return a.filter((id) => right.has(id)).length;
};

describe('inimigos Spaceships 2.0', () => {
  it('transforma as 26 artes em vinte inimigos comuns e seis elites', () => {
    expect(SPACESHIPS2_ENEMIES).toHaveLength(26);
    expect(SPACESHIPS2_REGULAR_ENEMIES).toHaveLength(20);
    expect(SPACESHIPS2_ELITE_ENEMIES).toHaveLength(6);
    expect(ALL_ENEMIES).toHaveLength(68);
  });

  it('usa ids autorais estáveis e sprites distintos que existem no novo atlas', () => {
    expect(new Set(SPACESHIPS2_ENEMIES.map((enemy) => enemy.id)).size).toBe(26);
    expect(new Set(SPACESHIPS2_ENEMIES.map((enemy) => enemy.sprite)).size).toBe(26);
    for (const enemy of SPACESHIPS2_ENEMIES) {
      expect(enemy.id).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(enemy.id).not.toMatch(/download|spaceship|enemy_\d/);
      expect(enemy.sprite).toMatch(/^s2\/enemy\//);
      expect(ENEMY_BY_ID.get(enemy.id)).toBe(enemy);
    }
  });

  it('tem ficha de combate completa e números válidos', () => {
    for (const enemy of SPACESHIPS2_ENEMIES) {
      expect(ELEMENT_IDS).toContain(enemy.element);
      expect(enemy.tags).toContain('spaceships_2');
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.dano).toBeGreaterThan(0);
      expect(enemy.reward).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.radius).toBeGreaterThan(0);
      expect(enemy.scale).toBeGreaterThan(0);
      expect(enemy.bulletSpeed).toBeGreaterThan(0);
      expect(enemy.shots).toBeGreaterThan(0);
    }
  });
});

describe('elencos das trinta galáxias', () => {
  it('entrega seis inimigos comuns e três elites em toda galáxia', () => {
    expect(GALAXY_ENEMY_ROSTERS).toHaveLength(30);
    for (const roster of GALAXY_ENEMY_ROSTERS) {
      expect(roster.regular, `galáxia ${roster.galaxy}`).toHaveLength(6);
      expect(roster.elite, `galáxia ${roster.galaxy}`).toHaveLength(3);
      expect(new Set(roster.regular).size).toBe(roster.regular.length);
      expect(new Set(roster.elite).size).toBe(roster.elite.length);
      for (const id of roster.regular) expect(ENEMY_BY_ID.get(id)?.elite, id).not.toBe(true);
      for (const id of roster.elite) expect(ENEMY_BY_ID.get(id)?.elite, id).toBe(true);
    }
  });

  it('galáxias vizinhas nunca compartilham a maioria do elenco', () => {
    for (let index = 0; index < GALAXY_ENEMY_ROSTERS.length - 1; index++) {
      const current = GALAXY_ENEMY_ROSTERS[index]!;
      const next = GALAXY_ENEMY_ROSTERS[index + 1]!;
      expect(intersection(current.regular, next.regular), `${current.galaxy}→${next.galaxy} comuns`)
        .toBeLessThanOrEqual(Math.floor(current.regular.length / 2));
      expect(intersection(current.elite, next.elite), `${current.galaxy}→${next.galaxy} elites`)
        .toBeLessThanOrEqual(Math.floor(current.elite.length / 2));
    }
  });

  it('coloca todas as 26 naves novas em circulação', () => {
    const used = new Set(GALAXY_ENEMY_ROSTERS.flatMap((roster) => [...roster.regular, ...roster.elite]));
    for (const enemy of SPACESHIPS2_ENEMIES) expect(used.has(enemy.id), enemy.id).toBe(true);
  });

  it('mantém o elenco durante as dez fases e cicla depois da galáxia 30', () => {
    for (let galaxy = 0; galaxy < 30; galaxy++) {
      const expected = enemyRosterForGalaxy(galaxy, false).map((enemy) => enemy.id);
      for (let phase = 1; phase <= 10; phase++) {
        expect(enemiesForSector(galaxy * 10 + phase, false).map((enemy) => enemy.id)).toEqual(expected);
      }
    }
    expect(enemyRosterForGalaxy(30, false).map((enemy) => enemy.id))
      .toEqual(enemyRosterForGalaxy(0, false).map((enemy) => enemy.id));
  });
});
