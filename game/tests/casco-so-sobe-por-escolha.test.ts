import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { drenarProgresso, sincronizarProgresso } from '@app/progresso';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { HULLS } from '@data/hulls';

/**
 * O casco em campo só sobe quando o JOGADOR escolhe.
 *
 * ## O defeito
 *
 * A primeira versão mandava `state.hull` em toda drenagem. Só que `state.hull`
 * também muda por CONSERTO — `casarCascoComAFrota` o demove quando a frota não
 * tem a nave, e ele troca sozinho por falta de combustível. Qualquer um desses
 * ajustes locais virava uma ordem para o servidor.
 *
 * Aconteceu em 08/09: o Rafael trocou para a Vetor VC-1, o servidor gravou
 * `void_canhao`, e uma aba com o pacote antigo em cache subiu `nucleo_vektor`
 * por cima — apagando a escolha no servidor, que é a única cópia que sobrevive
 * à recarga. Ele mesmo isolou a causa: "se eu dou ctrl f5 não acontece isso".
 *
 * O cache era o gatilho; o defeito é o cliente poder mandar uma correção local
 * como se fosse intenção. Com a escolha explícita, o pior que um cliente velho
 * faz é não mandar nada.
 */

const primeiro = HULLS[0]!.id;
const segundo = HULLS[1]!.id;

/** Os corpos que saíram em cada POST, para conferir o que o cliente mandou. */
let enviados: Record<string, unknown>[] = [];

function servidorFalso(cascoGuardado = ''): void {
  enviados = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (init?.body) enviados.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const corpo = enviados.at(-1);
    // O servidor grava o casco só quando ele vem, e devolve o que ficou.
    if (typeof corpo?.casco === 'string') cascoGuardado = corpo.casco as string;
    return {
      ok: true,
      json: async () => ({
        xp: 0, nivel: 1, melhorSetor: 1, matriz: [], naves: {}, materiais: {},
        cascoEmCampo: cascoGuardado,
      }),
    } as unknown as Response;
  });
}

function simComFrota(): Sim {
  const estado = createState(1);
  estado.fleet = [primeiro, segundo];
  estado.hull = primeiro;
  return new Sim(estado);
}

describe('a drenagem de progresso', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('NÃO manda o casco quando ninguém escolheu nada', async () => {
    /**
     * É a asserção que impede o defeito de voltar. Uma aba que só está jogando
     * não tem opinião sobre qual nave está em campo — quem tem é o servidor.
     */
    servidorFalso(segundo);
    const sim = simComFrota();
    await sincronizarProgresso(sim);
    await drenarProgresso(sim);

    const posts = enviados.filter((c) => 'xp' in c);
    expect(posts.length, 'era para ter havido um envio').toBeGreaterThan(0);
    for (const c of posts) expect(c.casco, 'mandou casco sem ninguém ter escolhido').toBeUndefined();
  });

  it('e a escolha do servidor vence a nave que estava na tela', async () => {
    // O outro lado da regra: quem manda é a linha do servidor.
    servidorFalso(segundo);
    const sim = simComFrota();
    expect(sim.state.hull).toBe(primeiro);
    await sincronizarProgresso(sim);
    expect(sim.state.hull).toBe(segundo);
  });

  it('mas manda quando o jogador escolhe, e insiste até o servidor confirmar', async () => {
    servidorFalso('');
    const sim = simComFrota();
    await sincronizarProgresso(sim);

    await drenarProgresso(sim, segundo);
    expect(enviados.at(-1)?.casco).toBe(segundo);

    // Confirmado: a próxima drenagem não repete a ordem.
    await drenarProgresso(sim);
    expect(enviados.at(-1)?.casco).toBeUndefined();
  });

  it('e um casco que não é da pessoa nunca sobe', async () => {
    // O modo de teste deixa pilotar o catálogo inteiro. Mandar isso ao servidor
    // seria pedir uma nave de graça.
    servidorFalso('');
    const sim = simComFrota();
    await sincronizarProgresso(sim);

    await drenarProgresso(sim, 'casco_que_nao_e_meu');
    expect(enviados.at(-1)?.casco).toBeUndefined();
  });
});
