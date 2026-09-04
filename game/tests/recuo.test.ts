/**
 * O recuo automático na parede do chefe.
 *
 * ## O que existia antes
 *
 * Nada. `failEncounter` contava `falhasNoSetor` e ninguém lia o contador: o
 * laço reiniciava o MESMO setor para sempre. A nave que não vence o chefe fica
 * morrendo até alguém abrir a aba e perceber — num idle, isso pode ser um dia
 * inteiro de nada.
 *
 * ## O tamanho do problema, medido
 *
 * `npm run simular -- ganho 5 25 10 3600`, uma hora de jogo por setor, com o
 * build representativo de cada um:
 *
 * | setor | | setores limpos | mortes |
 * |---|---|---|---|
 * | 5 | sem recuo | 0 | 112 |
 * | 5 | com recuo | **31** | **6** |
 * | 25 | sem recuo | 0 | 225 |
 * | 25 | com recuo | **31** | **21** |
 *
 * No setor 25 sem recuo: 225 mortes, zero setores concluídos e zero XP numa
 * hora inteira.
 */

import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/** Mata a nave `n` vezes no setor atual. */
const matar = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) sim.failEncounter();
};

describe('três falhas no mesmo setor fazem recuar', () => {
  it('duas falhas ainda não recuam', () => {
    // Uma falha é azar — a rolagem do encontro varia. Recuar na primeira
    // mandaria o jogador para trás por uma morte que ele já ia superar.
    const sim = new Sim(createState(1));
    sim.jumpSector(10);
    matar(sim, 2);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.state.run.falhasNoSetor).toBe(2);
  });

  it('a terceira recua um setor e zera o contador', () => {
    const sim = new Sim(createState(2));
    sim.jumpSector(10);
    matar(sim, 3);
    expect(sim.state.run.sector).toBe(9);
    expect(sim.state.run.falhasNoSetor).toBe(0);
  });

  it('recua UM por vez, não para o começo', () => {
    // Encontra o degrau mais alto que a nave vence. Despachar para o setor 1
    // jogaria fora todo o progresso que ela consegue sustentar.
    const sim = new Sim(createState(3));
    sim.jumpSector(20);
    matar(sim, 9);
    expect(sim.state.run.sector).toBe(17);
  });

  it('nunca recua abaixo do setor 1', () => {
    const sim = new Sim(createState(4));
    sim.jumpSector(1);
    matar(sim, 12);
    expect(sim.state.run.sector).toBe(1);
  });
});

describe('o que o recuo NÃO faz', () => {
  it('não tira o acesso ao setor conquistado', () => {
    // `bestSector` é o que abre a fase no mapa. O ponteiro volta; o acesso,
    // não — senão morrer três vezes custaria conteúdo já conquistado.
    const sim = new Sim(createState(5));
    sim.jumpSector(30);
    const antes = sim.state.universe.bestSector;
    matar(sim, 3);
    expect(sim.state.universe.bestSector).toBe(antes);
    expect(sim.state.universe.bestSectorEver).toBeGreaterThanOrEqual(30);
  });

  it('não des-limpa o que já foi limpo', () => {
    // `run.cleared` conta setores concluídos. A primeira versão o zerava no
    // recuo, e com isso apagava o único número que mostra se o recuo funcionou.
    const sim = new Sim(createState(6));
    sim.jumpSector(10);
    sim.state.run.cleared = 7;
    matar(sim, 3);
    expect(sim.state.run.cleared).toBe(7);
  });

  it('a onda volta ao começo do setor, como em qualquer falha', () => {
    const sim = new Sim(createState(7));
    sim.jumpSector(10);
    sim.state.run.wave = 4;
    matar(sim, 3);
    expect(sim.state.run.wave).toBe(1);
  });
});

describe('o recuo vale também fora do jogo', () => {
  it('o caminho abstrato recua', () => {
    /**
     * `completeEncounter` não AVANÇA no caminho abstrato, e de propósito: o
     * jogador escolheu aquela fase, e avançar sozinho o levaria para uma que
     * ele não escolheu.
     *
     * Recuar é o contrário disso. Ninguém escolhe morrer em série, e foi
     * exatamente o que a medição encontrou: 225 mortes numa hora, no setor 25,
     * sem sair do lugar.
     */
    const sim = new Sim(createState(8));
    sim.jumpSector(25);
    // Vida a zero força `failEncounter` pelo caminho abstrato.
    for (let i = 0; i < 3; i++) {
      sim.state.run.vidaFracao = 0;
      sim.abstractTick(0.5);
    }
    expect(sim.state.run.sector).toBeLessThan(25);
  });
});
