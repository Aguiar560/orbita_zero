import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { SAVE_VERSION, createState, exportSave, importSave, migrate } from '@sim/state';
import type { GameState } from '@sim/types';

/**
 * A regra que não pode ser quebrada em nenhuma versão.
 *
 * Num idle, invalidar um save é apagar dias de progresso do jogador. O contrato
 * é: `migrate` APARA o que não existe mais e PREENCHE o que falta — nunca
 * devolve `null` por um save ser velho. A única recusa legítima é um save do
 * FUTURO, porque aí não há como adivinhar o significado dos campos.
 *
 * A Fase 1 vai mexer em atributos, raridades e níveis. Estes testes existem
 * para que essa mudança não passe por cima do progresso de ninguém.
 */
describe('migração nunca rejeita save antigo (§38)', () => {
  it('aceita save da versão 1, descartando o equipamento incompatível', () => {
    const antigo = { version: 1, resources: { sucata: 500 }, run: { sector: 12 } };
    const s = migrate(antigo);
    expect(s).not.toBeNull();
    expect(s!.version).toBe(SAVE_VERSION);
    expect(s!.resources.sucata).toBe(500);
    expect(s!.run.sector).toBe(12);
    // Os slots de v1 não existem mais; traduzir errado seria pior que descartar.
    expect(s!.inventory).toEqual([]);
  });

  it('aceita save da versão 2 preservando itens', () => {
    const item = rollItem(new Rng(3), 20, 0, 0);
    const s = migrate({ version: 2, inventory: [item], resources: { nucleo: 42 } });
    expect(s).not.toBeNull();
    expect(s!.inventory).toHaveLength(1);
    expect(s!.resources.nucleo).toBe(42);
  });

  it('aceita save da versão corrente sem alterar nada de essencial', () => {
    const original = createState(555);
    original.run.sector = 33;
    original.resources.cristal = 999;
    const s = migrate(JSON.parse(JSON.stringify(original)));
    expect(s!.run.sector).toBe(33);
    expect(s!.resources.cristal).toBe(999);
  });

  it('recusa apenas save de versão FUTURA', () => {
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
  });

  it('recusa entrada que não é save', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('lixo')).toBeNull();
    expect(migrate({})).toBeNull();
  });
});

/** Campos novos precisam nascer com padrão seguro, não quebrar o boot. */
describe('padrões seguros em campos ausentes', () => {
  const magro = () => migrate({ version: SAVE_VERSION })!;

  it('preenche todos os blocos obrigatórios', () => {
    const s = magro();
    for (const chave of [
      'resources', 'lifetime', 'run', 'bar', 'universe', 'stats',
      'settings', 'upgrades', 'shop', 'command', 'chests', 'equipped',
    ] as const) {
      expect(s[chave], chave).toBeDefined();
    }
    expect(Array.isArray(s.inventory)).toBe(true);
    expect(Array.isArray(s.fleet)).toBe(true);
    expect(Array.isArray(s.codex)).toBe(true);
  });

  it('garante ao menos um casco e que o casco ativo está na frota', () => {
    const s = magro();
    expect(s.fleet.length).toBeGreaterThan(0);
    expect(s.fleet).toContain(s.hull);
  });

  it('conserta um casco ativo que não está na frota', () => {
    const s = migrate({ version: SAVE_VERSION, hull: 'casco_que_nao_existe' })!;
    expect(s.fleet).toContain(s.hull);
  });
});

/** Um save adulterado não pode travar o boot — só ser normalizado. */
describe('resistência a save corrompido', () => {
  it('normaliza setor e onda fora de faixa', () => {
    const s = migrate({ version: SAVE_VERSION, run: { sector: -50, wave: 9999 } })!;
    expect(s.run.sector).toBeGreaterThanOrEqual(1);
    expect(s.run.wave).toBeGreaterThanOrEqual(1);
    expect(s.run.wave).toBeLessThanOrEqual(6);
  });

  it('normaliza nível de comando fracionário ou negativo', () => {
    const s = migrate({ version: SAVE_VERSION, command: { level: -3.7, xp: 0, allocated: [], refunds: 0 } })!;
    expect(Number.isInteger(s.command.level)).toBe(true);
    expect(s.command.level).toBeGreaterThanOrEqual(1);
  });

  it('descarta nós alocados que não são texto', () => {
    const s = migrate({
      version: SAVE_VERSION,
      command: { level: 5, xp: 0, allocated: ['no_valido', 42, null, { a: 1 }], refunds: 0 },
    } as unknown)!;
    expect(s.command.allocated).toEqual(['no_valido']);
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

/** Exportar e importar tem que ser reversível, senão o backup do jogador mente. */
describe('exportar e importar', () => {
  it('a viagem de ida e volta preserva o progresso', () => {
    const original = createState(2024);
    original.run.sector = 47;
    original.resources.sucata = 123456;
    original.command.level = 18;
    original.inventory = [rollItem(new Rng(8), 30, 0.4, 0)];

    const voltou = importSave(exportSave(original)) as GameState;
    expect(voltou).not.toBeNull();
    expect(voltou.run.sector).toBe(47);
    expect(voltou.resources.sucata).toBe(123456);
    expect(voltou.command.level).toBe(18);
    expect(voltou.inventory).toHaveLength(1);
    expect(voltou.inventory[0]!.uid).toBe(original.inventory[0]!.uid);
  });

  it('importar texto inválido devolve null em vez de explodir', () => {
    expect(importSave('não é save')).toBeNull();
    expect(importSave('')).toBeNull();
  });
});

/**
 * PENDENTES DA FASE 1.
 *
 * Falham de propósito quando a etapa for marcada como pronta sem a migração
 * correspondente — que é exatamente o momento em que o progresso corre risco.
 */
describe('pendentes da Fase 1', () => {
  it.todo('save v3 → v4 preserva recursos, itens, cascos, Matriz e setor');
  it.todo('remover Melhorias reembolsa o que foi gasto (§31)');
  it.todo('nível de personagem inicial deriva da patente de comando (§17)');
  it.todo('itens sem `element` viram distribuição 100% normal (§3)');
});
