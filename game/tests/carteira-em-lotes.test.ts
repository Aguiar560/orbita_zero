import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { MOVIMENTOS_POR_LOTE, drenarCarteira, esquecer, lotesParaEnvio, type Movimento } from '@app/carteira';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * A fila da carteira sobe em lotes que o Worker aceita.
 *
 * ## O defeito, medido em 10/09/2026
 *
 * `drenarCarteira` mandava a fila inteira num POST, e o Worker recusa mais de 6
 * movimentos por lote (`movimentos_invalidos`). Dois ou três setores num ciclo
 * já passavam disso: a recusa devolvia a fila, que crescia, e era recusada de
 * novo para sempre. O livro das recusas contava ~10 por hora, e a sucata daquela
 * conta parou de chegar ao servidor.
 */

const mov = (moeda: Movimento['moeda'], quantia: number, motivo: Movimento['motivo'] = 'drop'): Movimento =>
  ({ moeda, quantia, motivo });

describe('lotesParaEnvio', () => {
  it('soma o que é igual e respeita o teto do Worker', () => {
    const fila = Array.from({ length: 40 }, () => mov('sucata', 1200));
    const lotes = lotesParaEnvio(fila);
    expect(lotes).toEqual([[mov('sucata', 48_000)]]);
  });

  it('não mistura motivo, moeda nem sinal', () => {
    const lotes = lotesParaEnvio([
      mov('sucata', 1000), mov('sucata', -100, 'morte'), mov('sucata', 500),
      mov('nucleo', 30), mov('sucata', -40, 'loja'), mov('nucleo', -10, 'loja'),
    ]);
    const tudo = lotes.flat();
    expect(tudo).toContainEqual(mov('sucata', 1500));
    expect(tudo).toContainEqual(mov('sucata', -100, 'morte'));
    expect(tudo).toContainEqual(mov('sucata', -40, 'loja'));
    expect(tudo).toContainEqual(mov('nucleo', 30));
    expect(tudo).toContainEqual(mov('nucleo', -10, 'loja'));
  });

  it('crédito antes de débito — o gasto não pode esbarrar no ganho do mesmo ciclo', () => {
    const tudo = lotesParaEnvio([mov('sucata', -500, 'loja'), mov('sucata', 800)]).flat();
    expect(tudo[0]!.quantia).toBeGreaterThan(0);
  });

  it('nenhum lote passa de seis', () => {
    const motivos: Movimento['motivo'][] = ['drop', 'missao', 'loja', 'craft', 'morte'];
    const fila: Movimento[] = [];
    for (const moeda of ['sucata', 'nucleo', 'cristal'] as const) {
      for (const motivo of motivos) fila.push(mov(moeda, 10, motivo), mov(moeda, -5, motivo));
    }
    const lotes = lotesParaEnvio(fila);
    expect(lotes.length).toBeGreaterThan(1);
    for (const l of lotes) expect(l.length).toBeLessThanOrEqual(MOVIMENTOS_POR_LOTE);
  });
});

describe('drenarCarteira', () => {
  let recebidos: Movimento[][] = [];
  let recusarDepoisDe = Infinity;

  beforeEach(() => {
    vi.unstubAllGlobals();
    esquecer();
    recebidos = [];
    recusarDepoisDe = Infinity;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const corpo = init?.body ? JSON.parse(String(init.body)) as { movimentos: Movimento[] } : null;
      if (corpo) {
        // O Worker de verdade: mais de seis é recusado.
        if (corpo.movimentos.length > MOVIMENTOS_POR_LOTE || recebidos.length >= recusarDepoisDe) {
          return { ok: false, status: 400, json: async () => ({ erro: 'movimentos_invalidos' }) } as unknown as Response;
        }
        recebidos.push(corpo.movimentos);
      }
      return {
        ok: true,
        json: async () => ({ saldos: { sucata: 0, nucleo: 0, cristal: 0 }, vipExpiraEm: 0 }),
      } as unknown as Response;
    });
  });

  it('uma fila grande sobe inteira e esvazia', async () => {
    const sim = new Sim(createState(51));
    for (let i = 0; i < 30; i++) sim.state.pendentes.push({ moeda: 'sucata', quantia: 1000, motivo: 'drop' });
    for (let i = 0; i < 10; i++) sim.state.pendentes.push({ moeda: 'nucleo', quantia: 7, motivo: 'drop' });
    await drenarCarteira(sim);
    expect(sim.state.pendentes).toEqual([]);
    expect(recebidos.flat()).toContainEqual(mov('sucata', 30_000));
  });

  it('quando um lote falha, só o que não subiu volta para a fila', async () => {
    const sim = new Sim(createState(52));
    const motivos: Movimento['motivo'][] = ['drop', 'missao', 'loja', 'craft', 'morte'];
    for (const moeda of ['sucata', 'nucleo'] as const) {
      for (const motivo of motivos) sim.state.pendentes.push({ moeda, quantia: 10, motivo });
    }
    recusarDepoisDe = 1; // o primeiro lote entra, o segundo é recusado
    await drenarCarteira(sim);
    const subiu = recebidos.flat().length;
    expect(subiu).toBe(MOVIMENTOS_POR_LOTE);
    // O que voltou é exatamente o resto: nada duplicado, nada perdido.
    expect(sim.state.pendentes.length + subiu).toBe(10);
  });
});
