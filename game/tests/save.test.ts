import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { SAVE_VERSION, createState, exportSave, importSave, migrate } from '@sim/state';
import { SPACESHIPS2_HULLS } from '@data/hulls-spaceships2';
import type { GameState } from '@sim/types';

/**
 * ESCOPO DESTA SUÍTE, durante o desenvolvimento.
 *
 * A migração é contrato de lançamento: uma atualização não pode apagar uma
 * frota, nem fazer o jogo deixar de abrir por causa de uma preferência nova.
 */

describe('o boot sobrevive a qualquer entrada', () => {
  it('recusa entrada que não é save, sem lançar exceção', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(undefined)).toBeNull();
    expect(migrate('lixo')).toBeNull();
    expect(migrate(42)).toBeNull();
    expect(migrate([])).toBeNull();
    expect(migrate({})).toBeNull();
  });

  it('recusa save de versão futura — não há como adivinhar os campos', () => {
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
  });

  it('aceita um save mínimo e preenche o resto', () => {
    const s = migrate({ version: SAVE_VERSION });
    expect(s).not.toBeNull();
    for (const chave of [
      'resources', 'lifetime', 'run', 'bar', 'universe',
      'stats', 'settings', 'shop', 'command', 'chests',
    ] as const) {
      expect(s![chave], chave).toBeDefined();
    }
    expect(Array.isArray(s!.inventory)).toBe(true);
    expect(Array.isArray(s!.fleet)).toBe(true);
    expect(Array.isArray(s!.codex)).toBe(true);
  });

  it('ignora campos de sistemas removidos sem quebrar', () => {
    // `upgrades` era o sistema de Melhorias (§31). Saves antigos ainda o
    // carregam; o carregamento não pode se importar com isso.
    const s = migrate({ version: SAVE_VERSION, upgrades: { dano: 50, vida: 30 } });
    expect(s).not.toBeNull();
    expect(s!.run.sector).toBeGreaterThanOrEqual(1);
  });
});

describe('normalização de save adulterado', () => {
  it('migra v3 para a versão atual preservando progresso e adotando preferências seguras', () => {
    const s = migrate({
      version: 3,
      hull: 'batedor', fleet: ['batedor'],
      resources: { sucata: 321, nucleo: 45, cristal: 6 },
      settings: { controlMode: 'qualquer_coisa' },
    } as unknown)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.resources).toMatchObject({ sucata: 321, nucleo: 45, cristal: 6 });
    expect(s.settings.controlMode).toBe('idle');
    expect(s.settings.highContrast).toBe(false);
    expect(s.settings.pinnedMissions).toEqual([]);
  });

  it('mantém somente missões rastreáveis e no máximo quatro atalhos', () => {
    const s = migrate({
      version: SAVE_VERSION,
      settings: { pinnedMissions: ['elim_primeiros', 'nao-existe', 'elim_primeiros', 'elim_chefes', 'elim_fogo', 'coleta_ferrita'] },
    } as unknown)!;
    expect(s.settings.pinnedMissions).not.toContain('nao-existe');
    expect(s.settings.pinnedMissions).toContain('elim_primeiros');
    expect(new Set(s.settings.pinnedMissions).size).toBe(s.settings.pinnedMissions.length);
    expect(s.settings.pinnedMissions.length).toBeLessThanOrEqual(4);
  });

  it('ainda aceita o formato v1 e conserva recursos e setor conquistado', () => {
    const s = migrate({
      version: 1, hull: 'batedor', fleet: ['batedor'],
      resources: { sucata: 900, nucleo: 80, cristal: 7 },
      lifetime: { sucata: 1000, nucleo: 90, cristal: 8 },
      run: { sector: 12, wave: 2 },
    } as unknown)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.resources.sucata).toBe(900);
    expect(s.run.sector).toBe(12);
    expect(s.settings.controlMode).toBe('idle');
  });

  it('mantém somente cascos conhecidos e preferências válidas', () => {
    const s = migrate({
      version: SAVE_VERSION,
      fleet: ['batedor', 'nao-existe'], hull: 'nao-existe',
      settings: { controlMode: 'manual', pilot: 'invalido' },
    } as unknown)!;
    expect(s.fleet).not.toContain('nao-existe');
    expect(s.fleet).toContain(s.hull);
    expect(s.settings.controlMode).toBe('manual');
    expect(s.settings.pilot).toBe('evasivo');
  });

  /**
   * A frota inicial deixou de conter os 29.
   *
   * Este teste guardava o contrário: enquanto os Spaceships 2.0 eram arte em
   * teste, com custo 0 e `requiresSector` 0, TODOS entravam na frota de quem
   * começava o jogo. Medido, isso deixava 14 dos 20 cascos legados obsoletos no
   * minuto zero — o melhor grátis marcava nota 918 contra 85 do inicial.
   *
   * Com a escada de aquisição, eles são comprados. A regra de
   * `INITIAL_FLEET` nem precisou mudar: custo e setor bastam para excluí-los.
   */
  it('a frota inicial não contém casco da escada de aquisição', () => {
    const nova = createState(2026);
    const antiga = migrate({ version: SAVE_VERSION, fleet: ['batedor'], hull: 'batedor' })!;
    for (const hull of SPACESHIPS2_HULLS) {
      expect(nova.fleet, `nova: ${hull.id}`).not.toContain(hull.id);
      expect(antiga.fleet, `migrada: ${hull.id}`).not.toContain(hull.id);
    }
    // E sobra frota jogável: o save novo precisa de nave para voar.
    expect(nova.fleet.length).toBeGreaterThan(0);
    expect(nova.fleet).toContain(nova.hull);
  });

  it('conserta setor e onda fora de faixa', () => {
    const s = migrate({ version: SAVE_VERSION, run: { sector: -50, wave: 9999 } })!;
    expect(s.run.sector).toBeGreaterThanOrEqual(1);
    expect(s.run.wave).toBeGreaterThanOrEqual(1);
    expect(s.run.wave).toBeLessThanOrEqual(6);
  });

  it('conserta nível de comando fracionário ou negativo', () => {
    const s = migrate({
      version: SAVE_VERSION,
      command: { nivel: -3.7, xp: 0, allocated: [], refunds: 0 },
    })!;
    expect(Number.isInteger(s.command.nivel)).toBe(true);
    expect(s.command.nivel).toBeGreaterThanOrEqual(1);
  });

  it('descarta nós de matriz que não são texto', () => {
    const s = migrate({
      version: SAVE_VERSION,
      command: { nivel: 5, xp: 0, allocated: ['no_valido', 42, null, { a: 1 }], refunds: 0 },
    } as unknown)!;
    expect(s.command.allocated).toEqual(['no_valido']);
  });

  it('conserta casco ativo que não está na frota', () => {
    const s = migrate({ version: SAVE_VERSION, hull: 'casco_que_nao_existe' })!;
    expect(s.fleet).toContain(s.hull);
    expect(s.fleet.length).toBeGreaterThan(0);
  });

  it('o recorde de setor nunca fica abaixo do setor atual', () => {
    const s = migrate({
      version: SAVE_VERSION,
      run: { sector: 80 },
      universe: { bestSector: 3, bestSectorEver: 1 },
    } as unknown)!;
    expect(s.universe.bestSector).toBeGreaterThanOrEqual(80);
    expect(s.universe.bestSectorEver).toBeGreaterThanOrEqual(80);
  });
});

