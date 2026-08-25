import { fmt } from '@core/format';
import { CHEST_BY_ID, CHESTS, PATROL_CACHE_KILLS, type ChestDef } from '@data/chests';
import { RARITIES, rarityInfo } from '@data/rarity';
import { itemName } from '@sim/loot';
import type { Item, Rarity } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { buildItemCard } from '../ItemCard';
import { RESOURCE_META } from '../recursos';
import type { Panel } from './types';

const CHEST_ART = '/assets/ui/baus/chests';

function chestImage(def: ChestDef, className: string): HTMLElement {
  return h('img', {
    class: className,
    src: `${CHEST_ART}/${def.art}`,
    alt: def.name,
    draggable: 'false',
  });
}

function chanceText(chance: number): string {
  const percent = chance * 100;
  if (percent >= 10) return `${percent.toFixed(0)}%`;
  if (percent >= 1) return `${percent.toFixed(1)}%`;
  if (percent >= 0.01) return `${percent.toFixed(3)}%`;
  return `${percent.toFixed(5)}%`;
}

/**
 * Câmara de aquisição.
 *
 * A composição segue a gramática da Provação: escolha à esquerda, objeto em
 * foco no centro e informação decisiva à direita. A cor forte não desenha a
 * estrutura — ela identifica o baú e, durante a revelação, a raridade obtida.
 */
export class ChestsPanel implements Panel {
  id = 'baus';
  title = 'Baús';
  icon = 'aba/baus';
  iconUrl = '/assets/ui/menu/bau.webp';
  overlay = true;

  private selected = 'bronze';
  private lastOpen: { tier: string; items: Item[]; best: Rarity } | null = null;

  /**
   * Ficha do item sob o cursor.
   *
   * Mora no `body`, e não dentro do painel, porque `.bau-col` é `overflow:
   * hidden` — um cartão ancorado lá dentro seria cortado pela própria coluna
   * assim que passasse da borda. É o mesmo caminho que o trilho já usa.
   *
   * Criado sob demanda: a maioria das aberturas de painel nunca chega a passar
   * o mouse por um item, e um nó a mais no `body` por painel construído seria
   * lixo acumulado a cada troca de aba.
   */
  private ficha: HTMLElement | null = null;

  private fichaDoItem(): HTMLElement {
    if (!this.ficha) {
      this.ficha = h('.item-card-float.hidden');
      document.body.append(this.ficha);
    }
    return this.ficha;
  }

  private mostrarFicha(sim: Sim, item: Item, alvo: HTMLElement): void {
    const ficha = this.fichaDoItem();
    ficha.replaceChildren(buildItemCard(sim, item));
    ficha.classList.remove('hidden');

    // Abre à direita do item; vira para a esquerda quando não couber, e nunca
    // passa da borda de baixo da janela.
    const spot = alvo.getBoundingClientRect();
    const largura = ficha.offsetWidth || 236;
    const altura = ficha.offsetHeight || 220;
    const direita = spot.right + 10;
    const cabe = direita + largura <= window.innerWidth - 8;
    ficha.style.left = `${cabe ? direita : Math.max(8, spot.left - largura - 10)}px`;
    ficha.style.top = `${Math.min(Math.max(8, spot.top - 12), Math.max(8, window.innerHeight - altura - 8))}px`;
  }

  private esconderFicha(): void {
    this.ficha?.classList.add('hidden');
  }

  badge(sim: Sim): number {
    return Object.values(sim.state.chests).reduce((sum, n) => sum + n, 0);
  }

