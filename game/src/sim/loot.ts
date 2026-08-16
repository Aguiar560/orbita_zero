import { Rng, clamp } from '@core/math';
import { AFFIXES, BASE_BY_ID, ITEM_SETS, basesForIlvl, type AffixDef } from '@data/items';
import { RARITIES, rarityInfo } from '@data/rarity';
import { CHEST_BY_ID } from '@data/chests';
import { ELEMENTS } from '@data/elements';
import { AFIXO_ESCALA_POR_ILVL, DROP_BASE, DROP_SORTE_PESO, DROP_TETO } from '@data/balance/curvas';
import type { Affix, ElementId, GameState, Item, Rarity, SlotId, Stats } from './types';
import { resolveStats, powerScore } from './stats';

let uidCounter = 0;
const uid = (): string => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/**
 * Sorteia a raridade.
 *
 * `luck` desloca a curva multiplicando o peso das raridades altas — vale
 * `luck^raridade`, então +100% de sorte vale pouco no comum e muito na
 * relíquia, que é exatamente onde o jogador quer sentir o investimento.
 */
export function rollRarity(rng: Rng, luck: number, floor: Rarity = 0): Rarity {
  const boost = 1 + Math.max(0, luck);
  const pick = rng.weighted(RARITIES, (r) => (r.id < floor ? 0 : r.weight * Math.pow(boost, r.id)));
  return Math.max(floor, pick.id) as Rarity;
}

/** Gera um item completo. */
export function rollItem(
  rng: Rng,
  ilvl: number,
  luck: number,
  origin: number,
  opts: { slot?: SlotId; floor?: Rarity } = {},
): Item {
  // Bases são filtradas pelas três faixas mais altas disponíveis no nível: é o
  // que faz o inventário mudar de cara conforme o jogador avança, em vez de
  // continuar caindo o mesmo cano enferrujado no setor 60.
  const candidates = basesForIlvl(ilvl, opts.slot);
  const base = rng.weighted(candidates, (b) => 1 + b.tier);
  const rarity = rollRarity(rng, luck, opts.floor ?? 0);
  const info = rarityInfo(rarity);
  const element = rollElement(rng, rarity);

  // Um item só rola afixos DO SEU elemento: "canhão de fogo com +18% de dano de
  // gelo" seria uma linha morta na ficha, já que a arma dispara fogo.
  const eligible = AFFIXES.filter(
    (a) => (!a.slots || a.slots.includes(base.slot))
      && ilvl >= (a.minIlvl ?? 0)
      && (!a.element || a.element === element),
  );

  const affixes: Affix[] = [];
  const used = new Set<string>();
  for (let i = 0; i < info.affixes && used.size < eligible.length; i++) {
    const def = rng.weighted(eligible.filter((a) => !used.has(a.id)), (a) => a.weight);
    if (!def) break;
    used.add(def.id);
    affixes.push(rollAffix(rng, def, ilvl, info.power));
  }

  // Conjuntos só aparecem em raridades altas e apenas nos slots que o conjunto
  // cobre — juntar quatro peças precisa ser uma meta, não um acidente.
  let set: string | undefined;
  if (rng.chance(info.setChance)) {
    const eligibleSets = ITEM_SETS.filter((s) => s.slots.includes(base.slot));
    if (eligibleSets.length) set = rng.pick(eligibleSets).id;
  }

  return {
    uid: uid(),
    baseId: base.id,
    slot: base.slot,
    rarity,
    ilvl,
    affixes,
    element,
    icon: base.icon,
    origin,
    ...(set ? { set } : {}),
  };
}

/**
 * Elemento da peça.
 *
 * Peça comum quase sempre sai neutra; relíquia quase sempre sai elemental. Faz
 * a raridade significar duas coisas ao mesmo tempo — números maiores E uma
 * identidade tática —, e mantém o começo do jogo simples, sem o jogador ter que
 * entender o anel de vantagens no primeiro setor.
 */
function rollElement(rng: Rng, rarity: Rarity): ElementId {
  const chanceNeutro = [0.8, 0.62, 0.44, 0.26, 0.12][rarity] ?? 0.5;
  if (rng.chance(chanceNeutro)) return 'padrao';
  return rng.pick(ELEMENTS.filter((e) => e.id !== 'padrao')).id;
}

