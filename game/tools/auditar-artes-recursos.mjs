import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const origem = path.resolve(process.cwd(), '..', 'spaceships new', 'Recursos 2.0');
const saida = path.resolve(process.cwd(), '.qa', 'recursos-2.0-contact-sheet.png');
const arquivos = (await fs.readdir(origem)).filter((f) => f.toLowerCase().endsWith('.png')).sort();

const celula = 150;
const colunas = 10;
const linhas = Math.ceil(arquivos.length / colunas);
const largura = colunas * celula;
const altura = linhas * celula;
const problemas = [];
const composicoes = [];

const fundo = `<svg width="${largura}" height="${altura}" xmlns="http://www.w3.org/2000/svg">
  <defs><pattern id="q" width="16" height="16" patternUnits="userSpaceOnUse">
    <rect width="16" height="16" fill="#101722"/><rect width="8" height="8" fill="#1b2634"/>
    <rect x="8" y="8" width="8" height="8" fill="#1b2634"/>
  </pattern></defs><rect width="100%" height="100%" fill="url(#q)"/>
</svg>`;

for (let i = 0; i < arquivos.length; i++) {
  const nome = arquivos[i];
  const arquivo = path.join(origem, nome);
  const imagem = sharp(arquivo);
  const meta = await imagem.metadata();
  if (meta.format !== 'png') problemas.push(`${nome}: formato ${meta.format}`);
  if (!meta.hasAlpha) problemas.push(`${nome}: sem canal alfa`);
  if ((meta.width ?? 0) < 96 || (meta.height ?? 0) < 96) problemas.push(`${nome}: resolução ${meta.width}×${meta.height}`);

  const thumb = await imagem.clone().resize(126, 118, { fit: 'contain' }).png().toBuffer();
  const x = (i % colunas) * celula + 12;
  const y = Math.floor(i / colunas) * celula + 4;
  composicoes.push({ input: thumb, left: x, top: y });

  const label = nome.replace(/\.png$/i, '').slice(0, 22).replaceAll('&', '&amp;');
  const rotulo = Buffer.from(`<svg width="146" height="24" xmlns="http://www.w3.org/2000/svg">
    <rect width="146" height="24" rx="3" fill="#05090ddd"/>
    <text x="73" y="15" text-anchor="middle" fill="#b9d8e8" font-family="Arial" font-size="8">${label}</text>
  </svg>`);
  composicoes.push({ input: rotulo, left: (i % colunas) * celula + 2, top: Math.floor(i / colunas) * celula + 124 });
}

await fs.mkdir(path.dirname(saida), { recursive: true });
await sharp(Buffer.from(fundo)).composite(composicoes).png().toFile(saida);

console.log(`${arquivos.length} artes auditadas`);
console.log(problemas.length ? problemas.join('\n') : 'OK: PNG, resolução e alfa válidos em todas');
console.log(`Folha de contato: ${saida}`);
if (arquivos.length !== 70 || problemas.length) process.exitCode = 1;
