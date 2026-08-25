import { duration, fmt } from '@core/format';
import { BOSSES } from '@data/bosses';
import { ALL_ENEMIES, type EnemyDef } from '@data/enemies';
import { counterOf, ELEMENTS, getElement } from '@data/elements';
import { HULLS, type Hull } from '@data/hulls';
import {
  HULL_ARCHETYPES, HULL_TUNINGS, HULL_WEAPONS, SPACESHIPS2_HULL_SPEC_BY_ID,
} from '@data/hulls-spaceships2';
import { ITEM_BASES, SLOTS, type ItemBase } from '@data/items';
import { rarityInfo } from '@data/rarity';
import {
  FAMILIA_LABEL, FAMILIAS_ORDENADAS, RECURSOS, iconeDeRecurso, type RecursoDef,
} from '@data/recursos';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

type CodexTab = 'resumo' | 'bestiario' | 'cascos' | 'itens' | 'recursos' | 'elementos';

const TABS: readonly { id: CodexTab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' }, { id: 'bestiario', label: 'Bestiário' },
  { id: 'cascos', label: 'Cascos' }, { id: 'itens', label: 'Itens' },
  { id: 'recursos', label: 'Recursos' }, { id: 'elementos', label: 'Elementos' },
];

export class CodexPanel implements Panel {
  id = 'codex';
  title = 'Códex';
  icon = 'aba/codex';
  iconUrl = '/assets/ui/menu/codex.webp';
  overlay = true;
  private activeTab: CodexTab = 'resumo';

  render(sim: Sim): HTMLElement {
    const sections = new Map<CodexTab, HTMLElement>();
    const buttons = new Map<CodexTab, HTMLElement>();
    const activate = (id: CodexTab): void => {
      this.activeTab = id;
      for (const [key, section] of sections) section.hidden = key !== id;
      for (const [key, button] of buttons) button.classList.toggle('active', key === id);
    };
    const tabs = h('.codex-tabs', {}, ...TABS.map((tab) => {
      const button = h(`button.codex-tab${tab.id === this.activeTab ? '.active' : ''}`, {
        type: 'button', text: tab.label, onclick: () => activate(tab.id),
      });
      buttons.set(tab.id, button);
      return button;
    }));
    const content: [CodexTab, HTMLElement][] = [
      ['resumo', resumo(sim)], ['bestiario', bestiario(sim)], ['cascos', cascos(sim)],
      ['itens', itens(sim)], ['recursos', recursos()], ['elementos', elementos()],
    ];
    for (const [id, section] of content) {
      section.classList.add('codex-section');
      section.hidden = id !== this.activeTab;
      sections.set(id, section);
    }
    return h('.panel-body.codex', {},
      h('.codex-intro', {},
        h('.codex-intro-title', {}, spriteIcon('aba/codex', 46),
          h('span', {}, h('strong', { text: 'ARQUIVO DE CAMPANHA' }),
            h('small', { text: 'Inteligência, engenharia e registros de campo' }))),
        h('.codex-intro-counts', { text: `${BOSSES.length} chefes · ${ALL_ENEMIES.length} inimigos · ${HULLS.length} cascos · ${ITEM_BASES.length} bases · ${RECURSOS.length} recursos` })),
      tabs, ...content.map(([, section]) => section),
    );
  }
}

function resumo(sim: Sim): HTMLElement {
  const st = sim.state.stats;
  const inimigosVistos = ALL_ENEMIES.filter((enemy) => sim.alcanceLiberado >= enemy.sectors[0]).length;
  const basesVistas = new Set([
    ...sim.state.inventory.map((item) => item.baseId),
    ...Object.values(sim.state.equipped).flatMap((item) => item ? [item.baseId] : []),
  ]).size;
  const recursosPossuidos = RECURSOS.filter((resource) => (sim.state.armazem[resource.id] ?? 0) > 0).length;
  return h('section', {},
    h('h3.section', { text: 'Registro de campanha' }),
    h('.stat-grid', {},
      row('Tempo de jogo', duration(sim.state.playtime)), row('Abates', fmt(st.kills)),
      row('Chefes derrotados', fmt(st.bossKills)), row('Cascos perdidos', fmt(st.deaths)),
      row('Itens encontrados', fmt(st.itemsFound)), row('Baús abertos', fmt(st.chestsOpened)),
      row('Melhor setor', fmt(sim.alcanceLiberado)), row('Distância de patrulha', `${fmt(sim.state.bar.distance)} km`),
      row('Sucata acumulada', fmt(sim.state.lifetime.sucata)), row('Núcleos acumulados', fmt(sim.state.lifetime.nucleo))),
    h('h3.section', { text: 'Cobertura do arquivo' }),
    h('.codex-progress-grid', {},
      progress('Chefes identificados', sim.state.codex.length, BOSSES.length),
      progress('Inimigos alcançados', inimigosVistos, ALL_ENEMIES.length),
      progress('Cascos no Hangar', sim.frotaDisponivel.length, HULLS.length),
      progress('Bases encontradas', basesVistas, ITEM_BASES.length),
      progress('Recursos possuídos', recursosPossuidos, RECURSOS.length),
      progress('Elementos catalogados', ELEMENTS.length, ELEMENTS.length)),
  );
}

