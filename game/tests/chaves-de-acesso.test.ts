import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { CHANCES_DROP_CHAVE_POR_FASE, CHAVE_POR_ID, CHAVES_DE_ACESSO, chanceDropChavePorAbate } from '@data/chaves-de-acesso';
import { createState, migrate, SAVE_VERSION } from '@sim/state';
import { Sim } from '@sim/index';
import { WAVES_PER_SECTOR } from '@sim/progression';

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

  it('segura o avanço do setor anterior até confirmar a chave', () => {
    const state = createState();
    const chave = CHAVES_DE_ACESSO[0]!;
    state.run.sector = 9;
    state.run.wave = WAVES_PER_SECTOR + 1;
    state.chavesAcesso[chave.id] = 1;
    const sim = new Sim(state);

    sim.completeEncounter();
    expect(sim.state.run.sector).toBe(9);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(1); // concluir não concede chave diretamente

    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
  });

  it('materializa a garantia como cápsula física no último abate', () => {
    const state = createState();
    const sim = new Sim(state);
    const drop = sim.rollChaveDuranteAbate(9, true);

    expect(drop?.garantida).toBe(true);
    expect(drop?.chave.id).toBe(CHAVES_DE_ACESSO[0]!.id);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);

    sim.adquirirChave(drop!.chave.id, 9, drop!.garantida);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(1);
    expect(state.chavesAcessoGarantidas).toEqual([0]);
  });

  it('aumenta progressivamente a chance do primeiro ao nono setor de toda galáxia', () => {
    expect(CHANCES_DROP_CHAVE_POR_FASE).toHaveLength(9);
    expect(chanceDropChavePorAbate(0)).toBe(0);
    expect(chanceDropChavePorAbate(10)).toBe(0);
    for (let fase = 2; fase <= 9; fase++) {
      expect(chanceDropChavePorAbate(fase)).toBeGreaterThan(chanceDropChavePorAbate(fase - 1));
    }
    expect(chanceDropChavePorAbate(1)).toBe(0.001);
    expect(chanceDropChavePorAbate(9)).toBe(0.01);
  });
});
