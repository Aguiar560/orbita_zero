import { describe, expect, it } from 'vitest';
import { SHOP, SHOP_CARGO_IDS, shopLimit } from '@data/shop';
import { resolveStats } from '@sim/stats';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

function prepared(seed = 1): Sim {
  const state = createState(seed);
  state.command.nivel = 100;
  state.universe.bestSector = 100;
  state.universe.bestSectorEver = 100;
  state.resources = { sucata: 1_000_000, nucleo: 1_000_000, cristal: 10_000 };
  return new Sim(state);
}

describe('Central de Serviços', () => {
  it('não possui contrato de atributo nem os efeitos de poder da loja antiga', () => {
    const forbidden = new Set(['ima', 'reparo', 'contrato_sucata', 'contrato_nucleo', 'contrato_xp', 'licenca_sorte']);
    expect(SHOP.some((item) => forbidden.has(item.id))).toBe(false);
    expect(SHOP.some((item) => 'stat' in item)).toBe(false);
    expect(SHOP.some((item) => item.id === 'refinar_nucleo')).toBe(false);
  });

  it('nenhuma operação da loja altera os atributos resolvidos', () => {
    const sim = prepared(2);
    const before = resolveStats(sim.state);
    expect(sim.buyShopItem('carga')).toBe(true);
    expect(sim.buyShopItem('compactar_sucata')).toBe(true);
    // A compra mexe em capacidade e recursos, nunca no poder da nave.
    expect(resolveStats(sim.state)).toEqual(before);
  });

  it('a expansão concede carga de verdade e respeita os quatro módulos', () => {
    const sim = prepared(3);
    const before = sim.cargoSlots;
    for (let i = 0; i < SHOP_CARGO_IDS.length; i++) expect(sim.buyShopItem('carga')).toBe(true);
    expect(sim.cargoSlots).toBe(before + 20);
    expect(sim.state.cargaLiberada).toEqual(expect.arrayContaining([...SHOP_CARGO_IDS]));
    expect(sim.buyShopItem('carga')).toBe(false);
  });

  it('recupera compra antiga de carga que não registrava a concessão', () => {
    const sim = prepared(4);
    sim.state.shop.carga = 2;
    sim.state.cargaLiberada = [];
    expect(sim.cargoSlots).toBe(25);
  });

  it('o câmbio debita a entrada e credita somente a saída declarada', () => {
    const sim = prepared(5);
    sim.state.resources.sucata = 10_000;
    sim.state.resources.nucleo = 0;
    expect(sim.buyShopItem('compactar_sucata')).toBe(true);
    expect(sim.state.resources.sucata).toBe(4_000);
    expect(sim.state.resources.nucleo).toBe(200);
  });

  it('a cota de câmbio cresce com nível e bloqueia operação infinita', () => {
    const sim = prepared(6);
    sim.state.command.nivel = 30;
    const def = SHOP.find((item) => item.id === 'compactar_sucata')!;
    const limit = shopLimit(def, sim.state.command.nivel);
    expect(limit).toBe(9);
    for (let i = 0; i < limit; i++) expect(sim.buyShopItem(def.id)).toBe(true);
    expect(sim.buyShopItem(def.id)).toBe(false);
  });

  it('carga de Provação não ultrapassa o teto de cinco tentativas', () => {
    const sim = prepared(7);
    expect(sim.buyShopItem('tentativa_provacao')).toBe(false);
    sim.state.provacao.tentativas = 4;
    const before = sim.state.resources.cristal;
    expect(sim.buyShopItem('tentativa_provacao')).toBe(true);
    expect(sim.provacaoTentativas.tem).toBe(5);
    expect(sim.state.resources.cristal).toBe(before - 12);
    expect(sim.buyShopItem('tentativa_provacao')).toBe(false);
  });
});
