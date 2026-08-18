import { describe, expect, it } from 'vitest';
import { HULLS } from '@data/hulls';
import { CARGA_MAXIMA } from '@data/balance/capacidade';
import { NIVEL_MAX } from '@data/balance/curvas';
import { Sim } from '@sim/index';

/**
 * O modo de teste libera o conteúdo para inspeção — e não pode cobrar nada por
 * isso ao sair.
 *
 * A versão anterior empurrava os cascos em `state.fleet` ao ligar e nunca os
 * tirava: quem ligasse para "dar uma olhada" ficava com o hangar inteiro no
 * save de verdade. O teste de reversibilidade existe para isso não voltar.
 */
describe('modo de teste', () => {
  it('libera alcance, frota, capacidade e material', () => {
    const sim = new Sim();
    sim.setTestMode(true);

    expect(sim.alcanceLiberado).toBe(NIVEL_MAX);
    expect(sim.nivelLiberado).toBe(NIVEL_MAX);
    expect(sim.frotaDisponivel.length).toBe(HULLS.length);
    expect(sim.cargoSlots).toBe(CARGA_MAXIMA);
    expect(sim.resourceSlots).toBe(CARGA_MAXIMA);
    expect(sim.materialDisponivel('ferrita')).toBe(Infinity);
    expect(sim.can('nucleo', 1e12)).toBe(true);
  });

  it('não grava nada no save — ligar e desligar devolve o estado intacto', () => {
    const sim = new Sim();
    const antes = JSON.stringify(sim.state);

    sim.setTestMode(true);
    // Mexe no que o modo libera, para provar que ler não escreve.
    void sim.frotaDisponivel; void sim.cargoSlots; void sim.alcanceLiberado;
    sim.selectHull(HULLS[HULLS.length - 1]!.id);
    sim.setTestMode(false);

    // `hull` pode ter mudado por `selectHull`; o resto tem de estar igual.
    const depois = JSON.parse(JSON.stringify(sim.state));
    const original = JSON.parse(antes);
    depois.hull = original.hull;
    expect(depois).toEqual(original);
  });

  it('volta a travar tudo ao desligar', () => {
    const sim = new Sim();
    sim.setTestMode(true);
    sim.setTestMode(false);

    expect(sim.alcanceLiberado).toBe(sim.state.universe.bestSectorEver);
    expect(sim.frotaDisponivel.length).toBeLessThan(HULLS.length);
    expect(sim.cargoSlots).toBeLessThan(CARGA_MAXIMA);
    expect(sim.can('nucleo', 1e12)).toBe(false);
  });
});
