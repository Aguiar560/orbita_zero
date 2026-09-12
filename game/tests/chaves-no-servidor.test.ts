import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CHAVES_DE_ACESSO } from '@data/chaves-de-acesso';
import {
  CHAVES_MAX, acessoAoChefeDe, chavesDe, consumirChave, creditarChaves,
  ganhosSaos, liberarAcesso,
} from '../server/src/chaves';

/**
 * As chaves de acesso, agora no D1.
 *
 * "As chaves têm que ser igual os recursos e itens: se eles estão no D1, então
 * as chaves também precisam estar" — Rafael, 12/09/2026.
 *
 * O que este arquivo guarda é a parte que dinheiro e poder tornam cara de
 * errar: ninguém gasta o que não tem, gastar e entrar acontecem juntos, e o
 * cliente não consegue gastar declarando.
 */

const MIGRACAO = new URL('../server/migrations/0025-chaves-no-d1.sql', import.meta.url);
const CHAVE = CHAVES_DE_ACESSO[0]!;
const OUTRA = CHAVES_DE_ACESSO[1]!;

function banco() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE saves (usuario TEXT PRIMARY KEY, estado TEXT NOT NULL);');

  const DB = {
    prepare: (sql: string) => {
      const comValores = (valores: unknown[]) => ({
        run: async () => {
          const r = sqlite.prepare(sql).run(...valores as never[]);
          return { meta: { changes: Number(r.changes) } };
        },
        first: async <T>(): Promise<T | null> =>
          (sqlite.prepare(sql).get(...valores as never[]) as T | undefined) ?? null,
        all: async <T>(): Promise<{ results: T[] }> =>
          ({ results: sqlite.prepare(sql).all(...valores as never[]) as T[] }),
        // O que o `batch` do D1 executa, guardado até a hora dele.
        __sql: sql,
        __valores: valores,
      });
      return { bind: (...valores: unknown[]) => comValores(valores), ...comValores([]) };
    },
    /** Uma transação, como no D1: ou tudo entra, ou nada — e erro reverte. */
    batch: async (itens: { __sql: string; __valores: unknown[] }[]) => {
      sqlite.exec('BEGIN');
      try {
        for (const i of itens) sqlite.prepare(i.__sql).run(...i.__valores as never[]);
        sqlite.exec('COMMIT');
      } catch (erro) {
        sqlite.exec('ROLLBACK');
        throw erro;
      }
      return [];
    },
  };
  return { sqlite, env: { DB: DB as never } };
}

/** Aplica a migração — a mesma que roda em produção, lida do arquivo. */
function migrar(sqlite: DatabaseSync): void {
  sqlite.exec(readFileSync(MIGRACAO, 'utf8'));
}

