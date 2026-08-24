/**
 * Pipeline de assets do Órbita Zero.
 *
 * Lê os packs crus que vivem FORA do projeto (D:\bbb\<pack>) e produz
 * `public/assets/` — atlas empacotados, camadas de parallax redimensionadas,
 * planetas e um `manifest.json`. Os packs crus nunca são modificados.
 *
 *   npm run assets
 */
import { readdir, mkdir, writeFile, rm, stat, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { ESPACO_SLICES, ESPACO_MATTE } from './espaco.slices.mjs';
import {
  ITEM_COLUMNS, ITEM_ROWS, ITEM_INSET, ITENS_MATTE,
  NODE_PLATES, NODE_PLATE_Y, SLOT_GLYPHS, SLOT_GLYPH_Y,
  RARITY_GEMS, RARITY_GEM_Y, CATEGORY_GLYPHS, CATEGORY_GLYPH_X,
  CATEGORY_GLYPH_Y0, CATEGORY_GLYPH_PITCH, CATEGORY_GLYPH_H,
  SET_ROWS, SET_COLUMNS,
} from './itens.slices.mjs';
import {
  MAX_FRAMES, MAIN_SHIP, MAIN_WEAPONS, HULL_STATES, ENGINE_KINDS, SHIELD_KINDS,
  WEAPON_KINDS, PLAYER_PROJECTILES, FLEETS, CLASS_SLUG, PICKUPS, ENVIRONMENT,
  BIG_SHIPS, BIG_SHIP_FRAMES, BACKDROPS,
} from './void.slices.mjs';
import {
  ICONES_SHEET, ICONES_MATTE, MENU_ICONS, MENU_ORIGIN, MENU_PITCH,
  MENU_ICON_INSET, ICON_BANDS, RIGHT_PANEL,
} from './icones.slices.mjs';
import { PLANETAS_SHEET, PLANETA_FAIXAS, PLANETA_BLOCOS } from './planetas.slices.mjs';
import {
  SPRITES_SHEET, PAINEL_PASSO, PAINEIS, SPRITE_FILEIRAS,
  TIRO_FILEIRAS, TIRO_BLOCO, TIRO_DESSATURA,
} from './sprites.slices.mjs';
import { CATEGORIAS, COLUNAS, MEIA_CELULA, ROTULOS_ATE } from './tiros.slices.mjs';
import { extrairCelula, segmentarPorComponentes } from './lib/elemental.mjs';
import { celulas as celulasDeItem } from './novos-itens.slices.mjs';
import { RECURSOS_SHEET, celulas as celulasDeRecurso } from './recursos.slices.mjs';
import { INTERFACE_SHEET, PECAS, PECAS_SOLTAS } from './interface.slices.mjs';
import { MISSOES_SHEET, PECAS_MISSOES } from './missoes.slices.mjs';

/** O catálogo novo do §23. */
const NOVOS_ITENS_SHEET = 'novos itens.png';

/** A folha elemental do §21. */
const TIROS_SHEET = 'tiros e explosoes.png';
import {
  toRaw, rawToSharp, unmatte, trimAlpha, crop, blit, blank, rowComponents,
  alphaOverDark, desaturate, sliceRow, expandToNeighbours, noteRead, readPaths,
} from './lib/imaging.mjs';
import { packSkyline } from './lib/packer.mjs';

/**
 * `sharp` de LEITURA: registra o arquivo-fonte antes de abrir.
 *
 * Toda arte crua entra no pipeline por aqui ou por `toRaw`, então o conjunto
 * `readPaths` acaba sendo a lista exata do que foi aproveitado — é o que a
 * auditoria usa para separar o que virou sprite do que ficou parado.
 */
const src = (file) => {
  noteRead(file);
  return sharp(file);
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const RAW = path.resolve(PROJECT, '..'); // D:\bbb
const VOID = path.join(RAW, 'new spaceships');
const OUT = path.join(PROJECT, 'public', 'assets');
const STATIC_ASSETS = path.join(PROJECT, 'assets-static');

/** Altura interna (device px) da faixa horizontal — define o resize do parallax. */
const BAR_LAYER_HEIGHT = 220;

const log = (...a) => console.log('  ', ...a);

async function main() {
  const t0 = Date.now();
  console.log('\n▸ Órbita Zero · pipeline de assets');
  console.log('  fonte:', RAW);
  console.log('  saída:', OUT, '\n');

  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  /** @type {Record<string, unknown>} */
  const manifest = { version: 1, generated: new Date().toISOString(), atlases: [], images: {} };

  await buildEspaco(manifest);
  await buildItens(manifest);
  await buildArcade(manifest);
  await buildVoid(manifest);
  await buildGalaxyArt(manifest);
  await buildIcones(manifest);
  await buildOrbes(manifest);
  await buildSprites(manifest);
  await buildTiros(manifest);
  await buildNovosItens(manifest);
  await buildRecursos(manifest);
  await buildFundosDeGalaxia(manifest);
  await buildDestrocos(manifest);
  await buildInterface(manifest);
  await buildFleetAtlas(manifest);
  await buildHullAtlas(manifest);
  await buildSpaceships2Atlas(manifest);
  await buildCharactersAtlas(manifest);
  await buildDroneAtlas(manifest);
  await buildParallax(manifest);
  await buildDeepSpace(manifest);

  // Assets autorais que não são derivados dos packs crus (por exemplo, UI da Provação).
  // O pipeline recria public/assets do zero, então eles entram sempre no fim da montagem.
  if (existsSync(STATIC_ASSETS)) {
    await cp(STATIC_ASSETS, OUT, { recursive: true, force: true });
    log('assets estáticos preservados');
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Registro de proveniência: qual arte crua o pipeline realmente abriu.
  // Fica fora de `public/` porque é ferramenta, não asset do jogo.
  await mkdir(path.join(PROJECT, '.assets'), { recursive: true });
  await writeFile(
    path.join(PROJECT, '.assets', 'lidos.json'),
    JSON.stringify({ raiz: RAW, geradoEm: new Date().toISOString(), arquivos: [...readPaths].sort() }, null, 2),
  );

  console.log(`\n✔ concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s · ${readPaths.size} arquivos-fonte lidos\n`);
}

// ────────────────────────────────────────────────────────────────────────────
// Espaço.png — a folha-mestre desenhada para este jogo
// ────────────────────────────────────────────────────────────────────────────
async function buildEspaco(manifest) {
  const dir = path.join(RAW, 'Jogando');
  const file = (await readdir(dir)).find((f) => /^espa.*\.png$/i.test(f));
  if (!file) throw new Error('Espaço.png não encontrado em ' + dir);

  const sheet = await toRaw(path.join(dir, file));
  log(`Espaço: ${file} (${sheet.width}x${sheet.height})`);

  /** @type {{ id: string, raw: any, ox: number, oy: number, sw: number, sh: number }[]} */
  const sprites = [];

  for (const s of ESPACO_SLICES) {
    let region = crop(sheet, s.x, s.y, s.w, s.h);

    if (s.mode === 'opaque') {
      // Backdrop: sai como arquivo próprio, fora do atlas.
      await rawToSharp(region).png({ compressionLevel: 9 }).toFile(await ensureFile(`bg/${base(s.id)}.png`));
      manifest.images[s.id] = { src: `bg/${base(s.id)}.png`, w: region.width, h: region.height };
      continue;
    }

    region = unmatte(region, ESPACO_MATTE, s.mode === 'glow' ? 'glow' : 'solid');
    const trimmed = s.trim === false ? { raw: region, ox: 0, oy: 0 } : trimAlpha(region, s.mode === 'glow' ? 6 : 2);
    if (!trimmed) {
      console.warn(`   ! recorte vazio: ${s.id} (${s.x},${s.y},${s.w},${s.h})`);
      continue;
    }
    sprites.push({ id: s.id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: s.w, sh: s.h });
  }

  await writeAtlas('espaco', sprites, manifest);
}

// ────────────────────────────────────────────────────────────────────────────
// Itens.png — catálogo de componentes, glifos de slot, raridades e nós
// ────────────────────────────────────────────────────────────────────────────
async function buildItens(manifest) {
  const dir = path.join(RAW, 'Jogando');
  const file = (await readdir(dir)).find((f) => /^itens\.png$/i.test(f));
  if (!file) {
    console.warn('   ! Itens.png não encontrado — pulando catálogo de itens');
    return;
  }

  const sheet = await toRaw(path.join(dir, file));
  log(`Itens: ${file} (${sheet.width}x${sheet.height})`);
  const sprites = [];

  /** Recorta, desfaz a matte do painel e apara — o caminho comum desta folha. */
  const take = (id, x, y, w, h, mode = 'solid') => {
    const region = unmatte(crop(sheet, x, y, w, h), ITENS_MATTE, mode);
    const trimmed = trimAlpha(region, mode === 'glow' ? 6 : 3);
    if (!trimmed) return;
    sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: w, sh: h });
  };

  // 9 categorias × 8 níveis de acabamento = 72 ícones de componente.
  for (const row of ITEM_ROWS) {
    ITEM_COLUMNS.forEach(([x0, x1], tier) => {
      take(
        `item/${row.slot}_${tier}`,
        x0 + ITEM_INSET,
        row.y[0] + ITEM_INSET,
        x1 - x0 - ITEM_INSET * 2,
        row.y[1] - row.y[0] - ITEM_INSET * 2,
      );
    });
  }

  // Placas de upgrade geral → nós da árvore de passivas.
  for (const plate of NODE_PLATES) {
    take(`node/${plate.id}`, plate.x[0], NODE_PLATE_Y[0], plate.x[1] - plate.x[0], NODE_PLATE_Y[1] - NODE_PLATE_Y[0]);
  }

  for (const glyph of SLOT_GLYPHS) {
    take(`slot/${glyph.id}`, glyph.x[0], SLOT_GLYPH_Y[0], glyph.x[1] - glyph.x[0], SLOT_GLYPH_Y[1] - SLOT_GLYPH_Y[0]);
  }

  for (const gem of RARITY_GEMS) {
    take(`gem/${gem.id}`, gem.x[0], RARITY_GEM_Y[0], gem.x[1] - gem.x[0], RARITY_GEM_Y[1] - RARITY_GEM_Y[0]);
  }

  CATEGORY_GLYPHS.forEach((id, i) => {
    take(
      `cat/${id}`,
      CATEGORY_GLYPH_X[0],
      Math.round(CATEGORY_GLYPH_Y0 + i * CATEGORY_GLYPH_PITCH),
      CATEGORY_GLYPH_X[1] - CATEGORY_GLYPH_X[0],
      CATEGORY_GLYPH_H,
    );
  });

  for (const set of SET_ROWS) {
    SET_COLUMNS.forEach(([x0, x1], i) => {
      take(`set/${set.id}_${i}`, x0, set.y[0], x1 - x0, set.y[1] - set.y[0]);
    });
  }

  await writeAtlas('itens', sprites, manifest);
}

// ────────────────────────────────────────────────────────────────────────────
// Folhas arcade (`*-0001.png`) — naves, projéteis, bônus, escudos, explosões
// ────────────────────────────────────────────────────────────────────────────
async function buildArcade(manifest) {
  const dir = path.join(RAW, 'Jogando');
  const sprites = [];

  /** Grade regular: divide em células iguais e descarta as vazias. */
  const grid = async (file, cell, prefix, opts = {}) => {
    const full = path.join(dir, file);
    if (!existsSync(full)) return;
    const sheet = await toRaw(full);
    const cols = Math.floor(sheet.width / cell);
    const rows = Math.floor((opts.height ?? sheet.height) / cell);
    const originY = opts.y ?? 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const region = crop(sheet, c * cell, originY + r * cell, cell, cell);
        const trimmed = trimAlpha(region, 6);
        if (!trimmed) continue;
        const id = opts.byRow ? `${prefix}/${opts.byRow[r] ?? r}_${c}` : `${prefix}/${r * cols + c}`;
        sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: cell, sh: cell });
      }
    }
  };

  /** Faixas com sprites de largura variável — usa detecção de coluna vazia. */
  const bands = async (file, bandList, gap = 4) => {
    const full = path.join(dir, file);
    if (!existsSync(full)) return;
    const sheet = await toRaw(full);
    for (const comp of rowComponents(sheet, bandList, { gap })) {
      const region = crop(sheet, comp.x, comp.y, comp.w, comp.h);
      const trimmed = trimAlpha(region, 6);
      if (!trimmed) continue;
      sprites.push({
        id: `${comp.name}_${comp.index}`,
        raw: trimmed.raw,
        ox: trimmed.ox,
        oy: trimmed.oy,
        sw: comp.w,
        sh: comp.h,
      });
    }
  };

  // Naves: grades limpas de 64px.
  await grid('SpaceShips_Player-0001.png', 64, 'jet');
  await grid('SpaceShips_Enemy-0001.png', 64, 'foe');
  // Projéteis, bônus e escapes: grades de 32px.
  await grid('Bullets-0001.png', 32, 'bolt');
  await grid('Exhaust-0001.png', 32, 'flame');
  await grid('Barrier-0001.png', 88, 'barrier');
  await grid('Bonuses-0001.png', 32, 'pick', {
    byRow: ['reparo', 'escudo', 'dano', 'cadencia', 'bonus'],
  });

  // Larguras irregulares: cada quadro é detectado dentro da sua faixa.
  await bands('Explosion-0001.png', [
    { y0: 0, y1: 80, name: 'boom/fogo' },
    { y0: 80, y1: 160, name: 'boom/plasma' },
    { y0: 160, y1: 240, name: 'boom/vazio' },
    { y0: 240, y1: 320, name: 'boom/rubro' },
  ]);
  await bands('Asteroids-0001.png', [
    { y0: 10, y1: 33, name: 'rock/p' },
    { y0: 33, y1: 63, name: 'rock/m' },
    { y0: 63, y1: 110, name: 'rock/g' },
  ]);
  await bands('Mine-0001.png', [
    { y0: 16, y1: 32, name: 'mina/a' },
    { y0: 48, y1: 80, name: 'mina/a_boom' },
    { y0: 96, y1: 112, name: 'mina/b' },
    { y0: 128, y1: 160, name: 'mina/b_boom' },
    { y0: 176, y1: 192, name: 'mina/c' },
    { y0: 208, y1: 240, name: 'mina/c_boom' },
  ]);
  await bands('SpaceShip_Boss-0001.png', [
    { y0: 12, y1: 32, name: 'chefe/tiro' },
    { y0: 36, y1: 142, name: 'chefe/a' },
    { y0: 157, y1: 263, name: 'chefe/b' },
    { y0: 288, y1: 394, name: 'chefe/c' },
  ], 8);
  await bands('UI_sprites-0001.png', [
    { y0: 2, y1: 74, name: 'hud/faixa' },
    { y0: 77, y1: 99, name: 'hud/glifo' },
    { y0: 101, y1: 124, name: 'hud/medidor' },
  ]);

  await writeAtlas('arcade', sprites, manifest);

  // Camadas tileáveis 320x320 — vão soltas, para repetição contínua.
  // As de estrela viram um catálogo: a cena escolhe duas por galáxia para o
  // céu não ficar idêntico em todo lugar.
  manifest.skies = [];
  for (const [file, key] of [
    ['Background_Full-0001.png', 'full'],
    ['Background_Space-0001.png', 'space'],
    ['Background_Nebula-0001.png', 'nebula1'],
    ['Background_Nebula-0002.png', 'nebula2'],
    ['Background_Stars-0001.png', 'stars'],
    ['Background_SmallStars-0001.png', 'smallstars'],
  ]) {
    const full = path.join(dir, file);
    if (!existsSync(full)) continue;
    const rel = `bg/sky_${key}.png`;
    await src(full).png({ compressionLevel: 9 }).toFile(await ensureFile(rel));
    const meta = await src(full).metadata();
    manifest.skies.push({ key, src: rel, w: meta.width, h: meta.height });
  }
  log(`céus tileáveis: ${manifest.skies.length}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Pack Foozle "Void" — frota do jogador, três frotas inimigas, ambiente
// ────────────────────────────────────────────────────────────────────────────
async function buildVoid(manifest) {
  if (!existsSync(VOID)) {
    console.warn('   ! pasta "new spaceships" não encontrada — pulando pack Void');
    return;
  }

  const sprites = [];
  const missing = [];

  /**
   * Fatia uma tira do pack. A célula é sempre quadrada e do tamanho da altura,
   * então `quadros = largura / altura`. Tiras longas são subamostradas para
   * `MAX_FRAMES`: uma destruição de 30 quadros não fica melhor que uma de 12 e
   * triplicaria o atlas.
   */
  const strip = async (rel, id, opts = {}) => {
    const full = path.join(VOID, `${rel}.png`);
    if (!existsSync(full)) {
      missing.push(rel);
      return 0;
    }
    const sheet = await toRaw(full);
    const cell = sheet.height;
    const total = Math.max(1, Math.round(sheet.width / cell));

    // Largura não múltipla da altura: o pack tem alguns projéteis assim.
    // Cai para detecção por componente em vez de cortar no lugar errado.
    if (sheet.width % cell !== 0 && total > 1) {
      let index = 0;
      for (const comp of rowComponents(sheet, [{ y0: 0, y1: sheet.height, name: id }], { gap: 2 })) {
        const trimmed = trimAlpha(crop(sheet, comp.x, comp.y, comp.w, comp.h), 6);
        if (!trimmed) continue;
        sprites.push({ id: `${id}_${index++}`, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: comp.w, sh: comp.h });
      }
      return index;
    }

    const cap = opts.max ?? MAX_FRAMES;
    const step = total > cap ? total / cap : 1;
    const count = Math.min(total, cap);
    let written = 0;

    for (let i = 0; i < count; i++) {
      const src = Math.min(total - 1, Math.floor(i * step));
      const trimmed = trimAlpha(crop(sheet, src * cell, 0, cell, cell), 6);
      if (!trimmed) continue;
      sprites.push({
        id: total === 1 ? id : `${id}_${written}`,
        raw: trimmed.raw,
        ox: trimmed.ox,
        oy: trimmed.oy,
        sw: cell,
        sh: cell,
      });
      written++;
    }
    return written;
  };

  // ── nave do jogador ───────────────────────────────────────────────────────
  for (const [file, slug] of HULL_STATES) {
    await strip(`${MAIN_SHIP}/Main Ship - Bases/PNGs/${file}`, `void/nave/casco_${slug}`);
  }
  for (const [file, slug] of ENGINE_KINDS) {
    await strip(`${MAIN_SHIP}/Main Ship - Engines/PNGs/Main Ship - Engines - ${file}`, `void/nave/motor_${slug}`);
    await strip(`${MAIN_SHIP}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - ${file} - Idle`, `void/nave/motorfx_${slug}_idle`);
    await strip(`${MAIN_SHIP}/Main Ship - Engine Effects/PNGs/Main Ship - Engines - ${file} - Powering`, `void/nave/motorfx_${slug}_forca`);
  }
  for (const [file, slug] of SHIELD_KINDS) {
    await strip(`${MAIN_SHIP}/Main Ship - Shields/PNGs/Main Ship - Shields - ${file}`, `void/nave/escudo_${slug}`);
  }
  for (const [file, slug] of WEAPON_KINDS) {
    await strip(`${MAIN_SHIP}/Main Ship - Weapons/PNGs/Main Ship - Weapons - ${file}`, `void/nave/arma_${slug}`);
  }
  for (const [file, slug] of PLAYER_PROJECTILES) {
    await strip(`${MAIN_WEAPONS}/${file}`, `void/tiro/${slug}`);
  }

  // ── frotas inimigas ───────────────────────────────────────────────────────
  for (const fleet of FLEETS) {
    for (const cls of fleet.classes) {
      const slug = CLASS_SLUG[cls] ?? cls.toLowerCase().replace(/\s+/g, '_');
      const id = `void/${fleet.id}/${slug}`;
      for (const part of ['base', 'engine', 'destruction', 'shield', 'weapons']) {
        const suffix = { base: 'base', engine: 'motor', destruction: 'morte', shield: 'escudo', weapons: 'arma' }[part];
        await strip(`${fleet.root}/${fleet.dirs[part]}/PNGs/${fleet.file(cls, part)}`, `${id}_${suffix}`);
      }
    }
    for (let i = 0; i < fleet.projectiles.length; i++) {
      await strip(
        `${fleet.root}/${fleet.projectileDir}/PNGs/${fleet.projectiles[i]}`,
        `void/tiro/${fleet.id}_${fleet.projectileNames[i]}`,
      );
    }
  }

  // ── coletáveis, ambiente e naves grandes ──────────────────────────────────
  for (const [dir, file, slug] of PICKUPS) {
    await strip(`${dir}/${file}`, `void/coleta/${slug}`, { max: 15 });
  }
  await strip(`${ENVIRONMENT}/Asteroids/PNGs/Asteroid 01 - Base`, 'void/rocha/base');
  await strip(`${ENVIRONMENT}/Asteroids/PNGs/Asteroid 01 - Explode`, 'void/rocha/explode');
  await strip(`${ENVIRONMENT}/Effects/PNGs/Asteroid - Flame`, 'void/rocha/chama');
  await strip(`${ENVIRONMENT}/Planets/PNGs/Earth-Like planet`, 'void/planeta/terra', { max: 24 });

  for (const ship of BIG_SHIPS) {
    for (const anim of ship.anims) {
      await strip(`${ship.dir}/${anim}`, `void/grande/${ship.id}_${anim.toLowerCase()}`, { max: BIG_SHIP_FRAMES });
    }
  }

  if (missing.length) {
    log(`(${missing.length} arquivos do pack Void não encontrados, ignorados)`);
  }
  await writeAtlas('void', sprites, manifest, 2048);

  // ── fundos panorâmicos ────────────────────────────────────────────────────
  // Giramos 90°: a arte é uma faixa larga feita para rolar na horizontal, e a
  // camada vertical precisa de uma tira alta que dá a volta.
  manifest.backdrops = [];
  for (const [rel, key] of BACKDROPS) {
    const full = path.join(VOID, ENVIRONMENT, `${rel}.png`);
    if (!existsSync(full)) continue;
    const out = `bg/void_${key}.png`;
    await src(full).rotate(90).png({ compressionLevel: 9 }).toFile(await ensureFile(out));
    const meta = await sharp(await ensureFile(out)).metadata();
    manifest.backdrops.push({ key, src: out, w: meta.width, h: meta.height });
  }
  log(`fundos Void: ${manifest.backdrops.length}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Arte de galáxia: fundos 1024, retratos de comandante e packs avulsos
// ────────────────────────────────────────────────────────────────────────────
async function buildGalaxyArt(manifest) {
  if (!existsSync(VOID)) return;

  // ── fundos de galáxia ─────────────────────────────────────────────────────
  // Reduzidos para 512: são desenhados como pano de fundo atrás da cena e no
  // mapa, nunca em tamanho nativo, e 32 arquivos de 1024 pesariam 8 MB.
  manifest.galaxyArt = [];
  const bgRoot = path.join(VOID, 'Large 1024x1024');
  if (existsSync(bgRoot)) {
    for (const dir of await readdir(bgRoot, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      for (const file of (await readdir(path.join(bgRoot, dir.name))).filter((f) => f.endsWith('.png'))) {
        const key = path.basename(file, '.png').replace('-1024x1024', '').toLowerCase();
        const rel = `galaxia/${key}.png`;
        await src(path.join(bgRoot, dir.name, file))
          .resize(512, 512, { kernel: 'lanczos3' })
          .png({ compressionLevel: 9, palette: true, quality: 88 })
          .toFile(await ensureFile(rel));
        manifest.galaxyArt.push({ key, src: rel, group: dir.name.toLowerCase().replace(/\s+/g, '_') });
      }
    }
    log(`fundos de galáxia: ${manifest.galaxyArt.length}`);
  }

  const sprites = [];

  /** Recorta uma folha em grade e emite cada célula já aparada. */
  const gridSheet = async (file, cols, rows, prefix, target) => {
    if (!existsSync(file)) return;
    const sheet = await toRaw(file);
    const cw = Math.floor(sheet.width / cols);
    const ch = Math.floor(sheet.height / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Recuo de 2px: as folhas de retrato têm linhas separadoras finas.
        let cell = crop(sheet, c * cw + 2, r * ch + 2, cw - 4, ch - 4);
        const trimmed = trimAlpha(cell, 6);
        if (!trimmed) continue;
        let raw = trimmed.raw;
        let ox = trimmed.ox;
        let oy = trimmed.oy;
        if (target && raw.width > target) {
          const scale = target / raw.width;
          const buf = await rawToSharp(raw)
            .resize(Math.round(raw.width * scale), Math.round(raw.height * scale), { kernel: 'lanczos3' })
            .raw()
            .toBuffer({ resolveWithObject: true });
          raw = { data: buf.data, width: buf.info.width, height: buf.info.height };
          ox = Math.round(ox * scale);
          oy = Math.round(oy * scale);
        }
        sprites.push({
          id: `${prefix}_${r * cols + c}`,
          raw, ox, oy,
          sw: target ? Math.round(raw.width + ox * 2) : cw,
          sh: target ? Math.round(raw.height + oy * 2) : ch,
        });
      }
    }
  };

  // ── retratos de comandante ────────────────────────────────────────────────
  // Vão para um atlas próprio, marcado como preguiçoso: são 210 sprites de arte
  // densa que só o mapa de galáxias usa, e carregá-los no boot atrasaria a
  // primeira tela por vários megabytes.
  const portraitDir = path.join(VOID, 'transparent background');
  if (existsSync(portraitDir)) {
    const portraits = [];
    const collect = sprites.length;
    const files = (await readdir(portraitDir)).filter((f) => f.endsWith('.png')).sort(natural);
    for (let i = 0; i < files.length; i++) {
      await gridSheet(path.join(portraitDir, files[i]), 5, 2, `retrato/${i}`, 64);
    }
    portraits.push(...sprites.splice(collect));
    await writeAtlas('retratos', portraits, manifest, 2048, { lazy: true });
  }

  /**
   * Copia arquivos soltos de uma pasta para o atlas, com prefixo.
   * `max` limita o lado maior — os packs renderizados vêm em 128–256px, bem
   * acima do que a tela usa, e sem o teto o atlas passa de 12 MB.
   */
  const loose = async (dir, prefix, opts = {}) => {
    if (!existsSync(dir)) return;
    const filter = opts.filter ?? (() => true);
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.png') && filter(f))) {
      const source = await toRaw(path.join(dir, file));
      const trimmed = trimAlpha(source, 6);
      if (!trimmed) continue;

      let raw = trimmed.raw;
      let { ox, oy } = trimmed;
      let sw = source.width;
      let sh = source.height;
      const biggest = Math.max(raw.width, raw.height);
      if (opts.max && biggest > opts.max) {
        const scale = opts.max / biggest;
        const buf = await rawToSharp(raw)
          .resize(Math.max(1, Math.round(raw.width * scale)), Math.max(1, Math.round(raw.height * scale)), { kernel: 'lanczos3' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        raw = { data: buf.data, width: buf.info.width, height: buf.info.height };
        ox = Math.round(ox * scale);
        oy = Math.round(oy * scale);
        sw = Math.round(sw * scale);
        sh = Math.round(sh * scale);
      }

      const key = path.basename(file, '.png').toLowerCase().replace(/[^\w]+/g, '_');
      sprites.push({ id: `${prefix}/${key}`, raw, ox, oy, sw, sh });
    }
  };

  // Pack renderizado (Export/Small): chefes, inimigos, mísseis, coletáveis.
  await loose(path.join(VOID, 'Export', 'Base', 'Small'), 'render', { max: 112 });
  // Itens de power-up e naves pequenas.
  await loose(path.join(VOID, 'Power up ship item'), 'pwup');
  // SHMUP livre: naves, inimigos, explosões e projéteis extras.
  await loose(path.join(VOID, 'Pixel SHMUP Free 1.3', 'Pixel SHMUP Free'), 'shmup');
  await loose(path.join(VOID, 'Pixel SHMUP Free 1.3', 'Pixel SHMUP Free', 'Explosion'), 'shmup/boom');
  await loose(path.join(VOID, 'Pixel SHMUP Free 1.3', 'Pixel SHMUP Free', 'UI'), 'shmup/ui');
  // Naves avulsas: os arquivos "B" são a variante danificada do mesmo modelo.
  await loose(path.join(VOID, 'More assest and spaceships'), 'nave', { max: 128, filter: (f) => /^\d+B?\.png$/i.test(f) });

  await writeAtlas('galaxia', sprites, manifest, 2048);

  // ── catálogo de campos de estrela ─────────────────────────────────────────
  // Sem variedade aqui, toda galáxia usava as mesmas duas texturas e o fundo
  // ficava idêntico do setor 1 ao 200.
  manifest.starfields = [];
  const addStarfield = async (from, key, opts = {}) => {
    if (!existsSync(from)) return;
    const rel = `bg/campo_${key}.png`;
    let img = src(from);
    if (opts.rotate) img = img.rotate(opts.rotate);
    if (opts.flip) img = img.flop();
    await img.png({ compressionLevel: 9 }).toFile(await ensureFile(rel));
    const meta = await sharp(await ensureFile(rel)).metadata();
    manifest.starfields.push({ key, src: rel, w: meta.width, h: meta.height });
  };

  const shmupBg = path.join(VOID, 'Pixel SHMUP Free 1.3', 'Pixel SHMUP Free', 'Space Background');
  await addStarfield(path.join(shmupBg, 'stars_1.png'), 'shmup1');
  await addStarfield(path.join(shmupBg, 'stars_2.png'), 'shmup2');
  await addStarfield(path.join(RAW, 'Jogando', 'Background_Stars-0001.png'), 'grandes');
  await addStarfield(path.join(RAW, 'Jogando', 'Background_SmallStars-0001.png'), 'miudas');
  // Espelhadas e giradas contam como variantes: o olho não reconhece a mesma
  // constelação, e sai de graça em disco.
  await addStarfield(path.join(RAW, 'Jogando', 'Background_Stars-0001.png'), 'grandes_giro', { rotate: 90 });
  await addStarfield(path.join(RAW, 'Jogando', 'Background_SmallStars-0001.png'), 'miudas_espelho', { flip: true });
  await addStarfield(path.join(RAW, 'space_background_pack', 'Assets', 'Blue Version', 'layered', 'blue-stars.png'), 'azuis');
  log(`campos de estrela: ${manifest.starfields.length}`);
}

// ────────────────────────────────────────────────────────────────────────────
// novos icones.png — abas, moedas, baús, galáxias e ícones gerais
// ────────────────────────────────────────────────────────────────────────────
async function buildIcones(manifest) {
  const file = path.join(RAW, ICONES_SHEET);
  if (!existsSync(file)) {
    console.warn(`   ! ${ICONES_SHEET} não encontrado — pulando novos ícones`);
    return;
  }

  const sheet = await toRaw(file);
  log(`Ícones: ${ICONES_SHEET} (${sheet.width}x${sheet.height})`);
  const sprites = [];

  const take = (id, x, y, w, h) => {
    const region = unmatte(crop(sheet, x, y, w, h), ICONES_MATTE, 'solid');
    const trimmed = trimAlpha(region, 4);
    if (!trimmed) return;
    sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: w, sh: h });
  };

  /** Cor de um pixel da folha, para amostrar fundos. */
  const pixelAt = (x, y) => {
    const i = (y * sheet.width + x) * 4;
    return { r: sheet.data[i], g: sheet.data[i + 1], b: sheet.data[i + 2] };
  };

  // Botões de menu: só o miolo, sem a moldura nem o rótulo embutidos.
  // Cada botão tem o próprio fundo interno (roxo, azul, cinza…), então a matte
  // é AMOSTRADA de um canto vazio dentro dele. Usar uma cor fixa estourava o
  // fundo para branco ao desfazer a composição.
  MENU_ICONS.forEach((name, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const bx = MENU_ORIGIN.x + col * MENU_PITCH.x;
    const by = MENU_ORIGIN.y + row * MENU_PITCH.y;

    const matte = pixelAt(bx + 12, by + 8);
    const region = unmatte(
      crop(sheet, bx + MENU_ICON_INSET.x, by + MENU_ICON_INSET.y, MENU_ICON_INSET.w, MENU_ICON_INSET.h),
      matte,
      'solid',
    );
    const trimmed = trimAlpha(region, 8);
    if (!trimmed) return;
    sprites.push({
      id: `aba/${name}`,
      raw: trimmed.raw,
      ox: trimmed.ox,
      oy: trimmed.oy,
      sw: MENU_ICON_INSET.w,
      sh: MENU_ICON_INSET.h,
    });
  });

  // Demais faixas: cada sprite é achado por coluna vazia dentro da sua banda.
  for (const band of ICON_BANDS) {
    const strip = crop(sheet, RIGHT_PANEL.x0, band.y0, RIGHT_PANEL.x1 - RIGHT_PANEL.x0, band.y1 - band.y0);
    const clean = unmatte(strip, ICONES_MATTE, 'solid');
    const parts = rowComponents(clean, [{ y0: 0, y1: clean.height, name: band.name }], {
      gap: band.gap ?? 5,
      alphaFloor: band.alphaFloor ?? 14,
      minWidth: 8,
    });
    parts.forEach((comp, i) => {
      const cut = crop(clean, comp.x, comp.y, comp.w, comp.h);
      const trimmed = trimAlpha(cut, 6);
      if (!trimmed) return;
      sprites.push({
        id: `${band.name}_${i}`,
        raw: trimmed.raw,
        ox: trimmed.ox,
        oy: trimmed.oy,
        sw: comp.w,
        sh: comp.h,
      });
    });
  }

  await writeAtlas('icones', sprites, manifest, 2048);
}

