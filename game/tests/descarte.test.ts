import { describe, expect, it } from 'vitest';
import {
  MATERIAIS_POR_RARIDADE, retornoDeDesmanche, valorDeVenda,
} from '@data/balance/descarte';
import { RECURSO_POR_ID, RECURSOS } from '@data/recursos';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Affix, Item, Rarity } from '@sim/types';

const afixo = (tier = 5, quality = 0.5): Affix => ({
  id: 'dano_bruto', stat: 'dano', kind: 'add', value: 10, tier, quality,
});

const item = (
  rarity: Rarity,
  ilvl = 100,
  baseTier = 4,
  tierAfixo = 5,
  quality = 0.5,
): Item => ({
  uid: `item-${rarity}-${ilvl}-${baseTier}-${tierAfixo}-${quality}`,
  baseId: `principal_${baseTier}`,
  slot: 'principal', rarity, ilvl,
  affixes: [afixo(tierAfixo, quality)],
  element: 'padrao', icon: 'item/principal_0', origin: 0,
});

describe('venda de equipamento', () => {
  it('paga somente Sucata e remove a peça', () => {
    const sim = new Sim(createState(101));
    const peca = item(3, 100);
    sim.state.inventory = [peca];
    const valor = sim.sell(peca.uid);

    expect(valor).toBe(valorDeVenda(peca));
    expect(sim.state.inventory).toEqual([]);
    expect(sim.state.resources.sucata).toBe(valor);
    expect(sim.state.resources.nucleo).toBe(0);
    expect(sim.state.resources.cristal).toBe(0);
    expect(sim.state.armazem).toEqual({});
  });

  it('não vende favorito', () => {
    const sim = new Sim(createState(108));
    const peca = { ...item(2), favorite: true };
    sim.state.inventory = [peca];
    expect(sim.sell(peca.uid)).toBe(0);
    expect(sim.state.inventory).toHaveLength(1);
    expect(sim.state.resources.sucata).toBe(0);
  });

  it('cresce com raridade, nível, base e qualidade dos afixos', () => {
    const porRaridade = Array.from({ length: 7 }, (_, r) => valorDeVenda(item(r as Rarity)));
    for (let r = 1; r < porRaridade.length; r++) expect(porRaridade[r]).toBeGreaterThan(porRaridade[r - 1]!);

    expect(valorDeVenda(item(2, 200))).toBeGreaterThan(valorDeVenda(item(2, 100)));
    expect(valorDeVenda(item(2, 100, 7))).toBeGreaterThan(valorDeVenda(item(2, 100, 0)));
    expect(valorDeVenda(item(2, 100, 4, 9, 1))).toBeGreaterThan(valorDeVenda(item(2, 100, 4, 1, 0)));
  });

  it('fica nas faixas econômicas de referência no nível 100', () => {
    expect(valorDeVenda(item(0))).toBeGreaterThanOrEqual(200);
    expect(valorDeVenda(item(0))).toBeLessThanOrEqual(600);
    expect(valorDeVenda(item(2))).toBeGreaterThanOrEqual(800);
    expect(valorDeVenda(item(2))).toBeLessThanOrEqual(2_500);
    expect(valorDeVenda(item(4))).toBeGreaterThanOrEqual(4_000);
    expect(valorDeVenda(item(4))).toBeLessThanOrEqual(12_000);
    expect(valorDeVenda(item(6))).toBeGreaterThanOrEqual(25_000);
    expect(valorDeVenda(item(6))).toBeLessThanOrEqual(80_000);
  });
});

