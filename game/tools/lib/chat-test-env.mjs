// Ambiente descartável: D1/DO locais e JWT ES256 de um emissor fictício.
// Nenhuma chave de produção e nenhuma chamada externa são utilizadas.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../server/package.json', import.meta.url));
const { Miniflare, Response, convertV4MiniflareOptions } = require('miniflare');

export async function ambienteChat() {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
  jwk.kid = 'chat-test'; jwk.alg = 'ES256';
  const issuer = 'https://auth.chat.invalid';
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'chat-test', modules: true, compatibilityDate: '2026-08-01',
    scriptPath: fileURLToPath(new URL('../../server/.wrangler/chat-build/worker.js', import.meta.url)),
    d1Databases: { DB: 'contas-teste', CHAT_DB: 'chat-teste' },
    durableObjects: { CHAT: { className: 'CentralChat', useSQLite: true } },
    bindings: { SUPABASE_URL: issuer, ORIGENS: 'http://localhost:5180,http://127.0.0.1:5181,http://127.0.0.1:5180', CHAT_ENABLED: 'true', CHAT_MODERADORES: 'moderador' },
    outboundService: req => new URL(req.url).origin === issuer
      ? Response.json({ keys: [jwk] }) : new Response('Rede externa proibida no teste.', { status: 403 }),
  }));
  await mf.ready;
  const contas = await mf.getD1Database('DB');
  const db = await mf.getD1Database('CHAT_DB');
  await contas.prepare('CREATE TABLE apelidos (usuario TEXT PRIMARY KEY,apelido TEXT)').run();
  const schema = await readFile(new URL('../../server/chat-schema.sql', import.meta.url), 'utf8');
  // D1 exec exige uma instrução por linha; prepare aceita SQL com quebras.
  for (const sql of schema.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  for (const [id, nome] of [['alfa', 'Piloto Alfa'], ['beta', 'Piloto Beta'], ['gama', 'Piloto Gama'], ['moderador', 'Comandante'], ['spam', 'Spam Teste']]) {
    await contas.prepare('INSERT INTO apelidos VALUES(?,?)').bind(id, nome).run();
  }
  const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
  async function token(id, extras = {}) {
    const header = b64({ alg: 'ES256', kid: jwk.kid });
    const payload = b64({ sub: id, iss: `${issuer}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 3600, email: `${id}@test.invalid`, is_anonymous: false, ...extras });
    const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
  }
  async function api(id, pedido, extras = {}) {
    const response = await mf.dispatchFetch('https://chat.test/chat/api', {
      method: 'POST', headers: { origin: 'http://localhost:5180', authorization: `Bearer ${await token(id, extras)}`, 'content-type': 'application/json' },
      body: JSON.stringify(pedido),
    });
    return { status: response.status, data: await response.json() };
  }
  const sockets = [];
  async function socket(id, ticket) {
    const r = await mf.dispatchFetch('https://chat.test/chat/socket', { headers: { origin: 'http://localhost:5180', upgrade: 'websocket', 'cf-connecting-ip': `test-${id}` } });
    if (!r.webSocket) throw new Error(`Socket recusado: ${r.status}`);
    const ws = r.webSocket; ws.accept(); sockets.push(ws);
    const eventos = [];
    ws.addEventListener('message', e => { if (e.data !== 'pong') eventos.push(JSON.parse(e.data)); });
    ws.send(JSON.stringify({ ticket: ticket ?? (await api(id, { op: 'ticket' })).data.ticket }));
    return { ws, eventos };
  }
  return { mf, db, contas, token, api, socket, async dispose() {
    for (const ws of sockets) try { ws.close(); } catch { /* descartável */ }
    await mf.dispose();
  } };
}

export async function aguardar(condicao, timeout = 5000) {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > timeout) throw new Error('Tempo esgotado aguardando evento de chat.');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
