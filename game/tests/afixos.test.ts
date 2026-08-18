import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { AFFIXES, AFFIX_BY_ID, SLOTS, pisoDeAfixos, tipoDoAfixo } from '@data/items';
import { RARITIES } from '@data/rarity';
import { rollItem } from '@sim/loot';
import type { Item, SlotId } from '@sim/types';

const tipoDe = (id: string) => {
  const def = AFFIX_BY_ID.get(id);
  if (!def) throw new Error(`afixo desconhecido: ${id}`);
  return tipoDoAfixo(def);
};
const conta = (item: Item) => ({
  prefixos: item.affixes.filter((a) => tipoDe(a.id) === 'prefixo').length,
  sufixos: item.affixes.filter((a) => tipoDe(a.id) === 'sufixo').length,
});

/** Amostra grande de peças de um slot e raridade fixos. */
function amostrar(slot: SlotId, rarity: number, n = 400): Item[] {
  const rng = new Rng(9_001 + rarity * 131);
  const out: Item[] = [];
  for (let i = 0; out.length < n && i < n * 60; i++) {
    const item = rollItem(rng, 60, 0, 0, { exata: rarity });
    if (item.slot === slot) out.push(item);
  }
  return out;
}

describe('prefixos e sufixos (§7)', () => {
  it('todo afixo pertence a um dos dois pools, e a nenhum outro', () => {
    for (const a of AFFIXES) expect(['prefixo', 'sufixo']).toContain(tipoDoAfixo(a));
    // E os dois pools existem de verdade: um lado vazio devolveria o modelo ao
    // que era antes, com uma lista só.
    const prefixos = AFFIXES.filter((a) => tipoDoAfixo(a) === 'prefixo');
    expect(prefixos.length).toBeGreaterThan(3);
    expect(AFFIXES.length - prefixos.length).toBeGreaterThan(3);
  });

  /**
   * A razão de existir da divisão.
   *
   * Antes dela, o sorteio tirava N linhas de um bolo só, e o peso do slot era o
   * único freio. Um escudo Divino podia sair com sete linhas de dano — não era
   * comum, mas era possível, e quando acontecia a peça "certa" de todo slot
   * virava a mesma peça.
   */
  it('nenhuma peça de duas linhas ou mais sai de uma natureza só', () => {
    for (const slot of SLOTS) {
      for (let r = 1; r < RARITIES.length; r++) {
        for (const item of amostrar(slot.id, r, 120)) {
          if (item.affixes.length < 2) continue;
          const { prefixos, sufixos } = conta(item);
          expect(prefixos, `${slot.id} r${r}: ${item.affixes.map((a) => a.id).join(', ')}`)
            .toBeGreaterThan(0);
          expect(sufixos, `${slot.id} r${r}: ${item.affixes.map((a) => a.id).join(', ')}`)
            .toBeGreaterThan(0);
        }
      }
    }
  });

  it('a peça não encolhe: o total de linhas continua sendo o da raridade', () => {
    for (const slot of SLOTS) {
      for (let r = 0; r < RARITIES.length; r++) {
        for (const item of amostrar(slot.id, r, 60)) {
          expect(item.affixes.length, `${slot.id} r${r}`).toBe(RARITIES[r]!.afixos);
        }
      }
    }
  });

  /**
   * A identidade dos nove slots sobrevive à divisão.
   *
   * É o que a primeira versão quebrou: metade a metade forçava três linhas de
   * dano num escudo, e a medição mostrou a sobrevivência caindo até 13%. O piso
   * pende para o tema justamente para isto continuar valendo.
   */
  it('a arma continua ofensiva e o escudo continua defensivo', () => {
    const media = (slot: SlotId, campo: 'prefixos' | 'sufixos') => {
      const itens = amostrar(slot, 5, 200);
      return itens.reduce((s, i) => s + conta(i)[campo], 0) / itens.length;
    };
    expect(media('principal', 'prefixos')).toBeGreaterThan(media('escudo', 'prefixos'));
    expect(media('escudo', 'sufixos')).toBeGreaterThan(media('principal', 'sufixos'));
  });

  it('o piso nunca pede mais linhas do que a raridade concede', () => {
    for (const slot of SLOTS) {
      for (const r of RARITIES) {
        const p = pisoDeAfixos(slot.id, r.afixos);
        expect(p.prefixos + p.sufixos, `${slot.id} · ${r.afixos} afixos`)
          .toBeLessThanOrEqual(r.afixos);
      }
    }
  });
});