function bestiario(sim: Sim): HTMLElement {
  const groups: readonly [string, readonly EnemyDef[]][] = [
    ['Inimigos comuns', ALL_ENEMIES.filter((enemy) => !enemy.elite)],
    ['Elites', ALL_ENEMIES.filter((enemy) => enemy.elite)],
  ];
  const bosses = h('.codex-catalog-grid', {}, ...BOSSES.map((boss, index) => {
    const known = sim.state.codex.includes(boss.id);
    const element = getElement(boss.element);
    return h(`article.codex-entry${known ? '' : '.locked'}`, {},
      h('.codex-entry-art', {}, spriteIcon(boss.sprite, 52, known ? '' : 'silhouette')),
      h('.codex-entry-main', {},
        h('strong', { text: known ? boss.name : 'Comando hostil desconhecido' }),
        h('span.muted.tiny', { text: known ? boss.title : `Registro protegido · setor ${(index + 1) * 10}` }),
        known ? h('.codex-tags', {}, tag(element.name, element.color), tag(`${boss.phases.length} fases`), tag('Chefe', '#ff6d80')) : null),
    );
  }));
  return h('section', {}, h('h3.section', { text: `Chefes · ${BOSSES.length}` }), bosses,
    ...groups.flatMap(([title, enemies]) => [
    h('h3.section', { text: `${title} · ${enemies.length}` }),
    h('.codex-catalog-grid', {}, ...enemies.map((enemy) => {
      const known = sim.alcanceLiberado >= enemy.sectors[0];
      const element = getElement(enemy.element);
      const range = enemy.sectors[1] > 0 ? `${enemy.sectors[0]}–${enemy.sectors[1]}` : `${enemy.sectors[0]}+`;
      return h(`article.codex-entry${known ? '' : '.locked'}`, {},
        h('.codex-entry-art', {}, spriteIcon(enemy.sprite, 52, known ? '' : 'silhouette')),
        h('.codex-entry-main', {},
          h('strong', { text: known ? enemy.name : 'Sinal desconhecido' }),
          h('span.muted.tiny', { text: known ? `${MOVE_LABEL[enemy.move]} · ${ATTACK_LABEL[enemy.attack]}` : `Detectável no setor ${enemy.sectors[0]}` }),
          known ? h('.codex-tags', {}, tag(element.name, element.color), tag(`Setores ${range}`),
            tag(enemy.elite ? 'Elite' : 'Comum', enemy.elite ? '#ffb45c' : '#6cbde8')) : null),
      );
    })),
    ]));
}

function cascos(sim: Sim): HTMLElement {
  return h('section', {},
    h('h3.section', { text: `Cascos · ${HULLS.length}` }),
    h('p.muted.hint', { text: 'Ficha-base sem equipamentos. Os 29 cascos Spaceships 2.0 estão liberados na campanha; o desbloqueio autoral será adicionado depois.' }),
    h('.codex-catalog-grid.codex-hulls', {}, ...HULLS.map((hull) => hullEntry(sim, hull))),
  );
}

function hullEntry(sim: Sim, hull: Hull): HTMLElement {
  const known = sim.frotaDisponivel.includes(hull.id) || sim.alcanceLiberado >= hull.requiresSector;
  const element = getElement(hull.element);
  const spec = SPACESHIPS2_HULL_SPEC_BY_ID.get(hull.id);
  const archetype = spec ? HULL_ARCHETYPES.find((entry) => entry.id === spec.archetype)?.name : 'Linha original';
  const tuning = spec ? HULL_TUNINGS.find((entry) => entry.id === spec.tuning)?.name : 'Histórico';
  const weapon = spec ? HULL_WEAPONS.find((entry) => entry.id === spec.weapon)?.name : 'Configuração própria';
  return h(`article.codex-entry${known ? '' : '.locked'}`, {},
    h('.codex-entry-art', {}, spriteIcon(hull.sprite, 58, known ? '' : 'silhouette')),
    h('.codex-entry-main', {},
      h('strong', { text: known ? hull.name : 'Casco não identificado' }),
      h('span.muted.tiny', { text: known ? `${archetype} · ${tuning}` : `Registro do setor ${hull.requiresSector}` }),
      known ? h('.codex-tags', {}, tag(element.name, element.color), tag(weapon ?? 'Arma própria'), tag(`T${hull.tier}`)) : null,
      known ? h('span.codex-numbers', { text: `Dano ${num(hull.stats.dano)} · ${num(hull.stats.cadencia)}/s · ${num(hull.stats.projeteis)} proj. · Vida ${num(hull.stats.vida)} · Escudo ${num(hull.stats.escudo)}` }) : null),
  );
}

