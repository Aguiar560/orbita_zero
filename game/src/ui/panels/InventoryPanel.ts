import { toast } from '@app/Bus';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { RARITIES, rarityInfo } from '@data/rarity';
import { getElement } from '@data/elements';
import { colunasDaGrade } from '@data/balance/capacidade';

import { scoreItem } from '@sim/loot';
import type { Item, Rarity } from '@sim/types';
import type { Sim } from '@sim/index';

/**
 * A grade, com as colunas vindas da capacidade.
 *
 * Vai por `setProperty` e não pelo objeto `style` do helper porque propriedade
 * CUSTOMIZADA não existe em `CSSStyleDeclaration` — o TypeScript recusa, e com
 * razão: `style['--x']` é ignorado silenciosamente em runtime.
 */
function grade(colunas: number, cells: HTMLElement[]): HTMLElement {
  const el = h('.inv-grid', {}, ...cells);
  el.style.setProperty('--inv-colunas', String(colunas));
  return el;
}

import { h, spriteIcon } from '../dom';
import { buildItemCard } from '../ItemCard';
import type { Panel } from './types';

/**
 * A forma da grade vem de `data/balance/capacidade.ts` (§28).
 *
 * Eram `COLS = 7` e `ROWS = 10` fixos aqui. Não é decisão de painel: quantos
 * espaços o jogador tem é regra de jogo, e ela cresce de 15 até 70 por loja,
 * chefe e universo. Manter a constante aqui faria a UI desenhar 70 células
 * enquanto a simulação só permitia guardar 15.
 */

/**
 * Inventário em grade.
 *
 * A lista anterior gastava meia tela por item e exigia rolar muito para
 * comparar duas peças. Aqui cada item é uma célula com o ícone e a moldura da
 * raridade; os detalhes vivem num cartão que aparece no hover, então dá para
 * varrer o inventário inteiro de relance e só parar no que interessa.
 */
export class InventoryPanel implements Panel {
  id = 'inventario';
  title = 'Inventário';
  icon = 'aba/inventario';

  private filter: Rarity | -1 = -1;
  private sort: 'poder' | 'raridade' | 'slot' = 'poder';
  private readonly tip = h('.inv-tip.hidden');

  badge(sim: Sim): number {
    return sim.state.inventory.length;
  }

  render(sim: Sim): HTMLElement {
    const items = this.sorted(sim);
    // A grade tem exatamente os espaços que o jogador LIBEROU (§28), não um
    // número fixo. Desenhar 70 células com capacidade 15 mostrava 55 espaços
    // que não existem — o oposto do que um inventário apertado deve comunicar.
    const capacidade = sim.cargoSlots;
    const cells: HTMLElement[] = items.slice(0, capacidade).map((item) => this.cell(sim, item));
    // Preenche o resto com espaços vazios para a grade nunca "desmontar".
    while (cells.length < capacidade) cells.push(h('.inv-cell.vazio'));

    return h('.panel-body.inv-body', {},
      h('.toolbar', {},
        h('.filters', {},
          this.chip(sim, -1, 'Tudo', '#9fb0c4'),
          ...RARITIES.map((r) => this.chip(sim, r.id, r.name, r.color)),
        ),
      ),
      h('.toolbar', {},
        h('select.select', {
          onchange: (e: Event) => { this.sort = (e.target as HTMLSelectElement).value as typeof this.sort; sim.touch(); },
        },
          h('option', { value: 'poder', text: 'Ganho de poder', selected: this.sort === 'poder' }),
          h('option', { value: 'raridade', text: 'Raridade', selected: this.sort === 'raridade' }),
          h('option', { value: 'slot', text: 'Slot', selected: this.sort === 'slot' }),
        ),
        h('span.muted.tiny', { text: `${sim.state.inventory.length} / ${sim.cargoSlots}` }),
        h('button.mini.danger', {
          text: 'Desmanchar ≤ incomum',
          onclick: () => {
            const gained = sim.salvageBelow(2);
            sim.touch();
            if (gained > 0) toast(`+${fmt(gained)} núcleos recuperados`, 'good', 'ui/icon_coin');
          },
        }),
      ),

      h('p.muted.tiny.hint', { text: 'Clique para equipar · Shift+clique para desmanchar · botão direito favorita.' }),
      h('.inv-wrap', {},
        grade(colunasDaGrade(capacidade), cells),
        this.tip),
    );
  }