// ────────────────────────────────────────────────────────────────────────────
// planetas.png — catálogo de corpos celestes do céu das fases
// ────────────────────────────────────────────────────────────────────────────
async function buildOrbes(manifest) {
  const file = path.join(RAW, PLANETAS_SHEET);
  if (!existsSync(file)) {
    console.warn(`   ! ${PLANETAS_SHEET} não encontrado — pulando corpos celestes`);
    return;
  }

  const sheet = await toRaw(file);
  log(`Corpos celestes: ${PLANETAS_SHEET} (${sheet.width}x${sheet.height})`);
  const sprites = [];

  const emit = (id, raw) => {
    const trimmed = trimAlpha(raw, 4);
    if (!trimmed) return;
    sprites.push({
      id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: raw.width, sh: raw.height,
    });
  };

  for (const faixa of PLANETA_FAIXAS) {
    const strip = alphaOverDark(
      crop(sheet, faixa.x0, faixa.y0, faixa.x1 - faixa.x0, faixa.y1 - faixa.y0),
      { flood: faixa.flood },
    );
    // Piso de alfa alto acha o CORPO (o halo de um planeta encosta no vizinho);
    // a expansão devolve o halo até o meio do vão.
    const corpos = sliceRow(strip, faixa.nomes.length, {
      gap: faixa.gap ?? 6,
      alphaFloor: faixa.alphaFloor ?? 200,
      minWidth: 10,
    });
    if (corpos.detected !== faixa.nomes.length) {
      console.warn(`   ! ${faixa.id} y=${faixa.y0}: detectou ${corpos.detected}, esperava ${faixa.nomes.length}`);
    }
    expandToNeighbours(corpos, strip.width).forEach((c, i) => {
      const nome = faixa.nomes[i];
      if (!nome) return;
      emit(`${faixa.id}/${nome}`, crop(strip, c.x, 0, c.w, strip.height));
    });
  }

  // Brilhos contínuos (nebulosa, anel, cauda) não têm coluna vazia entre si.
  for (const bloco of PLANETA_BLOCOS) {
    const strip = alphaOverDark(
      crop(sheet, bloco.x0, bloco.y0, bloco.x1 - bloco.x0, bloco.y1 - bloco.y0),
      { flood: bloco.flood },
    );
    const passo = strip.width / bloco.n;
    for (let i = 0; i < bloco.n; i++) {
      emit(`${bloco.id}/${i}`, crop(strip, Math.round(i * passo), 0, Math.round(passo), strip.height));
    }
  }

  log(`   ${sprites.length} corpos celestes`);
  await writeAtlas('orbe', sprites, manifest, 2048);
}

