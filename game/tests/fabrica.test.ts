/**
 * Síntese e frota, do lado do servidor.
 *
 * ## As duas últimas portas
 *
 * A Fase 3a fechou o drop e a 3b fechou o inventário. Sobravam duas por onde
 * poder nascia fora do servidor:
 *
 * - **a fusão**, que consome dez peças e produz uma com `rollItem` — bastava
 *   fundir lixo até o resultado agradar, e o item saía legítimo pelos olhos de
 *   todo o resto do sistema;
 * - **a frota**, porque casco é poder: cada um tem atributos-base próprios, e
 *   os melhores custam cristal. Escrever um id em `state.fleet` entregava de
 *   graça o que a loja cobra.
 */

import { describe, expect, it } from 'vitest';

import { conferirCompraDeCasco, conferirFusao, fundir, cascoDoPiloto } from '../server/src/fabrica';
import { HULLS } from '@data/hulls';
import type { Item, Rarity } from '@sim/types';

const peca = (rarity: Rarity, extra: Partial<Item> = {}): Item => ({
  uid: `u${Math.random()}`, baseId: 'b', slot: 'principal', rarity,
  ilvl: 20, affixes: [], icon: 'i', origin: 0, ...extra,
} as Item);

const dez = (r: Rarity, extra: Partial<Item> = {}) => Array.from({ length: 10 }, () => peca(r, extra));

describe('a fusão é conferida contra o que o SERVIDOR tem', () => {
  it('aceita dez peças da mesma raridade', () => {
    const itens = dez(0);
    const r = conferirFusao(itens, itens.map((i) => i.uid));
    expect('receita' in r && r.receita.entrada).toBe(0);
  });

  it('faltar item no banco recusa a fusão inteira', () => {
    // Faltou = algum uid não é desta pessoa, ou não existe. Sem esta checagem,
    // fundir com uids alheios consumiria itens de outro jogador.
    const itens = dez(0);
    expect(conferirFusao(itens.slice(0, 9), itens.map((i) => i.uid)))
      .toEqual({ erro: 'itens_nao_sao_seus' });
  });

  it('misturar raridades é recusado', () => {
    // Seria o degrau barato: um Comum virando entrada para Divino.
    const itens = [...dez(0).slice(0, 9), peca(5)];
    expect(conferirFusao(itens, itens.map((i) => i.uid)))
      .toEqual({ erro: 'raridades_diferentes' });
  });

  it('favorito nunca entra', () => {
    // Esta é a única das quatro regras que não protege contra exploração e sim
    // contra DANO: a marca de favorito existe justamente para a peça não sumir.
    const itens = [...dez(0).slice(0, 9), peca(0, { favorite: true })];
    expect(conferirFusao(itens, itens.map((i) => i.uid)))
      .toEqual({ erro: 'favorito_na_fusao' });
  });

  it('quantidade errada é recusada', () => {
    const itens = dez(0).slice(0, 5);
    expect(conferirFusao(itens, itens.map((i) => i.uid)))
      .toEqual({ erro: 'quantidade_errada' });
  });

  it('a raridade do topo não tem receita', () => {
    // Divino não funde em nada acima. Sem esta guarda, `receitaPara` devolveria
    // indefinido e a fusão estouraria no meio de uma transação.
    const itens = dez(6);
    expect(conferirFusao(itens, itens.map((i) => i.uid))).toEqual({ erro: 'sem_receita' });
  });
});

describe('a fusão produz o que a receita promete', () => {
  it('sai uma peça da raridade de entrada ou da seguinte', () => {
    // A receita SEMPRE entrega algo: ou sobe de degrau, ou devolve a mesma
    // raridade. Perda seca fazia do último degrau uma parede — 93% de nada.
    const itens = dez(1);
    const conferido = conferirFusao(itens, itens.map((i) => i.uid));
    if (!('receita' in conferido)) throw new Error('receita não veio');
    const possiveis = new Set(conferido.receita.resultados.map((r) => r.raridade));
    for (let i = 0; i < 60; i++) {
      expect(possiveis.has(fundir(itens, conferido.receita, 1, 0).rarity)).toBe(true);
    }
  });

  it('o nível do resultado é a MÉDIA dos que entraram', () => {
    // Com o maior, fundir nove lixos de nível 1 com um bom de nível 80 daria um
    // item de 80 — e a fusão viraria lavanderia de nível.
    const itens = [...Array.from({ length: 9 }, () => peca(1, { ilvl: 10 })), peca(1, { ilvl: 100 })];
    const conferido = conferirFusao(itens, itens.map((i) => i.uid));
    if (!('receita' in conferido)) throw new Error('receita não veio');
    const saida = fundir(itens, conferido.receita, 0, 0);
    expect(saida.ilvl).toBeLessThan(100);
    expect(saida.ilvl).toBeGreaterThan(10);
  });

  it('duas fusões da mesma entrada dão itens diferentes', () => {
    // A semente é sorteada na hora, e pode ser: a fusão CONSOME as peças, então
    // não existe segunda tentativa para comparar com a primeira.
    const itens = dez(1);
    const conferido = conferirFusao(itens, itens.map((i) => i.uid));
    if (!('receita' in conferido)) throw new Error('receita não veio');
    const a = fundir(itens, conferido.receita, 1, 0);
    const b = fundir(itens, conferido.receita, 1, 0);
    expect(a.uid).not.toBe(b.uid);
  });
});

describe('a compra de casco', () => {
  const comprável = HULLS.find((h) => !h.prototype && !h.piloto && h.cost > 0)!;

  it('um casco comprável devolve o preço', () => {
    expect(conferirCompraDeCasco(comprável.id, false)).toEqual({ custo: comprável.cost });
  });

  it('casco que já é seu é recusado', () => {
    // Sem isto, comprar de novo debitaria cristal por nada — ou, pior, um
    // `INSERT` repetido daria a impressão de ter funcionado.
    expect(conferirCompraDeCasco(comprável.id, true)).toEqual({ erro: 'casco_ja_e_seu' });
  });

  it('casco inexistente é recusado', () => {
    expect(conferirCompraDeCasco('nave_que_nao_existe', false))
      .toEqual({ erro: 'casco_desconhecido' });
  });

  it('protótipo não é comprável', () => {
    const proto = HULLS.find((h) => h.prototype);
    if (proto) expect(conferirCompraDeCasco(proto.id, false)).toEqual({ erro: 'casco_nao_e_comprável' });
  });

  it('casco de piloto nunca é comprável', () => {
    // Comprar o dos outros esvaziaria a escolha da primeira tela por dentro:
    // bastaria juntar cristal para ter os quatro.
    const dePiloto = HULLS.find((h) => h.piloto);
    expect(dePiloto).toBeDefined();
    expect(conferirCompraDeCasco(dePiloto!.id, false)).toEqual({ erro: 'casco_de_piloto' });
  });

  it('todo piloto tem um casco inicial', () => {
    // Se um piloto ficasse sem casco, a conta nasceria com a frota vazia e o
    // jogador não teria com o que voar.
    for (const h of HULLS.filter((x) => x.piloto)) {
      expect(cascoDoPiloto(h.piloto!), h.piloto).toBe(h.id);
    }
  });

  it('piloto desconhecido não rende casco', () => {
    expect(cascoDoPiloto('piloto_que_nao_existe')).toBeNull();
  });
});
