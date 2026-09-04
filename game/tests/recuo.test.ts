/**
 * A parede do chefe: o jogo OFERECE recuar, e não recua.
 *
 * ## As duas metades disto
 *
 * **O problema é real e foi medido.** `failEncounter` contava `falhasNoSetor` e
 * ninguém lia o contador: o laço reiniciava o MESMO setor para sempre. Com
 * `npm run simular -- ganho 5 25 10 3600`, uma hora por setor com o build
 * representativo, o setor 25 acumulava **225 mortes, zero setores concluídos e
 * zero XP**. Num idle isso acontece com a aba fechada — o jogador só descobre
 * no dia seguinte, e descobre como "o jogo não rendeu nada".
 *
 * **A solução não é o jogo decidir.** A primeira versão recuava sozinha, e
 * estava errada pelo mesmo motivo que `completeEncounter` não avança sozinho:
 * mover a fase por conta própria tira do jogador a decisão que a trava de fase
 * existe para dar. O argumento já estava escrito no código, para o avanço — eu
 * o apliquei numa direção só.
 *
 * Então o que estes testes protegem é uma coisa e o contrário dela: que o aviso
 * apareça, e que o estado NÃO mude sem alguém pedir.
 */

import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { bus } from '@app/Bus';

/** Mata a nave `n` vezes no setor atual. */
const matar = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) sim.failEncounter();
};

/** Coleta os avisos de parede emitidos durante `corpo`. */
function avisos(corpo: () => void): { setor: number; quedas: number }[] {
  const vistos: { setor: number; quedas: number }[] = [];
  const solta = bus.on('sector:parede', (p) => vistos.push(p));
  try { corpo(); } finally { solta(); }
  return vistos;
}

describe('o jogo AVISA depois de três quedas', () => {
  it('duas quedas não avisam', () => {
    // Uma queda é azar — a rolagem do encontro varia. Avisar na primeira seria
    // barulho sobre uma morte que o jogador já ia superar.
    const sim = new Sim(createState(1));
    sim.jumpSector(10);
    expect(avisos(() => matar(sim, 2))).toEqual([]);
  });

  it('a terceira avisa, com o setor e a contagem', () => {
    const sim = new Sim(createState(2));
    sim.jumpSector(10);
    const vistos = avisos(() => matar(sim, 3));
    expect(vistos).toEqual([{ setor: 10, quedas: 3 }]);
  });

  it('não avisa no setor 1, onde não há para onde recuar', () => {
    const sim = new Sim(createState(3));
    sim.jumpSector(1);
    expect(avisos(() => matar(sim, 9))).toEqual([]);
  });

  it('avisa UMA vez por visita ao setor', () => {
    // Reoferecer a cada três quedas viraria uma janela piscando durante a noite
    // inteira, e a segunda oferta não traz informação nova nenhuma.
    const sim = new Sim(createState(4));
    sim.jumpSector(10);
    expect(avisos(() => matar(sim, 12))).toHaveLength(1);
  });

  it('avisa de novo depois de trocar de setor e bater outra vez', () => {
    // Aí a situação mudou de verdade: é outro lugar, e o jogador pode não saber
    // que este também está acima do poder da nave.
    const sim = new Sim(createState(5));
    sim.jumpSector(10);
    matar(sim, 3);
    sim.jumpSector(11);
    expect(avisos(() => matar(sim, 3))).toEqual([{ setor: 11, quedas: 3 }]);
  });
});

describe('o jogo NÃO recua sozinho', () => {
  it('doze quedas não movem a fase', () => {
    // É o teste central deste arquivo. A versão anterior recuava aqui, e o
    // jogador voltava para encontrar a nave num setor que ele não escolheu.
    const sim = new Sim(createState(6));
    sim.jumpSector(20);
    matar(sim, 12);
    expect(sim.state.run.sector).toBe(20);
  });

  it('nem pelo caminho abstrato, com a aba fechada', () => {
    // O caso que mais tentaria automatizar: ninguém está olhando. É exatamente
    // por isso que mexer sozinho aqui é pior — o jogador volta e não entende o
    // que aconteceu com a fase dele.
    const sim = new Sim(createState(7));
    sim.jumpSector(25);
    for (let i = 0; i < 6; i++) {
      sim.state.run.vidaFracao = 0;
      sim.abstractTick(0.5);
    }
    expect(sim.state.run.sector).toBe(25);
  });
});

describe('quando o jogador PEDE para recuar', () => {
  it('desce um setor e zera o contador de quedas', () => {
    const sim = new Sim(createState(8));
    sim.jumpSector(10);
    matar(sim, 3);
    expect(sim.recuarUmSetor()).toBe(true);
    expect(sim.state.run.sector).toBe(9);
    expect(sim.state.run.falhasNoSetor).toBe(0);
  });

  it('não desce abaixo do setor 1', () => {
    const sim = new Sim(createState(9));
    sim.jumpSector(1);
    expect(sim.recuarUmSetor()).toBe(false);
    expect(sim.state.run.sector).toBe(1);
  });

  it('o acesso ao setor conquistado NÃO volta', () => {
    // `bestSector` é o que abre a fase no mapa. Recuar move o ponteiro, não
    // desfaz conquista — senão morrer três vezes custaria conteúdo.
    const sim = new Sim(createState(10));
    sim.jumpSector(30);
    const antes = sim.state.universe.bestSector;
    sim.recuarUmSetor();
    expect(sim.state.universe.bestSector).toBe(antes);
    expect(sim.state.universe.bestSectorEver).toBeGreaterThanOrEqual(30);
  });

  it('não des-limpa o que já foi limpo', () => {
    const sim = new Sim(createState(11));
    sim.jumpSector(10);
    sim.state.run.cleared = 7;
    sim.recuarUmSetor();
    expect(sim.state.run.cleared).toBe(7);
  });
});