  render(sim: Sim): HTMLElement {
    const def = CHEST_BY_ID.get(this.selected) ?? CHESTS[0]!;
    const stock = sim.state.chests[def.id] ?? 0;
    const result = this.lastOpen?.tier === def.id ? this.lastOpen : null;

    return h(`.panel-body.bau${sim.state.settings.reduceEffects ? '.efeitos-reduzidos' : ''}`, {},
      this.header(sim),
      h('.bau-corpo', {},
        this.catalog(sim, def),
        this.terminal(sim, def, stock, result),
        this.intelligence(sim, def, result),
      ),
      h('.bau-rodape', {},
        h('span', { text: 'A SORTE DO PILOTO NÃO ALTERA CÁPSULAS.' }),
        h('span', { text: 'PROBABILIDADES FIXAS · RESULTADO AUDITÁVEL' }),
      ),
    );
  }

  private header(sim: Sim): HTMLElement {
    const progress = sim.state.bar.cacheProgress;
    const kills = Math.floor(progress * PATROL_CACHE_KILLS);
    const total = this.badge(sim);

    return h('.bau-topo', {},
      h('.bau-titulo', {},
        spriteIcon('bau/a_0', 42),
        h('.bau-titulo-copy', {},
          h('h1', { text: 'CÂMARA DE AQUISIÇÃO' }),
          h('span.muted.tiny', { text: `${total} cápsula${total === 1 ? '' : 's'} em estoque` }),
        ),
      ),
      h('.bau-cache', {},
        h('.bau-cache-linha', {},
          h('span', { text: 'PRÓXIMA CÁPSULA DE PATRULHA' }),
          h('strong', { text: `${kills} / ${PATROL_CACHE_KILLS}` }),
        ),
        progressBar(progress, '#55bddc', 5),
      ),
    );
  }

  private catalog(sim: Sim, selected: ChestDef): HTMLElement {
    return h('.bau-col.bau-lista', {},
      h('.bau-secao', { text: 'CÁPSULAS' }),
      ...CHESTS.map((def) => {
        const stock = sim.state.chests[def.id] ?? 0;
        const active = def.id === selected.id;
        return h(`button.bau-tier${active ? '.ativo' : ''}${stock > 0 ? '.disponivel' : ''}`, {
          style: { '--bau-cor': def.color } as Partial<CSSStyleDeclaration>,
          title: `${def.name} · ${stock} em estoque`,
          'aria-pressed': active,
          onclick: () => { this.selected = def.id; sim.touch(); },
        },
          chestImage(def, 'bau-tier-img'),
          h('.bau-tier-copy', {},
            h('strong', { text: def.name }),
            h('span', { text: `${def.items[0]}–${def.items[1]} itens · NV +${def.ilvlBonus}` }),
          ),
          h('.bau-tier-stock', { text: String(stock), title: `${stock} em estoque` }),
        );
      }),
    );
  }

  private terminal(
    sim: Sim,
    def: ChestDef,
    stock: number,
    result: { items: Item[]; best: Rarity } | null,
  ): HTMLElement {
    const bestInfo = result ? rarityInfo(result.best) : null;
    const resources = Object.entries(def.resources);

    return h(`.bau-col.bau-terminal.t-${def.id}${result ? `.revelando.r-${bestInfo!.slug}` : ''}`, {
      style: { '--bau-cor': def.color, '--reveal-cor': bestInfo?.color ?? def.color } as Partial<CSSStyleDeclaration>,
    },
      h('.bau-secao', { text: 'TERMINAL DE ABERTURA' }),
      h('.bau-hero', {},
        h('.bau-aura', {}),
        h('.bau-radial', {}),
        h('.bau-capsula', {},
          // Uma cópia escura fica entre o efeito e a arte. Ela funciona como
          // anteparo para os pixels semitransparentes do WebP: a luz da raridade
          // continua atrás da silhueta, sem tingir a superfície do baú.
          chestImage(def, 'bau-hero-matte'),
          chestImage(def, 'bau-hero-img'),
        ),
        result
          ? h('.bau-reveal-selo', {},
              h('span', { text: 'MAIOR SINAL' }),
              h('strong', { text: bestInfo!.name.toUpperCase(), style: { color: bestInfo!.color } }),
            )
          : null,
      ),
      h('.bau-identidade', {},
        h('span', { text: 'CÁPSULA SELECIONADA' }),
        h('strong', { text: def.name.toUpperCase(), style: { color: def.color } }),
        h('small', { text: `${stock} disponível${stock === 1 ? '' : 'is'} · ${def.items[0]}–${def.items[1]} itens por abertura` }),
      ),
      h('.bau-recursos', {}, ...resources.map(([id, amount]) => {
        const meta = RESOURCE_META[id as keyof typeof RESOURCE_META];
        return h('.bau-recurso', { title: meta?.label ?? id },
          meta ? spriteIcon(meta.icon, 20) : null,
          h('span', { text: fmt(amount ?? 0) }),
        );
      })),
      h('.bau-acoes', {},
        h('button.btn.bau-abrir', {
          disabled: stock <= 0,
          onclick: () => {
            const items = sim.openChestFromStock(def.id);
            if (items?.length) {
              const best = Math.max(...items.map((item) => item.rarity)) as Rarity;
              this.lastOpen = { tier: def.id, items, best };
            }
            sim.touch();
          },
        }, h('span', { text: stock > 0 ? 'ABRIR CÁPSULA' : 'SEM ESTOQUE' })),
        def.buy > 0
          ? h('button.btn.bau-comprar', {
              disabled: !sim.can('cristal', def.buy),
              onclick: () => { sim.buyChest(def.id); sim.touch(); },
            }, h('span', { text: `ADQUIRIR · ${fmt(def.buy)} ◆` }))
          : null,
      ),
    );
  }

