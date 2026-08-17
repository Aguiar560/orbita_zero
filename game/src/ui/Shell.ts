import { bus } from '@app/Bus';
import { fmt, duration } from '@core/format';
import { rarityInfo } from '@data/rarity';
import { describeGalaxy, galaxyOfSector, phaseOfSector } from '@data/galaxies';
import { itemName } from '@sim/loot';
import type { OfflineReport, Sim } from '@sim/index';
import { RESOURCE_IDS, type ResourceId } from '@sim/types';
import { h, clear, spriteIcon } from './dom';
import { LeftRail } from './LeftRail';
import type { Panel } from './panels/types';
import { GalaxyPanel } from './panels/GalaxyPanel';
import { ShopPanel } from './panels/ShopPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { ArmazemPanel } from './panels/ArmazemPanel';
import { TreePanel } from './panels/TreePanel';
import { FleetPanel } from './panels/FleetPanel';
import { ChestsPanel } from './panels/ChestsPanel';
import { CodexPanel } from './panels/CodexPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { RESOURCE_META } from './recursos';

/** Frequência de re-render do painel ativo. */
const PANEL_HZ = 5;

/**
 * Camada de interface em DOM sobre os dois canvas.
 *
 * O painel ativo é reconstruído inteiro a ~5 Hz em vez de sofrer diffing: são
 * poucas dezenas de nós, o custo é irrelevante perto do laço de render, e evita
 * uma camada inteira de reconciliação para uma UI que é essencialmente uma
 * planilha viva.
 */
export class Shell {
  /**
   * Abas do painel direito. Ajustes NÃO está aqui: virou engrenagem no topo,
   * porque é configuração do jogo e não um lugar onde se joga.
   */
  private readonly panels: Panel[] = [
    new GalaxyPanel(),
    new InventoryPanel(),
    new ArmazemPanel(),
    new TreePanel(),
    new FleetPanel(),
    new ChestsPanel(),
    new ShopPanel(),
    new CodexPanel(),
  ];

  private readonly settings = new SettingsPanel();

  private active = this.panels[0]!;
  private panelTimer = 0;
  private dirty = true;

