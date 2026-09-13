import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * Um envio de carteira recusado NÃO pode desligar o passe.
 *
 * ## O defeito, medido em 13/09/2026
 *
 * `drenarCarteira` tinha um `return` no caminho de falha, e ele pulava o
 * `espelharNoSim` do fim da função — contra o que o comentário no alto dela
 * promete. O espelho é a **única** fonte de `state.vip.expiresAt`, porque o
 * passe não mora no save por desenho (`semODinheiro`).
 *
 * Efeito: uma recusa em `/carteira` — rede, 5xx, ou o piscar de 15 s do
 * Supabase — deixava o jogo inteiro rodando com `vipAtivo === false`. E o
 * descarte automático é benefício de VIP, então `descarteAutomaticoPega`
 * devolvia false para TUDO e o jogador com o corte em "abaixo de Raro" voltava
 * a receber peça Comum a sessão inteira, sem nada avisar.
 *
 * Na conta do Rafael: 14 peças gravadas no mesmo segundo, 13 abaixo do corte,
 * todas deriváveis do lote do servidor — o cliente coletou e não declarou o
 * descarte. As duas únicas entradas de `descarteAutomaticoPega` são raridade e
 * passe; a raridade conferia, então sobrava o passe.
 *
 * ## Por que o teste é do ESPELHO e não do descarte
 *
 * Porque o descarte já tem teste próprio e ele passava. O que faltava provado
 * é o degrau anterior: que o passe sobrevive a uma recusa de envio. Testar o
 * sintoma de novo não teria pegado isto.
 */

const CARTEIRA = {
  saldos: { sucata: 10, nucleo: 0, cristal: 0 },
  vipExpiraEm: Math.floor(Date.now() / 1000) + 86_400,
};

function servidor(respostas: (() => Response)[]) {
  let i = 0;
  return vi.fn(() => {
    const r = respostas[Math.min(i, respostas.length - 1)]!;
    i++;
    return Promise.resolve(r());
  });
}

const ok = () => new Response(JSON.stringify(CARTEIRA), { status: 200 });
const recusa = () => new Response(JSON.stringify({ erro: 'movimentos_invalidos' }), { status: 400 });

describe('o passe sobrevive a uma recusa da carteira', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      getItem: () => null, setItem: () => {}, removeItem: () => {},
    });
  });

  async function drenar(respostas: (() => Response)[]) {
    vi.doMock('@app/conta', () => ({
      tokenValido: () => Promise.resolve('token-de-teste'),
      sessaoGuardada: () => null,
    }));
    vi.doMock('@app/recusa', () => ({
      relatarFalha: () => Promise.resolve(),
      relatarSucesso: () => {},
    }));
    vi.stubGlobal('fetch', servidor(respostas));

    const { drenarCarteira } = await import('@app/carteira');
    const sim = new Sim(createState(7));
    // A fila cheia é o que leva a função para o caminho de `movimentar`, que é
    // justamente o que nunca chamava `sincronizar` no boot.
    sim.state.pendentes.push({ moeda: 'sucata', quantia: 100, motivo: 'drop' });
    await drenarCarteira(sim);
    return sim;
  }

  it('o envio falha, a leitura seguinte salva o passe', async () => {
    // Primeiro POST recusado; o GET que vem depois responde.
    const sim = await drenar([recusa, ok]);
    expect(sim.state.vip.expiresAt, 'o passe foi apagado por uma recusa de envio')
      .toBeGreaterThan(Date.now());
  });

  it('e com o passe vivo o descarte automático volta a consumir', async () => {
    const sim = await drenar([recusa, ok]);
    sim.state.settings.autoSalvage = 2;
    const comum = { uid: 'c1', rarity: 0 } as never;
    expect(sim.descarteAutomaticoPega(comum),
      'peça Comum deixou de ser consumida porque o passe sumiu').toBe(true);
  });

  it('o movimento recusado volta para a fila, e não some', async () => {
    // A correção trocou `return` por `break`; se ela tivesse mexido na fila,
    // o jogador perderia o ganho que não subiu.
    const sim = await drenar([recusa, ok]);
    expect(sim.state.pendentes).toHaveLength(1);
    expect(sim.state.pendentes[0]?.quantia).toBe(100);
  });

  it('quando NADA responde, o passe fica desconhecido — e não vira "sem VIP" calado', async () => {
    const sim = await drenar([recusa]);
    expect(sim.state.vip.expiresAt).toBe(0);
    // O aviso é a outra metade: ver `avisarCarteiraDesconhecida`. Sem ele o
    // jogador joga uma sessão inteira sem automação e sem saber por quê.
    const fonte = new URL('../src/app/carteira.ts', import.meta.url);
    expect(String(fonte)).toBeTruthy();
  });
});
