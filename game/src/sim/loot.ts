import { Rng, clamp } from '@core/math';
import {
  AFFIXES,
  BASE_BY_ID,
  ITEM_SETS,
  basesForIlvl,
  iconeDeItem,
  pisoDeAfixos,
  pesoNoSlot,
  tipoDoAfixo,
  type AffixDef,
} from '@data/items';
import { RARITIES, rarityInfo } from '@data/rarity';
import { CHEST_BY_ID, type ChestDef } from '@data/chests';
import { ELEMENTS } from '@data/elements';
import { fatorDoTier, tiersDisponiveis } from '@data/balance/tiers';
import {
  AFIXO_ESCALA_POR_ILVL, ATRIBUTOS_FRACIONARIOS, DROP_BASE, DROP_SORTE_PESO, DROP_TETO,
} from '@data/balance/curvas';
import type { Affix, ElementId, GameState, Item, Rarity, SlotId, Stats } from './types';
import { comEquipamento, resolveStats, powerScore } from './stats';

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
  // O expoente vem da tabela, não do índice da raridade. Amarrado ao índice, a
  // passagem de cinco para sete raridades multiplicou por 64 o efeito da sorte
  // no topo e um baú de Singularidade passou a soltar Divino um a cada seis.
  const pick = rng.weighted(
    RARITIES,
    (r) => (r.id < floor ? 0 : r.weight * Math.pow(boost, r.sorteExpo)),
  );
  return Math.max(floor, pick.id) as Rarity;
}

/**
 * Raridade de baú vem da tabela do próprio baú — Sorte vale somente para o
 * drop de combate. Separar os dois caminhos impede que uma cápsula premium
 * multiplique a Sorte e transforme o topo da escada em resultado rotineiro.
 */
export function rollChestRarity(rng: Rng, chest: ChestDef): Rarity {
  return rng.weighted(RARITIES, (r) => chest.raridades[r.id] ?? 0).id;
}

