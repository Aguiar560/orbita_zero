/**
 * O inventário do lado do servidor.
 *
 * ## O que a Fase 3b fecha
 *
 * A 3a tirou do cliente o poder de escolher QUAL item cai. Faltava a outra
 * metade: o inventário continuava no save, e save é blob que o cliente escreve
 * — dava para não rolar nada e simplesmente ESCREVER uma peça Divina na lista.
 *
 * A ideia que fecha isso é uma só, e é o que estes testes medem: **o item nunca
 * sobe**. O cliente diz quantos pegou de cada tipo; o servidor, que tem a
 * semente e o cursor, deriva quais são. O que não trafega não pode ser forjado.
 */

import { describe, expect, it } from 'vitest';

import {
  COLETA_MAX, conferirComandos, derivarColeta, podeIrPara,
} from '../server/src/inventario';
import { rolarLote } from '../server/src/lote';

const LOTE = rolarLote(2024, 40, 1, 0);
const ZERO = { onda: 0, elite: 0, chefe: 0 };

describe('a coleta é derivada, não recebida', () => {
  it('devolve os itens a partir do cursor', () => {
    const r = derivarColeta(LOTE, ZERO, { onda: 3 });
    expect(r.itens).toHaveLength(3);
    expect(r.itens.map((i) => i.uid)).toEqual(LOTE.onda.slice(0, 3).map((i) => i.uid));
    expect(r.cursor.onda).toBe(3);
  });

  it('o cursor impede pegar o mesmo item duas vezes', () => {
    // É a regra inteira contra duplicação. Sem ela, repetir a requisição —
    // por retentativa de rede, inclusive — dobraria o loot.
    const primeira = derivarColeta(LOTE, ZERO, { onda: 3 });
    const segunda = derivarColeta(LOTE, primeira.cursor, { onda: 3 });
    const uids = new Set([...primeira.itens, ...segunda.itens].map((i) => i.uid));
    expect(uids.size).toBe(6);
  });

  it('pedir além do lote é aparado e CONTADO — nunca recusado em bloco', () => {
    /**
     * Isto devolvia `null`, com o argumento de que aparar em silêncio
     * esconderia um cliente contando errado. O argumento está certo sobre
     * ESCONDER e errado sobre RECUSAR.
     *
     * O `null` virava 409 na rota, e o 409 derrubava o LOTE DE COMANDOS
     * INTEIRO — a coleta, os descartes e os equipamentos junto. O cliente
     * devolvia tudo à fila e reenviava o mesmo lote envenenado para sempre.
     * Medido na conta do Rafael em 08/09: 29 peças no cliente contra 9 no
     * servidor, o cursor do lote parado, e a Fabricação recusando com
     * `itens_nao_sao_seus` porque as peças do anel nunca existiram lá.
     *
     * Agora dá o que tem e conta o que faltou. O desencontro continua
     * aparecendo — que era o objetivo real —, sem destruir o resto do lote.
     */
    const demais = derivarColeta(LOTE, ZERO, { onda: 999 });
    expect(demais.itens).toHaveLength(LOTE.onda.length);
    expect(demais.cursor.onda).toBe(LOTE.onda.length);
    expect(demais.faltaram.onda).toBe(999 - LOTE.onda.length);

    // Pote seco: entrega nada, não anda o cursor, e diz que faltaram os dois.
    const seco = derivarColeta(LOTE, { ...ZERO, onda: LOTE.onda.length }, { onda: 2 });
    expect(seco.itens).toEqual([]);
    expect(seco.cursor.onda).toBe(LOTE.onda.length);
    expect(seco.faltaram.onda).toBe(2);
  });

  it('e aparar nunca entrega MAIS do que entregava', () => {
    // A garantia que mantém a Fase 3a de pé: o servidor deriva da semente
    // dele, e aparar só pode dar menos. Não existe pedido que renda a mais.
    for (const pedido of [1, 5, 12, 40, 999]) {
      const r = derivarColeta(LOTE, ZERO, { onda: pedido });
      expect(r.itens.length).toBeLessThanOrEqual(pedido);
      expect(r.itens.length).toBeLessThanOrEqual(LOTE.onda.length);
      expect(r.itens.map((i) => i.uid))
        .toEqual(LOTE.onda.slice(0, r.itens.length).map((i) => i.uid));
    }
  });

  it('e o que sobrou de um tipo não é tirado de outro', () => {
    // Aparar por engano no pote errado transformaria um pedido de chefe em
    // itens de onda comum, que é o degrau de raridade inteiro de graça.
    const r = derivarColeta(LOTE, ZERO, { onda: 999, chefe: 1 });
    expect(r.cursor.chefe).toBe(1);
    expect(r.faltaram.chefe).toBeUndefined();
  });

  it('cada tipo tem cursor próprio', () => {
    // Um cursor só faria pegar do chefe consumir o pote da onda comum.
    const r = derivarColeta(LOTE, ZERO, { onda: 2, chefe: 1 });
    expect(r.cursor).toEqual({ onda: 2, elite: 0, chefe: 1 });
    expect(r.itens).toHaveLength(3);
  });

  it('pedir zero não mexe no cursor', () => {
    const r = derivarColeta(LOTE, { onda: 5, elite: 0, chefe: 0 }, { onda: 0 });
    expect(r.cursor.onda).toBe(5);
    expect(r.itens).toEqual([]);
  });
});

