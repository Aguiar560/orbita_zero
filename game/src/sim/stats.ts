import { RES_STAT, RESISTIVEIS, STAT_IDS, type ElementId, type GameState, type Item, type StatId, type Stats } from './types';
import { getHull } from '@data/hulls';
import { RES_MAX, RES_MIN, aplicarLimites } from '@data/balance/limites';
import {
  EXPLOSAO_EFICACIA, JANELA_DE_COMBATE, PENETRACAO_EFICACIA, PERFURACAO_EFICACIA, RENDA_PESO, SORTE_PESO,
  VELOCIDADE_EFICACIA,
} from '@data/balance/orcamento';
import { COMANDO_IA_MAX, COMANDO_IA_POR_NIVEL, NAVE_GANHO_POR_NIVEL } from '@data/balance/curvas';
import { rarityInfo } from '@data/rarity';

/**
 * O `power` da raridade que vale 1,0 contra a curva do inimigo.
 *
 * A curva de setor foi calibrada supondo o jogador com equipamento adequado, e
 * adequado no FIM da curva é o Mítico. Sem normalizar, ligar o campo só
 * empurrava todas as paredes para fora: o Comum continuava valendo 1,0 e o
 * resto subia junto.
 *
 * Com o Mítico em 1,0, o Comum vale 0,20 e o Divino 1,43 — e a raridade volta a
 * decidir até onde se vai.
 */
const RARIDADE_DE_REFERENCIA = 4.9;

import { BASE_BY_ID, ITEM_SETS, SET_BY_ID } from '@data/items';
import { SHOP_BY_ID } from '@data/shop';
import { treeModifiers } from './tree';
import { montarPacote } from './dano';
import { CRIT_ELEM_BASE, CRIT_ELEM_DANO_BASE } from '@data/balance/elemental';

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
  return Math.min(RES_MAX, Math.max(RES_MIN, stats[RES_STAT[element]]));
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

  // O nível da nave amplifica os atributos DELA, não os do equipamento: é o que
  // faz desenvolver um casco valer a pena e o que dá sentido a manter uma frota
  // (§18). Sem isso, o nível de nave seria um número sem efeito.
  const nivelNave = state.naves[state.hull]?.nivel ?? 1;
  const crescimento = 1 + (nivelNave - 1) * NAVE_GANHO_POR_NIVEL;

  for (const [stat, value] of Object.entries(hull.stats)) {
    acc.add[stat as StatId] += (value ?? 0) * crescimento;
  }

  for (const item of Object.values(state.equipped)) {
    if (!item) continue;
    const base = BASE_BY_ID.get(item.baseId);
    /**
     * O implícito escala com o NÍVEL e com a RARIDADE.
     *
     * Antes só com o nível — e o campo `power` da tabela de raridades, que
     * existe desde sempre com a escada 1,0 / 1,3 / 1,75 / 2,4 / 3,4 / 4,9 / 7,0,
     * NUNCA era lido por ninguém. Uma dimensão inteira de design declarada e
     * ignorada.
     *
     * A consequência era grave e invisível: um Comum e um Divino do mesmo nível
     * tinham o mesmo implícito, e como o implícito domina o item, a raridade
     * quase não mudava o poder. Medido antes: um conjunto só de Comuns dava
     * conta até o setor 180, e do Épico para cima nenhuma raridade travava
     * dentro dos 300 — quando a intenção é que Comum não passe do chefe 10.
     */
    if (base) {
      acc[base.implicit.kind][base.implicit.stat] +=
        base.implicit.per * item.ilvl * (rarityInfo(item.rarity).power / RARIDADE_DE_REFERENCIA);
    }
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
  acc.add.iaSkill += Math.min(COMANDO_IA_MAX, state.command.nivel * COMANDO_IA_POR_NIVEL);

  const out = {} as Stats;
  for (const id of STAT_IDS) {
    out[id] = (BASE_STATS[id] + acc.add[id]) * (1 + acc.mul[id]);
  }

  // A potência elemental NÃO dobra mais dentro de `dano`.
  //
  // Dobrava, e era o que impedia o §3 de existir: com a potência embutida, o
  // tiro saía como um número só e o confronto multiplicava ele INTEIRO — toda a
  // nave virava elemental assim que equipava uma arma de fogo. Agora `dano` é o
  // componente NORMAL e cada potência vira um componente próprio em
  // `montarPacote` (`sim/dano.ts`). Quem quiser o total pede `danoTotal`.

  // Pisos e tetos de sanidade (§40), declarados em `data/balance/limites.ts`.
  aplicarLimites(out);

  return out;
}

