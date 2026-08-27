import { cadastrar, entrar, sair, sessaoGuardada, tokenValido, type Sessao } from '@app/conta';
import { clear, h } from './dom';

/**
 * A porta de entrada: entrar ou criar conta.
 *
 * ## Por que dá para pular
 *
 * O jogo funciona inteiro sem conta — o save mora no navegador desde sempre. A
 * conta acrescenta sincronizar entre dispositivos e sobreviver a limpar o
 * navegador, e nada disso é pré-requisito para jogar.
 *
 * Obrigar a criar conta na primeira tela cobra um e-mail antes de a pessoa saber
 * se gosta do jogo. Quem pulou pode entrar depois, e o save local sobe junto.
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
  private recado = '';

  /**
   * Mostra a tela e resolve com a sessão, ou `null` se o jogador pulou.
   *
   * Uma sessão guardada e ainda válida dispensa a tela: `tokenValido` renova
   * sozinho quando falta pouco, então quem já entrou não vê isto de novo.
   */
  async mostrar(host: HTMLElement): Promise<Sessao | null> {
    const guardada = sessaoGuardada();
    if (guardada && (await tokenValido())) return sessaoGuardada();
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

  private render(pronto: (s: Sessao | null) => void): void {
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

        h('button.login-pular', {
          text: 'Jogar sem conta',
          disabled: this.ocupado,
          onclick: () => pronto(null),
        }),
        h('p.login-nota.tiny.muted', {
          text: 'Sem conta o progresso fica só neste navegador. Dá para entrar depois.',
        }),
      ),
    );
  }
}
