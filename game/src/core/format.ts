const SHORT = ['', 'K', 'M', 'B', 'T'];
// aa, ab, ac … usado a partir de 1e15, padrão consagrado em idle games.
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Formata um número grande de forma compacta: 12.3K, 4.56M, 1.02ab. */
export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  let v = Math.abs(value);
  if (v < 1000) return sign + trimZeros(v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.floor(v).toString());

  let tier = 0;
  while (v >= 1000 && tier < 400) {
    v /= 1000;
    tier++;
  }
  return sign + trimZeros(v.toFixed(decimals)) + suffix(tier);
}

/** Igual a `fmt` mas sempre com sinal — para deltas em tooltips. */
export function fmtSigned(value: number, decimals = 2): string {
  return (value >= 0 ? '+' : '') + fmt(value, decimals);
}

/** 0.1734 → "17.3%" */
export function pct(value: number, decimals = 1): string {
  return trimZeros((value * 100).toFixed(decimals)) + '%';
}

/** Multiplicador legível: 2.5 → "×2.5" */
export function mult(value: number, decimals = 2): string {
  return '×' + trimZeros(value.toFixed(decimals));
}

/** Segundos → "1h 04m", "3m 12s", "8s". */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;
  return `${Math.floor(h / 24)}d ${pad(h % 24)}h`;
}

/** Taxa por segundo, com unidade. */
export function rate(perSecond: number, unit = '/s'): string {
  return fmt(perSecond, perSecond < 10 ? 2 : 1) + unit;
}

function suffix(tier: number): string {
  if (tier < SHORT.length) return SHORT[tier]!;
  const n = tier - SHORT.length;
  const first = Math.floor(n / 26) % 26;
  const second = n % 26;
  return LETTERS[first]! + LETTERS[second]!;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}
