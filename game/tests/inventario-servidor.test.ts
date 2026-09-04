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
    const r = derivarColeta(LOTE, ZERO, { onda: 3 })!;
    expect(r.itens).toHaveLength(3);
    expect(r.itens.map((i) => i.uid)).toEqual(LOTE.onda.slice(0, 3).map((i) => i.uid));
    expect(r.cursor.onda).toBe(3);
  });

  it('o cursor impede pegar o mesmo item duas vezes', () => {
    // É a regra inteira contra duplicação. Sem ela, repetir a requisição —
    // por retentativa de rede, inclusive — dobraria o loot.
    const primeira = derivarColeta(LOTE, ZERO, { onda: 3 })!;
    const segunda = derivarColeta(LOTE, primeira.cursor, { onda: 3 })!;
    const uids = new Set([...primeira.itens, ...segunda.itens].map((i) => i.uid));
    expect(uids.size).toBe(6);
  });

  it('pedir além do lote é RECUSADO, não aparado', () => {
    // Aparar em silêncio esconderia um cliente contando errado — e contar
    // errado sobre item é exatamente o que interessa aparecer.
    expect(derivarColeta(LOTE, ZERO, { onda: 999 })).toBeNull();
    expect(derivarColeta(LOTE, { ...ZERO, onda: 11 }, { onda: 2 })).toBeNull();
  });

  it('cada tipo tem cursor próprio', () => {
    // Um cursor só faria pegar do chefe consumir o pote da onda comum.
    const r = derivarColeta(LOTE, ZERO, { onda: 2, chefe: 1 })!;
    expect(r.cursor).toEqual({ onda: 2, elite: 0, chefe: 1 });
    expect(r.itens).toHaveLength(3);
  });

  it('pedir zero não mexe no cursor', () => {
    const r = derivarColeta(LOTE, { onda: 5, elite: 0, chefe: 0 }, { onda: 0 })!;
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
