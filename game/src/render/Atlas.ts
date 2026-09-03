/** `[x, y, w, h, offsetX, offsetY, sourceW, sourceH]` — formato compacto do pipeline. */
export type FrameTuple = [number, number, number, number, number, number, number, number];

export interface AtlasData {
  image: string;
  w: number;
  h: number;
  frames: Record<string, FrameTuple>;
}

export interface Frame {
  readonly id: string;
  /** Retângulo dentro da textura do atlas. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Deslocamento do conteúdo recortado dentro da caixa original. */
  readonly ox: number;
  readonly oy: number;
  /** Caixa original, antes do auto-trim — é ela que define o pivô. */
  readonly sw: number;
  readonly sh: number;
}

/**
 * Textura empacotada + índice de quadros.
 *
 * Todo sprite é desenhado com pivô no CENTRO da caixa original (`sw`/`sh`), não
 * do recorte. Sem isso, uma animação de explosão cujos quadros têm bordas
 * transparentes diferentes "pularia" de posição a cada quadro.
 */
export class Atlas {
  readonly frames = new Map<string, Frame>();

  constructor(
    readonly name: string,
    readonly image: HTMLImageElement | ImageBitmap,
    data: AtlasData,
  ) {
    for (const [id, t] of Object.entries(data.frames)) {
      this.frames.set(id, { id, x: t[0], y: t[1], w: t[2], h: t[3], ox: t[4], oy: t[5], sw: t[6], sh: t[7] });
    }
  }

  get(id: string): Frame | undefined {
    return this.frames.get(id);
  }

  has(id: string): boolean {
    return this.frames.has(id);
  }

  /** Todos os ids que começam com `prefix`, em ordem natural (…_2 antes de …_10). */
  sequence(prefix: string): string[] {
    const out: string[] = [];
    for (const id of this.frames.keys()) if (id.startsWith(prefix)) out.push(id);
    return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
}

/** Registro de todos os atlas carregados, com resolução de id global. */
export class AtlasSet {
  private readonly byName = new Map<string, Atlas>();
  private readonly index = new Map<string, { atlas: Atlas; frame: Frame; priority: number }>();

  /**
   * Registra um atlas com precedência estável.
   *
   * Alguns packs históricos ainda compartilham ids. Como os downloads podem
   * terminar em qualquer ordem, a prioridade precisa vir do manifesto — usar
   * a ordem de conclusão faria o sprite escolhido variar com rede e cache.
   */
  add(atlas: Atlas, priority = Number.MAX_SAFE_INTEGER): void {
    this.byName.set(atlas.name, atlas);
    for (const frame of atlas.frames.values()) {
      const current = this.index.get(frame.id);
      if (!current || priority < current.priority) {
        this.index.set(frame.id, { atlas, frame, priority });
      }
    }
  }

  atlas(name: string): Atlas | undefined {
    return this.byName.get(name);
  }

  lookup(id: string): { atlas: Atlas; frame: Frame } | undefined {
    const found = this.index.get(id);
    return found ? { atlas: found.atlas, frame: found.frame } : undefined;
  }

  /** Ids ordenados naturalmente com um prefixo — base para montar clipes. */
  sequence(prefix: string): string[] {
    const out: string[] = [];
    for (const id of this.index.keys()) if (id.startsWith(prefix)) out.push(id);
    return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  has(id: string): boolean {
    return this.index.has(id);
  }
}
