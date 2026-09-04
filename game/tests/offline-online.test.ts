/**
 * A fronteira entre jogar com a aba aberta e com ela fechada.
 *
 * ## As três regras, decididas em 04/09
 *
 * 1. **O ganho é o MESMO.** Abate paga XP e carga igual nos dois modos. Antes
 *    não pagava: `abstractTick` descontava os inimigos e seguia, então quem
 *    repetia um setor com a aba fechada não recebia nada.
 * 2. **A ausência não AVANÇA de setor.** A nave fica onde o jogador a deixou.
 *    Parar num setor que ela não vence tem de custar — a responsabilidade de
 *    escolher onde parar é dele.
 * 3. **Missão não conta com a aba fechada.** Só o jogo aberto registra o fato
 *    do abate.
 *
 * ## Por que a 3 precisa de teste
 *
 * Porque ela parece defeito. Depois da regra 1, a pergunta natural é "se o
 * ganho é igual nos dois modos, por que a missão não seria?" — e acrescentar o
 * registro no caminho abstrato é uma linha. O efeito seria missão de "derrube N
 * inimigos" se cumprindo sozinha durante a noite.
 */

import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Fato } from '@sim/missoes';

/** Coleta os fatos registrados durante `corpo`. */
function fatos(sim: Sim, corpo: () => void): Fato[] {
  const vistos: Fato[] = [];
  const original = sim.registrar.bind(sim);
  (sim as unknown as { registrar: (f: Fato) => void }).registrar = (f: Fato) => {
    vistos.push(f);
    original(f);
  };
  try { corpo(); } finally {
    (sim as unknown as { registrar: unknown }).registrar = original;
  }
  return vistos;
}

const abates = (fs: Fato[]): Fato[] => fs.filter((f) => f.tipo === 'abate');

describe('missão não conta com a aba fechada', () => {
  it('o caminho abstrato não registra fato de abate', () => {
    // A regra inteira em uma asserção. Se um dia `abstractTick` passar a
    // registrar, missão de abate se cumpre sozinha durante a noite.
    const sim = new Sim(createState(1));
    sim.jumpSector(3);
    const vistos = fatos(sim, () => {
      for (let t = 0; t < 120; t += 0.5) sim.abstractTick(0.5);
    });
    expect(abates(vistos)).toEqual([]);
  });

  it('a cena registra', () => {
    // O contrapeso: sem ele, o teste acima passaria com o registro quebrado
    // nos DOIS caminhos, e missão de abate nunca progrediria.
    const sim = new Sim(createState(2));
    sim.jumpSector(3);
    const vistos = fatos(sim, () => sim.rewardKill(0.5));
    expect(abates(vistos)).toHaveLength(1);
  });
});

describe('o ganho é o mesmo nos dois modos', () => {
  it('o caminho abstrato PAGA pelos abates', () => {
    // Era o defeito: `abstractTick` descontava `run.restam` e não pagava nada.
    const sim = new Sim(createState(3));
    sim.jumpSector(3);
    const antes = { xp: sim.state.command.xp, abates: sim.state.stats.kills };
    for (let t = 0; t < 60; t += 0.5) sim.abstractTick(0.5);
    expect(sim.state.command.xp).toBeGreaterThan(antes.xp);
    expect(sim.state.stats.kills).toBeGreaterThan(antes.abates);
  });

  it('a ausência não é descontada', () => {
    /**
     * `OFFLINE_EFFICIENCY` era 0,6, com o comentário "o offline rende menos que
     * jogar ativamente — de propósito". A regra passou a ser outra.
     *
     * O teste compara `applyOffline(n)` com n segundos de `abstractTick`: se o
     * desconto voltasse, o primeiro renderia menos.
     */
    const a = new Sim(createState(4));
    a.jumpSector(3);
    const r = a.applyOffline(600);

    const b = new Sim(createState(4));
    b.jumpSector(3);
    const antes = b.state.command.xp;
    for (let t = 0; t < 600; t += 0.5) b.abstractTick(0.5);
    const direto = b.state.command.xp - antes;

    expect(r.seconds).toBe(600);
    // Folga de 10%: `applyOffline` avança em passos de 2 s e o laço acima em
    // 0,5 s, e a integração da vida difere um pouco entre os dois grãos.
    expect(Math.abs(a.state.command.xp / Math.max(1, direto) - 1)).toBeLessThan(0.1);
  });
});

describe('a ausência não avança de setor', () => {
  it('concluir o setor com a aba fechada não move o ponteiro', () => {
    // A nave fica onde o jogador a deixou. `bestSector` sobe — o acesso é
    // conquistado —, mas a incursão continua onde estava.
    const sim = new Sim(createState(5));
    sim.jumpSector(2);
    const antes = sim.state.run.sector;
    sim.completeEncounter(true);
    expect(sim.state.run.sector).toBe(antes);
  });

  it('mas o acesso ao seguinte é liberado', () => {
    const sim = new Sim(createState(6));
    sim.jumpSector(2);
    sim.state.run.wave = 6;
    const antes = sim.state.universe.bestSector;
    sim.completeEncounter(true);
    expect(sim.state.universe.bestSector).toBeGreaterThan(antes);
  });
});
