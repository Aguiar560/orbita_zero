/**
 * Folha de contato de um atlas, ampliada, para conferir recorte:
 *
 *   npm run assets:folha -- combate tiro/ 6
 *
 * Existe porque o atlas empacotado é ilegível a olho — os sprites ficam
 * embaralhados pelo bin packing e em tamanho real. Aqui saem em ordem
 * alfabética, um por célula, com a lista de ids no terminal, o que torna óbvio
 * quando um recorte decepou a arte ou trouxe filete de moldura junto.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [, , atlasName, prefix = '', scaleArg = '3'] = process.argv;
const scale = Number(scaleArg);
const OUT = path.resolve('public/assets');
const manifest = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
const atlas = manifest.atlases.find((a) => a.name === atlasName);
const img = sharp(path.join(OUT, atlas.image)).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const table = JSON.parse(await readFile(path.join(OUT, atlas.data), 'utf8'));

const frames = Object.entries(table.frames ?? table)
  .filter(([id]) => id.startsWith(prefix))
  .map(([id, a]) => [id, { x: a[0], y: a[1], w: a[2], h: a[3] }]);
frames.sort((a, b) => a[0].localeCompare(b[0]));
console.log(frames.map(([id]) => id).join('\n'));

const cell = Math.ceil(Math.max(...frames.map(([, f]) => Math.max(f.w, f.h))) * scale) + 8;
const cols = Math.min(10, frames.length);
const rows = Math.ceil(frames.length / cols);
const W = cols * cell, H = rows * cell;
const out = Buffer.alloc(W * H * 4);
for (let i = 3; i < out.length; i += 4) out[i] = 255;
for (let i = 0; i < out.length; i += 4) { out[i] = 16; out[i + 1] = 18; out[i + 2] = 28; }

for (let n = 0; n < frames.length; n++) {
  const [, f] = frames[n];
  const cx = (n % cols) * cell, cy = Math.floor(n / cols) * cell;
  const dw = Math.round(f.w * scale), dh = Math.round(f.h * scale);
  const ox = cx + Math.round((cell - dw) / 2), oy = cy + Math.round((cell - dh) / 2);
  for (let y = 0; y < dh; y++) {
    const sy = f.y + Math.floor(y / scale);
    for (let x = 0; x < dw; x++) {
      const sx = f.x + Math.floor(x / scale);
      const si = (sy * info.width + sx) * 4;
      const a = data[si + 3] / 255;
      const di = ((oy + y) * W + ox + x) * 4;
      if (di < 0 || di >= out.length) continue;
      out[di] = data[si] * a + out[di] * (1 - a);
      out[di + 1] = data[si + 1] * a + out[di + 1] * (1 - a);
      out[di + 2] = data[si + 2] * a + out[di + 2] * (1 - a);
    }
  }
}
const dest = path.resolve('.snapshots', `sheet-${atlasName}-${prefix.replace(/\W+/g, '_')}.png`);
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(dest);
console.log('→', dest, `${W}x${H}`, `${frames.length} sprites`);