describe('desmontagem de equipamento', () => {
  it('paga somente materiais e remove a peça', () => {
    const sim = new Sim(createState(102));
    const peca = item(3, 100);
    sim.state.inventory = [peca];
    const moedasAntes = { ...sim.state.resources };
    const previsto = retornoDeDesmanche(peca);
    const recebido = sim.salvage(peca.uid);

    expect(recebido).toEqual(previsto);
    expect(sim.state.inventory).toEqual([]);
    expect(sim.state.resources).toEqual(moedasAntes);
    expect(sim.state.armazem).toEqual(previsto.materiais);
  });

  it('cada raridade aponta para sua dupla galáctica', () => {
    for (let rarity = 0; rarity <= 6; rarity++) {
      const retorno = retornoDeDesmanche(item(rarity as Rarity));
      expect(Object.keys(retorno.materiais)).toEqual([...MATERIAIS_POR_RARIDADE[rarity as Rarity]]);
    }
  });

  it('nunca gera recurso exclusivo de outro modo', () => {
    for (let rarity = 0; rarity <= 6; rarity++) {
      for (const id of Object.keys(retornoDeDesmanche(item(rarity as Rarity)).materiais)) {
        expect(RECURSO_POR_ID.get(id)?.escopo, id).toBe('galaxia');
      }
    }
  });

  it('cresce por nível, base e qualidade sem explodir a economia', () => {
    const comum = retornoDeDesmanche(item(0)).materiais.ferrita!;
    const epico = retornoDeDesmanche(item(3)).materiais;
    const divino = retornoDeDesmanche(item(6)).materiais;
    expect(comum).toBeGreaterThanOrEqual(5);
    expect(comum).toBeLessThanOrEqual(15);
    expect(epico.cristal_quantico).toBeGreaterThanOrEqual(15);
    expect(epico.cristal_quantico).toBeLessThanOrEqual(40);
    expect(divino.fluxo_dimensional).toBeGreaterThan(epico.cristal_quantico!);
    expect(retornoDeDesmanche(item(2, 200)).materiais.titanio)
      .toBeGreaterThan(retornoDeDesmanche(item(2, 100)).materiais.titanio!);
  });

  it('recusa favorito e desmontagem que abriria tipos além da capacidade', () => {
    const sim = new Sim(createState(103));
    const favorita = { ...item(2), favorite: true };
    sim.state.inventory = [favorita];
    expect(sim.salvage(favorita.uid)).toBeNull();
    expect(sim.state.inventory).toHaveLength(1);

    favorita.favorite = false;
    const bloqueados = RECURSOS
      .filter((r) => !['titanio', 'cristal_quantico'].includes(r.id))
      .slice(0, sim.resourceSlots);
    sim.state.armazem = Object.fromEntries(bloqueados.map((r) => [r.id, 1]));
    expect(sim.salvage(favorita.uid)).toBeNull();
    expect(sim.state.inventory).toHaveLength(1);
  });
});

describe('descarte em lote e automático', () => {
  it('preserva favoritos nos dois destinos em lote', () => {
    const venda = new Sim(createState(104));
    venda.state.inventory = [item(0, 50), { ...item(1, 50), uid: 'favorito', favorite: true }];
    expect(venda.sellBelow(2).itens).toBe(1);
    expect(venda.state.inventory.map((i) => i.uid)).toEqual(['favorito']);

    const desmanche = new Sim(createState(105));
    desmanche.state.inventory = [item(0, 50), { ...item(1, 50), uid: 'favorito', favorite: true }];
    expect(desmanche.salvageBelow(2).itens).toBe(1);
    expect(desmanche.state.inventory.map((i) => i.uid)).toEqual(['favorito']);
  });

  it('automação respeita venda ou desmontagem', () => {
    const vender = new Sim(createState(106));
    vender.state.settings.autoEquip = false;
    vender.state.settings.autoSalvage = 2;
    vender.state.settings.autoDispose = 'vender';
    vender.acquire(item(0, 50));
    expect(vender.state.resources.sucata).toBeGreaterThan(0);
    expect(vender.state.armazem).toEqual({});

    const desmontar = new Sim(createState(107));
    desmontar.state.settings.autoEquip = false;
    desmontar.state.settings.autoSalvage = 2;
    desmontar.state.settings.autoDispose = 'desmontar';
    desmontar.acquire(item(0, 50));
    expect(desmontar.state.resources.sucata).toBe(0);
    expect(desmontar.state.armazem.ferrita).toBeGreaterThan(0);
  });

  it('automação vende como proteção quando o Armazém não comporta o retorno', () => {
    const sim = new Sim(createState(109));
    sim.state.settings.autoEquip = false;
    sim.state.settings.autoSalvage = 2;
    sim.state.settings.autoDispose = 'desmontar';
    sim.state.armazem = Object.fromEntries(
      RECURSOS.filter((r) => r.id !== 'ferrita').slice(0, sim.resourceSlots).map((r) => [r.id, 1]),
    );
    sim.acquire(item(0, 50));
    expect(sim.state.armazem.ferrita).toBeUndefined();
    expect(sim.state.resources.sucata).toBeGreaterThan(0);
    expect(sim.state.inventory).toEqual([]);
  });
});
