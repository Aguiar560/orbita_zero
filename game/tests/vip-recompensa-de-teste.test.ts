import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  CHAVES_DO_RECADO_VIP, DIAS_DA_PRIMEIRA_FAIXA, DIAS_DA_SEGUNDA_FAIXA,
  MENSAGENS_DA_RECOMPENSA_VIP, NIVEL_DA_RECOMPENSA_VIP, VAGAS_DA_RECOMPENSA_VIP,
  VAGAS_DE_30_DIAS, concederVipDeTeste,
} from '../server/src/vip-de-teste';

const DIA = 86_400;

function banco() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE assinaturas (
      usuario TEXT PRIMARY KEY,
      expira_em INTEGER NOT NULL DEFAULT 0,
      bonus_nivel_25_em INTEGER NOT NULL DEFAULT 0,
      bonus_dias INTEGER NOT NULL DEFAULT 0
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
        first: async <T>(): Promise<T | null> =>
          (sqlite.prepare(sql).get(...valores as never[]) as T | undefined) ?? null,
      }),
    }),
  };
  return { sqlite, env: { DB: DB as never } };
}

/** Ocupa `n` vagas com contas que já receberam, para testar a faixa seguinte. */
function ocupar(sqlite: DatabaseSync, n: number, dias: number): void {
  for (let i = 0; i < n; i++) {
    sqlite.prepare(
      'INSERT INTO assinaturas (usuario, expira_em, bonus_nivel_25_em, bonus_dias) VALUES (?, 0, 1, ?)',
    ).run(`ocupante_${dias}_${i}`, dias);
  }
}

const expiraDe = (sqlite: DatabaseSync, usuario: string): number =>
  (sqlite.prepare('SELECT expira_em FROM assinaturas WHERE usuario = ?').get(usuario) as { expira_em: number }).expira_em;

/**
 * O passe de agradecimento do período de testes, agora com VAGAS.
 *
 * Regra de 12/09/2026: as primeiras 40 contas a alcançar a patente 25 ganham
 * passe — as **10 primeiras com 30 dias**, as **30 seguintes com 7**. Contam
 * para as 40 também as contas que já tinham passe quando a regra nasceu.
 *
 * O que estes testes guardam é o que dinheiro torna caro de errar: não dar duas
 * vezes, não dar a mais do que o teto, e não prometer nada a quem só ocupou
 * vaga.
 */
