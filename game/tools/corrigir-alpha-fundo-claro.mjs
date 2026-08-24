import path from 'node:path';
import sharp from 'sharp';

const raiz = path.resolve(process.cwd(), '..', 'spaceships new', 'Recursos 2.0');
const nomes = [
  'BIOGEL.png', 'ESSENCIA XENO.png', 'MICRO REATOR.png',
  'NEONIO.png', 'ROLHA DE ASTEROIDE.png', 'ZIRCONIO.png',
];

/**
 * Recorta apenas o fundo claro CONECTADO às bordas.
 *
 * Um chroma-key global apagaria reflexos brancos do metal e do vidro. A busca
 * por conectividade remove só a região externa; um brilho claro cercado pelo
 * próprio objeto continua intacto.
 */
for (const nome of nomes) {
  const arquivo = path.join(raiz, nome);
  const { data, info } = await sharp(arquivo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const visitado = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  let inicio = 0;
  let fim = 0;

  const claro = (p) => {
    const i = p * 3;
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    return r >= 225 && g >= 225 && b >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 32;
  };
  const semear = (p) => {
    if (!visitado[p] && claro(p)) { visitado[p] = 1; fila[fim++] = p; }
  };
  for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }

  while (inicio < fim) {
    const p = fila[inicio++];
    const x = p % w;
    const y = Math.floor(p / w);
    if (x > 0) semear(p - 1);
    if (x + 1 < w) semear(p + 1);
    if (y > 0) semear(p - w);
    if (y + 1 < h) semear(p + w);
  }

  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const src = p * 3;
    const dst = p * 4;
    rgba[dst] = data[src]; rgba[dst + 1] = data[src + 1]; rgba[dst + 2] = data[src + 2];
    rgba[dst + 3] = visitado[p] ? 0 : 255;
  }
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile(`${arquivo}.rgba.png`);
  await import('node:fs/promises').then((fs) => fs.rename(`${arquivo}.rgba.png`, arquivo));
  console.log(`RGBA: ${nome}`);
}
