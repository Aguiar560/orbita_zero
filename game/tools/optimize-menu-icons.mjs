import path from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import sharp from 'sharp';

/**
 * Ícones das abas do menu.
 *
 * As treze artes chegaram em tamanhos diferentes (de 179×205 a 378×378) e com
 * o objeto em posições diferentes dentro da moldura. Numa aba de 22px isso
 * apareceria como ícones de tamanhos aparentes distintos, uns tocando a borda e
 * outros boiando no meio.
 *
 * `trim` remove a margem transparente de cada uma, e só DEPOIS vem o `resize`
 * com `fit: contain` — assim todas passam a ocupar a mesma caixa útil, e a
 * diferença de proporção original vira margem simétrica em vez de escala
 * diferente. É o mesmo problema que o atlas resolve com recorte por alfa; aqui
 * não há atlas, então é o `sharp` que faz.
 *
 * Saem em 128px, não no tamanho original: a aba usa 22px e o Códex e o Hangar
 * mostram no máximo 44. Guardar 378px seria carregar oito vezes o pixel que a
 * tela usa.
 */
const root = process.cwd();
const sourceDir = path.join(root, 'art-source', 'ui', 'menu');
const outputDir = path.join(root, 'assets-static', 'ui', 'menu');

const LADO = 128;

await mkdir(outputDir, { recursive: true });

const arquivos = (await readdir(sourceDir)).filter((f) => f.toLowerCase().endsWith('.png'));

await Promise.all(arquivos.map(async (file) => {
  const nome = path.basename(file, '.png');
  await sharp(path.join(sourceDir, file))
    // `threshold: 12` e não 0: as artes têm um halo de alfa quase zero em volta,
    // e aparar só o zero absoluto deixaria uma borda invisível de vários pixels
    // que desalinharia os ícones entre si.
    .trim({ threshold: 12 })
    .resize(LADO, LADO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputDir, `${nome}.webp`));
}));

console.log(`Ícones do menu otimizados: ${arquivos.length} → ${LADO}px`);