function rollAffix(rng: Rng, def: AffixDef, ilvl: number, power: number): Affix {
  const quality = rng.next();
  const raw = def.min + (def.max - def.min) * quality;
  // Afixos aditivos escalam com o nível de item; percentuais já são relativos.
  // Resistência é aditiva na forma mas fração no significado: escalada pelo
  // nível, +4% de resistência a fogo viraria +130% no setor 30 — imunidade.
  const escalavel = def.kind === 'add' && !def.element;
  const scaled = escalavel ? raw * (1 + ilvl * AFIXO_ESCALA_POR_ILVL) : raw;
  const value = def.id === 'proj_f' || def.id === 'perf_f' ? Math.round(raw) : scaled * power;
  return { id: def.id, stat: def.stat, kind: def.kind, value, quality };
}

/** Abre um baú e devolve os itens gerados (recursos são creditados pelo chamador). */
export function openChest(
  rng: Rng,
  tier: string,
  ilvl: number,
  luck: number,
  origin: number,
): Item[] {
  const def = CHEST_BY_ID.get(tier);
  if (!def) return [];

  const count = rng.int(def.items[0], def.items[1]);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    // O primeiro item honra o piso de raridade do baú; o resto é livre.
    items.push(rollItem(rng, ilvl + def.ilvlBonus, luck * def.luck, origin, i === 0 ? { floor: def.floor } : {}));
  }
  return items;
}

/**
 * Chance de um abate soltar item. Cresce com sorte mas satura: sem o teto, um
 * jogador com muita sorte veria a tela virar uma chuva de lixo comum.
 */
export function dropChance(kind: 'onda' | 'elite' | 'chefe', luck: number): number {
  // Mais generoso que num ARPG comum porque o drop agora é físico: a cápsula
  // pode escapar pela base da tela, então nem toda rolagem vira item.
  const base = DROP_BASE[kind];
  return clamp(base * (1 + luck * DROP_SORTE_PESO), 0, kind === 'chefe' ? 1 : DROP_TETO);
}

// ── Avaliação ───────────────────────────────────────────────────────────────

/**
 * Pontuação de um item: quanto o poder total sobe se ele for equipado.
 * É cara (resolve os atributos duas vezes) mas só roda em cliques da UI e no
 * auto-equipar, que acontece no máximo uma vez por drop.
 */
export function scoreItem(state: GameState, item: Item): number {
  const current = powerScore(resolveStats(state));
  const probe: GameState = { ...state, equipped: { ...state.equipped, [item.slot]: item } };
  return powerScore(resolveStats(probe)) - current;
}

/** Resumo textual de um afixo, já formatado. */
export function affixText(affix: Affix): string {
  const def = AFFIXES.find((a) => a.id === affix.id);
  const label = def?.label ?? affix.stat;
  if (affix.kind === 'mul') return `+${(affix.value * 100).toFixed(1)}% ${label}`;
  // Resistência é fração, como sorte e sincronia — mostrar "+0.1 resistência a
  // fogo" não diria nada.
  if (affix.id.startsWith('res_')) return `+${(affix.value * 100).toFixed(1)}% ${label}`;
  if (affix.stat === 'critChance' || affix.stat === 'sorte' || affix.stat === 'iaSkill') {
    return `+${(affix.value * 100).toFixed(1)}% ${label}`;
  }
  if (affix.stat === 'critDano') return `+${(affix.value * 100).toFixed(0)}% ${label}`;
  return `+${affix.value < 10 ? affix.value.toFixed(1) : Math.round(affix.value)} ${label}`;
}

export function itemName(item: Item): string {
  return BASE_BY_ID.get(item.baseId)?.name ?? 'Componente';
}

/** Nível de acabamento da base — decide o ícone e entra no nome exibido. */
export function itemTier(item: Item): number {
  return BASE_BY_ID.get(item.baseId)?.tier ?? 0;
}

/** Contribuição do item para os atributos, para o tooltip de comparação. */
export function itemStats(item: Item): Partial<Stats> {
  const out: Partial<Stats> = {};
  const base = BASE_BY_ID.get(item.baseId);
  if (base) out[base.implicit.stat] = (out[base.implicit.stat] ?? 0) + base.implicit.per * item.ilvl;
  for (const a of item.affixes) out[a.stat] = (out[a.stat] ?? 0) + a.value;
  return out;
}

/** Valor de desmanche em núcleos. */
export function salvageValue(item: Item): number {
  return Math.ceil((1 + item.ilvl * 0.6) * Math.pow(2.1, item.rarity));
}
