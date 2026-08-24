const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve('public/assets/ui/provacao');
const manifestPath = path.join(root, 'manifest.json');

const assets = [];
const add = (category, directory, width, height, names, extension = 'png', mode = extension === 'png' ? 'alpha' : 'opaque-cover') => {
  for (const name of names) {
    assets.push({
      id: name,
      category,
      file: `${directory}/${name}.${extension}`,
      width,
      height,
      alpha: extension === 'png',
      mode,
    });
  }
};

add('backgrounds', 'backgrounds', 1024, 1536, ['prv_torre_fundo'], 'webp');
add('effects', 'effects', 96, 512, ['prv_linha_marcos'], 'png', 'alpha-black');
add('floors', 'floors', 1024, 224, ['prv_piso_base_9slice']);
add('floors', 'floors', 1024, 224, [
  'prv_piso_bloqueado_overlay',
  'prv_piso_chefe_overlay',
  'prv_piso_concluido_overlay',
  'prv_piso_selecionado_overlay',
], 'png', 'alpha-black');
add('floors', 'floors', 128, 128, ['prv_selo_octogonal'], 'png', 'alpha-black');
add('frames', 'frames', 2048, 1366, ['prv_moldura_externa'], 'png', 'alpha-hollow');
add('frames', 'frames', 1536, 128, ['prv_barra_superior_9slice']);
add('frames', 'frames', 512, 512, ['prv_painel_9slice']);
add('frames', 'frames', 1536, 72, ['prv_rodape_info_9slice']);
add('frames', 'frames', 768, 80, ['prv_titulo_secao_9slice']);
add('icons', 'icons', 128, 128, ['prv_alvo_torre'], 'png', 'alpha-black');
add('icons', 'icons', 96, 96, [
  'prv_icone_ajuda', 'prv_icone_cadeado', 'prv_icone_check', 'prv_icone_chefe',
  'prv_icone_fechar', 'prv_icone_info', 'prv_icone_loja', 'prv_icone_ranking',
  'prv_icone_relogio',
], 'png', 'alpha-black');
add('icons', 'icons', 64, 64, ['prv_marco_atual', 'prv_marco_feito', 'prv_marco_futuro'], 'png', 'alpha-black');
add('icons', 'icons', 96, 128, ['prv_seta_baixo', 'prv_seta_direita', 'prv_seta_esquerda'], 'png', 'alpha-black');
add('icons', 'icons', 80, 80, ['prv_tentativa_cheia', 'prv_tentativa_vazia'], 'png', 'alpha-black');
add('modifiers', 'icons/modifiers', 128, 128, [
  'prv_mod_blindado', 'prv_mod_colosso', 'prv_mod_enxame', 'prv_mod_espelho',
  'prv_mod_fragmentador', 'prv_mod_furia', 'prv_mod_pressa', 'prv_mod_refletor',
  'prv_mod_regenerador', 'prv_mod_sufocante', 'prv_mod_veloz',
], 'png', 'alpha-black');
add('rewards', 'icons/rewards', 256, 256, ['prv_bau_torre'], 'png', 'alpha-black');
add('rewards', 'icons/rewards', 96, 96, [
  'prv_icone_cristal_azul', 'prv_icone_cristal_vermelho',
  'prv_icone_cubo_roxo_a', 'prv_icone_cubo_roxo_b',
], 'png', 'alpha-black');
add('rewards', 'icons/rewards', 128, 128, [
  'prv_rec_cristal', 'prv_rec_exclusivo', 'prv_rec_item', 'prv_rec_material',
  'prv_rec_medalha', 'prv_rec_nucleo', 'prv_rec_sucata', 'prv_rec_xp',
], 'png', 'alpha-black');
add('panels', 'panels', 160, 112, ['prv_botao_hexagonal'], 'png', 'alpha-black');
add('panels', 'panels', 768, 104, ['prv_botao_lateral_9slice']);
add('panels', 'panels', 768, 144, ['prv_botao_primario_9slice']);
add('panels', 'panels', 1024, 416, ['prv_chefe_frame_9slice']);
add('panels', 'panels', 1024, 224, ['prv_conclusao_frame_9slice']);
add('panels', 'panels', 384, 224, ['prv_mod_card_9slice']);
add('panels', 'panels', 512, 48, ['prv_poder_barra_base']);
add('panels', 'panels', 640, 384, ['prv_progresso_moldura_9slice']);
add('panels', 'panels', 160, 160, ['prv_recompensa_slot'], 'png', 'alpha-black');

async function validate() {
  const errors = [];
  const records = [];

  for (const asset of assets) {
    const absolute = path.join(root, ...asset.file.split('/'));
    if (!fs.existsSync(absolute)) {
      errors.push(`Ausente: ${asset.file}`);
      continue;
    }

    const metadata = await sharp(absolute).metadata();
    const stats = await sharp(absolute).stats();
    if (metadata.width !== asset.width || metadata.height !== asset.height) {
      errors.push(`Dimensao incorreta: ${asset.file} (${metadata.width}x${metadata.height})`);
    }
    if (asset.alpha && !metadata.hasAlpha) {
      errors.push(`Sem alpha: ${asset.file}`);
    }
    if (asset.alpha && metadata.hasAlpha && stats.channels[3].min === 255) {
      errors.push(`Alpha totalmente opaco: ${asset.file}`);
    }
    records.push({ ...asset, format: metadata.format, channels: metadata.channels });
  }

  const actual = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(png|webp)$/i.test(entry.name)) actual.push(path.relative(root, absolute).replaceAll('\\', '/'));
    }
  };
  walk(root);

  const expectedFiles = new Set(assets.map((asset) => asset.file));
  for (const file of actual) {
    if (!expectedFiles.has(file)) errors.push(`Arquivo nao catalogado: ${file}`);
  }
  if (actual.length !== assets.length) {
    errors.push(`Contagem incorreta: ${actual.length} encontrados, ${assets.length} esperados`);
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify({ version: 1, assetCount: records.length, assets: records }, null, 2)}\n`);

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`OK: ${records.length} assets validados; manifesto em ${manifestPath}`);
}

module.exports = { assets, root, validate };

if (require.main === module) {
  validate().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
