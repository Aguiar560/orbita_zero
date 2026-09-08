import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { comAsFilasDaqui } from '@app/nuvem';
import { drenarProgresso, esquecerProgresso, sincronizarProgresso } from '@app/progresso';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * "Ao atualizar a página nada pode ser perdido."
 *
 * Pedido do Rafael em 08/09, depois de a escolha de nave se perder numa
 * recarga. A auditoria que ele pediu percorreu os 30 campos do save e cruzou
 * dois critérios: o campo sobe para a nuvem? o servidor o devolve no boot?
 *
 * Sobraram dois achados, e é o que este arquivo guarda.
 */

describe('as filas de saída sobrevivem ao save da nuvem', () => {
  it('`pendentes` e `comandosDeItem` não somem quando a nuvem vence', () => {
    /**
     * `semODinheiro` arranca as duas de propósito — são fila de SAÍDA, e subi-las
     * faria o outro aparelho baixar movimentos que este ainda vai enviar.
     *
     * A consequência era adotar o save da nuvem ZERAR as duas. Tudo que o
     * jogador fez e ainda não foi confirmado — coletar, equipar, descartar, um
     * ganho de sucata com a rede fora — sumia na recarga, sem sintoma nenhum.
     *
     * Preservar é seguro porque a fila só é esvaziada quando o servidor
     * CONFIRMA: o que está nela ainda não foi aplicado em lugar nenhum.
     */
    const local = createState(1);
    local.pendentes = [{ moeda: 'sucata', quantia: 120, motivo: 'drop' }] as never;
    local.comandosDeItem = [{ tipo: 'equipar', uid: 'x', nave: 'y' }] as never;

    const daNuvem = createState(2);
    daNuvem.pendentes = [];
    daNuvem.comandosDeItem = [];

    const juntado = comAsFilasDaqui(daNuvem, local);

    expect(juntado.pendentes, 'o ganho ainda não confirmado foi jogado fora')
      .toHaveLength(1);
    expect(juntado.comandosDeItem, 'o comando ainda não confirmado foi jogado fora')
      .toHaveLength(1);
    // E o resto continua sendo o save da nuvem, que é o ponto de adotá-lo.
    expect(juntado.universe.seed).toBe(daNuvem.universe.seed);
  });

  it('e nada é duplicado quando a nuvem já traz fila', () => {
    // Caso de borda: um save de nuvem antigo, gravado antes de `semODinheiro`
    // arrancar as filas, ainda pode trazer as suas.
    const local = createState(1);
    local.pendentes = [{ moeda: 'sucata', quantia: 1, motivo: 'drop' }] as never;
    const daNuvem = createState(2);
    daNuvem.pendentes = [{ moeda: 'nucleo', quantia: 2, motivo: 'drop' }] as never;

    expect(comAsFilasDaqui(daNuvem, local).pendentes).toHaveLength(2);
  });
});

describe('a Matriz', () => {
  let enviados: Record<string, unknown>[] = [];

  function servidorFalso(matrizGuardada: string[]): void {
    enviados = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as Record<string, unknown>;
        enviados.push(corpo);
        if (Array.isArray(corpo.matriz)) matrizGuardada = corpo.matriz as string[];
      }
      return {
        ok: true,
        json: async () => ({
          xp: 0, nivel: 1, melhorSetor: 1, matriz: matrizGuardada,
          naves: {}, materiais: {}, cascoEmCampo: '',
        }),
      } as unknown as Response;
    });
  }

  beforeEach(() => { vi.unstubAllGlobals(); esquecerProgresso(); });

  it('não sobe quando ninguém mexeu nela', async () => {
    /**
     * A Matriz sobe INTEIRA — o servidor grava a lista que chega por cima da
     * que tinha. Mandá-la em toda drenagem fazia de qualquer aba uma ordem, e
     * uma aba com o pacote antigo em cache desfazia a alocação feita na outra.
     *
     * É a mesma classe de defeito do casco em campo, e foi encontrada nesta
     * auditoria antes de alguém perder uma Matriz por causa dela.
     */
    servidorFalso(['inicio', 'no_a']);
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);
    expect(sim.state.command.allocated).toEqual(['inicio', 'no_a']);

    await drenarProgresso(sim);
    const posts = enviados.filter((c) => 'xp' in c);
    expect(posts.length).toBeGreaterThan(0);
    for (const c of posts) {
      expect(c.matriz, 'mandou a Matriz sem ninguém ter mexido nela').toBeUndefined();
    }
  });

  it('mas sobe assim que muda', async () => {
    servidorFalso(['inicio']);
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);

    sim.state.command.allocated = ['inicio', 'no_novo'];
    await drenarProgresso(sim);

    expect(enviados.at(-1)?.matriz).toEqual(['inicio', 'no_novo']);
  });
});
