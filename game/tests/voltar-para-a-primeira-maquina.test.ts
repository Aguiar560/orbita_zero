import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { comAsFilasDaqui } from '@app/nuvem';
import { reconciliar } from '@app/nuvem';
import { SAVE_VERSION, createState } from '@sim/state';
import type { GameState } from '@sim/types';

/**
 * Joguei em A, depois em B, e voltei para A. O que eu encontro?
 *
 * Pergunta do Rafael em 08/09. A resposta depende de um detalhe que vale medir
 * em vez de deduzir: `playtime` é ACUMULADO e viaja dentro do save. Quando B
 * adota o save de A, B herda o tempo de A e continua somando — então o tempo de
 * B é sempre maior que o de A no momento em que A parou.
 *
 * Por isso voltar para A traz o progresso de B. O save velho de A perde por ser
 * o mais curto, que é exatamente o que se quer.
 *
 * O contra-exemplo está no fim do arquivo, e é o único jeito de o save velho
 * vencer: A ter jogado MAIS TEMPO sem conseguir subir.
 */

const nuvem = { estado: null as GameState | null, versao: 1 };
let subiu: GameState | null = null;

function nuvemFalsa(): void {
  subiu = null;
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      subiu = (JSON.parse(String(init.body)) as { estado: GameState }).estado;
      nuvem.estado = subiu;
      return { ok: true, status: 200, json: async () => ({ versao: ++nuvem.versao }) } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => (nuvem.estado
        ? { estado: nuvem.estado, versao: nuvem.versao, versaoDoSave: SAVE_VERSION }
        : { estado: null }),
    } as unknown as Response;
  });
}

/** Um save de alguém que já jogou, com marcas conferíveis. */
function jogador(playtime: number, missao: number): GameState {
  const s = createState(9);
  s.piloto = 'piloto_vektor';
  s.playtime = playtime;
  s.missoes = { contrato: { progresso: missao } } as never;
  return s;
}

describe('A → B → A', () => {
  beforeEach(() => { vi.unstubAllGlobals(); nuvem.estado = null; nuvem.versao = 1; });

  it('ao voltar para A, o progresso que vem é o de B', async () => {
    nuvemFalsa();

    // 1. A joga uma hora e sobe.
    const emA = jogador(3600, 5);
    expect((await reconciliar(emA)).acao).toBe('subiu');

    // 2. B entra sem save nenhum e recebe o de A.
    const maquinaB = createState(2);
    const chegouEmB = await reconciliar(maquinaB);
    expect(chegouEmB.acao).toBe('desceu');
    if (chegouEmB.acao !== 'desceu') return;
    expect(chegouEmB.estado.missoes).toEqual({ contrato: { progresso: 5 } });

    // 3. B joga mais meia hora. O tempo dele CONTINUA o de A — é isso que faz a
    //    conta fechar depois.
    const emB = comAsFilasDaqui(chegouEmB.estado, maquinaB);
    emB.playtime += 1800;
    emB.missoes = { contrato: { progresso: 9 } } as never;
    expect((await reconciliar(emB)).acao).toBe('subiu');

    // 4. A volta. O save local dele parou na hora 1, e a nuvem está em 1h30.
    const voltandoParaA = emA;
    const deVolta = await reconciliar(voltandoParaA);

    expect(deVolta.acao, 'A tinha um save mais curto e devia adotar o de B').toBe('desceu');
    if (deVolta.acao !== 'desceu') return;
    expect(deVolta.estado.missoes, 'voltou o progresso velho de A')
      .toEqual({ contrato: { progresso: 9 } });
    expect(deVolta.estado.playtime).toBe(5400);
  });

  it('e o save velho só vence se A tiver jogado MAIS tempo sem conseguir subir', async () => {
    /**
     * O contra-exemplo, e é o furo real: `playtime` é o critério, então uma
     * máquina que jogou muito com a rede fora ganha da que jogou pouco e
     * conseguiu subir. Não é acaso — é a regra escolhida, e ela prefere o save
     * mais longo. Fica registrado aqui para ninguém descobrir isso por acidente.
     */
    nuvemFalsa();

    const emB = jogador(3600, 9);
    expect((await reconciliar(emB)).acao).toBe('subiu');

    // A ficou offline e jogou duas horas sem subir nada.
    const emA = jogador(7200, 3);
    const r = await reconciliar(emA);

    expect(r.acao, 'o save mais longo é o que sobe').toBe('subiu');
    expect(subiu!.missoes, 'o progresso de B foi substituído pelo de A')
      .toEqual({ contrato: { progresso: 3 } });
  });
});
