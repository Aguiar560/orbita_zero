const sharp = require('sharp');
const path = require('path');

const [, , input, output, widthArg, heightArg, mode = 'alpha'] = process.argv;

if (!input || !output || !widthArg || !heightArg) {
  console.error('Uso: node scripts/process-provacao-asset.cjs <entrada> <saida> <largura> <altura> [alpha|opaque]');
  process.exit(1);
}

const width = Number(widthArg);
const height = Number(heightArg);

if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
  throw new Error('Dimensoes invalidas.');
}

function isLightNeutral(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 218 && max - min <= 18;
}

async function removeConnectedCheckerboard(buffer, info, includeCenter) {
  const { width: sourceWidth, height: sourceHeight, channels } = info;
  const pixels = sourceWidth * sourceHeight;
  const outside = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let head = 0;
  let tail = 0;

  function enqueue(index) {
    if (outside[index]) return;
    const offset = index * channels;
    if (!isLightNeutral(buffer[offset], buffer[offset + 1], buffer[offset + 2])) return;
    outside[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < sourceWidth; x += 1) {
    enqueue(x);
    enqueue((sourceHeight - 1) * sourceWidth + x);
  }
  for (let y = 0; y < sourceHeight; y += 1) {
    enqueue(y * sourceWidth);
    enqueue(y * sourceWidth + sourceWidth - 1);
  }
  if (includeCenter) {
    const centerX = Math.floor(sourceWidth / 2);
    const centerY = Math.floor(sourceHeight / 2);
    enqueue(centerY * sourceWidth + centerX);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % sourceWidth;
    const y = Math.floor(index / sourceWidth);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < sourceWidth) enqueue(index + 1);
    if (y > 0) enqueue(index - sourceWidth);
    if (y + 1 < sourceHeight) enqueue(index + sourceWidth);
  }

  const rgba = Buffer.alloc(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    const sourceOffset = index * channels;
    const targetOffset = index * 4;
    rgba[targetOffset] = outside[index] ? 0 : buffer[sourceOffset];
    rgba[targetOffset + 1] = outside[index] ? 0 : buffer[sourceOffset + 1];
    rgba[targetOffset + 2] = outside[index] ? 0 : buffer[sourceOffset + 2];
    rgba[targetOffset + 3] = outside[index] ? 0 : 255;
  }

  return sharp(rgba, {
    raw: { width: sourceWidth, height: sourceHeight, channels: 4 },
  });
}

async function makeBlackTransparent(inputFile) {
  const { data, info } = await sharp(inputFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const rgba = Buffer.alloc(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    const sourceOffset = index * info.channels;
    const targetOffset = index * 4;
    const r = data[sourceOffset];
    const g = data[sourceOffset + 1];
    const b = data[sourceOffset + 2];
    const luminance = Math.max(r, g, b);
    rgba[targetOffset] = r;
    rgba[targetOffset + 1] = g;
    rgba[targetOffset + 2] = b;
    rgba[targetOffset + 3] = Math.max(0, Math.min(255, (luminance - 5) * 4));
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function main() {
  let pipeline;

  if (mode.startsWith('opaque')) {
    pipeline = sharp(input).removeAlpha();
  } else if (mode === 'alpha-black') {
    pipeline = await makeBlackTransparent(input);
  } else {
    const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    pipeline = await removeConnectedCheckerboard(data, info, mode === 'alpha-hollow');
    pipeline = pipeline.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }

  const fit = mode === 'opaque-cover' ? 'cover' : mode === 'alpha-contain' ? 'contain' : 'fill';
  pipeline = pipeline.resize(width, height, {
    fit,
    kernel: sharp.kernel.lanczos3,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (path.extname(output).toLowerCase() === '.webp') {
    pipeline = pipeline.webp({ quality: 92, alphaQuality: 100, effort: 6 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }
  await pipeline.toFile(output);

  const metadata = await sharp(output).metadata();
  const stats = await sharp(output).stats();
  const alpha = metadata.hasAlpha ? stats.channels[3] : null;
  console.log(JSON.stringify({
    file: path.resolve(output),
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
    alphaMin: alpha?.min ?? null,
    alphaMax: alpha?.max ?? null,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
