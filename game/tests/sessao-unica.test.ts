import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  SESSAO_ATIVA_SEGUNDOS, encerrarSessao, pulsarSessao, reivindicarSessao, verificarSessao,
} from '../server/src/sessao-unica';

function banco() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE sessoes_ativas (
    usuario TEXT PRIMARY KEY, instancia TEXT NOT NULL,
    iniciada_em INTEGER NOT NULL, atividade_em INTEGER NOT NULL
  )`);
  const DB = {
    prepare: (sql: string) => ({
      bind: (...valores: unknown[]) => ({
        run: async () => {
          const r = sqlite.prepare(sql).run(...valores as never[]);
          return { meta: { changes: Number(r.changes) } };
        },
        first: async <T>(): Promise<T | null> =>
          (sqlite.prepare(sql).get(...valores as never[]) as T | undefined) ?? null,
      }),
    }),
  };
  return { sqlite, env: { DB: DB as never } };
}

describe('sessão única por conta', () => {
  it('permite a primeira aba e avisa a segunda sem derrubar a primeira', async () => {
    const { sqlite, env } = banco();
    expect(await reivindicarSessao(env, 'u1', 'aba_a_1234567890', false, 1000)).toEqual({ estado: 'ativa' });
    expect(await reivindicarSessao(env, 'u1', 'aba_b_1234567890', false, 1010)).toMatchObject({ estado: 'conflito' });
    expect(await verificarSessao(env, 'u1', 'aba_a_1234567890', 1010)).toEqual({ estado: 'ativa' });
    sqlite.close();
  });

  it('derruba a anterior somente quando a nova confirma', async () => {
    const { sqlite, env } = banco();
    await reivindicarSessao(env, 'u1', 'aba_a_1234567890', false, 1000);
    expect(await reivindicarSessao(env, 'u1', 'aba_b_1234567890', true, 1010)).toEqual({ estado: 'ativa' });
    expect(await verificarSessao(env, 'u1', 'aba_a_1234567890', 1011)).toEqual({ estado: 'substituida' });
    expect(await pulsarSessao(env, 'u1', 'aba_a_1234567890', 1012)).toEqual({ estado: 'substituida' });
    expect(await pulsarSessao(env, 'u1', 'aba_b_1234567890', 1012)).toEqual({ estado: 'ativa' });
    sqlite.close();
  });

  it('libera uma sessão abandonada e permite encerramento seguro', async () => {
    const { sqlite, env } = banco();
    await reivindicarSessao(env, 'u1', 'aba_a_1234567890', false, 1000);
    expect(await reivindicarSessao(env, 'u1', 'aba_b_1234567890', false, 1000 + SESSAO_ATIVA_SEGUNDOS + 1)).toEqual({ estado: 'ativa' });
    await encerrarSessao(env, 'u1', 'aba_a_1234567890');
    expect(await verificarSessao(env, 'u1', 'aba_b_1234567890', 1200)).toEqual({ estado: 'ativa' });
    sqlite.close();
  });
});
