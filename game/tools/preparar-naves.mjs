import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

import { removerFundoChapado } from './lib/fundo-chapado.mjs';

/**
 * Prepara um lote de arte de nave e a instala em `art-source/naves/`.
 *
 * ## O que ele resolve
 *
 * Um lote grande chega com dois problemas que ninguém quer resolver à mão cento
 * e sessenta e nove vezes:
 *
 * 1. **Fundo chapado.** Parte das artes vem com branco em vez de transparência,
 *    e em jogo isso é um retângulo em volta da nave.
 * 2. **Nome sem sentido.** `ChatGPT Image 26 de ago...r1_c10.png` não diz a quem
 *    a arte pertence, e o pipeline precisa do ID da nave.
 *
 * ## Como o pareamento é feito
 *
 * Por COR, contra o elemento. Cada nave do jogo tem um elemento com cor
 * canônica em `data/elements.ts`, e estas artes são fortemente codificadas por
 * cor — vermelho, azul, verde, roxo, âmbar. Medir o matiz dominante de cada
 * arte e casar com o elemento mais próximo dá um resultado coerente de graça:
 * inimigo de fogo fica vermelho, o de químico fica verde.
 *
 * A alternativa era parear cento e sessenta e nove à mão, ou distribuir em
 * ordem — que é o mesmo que sortear, e produziria naves de gelo vermelhas.
 *
 * ## Uso
 *
 *   node tools/preparar-naves.mjs <pasta-do-lote> [--aplicar]
 *
 * Sem `--aplicar` ele só relata o que faria. O padrão é o ensaio porque este
 * script ESCREVE em `art-source/`, e um lote pareado errado é chato de desfazer.
 */

const raiz = path.resolve(import.meta.dirname, '..');
const origem = process.argv[2];
const aplicar = process.argv.includes('--aplicar');

if (!origem || !existsSync(origem)) {
  console.error('uso: node tools/preparar-naves.mjs <pasta-do-lote> [--aplicar]');
  process.exit(1);
}

const mapaPath = path.join(raiz, 'tools', 'mapa-de-sprites.json');
if (!existsSync(mapaPath)) {
  console.error('falta tools/mapa-de-sprites.json — rode `npm run assets:mapa` antes');
  process.exit(1);
}
const mapa = JSON.parse(readFileSync(mapaPath, 'utf8'));

// ── cores canônicas dos elementos ───────────────────────────────────────────
// Copiadas de `data/elements.ts`. Duplicar seis constantes num script de
// ferramenta custa menos que carregar TypeScript aqui — e se elas mudarem, o
// pior caso é um pareamento menos afinado, não um jogo quebrado.
const ELEMENTOS = {
  padrao: [223, 231, 245],
  fogo: [255, 90, 60],
  gelo: [92, 230, 255],
  cosmico: [180, 92, 255],
  raio: [74, 168, 255],
  quimico: [126, 232, 88],
};

/** Cor média dos pixels OPACOS e saturados de uma arte. */
async function corDominante(arquivo) {
  const { data, info } = await sharp(arquivo)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    // Só pixel COLORIDO conta. O casco é cinza em quase toda arte, e incluí-lo
    // puxaria todas as médias para o mesmo cinza — o pareamento viraria sorteio.
    if (mx < 60 || (mx - mn) / mx < 0.28) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : null;
}

/** Distância de matiz, ignorando brilho. */
function distancia(a, b) {
  const norm = ([x, y, z]) => { const s = Math.max(1, x + y + z); return [x / s, y / s, z / s]; };
  const [a1, a2, a3] = norm(a);
  const [b1, b2, b3] = norm(b);
  return Math.hypot(a1 - b1, a2 - b2, a3 - b3);
}

const elementoDaArte = (cor) => {
  if (!cor) return 'padrao';
  let melhor = 'padrao', d = Infinity;
  for (const [id, c] of Object.entries(ELEMENTOS)) {
    const dd = distancia(cor, c);
    if (dd < d) { d = dd; melhor = id; }
  }
  return melhor;
};

const listar = (dir) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'))
    .map((e) => path.join(dir, e.name)).sort()
  : []);

async function instalar(arquivo, id, papel) {
  const destino = path.join(raiz, 'art-source', 'naves', papel);
  mkdirSync(destino, { recursive: true });

  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const apagados = removerFundoChapado({ data, width: info.width, height: info.height });
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
  if (aplicar) writeFileSync(path.join(destino, `${id}.png`), png);
  return apagados;
}

// ── o lote ──────────────────────────────────────────────────────────────────
const naves = Object.entries(mapa);
const porPapel = (p) => naves.filter(([, v]) => v.papel === p);

console.log(`\n▸ preparar naves${aplicar ? '' : '  (ENSAIO — use --aplicar para escrever)'}\n`);

const resultado = { jogador: [], inimigo: [], chefe: [] };

