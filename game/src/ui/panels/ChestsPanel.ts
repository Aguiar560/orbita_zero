import { fmt } from '@core/format';
import { CHESTS, PATROL_CACHE_KILLS } from '@data/chests';
import { rarityInfo } from '@data/rarity';
import { itemName } from '@sim/loot';
import type { Item } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import type { Panel } from './types';

export class ChestsPanel implements Panel {
  id = 'baus';
  title = 'Baús';
  icon = 'aba/baus';

  private lastOpen: { tier: string; items: Item[] } | null = null;

  badge(sim: Sim): number {
    return Object.values(sim.state.chests).reduce((s, n) => s + n, 0);
  }

  render(sim: Sim): HTMLElement {
    const bar = sim.state.bar;

    return h('.panel-body', {},
      h('.cache-strip', {},
        h('.cache-text', {},
          h('strong', { text: 'Cápsula de patrulha' }),
          h('span.muted', { text: `${Math.floor(bar.cacheProgress * PATROL_CACHE_KILLS)} / ${PATROL_CACHE_KILLS} abates na faixa` }),
        ),
        progressBar(bar.cacheProgress, '#ffb638', 6),
      ),

      h('.chest-grid', {}, ...CHESTS.map((def) => {
        const stock = sim.state.chests[def.id] ?? 0;
        return h(`.chest-card${stock > 0 ? '.has' : ''}`, { style: { borderColor: def.color } },
          h('.chest-art', {}, spriteIcon(def.icon, 46)),
          h('strong', { text: def.name, style: { color: def.color } }),
          h('span.muted.tiny', { text: `${def.items[0]}–${def.items[1]} itens · nível +${def.ilvlBonus} · piso ${rarityInfo(def.floor).name}` }),
          h('.chest-stock', { text: `${stock} em estoque` }),
          h('.chest-actions', {},
            h('button.btn', {
              disabled: stock <= 0,
              onclick: () => {
                const items = sim.openChestFromStock(def.id);
                if (items) this.lastOpen = { tier: def.id, items };
                sim.touch();
              },
            }, h('span', { text: 'Abrir' })),
            def.buy > 0
              ? h('button.btn.buy', {
                  disabled: !sim.can('cristal', def.buy),
                  onclick: () => { sim.buyChest(def.id); sim.touch(); },
                }, h('span', { text: `Comprar · ${fmt(def.buy)}◆` }))
              : null,
          ),
        );
      })),

      this.lastOpen
        ? h('.loot-result', {},
            h('h3.section', { text: 'Último resgate' }),
            h('.loot-list', {}, ...this.lastOpen.items.map((item) => {
              const info = rarityInfo(item.rarity);
              return h('.loot-row', { style: { borderColor: info.color } },
                spriteIcon(item.icon, 26),
                h('strong', { text: itemName(item), style: { color: info.color } }),
                h('span.muted.tiny', { text: `${info.name} · nv ${item.ilvl}` }),
              );
            })),
          )
        : null,
    );
  }
}
