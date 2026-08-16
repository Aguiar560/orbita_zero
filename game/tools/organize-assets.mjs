/**
 * Organiza a arte crua em categorias, separando o que o jogo usa do que não usa.
 *
 *   npm run assets:organizar
 *
 * O que ele NÃO faz: mover ou apagar a arte original. As pastas dos packs ficam
 * exatamente onde estão, porque é de lá que o pipeline lê. O que ele cria é uma
 * ÁRVORE PARALELA em `D:\bbb\arte\` feita de **hard links** — o mesmo arquivo
 * aparece nos dois lugares ocupando espaço uma vez só. São ~293 MB de arte;
 * copiar dobraria isso à toa, e link simbólico exigiria privilégio de admin.
 *
 * A lista do que está em uso vem de `.assets/lidos.json`, gravado pelo próprio
 * pipeline: ele registra cada arquivo que abriu. Isso é exato — não tenta
 * adivinhar pelo nome nem reimplementar a lógica de seleção.
 */
import { readdir, mkdir, writeFile, rm, link, copyFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const RAW = path.resolve(PROJECT, '..');
const OUT = path.join(RAW, 'arte');
const LOG = path.join(PROJECT, '.assets', 'lidos.json');

/** Pastas da raiz que contêm arte. `game` é código; `__MACOSX` é lixo de zip. */
const IGNORE = new Set(['game', 'arte', '.claude', '__MACOSX', 'node_modules']);

/** Extensões consideradas arte navegável. O resto vai para `_outros`. */
const ART = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/**
 * Regras de categoria, avaliadas EM ORDEM — a primeira que casar vence.
 *
 * O teste roda sobre o caminho relativo inteiro em minúsculas, então tanto o
 * nome do arquivo quanto a pasta que o contém contam. A ordem importa: uma
 * "Kla'ed - Fighter - Destruction" é explosão, não nave inimiga, e por isso
 * `explosoes` vem antes de `naves-inimigas`.
 */
const RULES = [
  // Folhas-mestre desenhadas para este jogo: são a fonte de dezenas de sprites
  // e merecem estar no topo, senão caem em categorias genéricas pelo nome.
  // `Itens.png` fica de fora daqui de propósito: é folha-mestre, mas quem
  // procura arte de item procura em "itens", não em "folhas-mestre".
  ['00-folhas-mestre', /espa[cç]o\.png|spritesheet|stylesheet|_previews|preview\.png|ships preview|cover/],
  ['14-personagens', /portrait|transparent background/],
  // Interface antes das demais: "UI_sprites" e "icon-health" contêm palavras
  // que outras regras roubariam.
  ['13-interface', /(^|[/_\-. ])ui([/_\-. ]|$)|hud|icon|button|menu|health|score/],
  ['05-explosoes', /destruction|destroyed|explosion|explode|boom|blast|damage/],
  ['06-motores-e-rastros', /engine|exhaust|thrust|flame|turbo|boost|trail|charge/],
  ['07-escudos', /shield|barrier|shild|defletor/],
  ['04-projeteis', /projectile|bullet|missile|torpedo|rocket|\bray\b|\bwave\b|\bbolt\b|shot|weapon|plasma|proton|vulcan|zapper|attack/],
  ['09-coletaveis', /pickup|pwup|power ?up|bonus|coleta/],
  ['08-itens', /itens\.png|item|loot/],
  ['03-chefes', /\bboss\b|dreadnought|battlecruiser/],
  ['02-naves-inimigas', /enemy|kla'?ed|nairan|nautolan|enemyfleet|inimigo|foe|shadow/],
  ['01-naves-jogador', /main ?ship|player|spaceship|\bship\b|nave|jet|fighter|bomber|corvette|drone|idle|move|evasion|turn_|turret/],
  ['11-planetas', /planet|planeta/],
  ['15-parallax', /parallax|desert|forest|\bmoon\b|skies|\bsky\b|dune|mountain|cloud/],
  ['12-fundos', /background|backdrop|nebula|starfield|starry|\bstars?\b|\bbg\b|\bspace\b|galaxia|void/],
  ['10-cenario', /asteroid|rock|mine|tile|debris|comet|prop|obstacul|sample|main_bb|image_/],
];

/** Rótulos legíveis para o relatório. */
const LABELS = {
  '00-folhas-mestre': 'Folhas-mestre e previews',
  '01-naves-jogador': 'Naves do jogador',
  '02-naves-inimigas': 'Naves inimigas',
  '03-chefes': 'Chefes',
  '04-projeteis': 'Projéteis e armas',
  '05-explosoes': 'Explosões e destruição',
  '06-motores-e-rastros': 'Motores, escapes e rastros',
  '07-escudos': 'Escudos e barreiras',
  '08-itens': 'Itens e equipamento',
  '09-coletaveis': 'Coletáveis e power-ups',
  '10-cenario': 'Cenário (asteroides, minas, props)',
  '11-planetas': 'Planetas',
  '12-fundos': 'Fundos e nebulosas',
  '13-interface': 'Interface e HUD',
  '14-personagens': 'Personagens e retratos',
  '15-parallax': 'Parallax planetário',
  '99-outros': 'Outros (PSD, licenças, fontes)',
};

function classify(relPath) {
  const probe = relPath.toLowerCase().replace(/\\/g, '/');
  if (!ART.has(path.extname(relPath).toLowerCase())) return '99-outros';
  for (const [category, test] of RULES) {
    if (test.test(probe)) return category;
  }
  return '99-outros';
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Cria um hard link; se o sistema recusar (volume diferente, permissão),
 * cai para cópia — organizar não pode falhar por causa disso.
 */
async function place(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  if (existsSync(to)) return 'existente';
  try {
    await link(from, to);
    return 'link';
  } catch {
    await copyFile(from, to);
    return 'copia';
  }
}

/** Achata o caminho num nome único que preserva a origem. */
function flatName(relPath) {
  return relPath
    .replace(/\\/g, '/')
    .replace(/\/PNGs\//gi, '/')
    .split('/')
    .filter((p) => p && p !== '.')
    .join(' · ')
    .replace(/\s+/g, ' ');
}

async function main() {
  if (!existsSync(LOG)) {
    console.error('✖ `.assets/lidos.json` não existe. Rode `npm run assets` primeiro.');
    process.exit(1);
  }

  const used = new Set(JSON.parse(readFileSync(LOG, 'utf8')).arquivos.map((f) => path.resolve(f)));
  console.log(`\n▸ Organizando arte de ${RAW}`);
  console.log(`  ${used.size} arquivos marcados como EM USO pelo pipeline\n`);

  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });

  const roots = (await readdir(RAW, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !IGNORE.has(d.name))
    .map((d) => path.join(RAW, d.name));

  /** categoria → { usado: [], naoUsado: [] } */
  const buckets = new Map();
  let linked = 0;
  let copied = 0;

  for (const root of roots) {
    const pack = path.basename(root);
    for (const file of await walk(root)) {
      const rel = path.relative(RAW, file);
      const category = classify(rel);
      const isUsed = used.has(path.resolve(file));

      const bucket = buckets.get(category) ?? { usado: [], naoUsado: [] };
      buckets.set(category, bucket);
      (isUsed ? bucket.usado : bucket.naoUsado).push({ rel, pack, size: (await stat(file)).size });

      const dest = path.join(OUT, isUsed ? 'usado' : 'nao-usado', category, flatName(rel));
      const how = await place(file, dest);
      if (how === 'link') linked++;
      else if (how === 'copia') copied++;
    }
  }

  await writeReport(buckets, { linked, copied, used: used.size });

  const totalUsed = [...buckets.values()].reduce((n, b) => n + b.usado.length, 0);
  const totalUnused = [...buckets.values()].reduce((n, b) => n + b.naoUsado.length, 0);
  console.log(`✔ ${totalUsed} em uso · ${totalUnused} sem uso`);
  console.log(`  ${linked} hard links, ${copied} cópias`);
  console.log(`  → ${OUT}\n`);
}

async function writeReport(buckets, stats) {
  const mb = (n) => (n / 1048576).toFixed(1);
  const sum = (arr) => arr.reduce((n, f) => n + f.size, 0);

  const categories = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '# Inventário de arte — Órbita Zero',
    '',
    `Gerado por \`npm run assets:organizar\` em ${new Date().toLocaleString('pt-BR')}.`,
    '',
    'Esta pasta é uma **árvore paralela feita de hard links**: os arquivos originais',
    'continuam nos packs de onde o pipeline lê, e aqui aparecem organizados sem',
    'ocupar espaço em disco de novo. Apagar algo aqui NÃO apaga o original.',
    '',
    '- `usado/` — arte que o pipeline realmente abriu para gerar `public/assets`.',
    '- `nao-usado/` — arte que está nas pastas mas nenhum sprite consome.',
    '',
    '## Resumo por categoria',
    '',
    '| Categoria | Em uso | Sem uso | MB em uso | MB sem uso |',
    '|---|---:|---:|---:|---:|',
  ];

  let usedCount = 0;
  let unusedCount = 0;
  let usedBytes = 0;
  let unusedBytes = 0;

  for (const [id, bucket] of categories) {
    usedCount += bucket.usado.length;
    unusedCount += bucket.naoUsado.length;
    usedBytes += sum(bucket.usado);
    unusedBytes += sum(bucket.naoUsado);
    lines.push(
      `| ${LABELS[id] ?? id} | ${bucket.usado.length} | ${bucket.naoUsado.length} | ${mb(sum(bucket.usado))} | ${mb(sum(bucket.naoUsado))} |`,
    );
  }
  lines.push(`| **Total** | **${usedCount}** | **${unusedCount}** | **${mb(usedBytes)}** | **${mb(unusedBytes)}** |`, '');

  // Detalhe do que sobrou, agrupado por pack: é a lista que interessa para
  // decidir o que aproveitar depois ou o que descartar.
  lines.push('## Sem uso, por pack', '');
  const byPack = new Map();
  for (const [id, bucket] of categories) {
    for (const f of bucket.naoUsado) {
      const key = f.pack;
      const entry = byPack.get(key) ?? new Map();
      byPack.set(key, entry);
      entry.set(id, (entry.get(id) ?? 0) + 1);
    }
  }
  for (const [pack, cats] of [...byPack.entries()].sort()) {
    const total = [...cats.values()].reduce((a, b) => a + b, 0);
    lines.push(`- **${pack}** — ${total} arquivos: ` + [...cats.entries()].sort().map(([c, n]) => `${LABELS[c] ?? c} (${n})`).join(', '));
  }
  lines.push('', `_${stats.linked} hard links, ${stats.copied} cópias._`, '');

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'INVENTARIO.md'), lines.join('\n'));

  const json = Object.fromEntries(
    categories.map(([id, b]) => [id, {
      rotulo: LABELS[id] ?? id,
      usado: b.usado.map((f) => f.rel),
      naoUsado: b.naoUsado.map((f) => f.rel),
    }]),
  );
  await writeFile(path.join(OUT, 'inventario.json'), JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error('\n✖ falha ao organizar:', err);
  process.exit(1);
});