// ────────────────────────────────────────────────────────────────────────────
// sprites.png — naves, projéteis, obstáculos, explosões e power-ups
// ────────────────────────────────────────────────────────────────────────────
/**
 * Brilho do painel de `sprites.png`.
 *
 * Ao contrário de `planetas.png`, esta folha não está sobre preto puro: o painel
 * é um azul-escuro que chega a 18. Com o piso lá embaixo, o fundo inteiro saía
 * com alfa ~20 e a desmultiplicação o transformava em ruído aceso — a faixa
 * virava um componente só e nada era detectado.
 */
const PAINEL_PISO = 26;

async function buildSprites(manifest) {
  const file = path.join(RAW, SPRITES_SHEET);
  if (!existsSync(file)) {
    console.warn(`   ! ${SPRITES_SHEET} não encontrado — pulando folha de naves`);
    return;
  }

  const sheet = await toRaw(file);
  log(`Naves e efeitos: ${SPRITES_SHEET} (${sheet.width}x${sheet.height})`);
  const sprites = [];

  const emit = (id, raw) => {
    const trimmed = trimAlpha(raw, 5);
    if (!trimmed) return;
    sprites.push({
      id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: raw.width, sh: raw.height,
    });
  };

  PAINEIS.forEach((painel, p) => {
    const dx = p * PAINEL_PASSO;

    const lado = (v) => (Array.isArray(v) ? v[p] : v);

    for (const f of SPRITE_FILEIRAS) {
      const x0 = lado(f.x0), x1 = lado(f.x1);
      const strip = alphaOverDark(
        crop(sheet, x0 + dx, f.y0, x1 - x0, f.y1 - f.y0),
        { flood: f.flood ?? 46, lo: PAINEL_PISO, hi: PAINEL_PISO + 46 },
      );
      const corpos = sliceRow(strip, f.n, { gap: 5, alphaFloor: f.alphaFloor ?? 200, minWidth: 8 });
      if (corpos.detected !== f.n) console.warn(`   ! ${f.id}/${painel}: detectou ${corpos.detected}, esperava ${f.n}`);
      expandToNeighbours(corpos, strip.width).forEach((c, i) =>
        emit(`${f.id}/${painel}_${i}`, crop(strip, c.x, 0, c.w, strip.height)));
    }
  });

  // Projéteis: três por grupo de cor, aproveitando só o do meio.
  const grupo = (TIRO_BLOCO.x1 - TIRO_BLOCO.x0) / 3;
  for (const linha of TIRO_FILEIRAS) {
    linha.cores.forEach((cor, g) => {
      const x0 = Math.round(TIRO_BLOCO.x0 + g * grupo);
      const strip = alphaOverDark(
        crop(sheet, x0, linha.y0, Math.round(grupo), linha.y1 - linha.y0),
        { flood: 46, lo: PAINEL_PISO, hi: PAINEL_PISO + 46 },
      );
      const cols = sliceRow(strip, 3, { gap: 3, alphaFloor: 120, minWidth: 3 });
      const meio = cols[1];
      if (!meio) return;
      let cut = crop(strip, meio.x, 0, meio.w, strip.height);
      if (cor === TIRO_DESSATURA) cut = desaturate(cut, 0.88);
      emit(`tiro/${cor}_${linha.tamanho}`, cut);
    });
  }

  log(`   ${sprites.length} sprites de combate`);
  await writeAtlas('combate', sprites, manifest, 2048);
}

