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

/**
 * Recorte para 16:9, e por que ele não é opcional.
 *
 * A arte nasce em 3:2 e a tela do jogador é quase sempre 16:9 ou mais larga.
 * Com `cover`, essa diferença tem de sair de algum lugar: medido numa janela de
 * 1730×915, sobravam 238px de altura para cortar.
 *
 * E não havia corte bom. Cortar por baixo come a nave grande, que é o assunto
 * do jogo; cortar por cima come o logo, que é a razão de a arte estar aqui.
 * Nenhum ajuste de `background-position` resolve um conflito desse tamanho —
 * ele só escolhe qual dos dois perder.
 *
 * Aparar na ORIGEM resolve: a faixa de 96px no topo é céu vazio acima do anel
 * orbital, e as 64 de baixo são superfície de planeta. Tirando as duas, a arte
 * vira 1536×864 — exatamente 16:9 — e o que sobra para cortar em tela cheia
 * cai de 238px para menos de 60.
 */
const saida = path.join(destino, 'login.webp');
await entrada
  .extract({ left: 0, top: 50, width: 1536, height: 864 })
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
