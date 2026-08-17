import { clamp, TAU } from '@core/math';
import { fmt } from '@core/format';
import { assets } from '@render/Assets';
import {
  BRANCHES, BRANCH_BY_ID, NODE_BY_ID, NODE_RADIUS, TREE_BOUNDS,
  TREE_EDGES, TREE_NODES, type TreeNode,
} from '@data/tree';
import { allocatedSet, frontier, pathTo, searchNodes, xpForLevel, custoDeNo } from '@sim/tree';
import type { Sim } from '@sim/index';
import { h, progressBar } from '../dom';
import type { Panel } from './types';

const MIN_ZOOM = 0.16;
const MAX_ZOOM = 1.5;

/**
 * Matriz de Comando — a árvore de passivas.
 *
 * Desenhada em canvas, e não em DOM, porque são ~250 nós e ~300 arestas com
 * pan e zoom contínuos: em DOM cada quadro viraria centenas de reflows.
 *
 * O elemento e a câmera vivem no painel e sobrevivem aos re-renders do Shell —
 * devolvemos sempre o mesmo nó raiz, então o navegador o move em vez de
 * recriá-lo, e o jogador não perde a posição da câmera a cada 200 ms.
 */
export class TreePanel implements Panel {
  id = 'matriz';
  title = 'Matriz';
  icon = 'aba/matriz';

  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tooltip: HTMLElement;
  private readonly header: HTMLElement;

  private sim!: Sim;
  private camX = 0;
  private camY = 0;
  private zoom = 0.3;
  private fitted = false;

  private dragging = false;
  private dragMoved = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDistance = 0;

  private hovered: TreeNode | null = null;
  private preview: string[] = [];
  private search = '';
  private matches = new Set<string>();
  private redrawQueued = false;
  private readonly iconCache = new Map<string, HTMLCanvasElement>();

  constructor() {
    this.canvas = h('canvas.tree-canvas') as HTMLCanvasElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponível para a matriz');
    this.ctx = ctx;

    this.tooltip = h('.tree-tip.hidden');
    this.header = h('.tree-header');
    this.root = h('.tree-root', {}, this.header, h('.tree-stage', {}, this.canvas, this.tooltip));

    this.bindPointer();
    new ResizeObserver(() => this.schedule()).observe(this.canvas);
  }

  /**
   * Agenda um redesenho, agrupando várias marcações no mesmo quadro.
   *
   * Sem laço permanente de `requestAnimationFrame`: a matriz é estática entre
   * interações, e manter um callback por quadro para um painel que quase sempre
   * está fechado é desperdício. O fallback em `setTimeout` cobre a aba oculta,
   * onde `requestAnimationFrame` nunca dispara.
   */
  private schedule(): void {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    const run = () => {
      this.redrawQueued = false;
      if (this.root.isConnected) this.draw();
    };
    if (document.hidden) setTimeout(run, 0);
    else requestAnimationFrame(run);
  }

  badge(sim: Sim): number {
    return sim.matrixPoints;
  }

  render(sim: Sim): HTMLElement {
    this.sim = sim;
    this.renderHeader();
    // Desenha já na montagem em vez de esperar o próximo quadro: o Shell anexa
    // este nó de forma síncrona, então no microtask o layout já está resolvido.
    queueMicrotask(() => {
      if (this.root.isConnected) this.draw();
    });
    return this.root;
  }

  // ── cabeçalho ─────────────────────────────────────────────────────────────

  private renderHeader(): void {
    const sim = this.sim;
    const cmd = sim.state.command;
    const points = sim.matrixPoints;

    this.header.replaceChildren(
      h('.tree-stats', {},
        h('.tree-points', {},
          h('strong', { text: String(points), style: { color: points > 0 ? '#ffe08a' : '#7f93b3' } }),
          h('span.muted.tiny', { text: points === 1 ? 'ponto livre' : 'pontos livres' }),
        ),
        h('.tree-level', {},
          h('span.muted.tiny', { text: `Patente ${cmd.nivel} · ${sim.matrixSpent} alocados` }),
          progressBar(sim.xpProgress, '#c060ff', 5),
          h('span.muted.tiny', { text: `${fmt(cmd.xp, 0)} / ${fmt(xpForLevel(cmd.nivel), 0)} XP` }),
        ),
      ),
      h('.tree-tools', {},
        h('input.select.tree-search', {
          type: 'search',
          placeholder: 'Buscar nó…',
          value: this.search,
          oninput: (e: Event) => {
            this.search = (e.target as HTMLInputElement).value;
            this.matches = new Set(searchNodes(this.search).map((n) => n.id));
            this.schedule();
          },
        }),
        h('button.mini', { text: 'Centralizar', onclick: () => { this.fit(); } }),
        h('button.mini.danger', {
          text: cmd.refunds > 0 ? `Refazer (${cmd.refunds})` : 'Refazer (25◆)',
          onclick: () => {
            if (sim.matrixSpent === 0) return;
            const cost = cmd.refunds > 0 ? 'um refaz gratuito' : '25 cristais';
            if (!confirm(`Devolver os ${sim.matrixSpent} pontos alocados? Custa ${cost}.`)) return;
            sim.respecMatrix();
            this.schedule();
          },
        }),
      ),
      h('.tree-legend', {}, ...BRANCHES.map((b) =>
        h('span.tree-legend-item', { style: { color: b.color } },
          h('i.dot', { style: { background: b.color } }),
          b.name,
        ),
      )),
    );
  }

