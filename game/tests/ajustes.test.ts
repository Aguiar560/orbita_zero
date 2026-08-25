import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createState, migrate } from '@sim/state';

/**
 * O que estes testes protegem é o silêncio de uma preferência.
 *
 * Ajuste é a única parte do jogo em que estar errado NÃO dá erro: um campo que
 * volta ao padrão na migração, ou um volume que sai de 0..1, não quebra nada —
 * só desfaz, sem avisar, o que o jogador pediu. É por isso que a migração de
 * ajuste merece teste mais do que a de progresso, que ao menos aparece.
 */

describe('ajustes novos', () => {
  it('nascem ligados: quem não sabe que existem não perde nada', () => {
    const s = createState(11).settings;
    expect(s.mostrarEscudo).toBe(true);
    expect(s.tremorDeTela).toBe(true);
  });

  it('save antigo ganha os campos LIGADOS, e não desligados', () => {
    // Um save de antes destes ajustes não os menciona. Se a migração os
    // preenchesse com `false`, o jogador voltaria com o escudo invisível e o
    // tremor morto sem ter pedido — e sem ter como adivinhar o porquê.
    const antigo = { ...createState(11), version: 8 } as Record<string, unknown>;
    const settings = { ...(antigo.settings as object) } as Record<string, unknown>;
    delete settings.mostrarEscudo;
    delete settings.tremorDeTela;
    antigo.settings = settings;

    const m = migrate(antigo)!;
    expect(m.settings.mostrarEscudo).toBe(true);
    expect(m.settings.tremorDeTela).toBe(true);
  });

  it('preserva a escolha de quem desligou', () => {
    const st = createState(11);
    st.settings.mostrarEscudo = false;
    st.settings.tremorDeTela = false;
    const m = migrate({ ...st, version: SAVE_VERSION })!;
    expect(m.settings.mostrarEscudo).toBe(false);
    expect(m.settings.tremorDeTela).toBe(false);
  });
});

describe('volumes de áudio', () => {
  it('existem no save mesmo sem som no jogo', () => {
    const s = createState(11).settings;
    for (const v of [s.volumeMestre, s.volumeMusica, s.volumeEfeitos]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ficam presos entre 0 e 1 — estouro de amplitude é caro de descobrir', () => {
    const st = createState(11);
    st.settings.volumeMestre = 9;
    st.settings.volumeMusica = -3;
    const m = migrate({ ...st, version: SAVE_VERSION })!;
    expect(m.settings.volumeMestre).toBe(1);
    expect(m.settings.volumeMusica).toBe(0);
  });

  it('valor corrompido vira o padrão, não NaN', () => {
    const st = createState(11);
    (st.settings as Record<string, unknown>).volumeEfeitos = 'alto';
    const m = migrate({ ...st, version: SAVE_VERSION })!;
    expect(Number.isFinite(m.settings.volumeEfeitos)).toBe(true);
    expect(m.settings.volumeEfeitos).toBe(0.8);
  });
});

describe('limpeza', () => {
  it('barVisible saiu — era campo morto da faixa horizontal removida', () => {
    const s = createState(11).settings as Record<string, unknown>;
    expect('barVisible' in s).toBe(false);
  });

  it('e um save que ainda o traz não trava nem o ressuscita', () => {
    const st = createState(11);
    const settings = { ...st.settings, barVisible: true } as Record<string, unknown>;
    const m = migrate({ ...st, settings, version: 8 });
    expect(m).not.toBeNull();
    expect(m!.settings.mostrarEscudo).toBe(true);
  });
});
