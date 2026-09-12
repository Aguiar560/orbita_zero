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

/**
 * O Armazém — o terceiro achado, de 12/09/2026.
 *
 * Rafael relatou que o material do desmanche entrava e sumia pouco depois. A
 * medição no D1 fechou o caso: a tabela `materiais` tinha DOZE linhas no jogo
 * inteiro, quase todas `ferrita`, porque a única rota que gravava material era
 * `/ausencia`. O desmanche acordado creditava só a memória da aba, e a resposta
 * seguinte de `/progresso` escrevia o armazém do servidor por cima —
 * `drenarProgresso` mandava `materiais: {}` em toda drenagem.
 *
 * A regra que estes testes guardam é a que ele pediu com todas as letras: o que
 * for desmanchado não pode ser perdido de forma alguma.
 */
describe('o Armazém não perde o que foi desmanchado', () => {
  let enviados: Record<string, unknown>[] = [];

  /**
   * Um servidor falso que se comporta como o de verdade.
   *
   * Ele ACUMULA o delta e devolve o total, que é o que a rota faz:
   * `quantia = MAX(0, quantia + d)`, e a resposta é lida depois do `batch`.
   *
   * O primeiro rascunho destes testes usava um servidor que aceitava o delta e
   * devolvia sempre `{}`. Dois testes falharam — e estavam certos em falhar: o
   * cliente esvazia a fila quando o servidor confirma e passa a confiar no que
   * volta. Um servidor que confirma sem devolver não existe nesta rota, e o
   * teste precisava parecer com o real para provar alguma coisa.
   */
  function servidorDeMaterial(): { total: () => Record<string, number> } {
    enviados = [];
    const guardado: Record<string, number> = {};
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as { materiais?: Record<string, number> };
        enviados.push(corpo as Record<string, unknown>);
        for (const [id, d] of Object.entries(corpo.materiais ?? {})) {
          guardado[id] = Math.max(0, (guardado[id] ?? 0) + d);
        }
      }
      return {
        ok: true,
        json: async () => ({
          xp: 0, nivel: 1, melhorSetor: 1, matriz: [],
          naves: {}, materiais: { ...guardado }, cascoEmCampo: '',
        }),
      } as unknown as Response;
    });
    return { total: () => ({ ...guardado }) };
  }

  beforeEach(() => { vi.unstubAllGlobals(); esquecerProgresso(); });

  it('o desmanche sobe como delta, em vez de um mapa vazio', async () => {
    const servidor = servidorDeMaterial();
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);

    sim.guardarMaterial('ferrita', 40);
    await drenarProgresso(sim);

    expect(enviados.filter((c) => 'xp' in c).at(-1)?.materiais,
      'o desmanche não foi declarado ao servidor').toEqual({ ferrita: 40 });
    expect(servidor.total().ferrita, 'não chegou ao servidor').toBe(40);
    expect(sim.state.armazem.ferrita, 'sumiu do armazém do jogador').toBe(40);
    expect(sim.state.materiaisPendentes.ferrita, 'a fila não esvaziou').toBeUndefined();
  });

  it('o gasto da fabricação sobe NEGATIVO', async () => {
    // Enfileirar só o ganho seria pior que o defeito original: o servidor
    // devolveria o material já gasto na adoção seguinte — infinito por engano.
    const servidor = servidorDeMaterial();
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);

    sim.guardarMaterial('ferrita', 40);
    sim.gastarMaterial('ferrita', 30);
    await drenarProgresso(sim);

    expect(enviados.filter((c) => 'xp' in c).at(-1)?.materiais).toEqual({ ferrita: 10 });
    expect(servidor.total().ferrita).toBe(10);
    expect(sim.state.armazem.ferrita).toBe(10);
  });

  it('o que foi desmanchado enquanto a resposta viajava NÃO some', async () => {
    /**
     * O caso que o defeito original tornava invisível: a resposta descreve um
     * instante ANTERIOR ao último desmanche. A limpeza subtrai o que foi
     * ENVIADO, por chave, e `adotar` soma o resto da fila por cima.
     */
    const sim = new Sim(createState(1));
    const guardado: Record<string, number> = {};
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as { materiais?: Record<string, number> };
        for (const [id, d] of Object.entries(corpo.materiais ?? {})) {
          guardado[id] = Math.max(0, (guardado[id] ?? 0) + d);
        }
        // Cai mais material DEPOIS de o corpo ter sido montado e enviado.
        sim.guardarMaterial('ferrita', 5);
      }
      return {
        ok: true,
        json: async () => ({
          xp: 0, nivel: 1, melhorSetor: 1, matriz: [],
          naves: {}, materiais: { ...guardado }, cascoEmCampo: '',
        }),
      } as unknown as Response;
    });

    await sincronizarProgresso(sim);
    sim.guardarMaterial('ferrita', 40);
    await drenarProgresso(sim);

    expect(sim.state.materiaisPendentes.ferrita, 'o que caiu no meio do caminho sumiu da fila')
      .toBe(5);
    expect(sim.state.armazem.ferrita, 'o jogador perdeu o desmanche do meio do caminho')
      .toBe(45);
  });

  it('e nada é contado duas vezes na drenagem seguinte', async () => {
    const servidor = servidorDeMaterial();
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);

    sim.guardarMaterial('ferrita', 40);
    await drenarProgresso(sim);
    await drenarProgresso(sim);

    expect(servidor.total().ferrita, 'o mesmo desmanche entrou duas vezes no servidor').toBe(40);
    expect(sim.state.armazem.ferrita).toBe(40);
    expect(sim.state.materiaisPendentes.ferrita).toBeUndefined();
  });

  it('a rede fora guarda o desmanche para a próxima tentativa', async () => {
    // `drenarProgresso` sai antes de mexer na fila quando a resposta não vem.
    // É o que faz fechar a aba com a rede caída não custar o desmanche.
    servidorDeMaterial();
    const sim = new Sim(createState(1));
    await sincronizarProgresso(sim);

    sim.guardarMaterial('ferrita', 40);
    vi.stubGlobal('fetch', async () => { throw new Error('rede fora'); });
    await drenarProgresso(sim);

    expect(sim.state.materiaisPendentes.ferrita, 'a fila esvaziou sem confirmação').toBe(40);
    expect(sim.state.armazem.ferrita).toBe(40);
  });

  it('e a fila sobrevive à recarga com a nuvem vencendo', () => {
    const local = createState(1);
    local.materiaisPendentes = { ferrita: 40 };

    expect(comAsFilasDaqui(createState(2), local).materiaisPendentes.ferrita).toBe(40);
  });
});
