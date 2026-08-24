import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const root = process.cwd();
const source = path.join(root, 'art-source', 'ui', 'craft', 'modulacao', 'craft_bancada_recalibracao.png');
const outputDir = path.join(root, 'assets-static', 'ui', 'craft', 'modulacao');

await mkdir(outputDir, { recursive: true });
await sharp(source)
  .resize(512, 512, { fit: 'contain', withoutEnlargement: true })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(path.join(outputDir, 'craft_bancada_recalibracao.webp'));

console.log('Ícone da Bancada de Afixos otimizado');
