const { createRequire } = await import('node:module');
const { writeFile } = await import('node:fs/promises');
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/aguia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/aguia/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const erros = [];
page.on('pageerror', erro => erros.push(erro.message));
await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:5181' ? route.continue() : route.abort());
const salvarCanvas = async (nome) => {
  const pixels = await page.locator('#stage').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
  await writeFile(`.snapshots/${nome}.png`, Buffer.from(pixels, 'base64'));
};
try {
  await page.goto('http://127.0.0.1:5181');
  await page.waitForFunction(() => window.oz?.vertical);
  await page.evaluate(() => {
    const modo = window.oz.vertical;
    modo.player.invuln = 0;
    modo.player.shield = 0;
    modo.player.hp = modo.player.hpMax * 0.08;
    modo.draw();
  });
  await salvarCanvas('feedback-casco-critico');

  await page.evaluate(() => {
    const modo = window.oz.vertical;
    modo.player.hp = modo.player.hpMax;
    modo.player.shield = modo.player.shieldMax;
    modo.player.invuln = 0;
    modo.damagePlayer(4, 'raio', { x: modo.player.x + 12, y: modo.player.y - 12, cor: '#41dbff' });
    modo.draw();
  });
  await salvarCanvas('feedback-impacto-escudo');

  await page.evaluate(() => {
    const modo = window.oz.vertical;
    modo.particles.clear();
    modo.celebrarNivelDaNave(12);
    modo.draw();
  });
  await salvarCanvas('feedback-nivel-nave');

  const antes = await page.evaluate(() => window.oz.vertical.audio.contexto === null);
  if (!antes) throw new Error('Áudio inicializou antes do gesto.');
  await page.mouse.click(15, 15);
  await page.waitForFunction(() => window.oz.vertical.audio.contexto?.state === 'running');
  const audio = await page.evaluate(async () => {
    const modo = window.oz.vertical;
    const motor = modo.audio;
    const analyser = motor.contexto.createAnalyser();
    analyser.fftSize = 2048;
    motor.ganho.connect(analyser);
    const medir = async (disparar) => {
      disparar();
      await new Promise(r => setTimeout(r, 45));
      const dados = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(dados);
      return Math.sqrt(dados.reduce((s, v) => s + v * v, 0) / dados.length);
    };
    const tiro = await medir(() => modo.firePlayer());
    const explosao = await medir(() => motor.explosaoDeChefe('fogo', 0));
    window.oz.debugSim.state.settings.muted = true;
    motor.atualizar();
    modo.firePlayer();
    const vozesMudo = motor.vozes.size;
    window.oz.debugSim.state.settings.muted = false;
    motor.atualizar();
    analyser.disconnect();
    return { tiro, explosao, vozesMudo, buffers: motor.buffers.size };
  });
  if (!(audio.tiro > 0 && audio.explosao > 0 && audio.vozesMudo === 0)) throw new Error(JSON.stringify(audio));
  console.log('Áudio real / RMS:', audio);

  // Checagens comportamentais dos efeitos: trocar casco não é subir de nível.
  const efeitos = await page.evaluate(() => {
    const modo = window.oz.vertical;
    const sim = window.oz.debugSim;
    modo.pulsoDeNivel = 0;
    modo.refreshPlayer(true);
    sim.naveAtiva.nivel++;
    modo.refreshPlayer();
    const pulso = modo.pulsoDeNivel;
    modo.pulsoDeNivel = 0;
    modo.refreshPlayer();
    const repetiu = modo.pulsoDeNivel;
    modo.player.invuln = 0;
    modo.player.hp = modo.player.hpMax;
    modo.player.shield = 0;
    modo.particles.clear();
    modo.damagePlayer(1, 'fogo', { x: modo.player.x + 9, y: modo.player.y, cor: '#ff8833' });
    const faiscas = modo.particles.parts.items.filter(p => p.alive && p.kind === 'spark').length;
    return { pulso, repetiu, faiscas };
  });
  if (efeitos.pulso !== 1 || efeitos.repetiu !== 0 || efeitos.faiscas === 0) throw new Error(JSON.stringify(efeitos));
  console.log('Efeitos:', efeitos);

  await page.evaluate(async () => {
    const { montarResultadoDaProvacao } = await import('/src/ui/ProvacaoResultado.ts');
    const sim = window.oz.debugSim;
    document.body.replaceChildren();
    window.qaResultado = (tipo = 'primeira') => {
      document.querySelector('.prv-res')?.remove();
      const r = {
        venceu: tipo !== 'derrota', piso: tipo === 'marco' ? 10 : 3, chefe: 'Prensa Orbital',
        camadas: tipo === 'marco' ? ['primeira', 'marco'] : tipo === 'repeticao' ? ['repeticao'] : ['primeira'],
        tempo: 23, danoCausado: 18170, danoRecebido: 420, recorde: tipo === 'marco', recordeAnterior: 31,
        ganhos: { sucata: 1800, nucleos: 145, itens: 1, medalhas: 1, materiais: {} },
        proximoPiso: tipo === 'repeticao' || tipo === 'derrota' ? 0 : tipo === 'marco' ? 11 : 4,
        vidaRestanteDoChefe: tipo === 'derrota' ? .18 : 0, dica: 'Revise o escudo e o elemento da arma.',
      };
      const el = montarResultadoDaProvacao(sim, r, () => el.remove());
      document.body.append(el);
    };
    window.qaResultado();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.snapshots/provacao-conquista-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '.snapshots/provacao-conquista-mobile.png' });
  for (const tipo of ['primeira', 'marco', 'repeticao', 'derrota']) {
    await page.setViewportSize({ width: 390, height: 460 });
    await page.evaluate(tipo => window.qaResultado(tipo), tipo);
    await page.waitForTimeout(300);
    const estado = await page.evaluate(() => ({
      transbordou: document.documentElement.scrollWidth > innerWidth,
      altura: document.querySelector('.prv-res-caixa').getBoundingClientRect().height,
      foco: document.activeElement?.classList.contains('prv-res-ok'),
    }));
    if (estado.transbordou || estado.altura > 429 || !estado.foco) throw new Error(JSON.stringify({ tipo, estado }));
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    if (await page.locator('.prv-res').count()) throw new Error('Escape não fechou o resultado.');
    console.log('Resultado validado:', tipo, estado);
  }
  if (erros.length) throw new Error(erros.join('\n'));
} finally {
  await browser.close();
}