/**
 * Exportar e importar precisa ser reversível mesmo em desenvolvimento: é como
 * um estado de teste é levado de uma máquina para outra.
 */
describe('exportar e importar', () => {
  it('a viagem de ida e volta preserva o progresso', () => {
    const original = createState(2024);
    original.run.sector = 47;
    original.resources.sucata = 123456;
    original.command.nivel = 18;
    original.inventory = [rollItem(new Rng(8), 30, 0.4, 0)];

    const voltou = importSave(exportSave(original)) as GameState;
    expect(voltou).not.toBeNull();
    expect(voltou.run.sector).toBe(47);
    expect(voltou.resources.sucata).toBe(123456);
    expect(voltou.command.nivel).toBe(18);
    expect(voltou.inventory).toHaveLength(1);
    expect(voltou.inventory[0]!.uid).toBe(original.inventory[0]!.uid);
  });

  it('importar texto inválido devolve null em vez de explodir', () => {
    expect(importSave('não é save')).toBeNull();
    expect(importSave('')).toBeNull();
    expect(importSave('{"version":999}')).toBeNull();
  });
});

describe('a postura equilibrada foi removida', () => {
  /**
   * Ela dominava o coletor em dois dos três eixos da política e não era
   * extrema em nenhum. Uma opção assim não se escolhe, se aceita — e
   * absorvia a decisão inteira.
   */
  it('save que a usava cai no evasivo, e não no padrão de save novo', () => {
    const st = createState(11);
    const settings = { ...st.settings, pilot: 'equilibrado' } as Record<string, unknown>;
    const m = migrate({ ...st, settings })!;
    expect(m.settings.pilot).toBe('evasivo');
  });

  it('save novo nasce agressivo — o padrão e a migração são decisões diferentes', () => {
    expect(createState(11).settings.pilot).toBe('agressivo');
  });

  it('as três posturas restantes sobrevivem à normalização', () => {
    for (const p of ['agressivo', 'evasivo', 'coletor'] as const) {
      const st = createState(11);
      st.settings.pilot = p;
      expect(migrate({ ...st })!.settings.pilot).toBe(p);
    }
  });
});
