import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES, bossForSector } from '@data/bosses';
import {
  ALL_SPACESHIPS2_ART,
  SPACESHIPS2_BOSS_ART,
  SPACESHIPS2_ENEMY_ART,
  SPACESHIPS2_LEGACY_PLAYER_ART,
  SPACESHIPS2_PLAYER_ART,
} from '@data/spaceships2';

describe('catálogo Spaceships 2.0', () => {
  it('cadastra todas as artes classificadas e as seis legadas', () => {
    expect(SPACESHIPS2_PLAYER_ART).toHaveLength(23);
    expect(SPACESHIPS2_ENEMY_ART).toHaveLength(26);
    expect(SPACESHIPS2_BOSS_ART).toHaveLength(50);
    expect(SPACESHIPS2_LEGACY_PLAYER_ART).toHaveLength(6);
    expect(ALL_SPACESHIPS2_ART).toHaveLength(105);
  });

  it('não repete ids nem sprites', () => {
    expect(new Set(ALL_SPACESHIPS2_ART.map((art) => art.id)).size).toBe(ALL_SPACESHIPS2_ART.length);
    expect(new Set(ALL_SPACESHIPS2_ART.map((art) => art.sprite)).size).toBe(ALL_SPACESHIPS2_ART.length);
  });

  it('todo sprite cadastrado existe no atlas gerado', () => {
    const atlas = JSON.parse(readFileSync(
      new URL('../public/assets/atlas/spaceships2.json', import.meta.url), 'utf8',
    )) as { frames: Record<string, unknown> };
    for (const art of ALL_SPACESHIPS2_ART) {
      expect(atlas.frames[art.sprite], art.sprite).toBeDefined();
    }
  });
});

describe('chefes das trinta galáxias', () => {
  it('tem um chefe autoral e uma arte válida por galáxia', () => {
    expect(BOSSES).toHaveLength(30);
    expect(new Set(BOSSES.map((boss) => boss.id)).size).toBe(30);
    expect(new Set(BOSSES.map((boss) => boss.sprite)).size).toBe(30);
    for (let galaxy = 1; galaxy <= 30; galaxy++) {
      expect(bossForSector(galaxy * 10)).toBe(BOSSES[galaxy - 1]);
    }
  });
});
