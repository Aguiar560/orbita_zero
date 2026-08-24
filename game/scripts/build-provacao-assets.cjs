const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assets } = require('./validate-provacao-assets.cjs');

const project = path.resolve(__dirname, '..');
const rawRoot = path.resolve(project, '..', 'provacao-art-drafts', 'raw');
const staticRoot = path.join(project, 'assets-static', 'ui', 'provacao');
const publicRoot = path.join(project, 'public', 'assets', 'ui', 'provacao');
const processor = path.join(project, 'scripts', 'process-provacao-asset.cjs');
const validator = path.join(project, 'scripts', 'validate-provacao-assets.cjs');

function assertInsideProject(target) {
  const relative = path.relative(project, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Destino fora do projeto: ${target}`);
  }
}

function sourceFor(asset) {
  const relative = asset.file.replace(/\.(png|webp)$/i, '.source.png');
  const standard = path.join(rawRoot, ...relative.split('/'));
  if (asset.id === 'prv_painel_9slice') {
    const corrected = standard.replace(/\.source\.png$/i, '.alpha-source.png');
    if (fs.existsSync(corrected)) return corrected;
  }
  return standard;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: project, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`${command} falhou:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function main() {
  assertInsideProject(staticRoot);
  assertInsideProject(publicRoot);
  fs.rmSync(staticRoot, { recursive: true, force: true });
  fs.mkdirSync(staticRoot, { recursive: true });

  for (const asset of assets) {
    const source = sourceFor(asset);
    const output = path.join(staticRoot, ...asset.file.split('/'));
    if (!fs.existsSync(source)) throw new Error(`Fonte ausente: ${source}`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    run(process.execPath, [processor, source, output, String(asset.width), String(asset.height), asset.mode]);
  }

  fs.mkdirSync(publicRoot, { recursive: true });
  fs.cpSync(staticRoot, publicRoot, { recursive: true, force: true });
  const validation = run(process.execPath, [validator]);
  fs.copyFileSync(path.join(publicRoot, 'manifest.json'), path.join(staticRoot, 'manifest.json'));
  console.log(`OK: ${assets.length} assets reconstruidos em ${staticRoot}`);
  console.log(validation);
}

main();
