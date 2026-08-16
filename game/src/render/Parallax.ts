import { assets, type ParallaxLayerInfo } from './Assets';
import type { Surface } from './Surface';

export interface LayerConfig {
  /** Chave do arquivo dentro do bioma (ex.: `moon_back`). */
  key: string;
  /** Fator de rolagem: 0 = parado, 1 = acompanha a nave. */
  speed: number;
  /** Alinhamento vertical: 0 = topo, 1 = base. */
  align?: number;
  alpha?: number;
  /** Se falso, desenha uma vez sem repetir (luas, planetas). */
  repeat?: boolean;
  /** Deslocamento vertical extra, em px lógicos. */
  offsetY?: number;
  tint?: string;
}

interface Layer extends LayerConfig {
  info: ParallaxLayerInfo;
  image: HTMLImageElement;
}

/**
 * Fundo em camadas com rolagem horizontal infinita.
 *
 * As camadas são desenhadas em pixels de textura 1:1 e repetidas até cobrir a
 * largura — nada de `createPattern`, porque o pattern não respeita
 * `imageSmoothingEnabled: false` de forma consistente entre navegadores e
 * borra a pixel art.
 */
export class Parallax {
  private layers: Layer[] = [];
  private offset = 0;
  biome = '';

  /** Carrega um bioma e monta as camadas na ordem dada. */
  async load(biome: string, config: LayerConfig[]): Promise<void> {
    const infos = await assets.loadBiome(biome);
    const byKey = new Map(infos.map((i) => [i.key, i]));
    const layers: Layer[] = [];

    for (const cfg of config) {
      const info = byKey.get(cfg.key);
      const image = info && assets.peek(info.src);
      if (!info || !image) continue;
      layers.push({ repeat: true, align: 1, alpha: 1, offsetY: 0, ...cfg, info, image });
    }
    this.layers = layers;
    this.biome = biome;
  }

  get ready(): boolean {
    return this.layers.length > 0;
  }

  /** Avança a rolagem. `speed` em px lógicos por segundo. */
  update(dt: number, speed: number): void {
    this.offset += speed * dt;
    if (!Number.isFinite(this.offset)) this.offset = 0;
  }

  /**
   * @param viewH altura visível, em px lógicos.
   * @param zoom  aproximação. >1 amplia as camadas e ancora na base, o que
   *              aumenta o detalhe aparente e alarga o ladrilho — essencial na
   *              faixa horizontal, que é larga e baixa: sem isso a mesma lua
   *              apareceria quatro vezes na tela.
   */
  draw(s: Surface, viewH = s.height, zoom = 1): void {
    for (const layer of this.layers) {
      const img = layer.image;
      const scale = (viewH / layer.info.h) * zoom;
      const w = Math.max(1, Math.round(layer.info.w * scale));
      const h = Math.max(1, Math.round(layer.info.h * scale));
      const y = Math.round((viewH - h) * (layer.align ?? 1) + (layer.offsetY ?? 0));

      s.ctx.globalAlpha = layer.alpha ?? 1;

      if (layer.repeat === false) {
        // Corpos celestes: um só, cruzando a tela devagar e reaparecendo.
        const period = s.width + w * 2;
        const x = Math.round(s.width - (((this.offset * layer.speed) % period) + period) % period);
        s.ctx.drawImage(img, x, y, w, h);
      } else {
        let x = -(((this.offset * layer.speed) % w) + w) % w;
        while (x < s.width) {
          s.ctx.drawImage(img, Math.round(x), y, w, h);
          x += w;
        }
      }
      s.ctx.globalAlpha = 1;
    }
  }
}

/**
 * Campo de estrelas rolando na vertical, com repetição contínua.
 * Usado pela camada vertical, onde o cenário é espaço aberto.
 */
export class StarScroll {
  private offset = 0;
  /** Textura atual. Trocável em tempo de execução ao mudar de galáxia. */
  src: string;
  /** Tinta aplicada sobre as estrelas; vazio = sem tinta. */
  tint = '';

  private tinted: HTMLCanvasElement | null = null;
  private tintKey = '';

  constructor(
    src: string,
    public speed: number,
    public alpha = 1,
    public scale = 1,
  ) {
    this.src = src;
  }

  update(dt: number, worldSpeed: number): void {
    this.offset = (this.offset + worldSpeed * this.speed * dt) % 1e9;
  }

  draw(s: Surface): void {
    const img = this.texture();
    if (!img) return;

    const w = Math.max(1, Math.round(img.width * this.scale));
    const h = Math.max(1, Math.round(img.height * this.scale));
    const startY = -(((this.offset % h) + h) % h);

    s.ctx.globalAlpha = this.alpha;
    for (let y = startY; y < s.height; y += h) {
      for (let x = 0; x < s.width; x += w) {
        s.ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
      }
    }
    s.ctx.globalAlpha = 1;
  }

  /**
   * Textura já tingida, gerada uma vez por combinação imagem+cor.
   *
   * A tinta PRECISA ser aplicada fora da tela. Tentar `source-atop` direto no
   * canvas do jogo pinta tudo: esse modo respeita o alfa do destino inteiro, e
   * a essa altura o fundo da galáxia já deixou o canvas opaco — o resultado era
   * a cena inteira lavada de branco.
   */
  private texture(): HTMLImageElement | HTMLCanvasElement | null {
    const base = assets.peek(this.src);
    if (!base) return null;
    if (!this.tint) return base;

    const key = `${this.src}|${this.tint}`;
    if (this.tintKey === key && this.tinted) return this.tinted;

    const canvas = document.createElement('canvas');
    canvas.width = base.width;
    canvas.height = base.height;
    const g = canvas.getContext('2d');
    if (!g) return base;

    g.drawImage(base, 0, 0);
    // Aqui só as estrelas têm alfa, então `source-atop` colore apenas elas.
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.55;
    g.fillStyle = this.tint;
    g.fillRect(0, 0, canvas.width, canvas.height);

    this.tintKey = key;
    this.tinted = canvas;
    return canvas;
  }
}
