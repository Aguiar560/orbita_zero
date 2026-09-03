import { Atlas, AtlasSet, type AtlasData } from './Atlas';

export interface ManifestImage {
  src: string;
  w: number;
  h: number;
}

export interface ParallaxLayerInfo {
  key: string;
  src: string;
  w: number;
  h: number;
}

export interface Manifest {
  version: number;
  generated: string;
  atlases: { name: string; image: string; data: string; w: number; h: number; count: number; lazy?: boolean }[];
  images: Record<string, ManifestImage>;
  parallax: Record<string, ParallaxLayerInfo[]>;
  deepspace: ParallaxLayerInfo[];
  /** Camadas tileáveis 320×320 do fundo da camada vertical. */
  skies: ParallaxLayerInfo[];
  /** Catálogo de campos de estrela; a cena escolhe dois por galáxia. */
  starfields: ParallaxLayerInfo[];
  /**
   * Cenários de galáxia da pasta `backgrounds` — 19 conjuntos.
   *
   * Dois formatos, porque a arte veio de packs diferentes: `parallax` tem três
   * camadas nomeadas, `chapado` tem de duas a cinco variações completas do
   * mesmo lugar. Uniformizar aqui seria mentir sobre o que existe — quem
   * consome escolhe o que fazer com cada um.
   */
  fundos?: (
    | { id: string; tipo: 'parallax'; camadas: { longe: string; nebulosa: string; estrelas: string } }
    | { id: string; tipo: 'chapado'; variacoes: string[] }
  )[];
}

const BASE = 'assets/';

/**
 * Carregador de assets.
 *
 * Os atlas são obrigatórios no boot (nada desenha sem eles). Parallax, planetas
 * e camadas de fundo são carregados sob demanda, porque o jogador só vê um
 * bioma por vez e baixar os quatro no boot atrasaria a primeira tela.
 */
export class Assets {
  readonly atlases = new AtlasSet();
  manifest!: Manifest;

  private readonly images = new Map<string, HTMLImageElement>();
  private readonly pending = new Map<string, Promise<HTMLImageElement>>();
  private readonly atlasJobs = new Map<string, Promise<void>>();

  async boot(onProgress?: (done: number, total: number, label: string) => void): Promise<void> {
    this.manifest = (await fetch(BASE + 'manifest.json').then((r) => {
      if (!r.ok) throw new Error(`manifest.json: ${r.status} — rode \`npm run assets\``);
      return r.json();
    })) as Manifest;

    const eager = this.manifest.atlases.filter((a) => !a.lazy);
    const total = eager.length + 2;
    let done = 0;
    const step = (label: string) => onProgress?.(++done, total, label);

    // Os atlas não dependem uns dos outros. Carregá-los em série somava uma
    // ida completa à rede para cada arquivo e deixava o placeholder
    // "Iniciando sistemas" parado mesmo em conexões rápidas. Mantemos o mesmo
    // conjunto obrigatório (portanto nenhum sprite passa a chegar atrasado),
    // mas abrimos os downloads em paralelo e avançamos o progresso conforme
    // cada um termina.
    await Promise.all(eager.map(async (entry) => {
      await this.loadAtlas(entry.name);
      step(`atlas ${entry.name}`);
    }));

    // Fundos da camada vertical: pequenos e sempre visíveis, valem o custo no boot.
    await Promise.all([
      ...(this.manifest.skies ?? []).map((s) => this.image(s.src)),
      ...(this.manifest.starfields ?? []).map((s) => this.image(s.src)),
    ]);
    step('fundos');
    step('pronto');
  }

  /**
   * Carrega um atlas pelo nome, uma vez só.
   *
   * Atlas marcados como `lazy` no manifesto ficam de fora do boot — os retratos
   * de comandante, por exemplo, são vários megabytes que só o mapa de galáxias
   * precisa. O painel pede por nome quando abre.
   */
  loadAtlas(name: string): Promise<void> {
    const cached = this.atlasJobs.get(name);
    if (cached) return cached;

    const entry = this.manifest.atlases.find((a) => a.name === name);
    if (!entry) return Promise.resolve();

    const job = Promise.all([
      this.image(entry.image),
      fetch(BASE + entry.data).then((r) => r.json() as Promise<AtlasData>),
    ]).then(([img, data]) => {
      this.atlases.add(new Atlas(entry.name, img, data));
    });
    this.atlasJobs.set(name, job);
    return job;
  }

  /** Carrega (ou devolve do cache) uma imagem relativa a `public/assets/`. */
  image(rel: string): Promise<HTMLImageElement> {
    const cached = this.images.get(rel);
    if (cached) return Promise.resolve(cached);

    let promise = this.pending.get(rel);
    if (promise) return promise;

    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.images.set(rel, img);
        this.pending.delete(rel);
        resolve(img);
      };
      img.onerror = () => {
        this.pending.delete(rel);
        reject(new Error(`falha ao carregar ${rel}`));
      };
      img.src = BASE + rel;
    });
    this.pending.set(rel, promise);
    return promise;
  }

  /**
   * Pede uma imagem decorativa sem propagar falha.
   *
   * Fundos e campos de estrela são enfeite: se um arquivo faltar, a cena
   * simplesmente não o desenha. Usar `image()` cru nesses casos gera rejeição
   * não tratada no console — barulho que esconde erro de verdade.
   */
  prefetch(rel: string): void {
    void this.image(rel).catch(() => {
      console.warn(`[assets] ${rel} indisponível; seguindo sem ele`);
    });
  }

  /** Versão síncrona: devolve `undefined` se ainda não carregou. */
  peek(rel: string): HTMLImageElement | undefined {
    return this.images.get(rel);
  }

  /** Dispara o carregamento de todas as camadas de um bioma do parallax. */
  async loadBiome(biome: string): Promise<ParallaxLayerInfo[]> {
    const layers = this.manifest.parallax[biome] ?? [];
    await Promise.all(layers.map((l) => this.image(l.src)));
    return layers;
  }

  async loadDeepSpace(): Promise<ParallaxLayerInfo[]> {
    await Promise.all(this.manifest.deepspace.map((p) => this.image(p.src)));
    return this.manifest.deepspace;
  }
}

export const assets = new Assets();