describe('a semeadura lê o save, e não o cliente', () => {
  it('copia as chaves que já existem, sem pedir nada a ninguém', () => {
    const { sqlite } = banco();
    sqlite.prepare('INSERT INTO saves VALUES (?, ?)').run('a', JSON.stringify({
      chavesAcesso: { [CHAVE.id]: 20, [OUTRA.id]: 3 },
    }));
    sqlite.prepare('INSERT INTO saves VALUES (?, ?)').run('b', JSON.stringify({ chavesAcesso: {} }));
    sqlite.prepare('INSERT INTO saves VALUES (?, ?)').run('c', JSON.stringify({ run: { sector: 1 } }));

    migrar(sqlite);

    expect(sqlite.prepare('SELECT chave, quantia FROM chaves WHERE usuario = ? ORDER BY chave').all('a'))
      .toEqual([{ chave: CHAVE.id, quantia: 20 }, { chave: OUTRA.id, quantia: 3 }]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM chaves').get(), 'copiou chave de quem não tem')
      .toMatchObject({ n: 2 });
    sqlite.close();
  });

  it('e aplicar duas vezes não dobra o estoque de ninguém', () => {
    const { sqlite } = banco();
    sqlite.prepare('INSERT INTO saves VALUES (?, ?)').run('a', JSON.stringify({
      chavesAcesso: { [CHAVE.id]: 20 },
    }));
    migrar(sqlite);
    sqlite.exec(readFileSync(MIGRACAO, 'utf8'));

    expect(sqlite.prepare('SELECT quantia FROM chaves WHERE usuario = ?').get('a'))
      .toMatchObject({ quantia: 20 });
    sqlite.close();
  });
});

describe('gastar uma chave é operação do servidor', () => {
  it('gasta, abre o acesso, e as duas coisas acontecem juntas', async () => {
    const { sqlite, env } = banco();
    migrar(sqlite);
    await creditarChaves(env, 'piloto', { [CHAVE.id]: 2 });

    expect(await consumirChave(env, 'piloto', CHAVE.id, CHAVE.bossId, 1_000)).toBe(true);
    expect(await chavesDe(env, 'piloto')).toEqual({ [CHAVE.id]: 1 });
    expect(await acessoAoChefeDe(env, 'piloto')).toBe(CHAVE.bossId);
    sqlite.close();
  });

  it('e a conta que NUNCA teve chave não entra', async () => {
    /**
     * O furo que o ensaio pegou antes de virar código: `UPDATE ... WHERE
     * usuario = ?` numa conta sem linha casa ZERO linhas, zero linha não viola
     * `CHECK` nenhum, e o `batch` seguia em frente gravando o acesso. Quem
     * nunca teve chave entrava de graça.
     */
    const { sqlite, env } = banco();
    migrar(sqlite);

    expect(await consumirChave(env, 'sem_nada', CHAVE.id, CHAVE.bossId, 1_000)).toBe(false);
    expect(await acessoAoChefeDe(env, 'sem_nada'), 'entrou sem pagar').toBeNull();
    sqlite.close();
  });

  it('e a conta que ZEROU o estoque também não', async () => {
    const { sqlite, env } = banco();
    migrar(sqlite);
    await creditarChaves(env, 'piloto', { [CHAVE.id]: 1 });

    expect(await consumirChave(env, 'piloto', CHAVE.id, CHAVE.bossId, 1_000)).toBe(true);
    await liberarAcesso(env, 'piloto');
    expect(await consumirChave(env, 'piloto', CHAVE.id, CHAVE.bossId, 2_000)).toBe(false);
    expect(await acessoAoChefeDe(env, 'piloto')).toBeNull();
    sqlite.close();
  });

  it('e uma chave inventada não serve', async () => {
    const { sqlite, env } = banco();
    migrar(sqlite);
    expect(await consumirChave(env, 'piloto', 'chave-fantasma', CHAVE.bossId, 1_000)).toBe(false);
    sqlite.close();
  });

  it('o acesso é fechado ao SAIR, e não ao concluir', async () => {
    // A distinção custou um defeito no cliente no mesmo dia: o recibo era
    // rasgado na conclusão e a nave ficava dentro do chefe sem ele.
    const { sqlite, env } = banco();
    migrar(sqlite);
    await creditarChaves(env, 'piloto', { [CHAVE.id]: 1 });
    await consumirChave(env, 'piloto', CHAVE.id, CHAVE.bossId, 1_000);

    await liberarAcesso(env, 'piloto');
    expect(await acessoAoChefeDe(env, 'piloto')).toBeNull();
    sqlite.close();
  });
});

describe('o cliente declara ganho, nunca gasto', () => {
  it('recusa quantia negativa — gastar não é palavra dele', () => {
    expect(ganhosSaos({ [CHAVE.id]: -1 })).toBe('quantia_invalida');
  });

  it('recusa chave que não existe no catálogo', () => {
    expect(ganhosSaos({ 'chave-fantasma': 1 })).toBe('chave_desconhecida');
  });

  it('descarta o zero, que não é ganho nem escrita', () => {
    expect(ganhosSaos({ [CHAVE.id]: 0, [OUTRA.id]: 2 })).toEqual({ [OUTRA.id]: 2 });
  });

  it('e o teto vale mesmo somando', async () => {
    const { sqlite, env } = banco();
    migrar(sqlite);
    await creditarChaves(env, 'piloto', { [CHAVE.id]: CHAVES_MAX });
    await creditarChaves(env, 'piloto', { [CHAVE.id]: 500 });

    expect((await chavesDe(env, 'piloto'))[CHAVE.id]).toBe(CHAVES_MAX);
    sqlite.close();
  });
});
