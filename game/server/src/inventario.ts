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
 * ## Aparava? Não. Recusava — e recusar era o defeito
 *
 * Isto devolvia `null` quando o pedido passava do que o lote tem, com o
 * argumento de que "aparar esconderia um cliente contando errado". O argumento
 * está certo sobre ESCONDER e errado sobre RECUSAR, e a diferença custou o dia
 * 08/09 inteiro.
 *
 * O `null` virava `409` na rota, e o 409 derrubava o LOTE DE COMANDOS INTEIRO
 * — a coleta, os descartes e os equipamentos junto. O cliente devolvia tudo à
 * fila e reenviava o mesmo lote envenenado, para sempre. Efeitos medidos na
 * conta do Rafael:
 *
 * - inventário do cliente com 29 peças contra **9 no servidor**;
 * - o cursor do lote parado, então o pote nunca mais andava;
 * - e a Fabricação recusando com `itens_nao_sao_seus`, porque as peças do anel
 *   nunca chegaram a existir lá.
 *
 * Nada disso tinha sintoma no servidor. É a mesma lição que `planejarEquipar`
 * já tinha aprendido ao lado ("uma peça recusada aparece desequipada, que é a
 * verdade") e que a entrega de missão aprendeu depois. A coleta não tinha
 * aprendido.
 *
 * ## O que faz agora
 *
 * Dá o que o pote TEM e conta o que faltou. `faltaram` sobe na resposta, então
 * o cliente contando errado continua aparecendo — que era o objetivo real —
 * sem que a discordância destrua o resto do lote.
 *
 * E não afrouxa nada: o servidor continua derivando os itens da semente dele, e
 * aparar só pode entregar MENOS. Não há pedido que renda mais do que rendia.
 */
export function derivarColeta(
  lote: Lote,
  cursor: Record<TipoDeDrop, number>,
  pedido: Partial<Record<TipoDeDrop, number>>,
): {
  itens: Item[];
  cursor: Record<TipoDeDrop, number>;
  faltaram: Partial<Record<TipoDeDrop, number>>;
} {
  const novo = { ...cursor };
  const itens: Item[] = [];
  const faltaram: Partial<Record<TipoDeDrop, number>> = {};

  for (const tipo of TIPOS) {
    const n = pedido[tipo] ?? 0;
    if (n <= 0) continue;
    const de = cursor[tipo];
    const cabem = Math.max(0, Math.min(n, lote[tipo].length - de));

    if (cabem < n) faltaram[tipo] = n - cabem;
    if (cabem === 0) continue;

    itens.push(...lote[tipo].slice(de, de + cabem));
    novo[tipo] = de + cabem;
  }
  return { itens, cursor: novo, faltaram };
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

/**
 * O que fazer com cada `equipar` do lote, decidido de uma vez.
 *
 * ## O defeito que isto conserta
 *
 * A rota resolvia cada `equipar` com um `SELECT` ao vivo, e as coletas do MESMO
 * lote ainda não tinham sido gravadas — elas ficam numa lista de escritas que só
 * roda no fim. Então equipar uma peça que acabou de cair nunca encontrava a
 * peça, e a rota respondia 409.
 *
 * Pior que o 409: ele saía com `return`, ANTES do `batch`. O lote inteiro se
 * perdia junto — as coletas, os descartes e os outros equipamentos. E o cliente
 * devolve a fila ao início quando a requisição falha, então o mesmo comando
 * voltava no próximo envio e derrubava esse também. Uma peça equipada logo após
 * cair travava a sincronização de inventário PARA SEMPRE.
 *
 * Medido no D1 em 08/09: a conta do Rafael tinha onze itens, todos com
 * `nave` nulo. Nada nunca chegou a ser equipado no servidor, e a nave dele
 * aparecia pelada ao recarregar a página.
 *
 * ## Por que RECUSAR em vez de derrubar o lote
 *
 * Um comando que não dá para aplicar não melhora com retentativa: o item não é
 * da pessoa, ou a peça não serve naquela nave. Derrubar o lote por causa dele
 * transforma um comando ruim num bloqueio permanente de tudo. Aqui ele sai da
 * fila com um motivo, e o resto do lote passa.
 *
 * Isso não afrouxa nada: recusar é a decisão SEGURA. O que era inseguro é o
 * lote perdido levar junto os descartes — o inventário do servidor crescia com
 * peças que o jogador já tinha jogado fora.
 */
export interface PlanoDeEquipar {
  /** Trocas a aplicar, na ordem em que chegaram. */
  aplicar: { uid: string; nave: string; slot: SlotId }[];
  /** Peças a tirar do soquete. */
  desequipar: string[];
  /** O que não deu para aplicar, com o porquê. */
  recusados: { uid: string; motivo: RecusaDeInventario }[];
}

export function planejarEquipar(
  equipar: readonly { uid: string; nave: string | null; slot?: SlotId }[],
  /** A peça, venha ela do banco ou da coleta deste mesmo lote. */
  peca: (uid: string) => Item | null,
  /** O elemento de fábrica do casco, ou `null` se ele não existe. */
  elementoDoCasco: (nave: string) => string | null,
): PlanoDeEquipar {
  const plano: PlanoDeEquipar = { aplicar: [], desequipar: [], recusados: [] };

  for (const e of equipar) {
    const item = peca(e.uid);
    if (!item) { plano.recusados.push({ uid: e.uid, motivo: 'item_nao_e_seu' }); continue; }

    if (e.nave === null) { plano.desequipar.push(e.uid); continue; }

    const elemento = elementoDoCasco(e.nave);
    if (!elemento) { plano.recusados.push({ uid: e.uid, motivo: 'item_nao_e_seu' }); continue; }

    const mau = podeIrPara(item, elemento, (e.slot ?? item.slot) as SlotId);
    if (mau) { plano.recusados.push({ uid: e.uid, motivo: mau }); continue; }

    plano.aplicar.push({ uid: e.uid, nave: e.nave, slot: item.slot as SlotId });
  }

  return plano;
}
