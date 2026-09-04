/**
 * Item que não cabe NÃO é coletado.
 *
 * ## O que era feito antes
 *
 * `rollDrops` tirava a peça do lote e entregava; `stash` descobria que o
 * Armazém estava cheio e a jogava fora. O jogador gastava uma peça do lote —
 * que tem cursor e não volta — para receber nada, e o servidor gravava e
 * apagava uma linha à toa no mesmo ciclo.
 *
 * A correção é espiar antes de consumir. O teste guarda as duas metades: que a
 * peça FICA no lote, e que a automação que o jogador pediu continua valendo.
 */

import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';

const peca = (uid: string, rarity: number) => ({
  uid, baseId: 'b', slot: 'principal', rarity, ilvl: 90,
  affixes: [], icon: 'i', origin: 0,
});

/** Sim com o Armazém lotado de peças ÓTIMAS e um lote de peças ruins. */
function lotado(semente: number): Sim {
  const sim = new Sim(createState(semente));
  sim.jumpSector(3);
  sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`cheio${i}`, 5));
  sim.state.settings.autoSalvage = 0;
  sim.state.settings.autoEquip = false;
  const ruim = (tag: string) => Array.from({ length: 40 }, (_, i) => peca(`${tag}${i}`, 0));
  sim.receberLote({ onda: ruim('o'), elite: ruim('e'), chefe: ruim('c') } as never);
  return sim;
}

describe('Armazém cheio', () => {
  it('a peça continua no lote', () => {
    const sim = lotado(11);
    const antes = sim.pote!.chefe.length;
    expect(sim.rollDrops('chefe')).toEqual([]);
    expect(sim.pote!.chefe.length).toBe(antes);
  });

  it('e nenhum comando sobe para o servidor', () => {
    // A outra metade da economia: sem isto, o servidor recebia coletar+descartar
    // do mesmo uid — duas escritas em D1 para o inventário terminar igual.
    const sim = lotado(12);
    const antes = sim.state.comandosDeItem.length;
    sim.rollDrops('chefe');
    expect(sim.state.comandosDeItem.length).toBe(antes);
  });

  it('mas uma peça MELHOR que a pior guardada é coletada', () => {
    // "Cheio" não é motivo por si: se a peça troca com a pior, trocar é coletar.
    const sim = lotado(13);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`ruim${i}`, 0));
    expect(sim.rollDrops('chefe').length).toBeGreaterThan(0);
  });

  it('e o desmanche automático continua consumindo', () => {
    // `autoSalvage` é automação PEDIDA: ali a peça é consumida e paga em sucata.
    // Confundir isso com "não coube" desligaria o desmanche automático.
    const sim = lotado(14);
    sim.state.settings.autoSalvage = 5;
    expect(sim.rollDrops('chefe').length).toBeGreaterThan(0);
  });
});

describe('com espaço, nada muda', () => {
  it('a peça é coletada normalmente', () => {
    const sim = lotado(15);
    sim.state.inventory = [];
    const antes = sim.pote!.chefe.length;
    expect(sim.rollDrops('chefe').length).toBeGreaterThan(0);
    expect(sim.pote!.chefe.length).toBeLessThan(antes);
  });
});
