import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { CHAVE_POR_ID, CHAVES_DE_ACESSO } from '@data/chaves-de-acesso';
import { createState, migrate, SAVE_VERSION } from '@sim/state';
import { Sim } from '@sim/index';

describe('chaves de acesso', () => {
  it('mantém uma chave exclusiva para cada galáxia e chefe', () => {
    expect(CHAVES_DE_ACESSO).toHaveLength(BOSSES.length);
    expect(new Set(CHAVES_DE_ACESSO.map((c) => c.id)).size).toBe(BOSSES.length);
    CHAVES_DE_ACESSO.forEach((chave, galaxia) => {
      expect(chave.galaxia).toBe(galaxia);
      expect(chave.bossId).toBe(BOSSES[galaxia]!.id);
      expect(CHAVE_POR_ID.get(chave.id)).toBe(chave);
      expect(chave.arte).toMatch(/^chaves\/chave-/);
    });
  });

  it('guarda chaves fora do inventário e migra dados inválidos', () => {
    const state = createState();
    expect(state.inventory).toHaveLength(0);
    expect(state.chavesAcesso).toEqual({});
    const migrated = migrate({ ...state, version: SAVE_VERSION - 1, chavesAcesso: { [CHAVES_DE_ACESSO[0]!.id]: 3, fantasma: 99 }, chavesAcessoGarantidas: [0, 0, -1, 999] });
    expect(migrated?.chavesAcesso).toEqual({ [CHAVES_DE_ACESSO[0]!.id]: 3 });
    expect(migrated?.chavesAcessoGarantidas).toEqual([0]);
  });

  it('consome apenas a chave da própria galáxia por tentativa', () => {
    const state = createState();
    const chave = CHAVES_DE_ACESSO[0]!;
    state.chavesAcesso[chave.id] = 1;
    const sim = new Sim(state);
    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.prepararAcessoAoChefe(BOSSES[1]!.id)).toBe(false);
  });

  it('pede confirmação antes de avançar para o setor do chefe', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/ui/Shell.ts', import.meta.url), 'utf8'));
    expect(source).toContain('boss:access-requested');
    expect(source).toContain('Você possui ${quantidade}');
  });
});
