export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Interpolação exponencial independente de framerate. `h` = meia-vida em segundos. */
export const damp = (a: number, b: number, halfLife: number, dt: number): number =>
  b + (a - b) * Math.pow(2, -dt / Math.max(1e-6, halfLife));

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(dist2(ax, ay, bx, by));

/** Menor diferença angular em (-π, π]. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

// ── RNG determinístico ──────────────────────────────────────────────────────

/**
 * mulberry32 — pequeno, rápido e semeável. Usado em tudo que precisa ser
 * reproduzível (geração de setor, rolagem de afixos, layout de ondas).
 */
export class Rng {
  private s: number;

  constructor(seed: number = (Math.random() * 0xffffffff) >>> 0) {
    this.s = seed >>> 0;
  }

  get seed(): number {
    return this.s;
  }

  reset(seed: number): void {
    this.s = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [lo, hi) */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** Inteiro em [lo, hi] inclusivo. */
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Escolha ponderada. `weight` deve devolver um valor > 0. */
  weighted<T>(arr: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of arr) total += Math.max(0, weight(it));
    let roll = this.next() * total;
    for (const it of arr) {
      roll -= Math.max(0, weight(it));
      if (roll <= 0) return it;
    }
    return arr[arr.length - 1]!;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}

/** Hash string → uint32, para derivar seeds estáveis de ids. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
