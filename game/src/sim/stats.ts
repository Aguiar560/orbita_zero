import { DANO_STAT, RES_STAT, STAT_IDS, type ElementId, type GameState, type Item, type StatId, type Stats } from './types';
import { getHull } from '@data/hulls';
import { BASE_BY_ID, ITEM_SETS, SET_BY_ID } from '@data/items';
import { SHOP_BY_ID } from '@data/shop';
import { treeModifiers } from './tree';

/**
 * Base neutra. O casco entra como a primeira camada aditiva; estes valores só
 * garantem que nenhuma conta divida por zero e que crítico/perfuração tenham
 * um piso sensato.
 */
const ZERADO = Object.fromEntries(STAT_IDS.map((id) => [id, 0])) as Stats;

export const BASE_STATS: Stats = {
  // Tudo zero por padrão, gerado da lista de atributos: quando um atributo novo
  // entra em `STAT_IDS` — os doze elementais entraram assim — ele já nasce aqui
  // com base neutra, sem precisar lembrar de mexer nesta tabela.
  ...ZERADO,
  critChance: 0.03,
  critDano: 0.5,
  /**
   * Sincronia do piloto: começa quase nula de propósito.
   *
   * O piloto de fábrica é ruim — reage tarde, treme, não antecipa nada e morre.
   * Ele melhora com patente, melhorias de pilotagem, nós da matriz e itens de
   * controle. Antes esta base era 0.35, o que já entregava um piloto competente
   * no primeiro minuto e apagava toda essa curva.
   */
  iaSkill: 0.04,
};

interface Accum {
  add: Stats;
  mul: Stats;
}

function emptyAccum(): Accum {
  const add = {} as Stats;
  const mul = {} as Stats;
  for (const id of STAT_IDS) {
    add[id] = 0;
    mul[id] = 0;
  }
  return { add, mul };
}

/** Quantas peças de cada conjunto estão equipadas. */
export function setCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of Object.values(state.equipped) as (Item | undefined)[]) {
    if (!item?.set) continue;
    counts.set(item.set, (counts.get(item.set) ?? 0) + 1);
  }
  return counts;
}

/** Bônus de conjunto ativos, já filtrados pelo número de peças. */
export function activeSetBonuses(state: GameState) {
  const counts = setCounts(state);
  return ITEM_SETS.flatMap((set) => {
    const n = counts.get(set.id) ?? 0;
    return set.bonuses.filter((b) => n >= b.pieces);
  });
}