describe('os comandos são conferidos antes de virar escrita', () => {
  it('aceita um lote normal', () => {
    expect(conferirComandos({ coletar: { onda: 5 }, descartar: ['a'], equipar: [] })).toBeNull();
  });

  it('recusa quantidade negativa, fracionária ou absurda', () => {
    // Negativo andaria o cursor PARA TRÁS, e cursor para trás é o botão de
    // pegar o mesmo item de novo.
    for (const n of [-1, 1.5, NaN, Infinity]) {
      expect(conferirComandos({ coletar: { onda: n } }), String(n)).toBe('comandos_invalidos');
    }
  });

  it('recusa coleta grande demais', () => {
    expect(conferirComandos({ coletar: { onda: COLETA_MAX + 1 } })).toBe('coleta_grande_demais');
  });

  it('soma os três tipos ao medir o teto', () => {
    // Dividir a coleta em três pedidos de 20 não pode furar um teto de 40.
    const cada = Math.ceil(COLETA_MAX / 3) + 1;
    expect(conferirComandos({ coletar: { onda: cada, elite: cada, chefe: cada } }))
      .toBe('coleta_grande_demais');
  });

  it('recusa descarte malformado', () => {
    expect(conferirComandos({ descartar: [42 as never] })).toBe('comandos_invalidos');
    expect(conferirComandos({ descartar: ['x'.repeat(200)] })).toBe('comandos_invalidos');
  });
});

describe('equipar respeita a regra elemental', () => {
  /**
   * `naveAceita` é o MESMO arquivo que o cliente usa — nenhuma cópia da regra.
   *
   * Vale poder real: equipar uma arma Divina de fogo numa nave de gelo é ganho
   * de dano que a regra do jogo proíbe. Se só o cliente conferisse, bastaria
   * pular a conferência.
   */
  const peca = (element: string | undefined, slot = 'principal') =>
    ({ uid: 'u', slot, element, rarity: 3, ilvl: 10, affixes: [], baseId: 'b', icon: 'i' }) as never;

  it('neutro entra em qualquer nave', () => {
    expect(podeIrPara(peca('padrao'), 'fogo', 'principal' as never)).toBeNull();
    expect(podeIrPara(peca(undefined), 'gelo', 'principal' as never)).toBeNull();
  });

  it('o elemento da peça precisa ser o da nave', () => {
    expect(podeIrPara(peca('fogo'), 'fogo', 'principal' as never)).toBeNull();
    expect(podeIrPara(peca('fogo'), 'gelo', 'principal' as never)).toBe('nave_nao_aceita');
  });

  it('a nave neutra só aceita neutro', () => {
    // Não é caso especial: `padrao` é o elemento dela, e a regra é a mesma.
    expect(podeIrPara(peca('padrao'), 'padrao', 'principal' as never)).toBeNull();
    expect(podeIrPara(peca('fogo'), 'padrao', 'principal' as never)).toBe('nave_nao_aceita');
  });

  it('a peça só entra no slot dela', () => {
    // Sem isto, um elmo no slot da arma somaria atributos onde não devia.
    expect(podeIrPara(peca('padrao', 'principal'), 'padrao', 'escudo' as never)).toBe('slot_errado');
  });
});
