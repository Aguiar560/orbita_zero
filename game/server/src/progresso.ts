import { NIVEL_MAX, curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { NODE_BY_ID, TREE_ADJACENCY } from '@data/tree';
import { ROOT, custoDeNo, pointsForLevel } from '@sim/tree';

/**
 * Progressão do lado do servidor: XP, nível, Matriz, setor e materiais.
 *
 * ## O nível é DERIVADO, nunca guardado
 *
 * Guardar XP e nível é guardar a mesma informação duas vezes, e duas cópias de
 * um número divergem — normalmente numa migração, em silêncio, e o sintoma
 * aparece meses depois como "meu nível voltou". Com só o XP, a curva responde o
 * nível sempre igual e não existe estado inconsistente possível.
 *
 * ## O que o servidor consegue conferir aqui, e o que não
 *
 * **Consegue:** que a Matriz cabe nos pontos do nível, que cada nó existe e que
 * cada um está conectado à raiz. São regras fechadas — dependem só da alocação
 * e do nível, e os dois são do servidor.
 *
 * **Não consegue:** se o XP declarado foi merecido. O cliente ainda diz quanto
 * ganhou, como diz quanto de sucata ganhou. É a mesma classe de problema da
 * carteira, com a mesma resposta: a Fase 5, onde o servidor calcula em vez de
 * acreditar.
 *
 * A diferença que ESTA fase faz é que XP e Matriz deixam de ser editáveis: quem
 * quiser nível 300 precisa declarar o ganho, e a declaração passa pelo ritmo e
 * deixa rastro.
 */

/** Nível a partir do XP acumulado. A curva é a mesma que o cliente usa. */
export function nivelPorXp(xp: number, curva: (n: number) => number): number {
  const total = Math.max(0, Number(xp) || 0);
  // Busca linear até o teto: 300 passos numa conta de multiplicação é barato
  // demais para justificar busca binária, e linear é conferível de olho.
  let nivel = 1;
  while (nivel < NIVEL_MAX && total >= curva(nivel + 1)) nivel++;
  return nivel;
}

export const nivelDoPiloto = (xp: number): number => nivelPorXp(xp, curvaXpPersonagem);
export const nivelDaNave = (xp: number): number => nivelPorXp(xp, curvaXpNave);

export type RecusaDeProgresso =
  | 'delta_invalido'
  | 'delta_absurdo'
  | 'setor_invalido'
  | 'matriz_invalida'
  | 'matriz_cara_demais'
  | 'matriz_desconexa';

/**
 * Teto por envio.
 *
 * Não é balanceamento: é sanidade. Um ganho de 10^12 de XP num único envio só
 * chega aqui por defeito ou por ataque, e nos dois casos recusar é melhor que
 * gravar — XP é acumulado, então um valor absurdo gravado uma vez fica para
 * sempre.
 */
export const XP_MAX_POR_ENVIO = 1e9;

export function conferirDelta(n: unknown): number | RecusaDeProgresso {
  // `typeof` antes de `Number`: `Number(null)` é ZERO, e zero é finito. Sem
  // esta linha, um campo ausente vira "ganhou nada" em vez de "corpo torto",
  // e um cliente quebrado passaria despercebido para sempre.
  if (typeof n !== 'number') return 'delta_invalido';
  const v = n;
  if (!Number.isFinite(v)) return 'delta_invalido';
  if (Math.abs(v) > XP_MAX_POR_ENVIO) return 'delta_absurdo';
  return v;
}

/**
 * A alocação da Matriz é válida para este nível?
 *
 * Três regras, e as três valem poder real:
 *
 * 1. **Todo nó existe.** Um id inventado passaria batido pelo custo e o cliente
 *    poderia inventar modificadores.
 * 2. **O custo total cabe nos pontos do nível.** É o que faz a Matriz durar os
 *    300 níveis em vez de encher no 177 — e sem a conferência, bastava listar
 *    todos os nós.
 * 3. **Todo nó está conectado à raiz.** Sem isso dá para pegar só os nós
 *    profundos, que são os melhores, sem pagar o caminho até eles.
 *
 * A conexão é verificada por travessia sobre `TREE_ADJACENCY` — o grafo real,
 * o mesmo que o cliente usa. Não é regra copiada: é uma pergunta que `tree.ts`
 * não responde, porque lá a pergunta é sempre "que caminho eu preciso alocar",
 * e aqui é "o que já está alocado se sustenta".
 */
export function conferirMatriz(alocados: readonly string[], nivel: number): RecusaDeProgresso | null {
  if (!Array.isArray(alocados)) return 'matriz_invalida';
  if (alocados.some((id) => typeof id !== 'string')) return 'matriz_invalida';
  if (alocados.length > 500) return 'matriz_invalida';

  const conjunto = new Set(alocados);
  const semRaiz = alocados.filter((id) => id !== ROOT);

  // Existência primeiro, e por `NODE_BY_ID` — NÃO por custo.
  //
  // `custoDeNo` devolve **1** para id desconhecido, não zero. A primeira
  // versão daqui conferia `if (!custo)`, o que nunca disparava: um id
  // inventado passava por nó barato, e o cliente ganhava um modificador que
  // não existe na árvore. O teste pegou.
  let custo = 0;
  for (const id of semRaiz) {
    if (!NODE_BY_ID.has(id)) return 'matriz_invalida';
    custo += custoDeNo(id);
  }
  if (custo > pointsForLevel(nivel)) return 'matriz_cara_demais';

  // Conexão: travessia a partir da raiz usando SÓ os nós alocados.
  //
  // `pathTo` não serve aqui, e a diferença é sutil: ela responde "que caminho
  // eu precisaria alocar para chegar em X" e devolve vetor vazio quando X já
  // está alocado — que é sempre o caso quando se confere uma alocação pronta.
  // A pergunta desta função é outra: "o que está alocado forma um conjunto
  // ligado à raiz". Sem ela dá para pegar só os nós profundos, que são os
  // melhores, sem pagar o caminho até eles.
  if (semRaiz.length) {
    if (!conjunto.has(ROOT)) return 'matriz_desconexa';
    const vistos = new Set([ROOT]);
    const fila = [ROOT];
    while (fila.length) {
      const atual = fila.shift()!;
      for (const vizinho of TREE_ADJACENCY.get(atual) ?? []) {
        if (!conjunto.has(vizinho) || vistos.has(vizinho)) continue;
        vistos.add(vizinho);
        fila.push(vizinho);
      }
    }
    if (vistos.size !== conjunto.size) return 'matriz_desconexa';
  }
  return null;
}

/**
 * O setor alcançado só SOBE.
 *
 * É ele que libera casco e conteúdo, então uma queda — por save antigo, por
 * corrida ruim, por um cliente confuso — tiraria acesso que o jogador já
 * conquistou. Recusar seria pior ainda: o cliente reportaria o setor atual, que
 * é legitimamente menor o tempo todo.
 */
export function melhorSetor(guardado: number, declarado: unknown): number | RecusaDeProgresso {
  const n = Math.floor(Number(declarado));
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return 'setor_invalido';
  return Math.max(guardado, n);
}
