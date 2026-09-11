import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { VIP_SEGUNDOS } from '../server/src/carteira';
import {
  MENSAGEM_DA_RECOMPENSA_VIP, NIVEL_DA_RECOMPENSA_VIP, concederVipDeTeste,
} from '../server/src/vip-de-teste';

function banco() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE assinaturas (
      usuario TEXT PRIMARY KEY,
      expira_em INTEGER NOT NULL DEFAULT 0,
      bonus_nivel_25_em INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE recados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      texto TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      lido_em INTEGER,
      chave TEXT
    );
    CREATE UNIQUE INDEX idx_recados_chave ON recados (usuario, chave) WHERE chave IS NOT NULL;
  `);

  const DB = {
    prepare: (sql: string) => ({
      bind: (...valores: unknown[]) => ({
        run: async () => {
          const r = sqlite.prepare(sql).run(...valores as never[]);
          return { meta: { changes: Number(r.changes) } };
        },
      }),
    }),
  };
  return { sqlite, env: { DB: DB as never } };
}

describe('VIP de agradecimento do período de testes', () => {
  it('não concede antes do nível 25', async () => {
    const { sqlite, env } = banco();
    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP - 1, 1_000)).toBe(false);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM assinaturas').get()).toMatchObject({ n: 0 });
    sqlite.close();
  });

  it('concede 30 dias uma vez e deixa um único agradecimento em inglês', async () => {
    const { sqlite, env } = banco();
    const agora = 1_000_000;

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora)).toBe(true);
    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP + 20, agora + 60)).toBe(false);

    expect(sqlite.prepare('SELECT expira_em, bonus_nivel_25_em FROM assinaturas WHERE usuario = ?').get('piloto'))
      .toMatchObject({ expira_em: agora + VIP_SEGUNDOS, bonus_nivel_25_em: agora });
    expect(sqlite.prepare('SELECT texto FROM recados WHERE usuario = ?').all('piloto'))
      .toEqual([{ texto: MENSAGEM_DA_RECOMPENSA_VIP }]);
    expect(MENSAGEM_DA_RECOMPENSA_VIP).toMatch(/^Thank you/);
    sqlite.close();
  });

  it('soma a cortesia ao VIP que ainda está ativo', async () => {
    const { sqlite, env } = banco();
    const agora = 2_000_000;
    const expira = agora + 5 * 86_400;
    sqlite.prepare('INSERT INTO assinaturas (usuario, expira_em) VALUES (?, ?)').run('piloto', expira);

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora)).toBe(true);
    expect(sqlite.prepare('SELECT expira_em FROM assinaturas WHERE usuario = ?').get('piloto'))
      .toMatchObject({ expira_em: expira + VIP_SEGUNDOS });
    sqlite.close();
  });
});