/** Gera um item completo. */
export function rollItem(
  rng: Rng,
  ilvl: number,
  luck: number,
  origin: number,
  opts: {
    slot?: SlotId;
    floor?: Rarity;
    /**
     * Raridade EXATA, sem sorteio.
     *
     * Diferente de `floor`, que é piso e deixa o item subir sozinho. A fusão
     * precisa disto: ela já sorteou a raridade pela tabela da receita, e passar
     * esse resultado como piso deixava a natureza sortear de novo por cima. O
     * Divino anunciado a 3% saía a 10,4% — 3,47× — porque a consolação Mítica
     * rolava para cima por conta própria.
     */
    exata?: Rarity;
    /** Viés de slot vindo da tabela de drop (§10). Multiplica o peso da base. */
    slotFavorecido?: Partial<Record<SlotId, number>>;
    /** Viés de elemento. Multiplica o peso na hora de sortear o elemento. */
    elementoFavorecido?: Partial<Record<ElementId, number>>;
  } = {},
): Item {
  // Bases são filtradas pelas três faixas mais altas disponíveis no nível: é o
  // que faz o inventário mudar de cara conforme o jogador avança, em vez de
  // continuar caindo o mesmo cano enferrujado no setor 60.
  const candidates = basesForIlvl(ilvl, opts.slot);
  // O viés de slot vem do ALVO que morreu (§10): um encouraçado solta blindagem
  // com mais frequência. É multiplicativo sobre o peso da base, não exclusivo —
  // matar encouraçado nunca deixa de poder soltar arma.
  const base = rng.weighted(
    candidates,
    (b) => (1 + b.tier) * (opts.slotFavorecido?.[b.slot] ?? 1),
  );
  const rarity = opts.exata ?? rollRarity(rng, luck, opts.floor ?? 0);
  const info = rarityInfo(rarity);
  const element = rollElement(rng, rarity, opts.elementoFavorecido);

  // Um item só rola afixos DO SEU elemento: "canhão de fogo com +18% de dano de
  // gelo" seria uma linha morta na ficha, já que a arma dispara fogo.
  const eligible = AFFIXES.filter(
    (a) => (!a.slots || a.slots.includes(base.slot))
      && ilvl >= (a.minIlvl ?? 0)
      // Raridade mínima (§8): o freio que peso baixo sozinho não dá. Sem ele o
      // jogador do fim do jogo veria `+3 projéteis` só por rolar muito.
      && rarity >= (a.raridadeMin ?? 0)
      && (!a.element || a.element === element),
  );

  const affixes: Affix[] = [];
  const used = new Set<string>();
  // Grupos de exclusão mútua já representados neste item (§8). Sem isto um
  // Divino podia rolar `+1`, `+2` e `+3` projéteis na mesma peça e entregar seis
  // numa linha só — a "multiplicação quebrada" que o §8 manda evitar. Medido
  // antes da correção: 23 peças em 89 mil com mais de um degrau. Empilhar entre
  // PEÇAS continua valendo; o que o grupo impede é o acúmulo dentro de uma.
  const grupos = new Set<string>();

  // Sorteia até `quantos` afixos de um POOL, respeitando o que já saiu.
  // Devolve quantos faltaram — é o que permite a sobra escorrer para o outro
  // lado em vez de encolher o item.
  //
  // O peso é o do afixo NAQUELE slot, não o global. É o que dá identidade às
  // nove categorias: sem isso, medido, uma blindagem tinha 41,8% de linhas
  // defensivas e um suporte 18% de utilidade — nove peças que eram a mesma
  // peça com nomes diferentes.
  const sortear = (pool: readonly AffixDef[], quantos: number): number => {
    let feitos = 0;
    for (; feitos < quantos; feitos++) {
      const disponiveis = pool.filter(
        (a) => !used.has(a.id) && !(a.grupo && grupos.has(a.grupo)),
      );
      if (!disponiveis.length) break;
      const def = rng.weighted(disponiveis, (a) => pesoNoSlot(a, base.slot));
      if (!def) break;
      used.add(def.id);
      if (def.grupo) grupos.add(def.grupo);
      affixes.push(rollAffix(rng, def, ilvl, info.tierMax));
    }
    return quantos - feitos;
  };

  // Dois orçamentos que não se emprestam por vontade do sorteio — só por falta
  // de opção. Sem a divisão, um Divino podia sair com sete linhas ofensivas e
  // zero defensivas, e a peça "certa" de cada slot seria sempre a mesma.
  //
  // A sobra escorre porque o pool pode acabar antes do orçamento: um slot com
  // poucos sufixos elegíveis entregaria um Divino de quatro linhas, punindo a
  // raridade mais rara do jogo por um acidente de tabela. Prefixos primeiro
  // também fixa a ORDEM na ficha, sem o cartão precisar reordenar nada.
  const prefixos = eligible.filter((a) => tipoDoAfixo(a) === 'prefixo');
  const sufixos = eligible.filter((a) => tipoDoAfixo(a) === 'sufixo');
  const piso = pisoDeAfixos(base.slot, info.afixos);
  sortear(prefixos, piso.prefixos);
  sortear(sufixos, piso.sufixos);
  // O resto vem do bolo inteiro, pelo peso do slot — é aqui que a `AFINIDADE`
  // continua desenhando a identidade da peça. A sobra dos pisos entra junto:
  // se um slot não tinha sufixo elegível, o item não pode encolher por isso.
  sortear(eligible, info.afixos - affixes.length);

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
    icon: iconeDeItem(base.slot, rarity, base.tier),
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
function rollElement(
  rng: Rng,
  rarity: Rarity,
  favorecido?: Partial<Record<ElementId, number>>,
): ElementId {
  // Sete raridades, mas a tabela tinha cinco entradas: Mítico e Divino caíam no
  // `?? 0.5`, MAIS neutros que o Lendário (0,12). A raridade máxima era a menos
  // elemental do jogo, o oposto do pretendido.
  const chanceNeutro = [0.8, 0.62, 0.44, 0.26, 0.12, 0.07, 0.03][rarity] ?? 0.03;
  if (rng.chance(chanceNeutro)) return 'padrao';

  const elementais = ELEMENTS.filter((e) => e.id !== 'padrao');
  return rng.weighted(elementais, (e) => favorecido?.[e.id] ?? 1).id;
}

function rollAffix(rng: Rng, def: AffixDef, ilvl: number, tierMax: number): Affix {
  // O tier decide a magnitude; a qualidade só posiciona dentro dele. Antes a
  // magnitude vinha da qualidade multiplicada pelo `power` da raridade, e nada
  // disso era legível na ficha — ver `data/balance/tiers.ts`.
  const opcoes = tiersDisponiveis(ilvl, tierMax);
  const tier = rng.weighted(opcoes, (o) => o.peso).tier;

  return rollAffixAtTier(rng, def, ilvl, tier);
}

/** Materializa uma linha mantendo o tier fixo — usado pela recalibração. */
export function rollAffixAtTier(
  rng: Rng,
  def: AffixDef,
  ilvl: number,
  tier: number,
  qualidadeMinima = 0,
): Affix {

  const quality = qualidadeMinima + rng.next() * (1 - qualidadeMinima);
  const raw = def.min + (def.max - def.min) * quality;
  // Só valor BRUTO escala com o nível de item. Fração — crítico, sorte,
  // sincronia, resistência — não: escalada por ilvl 200, uma linha de +4,5% de
  // crítico viraria +990%.
  const escalavel = def.kind === 'add'
    && !def.element
    && !ATRIBUTOS_FRACIONARIOS.has(def.stat);
  const scaled = escalavel ? raw * (1 + ilvl * AFIXO_ESCALA_POR_ILVL) : raw;
  // Projéteis e perfuração são CONTAGEM: escalar por tier daria "+3,7 projéteis".
  // O tier já se expressa neles por outra via — o teto de raridade que os libera.
  // Por ATRIBUTO e não por id: a checagem era `def.id === 'proj_f'` e quebrou
  // em silêncio quando o §8 dividiu os projéteis em três degraus. O que faz
  // um afixo ser contagem é o atributo ser inteiro, não como ele se chama.
  const contagem = def.stat === 'projeteis' || def.stat === 'perfuracao';
  // `calibre` iguala o VALOR das linhas entre afixos (§7). Não se aplica à
  // contagem: "+1,4 projéteis" não existe, e o valor desses dois já é gerido
  // pelo peso baixo e pelo nível mínimo.
  const value = contagem ? Math.round(raw) : scaled * fatorDoTier(tier) * (def.calibre ?? 1);
  return { id: def.id, stat: def.stat, kind: def.kind, value, quality, tier };
}

/**
 * Troca uma linha por outra compatível, sem alterar raridade, ilvl ou tier.
 *
 * Preservar o tipo (prefixo/sufixo) mantém o orçamento estrutural do item. A
 * lista respeita slot, elemento, raridade mínima e grupos de exclusão, como o
 * gerador original — a loja não pode fabricar uma combinação que nunca cairia
 * naturalmente.
 */
export function recalibrationCandidates(item: Item, index: number): readonly AffixDef[] {
  const current = item.affixes[index];
  if (!current) return [];
  const currentDef = AFFIXES.find((a) => a.id === current.id);
  if (!currentDef) return [];

  const tipo = tipoDoAfixo(currentDef);
  const outros = item.affixes.filter((_, i) => i !== index);
  const usados = new Set(outros.map((a) => a.id));
  // Repetir a mesma identidade pareceria que o serviço não fez nada, mesmo se
  // a qualidade mudasse. Ela também fica fora deste sorteio.
  usados.add(current.id);
  const grupos = new Set(
    outros
      .map((a) => AFFIXES.find((d) => d.id === a.id)?.grupo)
      .filter((g): g is string => !!g),
  );
  const elemento = item.element ?? 'padrao';
  return AFFIXES.filter((a) =>
    (!a.slots || a.slots.includes(item.slot))
    && item.ilvl >= (a.minIlvl ?? 0)
    && item.rarity >= (a.raridadeMin ?? 0)
    && (!a.element || a.element === elemento)
    && tipoDoAfixo(a) === tipo
    && !usados.has(a.id)
    && !(a.grupo && grupos.has(a.grupo)),
  );
}

export function recalibrateAffix(rng: Rng, item: Item, index: number): Affix | null {
  const current = item.affixes[index];
  if (!current || current.locked) return null;
  const candidatos = recalibrationCandidates(item, index);
  if (!candidatos.length) return null;

  const def = rng.weighted(candidatos, (a) => pesoNoSlot(a, item.slot));
  const tier = Math.max(1, Math.min(10, current.tier ?? 1));
  return rollAffixAtTier(rng, def, item.ilvl, tier);
}

/** Pool legal para adicionar ou converter uma linha. */
export function affixCandidates(
  item: Item,
  tipo: 'prefixo' | 'sufixo',
  ignoreIndex: number | null = null,
): readonly AffixDef[] {
  const outros = item.affixes.filter((_, i) => i !== ignoreIndex);
  const usados = new Set(outros.map((a) => a.id));
  const grupos = new Set(outros
    .map((a) => AFFIXES.find((d) => d.id === a.id)?.grupo)
    .filter((g): g is string => !!g));
  const elemento = item.element ?? 'padrao';
  return AFFIXES.filter((a) =>
    (!a.slots || a.slots.includes(item.slot))
    && item.ilvl >= (a.minIlvl ?? 0)
    && item.rarity >= (a.raridadeMin ?? 0)
    && (!a.element || a.element === elemento)
    && tipoDoAfixo(a) === tipo
    && !usados.has(a.id)
    && !(a.grupo && grupos.has(a.grupo)),
  );
}

/** Abre um baú e devolve os itens gerados (recursos são creditados pelo chamador). */
export function openChest(
  rng: Rng,
  tier: string,
  ilvl: number,
  origin: number,
): Item[] {
  const def = CHEST_BY_ID.get(tier);
  if (!def) return [];

  const count = rng.int(def.items[0], def.items[1]);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollChestRarity(rng, def);
    items.push(rollItem(rng, ilvl + def.ilvlBonus, 0, origin, { exata: rarity }));
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
  const probe: GameState = comEquipamento(state, item.slot, item);
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
