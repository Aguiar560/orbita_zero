import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { SAVE_VERSION, createState, exportSave, importSave, migrate } from '@sim/state';
import type { GameState } from '@sim/types';

/**
 * ESCOPO DESTA SUÍTE, durante o desenvolvimento.
 *
 * Compatibilidade entre versões de save NÃO é restrição agora: o esquema vai
 * mudar muitas vezes até a Fase 4 e o save será zerado junto, de propósito.
 * Testar migração v1→v4 hoje só criaria atrito — cada mudança de campo
 * quebraria testes que ninguém quer manter.
 *
 * O que continua valendo é mais estreito e mais importante: **um save
 * malformado não pode travar o boot**. Isso vale em qualquer fase, porque o
 * sintoma é o jogo não abrir, e o custo de garantir é quase zero.
 *
 * Antes do lançamento isto volta a crescer, e aí o `save-migration-reviewer`
 * entra em cena. Até lá ele fica dormente.
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
      'stats', 'settings', 'shop', 'command', 'chests', 'equipped',
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
