import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(process.cwd());
const placar = readFileSync(resolve(raiz, 'server/src/placar.ts'), 'utf8');
const api = readFileSync(resolve(raiz, 'server/src/index.ts'), 'utf8');
const migracao = readFileSync(resolve(raiz, 'server/migrations/0019-contas-teste.sql'), 'utf8');

describe('contas de teste não contaminam rankings', () => {
  it('guarda a exclusão pelo UUID autenticado', () => {
    expect(migracao).toContain('CREATE TABLE IF NOT EXISTS contas_teste');
    expect(migracao).toMatch(/usuario\s+TEXT PRIMARY KEY/);
  });

  it('ignora o envio de todas as marcas da conta marcada', () => {
    expect(api).toContain('if (await contaSemRanking(env, id))');
    expect(api).toContain('foraDoPlacar: true');
  });

  it('filtra contas de teste do topo, total e cálculo de posição', () => {
    const filtros = placar.match(/NOT EXISTS \(SELECT 1 FROM contas_teste t WHERE t\.usuario = m\.usuario\)/g) ?? [];
    expect(filtros).toHaveLength(4);
  });
});