// ────────────────────────────────────────────────────────────────────────────
// SpaceRage — sprites verticais (jogador, inimigos, minas, explosões, FX)
// ────────────────────────────────────────────────────────────────────────────
async function buildFleetAtlas(manifest) {
  const root = path.join(RAW, 'Jogando', 'SpaceRage');
  const groups = [
    ['Player', 'sr/player'],
    ['Enemies', 'sr/enemy'],
    ['Explosions', 'sr/blast'],
    ['FX', 'sr/fx'],
  ];

  const sprites = [];
  for (const [folder, prefix] of groups) {
    const dir = path.join(root, folder);
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).filter((f) => f.endsWith('.png'))) {
      const raw = await toRaw(path.join(dir, f));
      const trimmed = trimAlpha(raw, 2);
      if (!trimmed) continue;
      sprites.push({
        id: `${prefix}/${path.basename(f, '.png')}`,
        raw: trimmed.raw,
        ox: trimmed.ox,
        oy: trimmed.oy,
        sw: raw.width,
        sh: raw.height,
      });
    }
  }

  // Fundo estrelado do SpaceRage: vira camada de céu tileável da vertical.
  const bg = path.join(root, 'BG.png');
  if (existsSync(bg)) {
    await src(bg).png({ compressionLevel: 9 }).toFile(await ensureFile('bg/starfield.png'));
    const meta = await src(bg).metadata();
    manifest.images['bg/starfield'] = { src: 'bg/starfield.png', w: meta.width, h: meta.height };
  }

  await writeAtlas('fleet', sprites, manifest);
}

