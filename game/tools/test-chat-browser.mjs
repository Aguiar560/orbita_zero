import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { ambienteChat } from './lib/chat-test-env.mjs';
const require = createRequire(import.meta.url);
const runtime = process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/aguia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(runtime);
const env = await ambienteChat();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {
  executablePath: 'C:/Users/aguia/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
}) });
const vite = process.env.CHAT_TEST_VITE ?? 'http://127.0.0.1:5181';
const chatUrl = (await env.mf.ready).origin;
const contexts = [];
const erros = [];
await mkdir('.snapshots/chat', { recursive: true });
async function pagina(id, viewport) {
  console.log(`Verificando navegador: ${id}, ${viewport.width}×${viewport.height}`);
  const context = await browser.newContext({ viewport }); contexts.push(context);
  await context.grantPermissions(['local-network-access'], { origin: vite });
  // Só os dois servidores descartáveis/locais. Nenhum save/conta real.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== vite && url.origin !== chatUrl) return route.abort();
    // Esta página de QA é montada por evaluate, não pelo entrypoint do jogo.
    // HMR a recarregaria vazia quando o simulador grava seus arquivos locais.
    if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'application/javascript', body: `
      export function createHotContext(){return {accept(){},dispose(){},prune(){},on(){},send(){}}}
      export function updateStyle(id,css){let el=document.getElementById(id);if(!el){el=document.createElement('style');el.id=id;document.head.append(el)}el.textContent=css}
      export function removeStyle(id){document.getElementById(id)?.remove()}
      export function injectQuery(url){return url}
    ` });
    if (url.pathname === '/__chat-qa') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/main.css"><body><main style="padding:30px"><h1>ÓRBITA ZERO</h1><p>Ambiente isolado de testes de comunicação</p><canvas id="combate" tabindex="0" aria-label="Combate" width="600" height="500"></canvas></main></body></html>' });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('Navegador:', m.text()); });
  page.on('requestfailed', r => console.error('Requisição:', new URL(r.url()).pathname, r.failure()?.errorText));
  page.on('response', r => { if (r.status() >= 400) console.error('HTTP:', new URL(r.url()).pathname, r.status()); });
  await page.goto(`${vite}/__chat-qa`);
  await page.evaluate(async ({ id, token, chatUrl }) => {
    localStorage.setItem('oz.sessao.v1', JSON.stringify({ accessToken: token, refreshToken: 'teste-local', expiraEm: Date.now() / 1000 + 3500, usuarioId: id, email: `${id}@test.invalid`, anonima: false }));
    const { ChatPanel } = await import('/src/ui/ChatPanel.ts');
    const { ChatClient } = await import('/src/app/ChatClient.ts');
    window.chatClient = new ChatClient(chatUrl);
    window.chatPanel = new ChatPanel(window.chatClient);
    document.body.append(window.chatPanel.botao, window.chatPanel.root);
  }, { id, token: await env.token(id), chatUrl });
  await page.getByRole('button', { name: 'Abrir comunicações' }).click();
  await page.waitForFunction(() => window.chatClient.status === 'Canal conectado').catch(async error => {
    console.error('Estado do chat:', await page.evaluate(() => window.chatClient.status));
    throw error;
  });
  return page;
}
try {
  const a = await pagina('alfa', { width: 1440, height: 1000 });
  const b = await pagina('beta', { width: 390, height: 844 });
  await a.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Olá, pilotos! Prontos para explorar a galáxia? 🚀');
  await a.getByRole('button', { name: 'Enviar', exact: true }).click();
  await b.getByText('Olá, pilotos! Prontos para explorar a galáxia? 🚀', { exact: true }).waitFor();
  await b.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Pronto! Acabei de melhorar minha nave.');
  await b.getByRole('button', { name: 'Enviar', exact: true }).click();
  await a.getByText('Pronto! Acabei de melhorar minha nave.', { exact: true }).waitFor();
  await a.screenshot({ path: '.snapshots/chat/desktop.png' });
  await b.screenshot({ path: '.snapshots/chat/mobile.png' });
  const box = await b.locator('.chat-panel').boundingBox();
  assert.ok(box.width <= 391 && box.x >= 0 && box.height <= 844, 'Painel cabe no celular');
  await b.setViewportSize({ width: 390, height: 460 });
  await b.getByRole('textbox', { name: 'Mensagem', exact: true }).focus();
  const enviarBox = await b.getByRole('button', { name: 'Enviar', exact: true }).boundingBox();
  assert.ok(enviarBox.y + enviarBox.height <= 460, 'Envio visível com viewport reduzida pelo teclado');
  await b.screenshot({ path: '.snapshots/chat/mobile-teclado.png' });
  await b.setViewportSize({ width: 390, height: 844 });
  await a.getByRole('button', { name: 'Privadas', exact: true }).click();
  await a.getByRole('textbox', { name: 'Buscar jogador pelo apelido' }).fill('Piloto B');
  await a.getByRole('button', { name: 'Buscar', exact: true }).click();
  await a.getByRole('button', { name: 'Piloto Beta · Solicitar conversa' }).click();
  await b.getByRole('button', { name: 'Privadas', exact: true }).click();
  await b.getByRole('button', { name: /Piloto Alfa.*Solicitação recebida/ }).click();
  await b.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await a.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Vamos compartilhar dicas de equipamentos por aqui.');
  await a.getByRole('button', { name: 'Enviar', exact: true }).click();
  await b.getByText('Vamos compartilhar dicas de equipamentos por aqui.', { exact: true }).waitFor();
  await b.screenshot({ path: '.snapshots/chat/privada.png' });
  // Conteúdo hostil é apenas texto e não cria elementos HTML.
  await b.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('<img src=x onerror="window.chatXss=true">');
  await b.getByRole('button', { name: 'Enviar', exact: true }).click();
  await a.getByText('<img src=x onerror="window.chatXss=true">', { exact: true }).waitFor();
  assert.equal(await a.locator('.chat-log img').count(), 0);
  assert.equal(await a.evaluate(() => window.chatXss), undefined);
  // Exercita os listeners reais de combate, sem rodar animação ou acessar saves.
  const foco = await a.evaluate(async () => {
    const { VerticalMode } = await import('/src/modes/vertical/VerticalMode.ts');
    const { Sim } = await import('/src/sim/index.ts');
    const { Surface } = await import('/src/render/Surface.ts');
    const sim = new Sim();
    sim.laboratorio.active = true; sim.laboratorio.config.control = 'manual';
    const palco = document.querySelector('#combate');
    const modo = new VerticalMode(new Surface(palco), sim);
    const { focoDeEntrada } = await import('/src/app/focoDeEntrada.ts');
    palco.focus();
    palco.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true, cancelable: true }));
    const registrou = modo.keys.has('KeyW');
    const campo = document.querySelector('.chat-campo'); campo.focus();
    const limpou = modo.keys.size === 0;
    const e = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    campo.dispatchEvent(e);
    const naoMoveu = modo.keys.size === 0;
    palco.focus(); palco.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
    window.dispatchEvent(new Event('blur'));
    const blurLimpou = modo.keys.size === 0;
    modo.dispose();
    return { campo: focoDeEntrada(campo), palco: focoDeEntrada(palco), registrou, limpou, naoMoveu, blurLimpou, espacoLivre: !e.defaultPrevented };
  });
  assert.deepEqual(foco, { campo: true, palco: false, registrou: true, limpou: true, naoMoveu: true, blurLimpou: true, espacoLivre: true });
  await b.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await b.getByRole('button', { name: 'Confirmar bloqueio', exact: true }).click();
  await b.waitForFunction(() => window.chatClient.bloqueios.some(p => p.id === 'alfa'));
  await b.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await b.getByRole('button', { name: 'Desbloquear Piloto Alfa' }).waitFor();
  await a.evaluate(async () => { const { sair } = await import('/src/app/conta.ts'); sair(); });
  await a.waitForFunction(() => window.chatClient.perfil === null && window.chatClient.mensagens.size === 0);
  assert.equal(await a.getByText('Vamos compartilhar dicas de equipamentos por aqui.', { exact: true }).count(), 0, 'Logout limpa conteúdo privado do DOM');
  assert.deepEqual(erros, [], 'Sem erros JavaScript');
  console.log('Chat UI: global, privada aceita, bloqueio, XSS, logout e layouts 1440×1000, 390×844, 390×460 passaram. Capturas em .snapshots/chat.');
} finally {
  for (const c of contexts) await c.close();
  await browser.close(); await env.dispose();
}
