import {
  NOME_DO_PROVEDOR, cadastrar, codigoIndicacaoPendente, entrar, entrarComProvedor,
  limparCodigoIndicacaoPendente, recolherSessaoDaUrl, sair, sessaoGuardada,
  tokenValido, type Provedor, type Sessao,
} from '@app/conta';
import { reivindicarSessao } from '@app/sessao-unica';
import { clear, h } from './dom';
import { montarLanding } from './Landing';
import '../styles/landing.css';

/**
 * A porta de entrada: a capa aparece primeiro; o formulário, só após a escolha
 * explícita entre Entrar e Criar conta no topo.
 *
 * ## Por que NÃO dá mais para entrar sem sessão
 *
 * Havia um recuo: se o cadastro anônimo falhasse, esta tela resolvia com
 * `null` e deixava jogar só com o save do navegador. O argumento era que um
 * ajuste de painel esquecido não podia impedir alguém de jogar.
 *
 * Ele valia enquanto o loot rolava no cliente — sem conta o jogo funcionava,
 * só não sincronizava. Depois que o lote passou a vir do servidor (Fase 3), a
 * mesma linha significa outra coisa: `garantirLote` desiste sem token, o pote
 * nunca chega e **nenhum item cai, nunca**. Abate, XP e recurso continuam
 * entrando, então nada parece quebrado — e a dívida de drop tem teto de 100,
 * mora só em memória e morre ao fechar a aba.
 *
 * Entrar sem sessão virou, então, jogar um jogo que não é o jogo. A capa pode
 * ser vista sem conta, mas o boot espera uma sessão antes de iniciar a partida.
 *
 * ## Por que uma tela e não um painel
 *
 * Ela roda ANTES do laço, junto da escolha de piloto, pelo mesmo motivo: se o
 * save da nuvem for mais recente, ele troca o estado inteiro, e um quadro que
 * seja do estado errado é uma piscada errada na primeira tela que se vê.
 */
export class Login {
  private readonly root = h('.login-tela.landing-tela');
  /** Sem modo, a capa fica limpa e mostra somente as ações no topo. */
  private modo: 'entrar' | 'criar' | null = null;
  private ocupado = false;
  /** Espera de provedor em curso. Ver `comProvedor`: não trava o botão. */
  private esperandoProvedor = false;
  private recado = '';

  /**
   * Mostra a tela e resolve com a SESSÃO. Não existe caminho para `null`.
   *
   * O tipo é a regra: quem chama não precisa tratar "entrou sem conta" porque
   * isso deixou de ser possível. A promessa fica pendente enquanto a pessoa
   * não entra, e o jogo não começa — que é o ponto.
   *
   * Uma sessão guardada e ainda válida dispensa a tela: `tokenValido` renova
   * sozinho quando falta pouco, então quem já entrou não vê isto de novo.
   */
  async mostrar(host: HTMLElement): Promise<Sessao> {
    // A volta do Google ou do Facebook chega como fragmento na URL. Recolher
    // ANTES de olhar a sessão guardada é o que faz o jogador cair direto no
    // jogo em vez de ver a tela de login de novo, logo depois de autorizar.
    recolherSessaoDaUrl();

    const guardada = sessaoGuardada();
    if (guardada) {
      if (await tokenValido()) {
        if (await this.autorizarSessao(host)) {
          this.root.remove();
          return sessaoGuardada()!;
        }
      } else {
        // Sessão que existia mas não renova é sessão morta. Uma sessão apenas
        // CONFLITANTE não é apagada: em duas abas do mesmo navegador isso
        // também desconectaria a aba antiga que o jogador decidiu preservar.
        sair();
      }
    }

    return new Promise((resolve) => {
      const concluir = async (sessao: Sessao): Promise<void> => {
        this.ocupado = true;
        if (!await this.autorizarSessao(host)) {
          this.ocupado = false;
          this.render((s) => { void concluir(s); });
          return;
        }
        this.root.remove();
        resolve(sessao);
      };
      this.render((sessao) => { void concluir(sessao); });
      host.append(this.root);
    });
  }

  /** Confere a sessão antes de deixar qualquer save ou tela do jogo abrir. */
  private async autorizarSessao(host: HTMLElement): Promise<boolean> {
    const primeira = await reivindicarSessao(false);
    if (primeira.estado === 'ativa') return true;
    if (primeira.estado === 'email_nao_confirmado') {
      sair();
      this.recado = 'Confirme seu e-mail pelo link enviado antes de entrar no jogo.';
      return false;
    }
    if (primeira.estado === 'confirmacao_email_nao_configurada') {
      sair();
      this.recado = 'As contas estão temporariamente bloqueadas enquanto a confirmação de e-mail é configurada.';
      return false;
    }
    if (primeira.estado === 'verificacao_email_indisponivel') {
      this.recado = 'Não foi possível verificar a confirmação do e-mail. Tente novamente.';
      return false;
    }
    if (primeira.estado !== 'conflito') {
      this.recado = 'Não foi possível verificar a sessão ativa. Tente novamente.';
      return false;
    }

    if (!await this.perguntarSeSubstitui(host)) {
      this.recado = 'Entrada cancelada. A outra sessão continua ativa.';
      return false;
    }
    const forçada = await reivindicarSessao(true);
    if (forçada.estado === 'ativa') return true;
    this.recado = 'Não foi possível encerrar a sessão anterior. Tente novamente.';
    return false;
  }

