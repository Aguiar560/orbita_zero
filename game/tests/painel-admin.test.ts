import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADMINS } from '@data/servidor';
import { lerPainelAdmin, podeLerPainelAdmin } from '../server/src/painel-admin';

const fonte = (arquivo: string): string => readFileSync(arquivo, 'utf8');

describe('painel administrativo', () => {
  it('aceita somente ids administrativos depois da autenticação', () => {
    expect(podeLerPainelAdmin(ADMINS[0]!)).toBe(true);
    expect(podeLerPainelAdmin('piloto-comum')).toBe(false);
  });

  it('consolida a telemetria sem expor e-mail ou save bruto', async () => {
    const primeiro = '12345678-aaaa-bbbb-cccc-123456789abc';
    const segundo = '87654321-aaaa-bbbb-cccc-123456789abc';
    const db = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql === 'SELECT usuario, primeiro_em FROM contas') return { results: [{ usuario: primeiro, primeiro_em: 900 }, { usuario: segundo, primeiro_em: 900 }] };
          if (sql.includes('FROM apelidos')) return { results: [{ usuario: primeiro, apelido: 'Vetor' }] };
          if (sql.includes('FROM progresso')) return { results: [{ usuario: primeiro, xp: 0, melhor_setor: 12, casco_em_campo: 'nucleo_vektor' }, { usuario: segundo, xp: 0, melhor_setor: 2, casco_em_campo: '' }] };
          if (sql.includes('FROM saves')) return { results: [{ usuario: primeiro, atualizado_em: 990, estado: JSON.stringify({ playtime: 120, stats: { kills: 4 } }) }] };
          if (sql.includes('FROM saldos')) return { results: [{ usuario: primeiro, moeda: 'sucata', quantia: 25 }, { usuario: segundo, moeda: 'cristal', quantia: 3 }] };
          if (sql.includes('FROM materiais')) return { results: [{ usuario: primeiro, material: 'ferro', quantia: 7 }] };
          if (sql.includes('FROM transacoes')) return { results: [{ moeda: 'sucata', entradas: 40, saidas: 10, operacoes: 3 }] };
          if (sql.includes('WHERE casco_em_campo')) return { results: [{ casco: 'nucleo_vektor', total: 1 }] };
          if (sql.includes('json_extract')) return { results: [{ raridade: 2, total: 5, equipados: 2 }] };
          if (sql.includes('SUM(CASE WHEN iniciada')) return { results: [{ iniciadas: 4, entregues: 2, em_andamento: 2 }] };
          if (sql.includes('ORDER BY total DESC LIMIT 12')) return { results: [{ missao: 'm1', total: 2 }] };
          if (sql.includes('SELECT casco, COUNT(*)')) return { results: [{ casco: 'nucleo_vektor', total: 3 }] };
          if (sql.includes('FROM frota')) return { results: [{ usuario: primeiro, total: 3 }, { usuario: segundo, total: 1 }] };
          if (sql.includes('FROM itens')) return { results: [{ usuario: primeiro, itens_mochila: 8, itens_equipados: 10 }, { usuario: segundo, itens_mochila: 1, itens_equipados: 0 }] };
          return { results: [{ usuario: primeiro, total: 4 }] };
        },
      }),
    };
    const painel = await lerPainelAdmin({ DB: db as never }, 1_000);

    expect(painel.resumo.jogadores).toBe(2);
    expect(painel.resumo.online).toBe(1);
    expect(painel.resumo.naves).toBe(4);
    expect(painel.resumo.itensNaMochila).toBe(9);
    expect(painel.jogadores[0]).toMatchObject({ codigo: '12345678', apelido: 'Vetor', online: true });
    expect(painel.jogadores[1]).toMatchObject({ codigo: '87654321', apelido: null, ultimaAtividade: null });
    expect(JSON.stringify(painel)).not.toContain('12345678-aaaa');
  });

  it('fecha a rota no servidor, não apenas pela aba escondida', () => {
    const worker = fonte('server/src/index.ts');
    const rota = worker.slice(worker.indexOf("url.pathname === '/admin/painel'"));
    expect(rota).toContain('podeLerPainelAdmin(usuario.id)');
    expect(rota).toContain("erro: 'nao_autorizado'");
    expect(rota).toContain('403');
  });

  it('registra Comando como painel exclusivo de admin', () => {
    const shell = fonte('src/ui/Shell.ts');
    expect(shell).toContain('new AdminDashboardPanel()');
    expect(shell).toContain("'admin-dashboard'");
  });
});