// ────────────────────────────────────────────────────────────────────────────
// Naves de perfil + escapes + tiros + explosões — a camada horizontal
// ────────────────────────────────────────────────────────────────────────────
async function buildHullAtlas(manifest) {
  const parts = path.join(RAW, 'PNG_Parts&Spriter_Animation');
  const anims = path.join(RAW, 'PNG_Animations');
  const sprites = [];

  const push = async (file, id) => {
    if (!existsSync(file)) return;
    const raw = await toRaw(file);
    const trimmed = trimAlpha(raw, 2);
    if (!trimmed) return;
    sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: raw.width, sh: raw.height });
  };

  /** Naves soltas deste pack apontam para baixo; o combate do jogador aponta para cima. */
  const pushPlayerShip = async (file, id) => {
    if (!existsSync(file)) return;
    noteRead(file);
    const { data, info } = await src(file)
      .rotate(180)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { data, width: info.width, height: info.height };
    const trimmed = trimAlpha(raw, 2);
    if (!trimmed) return;
    sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: raw.width, sh: raw.height });
  };

  for (let n = 1; n <= 6; n++) {
    await push(path.join(parts, `Ship${n}`, `Ship${n}.png`), `hull/ship${n}`);

    for (const [kind, folder] of [['idle', 'Normal_flight'], ['boost', 'Turbo_flight']]) {
      const dir = path.join(anims, 'Exhaust', `Ship${n}`, folder);
      if (!existsSync(dir)) continue;
      const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
      for (let i = 0; i < files.length; i++) {
        await push(path.join(dir, files[i]), `hull/ship${n}_exhaust_${kind}_${i}`);
      }
    }

    // Tiros: `shotN_1..5` é o projétil; `shotN_expN` é o impacto.
    const shotDir = path.join(anims, 'Shots', `Shot${n}`);
    if (existsSync(shotDir)) {
      const files = (await readdir(shotDir)).filter((f) => f.endsWith('.png')).sort(natural);
      let fly = 0, hit = 0;
      for (const f of files) {
        if (/asset/i.test(f)) continue;
        const isHit = /exp/i.test(f);
        await push(path.join(shotDir, f), `hull/shot${n}_${isHit ? `hit_${hit++}` : `fly_${fly++}`}`);
      }
    }

    const expDir = path.join(anims, 'Explosions', `Ship${n}_Explosion`);
    if (existsSync(expDir)) {
      const files = (await readdir(expDir)).filter((f) => f.endsWith('.png')).sort(natural);
      for (let i = 0; i < files.length; i++) await push(path.join(expDir, files[i]), `hull/boom${n}_${i}`);
    }
  }

  await writeAtlas('hull', sprites, manifest);
}

