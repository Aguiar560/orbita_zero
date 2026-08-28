/**
 * A dica da bolha de escudo.
 *
 * Ela aparece UMA vez, quando cai a primeira peça de escudo, e traz o
 * interruptor junto. O que os testes seguram é o "uma vez" e o "só de escudo":
 * um aviso que volta a cada peça ensina o jogador a fechar sem ler — inclusive
 * os avisos seguintes, que podem importar mais.
 */

import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it } from 'vitest';

import { bus } from '@app/Bus';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Item, SlotId } from '@sim/types';

const peca = (slot: SlotId, uid = Math.random().toString(36).slice(2)): Item => ({
  uid, slot, rarity: 1, ilvl: 1, name: `${slot} de teste`,
  stats: {}, affixes: [],
} as Item);

let disparos = 0;
let desligar: (() => void) | null = null;

beforeEach(() => {
  disparos = 0;
  desligar?.();
  desligar = bus.on('dica:escudo', () => { disparos++; });
});

describe('dica da bolha de escudo', () => {
  it('dispara na primeira peça de escudo', () => {
    const sim = new Sim(createState(7));
    sim.acquire(peca('escudo'));
    expect(disparos).toBe(1);
    expect(sim.state.settings.dicaDeEscudoVista, 'tem de marcar no save').toBe(true);
  });

  it('não dispara em peça de outro slot', () => {
    // O gatilho é o jogador começar a ESCOLHER escudo. Um motor não abre essa
    // porta, e um aviso fora de hora é indistinguível de defeito.
    const sim = new Sim(createState(7));
    for (const slot of ['motor', 'asas', 'principal', 'reator', 'blindagem'] as SlotId[]) {
      sim.acquire(peca(slot));
    }
    expect(disparos).toBe(0);
    expect(sim.state.settings.dicaDeEscudoVista).toBe(false);
  });

  it('dispara uma vez só, por mais escudos que caiam', () => {
    const sim = new Sim(createState(7));
    for (let i = 0; i < 8; i++) sim.acquire(peca('escudo'));
    expect(disparos, 'oito escudos, um aviso').toBe(1);
  });

  it('não volta num save que já viu', () => {
    // O caso da sessão seguinte: a marca vive no save justamente para o aviso
    // não recomeçar a cada recarga.
    const st = createState(7);
    st.settings.dicaDeEscudoVista = true;
    const sim = new Sim(st);
    sim.acquire(peca('escudo'));
    expect(disparos).toBe(0);
  });

  it('dispara mesmo quando o item é auto-equipado', () => {
    // `acquire` desvia cedo quando o auto-equipar aceita a peça. Se o gatilho
    // estivesse depois desse desvio, quem joga com automação ligada — que é o
    // padrão de um idle — nunca veria a dica.
    const st = createState(7);
    st.settings.autoEquip = true;
    const sim = new Sim(st);
    sim.acquire(peca('escudo'));
    expect(disparos, 'auto-equipar não pode engolir o aviso').toBe(1);
  });

  it('dispara mesmo quando o item é descartado na hora', () => {
    // Mesmo raciocínio pelo outro lado: a peça CAIU, e é a queda que importa.
    const st = createState(7);
    st.settings.autoSalvage = 5;
    const sim = new Sim(st);
    sim.acquire(peca('escudo'));
    expect(disparos, 'auto-descarte não pode engolir o aviso').toBe(1);
  });

  it('o ajuste que a dica alterna é o mesmo de Ajustes', () => {
    // A dica é um ATALHO, não um segundo interruptor: os dois têm de escrever
    // no mesmo campo, ou o jogador desliga num lugar e continua ligado no outro.
    const st = createState(7);
    expect(st.settings).toHaveProperty('mostrarEscudo');
    const painel = readFileSync('src/ui/panels/SettingsPanel.ts', 'utf8');
    const casca = readFileSync('src/ui/Shell.ts', 'utf8');
    expect(painel).toContain('s.mostrarEscudo = v');
    expect(casca).toContain('s.mostrarEscudo = !s.mostrarEscudo');
  });
});
