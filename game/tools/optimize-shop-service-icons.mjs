import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'art-source', 'ui', 'loja', 'services');
const outputDir = path.join(root, 'assets-static', 'ui', 'loja', 'services');

const icons = [
  'loja_servico_carga',
  'loja_servico_matriz',
  'loja_servico_tentativa',
  'loja_servico_compactacao',
  'loja_servico_refino',
];

await mkdir(outputDir, { recursive: true });

await Promise.all(icons.map(async (name) => {
  await sharp(path.join(sourceDir, `${name}.png`))
    .resize(512, 512, { fit: 'contain', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputDir, `${name}.webp`));
}));

console.log(`Ícones da Loja otimizados: ${icons.length}`);
