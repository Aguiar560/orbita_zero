import { HULL_BY_ID } from '@data/hulls';
import type { ElementId, GameState, Item, SlotId } from './types';

/**
 * O elemento de uma NAVE, e o que ela aceita equipar.
 *
 * ## A regra
 *
 * Uma nave só monta item **neutro** ou **do próprio elemento**. É o que dá
 * identidade tática ao casco: uma nave de gelo é uma nave de gelo, e não um
 * chassi onde cabe qualquer coisa que caiu.
 *
 * ## Por que isto não transforma drop raro em lixo
 *
 * Sozinha, a regra seria cruel de um jeito invisível: a chance de um item sair
 * NEUTRO cai com a raridade (80% no Comum, 3% no Divino), então quanto mais raro
 * o achado, menor a chance de ele servir. Medido, um Divino serviria em 22% das
 * vezes — a peça mais difícil do jogo chegaria inútil quatro vezes em cinco.
 *
 * Por isso a regra só existe junto do serviço de **troca de elemento do item**,
 * na Central de Serviços. Com ele, elemento errado deixa de ser lixo e vira uma
 * viagem à loja: 81,7% dos drops caem prontos, 18,3% passam por lá, e 0% viram
 * nada. O custo é a moeda, não a peça.
 *
 * ## Por que a nave tem elemento PRÓPRIO no save
 *
 * `hulls.ts` dá o elemento NATIVO, e ele é fixo — é tabela. Mas a Central de
 * Serviços também troca o elemento da nave, e essa escolha é do jogador e
 * precisa sobreviver ao boot. `naves[id].elemento` guarda a troca; ausente
 * significa "como saiu de fábrica".
 */

/** O elemento em que a nave está AGORA. Cai no nativo se nunca foi trocado. */
export function elementoDaNave(state: GameState, hullId = state.hull): ElementId {
  const nave = state.naves[hullId];
  return nave?.elemento ?? HULL_BY_ID.get(hullId)?.element ?? 'padrao';
}

/** A nave voltou ao elemento de fábrica? Só a tela usa, para dizer isso. */
export const ehElementoNativo = (state: GameState, hullId = state.hull): boolean =>
  elementoDaNave(state, hullId) === (HULL_BY_ID.get(hullId)?.element ?? 'padrao');

/**
 * Esta nave aceita esta peça?
 *
 * Item sem elemento é peça de save antigo e conta como neutra — recusá-la
 * desmontaria conjuntos inteiros de quem já jogava, e um item sem elemento
 * nunca teve identidade tática para conflitar com a da nave.
 *
 * A nave de elemento `padrao` aceita SÓ neutro. Não é caso especial: `padrao` é
 * o elemento dela, e a regra é a mesma para todo mundo. É também o preço de
 * voar sem aposta elemental — o dano neutro nunca é resistido (`CLAUDE.md`), e
 * a contrapartida é não poder montar arsenal elemental.
 */
export function naveAceita(item: Item, elementoDaNave: ElementId): boolean {
  const doItem = item.element ?? 'padrao';
  return doItem === 'padrao' || doItem === elementoDaNave;
}

/** Atalho para quem já tem o estado em mãos. */
export const podeEquipar = (state: GameState, item: Item, hullId = state.hull): boolean =>
  naveAceita(item, elementoDaNave(state, hullId));

/**
 * As peças que a nave está usando e NÃO poderia — depois de uma troca de
 * elemento, por exemplo.
 *
 * Devolver em vez de desequipar na hora é deliberado: quem decide o que fazer
 * com elas é o jogador, e uma troca de elemento que esvaziasse o conjunto sem
 * avisar seria a pior forma de descobrir a regra.
 */
export function pecasIncompativeis(
  state: GameState,
  hullId = state.hull,
): { slot: SlotId; item: Item }[] {
  const nave = state.naves[hullId];
  if (!nave?.equipped) return [];
  const elemento = elementoDaNave(state, hullId);
  const fora: { slot: SlotId; item: Item }[] = [];
  for (const [slot, item] of Object.entries(nave.equipped)) {
    if (item && !naveAceita(item, elemento)) fora.push({ slot: slot as SlotId, item });
  }
  return fora;
}
