import { describe, expect, it } from 'vitest';

import { conferirMatriz } from '../server/src/progresso';
import { ROOT, allocate, allocatedSet, frontier, pointsSpent } from '@sim/tree';
import { createState } from '@sim/state';
import type { GameState } from '@sim/types';

/**
 * A Matriz que o jogador aloca precisa sobreviver ao servidor.
 *
 * ## O defeito, encontrado pelo livro das recusas em 09/09
 *
 * Toda linha de `progresso.matriz` em produção estava `[]` — e isso NÃO era
 * "ninguém alocou". Era o servidor recusando com `matriz_desconexa` e o
 * cliente adotando o `[]` de volta por cima da alocação do jogador.
 *
 * A causa é uma convenção que os dois lados não combinaram:
 *
 * - No cliente, a **raiz é implícita**. `allocatedSet` faz `set.add(ROOT)` na
 *   hora de usar, então `command.allocated` — que é o que sobe — nunca a
 *   contém. Guardar a raiz seria guardar um valor que é sempre o mesmo.
 * - No servidor, `conferirMatriz` exige `conjunto.has(ROOT)` para começar a
 *   travessia, e sem ela devolve `matriz_desconexa`.
 *
 * O resultado é 100% de recusa: qualquer alocação não vazia era barrada. O
 * jogador alocava, via os nós acesos, e a próxima sincronização apagava tudo —
 * sem uma linha de erro em lugar nenhum até o livro existir.
 *
 * É o mesmo formato de todos os defeitos desta semana: o cliente mostra uma
 * coisa que não é verdade, e a divergência mora entre as duas metades.
 */

/** Um estado com nós alocados do jeito que o JOGO os aloca. */
function comAlocacao(quantos: number): GameState {
  const state = createState(7);
  state.command.nivel = 100;
  for (let i = 0; i < quantos; i++) {
    const proximo = [...frontier(state)][0];
    if (!proximo) break;
    allocate(state, proximo);
  }
  return state;
}

describe('a convenção da raiz é a mesma dos dois lados', () => {
  it('o cliente NÃO guarda a raiz — ela é implícita', () => {
    // Se um dia isto mudar, o teste abaixo passa a proteger outra coisa, e é
    // melhor descobrir aqui do que em produção.
    const state = comAlocacao(3);
    expect(state.command.allocated).not.toContain(ROOT);
    expect([...allocatedSet(state)]).toContain(ROOT);
  });

  it('e o servidor ACEITA a alocação como o cliente a envia', () => {
    /**
     * É o teste que faltava. Contra o código antigo ele falha com
     * `matriz_desconexa` para qualquer alocação não vazia — que era exatamente
     * o estado de produção: sete contas, sete matrizes vazias.
     */
    const state = comAlocacao(3);
    expect(state.command.allocated.length).toBeGreaterThan(0);
    expect(conferirMatriz(state.command.allocated, 100)).toBeNull();
  });

  it('e continua aceitando se a raiz VIER na lista', () => {
    // Um save antigo, ou um cliente futuro que mude de ideia, não pode ser
    // recusado por mandar a raiz explícita. As duas formas dizem o mesmo.
    const state = comAlocacao(3);
    expect(conferirMatriz([ROOT, ...state.command.allocated], 100)).toBeNull();
  });

  it('e uma alocação vazia é válida — é como toda conta nasce', () => {
    expect(conferirMatriz([], 1)).toBeNull();
    expect(conferirMatriz([ROOT], 1)).toBeNull();
  });
});

describe('o que a conferência ainda precisa recusar', () => {
  it('nó solto no meio da árvore, sem o caminho até ele', () => {
    /**
     * É a razão de a travessia existir: sem ela dá para pegar só os nós
     * profundos — que são os melhores — sem pagar o caminho. Consertar a raiz
     * não pode abrir essa porta.
     */
    const state = comAlocacao(8);
    const alocados = state.command.allocated;
    // Tira o primeiro nó do caminho e mantém os que vieram depois dele.
    const furado = alocados.slice(1);
    expect(furado.length).toBeGreaterThan(0);
    expect(conferirMatriz(furado, 100)).toBe('matriz_desconexa');
  });

  it('e id que não existe na árvore', () => {
    expect(conferirMatriz(['no_inventado'], 100)).toBe('matriz_invalida');
  });

  it('e alocação cara demais para o nível', () => {
    const state = comAlocacao(10);
    expect(pointsSpent(state)).toBeGreaterThan(0);
    expect(conferirMatriz(state.command.allocated, 1)).toBe('matriz_cara_demais');
  });
});
