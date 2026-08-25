import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { ALL_ENEMIES } from '@data/enemies';
import { ELEMENTS } from '@data/elements';
import { HULLS } from '@data/hulls';
import { ITEM_BASES } from '@data/items';
import { RECURSOS } from '@data/recursos';

describe('cobertura do Códex', () => {
  it('cobre todos os catálogos vivos do jogo', () => {
    expect(BOSSES).toHaveLength(30);
    expect(ALL_ENEMIES).toHaveLength(68);
    expect(HULLS).toHaveLength(53);
    expect(ITEM_BASES).toHaveLength(80);
    expect(RECURSOS).toHaveLength(70);
    expect(ELEMENTS).toHaveLength(6);
  });

  it('não perde elites, fontes de recurso nem relações elementais', () => {
    expect(ALL_ENEMIES.some((enemy) => enemy.elite)).toBe(true);
    expect(RECURSOS.every((resource) => resource.drop.trim().length > 0)).toBe(true);
    expect(ELEMENTS.filter((element) => element.bate).length).toBe(5);
  });
});
