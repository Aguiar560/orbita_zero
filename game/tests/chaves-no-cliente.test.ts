import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { CHAVES_DE_ACESSO } from '@data/chaves-de-acesso';
import { consumirChaveNoServidor, drenarChaves, esquecerChaves, sincronizarChaves } from '@app/chaves';
import { comAsFilasDaqui } from '@app/nuvem';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

const CHAVE = CHAVES_DE_ACESSO[0]!;

/**
 * O espelho das chaves de acesso.
 *
 * Elas saíram do save em 12/09/2026 — "se os recursos e itens estão no D1,
 * então as chaves também precisam estar". O que este arquivo guarda é a
 * assimetria que organiza o desenho:
 *
 * - **GANHO sobe como fila.** O drop acontece na cena, e segurar o quadro
 *   esperando a rede seria pior que a dívida de confiança.
 * - **GASTO não sobe — é PEDIDO.** Quem debita é o servidor, e a nave só entra
 *   depois que ele confirma.
 */
describe('as chaves são espelho do servidor', () => {
  let enviados: Record<string, unknown>[] = [];

  /** Um servidor falso que se comporta como a rota: acumula e devolve o total. */
  function servidor(inicial: Record<string, number> = {}, acesso: string | null = null) {
    enviados = [];
    const guardado = { ...inicial };
    let acessoAtual = acesso;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as {
          acao?: string; ganhos?: Record<string, number>; chave?: string; boss?: string;
        };
        enviados.push(corpo as Record<string, unknown>);
        if (corpo.acao === 'consumir') {
          if ((guardado[corpo.chave!] ?? 0) <= 0) {
            return { ok: false, status: 409, json: async () => ({ erro: 'sem_chave' }) } as unknown as Response;
          }
          guardado[corpo.chave!] = guardado[corpo.chave!]! - 1;
          acessoAtual = corpo.boss ?? null;
        } else if (corpo.acao === 'liberar') {
          acessoAtual = null;
        } else {
          for (const [id, n] of Object.entries(corpo.ganhos ?? {})) {
            guardado[id] = (guardado[id] ?? 0) + n;
          }
        }
      }
      return {
        ok: true,
        json: async () => ({ chaves: { ...guardado }, acesso: acessoAtual }),
      } as unknown as Response;
    });
    return { estoque: () => ({ ...guardado }), acesso: () => acessoAtual };
  }

  beforeEach(() => { vi.unstubAllGlobals(); esquecerChaves(); });

  it('o boot adota o estoque e o acesso já pago', async () => {
    servidor({ [CHAVE.id]: 7 }, CHAVE.bossId);
    const sim = new Sim(createState(1));

    expect(await sincronizarChaves(sim)).toBe(true);
    expect(sim.state.chavesAcesso).toEqual({ [CHAVE.id]: 7 });
    expect(sim.state.run.chaveAcessoConsumida, 'o acesso pago não voltou do servidor')
      .toBe(CHAVE.bossId);
  });

  it('a chave que cai sobe como fila, e não some no caminho', async () => {
    const s = servidor({ [CHAVE.id]: 1 });
    const sim = new Sim(createState(2));
    await sincronizarChaves(sim);

    sim.adquirirChave(CHAVE.id);
    expect(sim.state.chavesPendentes[CHAVE.id], 'o ganho não entrou na fila').toBe(1);
    expect(sim.state.chavesAcesso[CHAVE.id], 'a tela não mostrou no mesmo quadro').toBe(2);

    await drenarChaves(sim);
    expect(s.estoque()[CHAVE.id], 'o servidor não soube do drop').toBe(2);
    expect(sim.state.chavesPendentes[CHAVE.id], 'a fila não esvaziou').toBeUndefined();
    expect(sim.state.chavesAcesso[CHAVE.id]).toBe(2);
  });

  it('e o que cai enquanto a resposta viaja continua na fila', async () => {
    const guardado: Record<string, number> = {};
    const sim = new Sim(createState(3));
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as { ganhos?: Record<string, number> };
        for (const [id, n] of Object.entries(corpo.ganhos ?? {})) guardado[id] = (guardado[id] ?? 0) + n;
        sim.adquirirChave(CHAVE.id); // cai mais uma DEPOIS do envio
      }
      return { ok: true, json: async () => ({ chaves: { ...guardado }, acesso: null }) } as unknown as Response;
    });

    await sincronizarChaves(sim);
    sim.adquirirChave(CHAVE.id);
    await drenarChaves(sim);

    expect(sim.state.chavesPendentes[CHAVE.id], 'a chave do meio do caminho sumiu').toBe(1);
    expect(sim.state.chavesAcesso[CHAVE.id], 'o jogador perdeu a chave que acabou de ver').toBe(2);
  });

  it('a rede fora guarda o ganho para a próxima tentativa', async () => {
    servidor();
    const sim = new Sim(createState(4));
    await sincronizarChaves(sim);
    sim.adquirirChave(CHAVE.id);

    vi.stubGlobal('fetch', async () => { throw new Error('rede fora'); });
    await drenarChaves(sim);

    expect(sim.state.chavesPendentes[CHAVE.id]).toBe(1);
  });
});