/** Progresso de cada conjunto, para a UI (inclui os que ainda não ativaram). */
export function setProgress(state: GameState) {
  const counts = setCounts(state);
  return ITEM_SETS
    .map((set) => ({ set, count: counts.get(set.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

export { SET_BY_ID };

// ── Elementos ───────────────────────────────────────────────────────────────

/**
 * Elemento do tiro: a arma principal manda, o casco decide quando não há arma.
 *
 * É a peça que dá sentido a trocar de arma no meio de uma galáxia — o jogador
 * pode carregar duas principais e alternar conforme a frota que enfrenta.
 */
export function activeElement(state: GameState): ElementId {
  return state.equipped.principal?.element ?? getHull(state.hull).element;
}

/**
 * Elemento da DEFESA: o escudo equipado.
 *
 * Sem escudo o jogador é neutro — não sofre nem ganha no anel. Assim escolher
 * escudo deixa de ser "o de número maior" e vira uma leitura do inimigo.
 */
export function defenseElement(state: GameState): ElementId {
  return state.equipped.escudo?.element ?? 'padrao';
}

/** Resistência efetiva contra um elemento, já com o teto aplicado. */
export function resistance(stats: Stats, element: ElementId): number {
  // Dano normal não é resistível: ele vai direto no escudo, no casco e na vida.
  if (element === 'padrao') return 0;
  return Math.min(0.75, stats[RES_STAT[element]]);
}

/**
 * Resolve os atributos efetivos do jogador.
 *
 * Ordem: base → casco → equipamento → conjuntos → matriz → loja → patente.
 * A fórmula final é `(base + Σadd) × (1 + Σmul)`, deliberadamente aditiva no
 * multiplicador: fontes multiplicativas empilhadas explodem cedo demais e
 * transformam qualquer item novo em "ou é o melhor de todos, ou é lixo".
 */
export function resolveStats(state: GameState): Stats {
  const acc = emptyAccum();
  const hull = getHull(state.hull);

  for (const [stat, value] of Object.entries(hull.stats)) {
    acc.add[stat as StatId] += value ?? 0;
  }

  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    const base = BASE_BY_ID.get(item.baseId);
    if (base) acc[base.implicit.kind][base.implicit.stat] += base.implicit.per * item.ilvl;
    for (const affix of item.affixes) acc[affix.kind][affix.stat] += affix.value;
  }

  for (const bonus of activeSetBonuses(state)) {
    for (const [stat, value] of Object.entries(bonus.stats)) {
      acc[bonus.kind][stat as StatId] += value ?? 0;
    }
  }

  for (const mod of treeModifiers(state)) {
    acc[mod.kind][mod.stat] += mod.value;
  }

  for (const [id, owned] of Object.entries(state.shop)) {
    if (!owned) continue;
    const def = SHOP_BY_ID.get(id);
    if (!def?.stat) continue;
    acc[def.stat.kind][def.stat.id] += def.stat.per * owned;
  }

  // A patente de comando dá uma base de sincronia que cresce só de jogar.
  // Sem isso o piloto ficaria refém de encontrar os itens certos, e o começo
  // — onde ele é deliberadamente ruim — nunca melhoraria sozinho.
  acc.add.iaSkill += Math.min(0.4, state.command.level * 0.011);

  const out = {} as Stats;
  for (const id of STAT_IDS) {
    out[id] = (BASE_STATS[id] + acc.add[id]) * (1 + acc.mul[id]);
  }

  // Potência elemental dobra dentro de `dano`: a partir daqui todo o resto do
  // jogo — dps, pontuação de item, auto-equipar — enxerga o ganho sem precisar
  // saber que elementos existem. Só o CONFRONTO (vantagem contra a frota) fica
  // de fora, porque depende de quem está do outro lado da tela.
  out.dano *= 1 + out[DANO_STAT[activeElement(state)]];

  // Pisos e tetos de sanidade.
  out.projeteis = Math.max(1, Math.round(out.projeteis));
  out.perfuracao = Math.max(0, Math.round(out.perfuracao));
  out.cadencia = Math.max(0.2, out.cadencia);
  out.velocidade = Math.max(60, out.velocidade);
  out.vida = Math.max(1, out.vida);
  out.escudo = Math.max(0, out.escudo);
  out.critChance = Math.min(0.95, Math.max(0, out.critChance));
  out.iaSkill = Math.min(1, Math.max(0, out.iaSkill));
  out.sorte = Math.max(0, out.sorte);

  return out;
}

/** Dano teórico por segundo, contando crítico e projéteis. */
export function dps(stats: Stats): number {
  return stats.dano * stats.cadencia * stats.projeteis * (1 + stats.critChance * stats.critDano);
}

/** "Vida efetiva" — casco + escudo + o que a regeneração devolve num combate típico. */
export function effectiveHp(stats: Stats): number {
  const COMBAT_WINDOW = 20; // segundos de referência para valorizar regeneração
  return stats.vida + stats.escudo + stats.regen * COMBAT_WINDOW;
}

/** Nota única de poder, usada em comparações rápidas na UI e no auto-equipar. */
export function powerScore(stats: Stats): number {
  return Math.sqrt(dps(stats)) * Math.sqrt(effectiveHp(stats)) * (1 + stats.iaSkill * 0.5);
}
