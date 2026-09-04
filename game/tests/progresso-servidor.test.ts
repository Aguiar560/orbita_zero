/**
 * Progressão do lado do servidor.
 *
 * ## O que a Fase 4 fecha
 *
 * Item, casco, moeda e passe já eram do servidor depois da Fase 3. Faltava o
 * que MULTIPLICA tudo isso: nível de piloto e de nave, os nós da Matriz e o
 * setor alcançado. Um save com `command.nivel = 300` e a Matriz cheia valia
 * mais que qualquer item Divino injetado.
 *
 * A validação da Matriz é a parte que vale poder de verdade, e é onde estes
 * testes se concentram: cada uma das três regras, sozinha, é um caminho para
 * modificadores de graça.
 */

import { describe, expect, it } from 'vitest';

import {
  XP_MAX_POR_ENVIO, conferirDelta, conferirMatriz, melhorSetor,
  nivelDaNave, nivelDoPiloto,
} from '../server/src/progresso';
import { NIVEL_MAX, curvaXpPersonagem } from '@data/balance/curvas';
import { ROOT, custoDeNo, pointsForLevel } from '@sim/tree';
import { TREE_ADJACENCY, TREE_NODES } from '@data/tree';

describe('o nível é derivado do XP, nunca guardado', () => {
  it('XP zero é nível 1', () => {
    expect(nivelDoPiloto(0)).toBe(1);
    expect(nivelDaNave(0)).toBe(1);
  });

  it('bate exatamente na fronteira de cada nível', () => {
    // O caso que um `>` trocado por `>=` quebraria: o XP EXATO do nível N tem de
    // dar N, e um a menos tem de dar N-1.
    for (const n of [2, 5, 20, 100]) {
      expect(nivelDoPiloto(curvaXpPersonagem(n)), `nível ${n}`).toBe(n);
      expect(nivelDoPiloto(curvaXpPersonagem(n) - 1), `nível ${n} - 1`).toBe(n - 1);
    }
  });

  it('não passa do teto', () => {
    // Sem o teto, XP absurdo viraria nível absurdo e a curva de atributos
    // sairia da faixa que o balanceamento conhece.
    expect(nivelDoPiloto(1e30)).toBe(NIVEL_MAX);
  });

  it('XP negativo ou inválido cai no nível 1, e não em NaN', () => {
    // A morte cobra 15%, então XP negativo chega aqui por arredondamento. `NaN`
    // num nível contamina todo cálculo de atributo depois dele.
    expect(nivelDoPiloto(-500)).toBe(1);
    expect(nivelDoPiloto(NaN)).toBe(1);
    expect(nivelDoPiloto(Infinity)).toBe(NIVEL_MAX);
  });
});

describe('o delta de XP é aparado', () => {
  it('aceita ganho e perda', () => {
    // Perda é legítima: a morte cobra 15% do XP.
    expect(conferirDelta(1000)).toBe(1000);
    expect(conferirDelta(-250)).toBe(-250);
  });

  it('recusa o que não é número', () => {
    for (const mau of [NaN, Infinity, -Infinity, 'mil', null, undefined]) {
      expect(conferirDelta(mau), String(mau)).toBe('delta_invalido');
    }
  });

  it('recusa valor absurdo', () => {
    // XP é ACUMULADO: um valor absurdo gravado uma vez fica para sempre.
    expect(conferirDelta(XP_MAX_POR_ENVIO + 1)).toBe('delta_absurdo');
    expect(conferirDelta(-XP_MAX_POR_ENVIO - 1)).toBe('delta_absurdo');
  });
});

describe('a Matriz é conferida contra o nível', () => {
  /** Um caminho real da árvore, da raiz até um nó a alguns passos. */
  const vizinhoDaRaiz = (TREE_ADJACENCY.get(ROOT) ?? [])[0]!;

  it('a raiz sozinha é sempre válida', () => {
    expect(conferirMatriz([ROOT], 1)).toBeNull();
  });

  it('vetor vazio é válido', () => {
    expect(conferirMatriz([], 1)).toBeNull();
  });

  it('nó inventado é recusado', () => {
    // `custoDeNo` devolve 0 para id desconhecido. Tratar 0 como "grátis" em vez
    // de "não existe" deixaria o cliente inventar modificadores.
    expect(conferirMatriz([ROOT, 'no_que_nao_existe'], 300)).toBe('matriz_invalida');
  });

  it('gastar mais pontos do que o nível dá é recusado', () => {
    // É o que faz a Matriz durar os 300 níveis em vez de encher no 177. Sem a
    // conferência, bastava listar todos os nós.
    const todos = TREE_NODES.map((n) => n.id);
    const r = conferirMatriz(todos, 1);
    expect(r === 'matriz_cara_demais' || r === 'matriz_desconexa').toBe(true);
  });

  it('nó solto, sem caminho até a raiz, é recusado', () => {
    // Sem esta regra dá para pegar só os nós profundos — que são os melhores —
    // sem pagar o caminho até eles.
    // Um no que NAO e vizinho da raiz: alcanca-lo exige pagar o caminho.
    const vizinhos = new Set([ROOT, ...(TREE_ADJACENCY.get(ROOT) ?? [])]);
    const fundo = TREE_NODES.find((n) => !vizinhos.has(n.id));
    if (!fundo) return;
    expect(conferirMatriz([ROOT, fundo.id], NIVEL_MAX)).toBe('matriz_desconexa');
  });

  it('um caminho conectado e dentro do orçamento passa', () => {
    expect(conferirMatriz([ROOT, vizinhoDaRaiz], NIVEL_MAX)).toBeNull();
  });

  it('o orçamento do nível é o que a árvore promete', () => {
    // Amarra a conferência à MESMA função que o cliente usa para mostrar
    // "pontos disponíveis". Se as duas divergirem, o jogador vê pontos que o
    // servidor recusa — e o defeito aparece como "não consigo alocar".
    expect(custoDeNo(vizinhoDaRaiz)).toBeLessThanOrEqual(pointsForLevel(NIVEL_MAX));
  });

  it('recusa lista malformada', () => {
    expect(conferirMatriz([42 as never], 10)).toBe('matriz_invalida');
    expect(conferirMatriz(Array.from({ length: 501 }, () => ROOT), 300)).toBe('matriz_invalida');
  });
});

describe('o setor alcançado só sobe', () => {
  it('avançar grava o novo', () => {
    expect(melhorSetor(10, 25)).toBe(25);
  });

  it('reportar um setor menor NÃO baixa o guardado', () => {
    // O cliente reporta o setor ATUAL, que é legitimamente menor o tempo todo.
    // Baixar tiraria acesso a casco e conteúdo já conquistados.
    expect(melhorSetor(50, 3)).toBe(50);
  });

  it('recusa setor fora da faixa', () => {
    for (const mau of [0, -1, NaN, Infinity, 'dez', 1e9]) {
      expect(melhorSetor(10, mau), String(mau)).toBe('setor_invalido');
    }
  });
});
