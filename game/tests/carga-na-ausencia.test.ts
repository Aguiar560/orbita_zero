/**
 * A carga da incursão vale o mesmo com a aba aberta e com ela fechada.
 *
 * ## A regra, decidida em 04/09
 *
 * *"Tem que ser igual ao ao vivo: se morrer perde a carga, se completar o setor
 * fica com a carga."*
 *
 * ## O que estava errado
 *
 * O cliente mandava para `/ausencia` só `hull`, `setor`, `onda` e `postura` — a
 * carga NÃO ia. O servidor simulava a partir de um porão vazio, produzia carga
 * ao abater, e no fim gravava de volta progresso, naves, materiais e itens, mas
 * **não `run`**. A carga da ausência morria com a requisição.
 *
 * O sintoma que apareceu primeiro foi outro: um relatório de doze minutos com
 * "22 abates" e nenhuma moeda. Era verdade — não havia moeda nenhuma.
 *
 * ## Por que quase nada disto precisou de código novo
 *
 * Porque as duas metades da regra já existiam na simulação compartilhada:
 * `failEncounter` chama `dropCarga`, e `completeEncounter` chama `bankCarga`. O
 * caminho abstrato usa as mesmas funções. Faltava só a carga ENTRAR e VOLTAR.
 */

import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { WAVES_PER_SECTOR } from '@sim/progression';

describe('morrer perde a carga', () => {
  it('no caminho abstrato, igual ao ao vivo', () => {
    const sim = new Sim(createState(91));
    sim.jumpSector(4);
    sim.state.run.carga = { sucata: 5000, nucleo: 40, cristal: 2 };

    sim.failEncounter();

    expect(sim.state.run.carga.sucata).toBe(0);
    expect(sim.state.run.carga.nucleo).toBe(0);
  });
});

describe('concluir o setor guarda a carga', () => {
  it('ela vira saldo, e o porão zera', () => {
    const sim = new Sim(createState(92));
    sim.jumpSector(4);
    const antes = sim.state.resources.sucata;
    sim.state.run.carga = { sucata: 5000, nucleo: 40, cristal: 2 };
    sim.state.run.wave = WAVES_PER_SECTOR + 1;

    sim.completeEncounter(true);

    expect(sim.state.resources.sucata).toBeGreaterThan(antes);
    expect(sim.state.run.carga.sucata).toBe(0);
  });
});

describe('a incursão volta do servidor', () => {
  it('a carga sobrevivente é adotada', () => {
    // O que o cliente faz com a resposta de `/ausencia`.
    const sim = new Sim(createState(93));
    sim.jumpSector(9);
    sim.adotarIncursao(3, { sucata: 1234, nucleo: 7, cristal: 0 });

    expect(sim.state.run.carga.sucata).toBe(1234);
    expect(sim.state.run.carga.nucleo).toBe(7);
    expect(sim.state.run.wave).toBe(3);
  });

  it('e valor invalido vira zero em vez de contaminar o estado', () => {
    const sim = new Sim(createState(94));
    sim.jumpSector(9);
    sim.adotarIncursao(2, { sucata: Number.NaN, nucleo: -50, cristal: 3 } as never);

    expect(sim.state.run.carga.sucata).toBe(0);
    expect(sim.state.run.carga.nucleo).toBe(0);
    expect(sim.state.run.carga.cristal).toBe(3);
  });

  it('mas o SETOR não — a ausência não avança de setor', () => {
    // A nave fica onde o jogador a deixou. `adotarIncursao` não recebe setor
    // justamente para essa regra não poder ser furada por aqui.
    const sim = new Sim(createState(95));
    sim.jumpSector(9);
    sim.adotarIncursao(4, { sucata: 10, nucleo: 0, cristal: 0 });
    expect(sim.state.run.sector).toBe(9);
  });
});