describe('VIP de agradecimento do período de testes', () => {
  it('não concede antes do nível 25', async () => {
    const { sqlite, env } = banco();
    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP - 1, 1_000)).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM assinaturas').get()).toMatchObject({ n: 0 });
    sqlite.close();
  });

  it('a primeira faixa leva 30 dias, uma vez só', async () => {
    const { sqlite, env } = banco();
    const agora = 1_000_000;

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora))
      .toBe(DIAS_DA_PRIMEIRA_FAIXA);
    // A segunda chamada não concede NEM devolve dias: o cliente ressincroniza a
    // carteira a cada resposta diferente de zero, e isso já foi pago uma vez.
    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP + 20, agora + 60)).toBe(0);

    expect(sqlite.prepare('SELECT expira_em, bonus_nivel_25_em, bonus_dias FROM assinaturas WHERE usuario = ?').get('piloto'))
      .toMatchObject({
        expira_em: agora + DIAS_DA_PRIMEIRA_FAIXA * DIA,
        bonus_nivel_25_em: agora,
        bonus_dias: DIAS_DA_PRIMEIRA_FAIXA,
      });
    expect(sqlite.prepare('SELECT texto FROM recados WHERE usuario = ?').all('piloto'))
      .toEqual([{ texto: MENSAGENS_DA_RECOMPENSA_VIP[DIAS_DA_PRIMEIRA_FAIXA] }]);
    sqlite.close();
  });

  it('e a partir da décima primeira conta a faixa cai para 7 dias', async () => {
    const { sqlite, env } = banco();
    const agora = 2_000_000;
    ocupar(sqlite, VAGAS_DE_30_DIAS, DIAS_DA_PRIMEIRA_FAIXA);

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora))
      .toBe(DIAS_DA_SEGUNDA_FAIXA);
    expect(expiraDe(sqlite, 'piloto')).toBe(agora + DIAS_DA_SEGUNDA_FAIXA * DIA);
    expect(sqlite.prepare('SELECT chave FROM recados WHERE usuario = ?').all('piloto'))
      .toEqual([{ chave: CHAVES_DO_RECADO_VIP[DIAS_DA_SEGUNDA_FAIXA] }]);
    sqlite.close();
  });

  it('a décima ainda leva 30 — a virada é no limite exato', async () => {
    const { sqlite, env } = banco();
    ocupar(sqlite, VAGAS_DE_30_DIAS - 1, DIAS_DA_PRIMEIRA_FAIXA);

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, 3_000_000))
      .toBe(DIAS_DA_PRIMEIRA_FAIXA);
    sqlite.close();
  });

  it('passou das 40 vagas, ninguém mais ganha', async () => {
    const { sqlite, env } = banco();
    ocupar(sqlite, VAGAS_DA_RECOMPENSA_VIP, DIAS_DA_SEGUNDA_FAIXA);

    expect(await concederVipDeTeste(env, 'atrasado', NIVEL_DA_RECOMPENSA_VIP, 4_000_000)).toBe(0);
    // A linha chega a ser criada — é `INSERT OR IGNORE` —, mas sem passe, sem
    // carimbo e, portanto, sem ocupar vaga de ninguém.
    expect(sqlite.prepare('SELECT expira_em, bonus_nivel_25_em, bonus_dias FROM assinaturas WHERE usuario = ?').get('atrasado'))
      .toMatchObject({ expira_em: 0, bonus_nivel_25_em: 0, bonus_dias: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM recados').get()).toMatchObject({ n: 0 });
    sqlite.close();
  });

  it('quem só OCUPA vaga não ganha passe nem recebe recado', async () => {
    /**
     * É o caso das contas que já tinham VIP quando a regra nasceu: a migração
     * `0024` carimba a vaga e deixa `bonus_dias = 0`. Elas contam para as 40 e
     * não têm o que agradecer.
     */
    const { sqlite, env } = banco();
    sqlite.prepare(
      'INSERT INTO assinaturas (usuario, expira_em, bonus_nivel_25_em, bonus_dias) VALUES (?, ?, ?, 0)',
    ).run('ja_era_vip', 9_999_999, 1);

    expect(await concederVipDeTeste(env, 'ja_era_vip', NIVEL_DA_RECOMPENSA_VIP, 5_000_000)).toBe(0);
    expect(expiraDe(sqlite, 'ja_era_vip'), 'o passe dele foi esticado de graça').toBe(9_999_999);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM recados').get()).toMatchObject({ n: 0 });
    sqlite.close();
  });

  it('soma a cortesia ao passe que ainda está ativo', async () => {
    const { sqlite, env } = banco();
    const agora = 6_000_000;
    const expira = agora + 5 * DIA;
    sqlite.prepare('INSERT INTO assinaturas (usuario, expira_em) VALUES (?, ?)').run('piloto', expira);

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora))
      .toBe(DIAS_DA_PRIMEIRA_FAIXA);
    expect(expiraDe(sqlite, 'piloto')).toBe(expira + DIAS_DA_PRIMEIRA_FAIXA * DIA);
    sqlite.close();
  });

  it('e o recado perdido é reparado na leitura seguinte, sem conceder de novo', async () => {
    const { sqlite, env } = banco();
    const agora = 7_000_000;
    await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora);
    sqlite.prepare('DELETE FROM recados').run();

    expect(await concederVipDeTeste(env, 'piloto', NIVEL_DA_RECOMPENSA_VIP, agora + 600)).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM recados').get(), 'a entrega não foi reparada')
      .toMatchObject({ n: 1 });
    expect(expiraDe(sqlite, 'piloto'), 'reparar o recado esticou o passe')
      .toBe(agora + DIAS_DA_PRIMEIRA_FAIXA * DIA);
    sqlite.close();
  });

  it('as duas faixas falam idiomas iguais e chaves diferentes', () => {
    expect(MENSAGENS_DA_RECOMPENSA_VIP[DIAS_DA_PRIMEIRA_FAIXA]).toMatch(/^Thank you/);
    expect(MENSAGENS_DA_RECOMPENSA_VIP[DIAS_DA_SEGUNDA_FAIXA]).toMatch(/^Thank you/);
    expect(MENSAGENS_DA_RECOMPENSA_VIP[DIAS_DA_PRIMEIRA_FAIXA]).toContain('30-day');
    expect(MENSAGENS_DA_RECOMPENSA_VIP[DIAS_DA_SEGUNDA_FAIXA]).toContain('7-day');
    expect(CHAVES_DO_RECADO_VIP[DIAS_DA_PRIMEIRA_FAIXA])
      .not.toBe(CHAVES_DO_RECADO_VIP[DIAS_DA_SEGUNDA_FAIXA]);
  });
});