function itens(sim: Sim): HTMLElement {
  const found = new Set([
    ...sim.state.inventory.map((item) => item.baseId),
    ...Object.values(sim.state.equipped).flatMap((item) => item ? [item.baseId] : []),
  ]);
  return h('section', {},
    h('h3.section', { text: `Bases de item · ${ITEM_BASES.length}` }),
    h('p.muted.hint', { text: 'Cada categoria possui oito tiers visuais. O nível mínimo indica quando a base entra no gerador de loot.' }),
    h('.codex-item-groups', {}, ...SLOTS.map((slot) => {
      const bases = ITEM_BASES.filter((base) => base.slot === slot.id);
      return h('article.codex-item-group', {},
        h('.codex-item-head', {}, spriteIcon(slot.icon, 38), h('div', {}, h('strong', { text: slot.name }), h('span.muted.tiny', { text: slot.hint }))),
        h('.codex-item-list', {}, ...bases.map((base) => itemBase(base, found.has(base.id)))));
    })),
  );
}

function itemBase(base: ItemBase, found: boolean): HTMLElement {
  return h(`.codex-item-base${found ? '.found' : ''}`, {}, spriteIcon(base.icon, 28),
    h('span', {}, h('strong', { text: base.name }), h('small', { text: `T${base.tier + 1} · ilvl ${base.minIlvl}+ · ${STAT_LABEL[base.implicit.stat] ?? base.implicit.stat}` })),
    found ? h('b', { text: 'VISTO' }) : null);
}

function recursos(): HTMLElement {
  return h('section', {}, ...FAMILIAS_ORDENADAS.flatMap((family) => {
    const entries = RECURSOS.filter((resource) => resource.familia === family);
    return [h('h3.section', { text: `${FAMILIA_LABEL[family]} · ${entries.length}` }),
      h('.codex-resource-grid', {}, ...entries.map(resourceEntry))];
  }));
}

function resourceEntry(resource: RecursoDef): HTMLElement {
  const rarity = rarityInfo(resource.raridade);
  return h('article.codex-resource', { style: `--codex-accent:${rarity.color}` },
    h('.codex-resource-art', {}, spriteIcon(iconeDeRecurso(resource), 46)),
    h('.codex-resource-main', {}, h('strong', { text: resource.nome }),
      h('.codex-tags', {}, tag(rarity.name, rarity.color), tag(resource.dropEstado === 'ativo' ? 'Drop ativo' : 'Drop planejado'), tag(resource.usoEstado === 'ativo' ? 'Uso ativo' : 'Uso planejado')),
      h('span.tiny', { text: resource.funcao }), h('small.muted', { text: resource.drop })));
}

function elementos(): HTMLElement {
  return h('section', {},
    h('h3.section', { text: 'Relações elementais' }),
    h('p.muted.hint', { text: 'Fogo → Gelo → Cósmico → Raio → Químico → Fogo. Padrão permanece neutro.' }),
    h('.codex-element-grid', {}, ...ELEMENTS.map((element) => {
      const target = element.bate ? getElement(element.bate) : null;
      const counter = counterOf(element.id);
      const counterInfo = counter ? getElement(counter) : null;
      return h('article.codex-element', { style: `--codex-accent:${element.color}` },
        h('.codex-element-icon', {}, spriteIcon(element.bullet[1], 54), h('b', { text: element.sigla })),
        h('strong', { text: element.name }), h('p.tiny', { text: element.blurb }),
        h('.codex-element-relations', {},
          h('span', { text: target ? `Vantagem contra ${target.name}` : 'Sem vantagem elemental' }),
          h('span', { text: counterInfo ? `Resistido por ${counterInfo.name}` : 'Nunca é resistido' })));
    })),
  );
}

const MOVE_LABEL: Record<string, string> = {
  mergulho: 'Mergulha', senoide: 'Zigue-zague', pairar: 'Paira e estrafeia',
  deriva: 'À deriva', investida: 'Investe', orbita: 'Orbita',
};
const ATTACK_LABEL: Record<string, string> = {
  nenhum: 'não atira', direto: 'tiro reto', mirado: 'tiro mirado', leque: 'leque',
  espiral: 'espiral', teleguiado: 'teleguiado', explosivo: 'detona por proximidade',
};
const STAT_LABEL: Record<string, string> = {
  dano: 'dano', cadencia: 'cadência', velocidade: 'velocidade', vida: 'vida',
  escudo: 'escudo', critChance: 'crítico', sorte: 'sorte',
};

function row(label: string, value: string): HTMLElement {
  return h('.stat', {}, h('span.muted', { text: label }), h('strong', { text: value }));
}
function progress(label: string, value: number, total: number): HTMLElement {
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  return h('.codex-progress', {}, h('span', {}, h('strong', { text: label }), h('b', { text: `${value}/${total}` })),
    h('.codex-progress-track', {}, h('.codex-progress-fill', { style: { width: `${ratio * 100}%` } })));
}
function tag(text: string, color?: string): HTMLElement {
  return h('span.codex-tag', { text, style: color ? { color, borderColor: color } : undefined });
}
function num(value: number | undefined): string { return fmt(value ?? 0, 1); }
