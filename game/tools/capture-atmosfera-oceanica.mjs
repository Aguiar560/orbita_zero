import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/aguia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/Users/aguia/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const erros = [];
page.on('pageerror', erro => erros.push(erro.message));
const origem = process.env.QA_ORIGEM ?? 'http://127.0.0.1:5181';
const requisicoes = [];
page.on('request', req => requisicoes.push(req.url()));
await page.route('**/*', route => new URL(route.request().url()).origin === origem ? route.continue() : route.abort());
await mkdir('.snapshots', { recursive: true });
const salvar = async nome => {
  const pixels = await page.locator('#stage').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
  await writeFile(`.snapshots/${nome}.png`, Buffer.from(pixels, 'base64'));
};
try {
  await page.goto(origem);
  await page.waitForFunction(() => window.oz?.vertical);
  await page.evaluate(async () => {
    const { assets } = await import('/src/render/Assets.ts');
    const { ARTES_ATMOSFERA_OCEANICA } = await import('/src/data/atmosfera-oceanica.ts');
    await Promise.all(Object.values(ARTES_ATMOSFERA_OCEANICA).map(p => assets.image(p)));
    await assets.image('fundo/bioma-atmosfera-longo.webp');
    const sim = window.oz.debugSim;
    sim.state.run.sector = 1;
    sim.state.settings.testMode = false;
    sim.state.settings.reduceEffects = false;
    sim.refreshEncounter();
    const modo = window.oz.vertical;
    modo.syncEncounter(true);
    modo.bannerTime = 0;
    modo.elapsed = 8;
    modo.draw();
  });
  await salvar('atmosfera-galaxia-1-desktop');
  const desempenho = await page.evaluate(() => {
    const modo = window.oz.vertical;
    const medir = reduzido => {
      window.oz.debugSim.state.settings.reduceEffects = reduzido;
      const amostras = [];
      for (let i = 0; i < 100; i++) {
        modo.elapsed = i / 60 + 8;
        const inicio = performance.now();
        modo.draw();
        amostras.push(performance.now() - inicio);
      }
      amostras.sort((a, b) => a - b);
      return { mediana: amostras[50], p95: amostras[95] };
    };
    return { reduzido: medir(true), completo: medir(false) };
  });
  console.log('Tempo CPU de submissão draw (não é FPS/GPU):', desempenho);
  const isolamento = await page.evaluate(() => {
    const modo = window.oz.vertical, sim = window.oz.debugSim;
    const verificar = (teste, setor, reduzido = false) => {
      sim.state.settings.testMode = teste;
      sim.state.settings.reduceEffects = reduzido;
      sim.state.run.sector = setor;
      modo.elapsed = 8;
      modo.draw();
      return modo.temAtmosferaOceanica;
    };
    const resultado = { campanha: verificar(false, 1), galaxia2: verificar(false, 11), teste: verificar(true, 1), reduzido: verificar(false, 1, true) };
    sim.state.settings.testMode = false;
    return resultado;
  });
  if (!isolamento.campanha || isolamento.galaxia2 || !isolamento.teste || !isolamento.reduzido) throw Error(JSON.stringify(isolamento));
  await salvar('atmosfera-galaxia-1-reduzida');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.oz.debugSim.state.settings.reduceEffects = false;
    window.oz.vertical.draw();
  });
  await salvar('atmosfera-galaxia-1-mobile');
  await page.evaluate(() => {
    window.oz.vertical.elapsed = 30;
    window.oz.vertical.draw();
  });
  await salvar('atmosfera-galaxia-1-mobile-30s');
  await page.evaluate(() => {
    const modo = window.oz.vertical;
    for (let i = 0; i < 240; i++) modo.update(1 / 60);
    modo.draw();
  });
  await salvar('atmosfera-galaxia-1-mobile-combate');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.oz.vertical.draw());
  await salvar('atmosfera-galaxia-1-desktop-combate');
  if (requisicoes.some(url => url.endsWith('/rele.webp'))) throw Error('Satélite ainda é carregado');
  if (erros.length) throw new Error(erros.join('\n'));
  console.log('Isolamento e capturas OK:', isolamento);
} finally { await browser.close(); }
