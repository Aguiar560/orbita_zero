import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { reconciliar } from '@app/nuvem';
import { SAVE_VERSION, createState } from '@sim/state';

/**
 * Missões, eventos e o resto do progresso SEM TABELA atravessam máquinas?
 *
 * Pergunta do Rafael em 08/09: "se a pessoa logar em outra máquina, as missões,
 * eventos e etc não vão ser as mesmas?".
 *
 * A resposta é sim, e este arquivo é o que a mantém verdadeira. Esses campos não
 * têm tabela no servidor — eles viajam DENTRO do save que sobe para a nuvem.
 * `semODinheiro` arranca só o que já mora em tabela (dinheiro, frota, itens,
 * progressão), justamente para não existirem duas verdades; tudo o mais sobe
 * inteiro.
 *
 * O que este teste NÃO promete, e está escrito assim de propósito: o save é um
 * bloco só, e a reconciliação escolhe UM dos dois por tempo jogado. Não há
 * mescla campo a campo. Duas máquinas jogando em paralelo sobre esses campos
 * terminam com o bloco de uma delas — ao contrário do que é de tabela, que
 * soma. É dívida conhecida, e está no ROADMAP.
 */

const RESPOSTA = { valor: null as unknown };

function nuvemFalsa(): void {
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return { ok: true, status: 200, json: async () => ({ versao: 1 }) } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => RESPOSTA.valor,
    } as unknown as Response;
  });
}

describe('logar em outra máquina', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('traz missões, eventos, baús e códex junto com o save', async () => {
    /**
     * A máquina nova não tem save: `progressoDe` dela é zero, então a da nuvem
     * está mais adiantada e desce inteira. É o caso comum — e o que o Rafael
     * perguntou.
     */
    const naOutraMaquina = createState(7);
    naOutraMaquina.piloto = 'piloto_vektor';
    naOutraMaquina.playtime = 3600;
    naOutraMaquina.missoes = { alguma_missao: { progresso: 4 } } as never;
    naOutraMaquina.eventos = { algum_evento: { progresso: 9 } } as never;
    naOutraMaquina.chests = { comum: 3 } as never;
    naOutraMaquina.codex = ['inimigo_visto'] as never;
    naOutraMaquina.medalhas = 12;
    naOutraMaquina.confianca = { contato_x: 40 };

    RESPOSTA.valor = { estado: naOutraMaquina, versao: 3, versaoDoSave: SAVE_VERSION };
    nuvemFalsa();

    // Máquina recém-aberta: save novo, sem tempo de jogo.
    const aqui = createState(1);
    const r = await reconciliar(aqui);

    expect(r.acao, 'a nuvem está mais adiantada e tem de descer').toBe('desceu');
    if (r.acao !== 'desceu') return;

    expect(r.estado.missoes).toEqual({ alguma_missao: { progresso: 4 } });
    expect(r.estado.eventos).toEqual({ algum_evento: { progresso: 9 } });
    expect(r.estado.chests).toEqual({ comum: 3 });
    expect(r.estado.codex).toEqual(['inimigo_visto']);
    expect(r.estado.medalhas).toBe(12);
    expect(r.estado.confianca).toEqual({ contato_x: 40 });
  });

  it('e a máquina com MAIS tempo jogado é a que vence', async () => {
    /**
     * O critério é `playtime`, e não o relógio: ele é somado a partir de `dt`,
     * então não depende da hora de máquina nenhuma. Fixar isto por escrito é o
     * que impede alguém trocar por `Date.now()` — e aí o save de quem está com
     * o relógio adiantado passaria a ganhar sempre.
     */
    const daNuvem = createState(7);
    daNuvem.piloto = 'piloto_vektor';
    daNuvem.playtime = 60;

    RESPOSTA.valor = { estado: daNuvem, versao: 3, versaoDoSave: SAVE_VERSION };
    nuvemFalsa();

    const aqui = createState(1);
    aqui.piloto = 'piloto_vektor';
    aqui.playtime = 7200;

    const r = await reconciliar(aqui);
    expect(r.acao, 'o save daqui é o mais adiantado e tem de subir').toBe('subiu');
  });
});
