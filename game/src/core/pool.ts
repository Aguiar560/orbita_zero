/**
 * Pool de objetos com varredura in-place.
 *
 * A camada vertical cria/destrói milhares de projéteis por minuto; alocar
 * objetos novos a cada tiro entrega trabalho constante ao GC e produz engasgos
 * visíveis. Aqui os slots são reaproveitados e a compactação é O(n) por quadro.
 */
export class Pool<T extends { alive: boolean }> {
  readonly items: T[] = [];
  private cursor = 0;

  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void,
    readonly capacity = 2048,
  ) {}

  /** Número de itens vivos (sempre o prefixo `[0, size)` do array). */
  get size(): number {
    return this.cursor;
  }

  /** Pega um slot livre. Devolve `null` se a capacidade estourou. */
  spawn(): T | null {
    if (this.cursor >= this.capacity) return null;
    let item = this.items[this.cursor];
    if (!item) {
      item = this.create();
      this.items[this.cursor] = item;
    }
    this.reset(item);
    item.alive = true;
    this.cursor++;
    return item;
  }

  /**
   * Remove os itens mortos trocando-os com o último vivo. Chame uma vez por
   * quadro, depois de atualizar tudo. A ordem NÃO é preservada.
   */
  compact(): void {
    let i = 0;
    while (i < this.cursor) {
      const item = this.items[i]!;
      if (item.alive) {
        i++;
        continue;
      }
      this.cursor--;
      if (i !== this.cursor) {
        this.items[i] = this.items[this.cursor]!;
        this.items[this.cursor] = item;
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.cursor; i++) this.items[i]!.alive = false;
    this.cursor = 0;
  }

  /** Itera apenas os vivos. */
  each(fn: (item: T, index: number) => void): void {
    for (let i = 0; i < this.cursor; i++) fn(this.items[i]!, i);
  }
}
