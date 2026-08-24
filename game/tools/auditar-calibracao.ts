import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HULLS } from '@data/hulls';
import { SPACESHIPS2_HULL_SPEC_BY_ID, type HullArchetypeId } from '@data/hulls-spaceships2';
import { ALL_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';

type FrameTuple = [number, number, number, number, number, number, number, number];
interface AtlasFile { frames: Record<string, FrameTuple> }

const manifest = JSON.parse(readFileSync(resolve('public/assets/manifest.json'), 'utf8')) as {
  atlases: { data: string }[];
};
const frames = new Map<string, FrameTuple>();
for (const atlas of manifest.atlases) {
  const data = JSON.parse(readFileSync(resolve('public/assets', atlas.data), 'utf8')) as AtlasFile;
  for (const [key, frame] of Object.entries(data.frames)) frames.set(key, frame);
}

interface Row {
  role: 'player' | 'enemy' | 'boss';
  id: string;
  sprite: string;
  scale: number;
  opaqueW: number;
  opaqueH: number;
  visualW: number;
  visualH: number;
  offsetX: number;
  offsetY: number;
}

interface CalibrationEntry {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
}

const row = (role: Row['role'], id: string, sprite: string, scale: number): Row | null => {
  const frame = frames.get(sprite);
  if (!frame) return null;
  const [, , w, h, ox, oy, sw, sh] = frame;
  return {
    role, id, sprite, scale, opaqueW: w, opaqueH: h,
    visualW: w * scale, visualH: h * scale,
    offsetX: (ox + w / 2 - sw / 2) * scale,
    offsetY: (oy + h / 2 - sh / 2) * scale,
  };
};

const rows: Row[] = [];
const missing: string[] = [];
for (const hull of HULLS) {
  const sprite = hull.damageStates?.[0] ?? hull.sprite;
  const item = row('player', hull.id, sprite, hull.damageStates ? 1.5 : (hull.scale ?? 0.62));
  if (item) rows.push(item); else missing.push(`player:${hull.id}:${sprite}`);
}
for (const enemy of ALL_ENEMIES) {
  const sprite = enemy.bank?.[Math.floor(enemy.bank.length / 2)] ?? enemy.sprite;
  const item = row('enemy', enemy.id, sprite, enemy.scale);
  if (item) rows.push(item); else missing.push(`enemy:${enemy.id}:${sprite}`);
}
for (const boss of BOSSES) {
  const item = row('boss', boss.id, boss.sprite, boss.scale);
  if (item) rows.push(item); else missing.push(`boss:${boss.id}:${boss.sprite}`);
}

const round = (n: number) => Math.round(n * 10) / 10;
const roundScale = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Mantém a direção de arte existente e só corrige extremos entre packs.
 * O intervalo é deliberadamente largo: escala é identidade visual, não uma
 * desculpa para deixar todo casco do mesmo tamanho.
 */
const calibratedScale = (entry: Row): number => {
  if (entry.role === 'player') {
    const spec = SPACESHIPS2_HULL_SPEC_BY_ID.get(entry.id);
    if (spec) {
      const target: Record<HullArchetypeId, number> = {
        interceptor: 74, assalto: 80, artilharia: 84, baluarte: 88,
        suporte: 78, saturacao: 78, duelista: 74,
      };
      const longest = Math.max(entry.visualW, entry.visualH);
      return roundScale(Math.min(.46, Math.max(.30, entry.scale * target[spec.archetype] / longest)));
    }
  }
  const longest = Math.max(entry.visualW, entry.visualH);
  const [min, max] = entry.role === 'player' ? [48, 92]
    : entry.role === 'enemy' ? [32, 110]
      : [130, 190];
  if (longest < min) return roundScale(entry.scale * min / longest);
  if (longest > max) return roundScale(entry.scale * max / longest);
  return roundScale(entry.scale);
};

const calibration = (entry: Row): CalibrationEntry => {
  const scale = calibratedScale(entry);
  const factor = scale / entry.scale;
  const visualW = entry.visualW * factor;
  const visualH = entry.visualH * factor;
  const [widthRatio, heightRatio] = entry.role === 'player' ? [.56, .45]
    : entry.role === 'enemy' ? [.68, .68]
      : [.72, .72];
  return {
    width: round(visualW * widthRatio),
    height: round(visualH * heightRatio),
    offsetX: round(entry.offsetX * factor),
    offsetY: round(entry.offsetY * factor),
    scale,
  };
};

if (process.argv.includes('--write')) {
  const output = {
    players: Object.fromEntries(rows.filter((entry) => entry.role === 'player').map((entry) => [entry.id, calibration(entry)]).sort(([a], [b]) => String(a).localeCompare(String(b)))),
    enemies: Object.fromEntries(rows.filter((entry) => entry.role === 'enemy').map((entry) => [entry.id, calibration(entry)]).sort(([a], [b]) => String(a).localeCompare(String(b)))),
    bosses: Object.fromEntries(rows.filter((entry) => entry.role === 'boss').map((entry) => [entry.id, calibration(entry)]).sort(([a], [b]) => String(a).localeCompare(String(b)))),
  };
  const destination = resolve('src/data/hitbox-calibrations.json');
  writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Calibração gravada: ${Object.keys(output.players).length} cascos, ${Object.keys(output.enemies).length} inimigos e ${Object.keys(output.bosses).length} chefes.`);
  process.exit(0);
}

for (const role of ['player', 'enemy', 'boss'] as const) {
  const group = rows.filter((entry) => entry.role === role);
  const widths = group.map((entry) => entry.visualW).sort((a, b) => a - b);
  const heights = group.map((entry) => entry.visualH).sort((a, b) => a - b);
  const percentile = (values: number[], p: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] ?? 0;
  console.log(`${role}: ${group.length} sprites`);
  console.log(`  largura visual min/p25/med/p75/max: ${[widths[0], percentile(widths, .25), percentile(widths, .5), percentile(widths, .75), widths.at(-1)].map((n) => round(n ?? 0)).join(' / ')}`);
  console.log(`  altura visual  min/p25/med/p75/max: ${[heights[0], percentile(heights, .25), percentile(heights, .5), percentile(heights, .75), heights.at(-1)].map((n) => round(n ?? 0)).join(' / ')}`);
}

console.log('\nExtremos por área visual:');
for (const entry of [...rows].sort((a, b) => a.visualW * a.visualH - b.visualW * b.visualH)) {
  console.log(`${entry.role.padEnd(6)} ${entry.id.padEnd(28)} ${round(entry.visualW).toString().padStart(5)}x${round(entry.visualH).toString().padEnd(5)} s=${entry.scale} off=${round(entry.offsetX)},${round(entry.offsetY)} ${entry.sprite}`);
}
if (missing.length) console.log(`\nSem frame (${missing.length}):\n${missing.join('\n')}`);
