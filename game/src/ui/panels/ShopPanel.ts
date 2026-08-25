import { fmt } from '@core/format';
import {
  SHOP, shopCost, shopLimit,
  type ShopCategory, type ShopItem,
} from '@data/shop';
import { nivelExigido } from '@data/balance/curvas';
import type { ResourceId } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { RESOURCE_META } from '../recursos';
import type { Panel } from './types';

const CATEGORY: Record<ShopCategory, { label: string; cor: string }> = {
  logistica: { label: 'LOGÍSTICA', cor: '#55bddc' },
  sistemas: { label: 'SISTEMAS', cor: '#a978ff' },
  cambio: { label: 'CÂMBIO CONTROLADO', cor: '#f0b45a' },
};

const CATEGORIES: readonly ShopCategory[] = ['logistica', 'sistemas', 'cambio'];
const SERVICE_ART_ROOT = '/assets/ui/loja/services';

function serviceArt(file: string, className: string): HTMLElement {
  return h(`img.${className}`, {
    src: `${SERVICE_ART_ROOT}/${file}`,
    alt: '',
    'aria-hidden': true,
    decoding: 'async',
    draggable: false,
  });
}

/**
 * Central de Serviços.
 *
 * A gramática é a mesma da Provação e dos Baús: catálogo à esquerda, operação
 * em foco no centro e contexto decisivo à direita. Cor identifica moeda ou
 * serviço; a estrutura continua escura para a hierarquia não virar neon.
 */
export class ShopPanel implements Panel {
  id = 'loja';
  title = 'Loja';
  icon = 'aba/loja';
  iconUrl = '/assets/ui/menu/loja.webp';
  overlay = true;

  private selected = 'carga';
  private feedback = 'SELECIONE UM SERVIÇO';

  badge(sim: Sim): number {
    return SHOP.filter((item) => this.visible(sim, item) && sim.canBuyShopItem(item.id)).length;
  }

  render(sim: Sim): HTMLElement {
    const visible = SHOP.filter((item) => this.visible(sim, item));
    if (!visible.some((i) => i.id === this.selected)) this.selected = visible[0]?.id ?? 'carga';
    const selected = visible.find((i) => i.id === this.selected) ?? visible[0] ?? SHOP[0]!;

    return h(`.panel-body.loj${sim.state.settings.reduceEffects ? '.efeitos-reduzidos' : ''}`, {},
      this.header(sim),
      h('.loj-corpo', {},
        this.catalog(sim, visible),
        this.serviceTerminal(sim, selected),
        this.serviceContext(sim, selected),
      ),
      h('.loj-rodape', {},
        h('span', { text: 'A CENTRAL COMPRA TEMPO E FLEXIBILIDADE — NUNCA PODER EXCLUSIVO.' }),
        h('span', { text: this.feedback }),
      ),
    );
  }

  private header(sim: Sim): HTMLElement {
    return h('.loj-topo', {},
      h('.loj-titulo', {},
        spriteIcon('aba/loja', 42),
        h('.loj-titulo-copy', {},
          h('h1', { text: 'CENTRAL DE SERVIÇOS' }),
          h('span', { text: 'Logística, reconfiguração e câmbio auditável' }),
        ),
      ),
      h('.loj-saldos', {}, ...(['sucata', 'nucleo', 'cristal'] as ResourceId[]).map((id) => {
        const meta = RESOURCE_META[id];
        return h('.loj-saldo', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
          spriteIcon(meta.icon, 25),
          h('span', {}, h('small', { text: meta.label.toUpperCase() }), h('strong', { text: fmt(sim.state.resources[id]) })),
        );
      })),
    );
  }

  private catalog(sim: Sim, items: readonly ShopItem[]): HTMLElement {
    return h('.loj-col.loj-catalogo', {},
      h('.loj-secao', { text: 'CATÁLOGO' }),
      ...CATEGORIES.flatMap((category) => {
        const meta = CATEGORY[category];
        const categoryItems = items.filter((i) => i.category === category);
        if (!categoryItems.length) return [];
        const rows: HTMLElement[] = [h('.loj-grupo', { text: meta.label, style: { '--loj-cor': meta.cor } as Partial<CSSStyleDeclaration> })];
        for (const item of categoryItems) rows.push(this.catalogItem(sim, item));
        return rows;
      }),
    );
  }

  private catalogItem(sim: Sim, item: ShopItem): HTMLElement {
    const active = this.selected === item.id;
    const ready = sim.canBuyShopItem(item.id);
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const color = RESOURCE_META[item.currency].color;
    return h(`button.loj-servico${active ? '.ativo' : ''}${ready ? '.pronto' : ''}`, {
      style: { '--loj-cor': color } as Partial<CSSStyleDeclaration>,
      onclick: () => { this.selected = item.id; this.feedback = `${item.name.toUpperCase()} EM FOCO`; sim.touch(); },
    },
      serviceArt(item.art, 'loj-servico-img'),
      h('.loj-servico-copy', {},
        h('strong', { text: item.name }),
        h('span', { text: item.desc }),
      ),
      h('.loj-servico-sinal', { text: limit > 0 ? `${owned}/${limit}` : '●' }),
    );
  }

