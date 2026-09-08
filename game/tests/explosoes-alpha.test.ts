import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

type Frame = [number, number, number, number, number, number, number, number];
type Atlas = { image: string; frames: Record<string, Frame> };

const ATLAS_DIR = new URL('../public/assets/atlas/', import.meta.url);

const GRUPOS = [
  ['espaco', /^fx\/blast_/],
  ['elemental', /^estouro\//],
  ['combate', /^estouro\//],
  ['fleet', /^sr\/blast\//],
  ['arcade', /(^boom\/|_boom_)/],
  ['hull', /^hull\/boom/],
  ['void', /(_morte_|rocha\/explode)/],
  ['galaxia', /^shmup\/boom\//],
  ['drone', /^drone\/death_/],
] as const;

async function carregar(nome: string) {
  const atlas = JSON.parse(
    readFileSync(new URL(`${nome}.json`, ATLAS_DIR), 'utf8'),
  ) as Atlas;
  const { data, info } = await sharp(fileURLToPath(new URL(atlas.image, ATLAS_DIR)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { atlas, data, largura: info.width };
}

function bordaDoFrame(data: Buffer, largura: number, frame: Frame) {
  const [left, top, w, h] = frame;
  let total = 0;
  let visiveis = 0;
  let poeira = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && y !== 0 && x !== w - 1 && y !== h - 1) continue;
      const alfa = data[((top + y) * largura + left + x) * 4 + 3]!;
      total++;
      if (alfa > 6) visiveis++;
      if (alfa > 0 && alfa < 18) poeira++;
    }
  }
  return { cobertura: visiveis / total, poeira };
}

describe('transparencia das explosoes de todas as naves', () => {
  it.each(GRUPOS)('%s tem explosoes sem uma moldura retangular', async (nome, padrao) => {
    const { atlas, data, largura } = await carregar(nome);
    const frames = Object.entries(atlas.frames).filter(([id]) => padrao.test(id));

    expect(frames.length, `grupo de explosoes ausente em ${nome}`).toBeGreaterThan(0);
    for (const [id, frame] of frames) {
      const { cobertura } = bordaDoFrame(data, largura, frame);
      // Um halo ou estilhaço pode tocar uma lateral. Uma caixa de matte, porém,
      // deixa quase todo o perímetro aceso ao mesmo tempo.
      expect(cobertura, `${nome}:${id} ainda tem fundo nas bordas`).toBeLessThan(0.7);
    }
  });

  it.each([
    ['espaco', /^fx\/blast_/],
    ['elemental', /^estouro\//],
  ] as const)('%s remove a poeira da folha achatada', async (nome, padrao) => {
    const { atlas, data, largura } = await carregar(nome);
    const frames = Object.entries(atlas.frames).filter(([id]) => padrao.test(id));

    for (const [id, frame] of frames) {
      const { cobertura, poeira } = bordaDoFrame(data, largura, frame);
      expect(cobertura, `${nome}:${id} ainda parece um recorte quadrado`).toBeLessThan(0.25);
      expect(poeira, `${nome}:${id} ainda tem alfa residual`).toBe(0);
    }
  });
});