  private perguntarSeSubstitui(host: HTMLElement): Promise<boolean> {
    if (!this.root.isConnected) host.append(this.root);
    return new Promise((resolve) => {
      let decidiu = false;
      const escolher = (valor: boolean): void => {
        if (decidiu) return;
        decidiu = true;
        resolve(valor);
      };
      clear(this.root).append(
        h('.login-fundo'),
        h('section.login-modal-camada', {
          role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sessão já ativa',
        },
        h('.login-caixa', {},
          h('span.login-etiqueta', { text: 'SESSÃO JÁ ATIVA' }),
          h('h1.login-titulo', { text: 'Esta conta já está aberta' }),
          h('p.login-sub', {
            text: 'Existe uma sessão ativa em outro navegador, dispositivo ou aba. Deseja entrar aqui mesmo? Ao continuar, o local anterior será desconectado.',
          }),
          h('button.login-enviar', {
            type: 'button', text: 'ENTRAR MESMO ASSIM', onclick: () => escolher(true),
          }),
          h('button.login-pular', {
            type: 'button', text: 'CANCELAR', onclick: () => escolher(false),
          }),
        )),
      );
    });
  }

  private render(pronto: (s: Sessao) => void): void {
    const abrir = (modo: 'entrar' | 'criar'): void => {
      if (this.ocupado || this.esperandoProvedor) return;
      this.modo = modo;
      this.recado = '';
      this.render(pronto);
    };

    /**
     * A capa virou UMA página, e por isso não existe mais `navegar`.
     *
     * Ela tinha quatro (O JOGO · NAVES · GALÁXIAS · COMUNIDADE), e a troca
     * entre elas era estado desta classe. As seções de hoje vivem na mesma
     * página e se alcançam rolando — ver `irPara` em `Landing.ts`, que usa
     * botão em vez de âncora justamente para não reescrever o fragmento da URL
     * onde a volta do Google chega.
     */
    clear(this.root).append(
      h('.login-fundo'),
      montarLanding({
        entrar: () => abrir('entrar'),
        criarConta: () => abrir('criar'),
        jogar: () => abrir('criar'),
      }),
    );

    // A capa nasce sem formulário. Ele só existe depois de uma escolha
    // explícita no topo, evitando cobrar dados antes de o jogador decidir se
    // quer entrar ou criar uma conta.
    if (!this.modo) return;
    const modo = this.modo;
    const codigoIndicacao = codigoIndicacaoPendente();

    const email = h('input.login-campo', {
      type: 'email', placeholder: 'seu@email.com', autocomplete: 'email',
    }) as HTMLInputElement;
    const senha = h('input.login-campo', {
      type: 'password', placeholder: 'senha',
      // `new-password` no cadastro faz o gerenciador de senhas OFERECER uma
      // senha forte em vez de tentar preencher uma que não existe.
      autocomplete: modo === 'criar' ? 'new-password' : 'current-password',
    }) as HTMLInputElement;

    const enviar = async (): Promise<void> => {
      if (this.ocupado) return;
      const e = email.value.trim();
      const s = senha.value;
      if (!e || !s) {
        this.recado = 'Preencha e-mail e senha.';
        return this.render(pronto);
      }

      // Trava enquanto espera. Sem ela, dois cliques viram duas contas —
      // ou duas tentativas contra o limite de taxa do servidor.
      this.ocupado = true;
      this.recado = this.modo === 'criar' ? 'Criando conta…' : 'Entrando…';
      this.render(pronto);

      const r = modo === 'criar' ? await cadastrar(e, s) : await entrar(e, s);
      this.ocupado = false;
      if (r.ok) return pronto(r.sessao);

      this.recado = r.erro;
      this.render(pronto);
    };

    /**
     * Entrar com um provedor, em janela própria.
     *
     * `window.open` precisa nascer do clique, então ele acontece ANTES do
     * `render`: redesenhar primeiro empurraria a abertura para outro passo do
     * laço de eventos, e aí o navegador a trataria como pop-up não pedido.
     *
     * O recado depois do `await` cobre o caso de fechar a janela no meio —
     * sem ele a tela ficaria em "Abrindo Google…" para sempre, o que é pior
     * que um erro porque não diz o que fazer.
     */
    const comProvedor = async (provedor: Provedor): Promise<void> => {
      const promessa = entrarComProvedor(provedor);

      /**
       * Já esperando: o clique só serve para trazer a janela de volta, e o
       * `entrarComProvedor` acima já fez isso ao reusar o nome. Sair aqui
       * evita dois `await` na mesma promessa entrarem no jogo duas vezes.
       */
      if (this.esperandoProvedor) return;

      /**
       * `ocupado` NÃO entra aqui, e isso é a metade visível do conserto.
       *
       * Sob COOP não há como saber que o jogador fechou a janela no X. Se o
       * botão travasse durante a espera, fechar a janela deixaria a tela presa
       * em "aguardando" até o teto de cinco minutos, sem nada a fazer. Clicar
       * de novo é a saída, então o clique tem de ser aceito.
       */
      this.esperandoProvedor = true;
      this.recado = `Aguardando ${NOME_DO_PROVEDOR[provedor]}… Se a janela fechou, clique de novo.`;
      this.render(pronto);

      const r = await promessa;
      this.esperandoProvedor = false;
      if (r.ok) return pronto(r.sessao);

      this.recado = r.erro;
      this.render(pronto);
    };

    const aoTeclar = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter') void enviar();
    };
    email.addEventListener('keydown', aoTeclar);
    senha.addEventListener('keydown', aoTeclar);