  private serviceTerminal(sim: Sim, item: ShopItem): HTMLElement {
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const cost = shopCost(item, owned);
    const meta = RESOURCE_META[item.currency];
    const ready = sim.canBuyShopItem(item.id);
    const fullAttempt = item.effect === 'tentativa_provacao' && sim.provacaoTentativas.tem >= 5;
    const emptyMatrix = item.effect === 'refaz_matriz' && sim.matrixSpent === 0;
    const exhausted = limit > 0 && owned >= limit;
    const buttonText = exhausted ? 'ESTOQUE ESGOTADO'
      : fullAttempt ? 'TENTATIVAS CHEIAS'
        : emptyMatrix ? 'MATRIZ SEM PONTOS'
          : item.kind === 'cambio' ? 'AUTORIZAR CONVERSÃO'
            : item.kind === 'permanente' ? 'INSTALAR MÓDULO' : 'EXECUTAR SERVIÇO';

    return h('.loj-col.loj-terminal', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
      h('.loj-secao', { text: 'TERMINAL DE OPERAÇÃO' }),
      h('.loj-hero', {},
        h('.loj-orbita', {}),
        h('.loj-hero-icon', {}, serviceArt(item.art, 'loj-hero-art')),
        h('.loj-classificacao', { text: CATEGORY[item.category].label }),
      ),
      h('.loj-operacao', {},
        h('span', { text: 'SERVIÇO SELECIONADO' }),
        h('h2', { text: item.name.toUpperCase() }),
        h('p', { text: item.detail }),
      ),
      limit > 0
        ? h('.loj-limite', {},
            h('span', { text: item.kind === 'permanente' ? 'INSTALAÇÕES' : 'COTA LIBERADA' }),
            progressBar(limit > 0 ? owned / limit : 0, meta.color, 5),
            h('strong', { text: `${owned} / ${limit}` }),
          )
        : h('.loj-limite.sem-limite', {}, h('span', { text: 'OPERAÇÃO AVULSA' }), h('strong', { text: 'SEM COTA' })),
      h('button.btn.loj-executar', {
        disabled: !ready,
        onclick: () => {
          if (!sim.buyShopItem(item.id)) return;
          this.feedback = `${item.name.toUpperCase()} · OPERAÇÃO CONCLUÍDA`;
        },
      },
        h('span', { text: buttonText }),
        h('.loj-preco', {}, spriteIcon(meta.icon, 20), h('strong', { text: fmt(cost) })),
      ),
    );
  }

  private serviceContext(sim: Sim, item: ShopItem): HTMLElement {
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const output = Object.entries(item.output ?? {});
    return h('.loj-col.loj-contexto', {},
      h('.loj-secao', { text: 'LEITURA DA TRANSAÇÃO' }),
      h('.loj-diagnostico', {},
        h('span', { text: 'ENTRADA' }),
        this.resourceLine(item.currency, shopCost(item, owned), 'débito'),
        ...(output.length
          ? [h('.loj-fluxo', { text: '↓ CONVERSÃO COM PERDA ↓' }), ...output.map(([id, amount]) => this.resourceLine(id as ResourceId, amount ?? 0, 'crédito'))]
          : [h('.loj-fluxo', { text: '↓ SERVIÇO IMEDIATO ↓' })]),
      ),
      h('.loj-secao', { text: 'ESTADO' }),
      this.stateRows(sim, item, owned, limit),
      h('.loj-secao', { text: 'PROTOCOLO' }),
      h('.loj-protocolo', {},
        h('strong', { text: 'SEM PODER EXCLUSIVO' }),
        h('p', { text: item.kind === 'cambio'
          ? 'A cota cresce com o nível de comando. Recursos passivos não podem ser refinados infinitamente em cristais.'
          : 'O serviço altera organização ou tempo. Dano, defesa e atributos continuam vindo apenas de item, craft e Matriz.' }),
      ),
    );
  }

  private stateRows(sim: Sim, item: ShopItem, owned: number, limit: number): HTMLElement {
    const rows: Array<[string, string]> = [
      ['Nível de comando', String(sim.state.command.nivel)],
      ['Operações realizadas', String(owned)],
    ];
    if (limit > 0) rows.push(['Disponíveis agora', String(Math.max(0, limit - owned))]);
    if (item.effect === 'carga') rows.push(['Capacidade atual', `${sim.cargoSlots} itens`]);
    if (item.effect === 'tentativa_provacao') rows.push(['Tentativas', `${sim.provacaoTentativas.tem} / 5`]);
    if (item.effect === 'refaz_matriz') rows.push(['Pontos alocados', String(sim.matrixSpent)]);
    return h('.loj-estado', {}, ...rows.map(([label, value]) => h('.loj-estado-row', {}, h('span', { text: label }), h('strong', { text: value }))));
  }

  private resourceLine(id: ResourceId, amount: number, label: string): HTMLElement {
    const meta = RESOURCE_META[id];
    return h('.loj-recurso-linha', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
      spriteIcon(meta.icon, 27),
      h('span', {}, h('small', { text: label.toUpperCase() }), h('strong', { text: `${fmt(amount)} ${meta.label}` })),
    );
  }

  private visible(sim: Sim, item: ShopItem): boolean {
    return sim.alcanceLiberado >= (item.requiresSector ?? 0)
      && sim.nivelLiberado >= nivelExigido(item.requiresSector ?? 0);
  }
}
