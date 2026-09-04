/** Converte apenas as cinco propostas aprovadas para prévia no modo de teste. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, copyFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'art-source/propostas/biomas-2026-09-04');
const staticDir = path.join(root, 'assets-static/fundo/teste');
const publicDir = path.join(root, 'public/assets/fundo/teste');
const names = ['bosque-fotonico', 'necropole-mecanica', 'tempestade-de-ambar', 'recife-carmesim', 'mar-de-regolito'];

await Promise.all([staticDir, publicDir].map((dir) => mkdir(dir, { recursive: true })));
await Promise.all(names.map(async (name, index) => {
  const input = path.join(source, `${String(index + 1).padStart(2, '0')}-${name}.png`);
  const filename = `bioma-${name}.webp`;
  // Preserva a arte e a proporção originais: sem recorte, espelho ou ampliação.
  const result = await sharp(input).webp({ quality: 90, effort: 6 }).toFile(path.join(staticDir, filename));
  await copyFile(path.join(staticDir, filename), path.join(publicDir, filename));
  console.log(`${filename}: ${result.width}x${result.height}, ${Math.round(result.size / 1024)} KiB`);
}));
