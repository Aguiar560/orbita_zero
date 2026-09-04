import { ChatClient } from '@app/ChatClient';
import { CHAT, textoChat, type DenunciaChat, type MensagemChat } from '../shared/chat';
import { clear, h } from './dom';
import '../styles/chat.css';

type Aba = 'global' | 'privadas' | 'ajustes' | 'moderacao';

/** Não é um Panel do Shell: texto/foco não podem ser reconstruídos a 5 Hz. */
export class ChatPanel {
  readonly botao = h('button.chat-launch', { text: '◈ CHAT', 'aria-label': 'Abrir comunicações', 'aria-expanded': 'false', 'aria-controls': 'oz-chat' }) as HTMLButtonElement;
  readonly root = h('section.chat-panel#oz-chat', { 'data-chat': 'true', role: 'dialog', 'aria-label': 'Comunicações', hidden: true });
  private readonly status = h('p.chat-status', { role: 'status' });
  private readonly aviso = h('p.chat-aviso', { role: 'status' });
  private readonly conteudo = h('.chat-conteudo');
  private readonly acoes = h('.chat-acoes');
  private readonly abas = h('nav.chat-abas', { 'aria-label': 'Canais de comunicação' });
  private readonly campo = h('textarea.chat-campo', { rows: '2', maxlength: '800', placeholder: 'Escreva sua mensagem…', 'aria-label': 'Mensagem' }) as HTMLTextAreaElement;
  private readonly enviar = h('button.chat-enviar', { text: 'Enviar', type: 'submit' }) as HTMLButtonElement;
  private readonly contador = h('span.chat-contador', { text: `0/${CHAT.caracteres}` });
  private readonly formulario = h('form.chat-form');
  private log: HTMLElement | null = null;
  private cabecalhoConversa: HTMLElement | null = null;
  private aba: Aba = 'global';
  private conversa = 'global';
  private aberta = false;
  private enviando = false;
  private pendente: { conversa: string; texto: string; id: string } | null = null;
  private ultimaLeitura = 0;
  private carregando = false;
  private geracaoTela = 0;
  private avisosSilenciados = false;
  private readonly aoViewport = (): void => {
    const v = window.visualViewport;
    if (v) { this.root.style.setProperty('--chat-vh', `${v.height}px`); this.root.style.setProperty('--chat-top', `${v.offsetTop}px`); }
  };

