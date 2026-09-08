import { MISSAO_POR_ID } from '@data/missoes';
import { confiancaDaMissao } from '@data/balance/confianca';
import { CONFIANCA_MAX } from '@data/personagens';

/**
 * Missões e confiança do lado do servidor.
 *
 * ## Os dois defeitos que isto fecha
 *
 * 1. **Fraude.** `resgatarMissao` rodava inteiro no cliente: conferia
 *    `situacaoDe` contra `state.missoes` — que é save, escrito pelo cliente —
 *    e pagava com `grant()`, que empilha em `pendentes`. Marcar uma missão
 *    como pronta no save fazia o servidor pagar.
 * 2. **Divergência entre aparelhos.** `missoes` e `confianca` viajavam dentro
 *    do bloco do save, e a reconciliação escolhe UM bloco por maior
 *    `playtime`. Duas máquinas em paralelo terminavam com o de uma delas.
 *
 * ## A descoberta que simplificou o desenho
 *
 * **A confiança é função pura das entregas.** No cliente ela é
 * `min(CONFIANCA_MAX, atual + confiancaDaMissao(def))`, concedida uma vez por
 * entrega, e `confiancaDaMissao` é tabela. Logo ela DERIVA e não precisa de
 * coluna — exatamente como o nível deriva do XP, e pelo mesmo motivo escrito
 * em `progresso.ts`: "guardar XP e nível é guardar a mesma informação duas
 * vezes, e duas cópias de um número divergem".
 *
 * ## Por que a mescla é MONOTÔNICA
 *
 * É ela que faz o multi-dispositivo funcionar sem código de mescla. Progresso
 * só sobe, aceitar só liga, entrega é irreversível — então duas máquinas em
 * paralelo SOMAM, como `melhor_setor` já faz. Não há "última escrita vence" em
 * lugar nenhum, que é o defeito que a Matriz e o casco em campo já tiveram.
 */

export interface LinhaDeMissao {
  passos: number[];
  iniciada: boolean;
  entregueEm: number | null;
}

/** Quantas missões um envio pode declarar. */
export const MISSOES_MAX = 200;

/**
 * Junta o que está guardado com o que o cliente mandou.
 *
 * | campo | regra | por quê |
 * |---|---|---|
 * | `passos` | MAX elemento a elemento | contador de progresso só sobe |
 * | `iniciada` | OU | aceitar em qualquer aparelho vale |
 * | `entregueEm` | o primeiro vence | entrega é irreversível |
 */
export function mesclarMissao(
  guardada: LinhaDeMissao | null,
  recebida: LinhaDeMissao,
): LinhaDeMissao {
  if (!guardada) return recebida;
  const tamanho = Math.max(guardada.passos.length, recebida.passos.length);
  const passos: number[] = [];
  for (let i = 0; i < tamanho; i++) {
    passos.push(Math.max(guardada.passos[i] ?? 0, recebida.passos[i] ?? 0));
  }
  return {
    passos,
    iniciada: guardada.iniciada || recebida.iniciada,
    entregueEm: guardada.entregueEm ?? recebida.entregueEm,
  };
}

export type RecusaDeMissao =
  | 'missao_desconhecida'
  | 'passos_insuficientes'
  | 'ja_entregue';

/**
 * A entrega pode ser aceita? — a validação B do plano.
 *
 * Confere o que o servidor SABE sozinho: que a missão existe no catálogo, que
 * ela ainda não foi entregue, e que os passos declarados alcançam o alvo de
 * cada objetivo. O catálogo é `@data`, que o servidor já importa, então a
 * conferência usa a MESMA tabela do cliente — não há cópia da regra.
 *
 * O que ela NÃO cobre, e está escrito para não parecer mais do que é: se os
 * passos declarados foram merecidos. Isso é o nível C — o servidor contar os
 * abates ele mesmo —, e é a Fase 5 inteira.
 */
export function podeEntregar(
  id: string,
  linha: LinhaDeMissao,
): RecusaDeMissao | null {
  const def = MISSAO_POR_ID.get(id);
  if (!def) return 'missao_desconhecida';
  if (linha.entregueEm !== null) return 'ja_entregue';

  for (let i = 0; i < def.objetivos.length; i++) {
    const alvo = def.objetivos[i]!.alvo;
    if ((linha.passos[i] ?? 0) < alvo) return 'passos_insuficientes';
  }
  return null;
}

/**
 * A confiança de cada contato, DERIVADA das entregas.
 *
 * Não há coluna para ela: somar `confiancaDaMissao` sobre o que foi entregue
 * devolve o mesmo número que o cliente mantinha somando a cada entrega. Uma
 * segunda cópia divergiria na primeira vez que alguém mexesse na tabela de
 * confiança, e o sintoma seria a barra do jogador mudando ao sincronizar.
 */
export function confiancaDerivada(
  entregues: readonly string[],
): Record<string, number> {
  const por: Record<string, number> = {};
  for (const id of entregues) {
    const def = MISSAO_POR_ID.get(id);
    if (!def?.giverId) continue;
    const ganho = confiancaDaMissao(def);
    if (!(ganho > 0)) continue;
    por[def.giverId] = Math.min(CONFIANCA_MAX, (por[def.giverId] ?? 0) + ganho);
  }
  return por;
}

/** Aparência mínima de uma linha vinda do cliente, sem confiar em nada. */
export function linhaSa(bruta: unknown): LinhaDeMissao | null {
  if (!bruta || typeof bruta !== 'object') return null;
  const o = bruta as { passos?: unknown; iniciada?: unknown; entregueEm?: unknown };
  const passos = Array.isArray(o.passos)
    ? o.passos.slice(0, 8).map((n) => Math.max(0, Math.floor(Number(n) || 0)))
    : [];
  const entregue = Number(o.entregueEm);
  return {
    passos,
    iniciada: o.iniciada === true,
    entregueEm: Number.isFinite(entregue) && entregue > 0 ? Math.floor(entregue) : null,
  };
}
