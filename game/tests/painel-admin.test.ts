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
    const linhas = [
      {
        usuario: '12345678-aaaa-bbbb-cccc-123456789abc', apelido: 'Vetor', xp: 0,
        melhor_setor: 12, ultima_atividade: 990, naves: 3, itens_mochila: 8,
        itens_equipados: 10, missoes_concluidas: 4,
      },
      {
        usuario: '87654321-aaaa-bbbb-cccc-123456789abc', apelido: null, xp: 0,
        melhor_setor: 2, ultima_atividade: 0, naves: 1, itens_mochila: 1,
        itens_equipados: 0, missoes_concluidas: 0,
      },
    ];
    const db = { prepare: () => ({ all: async () => ({ results: linhas }) }) };
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
