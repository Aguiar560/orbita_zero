/**
 * A montagem do `GameState` no servidor.
 *
 * ## Por que este é o teste mais importante da Fase 5
 *
 * O servidor passa a SIMULAR, e simula sobre um estado que ele mesmo monta a
 * partir de oito tabelas mais quatro campos que o cliente informa. Um campo
 * montado errado não dá erro: dá uma simulação que diverge do jogo — e o
 * sintoma chega como "o offline me deu menos do que devia", meses depois, sem
 * nada apontando para a causa.
 *
 * Os dois riscos concretos, e é o que se mede aqui:
 *
 * 1. **O cliente informa contexto de cena** (casco, setor, onda, postura).
 *    Nenhum decide poder, mas dois deles são abusáveis se não forem aparados
 *    contra o que o servidor sabe.
 * 2. **O que o servidor sabe precisa CHEGAR ao estado.** Item equipado que não
 *    entra no lugar certo é atributo perdido, e a simulação renderia menos do
 *    que o jogador merece.
 */

import { describe, expect, it } from 'vitest';

import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { HULLS } from '@data/hulls';
import type { Item } from '@sim/types';

const casco = HULLS[0]!.id;
const outro = HULLS[1]!.id;

const peca = (uid: string, slot = 'principal'): Item => ({
  uid, baseId: 'b', slot, rarity: 3, ilvl: 40, affixes: [], icon: 'i', origin: 0,
} as Item);

const base = (over: Partial<DadosDoServidor> = {}): DadosDoServidor => ({
  saldos: { sucata: 100, nucleo: 50, cristal: 7 },
  xp: 5000, nivel: 12, matriz: [], melhorSetor: 40,
  materiais: { ferrita: 30 }, naves: { [casco]: 900 },
  frota: [casco], itens: [], ...over,
});

describe('o que o servidor sabe chega ao estado', () => {
  it('saldos, XP, nível e Matriz', () => {
    const e = montarEstado(base({ matriz: ['inicio'] }), {});
    expect(e.resources).toEqual({ sucata: 100, nucleo: 50, cristal: 7 });
    expect(e.command.xp).toBe(5000);
    expect(e.command.nivel).toBe(12);
    expect(e.command.allocated).toEqual(['inicio']);
  });

  it('materiais e XP por nave', () => {
    const e = montarEstado(base(), {});
    expect(e.armazem.ferrita).toBe(30);
    expect(e.naves[casco]?.xp).toBe(900);
  });

  it('item equipado vai para o SLOT da nave, não para a mochila', () => {
    // É a diferença entre simular com os atributos certos e sem eles. Um item
    // equipado que caísse na mochila viraria poder perdido, e o offline
    // renderia menos do que o jogador merece.
    const e = montarEstado(base({
      itens: [
        { item: peca('a'), nave: casco, slot: 'principal' },
        { item: peca('b'), nave: null, slot: null },
      ],
    }), {});
    expect(e.naves[casco]?.equipped.principal?.uid).toBe('a');
    expect(e.inventory.map((i) => i.uid)).toEqual(['b']);
  });

  it('item equipado numa nave que não está na frota cai na mochila', () => {
    // Não deveria acontecer, e por isso mesmo não pode derrubar a simulação:
    // o item vira mochila em vez de sumir.
    const e = montarEstado(base({
      itens: [{ item: peca('x'), nave: 'nave_fantasma', slot: 'principal' }],
    }), {});
    expect(e.inventory.map((i) => i.uid)).toEqual(['x']);
  });

  it('os campos que o servidor não guarda ficam com o padrão de save novo', () => {
    // É o motivo de partir de `createState()`: montar à mão significaria
    // escrever um valor plausível para cada campo que falta, e errar um em
    // silêncio.
    const e = montarEstado(base(), {});
    expect(e.provacao).toBeDefined();
    expect(e.settings).toBeDefined();
    expect(e.chests).toBeDefined();
    expect(e.version).toBeGreaterThan(0);
  });
});

describe('o contexto do cliente é aparado', () => {
  it('o casco em campo precisa estar na frota', () => {
    // Alegar um casco melhor seria troca de atributos de graça — exatamente o
    // que a Fase 3c fechou ao mover a frota para o servidor.
    const e = montarEstado(base(), { hull: outro });
    expect(e.hull).toBe(casco);
  });

  it('o casco da frota é aceito', () => {
    const e = montarEstado(base({ frota: [casco, outro] }), { hull: outro });
    expect(e.hull).toBe(outro);
  });

  it('casco inventado não passa', () => {
    const e = montarEstado(base(), { hull: 'nave_que_nao_existe' });
    expect(e.hull).toBe(casco);
  });

  it('o setor não passa do MELHOR já alcançado', () => {
    // Alegar o setor 300 para simular recompensa de fim de jogo era a saída
    // óbvia. A recompensa por setor vai de 0,06 a 192.201 — três milhões de
    // vezes —, então este aparo vale mais que qualquer outro daqui.
    const e = montarEstado(base({ melhorSetor: 40 }), { setor: 300 });
    expect(e.run.sector).toBe(40);
  });

  it('setor dentro da faixa é respeitado', () => {
    expect(montarEstado(base({ melhorSetor: 40 }), { setor: 12 }).run.sector).toBe(12);
  });

  it('setor inválido cai em 1, e não em NaN', () => {
    for (const mau of [0, -5, NaN, 'dez' as never, undefined]) {
      expect(montarEstado(base(), { setor: mau as number }).run.sector).toBe(1);
    }
  });

  it('a postura é aceita só se for uma das conhecidas', () => {
    expect(montarEstado(base(), { postura: 'evasivo' }).settings.pilot).toBe('evasivo');
    const padrao = montarEstado(base(), {}).settings.pilot;
    expect(montarEstado(base(), { postura: 'invencivel' }).settings.pilot).toBe(padrao);
  });

  it('frota vazia não derruba a montagem', () => {
    // Conta nova, antes de escolher piloto. Precisa produzir um estado válido.
    const e = montarEstado(base({ frota: [], naves: {} }), {});
    expect(e.hull).toBeTruthy();
    expect(e.naves[e.hull]).toBeDefined();
  });
});