  // ── interação ─────────────────────────────────────────────────────────────

  private bindPointer(): void {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.dragMoved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    c.addEventListener('pointermove', (e) => {
      if (this.dragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
        this.camX -= dx / this.zoom;
        this.camY -= dy / this.zoom;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.schedule();
        return;
      }
      this.updateHover(e);
    });

    const endDrag = (e: PointerEvent) => {
      if (this.dragging && !this.dragMoved) this.click(e);
      this.dragging = false;
    };
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', () => { this.dragging = false; });
    c.addEventListener('pointerleave', () => {
      this.hovered = null;
      this.preview = [];
      this.tooltip.classList.add('hidden');
      this.schedule();
    });

    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const node = this.nodeAt(e);
      if (node && this.sim?.deallocateNode(node.id)) this.schedule();
    });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Zoom ancorado no cursor: sem isso, aproximar joga o alvo para fora da tela.
      const rect = c.getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      const before = this.zoom;
      const next = clamp(this.zoom * (e.deltaY < 0 ? 1.16 : 1 / 1.16), MIN_ZOOM, MAX_ZOOM);
      this.camX += px / before - px / next;
      this.camY += py / before - py / next;
      this.zoom = next;
      this.schedule();
    }, { passive: false });

    // Pinça em touch.
    c.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (this.pinchDistance > 0) {
        this.zoom = clamp(this.zoom * (d / this.pinchDistance), MIN_ZOOM, MAX_ZOOM);
        this.schedule();
      }
      this.pinchDistance = d;
    }, { passive: false });
    c.addEventListener('touchend', () => { this.pinchDistance = 0; });
  }

  private click(e: PointerEvent): void {
    const node = this.nodeAt(e);
    if (!node || !this.sim) return;

    const allocated = allocatedSet(this.sim.state);
    if (allocated.has(node.id)) {
      if (e.shiftKey) this.sim.deallocateNode(node.id);
      this.schedule();
      return;
    }

    if (this.sim.canAllocate(node.id)) {
      this.sim.allocateNode(node.id);
    } else {
      // Nó distante: aloca a rota inteira de uma vez, se couber nos pontos.
      const path = pathTo(this.sim.state, node.id);
      if (path && path.length > 0 && path.length <= this.sim.matrixPoints) {
        this.sim.allocateRoute(node.id);
      }
    }
    this.schedule();
  }

  private updateHover(e: PointerEvent): void {
    const node = this.nodeAt(e);
    if (node === this.hovered) return;
    this.hovered = node;
    this.schedule();

    if (!node || !this.sim) {
      this.preview = [];
      this.tooltip.classList.add('hidden');
      return;
    }

    const allocated = allocatedSet(this.sim.state);
    this.preview = allocated.has(node.id) ? [] : (pathTo(this.sim.state, node.id) ?? []);
    this.showTooltip(node, e);
  }

  private showTooltip(node: TreeNode, e: PointerEvent): void {
    const sim = this.sim;
    const allocated = allocatedSet(sim.state).has(node.id);
    const branch = BRANCH_BY_ID.get(node.branch);
    // Soma o CUSTO dos nós do caminho, não a contagem. Com custo por
    // profundidade (nó de borda vale 3), contar nós dizia "clique para alocar
    // 4 nós" e o clique falhava por faltarem pontos — a UI mentia sobre o
    // preço.
    const cost = this.preview.reduce((s, id) => s + custoDeNo(id), 0);

    const kindLabel =
      node.kind === 'chave' ? 'NÓ-CHAVE' :
      node.kind === 'notavel' ? 'NOTÁVEL' :
      node.kind === 'inicio' ? 'NÚCLEO' : 'MENOR';

    const stats = node.stats.length
      ? h('.tip-stats', {}, ...node.stats.map((s) =>
          h('span', {
            text: formatModifier(s.stat, s.kind, s.value),
            style: { color: s.value < 0 ? '#ff8a9a' : '#9fe8ff' },
          }),
        ))
      : h('span.muted.tiny', { text: 'Sem atributos.' });

    this.tooltip.replaceChildren(
      h('.tip-head', {},
        h('strong', { text: node.name, style: { color: branch?.color ?? '#dfe8f6' } }),
        h('span.tip-kind', { text: kindLabel }),
      ),
      h('p.tip-desc', { text: node.desc }),
      stats,
      h('.tip-foot', {},
        allocated
          ? h('span.tip-ok', { text: 'Alocado · shift+clique para devolver' })
          : cost > 0
            ? h('span', {
                text: cost <= sim.matrixPoints
                  ? `Clique para alocar · ${cost} ${cost === 1 ? 'ponto' : 'pontos'}`
                  : `Faltam ${cost - sim.matrixPoints} pontos`,
                style: { color: cost <= sim.matrixPoints ? '#5ce08a' : '#ff8a9a' },
              })
            : h('span.muted', { text: 'Inalcançável' }),
      ),
    );

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.tooltip.classList.remove('hidden');
    // Vira o lado quando encosta na borda, para o tooltip nunca sair do painel.
    this.tooltip.style.left = `${x > rect.width - 260 ? x - 250 : x + 18}px`;
    this.tooltip.style.top = `${clamp(y - 40, 8, Math.max(8, rect.height - 200))}px`;
  }

  private nodeAt(e: { clientX: number; clientY: number }): TreeNode | null {
    const rect = this.canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left - rect.width / 2) / this.zoom + this.camX;
    const wy = (e.clientY - rect.top - rect.height / 2) / this.zoom + this.camY;

    let best: TreeNode | null = null;
    let bestDist = Infinity;
    for (const node of TREE_NODES) {
      const r = NODE_RADIUS[node.kind] + 8;
      const d = Math.hypot(node.x - wx, node.y - wy);
      if (d < r && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    return best;
  }

  private fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 10) return;
    const w = TREE_BOUNDS.maxX - TREE_BOUNDS.minX;
    const hgt = TREE_BOUNDS.maxY - TREE_BOUNDS.minY;
    this.zoom = clamp(Math.min(rect.width / w, rect.height / hgt) * 0.95, MIN_ZOOM, MAX_ZOOM);
    this.camX = (TREE_BOUNDS.minX + TREE_BOUNDS.maxX) / 2;
    this.camY = (TREE_BOUNDS.minY + TREE_BOUNDS.maxY) / 2;
    this.fitted = true;
    this.schedule();
  }

  // ── desenho ───────────────────────────────────────────────────────────────

  private draw(): void {
    if (!this.sim) return;
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    if (!this.fitted) this.fit();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(rect.width * dpr);
    const bh = Math.round(rect.height * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    const allocated = allocatedSet(this.sim.state);
    const reach = frontier(this.sim.state);
    const previewSet = new Set(this.preview);

    this.drawRings(ctx);
    this.drawEdges(ctx, allocated, previewSet);
    this.drawNodes(ctx, allocated, reach, previewSet);

    ctx.restore();
  }

  /** Anéis-guia concêntricos: dão profundidade e ajudam a ler a distância. */
  private drawRings(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(120,160,220,.07)';
    ctx.lineWidth = 2 / this.zoom;
    for (const r of [210, 375, 545, 725, 900]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
  }

  private drawEdges(ctx: CanvasRenderingContext2D, allocated: Set<string>, preview: Set<string>): void {
    for (const [a, b] of TREE_EDGES) {
      const na = NODE_BY_ID.get(a);
      const nb = NODE_BY_ID.get(b);
      if (!na || !nb) continue;

      const both = allocated.has(a) && allocated.has(b);
      const onPreview = (preview.has(a) || allocated.has(a)) && (preview.has(b) || allocated.has(b));

      if (both) {
        const branch = BRANCH_BY_ID.get(na.branch) ?? BRANCH_BY_ID.get(nb.branch);
        ctx.strokeStyle = branch?.color ?? '#9fe8ff';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.85;
      } else if (onPreview && preview.size > 0) {
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.8;
      } else {
        ctx.strokeStyle = '#3a4a66';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.55;
      }

      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawNodes(
    ctx: CanvasRenderingContext2D,
    allocated: Set<string>,
    reach: Set<string>,
    preview: Set<string>,
  ): void {
    const searching = this.matches.size > 0;

    for (const node of TREE_NODES) {
      const r = NODE_RADIUS[node.kind];
      const branch = BRANCH_BY_ID.get(node.branch);
      const color = branch?.color ?? '#9fe8ff';
      const isOn = allocated.has(node.id);
      const isNear = reach.has(node.id);
      const isPreview = preview.has(node.id);
      const isMatch = this.matches.has(node.id);
      const isHover = this.hovered?.id === node.id;

      // Durante uma busca, tudo que não casa desbota — é o único jeito de achar
      // um notável específico numa matriz com centenas de nós.
      const dim = searching && !isMatch ? 0.18 : 1;
      ctx.globalAlpha = isOn ? dim : dim * (isNear || isPreview ? 0.92 : 0.5);

      if (isOn || isPreview || isHover || isMatch) {
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.4);
        glow.addColorStop(0, isPreview ? 'rgba(255,224,138,.5)' : hexToRgba(color, 0.45));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.4, 0, TAU);
        ctx.fill();
      }

      // Fundo tingido pela ramificação: de longe o glifo some, e sem a cor a
      // matriz inteira vira um borrão cinza.
      ctx.fillStyle = '#080e1a';
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hexToRgba(color, isOn ? 0.32 : 0.1);
      ctx.fill();

      // O glifo só entra quando ficaria legível; abaixo disso é ruído caro.
      if (r * this.zoom > 7) this.drawIcon(ctx, node, r, color, isOn || isPreview);

      ctx.strokeStyle = isPreview ? '#ffe08a' : isOn ? color : isNear ? hexToRgba(color, 0.75) : '#33415c';
      ctx.lineWidth = node.kind === 'pequeno' ? 2.5 : 4;
      if (!isOn && isNear) ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // Nós grandes recebem rótulo a partir de certo zoom.
      if (node.kind !== 'pequeno' && this.zoom > 0.42) {
        ctx.globalAlpha = dim;
        ctx.font = `700 ${node.kind === 'chave' ? 15 : 13}px "Chakra Petch", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(0,0,0,.85)';
        ctx.fillText(node.name, node.x + 1, node.y + r + 7);
        ctx.fillStyle = isOn ? color : '#8ba0bd';
        ctx.fillText(node.name, node.x, node.y + r + 6);
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * As placas da folha de itens são molduras escuras com um glifo colorido
   * dentro — desenhadas cruas sobre o nó escuro elas somem. Aqui a silhueta é
   * recolorida para a cor da ramificação, o que dá contraste e ainda comunica
   * a que ramo o nó pertence.
   */
  private drawIcon(ctx: CanvasRenderingContext2D, node: TreeNode, r: number, color: string, bright: boolean): void {
    const found = assets.atlases.lookup(node.icon);
    if (!found) return;
    const { frame } = found;
    const tinted = this.tintedIcon(node.icon, bright ? color : '#8ba0bd');
    if (!tinted) return;

    const size = r * 1.55;
    const scale = Math.min(size / frame.w, size / frame.h);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * (bright ? 1 : 0.7);
    ctx.drawImage(
      tinted,
      node.x - (frame.w * scale) / 2,
      node.y - (frame.h * scale) / 2,
      frame.w * scale,
      frame.h * scale,
    );
    ctx.globalAlpha = prevAlpha;
  }

  /** Cache de silhuetas recoloridas: 9 glifos × poucas cores, gerado uma vez. */
  private tintedIcon(iconId: string, color: string): HTMLCanvasElement | null {
    const key = `${iconId}|${color}`;
    const cached = this.iconCache.get(key);
    if (cached) return cached;

    const found = assets.atlases.lookup(iconId);
    if (!found) return null;
    const { frame, atlas } = found;

    const canvas = document.createElement('canvas');
    canvas.width = frame.w;
    canvas.height = frame.h;
    const g = canvas.getContext('2d');
    if (!g) return null;

    g.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    // `source-atop` pinta só onde já há pixel, preservando o recorte do glifo.
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, frame.w, frame.h);

    this.iconCache.set(key, canvas);
    return canvas;
  }
}

function formatModifier(stat: string, kind: 'add' | 'mul', value: number): string {
  const label = STAT_LABEL[stat] ?? stat;
  const sign = value >= 0 ? '+' : '';
  if (kind === 'mul') return `${sign}${(value * 100).toFixed(0)}% ${label}`;
  if (PERCENT_STATS.has(stat)) return `${sign}${(value * 100).toFixed(1)}% ${label}`;
  return `${sign}${value % 1 === 0 ? value : value.toFixed(1)} ${label}`;
}

const PERCENT_STATS = new Set(['critChance', 'critDano', 'sorte', 'iaSkill']);

const STAT_LABEL: Record<string, string> = {
  dano: 'de dano',
  cadencia: 'de cadência',
  projeteis: 'projétil(is)',
  perfuracao: 'de perfuração',
  critChance: 'de chance de crítico',
  critDano: 'de dano crítico',
  explosao: 'de raio de explosão',
  vida: 'de casco',
  escudo: 'de escudo',
  regen: 'de regeneração',
  velocidade: 'de manobra',
  iaSkill: 'de sincronia do piloto',
  sorte: 'de sorte',
  sucataGanho: 'de sucata',
  nucleoGanho: 'de núcleos',
  xpGanho: 'de XP',
};

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
