import {
  NOME_DO_PROVEDOR, cadastrar, entrar, entrarComProvedor, recolherSessaoDaUrl,
  sair, sessaoGuardada, tokenValido, type Provedor, type Sessao,
} from '@app/conta';
import { clear, h } from './dom';

/**
 * A porta de entrada: entrar ou criar conta.
 *
 * ## Por que dá para entrar sem cadastro — e por que não é mais "sem conta"
 *
 * Obrigar a criar conta na primeira tela cobra um e-mail antes de a pessoa saber
 * se gosta do jogo. Esse motivo continua de pé, e o botão continua ali.
 *
 * O que mudou é o que ele faz. Ele devolvia `null`: o jogo rodava só com o save
 * do navegador, sem dono do outro lado. Isso deixa de funcionar quando recurso,
 * item e nave passam a morar no servidor — estado precisa de dono. Agora ele
 * cria uma **conta anônima** de verdade, com id no servidor e nada pedido ao
 * jogador.
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
 * Entrar sem sessão virou, então, jogar um jogo que não é o jogo. A tela
 * insiste em vez de deixar passar: falhou, mostra o motivo e oferece tentar de
 * novo. É pior para quem tem azar de rede no boot, e é a única saída que não
 * entrega calado um jogo sem item.
 *
 * ## Por que uma tela e não um painel
 *
 * Ela roda ANTES do laço, junto da escolha de piloto, pelo mesmo motivo: se o
 * save da nuvem for mais recente, ele troca o estado inteiro, e um quadro que
 * seja do estado errado é uma piscada errada na primeira tela que se vê.
 */
export class Login {
  private readonly root = h('.login-tela');
  private modo: 'entrar' | 'criar' = 'entrar';
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
    if (guardada && (await tokenValido())) return sessaoGuardada()!;
    // Sessão que existia mas não renova é sessão morta: limpar aqui evita a
    // tela abrir já com um estado de "logado" que o servidor não reconhece.
    if (guardada) sair();

    return new Promise((resolve) => {
      this.render((sessao) => {
        this.root.remove();
        resolve(sessao);
      });
      host.append(this.root);
    });
  }

  private render(pronto: (s: Sessao) => void): void {
    const email = h('input.login-campo', {
      type: 'email', placeholder: 'seu@email.com', autocomplete: 'email',
    }) as HTMLInputElement;
    const senha = h('input.login-campo', {
      type: 'password', placeholder: 'senha',
      // `new-password` no cadastro faz o gerenciador de senhas OFERECER uma
      // senha forte em vez de tentar preencher uma que não existe.
      autocomplete: this.modo === 'criar' ? 'new-password' : 'current-password',
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

      const r = this.modo === 'criar' ? await cadastrar(e, s) : await entrar(e, s);
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

    clear(this.root).append(
      h('.login-fundo'),
      h('.login-caixa', {},
        // Sem título aqui: a arte de capa JÁ traz o logo, e escrever
        // "ÓRBITA ZERO" de novo logo abaixo dele seria a mesma informação
        // duas vezes, com a segunda em tipografia pior que a primeira.
        h('p.login-sub', {
          text: this.modo === 'criar'
            ? 'Uma conta guarda seu progresso e o leva para outros aparelhos.'
            : 'Entre para sincronizar seu progresso.',
        }),

        h('.login-abas', {},
          ...(['entrar', 'criar'] as const).map((m) => h(
            `button.login-aba${this.modo === m ? '.ativa' : ''}`,
            {
              text: m === 'entrar' ? 'Entrar' : 'Criar conta',
              disabled: this.ocupado,
              onclick: () => { this.modo = m; this.recado = ''; this.render(pronto); },
            },
          )),
        ),

        email, senha,

        h('button.login-enviar', {
          text: this.ocupado ? '…' : (this.modo === 'criar' ? 'Criar conta' : 'Entrar'),
          disabled: this.ocupado,
          onclick: () => { void enviar(); },
        }),

        // O recado é `textContent`, nunca HTML. Parte dele vem do servidor, e
        // texto de fora que vira marcação é exatamente o buraco que o projeto
        // acabou de fechar removendo o sink do `h()`.
        h(`p.login-recado${this.recado ? '' : '.hidden'}`, { text: this.recado }),

        // Os provedores vêm DEPOIS do formulário, não antes. Quem já tem
        // conta no jogo chega aqui para digitar e-mail e senha; pôr Google no
        // topo faria a ação mais comum ser a de baixo.
        h('.login-ou', {}, h('span', { text: 'ou' })),
        h('.login-provedores', {},
          ...(Object.keys(NOME_DO_PROVEDOR) as Provedor[]).map((p) =>
            h(`button.login-provedor.p-${p}`, {
              text: `Continuar com ${NOME_DO_PROVEDOR[p]}`,
              disabled: this.ocupado,
              onclick: () => { void comProvedor(p); },
            })),
        ),
        h('p.login-nota.tiny.muted', {
          // A frase anterior avisava o que se perdia jogando sem e-mail. Não
          // existe mais esse caminho: a conta é a única porta, e o que a nota
          // faz agora é dizer POR QUE ela é obrigatória — sem isso ela lê como
          // burocracia, e o jogador desiste na primeira tela.
          text: 'A conta guarda seu progresso no servidor e o devolve em qualquer '
            + 'navegador ou computador. Sem ela, limpar os dados do site apagaria tudo.',
        }),
      ),
    );
  }
}