    const caixa = h('.login-caixa', {},
        h('button.login-fechar', {
          type: 'button', text: '×', title: 'Fechar', 'aria-label': 'Fechar',
          disabled: this.ocupado || this.esperandoProvedor,
          onclick: () => {
            this.modo = null;
            this.recado = '';
            this.render(pronto);
          },
        }),
        h('span.login-etiqueta', { text: 'CONTA DE PILOTO' }),
        h('h1.login-titulo', { text: modo === 'criar' ? 'Criar conta' : 'Entrar' }),
        h('p.login-sub', {
          text: modo === 'criar'
            ? 'Uma conta guarda seu progresso e o leva para outros aparelhos.'
            : 'Entre para sincronizar seu progresso.',
        }),

        ...(codigoIndicacao ? [
          h('.login-indicacao', {},
            h('span', { text: 'CONVITE RECEBIDO' }),
            h('strong', { text: codigoIndicacao }),
            h('p', { text: modo === 'criar'
              ? 'Ao criar a conta, ela ficará vinculada a quem enviou este convite.'
              : 'O convite só será aplicado se o provedor criar uma conta nova. Contas existentes não mudam de vínculo.' }),
            h('button', {
              type: 'button', text: 'Remover convite',
              onclick: () => { limparCodigoIndicacaoPendente(); this.render(pronto); },
            }),
          ),
        ] : []),

        email, senha,

        h('button.login-enviar', {
          text: this.ocupado ? '…' : (modo === 'criar' ? 'Criar conta' : 'Entrar'),
          disabled: this.ocupado,
          onclick: () => { void enviar(); },
        }),

        // O recado é `textContent`, nunca HTML. Parte dele vem do servidor, e
        // texto de fora que vira marcação é exatamente o buraco que o projeto
        // acabou de fechar removendo o sink do `h()`.
        h(`p.login-recado${this.recado ? '' : '.hidden'}`, { text: this.recado }),

        // Conta criada pelo Google não possui uma senha do jogo. O mesmo
        // provedor precisa, portanto, aparecer também em Entrar: ele é a chave
        // permanente dessa conta, não apenas um atalho usado no cadastro.
        h('.login-ou', {}, h('span', { text: 'ou' })),
        h('.login-provedores', {},
          ...(Object.keys(NOME_DO_PROVEDOR) as Provedor[]).map((p) =>
            h(`button.login-provedor.p-${p}`, {
              text: `${modo === 'criar' ? 'Criar conta' : 'Entrar'} com ${NOME_DO_PROVEDOR[p]}`,
              disabled: this.ocupado,
              onclick: () => { void comProvedor(p); },
            })),
        ),
        h('button.login-pular', {
          type: 'button',
          text: modo === 'criar' ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar conta',
          disabled: this.ocupado || this.esperandoProvedor,
          onclick: () => abrir(modo === 'criar' ? 'entrar' : 'criar'),
        }),
        h('p.login-nota.tiny.muted', {
          // A frase anterior avisava o que se perdia jogando sem e-mail. Não
          // existe mais esse caminho: a conta é a única porta, e o que a nota
          // faz agora é dizer POR QUE ela é obrigatória — sem isso ela lê como
          // burocracia, e o jogador desiste na primeira tela.
          text: 'A conta guarda seu progresso no servidor e o devolve em qualquer '
            + 'navegador ou computador. Sem ela, limpar os dados do site apagaria tudo.',
        }),
      );
    caixa.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape' || this.ocupado || this.esperandoProvedor) return;
      this.modo = null;
      this.recado = '';
      this.render(pronto);
    });
    this.root.append(
      h('section.login-modal-camada', { role: 'dialog', 'aria-modal': 'true', 'aria-label': modo === 'criar' ? 'Criar conta' : 'Entrar' }, caixa),
    );
    queueMicrotask(() => email.focus());
  }
}
