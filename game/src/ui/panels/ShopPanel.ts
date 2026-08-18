import { fmt } from '@core/format';
import { CARGO_PER_LEVEL, SHOP, shopCost, type ShopItem } from '@data/shop';
import type { ResourceId } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { nivelExigido } from '@data/balance/curvas';
import type { Panel } from './types';

const MOEDA: Record<ResourceId, { nome: string; cor: string }> = {
  sucata: { nome: 'sucata', cor: '#ffd98a' },
  nucleo: { nome: 'núcleos', cor: '#7fe4ff' },
  cristal: { nome: 'cristais', cor: '#c060ff' },
};

/**
 * Loja.
 *
 * Existe para dar destino ao recurso que sobra: sucata acumula sozinha com a
 * patrulha e núcleos vêm de desmanche, então sem um ralo permanente eles viram
 * número morto no topo da tela. Nada aqui é exclusivo — a loja compra tempo,
 * não poder que o jogo não dê de outra forma.
 */
export class ShopPanel implements Panel {
  id = 'loja';
  title = 'Loja';
  icon = 'aba/loja';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  badge(sim: Sim): number {
    return SHOP.filter((item) => this.visivel(sim, item) && this.pagavel(sim, item)).length;
  }

  render(sim: Sim): HTMLElement {
    const permanentes = SHOP.filter((i) => i.kind === 'permanente' && this.visivel(sim, i));
    const consumiveis = SHOP.filter((i) => i.kind === 'consumivel' && this.visivel(sim, i));

    return h('.panel-body', {},
      h('p.muted.hint', { text: 'Tudo aqui também se consegue jogando. A loja encurta caminho, não abre atalho exclusivo.' }),

      h('h3.section', { text: 'Contratos permanentes' }),
      h('.shop-list', {}, ...permanentes.map((item) => this.card(sim, item))),

      h('h3.section', { text: 'Compra avulsa' }),
      h('.shop-list', {}, ...consumiveis.map((item) => this.card(sim, item))),
    );
  }

  private visivel(sim: Sim, item: ShopItem): boolean {
    return sim.alcanceLiberado >= (item.requiresSector ?? 0)
      && sim.state.command.nivel >= nivelExigido(item.requiresSector ?? 0);
  }

  private pagavel(sim: Sim, item: ShopItem): boolean {
    const owned = sim.shopOwned(item.id);
    if (item.max > 0 && owned >= item.max) return false;
    return sim.can(item.currency, shopCost(item, item.kind === 'consumivel' ? 0 : owned));
  }

  private card(sim: Sim, item: ShopItem): HTMLElement {
    const owned = sim.shopOwned(item.id);
    const esgotado = item.max > 0 && owned >= item.max;
    const custo = shopCost(item, item.kind === 'consumivel' ? 0 : owned);
    const moeda = MOEDA[item.currency];
    const pode = !esgotado && sim.can(item.currency, custo);

    // Alguns efeitos rendem melhor explicados com o valor já acumulado.
    const acumulado =
      item.id === 'carga' ? `${sim.cargoSlots} espaços` :
      item.id === 'ima' ? `ímã ×${fmt(sim.magnetRange, 2)}` :
      item.id === 'reparo' ? `+${Math.round(sim.repairPerWave * 100)}% por onda` :
      item.stat ? `acumulado +${Math.round(item.stat.per * owned * 100)}%` : '';

    return h(`.shop-item${pode ? '.ready' : ''}${esgotado ? '.maxed' : ''}`, {},
      spriteIcon(item.icon, 32),
      h('.shop-main', {},
        h('.shop-title', {},
          h('strong', { text: item.name }),
          item.kind === 'permanente'
            ? h('span.level', { text: esgotado ? 'MÁX' : `${owned} / ${item.max || '∞'}` })
            : null,
        ),
        h('span.muted.tiny', { text: item.desc }),
        ...(item.kind === 'permanente'
          ? [h('.shop-progress', {},
              progressBar(item.max > 0 ? owned / item.max : 0, moeda.cor, 3),
              h('span.muted.tiny', { text: acumulado }),
            )]
          : []),
      ),
      esgotado
        ? h('.upgrade-buy.maxed', { text: 'MÁX' })
        : h('button.upgrade-buy', {
            disabled: !pode,
            onclick: () => { sim.buyShopItem(item.id); },
          },
            h('span.buy-cost', { text: fmt(custo), style: { color: moeda.cor } }),
            h('span.buy-count', { text: moeda.nome }),
          ),
    );
  }
}

/** Exposto para o cockpit mostrar quanto a carga cresceu. */
export const CARGA_POR_NIVEL = CARGO_PER_LEVEL;