  private readonly resourceNodes = new Map<ResourceId, HTMLElement>();
  private leftRail!: LeftRail;
  private tabBar!: HTMLElement;
  private panelHost!: HTMLElement;
  private statusNode!: HTMLElement;
  private toastHost!: HTMLElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly sim: Sim,
  ) {}

  /** Monta o esqueleto e devolve o canvas para o modo de jogo. */
  build(): { stage: HTMLCanvasElement; stageWrap: HTMLElement } {
    const stage = h('canvas#stage') as HTMLCanvasElement;
    const stageWrap = h('.stage-wrap', {}, stage);

    this.leftRail = new LeftRail(this.sim);
    this.tabBar = h('nav.tabs');
    this.panelHost = h('.panel-host');
    this.statusNode = h('.status');
    this.toastHost = h('.toasts');

    const topbar = h('header.topbar', {},
      h('.brand', {},
        h('span.brand-mark', { text: 'ØZ' }),
        h('.brand-text', {},
          h('strong', { text: 'ÓRBITA ZERO' }),
          this.statusNode,
        ),
      ),
      h('.topbar-right', {},
        h('.resources', {}, ...RESOURCE_IDS.map((id) => {
          const meta = RESOURCE_META[id];
          const value = h('strong.res-value', { text: '0', style: { color: meta.color } });
          this.resourceNodes.set(id, value);
          return h('.res', { title: meta.label }, spriteIcon(meta.icon, 22), value);
        })),
        h('button.gear', {
          title: 'Configurações',
          onclick: () => this.openSettings(),
        }, spriteIcon('geral/b_1', 24)),
      ),
    );

    clear(this.root).append(
      topbar,
      h('main.layout', {},
        this.leftRail.root,
        h('.center', {}, stageWrap),
        h('aside.rail-right', {}, this.tabBar, this.panelHost),
      ),
      this.toastHost,
    );

    this.buildTabs();
    this.wireEvents();
    this.renderPanel();

    return { stage, stageWrap };
  }

  private buildTabs(): void {
    clear(this.tabBar);
    for (const panel of this.panels) {
      const badge = panel.badge?.(this.sim) ?? 0;
      const tab = h(`button.tab${panel === this.active ? '.active' : ''}`, {
        title: panel.title,
        onclick: () => {
          this.active = panel;
          this.dirty = true;
          this.buildTabs();
          this.renderPanel();
        },
      },
        spriteIcon(panel.icon, 22),
        h('span.tab-label', { text: panel.title }),
        badge > 0 ? h('span.badge', { text: badge > 99 ? '99+' : String(badge) }) : null,
      );
      this.tabBar.append(tab);
    }
  }

  private wireEvents(): void {
    bus.on('state:changed', () => { this.dirty = true; });
    bus.on('resources:changed', () => this.updateResources());

    bus.on('toast', ({ text, kind, icon }) => this.pushToast(text, kind ?? 'info', icon));

    bus.on('panel:open', ({ id }) => {
      const panel = this.panels.find((p) => p.id === id);
      if (!panel) return;
      this.active = panel;
      this.dirty = true;
      this.buildTabs();
      this.renderPanel();
    });

    bus.on('loot:dropped', ({ item }) => {
      if (item.rarity < 2) return;
      const info = rarityInfo(item.rarity);
      this.pushToast(`${itemName(item)} · ${info.name}`, item.rarity >= 4 ? 'epic' : 'good', item.icon);
    });

    bus.on('sector:advanced', ({ sector }) => this.pushToast(`Setor ${sector} liberado`, 'good', 'ui/icon_star'));
    bus.on('boss:defeated', ({ name }) => this.pushToast(`${name} destruído`, 'epic', 'fx/blast_fire_3'));
    bus.on('chest:granted', ({ tier, source }) => this.pushToast(`Baú ${tier}${source ? ` · ${source}` : ''}`, 'good', 'ui/icon_coin'));
  }

  update(dt: number): void {
    this.leftRail.update(dt);
    this.panelTimer -= dt;
    if (this.panelTimer <= 0) {
      this.panelTimer = 1 / PANEL_HZ;
      if (this.dirty) {
        this.dirty = false;
        this.renderPanel();
        this.buildTabs();
      }
      this.updateStatus();
    }
    this.updateResources();
  }

  private renderPanel(): void {
    const content = this.active.render(this.sim);
    clear(this.panelHost).append(
      h('.panel-head', {}, h('h1', { text: this.active.title })),
      content,
    );
  }

  private updateResources(): void {
    for (const id of RESOURCE_IDS) {
      const node = this.resourceNodes.get(id);
      if (node) node.textContent = fmt(this.sim.state.resources[id]);
    }
  }

  private updateStatus(): void {
    const st = this.sim.state;
    const info = describeGalaxy(galaxyOfSector(st.run.sector));
    this.statusNode.textContent = [
      `${info.name} · fase ${phaseOfSector(st.run.sector)}`,
      `Setor ${st.run.sector}`,
      this.sim.encounterLabel,
      `Patente ${st.command.nivel}`,
    ].join('  ·  ');
  }

  private pushToast(text: string, kind: 'info' | 'good' | 'bad' | 'epic', icon?: string): void {
    const el = h(`.toast.${kind}`, {}, icon ? spriteIcon(icon, 22) : null, h('span', { text }));
    this.toastHost.append(el);
    // Limita a pilha: em picos de loot a tela viraria só notificação.
    while (this.toastHost.childElementCount > 5) this.toastHost.firstElementChild?.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  /**
   * Configurações como modal.
   *
   * O painel é reconstruído a cada abertura e re-renderizado quando o estado
   * muda, para que alternar o modo de teste revele os controles extras sem
   * fechar e reabrir.
   */
  private openSettings(): void {
    const body = h('.modal-body');
    const draw = () => body.replaceChildren(this.settings.render(this.sim));
    draw();

    const off = bus.on('state:changed', draw);
    const modal = h('.modal-backdrop', {},
      h('.modal.modal-wide', {},
        h('.modal-head', {},
          h('h2', { text: 'Configurações' }),
          h('button.modal-close', { text: '✕', onclick: () => close() }),
        ),
        body,
      ),
    );

    const close = (): void => {
      off();
      modal.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', onKey);
    this.root.append(modal);
  }

  /** Modal de boas-vindas com o resumo do progresso offline. */
  showOfflineReport(report: OfflineReport): void {
    if (report.seconds < 60) return;

    const rows = RESOURCE_IDS
      .filter((id) => report.gained[id] > 0)
      .map((id) => h('.offline-row', {},
        spriteIcon(RESOURCE_META[id].icon, 22),
        h('span', { text: RESOURCE_META[id].label }),
        h('strong', { text: `+${fmt(report.gained[id])}`, style: { color: RESOURCE_META[id].color } }),
      ));

    const modal = h('.modal-backdrop', {},
      h('.modal', {},
        h('h2', { text: 'Relatório de ausência' }),
        h('p.muted', { text: `A frota operou sozinha por ${duration(report.seconds)}${report.capped ? ' (teto atingido)' : ''}.` }),
        h('.offline-grid', {}, ...rows),
        h('.offline-extra', {},
          h('span', { text: `${fmt(report.kills)} abates` }),
          report.sectorsCleared > 0 ? h('span', { text: `${report.sectorsCleared} setores` }) : null,
          report.chests > 0 ? h('span', { text: `${report.chests} baús` }) : null,
        ),
        report.capped
          ? h('p.muted.tiny', { text: 'Aumente o teto com o nó de Legado "Piloto Automático".' })
          : null,
        h('button.btn.primary.big', { onclick: () => modal.remove() }, h('span', { text: 'Retomar comando' })),
      ),
    );
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    this.root.append(modal);
  }

  showFatal(message: string): void {
    clear(this.root).append(
      h('.fatal', {},
        h('h1', { text: 'Falha ao iniciar' }),
        h('pre', { text: message }),
        h('p.muted', { text: 'Se os assets não foram gerados, rode `npm run assets` na pasta do jogo.' }),
      ),
    );
  }
}
