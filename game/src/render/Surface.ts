import { assets } from './Assets';
import type { Frame } from './Atlas';

export interface DrawOptions {
  /** Escala uniforme (ou por eixo, com `scaleY`). */
  scale?: number;
  scaleY?: number;
  rotation?: number;
  alpha?: number;
  /** Pivô normalizado dentro da caixa original. `[0.5, 0.5]` = centro. */
  anchorX?: number;
  anchorY?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Sobrepõe o sprite com esta cor (dano, congelamento, marcação). */
  tint?: string;
  tintAlpha?: number;
  composite?: GlobalCompositeOperation;
}

/**
 * Canvas + contexto 2D com DPR e o modo pixelado sempre ligados.
 *
 * O jogo trabalha num espaço lógico fixo (ex.: 540×960 na vertical); o
 * `Surface` cuida do backing store em pixels de dispositivo e da matriz de
 * escala, então nenhum código de jogo precisa saber sobre `devicePixelRatio`.
 */
export class Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Dimensões no espaço lógico do jogo. */
  width = 0;
  height = 0;
  /** Escala de lógico → CSS px aplicada no último `resize`. */
  scale = 1;
  dpr = 1;

  private readonly tintCanvas = document.createElement('canvas');
  private readonly tintCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) throw new Error('canvas 2d indisponível');
    this.ctx = ctx;
    this.tintCtx = this.tintCanvas.getContext('2d', { willReadFrequently: false })!;
  }

  /**
   * Ajusta o backing store. `logicalW/H` é o espaço em que o jogo desenha;
   * `cssW/H` é o tamanho real do elemento.
   */
  resize(cssW: number, cssH: number, logicalW: number, logicalH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = logicalW;
    this.height = logicalH;
    this.scale = cssW / logicalW;

    const bw = Math.max(1, Math.round(cssW * this.dpr));
    const bh = Math.max(1, Math.round(cssH * this.dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Reinicia a transformação para o espaço lógico e limpa (ou não) o quadro. */
  begin(clear = true): void {
    const { ctx } = this;
    const sx = this.canvas.width / this.width;
    const sy = this.canvas.height / this.height;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    if (clear) ctx.clearRect(0, 0, this.width, this.height);
  }

  fill(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Desenha um quadro do atlas pelo id global. Silencioso se o id não existir. */
  sprite(id: string, x: number, y: number, opts: DrawOptions = {}): void {
    const found = assets.atlases.lookup(id);
    if (!found) return;
    this.frame(found.frame, found.atlas.image, x, y, opts);
  }

  frame(
    f: Frame,
    image: CanvasImageSource,
    x: number,
    y: number,
    { scale = 1, scaleY, rotation = 0, alpha = 1, anchorX = 0.5, anchorY = 0.5, flipX, flipY, tint, tintAlpha = 1, composite }: DrawOptions = {},
  ): void {
    if (alpha <= 0.002) return;
    const { ctx } = this;
    const sx = scale;
    const sy = scaleY ?? scale;

    // Posição do recorte relativa ao pivô, ainda em px da folha original.
    const dx = f.ox - f.sw * anchorX;
    const dy = f.oy - f.sh * anchorY;

    const simple = rotation === 0 && !flipX && !flipY && sx === 1 && sy === 1;
    const prevAlpha = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
    if (composite) ctx.globalCompositeOperation = composite;

    const src = tint ? this.tinted(f, image, tint, tintAlpha) : image;
    const srcX = tint ? 0 : f.x;
    const srcY = tint ? 0 : f.y;

    if (simple) {
      ctx.drawImage(src, srcX, srcY, f.w, f.h, Math.round(x + dx), Math.round(y + dy), f.w, f.h);
    } else {
      ctx.save();
      ctx.translate(x, y);
      if (rotation) ctx.rotate(rotation);
      ctx.scale(flipX ? -sx : sx, flipY ? -sy : sy);
      ctx.drawImage(src, srcX, srcY, f.w, f.h, dx, dy, f.w, f.h);
      ctx.restore();
    }

    if (composite) ctx.globalCompositeOperation = 'source-over';
    if (alpha !== 1) ctx.globalAlpha = prevAlpha;
  }

  /**
   * Recolore um quadro num canvas auxiliar usando `source-atop`, preservando o
   * alpha do sprite. Reusa o mesmo canvas a cada chamada: só um sprite tingido
   * existe por vez durante um `drawImage`, então não há conflito.
   */
  private tinted(f: Frame, image: CanvasImageSource, color: string, strength: number): HTMLCanvasElement {
    const { tintCanvas: c, tintCtx: g } = this;
    if (c.width < f.w || c.height < f.h) {
      c.width = Math.max(c.width, f.w);
      c.height = Math.max(c.height, f.h);
    }
    g.clearRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = strength;
    g.fillStyle = color;
    g.fillRect(0, 0, f.w, f.h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    return c;
  }

  // ── primitivas de apoio ───────────────────────────────────────────────────

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  circle(x: number, y: number, r: number, color: string, composite?: GlobalCompositeOperation): void {
    const { ctx } = this;
    if (composite) ctx.globalCompositeOperation = composite;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (composite) ctx.globalCompositeOperation = 'source-over';
  }

  /** Halo radial aditivo — usado em impactos, motores e auras de chefe. */
  glow(x: number, y: number, r: number, color: string, alpha = 1): void {
    if (r <= 0 || alpha <= 0.002) return;
    const { ctx } = this;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  text(str: string, x: number, y: number, opts: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; shadow?: string } = {}): void {
    const { ctx } = this;
    const { size = 12, color = '#fff', align = 'left', weight = 700, shadow } = opts;
    ctx.font = `${weight} ${size}px "Rajdhani", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
}
