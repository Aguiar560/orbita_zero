/**
 * O contador do encontro tem de acompanhar quem TROCA o encontro.
 *
 * `run.restam` é o que decide quando um encontro acabou, e ele é escrito por
 * `refreshEncounter`. Trocar o encontro sem chamá-lo deixa o contador do
 * anterior valendo — e o sintoma depende de qual lado do buraco se está:
 *
 * - **Entrando na Provação:** o chefe declara `unidades: 1` e herdava o
 *   `restam` da onda comum. Medido em jogo: 50. O jogador tinha de derrubar o
 *   chefe cinquenta vezes.
 * - **Saindo dela:** volta-se ao jogo normal com o `restam` do chefe, e a onda
 *   seguinte fecharia no primeiro abate.
 *
 * O segundo nunca foi relatado, o que é o de sempre: o defeito que dá trabalho
 * a mais é notado, o que dá de graça não.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';

const nova = (): Sim => {
  const s = new Sim(createState(7));
  // O modo de teste libera qualquer piso e dá tentativas, que é o que permite
  // testar a mecânica sem simular a progressão inteira até lá.
  s.setTestMode(true);
  return s;
};

describe('a Provação sincroniza o contador do encontro', () => {
  let sim: Sim;
  beforeEach(() => { sim = nova(); });

  it('entrar num piso zera o contador para o do chefe', () => {
    // Põe o `restam` num valor de onda comum, como estaria jogando.
    sim.refreshEncounter();
    const daOnda = sim.state.run.restam;
    expect(daOnda, 'a onda comum precisa ter mais de um alvo para o teste valer')
      .toBeGreaterThan(1);

    expect(sim.iniciarPisoDaProvacao(1)).toBe(true);

    expect(sim.encounter.unidades, 'o chefe da Provação é uma cabeça só').toBe(1);
    expect(sim.state.run.restam, 'o contador tem de seguir o encontro novo').toBe(1);
  });

  it('sair de um piso devolve o contador da onda', () => {
    expect(sim.iniciarPisoDaProvacao(1)).toBe(true);
    expect(sim.state.run.restam).toBe(1);

    sim.falharPisoDaProvacao(1, { tempo: 10, danoCausado: 0, danoRecebido: 1 });

    expect(sim.desafio, 'o desafio fecha ao falhar').toBeNull();
    expect(sim.state.run.restam, 'a onda comum não pode fechar num abate')
      .toBe(sim.encounter.unidades);
    expect(sim.state.run.restam).toBeGreaterThan(1);
  });

  it('vencer um piso também devolve o contador', () => {
    expect(sim.iniciarPisoDaProvacao(1)).toBe(true);
    sim.concluirPisoDaProvacao(1, { tempo: 10, danoCausado: 100, danoRecebido: 0 });

    expect(sim.desafio).toBeNull();
    expect(sim.state.run.restam).toBe(sim.encounter.unidades);
  });

  it('o contador nunca fica dessincronizado do encontro', () => {
    // A afirmação geral, que é a que sobrevive a mudanças de mecânica: seja
    // qual for o caminho, `restam` sai igual a `unidades`.
    for (const caminho of ['entrar', 'falhar', 'vencer'] as const) {
      const s = nova();
      s.iniciarPisoDaProvacao(1);
      if (caminho === 'falhar') s.falharPisoDaProvacao(1, { tempo: 1, danoCausado: 0, danoRecebido: 1 });
      if (caminho === 'vencer') s.concluirPisoDaProvacao(1, { tempo: 1, danoCausado: 1, danoRecebido: 0 });
      expect(s.state.run.restam, `caminho: ${caminho}`).toBe(s.encounter.unidades);
    }
  });
});
