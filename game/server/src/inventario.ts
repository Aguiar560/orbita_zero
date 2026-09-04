import { naveAceita } from '@sim/elemento-da-nave';
import type { Item, SlotId } from '@sim/types';

import { TIPOS, type Lote, type TipoDeDrop } from './lote';

/**
 * O inventário, do lado do servidor.
 *
 * ## A ideia central: o item nunca sobe
 *
 * A tentação óbvia é o cliente mandar o item que pegou. Não serve — mandar o
 * item é poder inventá-lo, e a Fase 3a inteira existe para tirar essa caneta da
 * mão dele.
 *
 * Aqui o cliente manda só **quantos** pegou de cada tipo. O servidor sabe a
 * semente, sabe a página e sabe o cursor, então DERIVA quais itens são. Nenhum
 * byte de item viaja do cliente para o servidor, e por isso não há o que
 * validar: o que não trafega não pode ser forjado.
 *
 * ## Por que um lote de comandos, e não uma rota por operação
 *
 * Medido em 03/09: 186 itens por hora, e a esmagadora maioria é descartada
 * automaticamente no mesmo instante em que cai. Uma requisição por operação
 * seriam ~370 por hora, por jogador. Um lote no ritmo do setor — coletei nove,
 * descartei sete, equipei uma — é uma a cada três minutos, o mesmo ritmo da
 * carteira, porque é o mesmo evento.
 */

export interface Comandos {
  /** Quantos itens de cada tipo foram tirados do lote. */
  coletar?: Partial<Record<TipoDeDrop, number>>;
  /** `uid`s a remover da mochila — venda, desmanche ou descarte. */
  descartar?: string[];
  /** Peças a equipar. `nave` nulo desequipa. */
  equipar?: { uid: string; nave: string | null; slot?: SlotId }[];
}

export type RecusaDeInventario =
  | 'comandos_invalidos'
  | 'coleta_grande_demais'
  | 'lote_esgotado'
  | 'item_nao_e_seu'
  | 'nave_nao_aceita'
  | 'slot_errado';

/**
 * Teto de itens por lote de comandos.
 *
 * Nove por setor é o ritmo normal; trinta e seis é o lote inteiro de um tipo.
 * Acima disso é cliente quebrado ou tentativa de despejo, e nos dois casos
 * recusar é melhor que gravar.
 */
export const COLETA_MAX = 40;
export const DESCARTE_MAX = 200;

/** O corpo é bem formado? Não olha estado — isso é do chamador. */
export function conferirComandos(c: Comandos): RecusaDeInventario | null {
  const coletar = c.coletar ?? {};
  let total = 0;
  for (const tipo of TIPOS) {
    const n = coletar[tipo];
    if (n === undefined) continue;
    if (!Number.isSafeInteger(n) || n < 0) return 'comandos_invalidos';
    total += n;
  }
  if (total > COLETA_MAX) return 'coleta_grande_demais';

  const descartar = c.descartar ?? [];
  if (!Array.isArray(descartar) || descartar.length > DESCARTE_MAX) return 'comandos_invalidos';
  if (descartar.some((u) => typeof u !== 'string' || u.length > 64)) return 'comandos_invalidos';

  const equipar = c.equipar ?? [];
  if (!Array.isArray(equipar) || equipar.length > 40) return 'comandos_invalidos';
  for (const e of equipar) {
    if (typeof e?.uid !== 'string') return 'comandos_invalidos';
    if (e.nave !== null && typeof e.nave !== 'string') return 'comandos_invalidos';
  }
  return null;
}

/**
 * Quais itens o jogador tirou do lote, dado o cursor.
 *
 * Devolve `null` quando o pedido passa do que o lote tem. Recusar é melhor que
 * aparar em silêncio: aparar esconderia um cliente que está contando errado, e
 * contar errado sobre item é exatamente o que interessa aparecer.
 */
export function derivarColeta(
  lote: Lote,
  cursor: Record<TipoDeDrop, number>,
  pedido: Partial<Record<TipoDeDrop, number>>,
): { itens: Item[]; cursor: Record<TipoDeDrop, number> } | null {
  const novo = { ...cursor };
  const itens: Item[] = [];
  for (const tipo of TIPOS) {
    const n = pedido[tipo] ?? 0;
    if (n <= 0) continue;
    const de = cursor[tipo];
    if (de + n > lote[tipo].length) return null;
    itens.push(...lote[tipo].slice(de, de + n));
    novo[tipo] = de + n;
  }
  return { itens, cursor: novo };
}

/**
 * A peça pode ir para esta nave?
 *
 * `naveAceita` é o MESMO arquivo que o cliente usa — nenhuma cópia da regra.
 * Ela é pura e recebe só o elemento da nave, então o servidor a aplica sem
 * precisar do estado inteiro do jogo.
 *
 * Vale dizer o que esta checagem NÃO cobre: o elemento da nave é o de fábrica,
 * de `HULL_BY_ID`. O serviço de loja que TROCA o elemento de uma nave ainda
 * mora no save, então uma nave com elemento trocado é avaliada aqui pelo
 * elemento antigo. Fica registrado no PLANO como parte do que falta.
 */
export function podeIrPara(item: Item, elementoDaNave: string, slot: SlotId): RecusaDeInventario | null {
  if (item.slot !== slot) return 'slot_errado';
  if (!naveAceita(item, elementoDaNave as never)) return 'nave_nao_aceita';
  return null;
}
