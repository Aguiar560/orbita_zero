/**
 * Item que não cabe NÃO é coletado.
 *
 * ## O que era feito antes
 *
 * `rollDrops` tirava a peça do lote e entregava; `stash` descobria que o
 * Inventário estava cheio e a jogava fora. O jogador gastava uma peça do lote —
 * que tem cursor e não volta — para receber nada, e o servidor gravava e
 * apagava uma linha à toa no mesmo ciclo.
 *
 * A correção é espiar antes de consumir. O teste guarda as duas metades: que a
 * peça FICA no lote, e que a automação que o jogador pediu continua valendo.
 */

import { describe, expect, it } from 'vitest';

import { bus } from '@app/Bus';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

const peca = (uid: string, rarity: number) => ({
  uid, baseId: 'b', slot: 'principal', rarity, ilvl: 90,
  affixes: [], icon: 'i', origin: 0,
});

/** Sim com o Inventário lotado de peças ÓTIMAS e um lote de peças ruins. */
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

describe('Inventário cheio', () => {
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

describe('os três desfechos do Inventário cheio', () => {
  /**
   * Relatado em 04/09: *"o inventário está full, e ao pegar um item não está
   * mostrando a mensagem e também não sei o que está sendo feito com o item"*.
   *
   * O aviso existia para UM caso só — a peça que não é coletada. Os outros dois
   * aconteciam em silêncio, e são os mais comuns: com desmanche automático
   * ligado, a peça É coletada e desfeita na hora, e a cápsula sumia sem o
   * inventário mudar.
   *
   * Os três precisam de textos diferentes porque só o primeiro é uma perda.
   */
  const eventos = (sim: Sim, corpo: () => void): string[] => {
    const vistos: string[] = [];
    const off = bus.on('inventario:cheio', ({ motivo }) => vistos.push(motivo));
    try { corpo(); } finally { off(); }
    return vistos;
  };

  it('a peça que não cabe avisa que NÃO foi coletada', () => {
    const sim = lotado(21);
    expect(eventos(sim, () => { sim.rollDrops('chefe'); })).toContain('nao-coletado');
  });

  it('a peça desfeita ao coletar avisa que foi desfeita', () => {
    // Cheio de peças MELHORES: a que chega é pior, então é ela que se desfaz.
    const sim = lotado(22);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`bom${i}`, 3));
    expect(eventos(sim, () => { sim.acquire(peca('ruim', 0)); })).toContain('descartada');
  });

  it('e a troca avisa que foi troca — ali o jogador GANHOU', () => {
    // O contrapeso: pintar os três de vermelho ensinaria a ignorar a mensagem.
    const sim = lotado(23);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`ruim${i}`, 0));
    expect(eventos(sim, () => { sim.acquire(peca('bom', 4)); })).toContain('trocada');
  });
});
