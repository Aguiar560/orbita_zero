import type { Usuario } from '../auth';
import type { EnvChat } from './worker';
import {
  CHAT, ErroChat, cursorChat, idChatValido, participanteChat, textoChat,
  type EventoChat, type MensagemChat, type PerfilChat,
} from '../../../src/shared/chat';

interface Conversa { id: string; a: string; b: string; iniciador: string; estado: string }
interface Anexo { perfil?: PerfilChat; prazo: number; pendentes?: number }
interface Ticket extends Anexo { perfil: PerfilChat; validade: number }
type Pedido = Record<string, unknown>;

/** Coordenador inicial: uma autoridade para ACL, limites, tickets e fan-out.
 * O histórico fica no D1 social. A fila impede interleaving durante awaits D1;
 * não guardamos decisões de autorização em caches perdidos na hibernação. */
export class CentralChat {
  private fila: Promise<unknown> = Promise.resolve();
  constructor(private readonly ctx: DurableObjectState, private readonly env: EnvChat) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.fila.then(fn);
    this.fila = result.catch(() => undefined);
    return result;
  }
  private sql(sql: string, ...args: unknown[]): D1PreparedStatement {
    return this.env.CHAT_DB.prepare(sql).bind(...args);
  }
  private async limite(chave: string, max: number, intervalo: number): Promise<void> {
    const key = `limite:${chave}`;
    const now = Date.now();
    const anterior = await this.ctx.storage.get<{ fichas: number; atualizado: number }>(key);
    const fichas = Math.min(max, anterior ? anterior.fichas + (now - anterior.atualizado) / intervalo : max);
    if (fichas < 1) throw new ErroChat('Muitas ações. Aguarde alguns segundos.', 429);
    await this.ctx.storage.put(key, { fichas: fichas - 1, atualizado: now });
  }
  private async sancao(usuario: string, escrita: boolean): Promise<void> {
    const s = await this.sql('SELECT tipo FROM chat_sancoes WHERE usuario=? AND ate>?', usuario, Date.now()).first<{ tipo: string }>();
    if (s && (escrita || s.tipo === 'banimento')) throw new ErroChat('Acesso ao chat limitado pela moderação.', 403);
  }
  private async perfil(u: Usuario): Promise<PerfilChat> {
    const row = await this.env.DB.prepare('SELECT apelido FROM apelidos WHERE usuario=?').bind(u.id).first<{ apelido: string }>();
    const podeEnviar = !u.anonima && !!row?.apelido;
    if (podeEnviar) {
      await this.sql(`INSERT INTO chat_perfis(usuario,apelido,normal) VALUES(?,?,?)
        ON CONFLICT(usuario) DO UPDATE SET apelido=excluded.apelido,normal=excluded.normal
        WHERE apelido<>excluded.apelido`, u.id, row!.apelido, row!.apelido.toLocaleLowerCase('pt-BR')).run();
    }
    return { id: u.id, apelido: row?.apelido ?? 'Visitante', podeEnviar,
      moderador: !u.anonima && this.env.CHAT_MODERADORES.split(',').map(s => s.trim()).includes(u.id) };
  }
  private async bloqueado(a: string, b: string): Promise<boolean> {
    return !!await this.sql('SELECT 1 FROM chat_bloqueios WHERE (usuario=? AND alvo=?) OR (usuario=? AND alvo=?)', a, b, b, a).first();
  }
  private async conversa(id: unknown, usuario: string, enviar = false): Promise<Conversa | null> {
    if (id === 'global') return null;
    if (!idChatValido(id)) throw new ErroChat('Conversa indisponível.', 403);
    const c = await this.sql('SELECT * FROM chat_conversas WHERE id=?', id).first<Conversa>();
    if (!participanteChat(c, usuario)) throw new ErroChat('Conversa indisponível.', 403);
    if (enviar && (c!.estado !== 'aceita' || await this.bloqueado(c!.a, c!.b))) {
      throw new ErroChat('Conversa não aceita ou indisponível.', 403);
    }
    return c;
  }
  private enviar(ws: WebSocket, evento: EventoChat): void {
    try {
      // Workers não expõe bufferedAmount. Janela limitada entre confirmações de
      // vida do cliente impede produzir um buffer sem limite em um socket lento.
      const a = ws.deserializeAttachment() as Anexo;
      a.pendentes = (a.pendentes ?? 0) + 1;
      if (a.pendentes > 256) { ws.close(4008, 'Conexão lenta. Reconecte.'); return; }
      ws.serializeAttachment(a);
      ws.send(JSON.stringify(evento));
    } catch { try { ws.close(1011, 'Reconecte.'); } catch { /* já fechado */ } }
  }
  private avisar(usuarios: string[], evento: EventoChat = { tipo: 'atualizar' }): void {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Anexo;
      if (a.perfil && a.prazo > Date.now() && usuarios.includes(a.perfil.id)) this.enviar(ws, evento);
    }
  }
  private async agendar(prazo: number): Promise<void> {
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > prazo) await this.ctx.storage.setAlarm(prazo);
  }

  async fetch(req: Request): Promise<Response> {
    return this.serial(async () => {
      try {
        const path = new URL(req.url).pathname;
        if (path === '/limpar') { await this.limpar(); return Response.json({ ok: true }); }
        if (path === '/socket') {
          await this.limite(`socket:${req.headers.get('x-chat-rede') ?? 'local'}`, 6, 5000);
          const sockets = this.ctx.getWebSockets();
          if (sockets.length >= CHAT.conexoes || sockets.filter(ws => !(ws.deserializeAttachment() as Anexo).perfil).length >= 20) {
            return new Response('Sala ocupada. Tente novamente.', { status: 429 });
          }
          const [cliente, servidor] = Object.values(new WebSocketPair());
          const prazo = Date.now() + CHAT.autenticarMs;
          this.ctx.acceptWebSocket(servidor);
          servidor.serializeAttachment({ prazo } satisfies Anexo);
          await this.agendar(prazo);
          return new Response(null, { status: 101, webSocket: cliente });
        }
        const { usuario, pedido } = await req.json() as { usuario: Usuario; pedido: Pedido };
        // Este endpoint é interno ao Worker, sem rota que aceite identidade do cliente.
        if (!usuario?.id || usuario.expiraEm * 1000 <= Date.now()) throw new ErroChat('Sessão expirada.', 401);
        await this.limite(`${usuario.id}:api`, 30, 1000);
        await this.sancao(usuario.id, false);
        const perfil = await this.perfil(usuario);
        return Response.json(await this.operar(usuario, perfil, pedido));
      } catch (e) {
        return Response.json({ erro: e instanceof ErroChat ? e.message : 'Comunicações indisponíveis. Tente novamente.' }, { status: e instanceof ErroChat ? e.status : 503 });
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return this.serial(async () => {
      try {
        const a = ws.deserializeAttachment() as Anexo;
        if (this.env.CHAT_ENABLED !== 'true') { ws.close(4003, 'Comunicações desativadas.'); return; }
        if (a.prazo <= Date.now()) { ws.close(4001, 'Renove a sessão.'); return; }
        if (typeof message !== 'string' || new TextEncoder().encode(message).length > 512) { ws.close(1009, 'Pacote inválido.'); return; }
        // Socket só recebe autenticação e ping. Escritas passam por HTTPS autenticado.
        if (a.perfil) {
          await this.limite(`${a.perfil.id}:ping`, 3, 10_000);
          if (message !== 'ping') { ws.close(1008, 'Comando inválido.'); return; }
          a.pendentes = 0; ws.serializeAttachment(a); ws.send('pong'); return;
        }
        const p = JSON.parse(message) as { ticket?: string };
        if (typeof p.ticket !== 'string' || !/^[a-f0-9-]{73}$/.test(p.ticket)) throw new ErroChat('Ticket inválido.');
        const key = `ticket:${p.ticket}`;
        const t = await this.ctx.storage.get<Ticket>(key);
        await this.ctx.storage.delete(key);
        if (!t || t.validade <= Date.now() || t.prazo <= Date.now()) throw new ErroChat('Ticket expirado.');
        await this.sancao(t.perfil.id, false);
        const ativos = this.ctx.getWebSockets().filter(s => (s.deserializeAttachment() as Anexo).perfil?.id === t.perfil.id);
        if (ativos.length >= CHAT.porUsuario) throw new ErroChat('Limite de conexões. Feche outra aba.');
        ws.serializeAttachment({ perfil: t.perfil, prazo: t.prazo } satisfies Anexo);
        this.enviar(ws, { tipo: 'pronto', perfil: t.perfil });
        await this.agendar(t.prazo);
      } catch { ws.close(4001, 'Não foi possível autenticar a conexão.'); }
    });
  }
  webSocketClose(ws: WebSocket, code: number): void { try { ws.close(code); } catch { /* fechado */ } }
  webSocketError(ws: WebSocket): void { try { ws.close(1011, 'Reconecte.'); } catch { /* fechado */ } }

  private async operar(u: Usuario, p: PerfilChat, d: Pedido): Promise<unknown> {
    const id = u.id;
    const op = d.op;
    if (op === 'ticket') {
      await this.limite(`${id}:ticket`, 3, 10_000);
      const ticket = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      await this.ctx.storage.put(`ticket:${ticket}`, { perfil: p, prazo: Math.min(u.expiraEm * 1000, Date.now() + CHAT.sessaoMs), validade: Date.now() + CHAT.ticketMs } satisfies Ticket);
      return { ticket, perfil: p };
    }
    if (op === 'historico') {
      if (d.conversa !== 'global' && !p.podeEnviar) throw new ErroChat('Vincule uma conta e defina um apelido.', 403);
      await this.conversa(d.conversa, id);
      const antes = cursorChat(d.antes);
      const apos = cursorChat(d.apos);
      const mensagens = await this.sql(`SELECT m.* FROM chat_mensagens m WHERE conversa=?
        AND (?=0 OR m.id<?) AND (?=0 OR m.id>?)
        AND NOT EXISTS (SELECT 1 FROM chat_bloqueios b WHERE
          (b.usuario=? AND b.alvo=m.autor) OR (b.alvo=? AND b.usuario=m.autor))
        ORDER BY m.id ${apos ? 'ASC' : 'DESC'} LIMIT ?`, d.conversa, antes, antes, apos, apos, id, id, CHAT.pagina).all<MensagemChat>();
      return { mensagens: apos ? mensagens.results : mensagens.results.reverse() };
    }
    if (!p.podeEnviar) throw new ErroChat('Vincule uma conta e defina um apelido para conversar.', 403);

    if (op === 'estado') {
      const conversas = await this.sql(`SELECT c.id, CASE WHEN c.a=? THEN c.b ELSE c.a END outro,
        p.apelido,c.iniciador,c.estado,c.ultima,
        (SELECT COUNT(*) FROM (SELECT m.id FROM chat_mensagens m WHERE m.conversa=c.id AND m.autor<>?
          AND m.id>COALESCE((SELECT cursor FROM chat_leituras WHERE usuario=? AND conversa=c.id),0) LIMIT 99)) naoLidas
        FROM chat_conversas c JOIN chat_perfis p ON p.usuario=CASE WHEN c.a=? THEN c.b ELSE c.a END
        WHERE (c.a=? OR c.b=?) AND NOT EXISTS (SELECT 1 FROM chat_bloqueios b WHERE
          (b.usuario=c.a AND b.alvo=c.b) OR (b.usuario=c.b AND b.alvo=c.a))
        ORDER BY c.ultima DESC,c.criado DESC LIMIT 200`, id, id, id, id, id, id).all();
      const bloqueios = await this.sql(`SELECT b.alvo id,p.apelido FROM chat_bloqueios b LEFT JOIN chat_perfis p ON p.usuario=b.alvo WHERE b.usuario=? LIMIT 200`, id).all();
      const preferencias = await this.sql('SELECT privadas FROM chat_perfis WHERE usuario=?', id).first();
      return { perfil: p, conversas: conversas.results, bloqueios: bloqueios.results, preferencias };
    }
    if (op === 'buscar') {
      const q = typeof d.apelido === 'string' ? d.apelido.trim().toLocaleLowerCase('pt-BR') : '';
      if (q.length < 3 || q.length > 16) throw new ErroChat('Digite ao menos 3 caracteres do apelido.');
      const pattern = q.replace(/[\\%_]/g, v => `\\${v}`) + '%';
      const r = await this.sql(`SELECT usuario id,apelido FROM chat_perfis p WHERE normal LIKE ? ESCAPE '\\'
        AND usuario<>? AND privadas=1 AND NOT EXISTS (SELECT 1 FROM chat_bloqueios b WHERE
        (b.usuario=? AND b.alvo=p.usuario) OR (b.alvo=? AND b.usuario=p.usuario)) LIMIT 10`, pattern, id, id, id).all();
      return { jogadores: r.results };
    }
    if (op === 'preferencias') {
      await this.sql('UPDATE chat_perfis SET privadas=? WHERE usuario=?', d.privadas === true ? 1 : 0, id).run();
      this.avisar([id]); return { ok: true };
    }
    if (op === 'bloquear' || op === 'desbloquear') {
      if (!idChatValido(d.alvo) || d.alvo === id) throw new ErroChat('Jogador inválido.');
      if (op === 'bloquear') await this.sql('INSERT OR IGNORE INTO chat_bloqueios(usuario,alvo) VALUES(?,?)', id, d.alvo).run();
      else await this.sql('DELETE FROM chat_bloqueios WHERE usuario=? AND alvo=?', id, d.alvo).run();
      this.avisar([id, d.alvo]); return { ok: true };
    }
    if (op === 'solicitar') {
      await this.sancao(id, true);
      await this.limite(`${id}:contato`, 3, 20 * 60_000);
      if (!idChatValido(d.alvo) || d.alvo === id || await this.bloqueado(id, d.alvo)) throw new ErroChat('Jogador indisponível.', 403);
      const alvo = await this.sql('SELECT usuario FROM chat_perfis WHERE usuario=? AND privadas=1', d.alvo).first();
      if (!alvo) throw new ErroChat('Jogador indisponível.', 403);
      await this.sancao(d.alvo, false);
      const [a, b] = [id, d.alvo].sort();
      const existe = await this.sql('SELECT * FROM chat_conversas WHERE a=? AND b=?', a, b).first<Conversa>();
      if (existe) {
        if (existe.estado === 'recusada') throw new ErroChat('Solicitação recusada. Não é possível reenviar.', 403);
        return { conversa: existe.id };
      }
      const pendentes = await this.sql(`SELECT COUNT(*) n FROM chat_conversas WHERE (a=? OR b=?) AND estado='pendente'`, d.alvo, d.alvo).first<{ n: number }>();
      const total = await this.sql('SELECT COUNT(*) n FROM chat_conversas WHERE a=? OR b=?', id, id).first<{ n: number }>();
      const totalAlvo = await this.sql('SELECT COUNT(*) n FROM chat_conversas WHERE a=? OR b=?', d.alvo, d.alvo).first<{ n: number }>();
      if (pendentes!.n >= 20 || total!.n >= 200 || totalAlvo!.n >= 200) throw new ErroChat('Limite de conversas atingido.', 429);
      const conversa = crypto.randomUUID();
      await this.sql(`INSERT INTO chat_conversas(id,a,b,iniciador,estado,criado) VALUES(?,?,?,?,'pendente',?)`, conversa, a, b, id, Date.now()).run();
      this.avisar([a, b]); return { conversa };
    }
    if (op === 'responder') {
      const c = await this.conversa(d.conversa, id);
      if (!c || c.iniciador === id || c.estado !== 'pendente' || await this.bloqueado(c.a, c.b)) throw new ErroChat('Solicitação indisponível.', 403);
      await this.sql('UPDATE chat_conversas SET estado=? WHERE id=?', d.aceitar === true ? 'aceita' : 'recusada', c.id).run();
      this.avisar([c.a, c.b]); return { ok: true };
    }
    if (op === 'enviar') {
      await this.sancao(id, true);
      const c = await this.conversa(d.conversa, id, true);
      if (c) await this.sancao(c.a === id ? c.b : c.a, false);
      const texto = textoChat(d.texto);
      if (!texto || !idChatValido(d.clienteId)) throw new ErroChat('Use de 1 a 400 caracteres e até 5 linhas.');
      const existe = await this.sql('SELECT * FROM chat_mensagens WHERE autor=? AND clienteId=?', id, d.clienteId).first<MensagemChat>();
      if (existe) {
        if (existe.conversa !== d.conversa || (!existe.removida && existe.texto !== texto)) throw new ErroChat('Identificador de mensagem já utilizado.', 409);
        return { mensagem: existe };
      }
      await this.limite(`${id}:enviar`, 3, 2000);
      if (c) await this.limite(`${id}:${c.id}:destinatario`, 3, 2000);
      const now = Date.now();
      await this.agendar(now + 1000);
      // Mensagem e outbox são uma transação: queda após gravar não perde entrega.
      await this.env.CHAT_DB.batch([
        this.sql('INSERT INTO chat_mensagens(conversa,autor,apelido,texto,criado,clienteId) VALUES(?,?,?,?,?,?)', d.conversa, id, p.apelido, texto, now, d.clienteId),
        this.sql('INSERT INTO chat_entregas(mensagem) SELECT id FROM chat_mensagens WHERE autor=? AND clienteId=?', id, d.clienteId),
        this.sql('UPDATE chat_conversas SET ultima=? WHERE id=?', now, d.conversa),
      ]);
      const mensagem = await this.sql('SELECT * FROM chat_mensagens WHERE autor=? AND clienteId=?', id, d.clienteId).first<MensagemChat>();
      await this.entregar();
      return { mensagem };
    }
    if (op === 'ler') {
      await this.conversa(d.conversa, id);
      // Não aceitar um cursor futuro que suprimiria todas as notificações seguintes.
      const ultimo = await this.sql('SELECT COALESCE(MAX(id),0) id FROM chat_mensagens WHERE conversa=?', d.conversa).first<{ id: number }>();
      const cursor = Math.min(cursorChat(d.cursor), ultimo!.id);
      await this.sql(`INSERT INTO chat_leituras(usuario,conversa,cursor) VALUES(?,?,?)
        ON CONFLICT(usuario,conversa) DO UPDATE SET cursor=MAX(cursor,excluded.cursor)`, id, d.conversa, cursor).run();
      this.avisar([id], { tipo: 'estado' });
      return { ok: true };
    }
    if (op === 'denunciar') {
      await this.limite(`${id}:denuncia`, 5, 60_000);
      const m = await this.sql('SELECT * FROM chat_mensagens WHERE id=?', cursorChat(d.mensagem)).first<MensagemChat>();
      if (!m || m.autor === id) throw new ErroChat('Mensagem indisponível.');
      await this.conversa(m.conversa, id);
      const motivo = textoChat(d.motivo);
      if (!motivo || motivo.length < 3) throw new ErroChat('Informe o motivo da denúncia.');
      await this.sql(`INSERT OR IGNORE INTO chat_denuncias(id,denunciante,mensagem,motivo,evidencia,criado) VALUES(?,?,?,?,?,?)`, crypto.randomUUID(), id, m.id, motivo, JSON.stringify(m), Date.now()).run();
      return { ok: true };
    }
    if (op === 'denuncias' || op === 'moderar') {
      if (!p.moderador) throw new ErroChat('Acesso restrito à moderação.', 403);
      return this.moderar(id, d);
    }
    throw new ErroChat('Operação desconhecida.');
  }

  private async moderar(moderador: string, d: Pedido): Promise<unknown> {
    if (d.op === 'denuncias') {
      // Privadas só aparecem como evidência enviada em denúncia; acesso é auditado.
      await this.sql('INSERT INTO chat_auditoria(moderador,acao,alvo,motivo,criado) VALUES(?,?,?,?,?)', moderador, 'consultar_denuncias', 'fila', 'Revisão de denúncias', Date.now()).run();
      return { denuncias: (await this.sql(`SELECT id,mensagem,motivo,evidencia,criado,estado FROM chat_denuncias WHERE estado='aberta' ORDER BY criado LIMIT 50`).all()).results };
    }
    const dId = idChatValido(d.denuncia) ? d.denuncia : '';
    const denuncia = await this.sql('SELECT evidencia,mensagem FROM chat_denuncias WHERE id=?', dId).first<{ evidencia: string; mensagem: number }>();
    const motivo = textoChat(d.motivo);
    if (!denuncia || !motivo) throw new ErroChat('Denúncia ou justificativa inválida.');
    const m = JSON.parse(denuncia.evidencia) as MensagemChat;
    const acao = d.acao;
    if (!['remover', 'silenciar', 'banir', 'encerrar', 'revogar'].includes(String(acao))) throw new ErroChat('Ação inválida.');
    const comandos = [this.sql('INSERT INTO chat_auditoria(moderador,acao,alvo,motivo,criado) VALUES(?,?,?,?,?)', moderador, acao, m.autor, motivo, Date.now())];
    if (acao === 'remover') comandos.push(this.sql("UPDATE chat_mensagens SET texto='',removida=1 WHERE id=?", m.id));
    if (acao === 'silenciar' || acao === 'banir') {
      const horas = Number(d.horas);
      if (!Number.isInteger(horas) || horas < 1 || horas > 720) throw new ErroChat('Duração deve ser de 1 a 720 horas.');
      comandos.push(this.sql(`INSERT INTO chat_sancoes(usuario,tipo,ate,motivo) VALUES(?,?,?,?)
        ON CONFLICT(usuario) DO UPDATE SET tipo=excluded.tipo,ate=excluded.ate,motivo=excluded.motivo`, m.autor, acao === 'banir' ? 'banimento' : 'silencio', Date.now() + horas * 3600_000, motivo));
    }
    if (acao === 'revogar') comandos.push(this.sql('DELETE FROM chat_sancoes WHERE usuario=?', m.autor));
    if (acao === 'encerrar') comandos.push(this.sql("UPDATE chat_denuncias SET estado='encerrada' WHERE id=?", dId));
    await this.env.CHAT_DB.batch(comandos);
    if (acao === 'remover') {
      // Id opaco suficiente para invalidar DOM; não transmite conteúdo privado.
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Anexo;
        if (a.perfil && a.prazo > Date.now()) this.enviar(ws, { tipo: 'removida', id: m.id });
      }
    }
    if (acao === 'banir') for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Anexo).perfil?.id === m.autor) ws.close(4003, 'Acesso limitado pela moderação.');
    }
    return { ok: true };
  }

  private async entregar(): Promise<void> {
    const pendentes = await this.sql('SELECT m.* FROM chat_entregas e JOIN chat_mensagens m ON m.id=e.mensagem ORDER BY m.id LIMIT 100').all<MensagemChat>();
    for (const m of pendentes.results) {
      const c = m.conversa === 'global' ? null : await this.sql('SELECT * FROM chat_conversas WHERE id=?', m.conversa).first<Conversa>();
      const bloqueios = await this.sql('SELECT usuario,alvo FROM chat_bloqueios WHERE usuario=? OR alvo=?', m.autor, m.autor).all<{ usuario: string; alvo: string }>();
      const bloqueados = new Set(bloqueios.results.map(b => b.usuario === m.autor ? b.alvo : b.usuario));
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Anexo;
        if (!a.perfil || a.prazo <= Date.now() || bloqueados.has(a.perfil.id)) continue;
        if (m.conversa !== 'global' && (!c || c.estado !== 'aceita' || !participanteChat(c, a.perfil.id))) continue;
        this.enviar(ws, { tipo: 'mensagem', mensagem: m });
      }
      await this.sql('DELETE FROM chat_entregas WHERE mensagem=?', m.id).run();
    }
    if (pendentes.results.length === 100) await this.agendar(Date.now() + 1000);
  }
  async alarm(): Promise<void> {
    return this.serial(async () => {
      const now = Date.now();
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Anexo;
        if (this.env.CHAT_ENABLED !== 'true') ws.close(4003, 'Comunicações desativadas.');
        else if (a.prazo <= now) ws.close(4001, 'Renove a sessão.');
        else await this.agendar(a.prazo);
      }
      await this.entregar();
    });
  }
  private async limpar(): Promise<void> {
    const dia = 86400_000;
    await this.env.CHAT_DB.batch([
      this.sql(`DELETE FROM chat_mensagens WHERE (conversa='global' AND criado<?) OR criado<?`, Date.now() - CHAT.globalDias * dia, Date.now() - CHAT.privadaDias * dia),
      this.sql('DELETE FROM chat_entregas WHERE mensagem NOT IN (SELECT id FROM chat_mensagens)'),
      this.sql('DELETE FROM chat_denuncias WHERE criado<?', Date.now() - CHAT.denunciaDias * dia),
      this.sql('DELETE FROM chat_auditoria WHERE criado<?', Date.now() - 365 * dia),
      this.sql('DELETE FROM chat_sancoes WHERE ate<?', Date.now()),
    ]);
    for (const prefix of ['ticket:', 'limite:']) {
      let start: string | undefined;
      while (true) {
        const rows = await this.ctx.storage.list<{ validade?: number; atualizado?: number }>({ prefix, limit: 1000, ...(start ? { startAfter: start } : {}) });
        const expirados = [...rows].filter(([, v]) => (v.validade ?? (v.atualizado ?? 0) + dia) < Date.now()).map(([k]) => k);
        if (expirados.length) await this.ctx.storage.delete(expirados);
        if (rows.size < 1000) break;
        start = [...rows.keys()].at(-1);
      }
    }
  }
}