describe('gastar a chave é pedido, não declaração', () => {
  beforeEach(() => { vi.unstubAllGlobals(); esquecerChaves(); });

  function servidorSimples(estoque: Record<string, number>) {
    const guardado = { ...estoque };
    let acesso: string | null = null;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const corpo = init?.body
        ? JSON.parse(String(init.body)) as { acao?: string; chave?: string; boss?: string }
        : {};
      if (corpo.acao === 'consumir') {
        if ((guardado[corpo.chave!] ?? 0) <= 0) {
          return { ok: false, status: 409, json: async () => ({ erro: 'sem_chave' }) } as unknown as Response;
        }
        guardado[corpo.chave!] = guardado[corpo.chave!]! - 1;
        acesso = corpo.boss ?? null;
      }
      return { ok: true, json: async () => ({ chaves: { ...guardado }, acesso }) } as unknown as Response;
    });
    return { estoque: () => ({ ...guardado }) };
  }

  it('o servidor confirma, e só então a nave entra', async () => {
    const s = servidorSimples({ [CHAVE.id]: 1 });
    const sim = new Sim(createState(5));
    await sincronizarChaves(sim);
    sim.jumpSector(10);
    expect(sim.state.run.sector, 'entrou antes de pagar').toBe(1);

    expect(await consumirChaveNoServidor(sim, CHAVE.id, CHAVE.bossId)).toBe(true);
    sim.entrarNoChefe(CHAVE.bossId);

    expect(s.estoque()[CHAVE.id], 'o servidor não cobrou').toBe(0);
    expect(sim.state.chavesAcesso[CHAVE.id] ?? 0, 'o espelho não acompanhou a cobrança').toBe(0);
    expect(sim.state.run.sector).toBe(10);
  });

  it('o servidor recusa, e a nave NÃO entra', async () => {
    servidorSimples({});
    const sim = new Sim(createState(6));
    await sincronizarChaves(sim);
    sim.jumpSector(10);

    expect(await consumirChaveNoServidor(sim, CHAVE.id, CHAVE.bossId)).toBe(false);
    expect(sim.state.run.sector, 'entrou com o servidor dizendo não').toBe(1);
    expect(sim.state.run.chaveAcessoConsumida).toBeUndefined();
  });

  it('e o cliente não consegue gastar declarando — só ganho sobe na fila', () => {
    // A fila é de GANHO. Não existe caminho para um número negativo nela: a
    // única escrita é `adquirirChave`, e o gasto sai por `consumirChaveNoServidor`.
    const sim = new Sim(createState(7));
    sim.adquirirChave(CHAVE.id);
    expect(Object.values(sim.state.chavesPendentes).every((n) => n > 0)).toBe(true);
  });
});

describe('a fila sobrevive, e o estoque não sobe no save', () => {
  it('a recarga com a nuvem vencendo não perde a chave que caiu', () => {
    const local = createState(8);
    local.chavesPendentes = { [CHAVE.id]: 2 };

    expect(comAsFilasDaqui(createState(9), local).chavesPendentes[CHAVE.id]).toBe(2);
  });
});
