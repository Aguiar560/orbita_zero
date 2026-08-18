import { fmt } from '@core/format';
import { AFFIX_BY_ID, SET_BY_ID, SLOT_LABEL, tipoDoAfixo, type TipoDeAfixo } from '@data/items';
import { rarityInfo } from '@data/rarity';
import { TIERS } from '@data/balance/tiers';
import { affixText, itemName, itemStats, salvageValue } from '@sim/loot';
import { setCounts } from '@sim/stats';
import { ELEMENTOS_RESISTIVEIS, ELEMENTS, getElement } from '@data/elements';
import { DANO_STAT, RES_STAT, STAT_IDS, type Affix, type Item, type StatId, type Stats } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from './dom';

/** Atributos mostrados na comparação, na ordem em que importam. */
const COMPARE_ORDER: StatId[] = [
  'dano', 'cadencia', 'projeteis', 'perfuracao', 'critChance', 'critDano', 'explosao',
  'vida', 'escudo', 'regen', 'velocidade', 'iaSkill', 'sorte', 'sucataGanho', 'nucleoGanho', 'xpGanho',
  ...ELEMENTS.map((e) => DANO_STAT[e.id]),
  ...ELEMENTOS_RESISTIVEIS.map((e) => RES_STAT[e.id]),
];

const STAT_LABEL: Record<StatId, string> = {
  // Rótulos elementais nascem da tabela de elementos, para não duplicar nomes.
  // Vêm primeiro para as entradas escritas à mão abaixo terem a última palavra.
  ...(Object.fromEntries([
    ...ELEMENTS.map((e) => [DANO_STAT[e.id], `Dano ${e.name.toLowerCase()}`]),
    ...ELEMENTOS_RESISTIVEIS.map((e) => [RES_STAT[e.id], `Res. ${e.name.toLowerCase()}`]),
  ]) as Record<StatId, string>),
  dano: 'Dano', cadencia: 'Cadência', projeteis: 'Projéteis', perfuracao: 'Perfuração',
  critChance: 'Crítico', critDano: 'Dano crít.', explosao: 'Explosão', vida: 'Casco',
  escudo: 'Escudo', regen: 'Regeneração', velocidade: 'Manobra', iaSkill: 'Sincronia',
  sorte: 'Sorte', sucataGanho: 'Sucata', nucleoGanho: 'Núcleos', xpGanho: 'XP',
};

/** Atributos cujo valor bruto é uma fração e deve sair como porcentagem. */
const AS_PERCENT = new Set<StatId>([
  'critChance', 'critDano', 'sorte', 'iaSkill', 'sucataGanho', 'nucleoGanho', 'xpGanho',
  ...ELEMENTS.map((e) => DANO_STAT[e.id]),
  ...ELEMENTOS_RESISTIVEIS.map((e) => RES_STAT[e.id]),
]);

function showStat(stat: StatId, value: number): string {
  if (AS_PERCENT.has(stat)) return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  return `${value >= 0 ? '+' : ''}${Math.abs(value) < 10 ? value.toFixed(1) : fmt(value, 0)}`;
}

/**
 * Cartão de item, compartilhado pelo cockpit e pelo inventário.
 *
 * Quando existe uma peça equipada no mesmo slot, o cartão vira uma COMPARAÇÃO:
 * cada atributo mostra a diferença entre o item olhado e o que está na nave.
 * Sem isso o jogador precisava decorar números de um painel para o outro, que é
 * exatamente o trabalho que um ARPG deve poupar.
 */