  private sorted(sim: Sim): Item[] {
    const list = sim.state.inventory.filter((i) => this.filter < 0 || i.rarity === this.filter);
    switch (this.sort) {
      case 'raridade':
        return list.sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
      case 'slot':
        return list.sort((a, b) => a.slot.localeCompare(b.slot) || b.rarity - a.rarity);
      default:
        return list.sort((a, b) => scoreItem(sim.state, b) - scoreItem(sim.state, a));
    }
  }

  private chip(sim: Sim, rarity: Rarity | -1, label: string, color: string): HTMLElement {
    const active = this.filter === rarity;
    return h(`button.chip${active ? '.active' : ''}`, {
      text: label,
      style: { color, borderColor: active ? color : 'transparent' },
      onclick: () => { this.filter = rarity; sim.touch(); },
    });
  }

  private cell(sim: Sim, item: Item): HTMLElement {
    const info = rarityInfo(item.rarity);
    const gain = scoreItem(sim.state, item);

    const cell = h('.inv-cell', {
      style: { borderColor: info.color, boxShadow: `inset 0 0 16px ${info.glow}` },
    }, spriteIcon(item.icon, 40));

    // Elemento no canto inferior esquerdo: numa grade de setenta ícones, é o
    // que permite achar "o canhão de gelo" sem passar o mouse em cada célula.
    if (item.element && item.element !== 'padrao') {
      const el = getElement(item.element);
      cell.append(h('i.pip.elem', {
        text: el.sigla,
        title: `Elemento ${el.name.toLowerCase()}`,
        style: { background: el.color, color: '#08101c' },
      }));
    }

    // Marcadores de canto: melhoria, conjunto e favorito, legíveis sem hover.
    if (gain > 0) cell.append(h('i.pip.up', { title: 'Melhora a nave' }));
    if (item.set) cell.append(h('i.pip.set'));
    if (item.favorite) cell.append(h('i.pip.fav', { text: '★' }));

    cell.addEventListener('mouseenter', () => this.showTip(sim, item, cell, gain));
    cell.addEventListener('mouseleave', () => this.tip.classList.add('hidden'));
    cell.addEventListener('click', (e) => {
      if (e.shiftKey) sim.salvage(item.uid);
      else sim.equip(item.uid);
      this.tip.classList.add('hidden');
      sim.touch();
    });
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      sim.toggleFavorite(item.uid);
      sim.touch();
    });
    return cell;
  }

  private showTip(sim: Sim, item: Item, cell: HTMLElement, gain: number): void {
    this.tip.replaceChildren(
      buildItemCard(sim, item),
      h('.tip-power', {},
        h('span.muted.tiny', { text: 'ganho de poder' }),
        h('strong.tiny', {
          text: gain > 0 ? `+${fmt(gain, 1)}` : fmt(gain, 1),
          style: { color: gain > 0 ? '#7ed957' : '#7f93b3' },
        }),
      ),
    );

    // Ancora o cartão à célula, mantendo-o dentro do painel.
    const wrap = cell.closest('.inv-wrap') as HTMLElement | null;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const spot = cell.getBoundingClientRect();
    this.tip.classList.remove('hidden');
    const tipH = this.tip.offsetHeight || 200;
    this.tip.style.left = `${clamp(spot.left - box.left + spot.width + 8, 0, Math.max(0, box.width - 236))}px`;
    this.tip.style.top = `${clamp(spot.top - box.top - 10, 0, Math.max(0, box.height - tipH))}px`;
  }
}
