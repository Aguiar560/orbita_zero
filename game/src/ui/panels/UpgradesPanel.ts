import { fmt } from '@core/format';
import { UPGRADES, UPGRADE_CATEGORIES, upgradeBulkCost, type UpgradeCategory, type UpgradeDef } from '@data/upgrades';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import type { Panel } from './types';

const RESOURCE_LABEL = { sucata: 'sucata', nucleo: 'núcleos', cristal: 'cristais', eter: 'éter' } as const;
const RESOURCE_COLOR = { sucata: '#ffd98a', nucleo: '#7fe4ff', cristal: '#c07dff', eter: '#ff5d7a' } as const;

export class UpgradesPanel implements Panel {
  id = 'melhorias';
  title = 'Melhorias';
  icon = 'aba/melhorias';

  private bulk: 1 | 10 | 100 | -1 = 1;
  private category: UpgradeCategory = 'armamento';

  badge(sim: Sim): number {
    return UPGRADES.filter((u) => this.visible(sim, u) && sim.affordableLevels(u.id, 1) > 0).length;
  }

  render(sim: Sim): HTMLElement {
    const list = UPGRADES.filter((u) => u.category === this.category && this.visible(sim, u));

    return h('.panel-body', {},
      h('.tabs-inline', {}, ...UPGRADE_CATEGORIES.map((c) =>
        h(`button.chip${this.category === c.id ? '.active' : ''}`, {
          text: c.name,
          onclick: () => { this.category = c.id; sim.touch(); },
        }),
      )),
      h('p.muted.hint', { text: UPGRADE_CATEGORIES.find((c) => c.id === this.category)?.hint ?? '' }),

      h('.toolbar', {},
        h('.filters', {}, ...([1, 10, 100, -1] as const).map((n) =>
          h(`button.chip${this.bulk === n ? '.active' : ''}`, {
            text: n === -1 ? 'MÁX' : `×${n}`,
            onclick: () => { this.bulk = n; sim.touch(); },
          }),
        )),
      ),

      h('.upgrade-list', {}, ...list.map((def) => this.card(sim, def))),

      list.length === 0
        ? h('.empty-state', { text: 'Nada liberado nesta categoria ainda. Avance nos setores.' })
        : null,
    );
  }

  private visible(sim: Sim, def: UpgradeDef): boolean {
    return sim.state.universe.bestSectorEver >= (def.requiresSector ?? 0);
  }

  private card(sim: Sim, def: UpgradeDef): HTMLElement {
    const level = sim.upgradeLevel(def.id);
    const maxed = level >= def.maxLevel;
    const count = maxed ? 0 : this.bulk === -1 ? Math.max(1, sim.affordableLevels(def.id, 1000)) : Math.min(this.bulk, def.maxLevel - level);
    const cost = maxed ? 0 : upgradeBulkCost(def, level, count);
    const affordable = !maxed && sim.can(def.currency, cost) && count > 0;
    const color = RESOURCE_COLOR[def.currency];

    const total = def.kind === 'mul'
      ? `+${(def.per * level * 100).toFixed(0)}%`
      : `+${fmt(def.per * level, 2)}`;

    return h(`.upgrade${affordable ? '.ready' : ''}`, {},
      spriteIcon(def.icon, 34),
      h('.upgrade-main', {},
        h('.upgrade-title', {},
          h('strong', { text: def.name }),
          h('span.level', { text: maxed ? 'MÁX' : `nv ${level}` }),
        ),
        h('span.muted', { text: def.desc }),
        h('.upgrade-progress', {},
          progressBar(level / def.maxLevel, color, 3),
          h('span.muted.tiny', { text: `acumulado ${total}` }),
        ),
      ),
      maxed
        ? h('.upgrade-buy.maxed', { text: 'MÁX' })
        : h('button.upgrade-buy', {
            disabled: !affordable,
            onclick: () => { sim.buyUpgrade(def.id, count); },
          },
            h('span.buy-count', { text: `×${count}` }),
            h('span.buy-cost', { text: `${fmt(cost)} ${RESOURCE_LABEL[def.currency]}`, style: { color } }),
          ),
    );
  }
}