export function buildItemCard(sim: Sim, item: Item, opts: { compare?: boolean } = {}): DocumentFragment {
  const frag = document.createDocumentFragment();
  const info = rarityInfo(item.rarity);
  const set = item.set ? SET_BY_ID.get(item.set) : undefined;
  const worn = set ? (setCounts(sim.state).get(set.id) ?? 0) : 0;
  const equipped = sim.state.equipped[item.slot];
  const comparing = opts.compare !== false && !!equipped && equipped.uid !== item.uid;

  frag.append(
    h('.tip-head', {},
      spriteIcon(item.icon, 34),
      h('.tip-title', {},
        h('strong', { text: itemName(item), style: { color: info.color } }),
        h('span.muted.tiny', { text: `${SLOT_LABEL[item.slot]} · ${info.name} · nv ${item.ilvl}` }),
      ),
    ),
  );

  // Elemento só aparece quando NÃO é neutro: uma linha "Padrão" em quase todo
  // item viraria ruído e treinaria o jogador a ignorar a faixa inteira.
  if (item.element && item.element !== 'padrao') {
    const el = getElement(item.element);
    frag.append(
      h('.tip-element', { style: { color: el.color, borderColor: el.color } },
        h('span.elem-sigla', { text: el.sigla, style: { background: el.color } }),
        h('span.tiny', { text: elementRole(item, el.name) }),
      ),
    );
  }

  if (set) {
    frag.append(h('span.set-line', { style: { color: set.color } }, `Conjunto ${set.name} (${worn}/${set.slots.length})`));
  }

  // O tier vai numa etiqueta própria, e não embutido no texto, porque é o que o
  // jogador compara entre duas peças do mesmo nome — precisa ser varrível numa
  // coluna, não caçado no meio da frase.
  const linha = (a: Affix) => h('span.affix', {},
    ...(a.tier ? [h(`span.affix-tier${a.tier >= TIERS ? '.maximo' : ''}`, {
      text: `T${a.tier}`,
      title: a.tier >= TIERS ? 'Tier máximo' : `Tier ${a.tier} de ${TIERS}`,
    })] : []),
    h('span', { text: affixText(a) }),
  );

  // Prefixos e sufixos são grupos SEPARADOS na ficha, e a ordem do array não
  // serve: o sorteio preenche primeiro os pisos das duas naturezas e só depois
  // o resto, então as linhas chegam intercaladas. Quem compara duas peças lê a
  // metade ofensiva contra a metade ofensiva — misturar obriga a reordenar de
  // cabeça a cada leitura.
  //
  // O rótulo do grupo só aparece quando existem os DOIS; numa peça de raridade
  // baixa, com uma linha só, "Prefixos" sozinho é ruído puro.
  const porTipo = (t: TipoDeAfixo) =>
    item.affixes.filter((a) => {
      const def = AFFIX_BY_ID.get(a.id);
      return def ? tipoDoAfixo(def) === t : t === 'prefixo';
    });
  const prefixos = porTipo('prefixo');
  const sufixos = porTipo('sufixo');

  if (prefixos.length && sufixos.length) {
    frag.append(
      h('.tip-affixes.tip-grupo', {},
        h('span.affix-grupo', { text: 'Prefixos' }),
        ...prefixos.map(linha),
        h('span.affix-grupo', { text: 'Sufixos' }),
        ...sufixos.map(linha),
      ),
    );
  } else {
    frag.append(h('.tip-affixes', {}, ...item.affixes.map(linha)));
  }

  if (comparing && equipped) {
    frag.append(
      h('.tip-vs', {},
        h('span.muted.tiny', { text: 'contra o equipado' }),
        h('span.tiny', { text: itemName(equipped), style: { color: rarityInfo(equipped.rarity).color } }),
      ),
      buildDeltas(item, equipped),
    );
  }

  frag.append(
    h('.tip-foot', {},
      h('span.muted.tiny', { text: `desmancha por ${fmt(salvageValue(item))}` }),
    ),
  );
  return frag;
}

/**
 * O que o elemento da peça faz, que depende do slot.
 *
 * Na arma principal ele muda o tipo do tiro; no escudo, o que a nave resiste;
 * nas demais peças é só a afinidade que liberou os afixos elementais. Dizer
 * "Fogo" e nada mais deixaria o jogador adivinhando por que a mesma palavra
 * importa muito num item e nada noutro.
 */
function elementRole(item: Item, nome: string): string {
  if (item.slot === 'principal') return `${nome} — define o tipo do seu tiro`;
  if (item.slot === 'escudo') return `${nome} — define o confronto da defesa`;
  return `Afinidade ${nome.toLowerCase()}`;
}

/** Linha a linha, a diferença de cada atributo entre o candidato e o equipado. */
function buildDeltas(candidate: Item, equipped: Item): HTMLElement {
  const a = itemStats(candidate) as Partial<Stats>;
  const b = itemStats(equipped) as Partial<Stats>;

  const rows = COMPARE_ORDER.filter((stat) => (a[stat] ?? 0) !== (b[stat] ?? 0)).map((stat) => {
    const delta = (a[stat] ?? 0) - (b[stat] ?? 0);
    return h('.tip-delta', {},
      h('span.muted.tiny', { text: STAT_LABEL[stat] }),
      h('strong.tiny', {
        text: showStat(stat, delta),
        style: { color: delta > 0 ? '#7ed957' : '#ff8a9a' },
      }),
    );
  });

  if (rows.length === 0) return h('span.muted.tiny', { text: 'Mesmos atributos.' });
  return h('.tip-deltas', {}, ...rows);
}

/** Igual ao cartão, mas sem comparação — para o item que já está equipado. */
export function buildEquippedCard(sim: Sim, item: Item): DocumentFragment {
  return buildItemCard(sim, item, { compare: false });
}

export { STAT_IDS };