// 1. as iniciais: nomeadas por elemento, pareadas com o casco de cada piloto
const iniciais = listar(path.join(origem, 'Inicial'));
if (iniciais.length) {
  const porElemento = new Map(porPapel('jogador')
    .filter(([id]) => ['nucleo_vektor', 'lanca_rubra', 'baluarte_glacial', 'sopro_astral'].includes(id))
    .map(([id, v]) => [id, v]));
  const deElemento = {
    raio: 'nucleo_vektor', fogo: 'lanca_rubra',
    gelo: 'baluarte_glacial', cosmica: 'sopro_astral', cosmico: 'sopro_astral',
  };
  for (const arq of iniciais) {
    const stem = path.basename(arq, '.png').toLowerCase();
    const id = deElemento[stem];
    if (!id || !porElemento.has(id)) {
      console.log(`  ⚠ Inicial/${path.basename(arq)}: nome não bate com elemento nenhum`);
      continue;
    }
    resultado.jogador.push({ arq, id, nome: porElemento.get(id).nome });
  }
}

/**
 * Atribuição gulosa, servindo primeiro quem tem menos opção.
 *
 * A ordem importa e não é detalhe. Se as naves fossem percorridas em ordem
 * qualquer, uma de fogo levaria a única arte verde disponível só por aparecer
 * antes, e a de químico — que não tem alternativa — ficaria sem.
 *
 * Medido no lote: há 43 artes de fogo para 15 inimigos de fogo, e 11 artes
 * verdes para 15 de químico. Percorrer por RAZÃO oferta/demanda faz a escassez
 * cair onde ela dói menos.
 */
function atribuir(alvos, artes) {
  const livres = new Set(artes.map((_, i) => i));

  const demanda = {}; for (const a of alvos) demanda[a.elemento] = (demanda[a.elemento] ?? 0) + 1;
  const oferta = {}; for (const a of artes) oferta[a.elemento] = (oferta[a.elemento] ?? 0) + 1;
  const folga = (el) => (oferta[el] ?? 0) / Math.max(1, demanda[el] ?? 1);

  const ordem = [...alvos].sort((x, y) => folga(x.elemento) - folga(y.elemento));

  const pares = [];
  for (const alvo of ordem) {
    let melhor = -1; let d = Infinity;
    for (const i of livres) {
      const dd = distancia(artes[i].cor ?? ELEMENTOS.padrao, ELEMENTOS[alvo.elemento] ?? ELEMENTOS.padrao);
      if (dd < d) { d = dd; melhor = i; }
    }
    if (melhor < 0) break;
    livres.delete(melhor);
    pares.push({ alvo, arte: artes[melhor], exato: artes[melhor].elemento === alvo.elemento });
  }
  return pares;
}

// ── chefes e inimigos ──────────────────────────────────────────────────────
const planos = {};
for (const [pasta, papel] of [['Boss', 'chefe'], ['', 'inimigo']]) {
  const dir = pasta ? path.join(origem, pasta) : origem;
  const arqs = listar(dir);
  if (!arqs.length) continue;

  const artes = [];
  for (const arq of arqs) {
    const cor = await corDominante(arq);
    artes.push({ arq, cor, elemento: elementoDaArte(cor) });
  }

  const alvos = naves.filter(([, v]) => v.papel === papel).map(([id, v]) => ({ id, ...v }));
  const pares = atribuir(alvos, artes);
  planos[papel] = pares;

  const exatos = pares.filter((p) => p.exato).length;
  console.log(`  ${papel}: ${arqs.length} artes para ${alvos.length} naves`);
  console.log(`    no elemento certo: ${exatos}/${pares.length}  (${Math.round(exatos / pares.length * 100)}%)`);
  const trocados = pares.filter((p) => !p.exato);
  if (trocados.length) {
    const resumo = {};
    for (const t of trocados) {
      const k = `${t.alvo.elemento} <- ${t.arte.elemento}`;
      resumo[k] = (resumo[k] ?? 0) + 1;
    }
    for (const [k, n] of Object.entries(resumo).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(3)}x  ${k}`);
    }
  }
}
// 3. as iniciais são as únicas que dá para casar sem ambiguidade agora
// Prévia: o plano em JSON, para inspeção antes de aplicar.
if (process.env.OZ_PLANO) {
  const dump = {};
  for (const [papel, pares] of Object.entries(planos)) {
    dump[papel] = pares.map((p) => ({ id: p.alvo.id, nome: p.alvo.nome, elemento: p.alvo.elemento, arte: p.arte.arq, corDaArte: p.arte.elemento, exato: p.exato }));
  }
  writeFileSync(process.env.OZ_PLANO, JSON.stringify(dump, null, 2));
  console.log(`  plano salvo em ${process.env.OZ_PLANO}`);
}

console.log();
for (const papel of ['chefe', 'inimigo']) {
  for (const p of planos[papel] ?? []) {
    await instalar(p.arte.arq, p.alvo.id, papel);
  }
  if (planos[papel]?.length) {
    console.log(`  ${aplicar ? 'instaladas' : 'instalaria'} ${planos[papel].length} artes de ${papel}`);
  }
}

for (const r of resultado.jogador) {
  const n = await instalar(r.arq, r.id, 'jogador');
  console.log(`  ${aplicar ? 'instalada' : 'instalaria'}: ${path.basename(r.arq).padEnd(14)} -> ${r.id.padEnd(18)} ${r.nome}${n ? `  (fundo removido: ${n}px)` : ''}`);
}
console.log();
