import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

/**
 * Prepara a arte de capa para a tela de login.
 *
 * ## Por que WebP e por que 1600px
 *
 * A origem é um PNG de 2,4 MB e 1536×1024. Como imagem de fundo de tela cheia,
 * ela só precisa cobrir a maior janela plausível — e a partir daí pixels a mais
 * não aparecem, só atrasam a primeira tela que o jogador vê.
 *
 * 1600 de largura cobre monitor de 1440p com folga sem virar arquivo de
 * megabytes. Acima disso, o retorno é invisível e o custo é o tempo de abertura.
 *
 * ## Por que com perda, ao contrário do resto do pipeline
 *
 * A regra do projeto é WebP SEM perda para arte de contorno — sprite, ícone,
 * qualquer coisa cuja silhueta precise sobreviver em tamanho pequeno. Esta é o
 * oposto: uma pintura de tela cheia, sem borda dura, exibida grande e ainda por
 * baixo de uma caixa translúcida.
 *
 * Sem perda aqui geraria um arquivo enorme para preservar detalhe que o olho não
 * alcança através do escurecimento.
 */

const raiz = path.resolve(import.meta.dirname, '..');
const origem = process.argv[2] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'orbita zero.png');
const destino = path.join(raiz, 'assets-static', 'ui', 'capa');

const kb = (b) => `${(b / 1024).toFixed(0)} KB`;

await mkdir(destino, { recursive: true });

const entrada = sharp(origem);
const meta = await entrada.metadata();
const antes = (await stat(origem)).size;

const saida = path.join(destino, 'login.webp');
await entrada
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(saida);

const depois = (await stat(saida)).size;
const fim = await sharp(saida).metadata();

console.log(`\n▸ capa do login`);
console.log(`  origem:  ${meta.width}×${meta.height}  ${kb(antes)}`);
console.log(`  saída:   ${fim.width}×${fim.height}  ${kb(depois)}`);
console.log(`  redução: ${(100 - (depois / antes) * 100).toFixed(0)}%`);
console.log(`  em:      ${path.relative(raiz, saida)}\n`);
