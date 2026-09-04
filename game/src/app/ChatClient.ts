import { sessaoGuardada, tokenValido } from './conta';
import type { ConversaChat, EventoChat, MensagemChat, PerfilChat } from '../shared/chat';

export const CHAT_URL = (import.meta.env.VITE_CHAT_URL as string | undefined)?.replace(/\/$/, '') ?? '';
interface EstadoSocial {
  perfil: PerfilChat; conversas: ConversaChat[];
  bloqueios: { id: string; apelido: string }[]; preferencias: { privadas: number };
}

/** Rede social independente do loop/save. Nenhuma mensagem vai para localStorage. */
export class ChatClient extends EventTarget {
  perfil: PerfilChat | null = null;
  conversas: ConversaChat[] = [];
  bloqueios: { id: string; apelido: string }[] = [];
  privadas = true;
  status = CHAT_URL ? 'Desconectado' : 'Comunicações em preparação';
  readonly mensagens = new Map<string, MensagemChat[]>();
  private socket: WebSocket | null = null;
  private geracao = 0;
  private usuario = '';
  private tentativas = 0;
  private ativo = false;
  private conectando = false;
  private acessoSuspenso = false;
  private cacheGeracao = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private ping?: ReturnType<typeof setInterval>;
  private pongPrazo?: ReturnType<typeof setTimeout>;
  private vigia?: ReturnType<typeof setInterval>;
  private estadoPendente = false;
  private precisaRecarregar = false;
  private readonly aoVoltar = (): void => { if (document.visibilityState === 'visible') this.verificarConta(); };
  private readonly aoMudarConta = (): void => this.verificarConta();

  constructor(private readonly url = CHAT_URL) { super(); }
  private emitir(tipo: string): void { this.dispatchEvent(new Event(tipo)); }

