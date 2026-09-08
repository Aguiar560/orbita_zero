import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * Recarregar a página não pode devolver os inimigos já abatidos.
 *
 * Relatado pelo Rafael em 09/09: "ao recarregar deveria parar de onde estava e
 * não voltar do começo".
 *
 * O construtor do `Sim` chamava `refreshEncounter`, que zera `run.restam`. Como
 * ele roda a cada recarga, a onda voltava inteira — e junto com ela o tempo de
 * abater tudo de novo, que num idle é a moeda que mais importa.
 *
 * A cena não precisa saber quem já morreu: o encontro termina por `run.restam`
 * chegar a zero, e o `WaveDirector` repõe a onda enquanto faltar abater. Então
 * retomar é só não mentir sobre quantos faltam.
 */

/** Recarregar a página é construir um `Sim` novo com o save que estava lá. */
const recarregar = (sim: Sim): Sim => new Sim(JSON.parse(JSON.stringify(sim.state)));

describe('recarregar no meio da onda', () => {
  it('mantém o que já foi abatido', () => {
    const sim = new Sim(createState(11));
    sim.state.run.sector = 2;
    sim.state.run.wave = 2;
    sim.refreshEncounter();

    const total = sim.state.run.unidades;
    expect(total).toBeGreaterThan(4);
    sim.creditKill(Math.floor(total / 2));
    const faltavam = sim.state.run.restam;
    expect(faltavam).toBeLessThan(total);

    expect(recarregar(sim).state.run.restam, 'a recarga devolveu os abatidos')
      .toBe(faltavam);
  });

  it('e não retoma o TEMPO do encontro, que a ausência já paga', () => {
    /**
     * `elapsed` mede o tempo dentro do encontro. O tempo com a aba fechada é
     * creditado pelo caminho da ausência — somá-lo de novo aqui pagaria duas
     * vezes pelo mesmo intervalo.
     */
    const sim = new Sim(createState(11));
    sim.state.run.elapsed = 87;
    expect(recarregar(sim).state.run.elapsed).toBe(0);
  });

  it('e um save de antes de um rebalanceamento cai na onda INTEIRA', () => {
    /**
     * `unidades` é determinístico a partir de semente, setor e onda. Se o que
     * está salvo não bate com o que o jogo monta hoje, o número não significa
     * mais a mesma coisa — e aí vale a onda inteira, que é o lado seguro de
     * errar: dá trabalho ao jogador, não presente.
     */
    const sim = new Sim(createState(11));
    sim.state.run.sector = 2;
    sim.refreshEncounter();

    const salvo = JSON.parse(JSON.stringify(sim.state));
    salvo.run.unidades = 999;   // o mundo era outro quando isto foi gravado
    salvo.run.restam = 3;

    const depois = new Sim(salvo);
    expect(depois.state.run.restam).toBe(depois.state.run.unidades);
  });

  it('e restam zerado ou absurdo não trava o boot', () => {
    // A regra do projeto: save malformado não pode impedir jogar.
    for (const restam of [0, -5, Number.NaN, 10 ** 9]) {
      const sim = new Sim(createState(11));
      sim.refreshEncounter();
      const salvo = JSON.parse(JSON.stringify(sim.state));
      salvo.run.restam = restam;
      const depois = new Sim(salvo);
      expect(depois.state.run.restam).toBeGreaterThan(0);
      expect(depois.state.run.restam).toBeLessThanOrEqual(depois.state.run.unidades);
    }
  });
});
