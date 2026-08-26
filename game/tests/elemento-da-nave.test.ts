import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { HULL_BY_ID } from '@data/hulls';
import { rollItem } from '@sim/loot';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import {
  ehElementoNativo, elementoDaNave, naveAceita, pecasIncompativeis, podeEquipar,
} from '@sim/elemento-da-nave';
import type { ElementId, Item } from '@sim/types';

/**
 * A regra elemental só é justa junto do serviço de troca. Sozinha ela seria
 * cruel de um jeito invisível: a chance de um item sair NEUTRO cai com a
 * raridade, então quanto mais raro o achado, menor a chance de servir — um
 * Divino serviria em 22% das vezes.
 *
 * Estes testes seguram os dois lados: a regra bloqueia de verdade, e nada fica
 * permanentemente inútil.
 */

const peca = (element: ElementId | undefined): Item => {
  const it = rollItem(new Rng(7), 20, 0, 0, { slot: 'principal' });
  return { ...it, element };
};

describe('o que uma nave aceita', () => {
  it('neutro serve em qualquer nave — é o dano sem aposta', () => {
    for (const el of ['fogo', 'gelo', 'raio', 'cosmico', 'quimico', 'padrao'] as const) {
      expect(naveAceita(peca('padrao'), el)).toBe(true);
    }
  });

  it('o próprio elemento serve; os outros quatro não', () => {
    expect(naveAceita(peca('gelo'), 'gelo')).toBe(true);
    for (const el of ['fogo', 'raio', 'cosmico', 'quimico'] as const) {
      expect(naveAceita(peca(el), 'gelo')).toBe(false);
    }
  });

  it('peça de save antigo, sem elemento, conta como neutra', () => {
    // Recusá-la desmontaria conjuntos inteiros de quem já jogava, e um item sem
    // elemento nunca teve identidade tática para conflitar com a da nave.
    expect(naveAceita(peca(undefined), 'fogo')).toBe(true);
  });

  it('nave de elemento padrão aceita SÓ neutro', () => {
    // Não é caso especial: `padrao` é o elemento dela e a regra é a mesma. É o
    // preço de voar sem aposta — em troca, dano neutro nunca é resistido.
    expect(naveAceita(peca('padrao'), 'padrao')).toBe(true);
    expect(naveAceita(peca('fogo'), 'padrao')).toBe(false);
  });
});

describe('elemento da nave', () => {
  it('sem troca, é o nativo da tabela de cascos', () => {
    const st = createState(11, 'piloto_sora');
    expect(elementoDaNave(st, 'baluarte_glacial')).toBe('gelo');
    expect(elementoDaNave(st, 'baluarte_glacial')).toBe(HULL_BY_ID.get('baluarte_glacial')!.element);
    expect(ehElementoNativo(st, 'baluarte_glacial')).toBe(true);
  });

  it('a troca sobrevive, e a tela sabe que não é mais de fábrica', () => {
    const sim = new Sim(createState(11, 'piloto_sora'));
    sim.state.resources.cristal = 999;
    expect(sim.trocarElementoDaNave('baluarte_glacial', 'fogo', 10)).toBe(true);
    expect(sim.elementoDe('baluarte_glacial')).toBe('fogo');
    expect(ehElementoNativo(sim.state, 'baluarte_glacial')).toBe(false);
  });

  it('não cobra por trocar para o elemento que já está', () => {
    const sim = new Sim(createState(11, 'piloto_sora'));
    sim.state.resources.cristal = 999;
    const antes = sim.state.resources.cristal;
    expect(sim.trocarElementoDaNave('baluarte_glacial', 'gelo', 10)).toBe(false);
    expect(sim.state.resources.cristal).toBe(antes);
  });

  it('nem por nave que não está na frota', () => {
    const sim = new Sim(createState(11, 'piloto_sora'));
    sim.state.resources.cristal = 999;
    expect(sim.trocarElementoDaNave('lanca_rubra', 'fogo', 10)).toBe(false);
  });
});

describe('equipar respeita a regra', () => {
  const comItem = (element: ElementId) => {
    const sim = new Sim(createState(11, 'piloto_sora'));
    const item = peca(element);
    sim.state.inventory.push(item);
    return { sim, item };
  };

  it('recusa peça de outro elemento', () => {
    const { sim, item } = comItem('fogo');
    expect(sim.elementoDe('baluarte_glacial')).toBe('gelo');
    expect(sim.equip(item.uid, 'baluarte_glacial')).toBe(false);
    expect(sim.state.naves.baluarte_glacial?.equipped.principal).toBeUndefined();
    // e a peça CONTINUA no inventário: recusar não pode consumir
    expect(sim.state.inventory.some((i) => i.uid === item.uid)).toBe(true);
  });

  it('aceita do próprio elemento e neutra', () => {
    for (const el of ['gelo', 'padrao'] as const) {
      const { sim, item } = comItem(el);
      expect(sim.equip(item.uid, 'baluarte_glacial')).toBe(true);
    }
  });

  it('a peça recusada passa a servir depois da conversão', () => {
    // É isto que impede a regra de transformar drop raro em lixo.
    const { sim, item } = comItem('fogo');
    sim.state.resources.cristal = 999;
    expect(sim.equip(item.uid, 'baluarte_glacial')).toBe(false);
    expect(sim.trocarElementoDoItem(item.uid, 'gelo', 5)).toBe(true);
    expect(sim.equip(item.uid, 'baluarte_glacial')).toBe(true);
  });

  it('o auto-equipar passa pela mesma regra', () => {
    // Sem isto a automação montaria o que a mão não consegue, e o jogador
    // descobriria a restrição pela contradição entre as duas.
    const sim = new Sim(createState(11, 'piloto_sora'));
    sim.state.settings.autoEquip = true;
    sim.acquire(peca('fogo'));
    expect(sim.state.naves.baluarte_glacial?.equipped.principal).toBeUndefined();
  });
});

describe('trocar o elemento da nave não desmonta o conjunto', () => {
  it('as peças ficam montadas, e a tela sabe quais deixaram de servir', () => {
    const sim = new Sim(createState(11, 'piloto_sora'));
    sim.state.resources.cristal = 999;
    const gelo = peca('gelo');
    const neutra = { ...peca('padrao'), slot: 'escudo' as const, uid: 'n1' };
    sim.state.inventory.push(gelo, neutra);
    sim.equip(gelo.uid, 'baluarte_glacial');
    sim.equip(neutra.uid, 'baluarte_glacial');

    sim.trocarElementoDaNave('baluarte_glacial', 'fogo', 10);

    // nada foi desequipado — desmontar sem avisar seria a pior forma de
    // descobrir a regra
    expect(sim.state.naves.baluarte_glacial?.equipped.principal?.uid).toBe(gelo.uid);

    const fora = pecasIncompativeis(sim.state, 'baluarte_glacial');
    expect(fora.map((f) => f.slot)).toEqual(['principal']);
    // a neutra continua servindo
    expect(podeEquipar(sim.state, neutra, 'baluarte_glacial')).toBe(true);
  });
});