// ────────────────────────────────────────────────────────────────────────────
// Spaceships 2.0 — catálogo visual avulso (jogador, inimigo e chefe)
// ────────────────────────────────────────────────────────────────────────────
const spaceships2Slug = (file) => {
  const stem = path.basename(file, '.png');
  const parenthesized = /^\((\d+)\)$/.exec(stem);
  if (parenthesized) return `p_${parenthesized[1]}`;
  const download = /^download(?: \((\d+)\))?$/i.exec(stem);
  if (download) return download[1] ? `d_${download[1]}` : 'd_base';
  return `n_${stem.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
};

async function buildSpaceships2Atlas(manifest) {
  const root = path.join(RAW, 'spaceships new', 'spaceships 2.0');
  if (!existsSync(root)) return;

  const sprites = [];
  const pushNormalized = async (file, id, rotate) => {
    noteRead(file);
    const pipeline = sharp(file);
    if (rotate) pipeline.rotate(180);
    const { data, info } = await pipeline
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { data, width: info.width, height: info.height };
    const trimmed = trimAlpha(raw, 2);
    if (!trimmed) return;
    sprites.push({ id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: raw.width, sh: raw.height });
  };

  const groups = [
    ['Jogador', 'player'],
    ['Inimigo', 'enemy'],
    ['Boss', 'boss'],
  ];
  for (const [folder, role] of groups) {
    const dir = path.join(root, folder);
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir)).filter((file) => file.toLowerCase().endsWith('.png')).sort(natural);
    for (const file of files) {
      const full = path.join(dir, file);
      const meta = await sharp(full).metadata();
      const square400 = meta.width === 400 && meta.height === 400;
      // O pack de 400 px já separa jogador (para baixo) de hostil (para baixo).
      // As artes menores vêm apontando para cima; o papel decide a correção.
      const rotate = role === 'player' ? square400 : !square400;
      await pushNormalized(full, `s2/${role}/${spaceships2Slug(file)}`, rotate);
    }
  }

  // Preserva também o pequeno lote que já existia na raiz antes das pastas.
  const legacy = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort(natural);
  const legacyPointingDown = new Set(['(16).png', '(60).png', '19.png']);
  for (const file of legacy) {
    await pushNormalized(
      path.join(root, file),
      `s2/player/legacy_${spaceships2Slug(file)}`,
      legacyPointingDown.has(file),
    );
  }

  log(`Spaceships 2.0: ${sprites.length} artes normalizadas`);
  await writeAtlas('spaceships2', sprites, manifest, 4096);
}

// ────────────────────────────────────────────────────────────────────────────
// Characters — retratos de aliados, jogadores e chefes convertidos
// ────────────────────────────────────────────────────────────────────────────
async function buildCharactersAtlas(manifest) {
  const root = path.join(RAW, 'spaceships new', 'Characters');
  if (!existsSync(root)) return;

  const groups = [
    ['Jogador', 'player'],
    ['Aliados', 'ally'],
    ['Inimigos', 'enemy'],
  ];
  const sprites = [];
  for (const [folder, role] of groups) {
    const dir = path.join(root, folder);
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir)).filter((file) => file.toLowerCase().endsWith('.png')).sort(natural);
    for (const file of files) {
      const full = path.join(dir, file);
      let raw = await toRaw(full);
      // Os retratos de Jogador vieram achatados sobre branco, enquanto os
      // demais grupos já têm alfa. Recuperar a transparência aqui impede que
      // uma foto branca quebre a identidade escura da Central de Missões.
      if (role === 'player') raw = unmatte(raw, { r: 255, g: 255, b: 255 }, 'solid');
      const slug = path.basename(file, '.png').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
      sprites.push({ id: `character/${role}/${slug}`, raw, ox: 0, oy: 0, sw: raw.width, sh: raw.height });
    }
  }

  log(`Characters: ${sprites.length} retratos`);
  await writeAtlas('characters', sprites, manifest, 2048, { lazy: true });
}

// ────────────────────────────────────────────────────────────────────────────
// Drone.png — folha 16x6 de 96px, animações rotuladas
// ────────────────────────────────────────────────────────────────────────────
async function buildDroneAtlas(manifest) {
  const file = path.join(RAW, 'Drone', 'Drone.png');
  if (!existsSync(file)) return;

  const CELL = 96;
  const ROWS = [
    ['attack', 8],
    ['death', 12],
    ['hurt', 4],
    ['fly', 4],
    ['idle', 6],
    ['dodge', 5],
  ];

  const sheet = await toRaw(file);
  const sprites = [];
  for (let r = 0; r < ROWS.length; r++) {
    const [name, count] = ROWS[r];
    for (let c = 0; c < count; c++) {
      const cell = crop(sheet, c * CELL, r * CELL, CELL, CELL);
      const trimmed = trimAlpha(cell, 2);
      if (!trimmed) continue;
      sprites.push({ id: `drone/${name}_${c}`, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy, sw: CELL, sh: CELL });
    }
  }
  await writeAtlas('drone', sprites, manifest);
}

// ────────────────────────────────────────────────────────────────────────────
// Parallax — camadas planetárias da faixa horizontal
// ────────────────────────────────────────────────────────────────────────────
async function buildParallax(manifest) {
  const root = path.join(RAW, 'parallax');
  if (!existsSync(root)) return;

  const biomes = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory());
  manifest.parallax = {};

  for (const biome of biomes) {
    const dir = path.join(root, biome.name);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    const layers = [];

    for (const f of files) {
      const key = path.basename(f, '.png').toLowerCase();
      const rel = `parallax/${biome.name}/${key}.png`;
      const meta = await src(path.join(dir, f)).metadata();
      const w = Math.max(1, Math.round((meta.width * BAR_LAYER_HEIGHT) / meta.height));

      await src(path.join(dir, f))
        .resize(w, BAR_LAYER_HEIGHT, { kernel: 'lanczos3' })
        .png({ compressionLevel: 9, palette: true, quality: 92 })
        .toFile(await ensureFile(rel));

      layers.push({ key, src: rel, w, h: BAR_LAYER_HEIGHT });
    }
    manifest.parallax[biome.name] = layers;
    log(`parallax/${biome.name}: ${layers.length} camadas → h${BAR_LAYER_HEIGHT}`);
  }
}

// O PlanetPack saiu do pipeline: seus planetas eram ícones de 32px ampliados
// para 128 e, no fundo da camada vertical, viravam borrões de silhueta idêntica.
// Quem faz esse papel agora é o atlas `orbe`, fatiado de `planetas.png`.

// ────────────────────────────────────────────────────────────────────────────
// space_background_pack — camadas tileáveis de espaço profundo (vertical)
// ────────────────────────────────────────────────────────────────────────────
async function buildDeepSpace(manifest) {
  const dir = path.join(RAW, 'space_background_pack', 'Assets', 'Blue Version', 'layered');
  if (!existsSync(dir)) return;

  manifest.deepspace = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.png') && !/preview/i.test(f))) {
    const key = path.basename(f, '.png').toLowerCase();
    const rel = `bg/deep_${key}.png`;
    const meta = await src(path.join(dir, f)).metadata();
    const scale = meta.width >= 200 ? 4 : 3; // tiles grandes viram fundo; props ficam menores
    await src(path.join(dir, f))
      .resize(meta.width * scale, meta.height * scale, { kernel: 'nearest' })
      .png()
      .toFile(await ensureFile(rel));
    manifest.deepspace.push({ key, src: rel, w: meta.width * scale, h: meta.height * scale });
  }
  log(`espaço profundo: ${manifest.deepspace.length} camadas`);
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────
async function writeAtlas(name, sprites, manifest, maxSize = 4096, opts = {}) {
  if (!sprites.length) return;

  const { width, height, placements } = packSkyline(
    sprites.map((s) => ({ id: s.id, w: s.raw.width, h: s.raw.height })),
    { padding: 1, maxSize },
  );

  const canvas = blank(width, height);
  const byId = new Map(sprites.map((s) => [s.id, s]));
  /** @type {Record<string, number[]>} */
  const frames = {};

  for (const p of placements) {
    const s = byId.get(p.id);
    blit(canvas, s.raw, p.x, p.y);
    // [x, y, w, h, offsetX, offsetY, sourceW, sourceH]
    frames[p.id] = [p.x, p.y, p.w, p.h, s.ox, s.oy, s.sw, s.sh];
  }

  await rawToSharp(canvas).png({ compressionLevel: 9 }).toFile(await ensureFile(`atlas/${name}.png`));
  await writeFile(path.join(OUT, 'atlas', `${name}.json`), JSON.stringify({ image: `${name}.png`, w: width, h: height, frames }));

  const bytes = (await stat(path.join(OUT, 'atlas', `${name}.png`))).size;
  manifest.atlases.push({
    name, image: `atlas/${name}.png`, data: `atlas/${name}.json`,
    w: width, h: height, count: placements.length,
    // Atlas preguiçoso não entra no boot; quem precisa pede por nome.
    ...(opts.lazy ? { lazy: true } : {}),
  });
  log(`atlas/${name}${opts.lazy ? ' (preguiçoso)' : ''}: ${placements.length} sprites → ${width}x${height} (${(bytes / 1024).toFixed(0)} KB)`);
}

async function ensureFile(rel) {
  const full = path.join(OUT, rel);
  await mkdir(path.dirname(full), { recursive: true });
  return full;
}

const base = (id) => id.split('/').pop();

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

main().catch((err) => {
  console.error('\n✖ falha no pipeline:', err);
  process.exit(1);
});

/**
 * `tiros e explosoes.png` — 6 elementos × 8 categorias (§21).
 *
 * Não declara quantos sprites cada célula tem: as categorias variam de dois a
 * seis por elemento, e uma tabela com 48 contagens à mão seria 48 chances de
 * errar em silêncio. A segmentação decide, e o total medido vai para o log.
 *
 * A extração mora em `lib/elemental.mjs` e não em `lib/imaging.mjs` porque as
 * duas suposições de lá falham nesta folha — fundo neutro e limiar absoluto.
 */
async function buildTiros(manifest) {
  const file = path.join(RAW, TIROS_SHEET);
  if (!existsSync(file)) {
    console.warn(`   ! ${TIROS_SHEET} não encontrado — pulando folha elemental`);
    return;
  }

  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  log(`Tiros e explosões: ${TIROS_SHEET} (${info.width}x${info.height})`);

  const sprites = [];
  let vazias = 0;

  for (const cat of CATEGORIAS) {
    // A fileira de glifos ocupa a largura inteira: um recorte só, e os índices
    // viram nome pela ORDEM DA FOLHA (seis grandes, depois seis pequenos).
    const celulas = cat.largura === 'total'
      ? [{ elemento: null, centro: null, x0: ROTULOS_ATE, w: info.width - ROTULOS_ATE }]
      : COLUNAS.map((c) => ({
        ...c,
        x0: Math.max(ROTULOS_ATE, c.centro - MEIA_CELULA),
        w: Math.min(info.width, c.centro + MEIA_CELULA) - Math.max(ROTULOS_ATE, c.centro - MEIA_CELULA),
      }));

    for (const col of celulas) {
      const { x0, w } = col;
      const celula = extrairCelula(data, info, x0, cat.y[0], w, cat.y[1] - cat.y[0]);

      const faixas = segmentarPorComponentes(celula, cat.vao ? { vaoFracao: cat.vao } : {});
      if (!faixas.length) { vazias++; continue; }

      faixas.forEach(([a, z], i) => {
        const cut = crop(celula, a, 0, z - a, celula.height);
        const trimmed = trimAlpha(cut, 6);
        if (!trimmed) return;
        // Sem coluna, o nome sai do índice: 0..5 grandes, 6..11 pequenos.
        const nome = col.elemento
          ? `${col.elemento}_${i}`
          : `${COLUNAS[i % COLUNAS.length].elemento}_${i < COLUNAS.length ? 'g' : 'p'}`;
        sprites.push({
          id: `${cat.id}/${nome}`,
          raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
          sw: cut.width, sh: cut.height,
        });
      });
    }
  }

  if (vazias) console.warn(`   ! ${vazias} células saíram vazias`);
  log(`   ${sprites.length} sprites elementais`);
  await writeAtlas('elemental', sprites, manifest, 2048);
}

/**
 * `novos itens.png` — 10 categorias × 7 raridades × 2 variantes (§23).
 *
 * O fundo de cada célula é uma placa escura com moldura da cor da raridade, e
 * não um gradiente tingido como na folha elemental: aqui `alphaOverDark`
 * SERVE, porque a placa é neutra. A moldura fica de fora pelo recuo — ela é
 * decoração da folha, e no jogo quem desenha a borda de raridade é a UI, que
 * precisa da cor viva mesmo quando o item está num slot pequeno.
 */
async function buildNovosItens(manifest) {
  const file = path.join(RAW, NOVOS_ITENS_SHEET);
  if (!existsSync(file)) {
    console.warn(`   ! ${NOVOS_ITENS_SHEET} não encontrado — pulando catálogo novo`);
    return;
  }

  noteRead(file);
  const { data: bruto, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  log(`Itens novos: ${NOVOS_ITENS_SHEET} (${info.width}x${info.height})`);

  const sprites = [];
  let vazias = 0;

  for (const c of celulasDeItem()) {
    // `extrairCelula` e não `alphaOverDark`: a placa de cada célula é TINGIDA na
    // cor da raridade — a de Divino é dourada e clara —, e o un-premultiply de
    // `alphaOverDark` deixava a placa opaca, virando um ladrilho quadrado em vez
    // de um ícone recortado. Mesmo defeito da folha elemental, mesma cura já
    // escrita: estimar o fundo POR CÉLULA.
    const região = extrairCelula(bruto, info, c.x, c.y, c.w, c.h, { margem: 34, piso: 0.25 });
    const trimmed = trimAlpha(região, 6);
    if (!trimmed) { vazias++; continue; }
    sprites.push({
      id: c.id, raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: c.w, sh: c.h,
    });
  }

  if (vazias) console.warn(`   ! ${vazias} células vazias no catálogo novo`);
  log(`   ${sprites.length} ícones de item`);
  await writeAtlas('itens-novos', sprites, manifest, 2048);
}

/**
 * `Recursos.png` — 70 recursos numa grade 10 × 7.
 *
 * Os ids saem de `data/recursos.ts` e são casados por ÍNDICE com a ordem de
 * leitura da folha. Casar por índice e não por nome é o que permite renomear um
 * recurso sem reexportar arte — e um teste confere que a contagem bate, para o
 * dia em que a folha ganhar uma fileira.
 */
async function buildRecursos(manifest) {
  /**
   * Duas pastas, e a 2.0 VENCE.
   *
   * `Recursos 2.0` tem os arquivos com o fundo já removido — canal alfa
   * de verdade, não estimativa. A pasta original tem os 70, mas sem alfa: são
   * recortes retangulares com o fundo da célula junto, e a extração automática
   * acerta a maioria e erra as bordas finas.
   *
   * Então a 2.0 entra INTACTA, sem passar por extração nenhuma — mexer no que
   * já veio pronto só teria como piorar —, e a original preenche o que falta.
   */
  const dirNovo = path.join(RAW, 'spaceships new', 'Recursos 2.0');
  const dirVelho = path.join(RAW, 'spaceships new', 'Recursos');

  const listar = async (dir) => (existsSync(dir)
    ? (await readdir(dir)).filter((f) => /.png$/i.test(f))
    : []);

  const prontos = await listar(dirNovo);
  const brutos = await listar(dirVelho);
  if (!prontos.length && !brutos.length) {
    console.warn('   ! nenhuma pasta de recurso encontrada');
    return;
  }

  const jaFeitos = new Set(prontos.map((f) => idDeRecurso(f.replace(/.png$/i, ''))));
  const sprites = [];

  // Os que já vieram com alfa: não passam por extração de fundo. A única
  // transformação é limitar o lado maior a 160 px PARA O ATLAS. As fontes 2.0
  // variam de 111 a 1024 px; empacotá-las na resolução original estouraria
  // 2048 px e não traria ganho, pois a maior exibição no jogo usa 112 px.
  for (const f of prontos) {
    const src = path.join(dirNovo, f);
    noteRead(src);
    const buffer = await sharp(src)
      .resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const raw = await toRaw(buffer);
    const trimmed = trimAlpha(raw, 6);
    if (!trimmed) { console.warn(`   ! recurso vazio (2.0): ${f}`); continue; }
    sprites.push({
      id: `recurso/${idDeRecurso(f.replace(/.png$/i, ''))}`,
      raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: raw.width, sh: raw.height,
    });
  }

  // Os que faltam: extração automática do arquivo sem alfa.
  let extraidos = 0;
  for (const f of brutos) {
    const id = idDeRecurso(f.replace(/.png$/i, ''));
    if (jaFeitos.has(id)) continue;

    const src = path.join(dirVelho, f);
    noteRead(src);
    const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });

    // Repescagem com pisos menores: o percentil 30 assume que ao menos um terço
    // do arquivo é fundo, e falha quando o ícone ocupa quase tudo.
    let trimmed = null;
    for (const piso of [0.3, 0.12, 0.04]) {
      const região = extrairCelula(data, info, 0, 0, info.width, info.height, { margem: 38, piso });
      trimmed = trimAlpha(região, 6);
      if (trimmed) break;
    }
    if (!trimmed) { console.warn(`   ! recurso vazio: ${f}`); continue; }

    sprites.push({
      id: `recurso/${id}`,
      raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: info.width, sh: info.height,
    });
    extraidos++;
  }

  log(`Recursos: ${prontos.length} já com alfa + ${extraidos} extraídos`);
  await writeAtlas('recursos', sprites, manifest, 2048);
}

/**
 * Id a partir do nome do arquivo — a MESMA regra de `data/recursos.ts`.
 *
 * Repetida porque o pipeline roda em Node puro e não importa `src/`. Um teste
 * confere que todo recurso do catálogo acha o seu sprite, que é o que impede as
 * duas cópias de divergirem.
 */
/**
 * Nomes de arquivo que divergem do catálogo.
 *
 * A arte veio com variações e erros de digitação — `TECNIO` para Tecnécio,
 * `NEOINIO` para Neônio, `LAGRIMA GALATICA` sem o "c" de Galáctica. O catálogo
 * é a fonte de verdade do nome de EXIBIÇÃO, então quem se ajusta é o arquivo:
 * renomear a arte quebraria a próxima entrega que viesse com o nome original.
 */
const APELIDOS = {
  tecnio: 'tecnecio',
  neoinio: 'neonio',
  lagrima_galatica: 'lagrima_galactica',
};

function idDeRecurso(nome) {
  const bruto = normalizarId(nome);
  return APELIDOS[bruto] ?? bruto;
}

function normalizarId(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * `spaceships new/backgrounds` — 19 conjuntos de fundo, três camadas cada.
 *
 * Cada conjunto é `layer1_far`, `layer2_nebula` e `layer3_stars` em 1920×1080.
 * Saem como IMAGENS e não como atlas: um atlas de 57 quadros de tela cheia
 * daria 118 milhões de pixels, e nenhum deles é desenhado junto de outro — o
 * fundo é uma camada por vez, e carregar sob demanda é o comportamento certo.
 *
 * Vão a 1280 de largura. Em 1920 o arquivo triplica e a cena nunca desenha o
 * fundo maior que a coluna central, que no monitor mais largo previsto (§ do
 * layout) fica em torno de 1180 px lógicos.
 */
async function buildFundosDeGalaxia(manifest) {
  const dir = path.join(RAW, 'spaceships new', 'backgrounds');
  if (!existsSync(dir)) {
    console.warn('   ! backgrounds/ não encontrado — pulando fundos novos');
    return;
  }

  const conjuntos = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  log(`Fundos de galáxia: ${conjuntos.length} conjuntos`);
  manifest.fundos = [];

  for (const nome of conjuntos) {
    // O id é derivado do NOME DA PASTA, normalizado: as pastas vêm com hífen,
    // espaço e numeração inconsistentes (`14-blue`, `17- toxic`), e um id com
    // espaço quebraria o caminho no manifesto.
    const id = nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    /**
     * A convenção de três camadas vale para 12 dos 19 conjuntos.
     *
     * Os outros vieram de packs diferentes: uns têm cinco variações `_FLAT`,
     * um tem duas imagens com nomes próprios, dois estão vazios. Exigir os três
     * nomes canônicos descartava sete conjuntos em SILÊNCIO — medido, saíam 12
     * de 19 e o log não dizia o que faltou.
     *
     * Então o recorte é por CONTEÚDO: se as três camadas existem, o conjunto é
     * de parallax; se não, cada PNG vira uma variação chapada do mesmo lugar.
     */
    const arquivos = (await readdir(path.join(dir, nome))).filter((f) => /.png$/i.test(f));
    if (!arquivos.length) {
      console.warn(`   ! fundo ${nome}: pasta vazia`);
      continue;
    }

    const emitir = async (arquivo, sufixo) => {
      const src = path.join(dir, nome, arquivo);
      noteRead(src);
      // WEBP e não PNG: são 44 imagens de tela cheia, e em PNG davam 62 MB —
      // inaceitável para um jogo que carrega no navegador. WebP aceita alfa
      // (as camadas de nebulosa e estrela têm) e comprime uma ordem de grandeza
      // melhor em arte com gradiente, que é exatamente o que um fundo é.
      const rel = `fundo/${id}_${sufixo}.webp`;
      await sharp(src)
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(await ensureFile(rel));
      return rel;
    };

    const temParallax = ['layer1_far.png', 'layer2_nebula.png', 'layer3_stars.png']
      .every((f) => arquivos.includes(f));

    if (temParallax) {
      manifest.fundos.push({
        id,
        tipo: 'parallax',
        camadas: {
          longe: await emitir('layer1_far.png', 'longe'),
          nebulosa: await emitir('layer2_nebula.png', 'nebulosa'),
          estrelas: await emitir('layer3_stars.png', 'estrelas'),
        },
      });
    } else {
      // Variações chapadas: cada arquivo é um fundo completo do mesmo lugar, e
      // a galáxia sorteia uma. Menos profundidade que o parallax, mas é a arte
      // que existe — descartá-la seria perder sete cenários.
      const variacoes = [];
      for (const [i, f] of arquivos.sort().entries()) variacoes.push(await emitir(f, String(i)));
      manifest.fundos.push({ id, tipo: 'chapado', variacoes });
    }
  }

  const parallax = manifest.fundos.filter((f) => f.tipo === 'parallax').length;
  log(`   ${parallax} em parallax, ${manifest.fundos.length - parallax} chapados`);
}

/**
 * `spaceships new/Asteroids and junks` — 30 destroços de cenário.
 *
 * São 24×25 px cada, então vão para atlas: sprites minúsculos desenhados vários
 * por quadro é exatamente o caso em que empacotar paga.
 */
async function buildDestrocos(manifest) {
  const dir = path.join(RAW, 'spaceships new', 'Asteroids and junks');
  if (!existsSync(dir)) {
    console.warn('   ! Asteroids and junks/ não encontrado — pulando destroços');
    return;
  }

  const arquivos = (await readdir(dir)).filter((f) => /\.png$/i.test(f)).sort();
  const sprites = [];

  for (const f of arquivos) {
    const src = path.join(dir, f);
    noteRead(src);
    const raw = await toRaw(src);
    const trimmed = trimAlpha(raw, 4);
    if (!trimmed) continue;
    // O id vem do NÚMERO no nome do arquivo, não do nome inteiro: os arquivos
    // se chamam `Aestroid and space junk (7).png` — com erro de digitação e
    // espaços —, e um id assim não sobrevive a uma renomeação da pasta.
    const n = /\((\d+)\)/.exec(f)?.[1] ?? String(sprites.length);
    sprites.push({
      id: `destroco/${n.padStart(2, '0')}`,
      raw: trimmed.raw, ox: trimmed.ox, oy: trimmed.oy,
      sw: raw.width, sh: raw.height,
    });
  }

  log(`Destroços: ${sprites.length} peças de cenário`);
  await writeAtlas('destrocos', sprites, manifest, 512);
}

/**
 * `fabricação 2.png` — as peças de interface (§25).
 *
 * Saem como IMAGENS soltas e não como atlas: quem as consome é o CSS, por
 * `border-image` e `background-image`, e CSS não sabe recortar de um atlas sem
 * uma tabela de posições que teria de ser mantida à mão nos dois lados.
 *
 * Já vêm com alfa, então não passam por extração nenhuma — só recorte e apara.
 */
async function buildInterface(manifest) {
  const file = path.join(RAW, 'spaceships new', INTERFACE_SHEET);
  const alt = path.join(RAW, INTERFACE_SHEET);
  const src = existsSync(file) ? file : existsSync(alt) ? alt : null;
  if (!src) {
    console.warn(`   ! ${INTERFACE_SHEET} não encontrado — pulando peças de interface`);
    return;
  }

  noteRead(src);
  const folha = await toRaw(src);
  log(`Interface: ${INTERFACE_SHEET} (${folha.width}x${folha.height})`);

  manifest.interface = {};
  const recortar = async (chapa, pecas) => {
    for (const p of pecas) {
      const rel = `ui/${p.id}.png`;
      await rawToSharp(crop(chapa, p.x, p.y, p.w, p.h))
        .png({ compressionLevel: 9 })
        .toFile(await ensureFile(rel));
      manifest.interface[p.id] = { src: rel, w: p.w, h: p.h, ...(p.slice ? { slice: p.slice } : {}) };
    }
  };
  await recortar(folha, PECAS);

  // Segunda chapa: as peças de Missões. Duas folhas em vez de uma porque foram
  // geradas em pedidos diferentes — forçar a segunda de volta para dentro da
  // primeira seria retrabalho sem ganho nenhum.
  let missoes = 0;
  {
    const m1 = path.join(RAW, 'spaceships new', MISSOES_SHEET);
    const m2 = path.join(RAW, MISSOES_SHEET);
    const alvo = existsSync(m1) ? m1 : existsSync(m2) ? m2 : null;
    if (!alvo) {
      console.warn(`   ! ${MISSOES_SHEET} não encontrado — pulando peças de missões`);
    } else {
      noteRead(alvo);
      const chapa = await toRaw(alvo);
      log(`Interface: ${MISSOES_SHEET} (${chapa.width}x${chapa.height})`);
      await recortar(chapa, PECAS_MISSOES);
      missoes = PECAS_MISSOES.length;
    }
  }

  // Peças que vieram em arquivo próprio.
  let soltas = 0;
  for (const p of PECAS_SOLTAS) {
    const f = path.join(RAW, 'spaceships new', p.arquivo);
    if (!existsSync(f)) { console.warn(`   ! ${p.arquivo} não encontrado`); continue; }
    noteRead(f);
    const raw = await toRaw(f);
    const rel = `ui/${p.id}.png`;
    await rawToSharp(raw).png({ compressionLevel: 9 }).toFile(await ensureFile(rel));
    manifest.interface[p.id] = { src: rel, w: raw.width, h: raw.height, ...(p.slice ? { slice: p.slice } : {}) };
    soltas++;
  }

  log(`   ${PECAS.length + soltas + missoes} peças de interface`);
}