/**
 * Dano teórico por segundo contra UM alvo.
 *
 * Deliberadamente alvo único: é esta função que a calibragem de curva compara
 * com a vida do inimigo (`tools/lib/balanco.ts`), e ali o que importa é quanto
 * tempo leva para derrubar uma nave. Perfuração e explosão não entram aqui —
 * elas valem contra a onda, não contra o alvo, e entram em `powerScore`.
 */
export function dps(stats: Stats): number {
  // Soma os COMPONENTES (§3): normal + Σ elementais. Antes bastava ler
  // `stats.dano`, porque a potência elemental estava embutida nele; agora ela é
  // componente à parte e ficaria de fora da conta.
  const p = montarPacote(stats);
  const normal = p.normal * (1 + stats.critChance * stats.critDano);

  let elemental = 0;
  for (const v of Object.values(p.elementais)) elemental += v ?? 0;
  // Os dois críticos entram separados, cada um sobre a sua parcela — é o que
  // faz deles dois atributos e não um.
  elemental *= 1 + (CRIT_ELEM_BASE + stats.critElemChance) * (CRIT_ELEM_DANO_BASE + stats.critElemDano);

  return (normal + elemental) * stats.cadencia * stats.projeteis;
}

/** "Vida efetiva" — casco + escudo + o que a regeneração devolve num combate típico. */
export function effectiveHp(stats: Stats): number {
  return stats.vida + stats.escudo + stats.regen * JANELA_DE_COMBATE;
}

/**
 * Nota única de poder, usada em comparações rápidas na UI e no auto-equipar.
 *
 * Enxerga os 27 atributos (§7). Antes via 9, e os 18 restantes valiam zero: uma
 * peça de resistência pura era descartada como se fosse vazia. Ver
 * `data/balance/orcamento.ts` para de onde vem cada coeficiente.
 *
 * A forma é PRODUTO e não soma de propósito. `√dps × √vida` faz um canhão de
 * vidro pontuar abaixo de uma nave equilibrada — é o que impede o auto-equipar
 * de montar algo que mata rápido e morre mais rápido ainda. Uma soma ponderada
 * plana perderia isso.
 */
export function powerScore(stats: Stats): number {
  // Contra a ONDA: perfuração acerta o alvo seguinte da linha, explosão respinga
  // nos vizinhos. Nenhum dos dois melhora o tempo de morte de um alvo isolado,
  // então ficam fora de `dps` e entram só aqui.
  const alcance = (1 + stats.perfuracao * PERFURACAO_EFICACIA)
    * (1 + stats.explosao * EXPLOSAO_EFICACIA);

  // Penetração não cabe em `dps`, que não tem alvo: ela só existe contra quem
  // resiste. E incide só sobre o COMPONENTE ELEMENTAL — o normal nunca foi
  // resistido, então penetrá-lo não significaria nada.
  const pacote = montarPacote(stats);
  let elemental = 0;
  for (const v of Object.values(pacote.elementais)) elemental += v ?? 0;
  const fracaoElemental = elemental / Math.max(1e-9, elemental + pacote.normal);
  const penetra = 1 + stats.penetracao * PENETRACAO_EFICACIA * fracaoElemental;

  // Resistência não some com o dano: ela DIVIDE o que chega. A média sobre os
  // cinco elementos é o que traduz "resisto muito a um" em sobrevivência real —
  // uma peça com 75% de resistência a fogo e nada mais cobre um quinto do que
  // pode vir pela frente, e a nota tem de dizer isso.
  const media = RESISTIVEIS.reduce((s, e) => s + resistance(stats, e), 0) / RESISTIVEIS.length;
  const mitigacao = 1 / (1 - Math.min(RES_MAX, media));

  // Velocidade evita o tiro em vez de absorvê-lo, mas o efeito é o mesmo eixo.
  const esquiva = 1 + stats.velocidade * VELOCIDADE_EFICACIA;

  const utilidade = 1
    + stats.sorte * SORTE_PESO
    + (stats.sucataGanho + stats.nucleoGanho + stats.xpGanho) * RENDA_PESO;

  return Math.sqrt(dps(stats) * alcance * penetra)
    * Math.sqrt(effectiveHp(stats) * mitigacao * esquiva)
    * (1 + stats.iaSkill * 0.5)
    * utilidade;
}
