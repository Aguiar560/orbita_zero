import { bus } from '@app/Bus';
import { LAB_CODE_WRITE_AVAILABLE, consumeCalibrationNotice, writeHitboxCalibration } from '@app/LabCalibrationAdmin';
import { fmt, duration } from '@core/format';
import { rarityInfo } from '@data/rarity';
import { describeGalaxy, galaxyOfSector, phaseOfSector } from '@data/galaxies';
import { itemName } from '@sim/loot';
import type { OfflineReport, Sim } from '@sim/index';
import { RESOURCE_IDS, type ResourceId } from '@sim/types';
import { MISSAO_POR_ID } from '@data/missoes';
import { fracaoDe, progressoDe, situacaoDe } from '@sim/missoes';
import { h, clear, spriteIcon } from './dom';
import { LeftRail } from './LeftRail';
import { Anatomia } from './Anatomia';
import { PerfilMenu } from './PerfilMenu';
import { encerrarSelecao, escolherElemento, selecaoPendente } from './selecao';
import { ELEMENTS, getElement } from '@data/elements';
import { screenUnlockFor, type ScreenUnlock } from '@data/screen-unlocks';
import type { Panel } from './panels/types';
import { GalaxyPanel } from './panels/GalaxyPanel';
import { ShopPanel } from './panels/ShopPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { ArmazemPanel } from './panels/ArmazemPanel';
import { FabricacaoPanel } from './panels/FabricacaoPanel';
import { AffixCraftPanel } from './panels/AffixCraftPanel';
import { MissoesPanel } from './panels/MissoesPanel';
import { EventosPanel } from './panels/EventosPanel';
import { ProvacaoPanel } from './panels/ProvacaoPanel';
import { montarResultadoDaProvacao } from './ProvacaoResultado';
import { TreePanel } from './panels/TreePanel';
import { FleetPanel } from './panels/FleetPanel';
import { ChestsPanel } from './panels/ChestsPanel';
import { CodexPanel } from './panels/CodexPanel';
import { RankingPanel } from './panels/RankingPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { LaboratorioPanel } from './panels/LaboratorioPanel';
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
    new FabricacaoPanel(),
    new AffixCraftPanel(),
    new MissoesPanel(),
    new EventosPanel(),
    new ProvacaoPanel(),
    new TreePanel(),
    new FleetPanel(),
    new ChestsPanel(),
    new ShopPanel(),
    new CodexPanel(),
    new RankingPanel(),
    ...(LAB_CODE_WRITE_AVAILABLE ? [new LaboratorioPanel()] : []),
  ];

  private readonly settings = new SettingsPanel();

  private active = this.panels[0]!;
  private panelTimer = 0;
  private dirty = true;
  /** Camada do painel em tela cheia, quando há um aberto. */
  private camadaHost: HTMLElement | null = null;

  /**
   * Faixa de instrução enquanto uma carga de serviço espera um alvo.
   *
   * Vive no Shell, e não num painel, porque o painel que a originou ACABOU DE
   * FECHAR — a camada cobria o inventário. Ela é a única coisa na tela que
   * lembra o jogador do que ele está no meio de fazer, e a única saída.
   */
  private faixaSelecao: HTMLElement | null = null;
  private resultadoHost: HTMLElement | null = null;
  private aoTeclar: ((e: KeyboardEvent) => void) | null = null;
  /** Marcos já vistos no save atual: evita repetir o anúncio a cada re-render. */
  private readonly unlocksAnunciados = new Set<string>();

  private readonly resourceNodes = new Map<ResourceId, HTMLElement>();
  private leftRail!: LeftRail;
  private anatomia!: Anatomia;
  private tabBar!: HTMLElement;
  private panelHost!: HTMLElement;
  private statusNode!: HTMLElement;
  private toastHost!: HTMLElement;
  private labToolbar!: HTMLElement;
  /** HUD independente dos trilhos: continua visível no modo de combate amplo. */
  private missionHud!: HTMLElement;
  private perfil!: PerfilMenu;

  constructor(
    private readonly root: HTMLElement,
    private readonly sim: Sim,
  ) {}

  /** Monta o esqueleto e devolve o canvas para o modo de jogo. */
  build(): { stage: HTMLCanvasElement; stageWrap: HTMLElement } {
    document.documentElement.dataset.contrast = this.sim.state.settings.highContrast ? 'high' : '';
    const stage = h('canvas#stage', {
      role: 'img', tabindex: '0',
      'aria-label': 'Campo de combate. Em controle manual, mova a nave com WASD ou as setas.',
    }) as HTMLCanvasElement;
    this.missionHud = h('.mission-hud', { 'aria-label': 'Missões rastreadas' });
    const stageWrap = h('.stage-wrap', {}, stage, this.missionHud);

    this.leftRail = new LeftRail(this.sim);
    this.perfil = new PerfilMenu(this.sim);
    this.anatomia = new Anatomia(this.sim);
    this.tabBar = h('nav.tabs', { 'aria-label': 'Navegação principal' });
    this.panelHost = h('.panel-host');
    this.statusNode = h('.status');
    this.toastHost = h('.toasts', { 'aria-live': 'polite', 'aria-atomic': 'false' });
    this.labToolbar = h('.lab-toolbar');

    const topbar = h('header.topbar', {},
      h('.brand', {},
        h('span.brand-mark', { text: 'ØZ' }),
        h('.brand-text', {},
          h('strong', { text: 'ÓRBITA ZERO' }),
          this.statusNode,
        ),
      ),
      // O perfil fica colado na marca, no canto que o olho já usa para
      // "quem sou eu aqui" em qualquer aplicativo. À direita ele disputaria
      // com os recursos, que mudam sozinhos e puxam a atenção o tempo todo.
      this.perfil.root,
      // As abas moram na barra de cima, como num painel de nave: o eixo
      // horizontal é o que sobra numa tela larga, e libera a coluna direita
      // inteira para o inventário ficar SEMPRE à vista — que é o que se
      // consulta o tempo todo enquanto se joga.
      this.tabBar,
      h('.topbar-right', {},
        h('.resources', {}, ...RESOURCE_IDS.map((id) => {
          const meta = RESOURCE_META[id];
          const value = h('strong.res-value', { text: '0', style: { color: meta.color } });
          this.resourceNodes.set(id, value);
          return h('.res', { title: meta.label }, spriteIcon(meta.icon, 22), value);
        })),
        h('button.gear', {
          title: 'Configurações',
          'aria-label': 'Abrir configurações',
          onclick: () => this.openSettings(),
        }, spriteIcon('geral/b_1', 24)),
      ),
    );

    clear(this.root).append(
      topbar,
      h('main.layout', {},
        this.leftRail.root,
        h('.center', {}, stageWrap),
        // A coluna de anatomia fica ENTRE o palco e o inventário: equipar é
        // arrastar de um para o outro, e distância entre eles é atrito puro.
        this.anatomia.root,
        h('aside.rail-right', {}, this.panelHost),
      ),
      this.toastHost,
      this.labToolbar,
    );

    this.buildTabs();
    this.registrarMarcosAtuais();
    this.updateMissionHud();
    this.wireEvents();
    this.renderPanel();
    const calibrationNotice = consumeCalibrationNotice();
    if (calibrationNotice) queueMicrotask(() => bus.emit('toast', { text: calibrationNotice, kind: 'good' }));

    return { stage, stageWrap };
  }

  private buildTabs(): void {
    clear(this.tabBar);
    for (const panel of this.panels) {
      // O inventário não tem aba: ele nunca sai da tela.
      if (panel === this.painelFixo) continue;
      const unlock = this.unlockDaTela(panel);
      const locked = !!unlock && !this.temAcessoAoPainel(panel, unlock);
      const badge = panel.badge?.(this.sim) ?? 0;
      const tab = h(`button.tab${panel === this.active ? '.active' : ''}${locked ? '.locked' : ''}`, {
        title: locked ? `${panel.title} · libera na patente ${unlock!.level}` : panel.title,
        'aria-label': panel.title,
        'aria-current': panel === this.active ? 'page' : undefined,
        'aria-disabled': locked ? 'true' : undefined,
        onclick: () => {
          if (locked) { this.avisarPainelBloqueado(panel, unlock!); return; }
          this.active = panel;
          this.dirty = true;
          this.buildTabs();
          this.renderPanel();
        },
      },
        panel.iconUrl
          ? h('img.tab-art', { src: panel.iconUrl, alt: '', 'aria-hidden': true, draggable: false })
          : spriteIcon(panel.icon, 22),
        h('span.tab-label', { text: panel.title }),
        locked ? h('span.tab-lock', { text: `Nv ${unlock!.level}`, 'aria-hidden': true })
          : badge > 0 ? h('span.badge', { text: badge > 99 ? '99+' : String(badge) }) : null,
      );
      this.tabBar.append(tab);
    }
    this.tabBar.onkeydown = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const tabs = Array.from(this.tabBar.querySelectorAll<HTMLButtonElement>('button.tab'));
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0 || !tabs.length) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
        : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
    };
  }

  private unlockDaTela(panel: Panel): ScreenUnlock | undefined {
    return screenUnlockFor(panel.id);
  }

  private temAcessoAoPainel(panel: Panel, unlock = this.unlockDaTela(panel)): boolean {
    return !unlock || this.sim.nivelLiberado >= unlock.level;
  }

  private avisarPainelBloqueado(panel: Panel, unlock: ScreenUnlock): void {
    const faltam = Math.max(0, unlock.level - this.sim.nivelLiberado);
    bus.emit('toast', {
      text: `${panel.title} libera na patente ${unlock.level} · faltam ${faltam} ${faltam === 1 ? 'nível' : 'níveis'}`,
      kind: 'info',
    });
  }

  private registrarMarcosAtuais(): void {
    for (const panel of this.panels) if (this.temAcessoAoPainel(panel)) this.unlocksAnunciados.add(panel.id);
  }

  private anunciarNovosMarcos(): void {
    for (const panel of this.panels) {
      const unlock = this.unlockDaTela(panel);
      if (!unlock || !this.temAcessoAoPainel(panel, unlock) || this.unlocksAnunciados.has(panel.id)) continue;
      this.unlocksAnunciados.add(panel.id);
      bus.emit('toast', { text: `${panel.title} liberada · Patente ${unlock.level}`, kind: 'epic', icon: panel.icon });
    }
  }

  private wireEvents(): void {
    bus.on('state:changed', () => { this.dirty = true; this.anunciarNovosMarcos(); });
    bus.on('resources:changed', () => this.updateResources());

    bus.on('toast', ({ text, kind, icon }) => this.pushToast(text, kind ?? 'info', icon));

    bus.on('panel:open', ({ id, galaxy }) => {
      const panel = this.panels.find((p) => p.id === id);
      if (!panel) return;
      const unlock = this.unlockDaTela(panel);
      if (unlock && !this.temAcessoAoPainel(panel, unlock)) { this.avisarPainelBloqueado(panel, unlock); return; }
      if (panel instanceof RankingPanel && galaxy !== undefined) panel.abrirPlacarDaGalaxia(galaxy);
      this.active = panel;
      this.dirty = true;
      this.buildTabs();
      this.renderPanel();
    });
    bus.on('panel:close', () => this.voltarDaCamada());
    bus.on('state:changed', () => this.atualizarFaixaDeSelecao());
    bus.on('laboratorio:changed', () => {
      this.dirty = true;
      this.updateLaboratorioToolbar();
    });

    bus.on('loot:dropped', ({ item }) => {
      if (item.rarity < 2) return;
      const info = rarityInfo(item.rarity);
      this.pushToast(`${itemName(item)} · ${info.name}`, item.rarity >= 4 ? 'epic' : 'good', item.icon);
    });

    bus.on('sector:advanced', ({ sector }) => this.pushToast(`Setor ${sector} liberado`, 'good', 'ui/icon_star'));
    bus.on('boss:defeated', ({ name }) => this.pushToast(`${name} destruído`, 'epic', 'fx/blast_fire_3'));
    // As telas de vitoria e derrota da Provacao vivem AQUI, e nao no painel: a
    // luta acontece com o painel fechado, e o resultado tem de aparecer sobre o
    // jogo. Os dois eventos caem no mesmo lugar porque o que muda entre eles e
    // o conteudo, nao a moldura.
    bus.on('provacao:iniciado', () => this.voltarDaCamada());
    bus.on('provacao:vencido', () => this.mostrarResultadoDaProvacao());
    bus.on('provacao:falhou', () => this.mostrarResultadoDaProvacao());

    bus.on('chest:granted', ({ tier, source }) => this.pushToast(`Baú ${tier}${source ? ` · ${source}` : ''}`, 'good', 'ui/icon_coin'));
  }

  update(dt: number): void {
    this.leftRail.update(dt);
    this.anatomia.update(dt);
    this.panelTimer -= dt;
    if (this.panelTimer <= 0) {
      this.panelTimer = 1 / PANEL_HZ;
      if (this.dirty) {
        this.dirty = false;
        this.renderPanel();
        this.buildTabs();
      }
      this.updateStatus();
      this.updateLaboratorioToolbar();
      this.updateMissionHud();
    }
    this.updateResources();
  }

  private updateLaboratorioToolbar(): void {
    if (!this.labToolbar) return;
    const lab = this.sim.laboratorio;
    this.labToolbar.classList.toggle('visible', lab.active);
    if (!lab.active) { clear(this.labToolbar); return; }
    const m = lab.metrics;
    const dps = m.playerDamage / Math.max(.01, m.elapsed);
    const c = lab.config;
    const target = c.hitboxTarget;
    const width = target === 'player' ? c.playerHitboxWidth : c.enemyHitboxWidth;
    const height = target === 'player' ? c.playerHitboxHeight : c.enemyHitboxHeight;
    const offsetX = target === 'player' ? c.playerHitboxOffsetX : c.enemyHitboxOffsetX;
    const offsetY = target === 'player' ? c.playerHitboxOffsetY : c.enemyHitboxOffsetY;
    const hitboxNumber = (value: number) => value.toFixed(1).replace(/\.0$/, '');
    const nudge = (axis: 'width' | 'height' | 'offsetX' | 'offsetY', delta: number) =>
      this.sim.ajustarHitboxLaboratorio(target, axis, delta);
    const save = (): void => {
      if (target === 'player') {
        void writeHitboxCalibration('save', 'player', c.playerHullId, { width, height, offsetX, offsetY }, c.playerSpriteScale);
        return;
      }
      const [kind, id] = c.enemyHitboxKey.split(':') as ['enemy' | 'boss', string];
      if (id) void writeHitboxCalibration('save', kind, id, { width, height, offsetX, offsetY }, c.enemySpriteScale);
    };
    clear(this.labToolbar).append(
      h('.lab-toolbar-title', {}, h('strong', { text: 'LAB' }), h('span', { text: lab.paused ? 'PAUSADO' : 'EM EXECUÇÃO' })),
      h('.lab-metric', {}, h('span', { text: 'Tempo' }), h('strong', { text: duration(m.elapsed) })),
      h('.lab-metric', {}, h('span', { text: 'DPS' }), h('strong', { text: fmt(dps, 1) })),
      h('.lab-metric', {}, h('span', { text: 'Acertos' }), h('strong', { text: `${m.playerHits}/${m.playerShots}` })),
      h('.lab-metric', {}, h('span', { text: 'Abates' }), h('strong', { text: String(m.kills) })),
      h('.lab-metric', {}, h('span', { text: 'Recebido' }), h('strong', { text: fmt(m.enemyDamage, 0) })),
      h('.lab-metric', {}, h('span', { text: 'Mortes' }), h('strong', { text: String(m.deaths) })),
      h('.lab-hitbox-live', {},
        h('.lab-hitbox-targets', {},
          h(`button.mini${target === 'player' ? '.active' : ''}`, { text: 'JOG', title: 'Editar a nave do jogador', onclick: () => this.sim.atualizarLaboratorio({ hitboxTarget: 'player', showHitboxes: true }) }),
          h(`button.mini${target === 'enemy' ? '.active' : ''}`, { text: 'INIM', title: 'Editar a nave inimiga', onclick: () => this.sim.atualizarLaboratorio({ hitboxTarget: 'enemy', showHitboxes: true }) }),
        ),
        h('span', { text: `${target === 'player' ? 'JOGADOR' : 'INIMIGO'} ${hitboxNumber(width)}×${hitboxNumber(height)} · ${hitboxNumber(offsetX)},${hitboxNumber(offsetY)}` }),
        h('.lab-hitbox-buttons', {},
          h('button.mini', { text: 'W−', title: 'Diminuir largura', onclick: () => nudge('width', -2) }),
          h('button.mini', { text: 'W+', title: 'Aumentar largura', onclick: () => nudge('width', 2) }),
          h('button.mini', { text: 'H−', title: 'Diminuir altura', onclick: () => nudge('height', -2) }),
          h('button.mini', { text: 'H+', title: 'Aumentar altura', onclick: () => nudge('height', 2) }),
          h('button.mini', { text: '←', title: 'Mover para a esquerda', onclick: () => nudge('offsetX', -2) }),
          h('button.mini', { text: '→', title: 'Mover para a direita', onclick: () => nudge('offsetX', 2) }),
          h('button.mini', { text: '↑', title: 'Mover para cima', onclick: () => nudge('offsetY', -2) }),
          h('button.mini', { text: '↓', title: 'Mover para baixo', onclick: () => nudge('offsetY', 2) }),
          h('button.mini.save', {
            text: 'Gravar',
            disabled: !LAB_CODE_WRITE_AVAILABLE || (target === 'enemy' && !c.enemyHitboxKey),
            title: 'Gravar esta hitbox diretamente no código do jogo',
            onclick: save,
          }),
        ),
      ),
      h('.lab-toolbar-actions', {},
        h('button.mini', { text: 'Configurar', onclick: () => bus.emit('panel:open', { id: 'laboratorio' }) }),
        h('button.mini', { text: lab.paused ? 'Continuar' : 'Pausar', onclick: () => this.sim.alternarPausaLaboratorio() }),
        h('button.mini', { text: '1 quadro', onclick: () => this.sim.avancarLaboratorio() }),
        h('button.mini', { text: 'Reiniciar', onclick: () => this.sim.reiniciarLaboratorio() }),
        h('button.mini.danger', { text: 'Sair', onclick: () => this.sim.pararLaboratorio() }),
      ),
    );
  }

  /**
   * Missões rastreadas vivem SOBRE o campo de combate, não só no trilho.
   *
   * Em tela ampla o cockpit é útil; em capturas, tela cheia e layouts estreitos
   * ele pode ficar fora da área visível. Este HUD é a fonte de leitura durante
   * a luta e é atualizado em baixa frequência para refletir cada objetivo.
   */
  private updateMissionHud(): void {
    if (!this.missionHud) return;
    const sim = this.sim;
    const tracked = sim.state.settings.pinnedMissions
      .map((id) => MISSAO_POR_ID.get(id))
      .filter((def): def is NonNullable<typeof def> => !!def)
      .filter((def) => {
        const status = situacaoDe(sim.state, def, sim.alcanceLiberado);
        return status === 'ativa' || status === 'pronta';
      });

    this.missionHud.classList.toggle('visible', tracked.length > 0 && !sim.laboratorio.active);
    if (!tracked.length || sim.laboratorio.active) {
      clear(this.missionHud);
      return;
    }

    clear(this.missionHud).append(
      ...tracked.map((def) => {
        const progress = progressoDe(sim.state, def);
        const fraction = fracaoDe(sim.state, def);
        const status = situacaoDe(sim.state, def, sim.alcanceLiberado);
        const objective = def.objetivos[0]!;
        const done = Math.min(objective.alvo, progress.passos[0] ?? 0);
        return h(`.mission-hud-entry${status === 'pronta' ? '.ready' : ''}`, {},
          h('strong', { text: def.nome }),
          h('.mission-hud-progress', {},
            h('span', { text: def.objetivos.length > 1 ? `${objective.texto} +${def.objetivos.length - 1}` : objective.texto }),
            h('b', { text: status === 'pronta' ? 'PRONTA' : `${fmt(done)}/${fmt(objective.alvo)}` }),
          ),
          h('.mission-hud-bar', {}, h('i', { style: { width: `${fraction * 100}%` } })),
        );
      }),
    );
  }

  /**
   * A coluna direita é o INVENTÁRIO, sempre.
   *
   * Ele deixou de ser uma aba entre outras porque não é uma tela que se visita:
   * é o que se consulta enquanto se joga, a cada drop. As demais telas abrem em
   * camada por cima, disparadas pelas abas da barra de cima.
   */
  private renderPanel(): void {
    const fixo = this.painelFixo;
    clear(this.panelHost).append(
      h('.panel-head', {}, h('h1', { text: fixo.title })),
      fixo.render(this.sim),
    );

    // A camada segue o painel ATIVO, que é o que a aba escolheu. Quando o ativo
    // é o próprio inventário, não há camada nenhuma.
    if (this.active !== fixo) this.abrirCamada();
    else this.fecharCamada();
  }

  /** O painel que mora na coluna direita. */
  private get painelFixo(): Panel {
    return this.panels.find((p) => p.id === 'inventario') ?? this.panels[0]!;
  }

  private atualizarFaixaDeSelecao(): void {
    const s = selecaoPendente();
    if (!s) {
      this.faixaSelecao?.remove();
      this.faixaSelecao = null;
      return;
    }
    if (!this.faixaSelecao) {
      this.faixaSelecao = h('.selecao-faixa');
      this.root.append(this.faixaSelecao);
    }
    // Duas fases numa faixa só. Separar em dois lugares faria o jogador
    // procurar a segunda pergunta depois de responder a primeira.
    clear(this.faixaSelecao).append(
      ...(s.elemento
        ? [
            h('span.selecao-selo', { text: 'ESCOLHA A PEÇA' }),
            h('span', { text: `Clique na peça que vai virar ${getElement(s.elemento).name.toLowerCase()}` }),
          ]
        : [
            h('span.selecao-selo', { text: s.nome.toUpperCase() }),
            h('span', { text: 'Converter para' }),
            h('.selecao-elementos', {}, ...ELEMENTS.map((el) => h('button.chip', {
              text: el.name,
              style: { color: el.color } as Partial<CSSStyleDeclaration>,
              onclick: () => escolherElemento(el.id),
            }))),
          ]),
      h('button.mini', { text: 'Cancelar', onclick: () => encerrarSelecao() }),
    );
  }

  /** Monta (ou re-renderiza) a camada do painel ativo. */
  private abrirCamada(): void {
    const painel = this.active;
    if (!this.camadaHost) {
      this.camadaHost = h('.camada');
      // Clicar o fundo fecha. O conteúdo para a propagação, senão qualquer
      // clique dentro dele — pôr uma peça no anel, por exemplo — fecharia junto.
      this.camadaHost.addEventListener('click', (e) => {
        if (e.target === this.camadaHost) this.voltarDaCamada();
      });
      this.root.append(this.camadaHost);
      // Esc fecha, que é o que todo mundo tenta primeiro.
      this.aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') this.voltarDaCamada(); };
      window.addEventListener('keydown', this.aoTeclar);
    }
    // A casca da camada é comum, mas cada tela recebe uma assinatura estável
    // para o CSS aplicar o mesmo kit visual sem depender da estrutura interna
    // (a Matriz, por exemplo, nem usa `.panel-body`).
    this.camadaHost.dataset.tela = painel.id;

    clear(this.camadaHost).append(
      h('.camada-caixa', { role: 'dialog', 'aria-modal': 'true', 'aria-label': painel.title },
        h('.camada-topo', {},
          h('h1', { text: painel.title }),
          h('button.camada-x', { text: '✕', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => this.voltarDaCamada() }),
        ),
        painel.render(this.sim),
      ),
    );
  }

  private fecharCamada(): void {
    if (!this.camadaHost) return;
    this.camadaHost.remove();
    this.camadaHost = null;
    if (this.aoTeclar) window.removeEventListener('keydown', this.aoTeclar);
    this.aoTeclar = null;
  }

  /** Fecha a camada e volta para o primeiro painel que não é de camada. */
  private voltarDaCamada(): void {
    this.fecharCamada();
    this.active = this.painelFixo;
    this.buildTabs();
    this.renderPanel();
  }

  private updateResources(): void {
    for (const id of RESOURCE_IDS) {
      const node = this.resourceNodes.get(id);
      if (node) node.textContent = fmt(this.sim.state.resources[id]);
    }
  }

  private updateStatus(): void {
    if (this.sim.laboratorio.active) {
      this.statusNode.textContent = 'Laboratório isolado · progresso e save suspensos';
      return;
    }
    const st = this.sim.state;
    const info = describeGalaxy(galaxyOfSector(st.run.sector));
    this.statusNode.textContent = [
      `${info.name} · fase ${phaseOfSector(st.run.sector)}`,
      `Setor ${st.run.sector}`,
      this.sim.encounterLabel,
      `Patente ${st.command.nivel}`,
    ].join('  ·  ');
  }

  /** Abre a tela de resultado da Provacao, se houver uma para mostrar. */
  private mostrarResultadoDaProvacao(): void {
    const r = this.sim.resultadoProvacao;
    if (!r) return;
    this.resultadoHost?.remove();

    const fechar = () => {
      this.resultadoHost?.remove();
      this.resultadoHost = null;
      this.sim.resultadoProvacao = null;
    };
    this.resultadoHost = montarResultadoDaProvacao(this.sim, r, fechar);
    this.root.append(this.resultadoHost);
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
      h('.modal.modal-wide.menu-settings', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Configurações' },
        h('.modal-head', {},
          h('h2', { text: 'Configurações' }),
          h('button.modal-close', { text: '✕', 'aria-label': 'Fechar configurações', onclick: () => close() }),
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
