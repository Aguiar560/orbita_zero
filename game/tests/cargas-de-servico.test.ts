import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { Sim } from '@sim/index';
import { SAVE_VERSION, createState, migrate } from '@sim/state';
import type { ElementId, Item } from '@sim/types';

/**
 * Comprar e usar deixaram de ser o mesmo instante.
 *
 * O serviço elemental precisa de um ALVO, e a primeira versão pedia o alvo num
 * modal com a lista de todas as peças em texto — o jogador tinha de decorar
 * "Reator nv 30 · Raro · Fogo" para depois achar o ícone certo na grade. Agora a
 * compra guarda uma CARGA e o alvo se escolhe no inventário.
 *
 * O que estes testes seguram é o que uma carga não pode fazer: sumir sem
 * efeito, ser gasta num alvo inválido, ou baratear a próxima compra.
 */

const peca = (element: ElementId): Item => ({
  ...rollItem(new Rng(7), 20, 0, 0, { slot: 'principal' }),
  element,
});

const simComCristal = (cristal = 500) => {
  const sim = new Sim(createState(11, 'piloto_sora'));
  sim.state.resources.cristal = cristal;
  sim.state.command.nivel = 30;
  sim.state.universe.bestSectorEver = 40;
  return sim;
};

describe('comprar guarda carga', () => {
  it('a compra não age: credita uma carga no armazém', () => {
    const sim = simComCristal();
    expect(sim.cargasDe('elemento_item')).toBe(0);
    expect(sim.buyShopItem('elemento_item')).toBe(true);
    expect(sim.cargasDe('elemento_item')).toBe(1);
  });

  it('cargas acumulam', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    sim.buyShopItem('elemento_item');
    expect(sim.cargasDe('elemento_item')).toBe(2);
  });

  it('usar uma carga NÃO baixa o histórico de compras', () => {
    // `shop` conta compras acumuladas, para cota e preço crescente; `servicos` é
    // estoque. Juntar os dois faria usar uma carga baratear a próxima compra.
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    const item = peca('fogo');
    sim.state.inventory.push(item);
    sim.usarCargaNoItem('elemento_item', item.uid, 'gelo');
    expect(sim.state.shop.elemento_item).toBe(1);
    expect(sim.cargasDe('elemento_item')).toBe(0);
  });
});

describe('gastar carga', () => {
  it('converte a peça e consome exatamente uma', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    sim.buyShopItem('elemento_item');
    const item = peca('fogo');
    sim.state.inventory.push(item);

    expect(sim.usarCargaNoItem('elemento_item', item.uid, 'gelo')).toBe(true);
    expect(item.element).toBe('gelo');
    expect(sim.cargasDe('elemento_item')).toBe(1);
  });

  it('sem carga não converte nada', () => {
    const sim = simComCristal();
    const item = peca('fogo');
    sim.state.inventory.push(item);
    expect(sim.usarCargaNoItem('elemento_item', item.uid, 'gelo')).toBe(false);
    expect(item.element).toBe('fogo');
  });

  it('não gasta carga num alvo que já está no elemento', () => {
    // É o erro óbvio, e consumir para não mudar nada seria a pior forma de
    // descobrir isso.
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    const item = peca('gelo');
    sim.state.inventory.push(item);
    expect(sim.usarCargaNoItem('elemento_item', item.uid, 'gelo')).toBe(false);
    expect(sim.cargasDe('elemento_item')).toBe(1);
  });

  it('nem numa peça que não existe', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    expect(sim.usarCargaNoItem('elemento_item', 'nao-existe', 'gelo')).toBe(false);
    expect(sim.cargasDe('elemento_item')).toBe(1);
  });

  it('a carga de nave troca o elemento e não desmonta o conjunto', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_nave');
    const gelo = peca('gelo');
    sim.state.inventory.push(gelo);
    sim.equip(gelo.uid, 'baluarte_glacial');

    expect(sim.usarCargaNaNave('elemento_nave', 'baluarte_glacial', 'fogo')).toBe(true);
    expect(sim.elementoDe('baluarte_glacial')).toBe('fogo');
    expect(sim.state.naves.baluarte_glacial?.equipped.principal?.uid).toBe(gelo.uid);
    expect(sim.cargasDe('elemento_nave')).toBe(0);
  });

  it('carga de nave não serve em nave fora da frota', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_nave');
    expect(sim.usarCargaNaNave('elemento_nave', 'lanca_rubra', 'fogo')).toBe(false);
    expect(sim.cargasDe('elemento_nave')).toBe(1);
  });
});

describe('save', () => {
  it('as cargas sobrevivem à migração', () => {
    const sim = simComCristal();
    sim.buyShopItem('elemento_item');
    const m = migrate({ ...sim.state, version: SAVE_VERSION })!;
    expect(m.servicos.elemento_item).toBe(1);
  });

  it('save antigo, sem o campo, migra com estoque vazio', () => {
    const antigo = { ...createState(11), version: 9 } as Record<string, unknown>;
    delete antigo.servicos;
    const m = migrate(antigo)!;
    expect(m.servicos).toEqual({});
  });
});
