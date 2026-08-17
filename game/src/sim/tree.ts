import { NODE_BY_ID, TREE_ADJACENCY, TREE_NODES, type TreeNode, custoDoNo } from '@data/tree';
import { curvaXpPersonagem } from '@data/balance/curvas';
import type { GameState, StatModifier } from './types';

/** O nó central já vem alocado e não custa ponto. */
export const ROOT = 'inicio';

/** Pontos ganhos por patente. O nível 1 já entrega o primeiro ponto. */
export function pointsForLevel(level: number): number {
  return Math.max(0, level);
}

/**
 * XP necessário para sair do nível atual.
 *
 * A base é baixa e o crescimento moderado: os primeiros pontos precisam chegar
 * nos primeiros minutos, senão a matriz fica trancada justamente quando ela é
 * a coisa mais interessante para o jogador novo mexer.
 */
export const xpForLevel = curvaXpPersonagem;

export function allocatedSet(state: GameState): Set<string> {
  const set = new Set(state.command.allocated);
  set.add(ROOT);
  return set;
}

export function pointsSpent(state: GameState): number {
  // Soma o CUSTO de cada nó, não a contagem: nós profundos custam mais, e é
  // isso que faz a Matriz durar os 300 níveis em vez de encher no 177.
  return state.command.allocated
    .filter((id) => id !== ROOT)
    .reduce((total, id) => total + custoDeNo(id), 0);
}

/** Custo de um nó pelo id. Nó desconhecido — de save antigo — custa 1. */
export function custoDeNo(id: string): number {
  const n = NODE_BY_ID.get(id);
  return n ? custoDoNo(n) : 1;
}

export function pointsAvailable(state: GameState): number {
  // O modo de teste dá pontos à vontade para inspecionar a matriz inteira.
  if (state.settings.testMode) return 9999;
  return pointsForLevel(state.command.nivel) - pointsSpent(state);
}

/** Um nó pode ser alocado se encosta em algo já alocado e há ponto sobrando. */
export function canAllocate(state: GameState, id: string): boolean {
  if (!NODE_BY_ID.has(id)) return false;
  const allocated = allocatedSet(state);
  if (allocated.has(id)) return false;
  if (custoDeNo(id) > pointsAvailable(state)) return false;
  return (TREE_ADJACENCY.get(id) ?? []).some((n) => allocated.has(n));
}

export function allocate(state: GameState, id: string): boolean {
  if (!canAllocate(state, id)) return false;
  state.command.allocated.push(id);
  return true;
}

/**
 * Menor caminho de nós ainda não alocados até `target`, partindo da fronteira
 * do que já está alocado. Alimenta o clique num nó distante: em vez de exigir
 * que o jogador clique nó a nó, mostramos e cobramos a rota inteira.
 */
export function pathTo(state: GameState, target: string): string[] | null {
  const allocated = allocatedSet(state);
  if (allocated.has(target)) return [];
  if (!NODE_BY_ID.has(target)) return null;

  const prev = new Map<string, string>();
  const seen = new Set<string>(allocated);
  const queue: string[] = [...allocated];

  while (queue.length) {
    const current = queue.shift()!;
    for (const next of TREE_ADJACENCY.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, current);
      if (next === target) {
        const path: string[] = [];
        let node: string | undefined = target;
        while (node && !allocated.has(node)) {
          path.unshift(node);
          node = prev.get(node);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Aloca a rota inteira até `target`, se couber nos pontos disponíveis. */
export function allocatePath(state: GameState, target: string): number {
  const path = pathTo(state, target);
  if (!path || path.length === 0) return 0;
  // Compara CUSTO com pontos, não contagem de nós: com custo por profundidade,
  // uma rota de quatro nós de borda vale doze pontos, e comparar quatro contra
  // os pontos disponíveis deixaria alocar de graça.
  const custo = path.reduce((total, id) => total + custoDeNo(id), 0);
  if (custo > pointsAvailable(state)) return 0;
  for (const id of path) state.command.allocated.push(id);
  return custo;
}

/**
 * Devolve um nó. Só é permitido se o resto continuar ligado ao centro —
 * senão a matriz aceitaria ilhas soltas pagas por pontos que já não conectam.
 */
export function canDeallocate(state: GameState, id: string): boolean {
  if (id === ROOT || !state.command.allocated.includes(id)) return false;

  const remaining = new Set(state.command.allocated.filter((n) => n !== id));
  remaining.add(ROOT);

  const seen = new Set<string>([ROOT]);
  const queue = [ROOT];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of TREE_ADJACENCY.get(current) ?? []) {
      if (!remaining.has(next) || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size === remaining.size;
}

export function deallocate(state: GameState, id: string): boolean {
  if (!canDeallocate(state, id)) return false;
  state.command.allocated = state.command.allocated.filter((n) => n !== id);
  return true;
}

export function respec(state: GameState): void {
  state.command.allocated = [];
}

/** Todos os modificadores dos nós alocados, achatados. */
export function treeModifiers(state: GameState): StatModifier[] {
  const out: StatModifier[] = [];
  for (const id of state.command.allocated) {
    const node = NODE_BY_ID.get(id);
    if (node) out.push(...node.stats);
  }
  return out;
}

/** Nós adjacentes ao conjunto alocado — a "fronteira" que a UI destaca. */
export function frontier(state: GameState): Set<string> {
  const allocated = allocatedSet(state);
  const out = new Set<string>();
  for (const id of allocated) {
    for (const next of TREE_ADJACENCY.get(id) ?? []) {
      if (!allocated.has(next)) out.add(next);
    }
  }
  return out;
}

/** Busca por nome ou descrição, para o campo de pesquisa do painel. */
export function searchNodes(query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return TREE_NODES.filter(
    (n) => n.name.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q),
  );
}
