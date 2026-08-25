import path from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import sharp from 'sharp';

/**
 * Assets da HUD de anatomia — o "boneco" da nave.
 *
 * Três famílias com tratamentos diferentes, e a diferença importa:
 *
 * - **`chassi`** é a figura central e a única que preserva a PROPORÇÃO. Ela é
 *   alta (1:1,44) e é isso que define o desenho da coluna; encaixá-la num
 *   quadrado a deformaria ou deixaria margem morta.
 * - **`soquete_*`** são um PAR que se substitui no mesmo lugar. Aparados, dão
 *   339×369 e 340×369 — um pixel de diferença. Vão para a mesma caixa quadrada
 *   justamente para que trocar um pelo outro não desloque nada.
 * - **`slot_*` e `conector`** vão para caixa quadrada com margem simétrica.
 *
 * O `trim` antes do `resize` é o que alinha tudo: as artes chegaram de 179×205
 * a 529×763, cada uma com o objeto numa posição diferente da moldura. Sem
 * aparar, cada ícone ocuparia uma fração distinta da sua caixa. O
 * `threshold: 12` existe porque há um halo de alfa quase-zero em volta, que um
 * corte no zero absoluto não remove.
 */
const root = process.cwd();
const sourceDir = path.join(root, 'art-source', 'ui', 'anatomia');
const outputDir = path.join(root, 'assets-static', 'ui', 'anatomia');

/** O chassi é mostrado no máximo a ~200px; 512 dá folga para telas densas. */
const CHASSI = 512;
/** Soquete e ícone aparecem a 46–64px. 192 cobre com sobra. */
const LADO = 192;

await mkdir(outputDir, { recursive: true });

const arquivos = (await readdir(sourceDir)).filter((f) => f.toLowerCase().endsWith('.png'));

await Promise.all(arquivos.map(async (file) => {
  const nome = path.basename(file, '.png');
  const base = sharp(path.join(sourceDir, file)).trim({ threshold: 12 });

  // Chassi e conector preservam a PROPORÇÃO: um é alto (1:1,44) e o outro é
  // largo e baixo (514x93). Enfiar qualquer um dos dois num quadrado só
  // produziria margem transparente do tamanho do próprio desenho.
  const proporcional = nome === 'chassi' || nome === 'conector';
  const ajustado = proporcional
    ? base.resize(nome === 'chassi' ? { height: CHASSI } : { width: 256 })
    : base.resize(LADO, LADO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

  await ajustado
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputDir, `${nome}.webp`));
}));

console.log(`Assets da anatomia otimizados: ${arquivos.length}`);
