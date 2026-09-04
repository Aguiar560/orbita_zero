import { usuarioDoToken } from '../auth';
import { CHAT, ErroChat, origemChatPermitida } from '../../../src/shared/chat';
export { CentralChat } from './CentralChat';

export interface EnvChat {
  DB: D1Database;
  CHAT_DB: D1Database;
  CHAT: DurableObjectNamespace;
  SUPABASE_URL: string;
  ORIGENS: string;
  CHAT_ENABLED: string;
  CHAT_MODERADORES: string;
}

export async function corpoLimitado(req: Request): Promise<Record<string, unknown>> {
  if (!req.body) throw new ErroChat('Pedido vazio.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > CHAT.pacote) { await reader.cancel(); throw new ErroChat('Pedido muito grande.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result as Record<string, unknown>;
  } catch { throw new ErroChat('Pedido inválido.'); }
}

export default {
  async fetch(req: Request, env: EnvChat): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === '/saude') return Response.json({ ok: true, ativo: env.CHAT_ENABLED === 'true' });
    if (!origemChatPermitida(req.headers.get('origin'), env.ORIGENS)) return new Response('Origem não autorizada.', { status: 403 });
    const headers = {
      'access-control-allow-origin': req.headers.get('origin')!,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'cache-control': 'no-store', vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const responder = (dados: unknown, status = 200): Response => Response.json(dados, { status, headers });
    if (env.CHAT_ENABLED !== 'true') return responder({ erro: 'Comunicações ainda não ativadas.' }, 503);
    const central = env.CHAT.get(env.CHAT.idFromName('global-v1'));
    try {
      if (path === '/chat/socket' && req.method === 'GET' && req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        // Não encaminhar cabeçalhos de identidade controláveis pelo navegador.
        const rede = req.headers.get('cf-connecting-ip') ?? 'local';
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${new Date().toISOString().slice(0, 10)}:${rede}`));
        const chave = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
        return central.fetch(new Request('https://chat/socket', { headers: { Upgrade: 'websocket', 'x-chat-rede': chave } }));
      }
      if (path !== '/chat/api' || req.method !== 'POST') return responder({ erro: 'Rota inexistente.' }, 404);
      const usuario = await usuarioDoToken(req.headers.get('authorization'), env.SUPABASE_URL);
      if (!usuario) return responder({ erro: 'Entre novamente na sua conta.' }, 401);
      const pedido = await corpoLimitado(req);
      const resposta = await central.fetch(new Request('https://chat/operacao', {
        method: 'POST', body: JSON.stringify({ usuario, pedido }),
      }));
      return new Response(resposta.body, { status: resposta.status, headers: { ...headers, 'content-type': 'application/json' } });
    } catch (erro) {
      return responder({ erro: erro instanceof ErroChat ? erro.message : 'Comunicações indisponíveis. Tente novamente.' }, erro instanceof ErroChat ? erro.status : 503);
    }
  },
  async scheduled(_event: ScheduledEvent, env: EnvChat): Promise<void> {
    // Limpeza continua com a feature desligada; retenção não depende de tráfego.
    await env.CHAT.get(env.CHAT.idFromName('global-v1')).fetch(new Request('https://chat/limpar', { method: 'POST' }));
  },
};
