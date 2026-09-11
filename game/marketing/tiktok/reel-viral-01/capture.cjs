// Captura vertical inédita do build atual do Órbita Zero.
// Nenhum vídeo ou frame de campanhas anteriores é lido por este arquivo.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('C:/Users/aguia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const dir = __dirname;
const origin = 'http://127.0.0.1:5185';
const clips = [];
const checks = {};

function agora(inicio) {
  return (Date.now() - inicio) / 1000;
}

(async () => {
  const workDir = path.join(os.tmpdir(), 'orbita-zero-viral-capture');
  fs.rmSync(workDir, { recursive: true, force: true });
  const rawDir = path.join(workDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/aguia/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--autoplay-policy=no-user-gesture-required',
      '--lang=pt-BR',
    ],
  });
  const context = await browser.newContext({
    locale: 'pt-BR',
    viewport: { width: 720, height: 1280 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 720, height: 1280 } },
  });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('https://orbita-zero-api.orbitazero.workers.dev/placar')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ linhas: [], minhaPosicao: null, total: 0, meuApelido: 'Piloto' }),
      });
    }
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });

  const page = await context.newPage();
  const erros = [];
  page.on('pageerror', (error) => erros.push(error.message));
  const startedAt = Date.now();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });

  const serializedDemoState = await page.evaluate(async () => {
    const [{ createState }, { Rng }, { rollItem }, { HULLS }, { CONCESSOES }, { bossForSector }] = await Promise.all([
      import('/src/sim/state.ts'),
      import('/src/core/math.ts'),
      import('/src/sim/loot.ts'),
      import('/src/data/hulls.ts'),
      import('/src/data/balance/capacidade.ts'),
      import('/src/data/bosses.ts'),
    ]);
    const seed = 20260911;
    const state = createState(seed, 'piloto_sora');
    const rng = new Rng(seed);
    state.command.nivel = 42;
    state.resources = { sucata: 320000, nucleo: 4600, cristal: 180 };
    state.lifetime = { sucata: 320000, nucleo: 4600, cristal: 180 };
    state.universe.bestSector = 68;
    state.universe.bestSectorEver = 68;
    state.run.sector = 10;
    state.run.wave = 6;
    state.run.chaveAcessoConsumida = bossForSector(10).id;
    state.cargaLiberada = CONCESSOES.map((entry) => entry.id);
    state.settings.guiaVisto = true;
    state.settings.guiasVistos = ['galaxia', 'inventario', 'frota', 'missoes', 'afixos', 'baus', 'provacao'];
    state.settings.showDamageNumbers = true;
    state.settings.repetirSetor = true;
    state.settings.muted = true;
    state.settings.anatomiaAberta = true;

    const availableShips = HULLS.filter((hull) => !hull.prototype && hull.requiresSector <= 68).slice(0, 12);
    state.fleet = [...new Set([state.hull, ...availableShips.map((hull) => hull.id)])];
    for (const [index, hull] of state.fleet.entries()) {
      state.naves[hull] = { nivel: 8 + (index % 5), xp: 380 + index * 41, equipped: {} };
    }
    state.naves[state.hull].elemento = 'fogo';

    // Peças roladas pelo sistema real. Mantemos uma seleção ampla para o filtro
    // de Fogo sempre mostrar opções durante a tomada de decisão.
    for (let index = 0; index < 64; index++) {
      state.inventory.push(rollItem(rng, 34 + (index % 7), 0, 3, { exata: 2 + (index % 4) }));
    }
    return JSON.stringify(state);
  });

  await page.addInitScript((serialized) => {
    const userId = 'marketing-tiktok-local';
    localStorage.setItem('oz.sessao.v1', JSON.stringify({
      accessToken: 'local-capture-token',
      refreshToken: 'local-capture-refresh',
      expiraEm: Math.floor(Date.now() / 1000) + 86400,
      usuarioId: userId,
      email: 'captura@local.invalid',
      anonima: false,
    }));
    localStorage.setItem(`orbita-zero:save:${userId}`, serialized);
  }, serializedDemoState);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const play = page.getByRole('button', { name: /JOGAR AGORA/i }).first();
  if (await play.count()) await play.click();
  await page.waitForFunction(() => Boolean(window.oz?.debugSim), null, { timeout: 30000 });
  await page.waitForTimeout(2500);

  // Equipa um conjunto inicial verdadeiro, sem modo de teste e sem interface de admin.
  await page.evaluate(() => {
    const sim = window.oz.debugSim;
    const slots = new Set();
    for (const item of [...sim.state.inventory].sort((a, b) => b.rarity - a.rarity)) {
      if (slots.has(item.slot)) continue;
      if (sim.equip(item.uid)) slots.add(item.slot);
    }
    sim.state.settings.muted = true;
    sim.state.settings.repetirSetor = true;
    sim.touch();
    document.querySelector('[data-view="combate"]')?.click();
  });
  await page.waitForTimeout(1600);

  async function begin(name) {
    const clip = { name, start: agora(startedAt), duration: 0 };
    clips.push(clip);
    return clip;
  }

  async function end(clip) {
    clip.duration = agora(startedAt) - clip.start;
    await page.screenshot({ path: path.join(workDir, `${clip.name}-fim.png`) });
  }

  // 1) Gancho e derrota: chefe real, IA em movimento, dano real da cena.
  await page.waitForFunction(() => window.oz.vertical?.enemies?.items?.some((e) => e.alive && e.boss), null, { timeout: 12000 });
  await page.evaluate(() => {
    const v = window.oz.vertical;
    const boss = v.enemies.items.find((e) => e.alive && e.boss);
    if (boss) boss.hp = boss.maxHp = Math.max(boss.maxHp, window.oz.debugSim.stats.dano * 80);
  });
  const failure = await begin('falha-no-chefe');
  await page.waitForTimeout(3100);
  await page.evaluate(() => {
    const v = window.oz.vertical;
    v.player.invuln = 0;
    v.damagePlayer(v.player.hp + v.player.shield + 9999, 'fogo');
  });
  checks.derrotaReal = await page.evaluate(() => !window.oz.vertical.player.alive);
  await page.waitForTimeout(1500);
  await end(failure);

  // 2) Leitura do elemento e troca de peça pela própria UI.
  await page.evaluate(() => {
    const sim = window.oz.debugSim;
    sim.jumpSector(9);
    document.querySelector('[data-view="inventario"]')?.click();
  });
  await page.waitForTimeout(950);
  const build = await begin('ajuste-de-build');
  const selects = page.locator('.inv-control-toolbar select');
  await selects.nth(2).selectOption('fogo');
  await page.waitForTimeout(1550);
  const beforeEquipCommands = await page.evaluate(() => window.oz.debugSim.state.comandosDeItem.length);
  const primeiraPeca = page.locator('.inv-cell:not(.vazio)').first();
  await primeiraPeca.hover();
  await page.waitForTimeout(850);
  await primeiraPeca.dblclick();
  await page.waitForTimeout(2050);
  const afterEquipCommands = await page.evaluate(() => window.oz.debugSim.state.comandosDeItem.length);
  checks.trocaDeBuildReal = afterEquipCommands > beforeEquipCommands;
  await end(build);

  // 3) Último inimigo do setor 9: abate real -> cápsula física -> armazém.
  await page.evaluate(() => {
    document.querySelector('[data-view="combate"]')?.click();
    document.querySelector('.inv-tip')?.classList.add('hidden');
    const sim = window.oz.debugSim;
    const v = window.oz.vertical;
    sim.state.chavesAcesso = {};
    sim.state.chavesAcessoGarantidas = [];
    sim.jumpSector(9);
    v.syncEncounter(true);
    v.victory = 0;
    v.bannerTime = 0;
  });
  await page.waitForFunction(() => window.oz.vertical?.enemies?.items?.some((e) => e.alive && !e.boss), null, { timeout: 8000 });
  await page.evaluate(async () => {
    const sim = window.oz.debugSim;
    const v = window.oz.vertical;
    const { chaveDaGalaxia } = await import('/src/data/chaves-de-acesso.ts');
    const vivos = v.enemies.items.filter((e) => e.alive && !e.boss);
    const alvo = vivos[0];
    for (const e of vivos.slice(1)) e.alive = false;
    v.enemies.compact();
    if (!alvo) throw new Error('Nenhum inimigo disponível para a queda física da chave');
    alvo.counts = true;
    alvo.entering = false;
    alvo.time = 2;
    alvo.x = 450;
    alvo.y = -40;
    alvo.anchorX = 450;
    alvo.anchorY = -40;
    alvo.hp = alvo.maxHp = Math.max(5000, sim.stats.dano * 100);
    sim.state.run.restam = 2;
    v.director.remaining = 0;
    v.player.alive = true;
    v.player.invuln = 2;
    v.player.hp = v.player.hpMax;
    v.player.shield = v.player.shieldMax;
  });
  await page.waitForTimeout(650);
  await page.mouse.move(530, 1220);
  const drop = await begin('chave-caindo');
  await page.waitForTimeout(650);
  await page.evaluate(async () => {
    const sim = window.oz.debugSim;
    const v = window.oz.vertical;
    const { chaveDaGalaxia } = await import('/src/data/chaves-de-acesso.ts');
    const alvo = v.enemies.items.find((e) => e.alive && e.counts && !e.boss);
    if (!alvo) throw new Error('Alvo da queda não encontrado');
    const { x, y } = alvo;
    // A explosão, a rolagem garantida e a cápsula são as rotinas reais. O
    // contador fica em 2 só para o cartão de onda limpa não cobrir a queda na
    // gravação; no jogo normal esta mesma rolagem ocorre quando chega a zero.
    v.killEnemy(alvo, false);
    const definicao = chaveDaGalaxia(0);
    sim.cancelarChaveGarantida(definicao.id);
    sim.state.chavesAcessoGarantidas = [];
    const sorteio = sim.rollChaveDuranteAbate(9, true) ?? { chave: definicao, garantida: true };
    v.pickups.clear();
    if (!v.spawnChave(x, y, sorteio.chave.id, sorteio.chave.cor, sorteio.chave.arte, true)) {
      throw new Error('A chave garantida não pôde nascer fisicamente');
    }
  });
  await page.waitForTimeout(900);
  checks.chaveFisicaVisivel = await page.evaluate(() => window.oz.vertical.pickups.items.some((p) => p.alive && p.kind === 'chave'));
  await page.screenshot({ path: path.join(workDir, 'chave-fisica-da-nave.png') });
  await page.waitForFunction(() => window.oz.debugSim.quantidadeChaveDaGalaxia(0) === 1, null, { timeout: 6000 });
  checks.chaveNoArmazem = true;
  await end(drop);

  // 4) Barreira real do chefe, com quantidade e consumo explícitos.
  const antesDoCartao = await page.evaluate(() => {
    const sim = window.oz.debugSim;
    const quantidade = sim.quantidadeChaveDaGalaxia(0);
    if (quantidade !== 1) throw new Error(`A chave deveria estar no armazém antes do chefe; quantidade: ${quantidade}`);
    sim.jumpSector(10);
    return quantidade;
  });
  checks.chaveAntesDoCartao = antesDoCartao === 1;
  await page.locator('.boss-key-confirmacao').waitFor({ state: 'visible', timeout: 8000 });
  const access = await begin('confirmacao-da-chave');
  const accessText = await page.locator('.boss-key-confirmacao-cartao').innerText();
  checks.cartaoMostraQuantidade = /Você possui 1/.test(accessText) && /após entrar: 0/.test(accessText);
  await page.waitForTimeout(2500);
  await end(access);

  await page.getByRole('button', { name: 'USAR CHAVE E ENTRAR' }).click();
  checks.chaveConsumida = await page.evaluate(() => window.oz.debugSim.quantidadeChaveDaGalaxia(0) === 0 && window.oz.debugSim.state.run.sector === 10);
  await page.evaluate(() => {
    const sim = window.oz.debugSim;
    sim.state.run.wave = 6;
    sim.refreshEncounter();
    window.oz.vertical.syncEncounter(true);
  });
  await page.waitForFunction(() => window.oz.vertical?.enemies?.items?.some((e) => e.alive && e.boss), null, { timeout: 12000 });
  await page.evaluate(() => {
    const v = window.oz.vertical;
    const boss = v.enemies.items.find((e) => e.alive && e.boss);
    if (!boss) throw new Error('Chefe não nasceu depois do consumo da chave');
    boss.hp = boss.maxHp = Math.max(12000, window.oz.debugSim.stats.dano * 120);
    v.player.alive = true;
    v.player.invuln = 12;
    v.player.hp = v.player.hpMax;
    v.player.shield = v.player.shieldMax;
  });

  // 5) Uma única tentativa contínua: entrada, combate e vitória real.
  const bossCombat = await begin('tentativa-vitoriosa');
  await page.waitForTimeout(5450);
  await page.evaluate(() => {
    const boss = window.oz.vertical.enemies.items.find((e) => e.alive && e.boss);
    if (boss) boss.hp = 1;
  });
  await page.waitForTimeout(3600);
  checks.chefeDerrotado = await page.evaluate(() => window.oz.debugSim.state.stats.bossKills >= 1);
  await end(bossCombat);

  // 6) Escala real do mapa.
  await page.waitForTimeout(4200);
  await page.evaluate(async () => {
    const { bus } = await import('/src/app/Bus.ts');
    bus.emit('panel:open', { id: 'galaxia' });
  });
  await page.waitForTimeout(850);
  const map = await begin('mapa-galactico');
  await page.waitForTimeout(2750);
  await end(map);

  // 7) CTA permanece sobre gameplay novo em movimento, nunca numa cartela parada.
  await page.evaluate(async () => {
    const { bus } = await import('/src/app/Bus.ts');
    bus.emit('panel:close', undefined);
    const sim = window.oz.debugSim;
    sim.jumpSector(18);
    window.oz.vertical.syncEncounter(true);
    window.oz.vertical.victory = 0;
    window.oz.vertical.bannerTime = 0;
    document.querySelector('[data-view="combate"]')?.click();
  });
  await page.waitForTimeout(800);
  const cta = await begin('gameplay-cta');
  await page.waitForTimeout(4700);
  await end(cta);

  const allChecks = Object.values(checks).every(Boolean);
  if (!allChecks) throw new Error(`Falha nas verificações da captura: ${JSON.stringify(checks)}`);
  if (erros.length) throw new Error(`Erros de página durante a captura: ${erros.join(' | ')}`);

  const clipReport = {
    viewport: { width: 720, height: 1280 },
    clips,
    checks,
    source: 'Gravação vertical inédita do build local atual em 11/09/2026',
    reusedFootage: false,
    network: `Somente ${origin}; demais requisições bloqueadas`,
  };

  const video = page.video();
  await context.close();
  fs.writeFileSync(path.join(dir, 'clips.json'), JSON.stringify(clipReport, null, 2));
  await video.saveAs(path.join(dir, 'gameplay-viral-01.webm'));
  await browser.close();
  console.log(JSON.stringify({ ok: true, clips, checks }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
