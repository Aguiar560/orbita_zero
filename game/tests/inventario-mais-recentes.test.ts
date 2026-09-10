import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ordemDeChegada } from '@ui/panels/InventoryPanel';
import type { Item } from '@sim/types';

/**
 * "Mais recentes": a peça que acabou de chegar vem primeiro.
 *
 * Pedido de 10/09/2026: com a grade ordenada por ganho de poder, a peça nova
 * entrava no meio das outras e o jogador se perdia procurando o que caiu.
 */

const peca = (uid: string, rarity = 0): Item => ({
  uid, baseId: 'b', slot: 'principal', rarity: rarity as Item['rarity'], ilvl: 10,
  affixes: [], icon: 'i', origin: 0,
});

describe('ordem de chegada', () => {
  it('a última da mochila é a primeira da grade', () => {
    const mochila = [peca('velha', 6), peca('meio', 3), peca('nova', 0)];
    expect(ordemDeChegada(mochila, [...mochila]).map((i) => i.uid)).toEqual(['nova', 'meio', 'velha']);
  });

  it('respeita o filtro: ordena só o que está visível', () => {
    const mochila = [peca('a'), peca('b'), peca('c'), peca('d')];
    const visiveis = [mochila[0]!, mochila[2]!];
    expect(ordemDeChegada(mochila, visiveis).map((i) => i.uid)).toEqual(['c', 'a']);
  });

  it('é o padrão do painel, e a primeira opção do seletor', () => {
    // Lido do fonte: o painel monta DOM ao nascer, e a suíte roda sem DOM.
    const fonte = readFileSync(new URL('../src/ui/panels/InventoryPanel.ts', import.meta.url), 'utf8');
    expect(fonte).toMatch(/private sort: 'recentes'[^=]*= 'recentes';/);
    const opcoes = [...fonte.matchAll(/h\('option', \{ value: '(\w+)', text: '[^']+', selected: this\.sort/g)].map((m) => m[1]);
    expect(opcoes[0]).toBe('recentes');
  });
});
