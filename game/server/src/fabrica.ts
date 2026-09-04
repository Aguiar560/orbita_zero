import { Rng } from '@core/math';
import { ilvlDaFusao, receitaPara } from '@data/balance/fusao';
import { HULLS } from '@data/hulls';
import { rollItem } from '@sim/loot';
import type { Item, Rarity } from '@sim/types';

import { novaSemente, sorteValida } from './lote';

/**
 * Síntese de itens e compra de casco — as duas últimas portas por onde algo
 * nascia fora do servidor.
 *
 * ## Por que a síntese precisava sair do cliente
 *
 * A Fase 3a fechou o drop e a 3b fechou o inventário, mas a fusão continuava
 * rodando aqui: ela consome dez peças e produz uma com `rollItem` LOCAL. Era a
 * última caneta — bastava fundir lixo até o resultado agradar, e o item saía
 * legítimo pelos olhos de todo o resto do sistema.
 *
 * ## Por que não há re-rolagem, mesmo com semente nova a cada fusão
 *
 * Diferente do lote, aqui a semente é sorteada na hora e não fica guardada. Ela
 * pode: **a fusão CONSOME as peças**. Repetir a chamada não encontra mais os
 * `uid`s, então não existe segunda tentativa para comparar com a primeira. O
 * custo já foi pago quando o resultado aparece.
 */

export type RecusaDaFusao =
  | 'uids_invalidos'
  | 'itens_nao_sao_seus'
  | 'raridades_diferentes'
  | 'favorito_na_fusao'
  | 'sem_receita'
  | 'quantidade_errada';

/**
 * Confere a fusão contra os itens que o SERVIDOR tem.
 *
 * Cada regra aqui existe porque quebrá-la vale poder: misturar raridades
 * transformaria um Comum em degrau para Divino; quantidade errada barateava o
 * degrau; favorito na fusão destruiria a peça que o jogador marcou para não
 * perder — e essa é a única das quatro que não é exploração, é dano.
 */
export function conferirFusao(
  itens: readonly Item[],
  pedidos: readonly string[],
): { receita: NonNullable<ReturnType<typeof receitaPara>> } | { erro: RecusaDaFusao } {
  if (!Array.isArray(pedidos) || pedidos.length === 0 || pedidos.length > 40) {
    return { erro: 'uids_invalidos' };
  }
  // Faltou item = algum `uid` não é desta pessoa, ou não existe. Os dois casos
  // dão a mesma resposta de propósito: dizer qual é ajuda quem está sondando.
  if (itens.length !== pedidos.length) return { erro: 'itens_nao_sao_seus' };

  const raridade = itens[0]!.rarity;
  if (itens.some((i) => i.rarity !== raridade)) return { erro: 'raridades_diferentes' };
  if (itens.some((i) => i.favorite)) return { erro: 'favorito_na_fusao' };

  const receita = receitaPara(raridade);
  if (!receita) return { erro: 'sem_receita' };
  if (itens.length !== receita.quantidade) return { erro: 'quantidade_errada' };

  return { receita };
}

/** O item que a fusão produz. Semente do servidor, sorteada na hora. */
export function fundir(
  itens: readonly Item[],
  receita: NonNullable<ReturnType<typeof receitaPara>>,
  sorte: number,
  universo: number,
): Item {
  const rng = new Rng(novaSemente());
  const saida = rng.weighted(receita.resultados, (r) => r.peso).raridade as Rarity;
  return rollItem(
    rng,
    ilvlDaFusao(itens.map((i) => i.ilvl)),
    sorteValida(sorte),
    Math.max(0, Math.floor(Number(universo) || 0)),
    // `exata` e não `floor`: a receita JÁ sorteou a raridade, e usá-la como piso
    // deixava o sorteio natural subir por cima dela — o Divino anunciado a 3%
    // saía a 10,4%.
    { exata: saida },
  );
}

// ── frota ───────────────────────────────────────────────────────────────────

export type RecusaDeCasco =
  | 'casco_desconhecido'
  | 'casco_ja_e_seu'
  | 'casco_nao_e_comprável'
  | 'casco_de_piloto';

/**
 * O casco pode ser comprado?
 *
 * Não confere setor nem nível: os dois são declarados pelo cliente e conferi-los
 * contra o que ele mesmo diz seria teatro. O que o servidor confere é o que ele
 * SABE — que o casco existe, que não é protótipo, que não é de piloto e que a
 * pessoa ainda não o tem. O preço é cobrado do livro-caixa, que é real.
 *
 * Setor e nível voltam a ser conferíveis na Fase 5, quando o servidor souber
 * onde o jogador está sem perguntar.
 */
export function conferirCompraDeCasco(
  id: string,
  jaTem: boolean,
): { custo: number } | { erro: RecusaDeCasco } {
  const hull = HULLS.find((h) => h.id === id);
  if (!hull) return { erro: 'casco_desconhecido' };
  if (jaTem) return { erro: 'casco_ja_e_seu' };
  if (hull.prototype) return { erro: 'casco_nao_e_comprável' };
  // Casco de personagem nunca é comprável — nem o seu, que você já tem, nem o
  // dos outros três. Comprar o dos outros esvaziaria a escolha da primeira tela
  // por dentro: bastaria juntar cristal para ter os quatro.
  if (hull.piloto) return { erro: 'casco_de_piloto' };
  return { custo: hull.cost };
}

/** O casco inicial de um piloto, que entra na frota sem custo. */
export function cascoDoPiloto(id: string): string | null {
  const hull = HULLS.find((h) => h.piloto === id);
  return hull?.id ?? null;
}