  private intelligence(sim: Sim, def: ChestDef, result: { items: Item[]; best: Rarity } | null): HTMLElement {
    return h('.bau-col.bau-info', {},
      h('.bau-secao', { text: 'PROBABILIDADES POR ITEM' }),
      h('.bau-chances', {}, ...RARITIES.map((rarity) => {
        const chance = def.raridades[rarity.id];
        return h(`.bau-chance.r-${rarity.slug}`, {},
          h('.bau-chance-sinal', { style: { background: rarity.color, boxShadow: `0 0 8px ${rarity.glow}` } }),
          h('span', { text: rarity.name }),
          h('strong', { text: chanceText(chance) }),
        );
      })),
      h('.bau-nota', {},
        h('strong', { text: 'DISTRIBUIÇÃO PRÓPRIA' }),
        h('span', { text: 'Cada cápsula usa sua própria tabela. Sorte afeta apenas itens derrubados em combate.' }),
      ),
      h('.bau-secao', { text: result ? 'ITENS EXTRAÍDOS' : 'LEITURA DE SINAL' }),
      result
        ? h('.bau-loot', {}, ...result.items.map((item, index) => {
            const info = rarityInfo(item.rarity);
            const linha = h(`.bau-drop.r-${info.slug}`, {
              style: {
                '--rarity': info.color,
                '--rarity-glow': info.glow,
                animationDelay: `${160 + index * 110}ms`,
              } as Partial<CSSStyleDeclaration>,
            },
              h('.bau-drop-fx', {}),
              spriteIcon(item.icon, 34),
              h('.bau-drop-copy', {},
                h('strong', { text: itemName(item), style: { color: info.color } }),
                h('span', { text: `${info.name} · nível ${item.ilvl}` }),
              ),
            );
            // A linha só dizia nome, raridade e nível. Quem acabou de abrir a
            // cápsula quer saber se a peça PRESTA — implícito, afixos, tier e
            // comparação com o equipado — e ir até o Armazém para descobrir
            // desfaz o momento da abertura.
            linha.addEventListener('mouseenter', () => this.mostrarFicha(sim, item, linha));
            linha.addEventListener('mouseleave', () => this.esconderFicha());
            return linha;
          }))
        : h('.bau-vazio', {},
            h('span', { text: '◈' }),
            h('strong', { text: 'AGUARDANDO ABERTURA' }),
            h('small', { text: 'O sinal da maior raridade define a animação da câmara.' }),
          ),
    );
  }
}
