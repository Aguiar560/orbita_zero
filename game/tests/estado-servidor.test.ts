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
import { Sim } from '@sim/index';
import { rolarDoCursor } from '../server/src/lote';

import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { HULLS } from '@data/hulls';
import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { nivelPorXpAcumulado, xpAcumuladoAte, xpAcumuladoDe } from '@sim/nivel';
import { dps, resolveStats } from '@sim/stats';
import type { Item } from '@sim/types';

const casco = HULLS[0]!.id;
const outro = HULLS[1]!.id;

const peca = (uid: string, slot = 'principal'): Item => ({
  uid, baseId: 'b', slot, rarity: 3, ilvl: 40, affixes: [], icon: 'i', origin: 0,
} as Item);

const base = (over: Partial<DadosDoServidor> = {}): DadosDoServidor => ({
  saldos: { sucata: 100, nucleo: 50, cristal: 7 },
  // O par precisa ser POSSÍVEL: 5.000 de XP acumulado não é nível 12, e o
  // fixture antigo dizia que era. Um estado impossível esconde defeito.
  xp: xpAcumuladoAte(12, curvaXpPersonagem), nivel: 12, matriz: [], melhorSetor: 40,
  materiais: { ferrita: 30 }, naves: { [casco]: 900 },
  frota: [casco], itens: [], ...over,
});

describe('o que o servidor sabe chega ao estado', () => {
  it('saldos, XP, nível e Matriz', () => {
    const e = montarEstado(base({ matriz: ['inicio'] }), {});
    expect(e.resources).toEqual({ sucata: 100, nucleo: 50, cristal: 7 });
    expect(e.command.nivel).toBe(12);
    expect(e.command.allocated).toEqual(['inicio']);

    /**
     * O XP do piloto entra como RESTO, não como acumulado.
     *
     * Era `command.xp = dados.xp` — o acumulado no campo que a simulação lê
     * como progresso dentro do nível. `avancarNivel` então subia vários níveis
     * de uma vez, e o nível do piloto na ausência era inventado. O acumulado
     * tem de voltar inteiro na ida e volta, e é isso que se cobra.
     */
    expect(e.command.xp).toBeLessThan(curvaXpPersonagem(12));
    expect(xpAcumuladoDe(e.command, curvaXpPersonagem))
      .toBe(xpAcumuladoAte(12, curvaXpPersonagem));
  });

  it('materiais e XP por nave — e o NÍVEL que esse XP alcança', () => {
    /**
     * O XP guardado é ACUMULADO; o campo `xp` do estado é o resto dentro do
     * nível. Antes esta montagem punha o acumulado no campo do resto e fixava
     * `nivel: 1`, e o nível da nave multiplica os atributos do casco — uma
     * nave nível 60 com equipamento épico simulava a ausência com 74% menos
     * dano do que tem (medido em 08/09).
     */
    const e = montarEstado(base(), {});
    expect(e.armazem.ferrita).toBe(30);

    const esperado = nivelPorXpAcumulado(900, curvaXpNave);
    expect(esperado.nivel, 'o caso de teste precisa de uma nave acima do nível 1')
      .toBeGreaterThan(1);
    expect(e.naves[casco]?.nivel).toBe(esperado.nivel);
    expect(e.naves[casco]?.xp).toBe(esperado.resto);
  });

  it('e o nível da nave CHEGA aos atributos, que é o motivo de tudo isto', () => {
    // Sem esta asserção o teste acima poderia passar com o número certo num
    // campo que ninguém lê. O que importa é a nave simular mais forte.
    const forte = montarEstado(base({ naves: { [casco]: 900 } }), { hull: casco });
    const fraca = montarEstado(base({ naves: { [casco]: 0 } }), { hull: casco });
    expect(dps(resolveStats(forte))).toBeGreaterThan(dps(resolveStats(fraca)));
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
    // 37 e não 40: setor de chefe é recuado pela regra da chave, e o assunto
    // deste teste é o aparo pelo melhor alcançado. O recuo do chefe tem
    // auditoria própria em `chefe-so-com-chave`.
    const e = montarEstado(base({ melhorSetor: 37 }), { setor: 300 });
    expect(e.run.sector).toBe(37);
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

describe('a ausência respeita o descarte automático', () => {
  /**
   * O defeito de 12/09/2026: o jogador voltava com a carga cheia de Comum e o
   * corte em "abaixo de Raro" ligado. `montarEstado` nunca preenchia `vip` nem
   * as preferências de descarte, então a simulação do servidor rodava como
   * conta SEM passe e com o corte desligado — e GRAVAVA as peças que a
   * automação teria consumido.
   *
   * Medido na conta do Rafael: três peças Comum gravadas no mesmo segundo,
   * sem ele ter aberto baú nenhum.
   */
  it('o passe vem do SERVIDOR, e em milissegundos', () => {
    const agora = Math.floor(Date.now() / 1000);
    const e = montarEstado(base({ vipExpiraEm: agora + 86_400 }), {});

    expect(e.vip.expiresAt, 'o passe não chegou à simulação')
      .toBe((agora + 86_400) * 1000);
    // E sem assinatura, zero — nunca um valor herdado do cliente.
    expect(montarEstado(base({}), {}).vip.expiresAt).toBe(0);
  });

  it('e o corte vem do cliente, aparado no catálogo', () => {
    // Preferência, não poder: mentir aqui só destrói o próprio loot.
    expect(montarEstado(base({}), { autoSalvage: 3, autoDispose: 'vender' }).settings)
      .toMatchObject({ autoSalvage: 3, autoDispose: 'vender' });

    // Fora da faixa é aparado, e um destino inventado não passa.
    expect(montarEstado(base({}), { autoSalvage: 99 }).settings.autoSalvage).toBe(6);
    expect(montarEstado(base({}), { autoSalvage: -5 }).settings.autoSalvage).toBe(0);
    expect(montarEstado(base({}), { autoDispose: 'queimar' }).settings.autoDispose)
      .toBe('desmontar');
  });
});

describe('e a ausência não devolve o que o corte manda descartar', () => {
  it('a simulação inteira, com passe e corte, não guarda nada abaixo do corte', () => {
    /**
     * A prova de ponta a ponta do conserto de 12/09/2026: não basta
     * `montarEstado` preencher os campos — a simulação precisa REALMENTE
     * consumir as peças, porque é o inventário dela que a rota grava.
     */
    const agora = Math.floor(Date.now() / 1000);
    const estado = montarEstado(
      base({ vipExpiraEm: agora + 86_400, melhorSetor: 20 }),
      { setor: 8, onda: 1, autoSalvage: 3, autoDispose: 'desmontar' },
    );

    expect(estado.vip.expiresAt).toBeGreaterThan(Date.now());
    expect(estado.settings.autoSalvage).toBe(3);

    const sim = new Sim(estado);
    // O pote precisa existir: sem ele a coleta vira dívida e nada cai.
    sim.receberLote(rolarDoCursor(4242, 8, 0, 0, { onda: 0, elite: 0, chefe: 0 }));

    let colhidos = 0;
    for (let i = 0; i < 300; i++) {
      for (const item of sim.rollDrops('onda', undefined, 0)) { colhidos++; sim.acquire(item); }
    }

    expect(colhidos, 'o pote não rendeu nada — o teste mediria o vazio').toBeGreaterThan(0);
    expect(sim.state.inventory.filter((i) => i.rarity < 3),
      'a ausência guardou peça abaixo do corte').toHaveLength(0);
  });
});