  constructor(private readonly cliente = new ChatClient()) {
    const fechar = h('button.chat-fechar', { text: '×', title: 'Fechar chat', 'aria-label': 'Fechar comunicações', onclick: () => this.fechar() });
    this.root.append(h('header.chat-topo', {}, h('div', {}, h('small', { text: 'ÓRBITA ZERO / REDE SOCIAL' }), h('h2', { text: 'Comunicações' })), fechar), this.status, this.abas, this.conteudo, this.acoes, this.aviso, this.formulario,
      h('p.chat-privacidade', { text: 'Texto e emojis · Global: 7 dias · Privadas: 90 dias. Sem criptografia ponta a ponta. Denúncias: evidência por 180 dias.' }));
    this.formulario.append(this.campo, h('.chat-envio', {}, this.contador, this.enviar));
    this.botao.onclick = () => this.aberta ? this.fechar() : this.abrir();
    this.formulario.onsubmit = e => { e.preventDefault(); void this.enviarMensagem(); };
    this.campo.oninput = () => {
      this.contador.textContent = `${[...this.campo.value].length}/${CHAT.caracteres}`;
      this.atualizarPermissao();
    };
    this.campo.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void this.enviarMensagem(); }
    };
    this.root.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.fechar(); }
      if (e.key === 'Tab') {
        const focaveis = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el => el.offsetParent !== null);
        const primeiro = focaveis[0], ultimo = focaveis.at(-1);
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
      }
    };
    this.cliente.addEventListener('estado', () => this.atualizarEstado());
    this.cliente.addEventListener('mensagens', () => this.pintarMensagens());
    this.cliente.addEventListener('reconectado', () => { if (this.aberta) void this.carregar(); });
    this.cliente.addEventListener('limpar', () => {
      this.geracaoTela++; this.pendente = null; this.campo.value = ''; this.contador.textContent = '0/400';
      this.conversa = 'global'; this.aba = 'global'; this.ultimaLeitura = 0;
      clear(this.acoes); this.aviso.textContent = ''; this.montar();
    });
    window.visualViewport?.addEventListener('resize', this.aoViewport);
    window.visualViewport?.addEventListener('scroll', this.aoViewport);
    this.aoViewport(); this.montar(); this.atualizarEstado();
  }

  abrir(): void {
    this.aberta = true; this.root.hidden = false;
    this.botao.setAttribute('aria-expanded', 'true');
    window.dispatchEvent(new Event('oz:chat-foco'));
    this.cliente.iniciar(); this.aoViewport();
    this.pintarMensagens();
    this.root.querySelector<HTMLButtonElement>('.chat-fechar')?.focus();
    if (this.cliente.perfil) void this.carregar();
  }
  fechar(): void {
    this.aberta = false; this.root.hidden = true;
    this.botao.setAttribute('aria-expanded', 'false');
    window.dispatchEvent(new Event('oz:chat-foco')); this.botao.focus();
  }
  private informar(texto: string): void { this.aviso.textContent = texto; }
  private async executar(acao: () => Promise<void>): Promise<void> {
    const geracao = this.geracaoTela;
    try { await acao(); } catch (e) {
      if (geracao === this.geracaoTela) this.informar(e instanceof Error ? e.message : 'Não foi possível concluir.');
    }
  }
  private trocar(aba: Aba, conversa = 'global'): void {
    this.geracaoTela++; this.aba = aba; this.conversa = conversa;
    this.ultimaLeitura = 0; this.campo.value = ''; this.contador.textContent = '0/400';
    this.pendente = null; clear(this.acoes); this.informar('');
    this.montar(); void this.carregar();
  }
  private montar(): void {
    clear(this.abas);
    const nomes: [Aba, string][] = [['global', 'Global'], ['privadas', 'Privadas'], ['ajustes', 'Ajustes']];
    if (this.cliente.perfil?.moderador) nomes.push(['moderacao', 'Moderação']);
    for (const [id, nome] of nomes) this.abas.append(h(`button${this.aba === id ? '.ativa' : ''}`, { text: nome, 'aria-pressed': String(this.aba === id), onclick: () => this.trocar(id) }));
    clear(this.conteudo); this.log = null; this.cabecalhoConversa = null;
    const conversaAberta = this.aba === 'global' || (this.aba === 'privadas' && this.conversa !== 'global');
    this.formulario.hidden = !conversaAberta;
    if (conversaAberta) {
      this.cabecalhoConversa = h('.chat-canal');
      const anterior = h('button.chat-anteriores', { text: 'Carregar anteriores', onclick: () => {
        const primeiro = this.cliente.mensagens.get(this.conversa)?.[0]?.id;
        if (!primeiro || this.carregando) return;
        void this.executar(async () => {
          this.carregando = true;
          try { const n = await this.cliente.historico(this.conversa, primeiro); if (!n) this.informar('Início do histórico disponível.'); }
          finally { this.carregando = false; }
        });
      } });
      this.log = h('.chat-log', { role: 'log', 'aria-label': 'Mensagens', 'aria-live': 'off', tabindex: '0' });
      this.log.onscroll = () => this.marcarLeitura();
      this.conteudo.append(this.cabecalhoConversa, anterior, this.log);
      this.pintarCabecalho(); this.pintarMensagens();
    } else if (this.aba === 'privadas') this.montarPrivadas();
    else if (this.aba === 'ajustes') this.montarAjustes();
    else this.montarModeracao();
    this.atualizarPermissao();
  }
  private pintarCabecalho(): void {
    if (!this.cabecalhoConversa) return;
    clear(this.cabecalhoConversa);
    if (this.conversa === 'global') {
      this.cabecalhoConversa.append(h('strong', { text: 'CANAL GLOBAL' }), h('span', { text: 'Respeite os outros pilotos. Nunca compartilhe senhas ou dados pessoais.' }));
      return;
    }
    const c = this.cliente.conversas.find(c => c.id === this.conversa);
    this.cabecalhoConversa.append(h('button', { text: '← Conversas', onclick: () => this.trocar('privadas') }), h('strong', { text: c?.apelido ?? 'Conversa indisponível' }));
    if (!c) return;
    if (c.estado === 'pendente') {
      this.cabecalhoConversa.append(h('span', { text: c.iniciador === this.cliente.perfil?.id ? 'Aguardando o piloto aceitar sua solicitação.' : 'Este piloto quer conversar com você.' }));
      if (c.iniciador !== this.cliente.perfil?.id) for (const aceitar of [true, false]) this.cabecalhoConversa.append(h('button', {
        text: aceitar ? 'Aceitar' : 'Recusar', onclick: () => void this.executar(async () => {
          await this.cliente.pedir({ op: 'responder', conversa: c.id, aceitar }); await this.cliente.atualizarEstado();
        }),
      }));
    } else if (c.estado === 'recusada') this.cabecalhoConversa.append(h('span', { text: 'Solicitação recusada.' }));
    this.cabecalhoConversa.append(h('button', { text: 'Bloquear', onclick: () => this.confirmarBloqueio(c.outro, c.apelido) }));
  }
  private montarPrivadas(): void {
    const pesquisa = h('input', { placeholder: 'Apelido do piloto', 'aria-label': 'Buscar jogador pelo apelido', maxlength: '16', minlength: '3', required: true }) as HTMLInputElement;
    const resultados = h('.chat-resultados');
    const buscar = h('form.chat-busca', {}, pesquisa, h('button', { text: 'Buscar', type: 'submit' }));
    buscar.onsubmit = e => { e.preventDefault(); void this.executar(async () => {
      const r = await this.cliente.pedir<{ jogadores: { id: string; apelido: string }[] }>({ op: 'buscar', apelido: pesquisa.value });
      clear(resultados);
      if (!r.jogadores.length) resultados.append(h('p', { text: 'Nenhum piloto disponível. A busca inclui quem já acessou o chat.' }));
      for (const p of r.jogadores) resultados.append(h('button.chat-contato', { text: `${p.apelido} · Solicitar conversa`, onclick: () => this.solicitar(p.id) }));
    }); };
    this.conteudo.append(h('p.chat-ajuda', { text: 'Novas conversas precisam ser aceitas. Você pode bloquear ou denunciar a qualquer momento.' }), buscar, resultados, h('.chat-conversas'));
    this.pintarConversas();
  }
  private pintarConversas(): void {
    const host = this.conteudo.querySelector<HTMLElement>('.chat-conversas');
    if (!host) return;
    clear(host);
    if (!this.cliente.conversas.length) host.append(h('p.chat-vazio', { text: 'Sua frequência particular está livre. Encontre um piloto para iniciar uma conversa.' }));
    for (const c of this.cliente.conversas) host.append(h('button.chat-contato', {
      onclick: () => this.trocar('privadas', c.id),
    }, h('strong', { text: c.apelido }), h('span', { text: c.estado === 'pendente' ? (c.iniciador === this.cliente.perfil?.id ? 'Solicitação enviada' : 'Solicitação recebida') : c.estado === 'recusada' ? 'Recusada' : 'Canal particular' }), c.naoLidas ? h('b.chat-badge', { text: String(c.naoLidas) }) : null));
  }
  private solicitar(alvo: string): void {
    void this.executar(async () => {
      const r = await this.cliente.pedir<{ conversa: string }>({ op: 'solicitar', alvo });
      await this.cliente.atualizarEstado(); this.trocar('privadas', r.conversa);
    });
  }
  private montarAjustes(): void {
    const privado = h('input', { type: 'checkbox', 'aria-label': 'Receber novas solicitações particulares' }) as HTMLInputElement;
    privado.checked = this.cliente.privadas;
    privado.onchange = () => void this.executar(async () => {
      await this.cliente.pedir({ op: 'preferencias', privadas: privado.checked }); await this.cliente.atualizarEstado();
    });
    const silencioso = h('input', { type: 'checkbox', 'aria-label': 'Silenciar contador de avisos' }) as HTMLInputElement;
    silencioso.checked = this.avisosSilenciados;
    silencioso.onchange = () => { this.avisosSilenciados = silencioso.checked; this.atualizarEstado(); };
    this.conteudo.append(h('label.chat-opcao', {}, privado, 'Receber novas solicitações'), h('label.chat-opcao', {}, silencioso, 'Silenciar contador nesta sessão'), h('h3', { text: 'Pilotos bloqueados' }));
    if (!this.cliente.bloqueios.length) this.conteudo.append(h('p.chat-ajuda', { text: 'Nenhum piloto bloqueado.' }));
    for (const p of this.cliente.bloqueios) this.conteudo.append(h('button.chat-contato', { text: `Desbloquear ${p.apelido ?? 'piloto'}`, onclick: () => void this.executar(async () => {
      await this.cliente.pedir({ op: 'desbloquear', alvo: p.id }); await this.cliente.atualizarEstado(); this.montar();
    }) }));
    this.conteudo.append(h('p.chat-ajuda', { text: 'Conversas privadas são restritas aos participantes. A equipe pode revisar mensagens denunciadas, com registro de acesso. O combate continua enquanto o chat está aberto.' }));
  }
  private montarModeracao(): void {
    const lista = h('.chat-denuncias');
    this.conteudo.append(h('p.chat-ajuda', { text: 'Acesso auditado. Revise apenas o necessário para tratar a denúncia.' }), h('button', { text: 'Consultar denúncias', onclick: () => void this.executar(async () => {
      const { denuncias } = await this.cliente.pedir<{ denuncias: DenunciaChat[] }>({ op: 'denuncias' });
      clear(lista);
      if (!denuncias.length) lista.append(h('p', { text: 'Nenhuma denúncia aberta.' }));
      for (const d of denuncias) {
        const m = JSON.parse(d.evidencia) as MensagemChat;
        lista.append(h('article.chat-denuncia', {}, h('strong', { text: m.apelido }), h('p', { text: m.texto }), h('p', { text: `Motivo: ${d.motivo}` }), h('button', { text: 'Revisar', onclick: () => this.revisar(d) })));
      }
    }) }), lista);
  }
  private revisar(d: DenunciaChat): void {
    clear(this.acoes);
    const acao = h('select', { 'aria-label': 'Ação de moderação' }) as HTMLSelectElement;
    for (const [id, label] of [['remover', 'Remover mensagem'], ['silenciar', 'Silenciar'], ['banir', 'Suspender chat'], ['revogar', 'Revogar sanção'], ['encerrar', 'Encerrar denúncia']]) acao.append(h('option', { value: id, text: label }));
    const horas = h('input', { type: 'number', min: '1', max: '720', value: '24', 'aria-label': 'Duração em horas' }) as HTMLInputElement;
    const motivo = h('textarea', { placeholder: 'Justificativa obrigatória', 'aria-label': 'Justificativa de moderação', maxlength: '400' }) as HTMLTextAreaElement;
    this.acoes.append(acao, horas, motivo, h('button', { text: 'Aplicar ação', onclick: () => void this.executar(async () => {
      await this.cliente.pedir({ op: 'moderar', denuncia: d.id, acao: acao.value, horas: Number(horas.value), motivo: motivo.value });
      clear(this.acoes); this.informar('Ação registrada.');
    }) }), this.cancelarAcao());
    motivo.focus();
  }
  private cancelarAcao(): HTMLElement { return h('button', { text: 'Cancelar', onclick: () => clear(this.acoes) }); }
  private confirmarBloqueio(id: string, nome: string): void {
    clear(this.acoes).append(h('p', { text: `Bloquear ${nome}? As mensagens deixarão de aparecer e novas privadas serão impedidas.` }), h('button', { text: 'Confirmar bloqueio', onclick: () => void this.executar(async () => {
      await this.cliente.pedir({ op: 'bloquear', alvo: id });
      this.cliente.mensagens.clear(); await this.cliente.atualizarEstado(); this.trocar('global');
    }) }), this.cancelarAcao());
  }
  private acoesMensagem(m: MensagemChat): void {
    clear(this.acoes).append(h('strong', { text: m.apelido }), h('button', { text: 'Conversa particular', onclick: () => this.solicitar(m.autor) }), h('button', { text: 'Bloquear', onclick: () => this.confirmarBloqueio(m.autor, m.apelido) }), h('button', { text: 'Denunciar mensagem', onclick: () => {
      clear(this.acoes);
      const motivo = h('textarea', { placeholder: 'Por que você está denunciando?', 'aria-label': 'Motivo da denúncia', maxlength: '400' }) as HTMLTextAreaElement;
      this.acoes.append(motivo, h('button', { text: 'Enviar denúncia', onclick: () => void this.executar(async () => {
        await this.cliente.pedir({ op: 'denunciar', mensagem: m.id, motivo: motivo.value });
        clear(this.acoes); this.informar('Denúncia enviada à equipe. Obrigado por ajudar a comunidade.');
      }) }), this.cancelarAcao()); motivo.focus();
    } }), this.cancelarAcao());
  }
  private pintarMensagens(): void {
    if (!this.log || !this.aberta) return;
    const noFim = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 60;
    const topo = this.log.scrollTop;
    const altura = this.log.scrollHeight;
    clear(this.log);
    const mensagens = this.cliente.mensagens.get(this.conversa) ?? [];
    if (!mensagens.length) this.log.append(h('p.chat-vazio', { text: this.cliente.perfil ? 'Nenhuma transmissão neste canal. Que tal dizer olá?' : 'Abra uma frequência para encontrar outros pilotos.' }));
    for (const m of mensagens) {
      const meu = m.autor === this.cliente.perfil?.id;
      const autor = h(meu ? 'strong' : 'button.chat-autor', { text: meu ? `${m.apelido} · você` : m.apelido, ...(!meu ? { onclick: () => this.acoesMensagem(m), title: 'Conversa, bloqueio ou denúncia' } : {}) });
      this.log.append(h(`article.chat-mensagem${meu ? '.minha' : ''}`, {}, h('header', {}, autor, h('time', { text: new Date(m.criado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), datetime: new Date(m.criado).toISOString() })), h('p', { text: m.removida ? 'Mensagem removida pela moderação.' : m.texto })));
    }
    if (noFim && !this.carregando) this.log.scrollTop = this.log.scrollHeight;
    else if (this.carregando) this.log.scrollTop = topo + this.log.scrollHeight - altura;
    else { this.log.scrollTop = topo; if (this.aberta) this.informar('Novas mensagens no canal. Role até o final para acompanhar.'); }
    this.marcarLeitura();
  }
  private marcarLeitura(): void {
    if (!this.aberta || document.visibilityState !== 'visible' || !this.log || this.conversa === 'global') return;
    if (this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight > 60) return;
    const id = this.cliente.mensagens.get(this.conversa)?.at(-1)?.id ?? 0;
    if (id <= this.ultimaLeitura) return;
    this.ultimaLeitura = id;
    void this.cliente.ler(this.conversa, id).catch(() => { this.ultimaLeitura = 0; });
  }
  private atualizarEstado(): void {
    this.status.textContent = this.cliente.status;
    const naoLidas = this.cliente.conversas.reduce((n, c) => n + c.naoLidas + Number(c.estado === 'pendente' && c.iniciador !== this.cliente.perfil?.id), 0);
    this.botao.textContent = `◈ CHAT${naoLidas && !this.avisosSilenciados ? ` · ${Math.min(99, naoLidas)}` : ''}`;
    if (this.cliente.perfil?.moderador && this.abas.children.length === 3) this.montar();
    this.pintarCabecalho(); this.pintarConversas(); this.atualizarPermissao();
    if (this.cliente.perfil && !this.cliente.perfil.podeEnviar) this.informar('Leitura do global liberada. Vincule uma conta e escolha um apelido para conversar.');
  }
  private atualizarPermissao(): void {
    const c = this.cliente.conversas.find(c => c.id === this.conversa);
    const pode = !!this.cliente.perfil?.podeEnviar && (this.conversa === 'global' || c?.estado === 'aceita');
    this.campo.disabled = !pode || this.enviando;
    this.enviar.disabled = !pode || this.enviando || !textoChat(this.campo.value);
    this.enviar.textContent = this.enviando ? 'Enviando…' : this.pendente ? 'Tentar novamente' : 'Enviar';
  }
  private async carregar(): Promise<void> {
    if (!this.cliente.perfil) return;
    await this.executar(async () => {
      if (this.aba === 'global' || (this.aba === 'privadas' && this.conversa !== 'global')) await this.cliente.historico(this.conversa);
      else await this.cliente.atualizarEstado();
    });
  }
  private async enviarMensagem(): Promise<void> {
    const texto = textoChat(this.campo.value);
    if (!texto || this.enviar.disabled || this.enviando) return;
    const conversa = this.conversa;
    const geracao = this.geracaoTela;
    const pendente = this.pendente?.texto === texto && this.pendente.conversa === conversa ? this.pendente : { conversa, texto, id: crypto.randomUUID() };
    this.pendente = pendente; this.enviando = true; this.atualizarPermissao(); this.informar('');
    try {
      await this.cliente.enviar(conversa, texto, pendente.id);
      if (geracao === this.geracaoTela) { this.campo.value = ''; this.contador.textContent = '0/400'; this.pendente = null; this.informar('Enviada ao servidor.'); }
    } catch (e) {
      if (geracao === this.geracaoTela) this.informar(`${e instanceof Error ? e.message : 'Falha no envio.'} Você pode tentar novamente.`);
    } finally {
      this.enviando = false; this.atualizarPermissao();
      if (geracao === this.geracaoTela && this.aberta) this.campo.focus();
    }
  }
  destruir(): void {
    this.cliente.destruir(); this.root.remove(); this.botao.remove();
    window.visualViewport?.removeEventListener('resize', this.aoViewport);
    window.visualViewport?.removeEventListener('scroll', this.aoViewport);
  }
}
