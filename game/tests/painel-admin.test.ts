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

  const primeiro = '12345678-aaaa-bbbb-cccc-123456789abc';
  const segundo = '87654321-aaaa-bbbb-cccc-123456789abc';

  const bancoDeExemplo = () => ({
      prepare: (sql: string) => ({
        all: async () => {
          if (sql === 'SELECT usuario, primeiro_em FROM contas') return { results: [{ usuario: primeiro, primeiro_em: 900 }, { usuario: segundo, primeiro_em: 900 }] };
          if (sql.includes('FROM apelidos')) return { results: [{ usuario: primeiro, apelido: 'Vetor' }] };
          if (sql.includes('FROM progresso')) return { results: [{ usuario: primeiro, xp: 0, melhor_setor: 12, casco_em_campo: 'nucleo_vektor' }, { usuario: segundo, xp: 0, melhor_setor: 2, casco_em_campo: '' }] };
          if (sql.includes('FROM saves')) return { results: [
            { usuario: primeiro, atualizado_em: 990, estado: JSON.stringify({ playtime: 120, stats: { kills: 4 } }) },
            { usuario: segundo, atualizado_em: 500, estado: JSON.stringify({ hull: 'nucleo_vektor' }) },
          ] };
          if (sql.includes('FROM saldos')) return { results: [{ usuario: primeiro, moeda: 'sucata', quantia: 25 }, { usuario: segundo, moeda: 'cristal', quantia: 3 }] };
          if (sql.includes('FROM materiais')) return { results: [{ usuario: primeiro, material: 'ferro', quantia: 7 }] };
          // O passe: um ativo (vence depois de `agora`) e um vencido. A linha
          // sobrevive ao vencimento de propósito — é o histórico de quem já
          // assinou —, e é isso que separa "nunca teve" de "teve e perdeu".
          if (sql.includes('FROM assinaturas')) return { results: [
            { usuario: primeiro, expira_em: 5_000, bonus_dias: 30 },
            { usuario: segundo, expira_em: 800, bonus_dias: 0 },
          ] };
          if (sql.includes('FROM transacoes')) return { results: [{ moeda: 'sucata', entradas: 40, saidas: 10, operacoes: 3 }] };
          if (sql.includes('WHERE casco_em_campo')) return { results: [{ casco: 'nucleo_vektor', total: 1 }] };
          if (sql.includes('json_extract')) return { results: [{ raridade: 2, total: 5, equipados: 2 }] };
          if (sql.includes('WHERE nave IS NOT NULL')) return { results: [{
            usuario: primeiro,
            dados: JSON.stringify({ baseId: 'principal_2', rarity: 3, ilvl: 12, element: 'fogo', set: 'vanguarda' }),
            nave: 'nucleo_vektor', slot: 'principal',
          }] };
          if (sql.includes('SUM(CASE WHEN iniciada')) return { results: [{ iniciadas: 4, entregues: 2, em_andamento: 2 }] };
          if (sql.includes('ORDER BY total DESC LIMIT 12')) return { results: [{ missao: 'm1', total: 2 }] };
          if (sql.includes('SELECT casco, COUNT(*)')) return { results: [{ casco: 'nucleo_vektor', total: 3 }] };
          if (sql.includes('FROM frota')) return { results: [{ usuario: primeiro, total: 3 }, { usuario: segundo, total: 1 }] };
          if (sql.includes('FROM itens')) return { results: [{ usuario: primeiro, itens_mochila: 8, itens_equipados: 10 }, { usuario: segundo, itens_mochila: 1, itens_equipados: 0 }] };
          return { results: [{ usuario: primeiro, total: 4 }] };
        },
      }),
  });

  it('consolida a telemetria sem expor e-mail ou save bruto', async () => {
    const painel = await lerPainelAdmin({ DB: bancoDeExemplo() as never }, 1_000);

    expect(painel.resumo.jogadores).toBe(2);
    expect(painel.resumo.online).toBe(1);
    expect(painel.resumo.naves).toBe(4);
    expect(painel.resumo.itensNaMochila).toBe(9);
    expect(painel.jogadores[0]).toMatchObject({ codigo: '12345678', apelido: 'Vetor', online: true });
    expect(painel.jogadores[1]).toMatchObject({
      codigo: '87654321', apelido: null, cascoEmCampo: 'nucleo_vektor', ultimaAtividade: 500,
    });
    expect(painel.jogadores[0]?.equipamentos).toMatchObject([{
      baseId: 'principal_2', nave: 'nucleo_vektor', slot: 'principal', raridade: 3, nivel: 12,
    }]);
    expect(JSON.stringify(painel)).not.toContain('12345678-aaaa');
  });

  it('separa quem é VIP, quem foi, e quantas vagas da cortesia restam', async () => {
    /**
     * Pedido do Rafael em 12/09/2026: "no painel de comando mostrar quem é VIP e
     * quem não é, quantos VIPs totais na visão geral".
     *
     * O painel responde três perguntas, e não uma: quem tem passe agora, quem
     * já teve e deixou de ter — sem isso uma queda no total não tem explicação —
     * e quantas das 40 vagas da promoção do nível 25 já foram tomadas.
     */
    const painel = await lerPainelAdmin({ DB: bancoDeExemplo() as never }, 1_000);

    expect(painel.resumo.vips, 'contou quem já venceu como ativo').toBe(1);
    expect(painel.resumo.vipsExpirados).toBe(1);
    expect(painel.resumo.vipVagasUsadas).toBe(2);
    expect(painel.resumo.vipVagasTotais).toBe(40);

    const [comPasse, semPasse] = painel.jogadores;
    expect(comPasse).toMatchObject({ vip: true, vipExpiraEm: 5_000, vipCortesiaDias: 30 });
    expect(semPasse, 'o passe vencido virou "não é VIP" sem deixar rastro')
      .toMatchObject({ vip: false, vipExpiraEm: 800 });
  });

  it('mostra o nome público do casco no detalhe do piloto', () => {
    const painel = fonte('src/ui/panels/AdminDashboardPanel.ts');
    expect(painel).toContain('HULL_BY_ID.get(jogador.cascoEmCampo)?.name');
    expect(painel).not.toContain("cascoEmCampo ?? 'não definida'");
  });

  it('mostra peças equipadas por nave, slot e raridade no detalhe', () => {
    const painel = fonte('src/ui/panels/AdminDashboardPanel.ts');
    expect(painel).toContain('EQUIPAMENTOS EQUIPADOS');
    expect(painel).toContain('RARITIES[item.raridade]');
    expect(painel).toContain('SLOT_BY_ID.get(item.slot as SlotId)');
  });

  it('registra a nave inicial como casco em campo', () => {
    const worker = fonte('server/src/index.ts');
    const aquisicao = worker.slice(worker.indexOf('async function adquirirCasco'), worker.indexOf('async function missoesDe'));
    expect(aquisicao).toContain("UPDATE progresso SET casco_em_campo = ? WHERE usuario = ? AND casco_em_campo = ''");
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
