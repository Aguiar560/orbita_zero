import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'art-source', 'chaves', 'conceito-30-chaves-v2.png');
const OUTPUT = path.join(ROOT, 'public', 'assets', 'chaves');
const COLS = 6;
const ROWS = 5;
const SIZE = 256;
const ART_SIZE = 220;
// A geração manteve seis colunas regulares; a última linha recebeu mais respiro.
const COL_EDGES = [0, 229, 458, 687, 916, 1145, 1374];
const ROW_EDGES = [0, 215, 430, 645, 860, 1145];

const FILES = [
  'chave-01-berco-vega.webp', 'chave-02-corte-ferro.webp', 'chave-03-mar-cinzas.webp',
  'chave-04-palio-verde.webp', 'chave-05-fenda-rhodes.webp', 'chave-06-coroa-quebrada.webp',
  'chave-07-longa-noite.webp', 'chave-08-alto-silencio.webp', 'chave-09-veu-ambar.webp',
  'chave-10-ultima-pagina.webp', 'chave-11-forja-fria.webp', 'chave-12-jardim-oxido.webp',
  'chave-13-anel-tetis.webp', 'chave-14-garganta-azul.webp', 'chave-15-espinha-vazio.webp',
  'chave-16-nona-aurora.webp', 'chave-17-campo-lazaro.webp', 'chave-18-trono-oco.webp',
  'chave-19-mare-prata.webp', 'chave-20-fim-linha.webp', 'chave-21-caldeira-asterion.webp',
  'chave-22-cemiterio-khepri.webp', 'chave-23-tear-nyx.webp', 'chave-24-lamina-carbono.webp',
  'chave-25-prisma-eos.webp', 'chave-26-colmeia-icaro.webp', 'chave-27-forja-antares.webp',
  'chave-28-coroa-caelum.webp', 'chave-29-dobra-janus.webp', 'chave-30-umbra-terminal.webp',
];

const ELEMENTOS = [
  'fogo', 'cosmico', 'padrao', 'raio', 'quimico', 'gelo',
  'fogo', 'cosmico', 'quimico', 'gelo', 'gelo', 'quimico',
  'gelo', 'raio', 'cosmico', 'fogo', 'quimico', 'cosmico',
  'padrao', 'raio', 'fogo', 'padrao', 'quimico', 'raio',
  'cosmico', 'quimico', 'fogo', 'gelo', 'cosmico', 'cosmico',
];
const COR_ELEMENTAL = {
  fogo: '#ff653c', cosmico: '#b568ff', padrao: '#9db7c9',
  raio: '#ffd84d', quimico: '#49e779', gelo: '#62dcff',
};
if (FILES.length !== COLS * ROWS || ELEMENTOS.length !== FILES.length) {
  throw new Error('A folha, os arquivos e os elementos precisam ter 30 entradas.');
}

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

async function recortarIcone(source, left, top, width, height, destination, targetHex) {
  const inset = 16;
  const { data, info } = await source
    .clone()
    .extract({ left: left + inset, top: top + inset, width: width - inset * 2, height: height - inset * 2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  const target = rgb(targetHex);

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      // O fundo da folha é quase preto e neutro. A luminância preserva metal
      // escuro; a crominância preserva halos coloridos mesmo quando suaves.
      const material = (max - 28) / 42;
      const emissivo = chroma / 38;
      const alpha = clampByte(Math.max(material, emissivo) * 255);
      data[offset + 3] = alpha;
      // Pigmenta somente energia/cristal já coloridos. Metal neutro, ferrugem,
      // gelo e cerâmica mantêm a matéria própria de cada silhueta.
      const brilhoProtegido = 1 - Math.max(0, max - 218) / 90;
      const peso = Math.max(0, Math.min(0.72, (chroma - 7) / 62)) * brilhoProtegido;
      if (peso > 0) {
        data[offset] = clampByte(r * (1 - peso) + target[0] * (max / 255) * peso);
        data[offset + 1] = clampByte(g * (1 - peso) + target[1] * (max / 255) * peso);
        data[offset + 2] = clampByte(b * (1 - peso) + target[2] * (max / 255) * peso);
      }
    }
  }

  // As divisórias da folha são linhas quase completas. Removê-las por extensão,
  // e não por cor, preserva metal preto e energia violeta dentro dos ícones.
  for (let y = 0; y < info.height; y++) {
    let ativos = 0;
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 18) ativos++;
    if (ativos > info.width * 0.72) {
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * 4;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 82) data[offset + 3] = 0;
      }
    }
  }
  for (let x = 0; x < info.width; x++) {
    let ativos = 0;
    for (let y = 0; y < info.height; y++) if (data[(y * info.width + x) * 4 + 3] > 18) ativos++;
    if (ativos > info.height * 0.72) {
      for (let y = 0; y < info.height; y++) {
        const offset = (y * info.width + x) * 4;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 82) data[offset + 3] = 0;
      }
    }
  }

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 18) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) throw new Error(`Ícone vazio: ${destination}`);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const icon = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
    .resize(ART_SIZE, ART_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: icon, gravity: 'centre' }])
    .webp({ lossless: true, effort: 6 })
    .toFile(destination);
}

await mkdir(OUTPUT, { recursive: true });
const source = sharp(SOURCE, { limitInputPixels: false });
const metadata = await source.metadata();
if (!metadata.width || !metadata.height) throw new Error('Folha-conceito sem dimensões.');
if (metadata.width !== COL_EDGES.at(-1) || metadata.height !== ROW_EDGES.at(-1)) {
  throw new Error(`Folha-conceito inesperada: ${metadata.width}x${metadata.height}.`);
}

for (let index = 0; index < FILES.length; index++) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const left = COL_EDGES[col];
  const right = COL_EDGES[col + 1];
  const top = ROW_EDGES[row];
  const bottom = ROW_EDGES[row + 1];
  await recortarIcone(
    source, left, top, right - left, bottom - top,
    path.join(OUTPUT, FILES[index]), COR_ELEMENTAL[ELEMENTOS[index]],
  );
}

const previewCells = await Promise.all(FILES.map(async (file, index) => ({
  input: await sharp(path.join(OUTPUT, file)).resize(132, 132, { fit: 'contain' }).png().toBuffer(),
  left: (index % COLS) * 152 + 10,
  top: Math.floor(index / COLS) * 152 + 10,
})));
await sharp({ create: { width: COLS * 152, height: ROWS * 152, channels: 4, background: '#050d16' } })
  .composite(previewCells)
  .webp({ quality: 92 })
  .toFile(path.join(ROOT, 'art-source', 'chaves', 'preview-30-chaves-v2.webp'));

console.log(`Geradas ${FILES.length} chaves em ${OUTPUT}`);
