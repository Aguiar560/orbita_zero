import { NIVEL_MAX } from '@data/balance/curvas';
import { HULL_BY_ID } from '@data/hulls';
import { SLOT_BY_ID } from '@data/items';
import { RARITIES } from '@data/rarity';
import { RESOURCE_IDS, type Item, type ResourceId, type Resources } from './types';

/**
 * Saneamento de valores do save.
 *
 * ## Por que existe
 *
 * `migrate` valida FORMA e não VALORES: garante que `inventory` é um array,
 * não que `sucata` caiba num número plausível nem que um item tenha um slot
 * que exista. Isso bastou enquanto o save era só do jogador e o pior caso era
 * ele trapaceando consigo mesmo.
 *
 * Deixa de bastar em dois momentos, e os dois estão no caminho:
 *
 * 1. **Save importado.** `importSave` aceita qualquer base64. O vetor não é
 *    técnico, é social — um "save de presente" postado num fórum.
 * 2. **Conta e placar.** Um servidor que aceita o que o cliente relata é um
 *    placar decorativo. A validação de verdade tem de estar no servidor, mas
 *    ela precisa de um formato que já chegue são.
 *
 * ## O que este módulo NÃO é
 *
 * Não é antitrapaça. Quem edita o `localStorage` continua podendo se dar
 * recursos dentro da faixa válida, e nada aqui impede isso — nem tem como, do
 * lado do cliente. O que ele impede é o save ABSURDO: `Infinity`, `NaN`,
 * negativo, item com slot inexistente, referência a casco que não existe.
 *
 * A diferença importa: absurdo QUEBRA o jogo (uma barra de vida `NaN` não
 * desenha, um slot inexistente derruba o painel), enquanto exagero dentro da
 * faixa só estraga a graça de quem fez. O primeiro é bug; o segundo é escolha
 * de quem joga sozinho.
 */

/** Teto de recurso. Alto de propósito — a régua aqui é "cabe num número". */
export const RECURSO_MAX = 1e15;

/**
 * Número finito, não-negativo e dentro do teto.
 *
 * `Number.isFinite` recusa `NaN` e os infinitos de uma vez. Vale lembrar que
 * `NaN` sobrevive a toda comparação — `NaN > 0` e `NaN < 0` são ambos falsos —,
 * então testar por faixa sem testar finitude deixa passar exatamente o valor
 * que mais estraga a tela.
 */
export function numeroSao(valor: unknown, padrao = 0, teto = RECURSO_MAX): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(teto, Math.max(0, n));
}

/** Inteiro dentro de uma faixa fechada. */
export function inteiroSao(valor: unknown, min: number, max: number, padrao = min): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Uma peça é utilizável?
 *
 * Só o que faria a tela quebrar ou o cálculo virar `NaN`. O poder da peça não é
 * conferido aqui de propósito: recalcular o orçamento de afixos do §7 no boot
 * custaria caro e é justamente o trabalho que cabe ao servidor, que pode fazer
 * isso sem segurar a abertura do jogo.
 */
export function itemUtilizavel(item: unknown): item is Item {
  if (!item || typeof item !== 'object') return false;
  const i = item as Partial<Item>;
  return typeof i.uid === 'string' && i.uid.length > 0
    && typeof i.slot === 'string' && SLOT_BY_ID.has(i.slot)
    && Number.isFinite(i.rarity) && (i.rarity as number) >= 0 && (i.rarity as number) < RARITIES.length
    && Number.isFinite(i.ilvl) && (i.ilvl as number) > 0
    && Array.isArray(i.affixes);
}

/** Cascos que existem no catálogo, sem repetição. */
export function frotaSa(fleet: unknown): string[] {
  if (!Array.isArray(fleet)) return [];
  return [...new Set(fleet.filter((id): id is string => typeof id === 'string' && HULL_BY_ID.has(id)))];
}

/** Setor dentro da campanha. */
export const setorSao = (valor: unknown): number => inteiroSao(valor, 1, NIVEL_MAX, 1);

/**
 * Todos os recursos dentro da faixa.
 *
 * Percorre `RESOURCE_IDS` e não as chaves do objeto recebido: um save de fora
 * pode trazer chaves a mais, e copiá-las levaria lixo para dentro do estado.
 * Iterar pela lista canônica garante que sai exatamente o que o jogo conhece.
 */
export function recursosSaos(bruto: Partial<Record<ResourceId, unknown>>): Resources {
  const saidas = {} as Resources;
  for (const id of RESOURCE_IDS) saidas[id] = numeroSao(bruto?.[id]);
  return saidas;
}