  async pedir<T>(pedido: Record<string, unknown>): Promise<T> {
    const antes = sessaoGuardada()?.usuarioId;
    const geracao = this.geracao;
    if (!this.url) throw new Error('O servidor de comunicação ainda não foi ativado.');
    const token = await tokenValido();
    if (!token || !antes || antes !== sessaoGuardada()?.usuarioId) throw new Error('Entre na sua conta para acessar o chat.');
    const r = await fetch(`${this.url}/chat/api`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(pedido), signal: AbortSignal.timeout(12_000),
    });
    const dados = await r.json() as T & { erro?: string };
    // Resposta de uma conta anterior não pode reaparecer após logout/troca.
    if (geracao !== this.geracao || antes !== sessaoGuardada()?.usuarioId) throw new Error('A conta mudou. Abra novamente o chat.');
    if (!r.ok) throw new Error(dados.erro ?? 'Não foi possível concluir a ação.');
    return dados;
  }

  iniciar(): void {
    if (this.ativo) return;
    this.ativo = true;
    this.usuario = sessaoGuardada()?.usuarioId ?? '';
    window.addEventListener('oz:conta', this.aoMudarConta);
    window.addEventListener('storage', this.aoMudarConta);
    document.addEventListener('visibilitychange', this.aoVoltar);
    this.vigia = setInterval(() => this.verificarConta(), 5000);
    void this.conectar();
  }
  private verificarConta(): void {
    const atual = sessaoGuardada()?.usuarioId ?? '';
    if (atual !== this.usuario) {
      this.desconectar(); this.usuario = atual;
      this.acessoSuspenso = false;
      this.perfil = null; this.conversas = []; this.bloqueios = []; this.mensagens.clear();
      this.emitir('limpar'); this.emitir('estado');
      if (this.ativo) void this.conectar();
    } else if (this.ativo && this.url && atual && !this.socket && !this.timer) void this.conectar();
  }
  private desconectar(): void {
    this.geracao++;
    this.conectando = false;
    this.cacheGeracao++;
    clearTimeout(this.timer); this.timer = undefined;
    clearInterval(this.ping); this.ping = undefined;
    clearTimeout(this.pongPrazo);
    const socket = this.socket; this.socket = null;
    if (socket) { socket.onclose = null; socket.close(); }
  }
  private async conectar(): Promise<void> {
    if (!this.ativo || this.socket || this.conectando || this.acessoSuspenso) return;
    this.conectando = true;
    const geracao = this.geracao;
    this.status = 'Conectando…'; this.emitir('estado');
    try {
      const { ticket, perfil } = await this.pedir<{ ticket: string; perfil: PerfilChat }>({ op: 'ticket' });
      if (geracao !== this.geracao || !this.ativo) return;
      this.perfil = perfil;
      const url = new URL(`${this.url}/chat/socket`);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url);
      this.socket = ws;
      ws.onopen = () => ws.send(JSON.stringify({ ticket }));
      ws.onmessage = e => {
        if (geracao !== this.geracao || sessaoGuardada()?.usuarioId !== this.usuario) { this.verificarConta(); return; }
        if (e.data === 'pong') { clearTimeout(this.pongPrazo); return; }
        let evento: EventoChat;
        try { evento = JSON.parse(String(e.data)) as EventoChat; } catch { return; }
        if (evento.tipo === 'pronto') {
          this.tentativas = 0; this.status = 'Canal conectado'; this.perfil = evento.perfil;
          this.ping = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping'); clearTimeout(this.pongPrazo);
              this.pongPrazo = setTimeout(() => ws.close(4000, 'Conexão sem resposta.'), 15_000);
            }
          }, 30_000);
          void this.recuperar().catch(() => { this.status = 'Histórico indisponível. Tente atualizar.'; this.emitir('estado'); });
          this.emitir('estado');
        }
        if (evento.tipo === 'mensagem') {
          this.receber(evento.mensagem);
          if (evento.mensagem.conversa !== 'global') this.atualizarEstadoEmBreve();
        }
        if (evento.tipo === 'atualizar') {
          // Um bloqueio pode invalidar conteúdo já recebido em outra aba.
          this.cacheGeracao++; this.mensagens.clear(); this.emitir('mensagens'); this.atualizarEstadoEmBreve(true);
        }
        if (evento.tipo === 'estado') this.atualizarEstadoEmBreve();
        if (evento.tipo === 'removida') {
          for (const lista of this.mensagens.values()) for (const m of lista) if (m.id === evento.id) { m.texto = ''; m.removida = 1; }
          this.emitir('mensagens');
        }
      };
      ws.onclose = e => {
        if (this.socket !== ws) return;
        this.socket = null; clearInterval(this.ping); clearTimeout(this.pongPrazo);
        this.acessoSuspenso = e.code === 4003;
        this.status = e.code === 4003 ? 'Acesso limitado pela moderação.' : 'Reconectando…'; this.emitir('estado');
        if (e.code !== 4003) this.reconectar();
      };
      ws.onerror = () => { /* onclose determina reconexão; não abre sockets concorrentes */ };
    } catch (e) {
      if (geracao !== this.geracao) return;
      this.status = e instanceof Error ? e.message : 'Comunicações indisponíveis.'; this.emitir('estado');
      if (this.url && this.usuario) this.reconectar();
    } finally {
      if (geracao === this.geracao) this.conectando = false;
    }
  }
  private reconectar(): void {
    if (!this.ativo || this.timer) return;
    const espera = Math.min(60_000, 1500 * 2 ** Math.min(this.tentativas++, 6)) + Math.random() * 1000;
    this.timer = setTimeout(() => { this.timer = undefined; void this.conectar(); }, espera);
  }
  async atualizarEstado(): Promise<void> {
    if (!this.perfil?.podeEnviar) return;
    const estado = await this.pedir<EstadoSocial>({ op: 'estado' });
    this.perfil = estado.perfil; this.conversas = estado.conversas;
    this.bloqueios = estado.bloqueios; this.privadas = estado.preferencias?.privadas !== 0;
    this.emitir('estado');
  }
  private atualizarEstadoEmBreve(recarregar = false): void {
    this.precisaRecarregar ||= recarregar;
    if (this.estadoPendente) return;
    this.estadoPendente = true;
    setTimeout(() => {
      this.estadoPendente = false;
      const recarregar = this.precisaRecarregar; this.precisaRecarregar = false;
      if (this.ativo) void this.atualizarEstado().then(() => { if (recarregar) this.emitir('reconectado'); }).catch(() => undefined);
    }, 300);
  }
  private async recuperar(): Promise<void> {
    await this.atualizarEstado();
    await this.historico('global');
    // Histórico de privadas é buscado somente quando a conversa é aberta.
    this.emitir('reconectado');
  }
  receber(m: MensagemChat): void {
    const lista = this.mensagens.get(m.conversa) ?? [];
    const index = lista.findIndex(x => x.id === m.id);
    if (index >= 0) lista[index] = m; else lista.push(m);
    lista.sort((a, b) => a.id - b.id);
    this.mensagens.set(m.conversa, lista.slice(-150));
    this.emitir('mensagens');
  }
  async historico(conversa: string, antes = 0): Promise<number> {
    const cacheGeracao = this.cacheGeracao;
    const { mensagens } = await this.pedir<{ mensagens: MensagemChat[] }>({ op: 'historico', conversa, antes });
    if (cacheGeracao !== this.cacheGeracao) return 0;
    const atuais = this.mensagens.get(conversa) ?? [];
    // Atualização recente substitui a janela, evitando lacunas invisíveis após
    // suspensão longa. Mantém somente eventos mais novos que chegaram no fetch.
    const ultimo = mensagens.at(-1)?.id ?? 0;
    const mapa = new Map((antes ? atuais : atuais.filter(m => m.id > ultimo)).map(m => [m.id, m]));
    for (const m of mensagens) mapa.set(m.id, m);
    const lista = [...mapa.values()].sort((a, b) => a.id - b.id);
    this.mensagens.set(conversa, antes ? lista.slice(0, 150) : lista.slice(-150));
    this.emitir('mensagens');
    return mensagens.length;
  }
  async enviar(conversa: string, texto: string, clienteId: string): Promise<void> {
    const { mensagem } = await this.pedir<{ mensagem: MensagemChat }>({ op: 'enviar', conversa, texto, clienteId });
    this.receber(mensagem);
  }
  async ler(conversa: string, cursor: number): Promise<void> {
    if (conversa === 'global' || !this.perfil?.podeEnviar) return;
    await this.pedir({ op: 'ler', conversa, cursor });
    const c = this.conversas.find(c => c.id === conversa);
    if (c) c.naoLidas = 0;
    this.emitir('estado');
  }
  destruir(): void {
    this.ativo = false; this.desconectar(); clearInterval(this.vigia);
    window.removeEventListener('oz:conta', this.aoMudarConta);
    window.removeEventListener('storage', this.aoMudarConta);
    document.removeEventListener('visibilitychange', this.aoVoltar);
    this.mensagens.clear();
  }
}
