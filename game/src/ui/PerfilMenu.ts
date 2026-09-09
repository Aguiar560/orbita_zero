import { sair, sessaoGuardada } from '@app/conta';
import { ehAdmin } from '@app/admin';
import { apelidoAtual, buscarMeuApelido, buscarOnline, onlineAtual } from '@app/placar';
import { duration, fmt } from '@core/format';
import { HULL_BY_ID } from '@data/hulls';
import type { Sim } from '@sim/index';
import { clear, h } from './dom';

/**
 * O menu de perfil, no canto superior esquerdo.
 *
 * ## O que ele mostra, e por que essas coisas
 *
 * Um menu de conta que só oferece "sair" não vale o clique. O que o jogador
 * precisa saber olhando aqui é: **quem eu sou no jogo, onde estou na campanha
 * e se meu progresso está sincronizado.** Dados da conta não pertencem a uma
 * superfície que pode aparecer em uma transmissão ou captura de tela.
 */
export class PerfilMenu {
  readonly root = h('.perfil');
  private aberto = false;
  private carregandoApelido = false;

  constructor(private readonly sim: Sim) {
    // Clicar fora fecha. Sem isto o menu fica aberto atrás dos painéis, e o
    // jogador descobre que ele existe ao esbarrar nele mais tarde.
    document.addEventListener('pointerdown', (e) => {
      if (this.aberto && !this.root.contains(e.target as Node)) this.fechar();
    });

    /**
     * A conta muda DEPOIS que esta barra já existe, sempre.
     *
     * A ordem do boot não deixa alternativa: a barra é montada, e só então a
     * tela de login aparece por cima dela. Quando o jogador entra, este menu já
     * leu `sessaoGuardada()` uma vez — e leu `null`.
     *
     * Sem escutar o aviso, entrar pelo Google guardava a sessão, abria o jogo e
     * deixava "Sem conta" escrito no topo até a próxima recarga. O jogador que
     * acabou de fazer login lendo "Sem conta" tem todo o direito de achar que
     * não funcionou.
     *
     * `guardar` e `sair` disparam o aviso; o listener não é removido porque
     * este menu vive enquanto a página viver.
     */

    /**
     * O selo de quem está online, só para quem administra.
     *
     * Um relógio próprio, e não um pedido a cada `render`: a barra é
     * redesenhada a cada abertura do menu e a cada troca de conta, e amarrar a
     * requisição ao desenho faria o número virar tráfego. O `buscarOnline`
     * ainda tem a própria trava de um minuto — este intervalo é o do relógio,
     * aquele é a garantia.
     *
     * Roda para todo mundo? Não: `ehAdmin` é conferido antes de perguntar.
     * Jogador comum não gasta requisição com um número que não vai ver.
     */
    const olharOnline = (): void => {
      if (!ehAdmin()) return;
      void buscarOnline().then((n) => { if (n !== null) this.render(); });
    };
    olharOnline();
    setInterval(olharOnline, 60_000);

    // O `olharOnline` entra aqui tambem, e nao so no relogio: entrar numa
    // conta de admin com a barra ja montada esperaria o minuto inteiro para o
    // selo aparecer, e um minuto olhando para uma barra sem numero e
    // indistinguivel de um numero que nao funciona.
    window.addEventListener('oz:conta', () => { this.render(); this.carregarApelido(); olharOnline(); });
    window.addEventListener('oz:apelido', () => this.render());

    this.render();
    this.carregarApelido();
  }

  private carregarApelido(): void {
    if (!sessaoGuardada() || this.carregandoApelido) return;
    this.carregandoApelido = true;
    void buscarMeuApelido().finally(() => {
      this.carregandoApelido = false;
      this.render();
    });
  }

  private fechar(): void {
    this.aberto = false;
    this.render();
  }

  private render(): void {
    const sessao = sessaoGuardada();
    const nome = sessao ? apelidoAtual() ?? 'Piloto' : 'Sem conta';

    clear(this.root).append(
      h('button.perfil-botao', {
        'aria-label': sessao ? `Abrir perfil de ${nome}` : 'Abrir opções da conta',
        'aria-expanded': String(this.aberto),
        onclick: () => { this.aberto = !this.aberto; this.render(); },
      },
        // Só o nome, sem moldura e sem avatar.
        //
        // A primeira versão era uma pílula com inicial num círculo, e ela pesava
        // como um botão de ação — na barra de cima, peso é o que separa o que se
        // usa o tempo todo do que se abre de vez em quando. Conta é a segunda
        // coisa.
        h(`span.perfil-nome${sessao ? '' : '.sem-conta'}`, { text: nome }),
        /**
         * Quantos estão online. Só admin vê, por enquanto.
         *
         * É um portão de INTERFACE, como o do modo de teste: a lista de admins
         * vai no pacote e a conferência roda no navegador. O que ele promete é
         * tirar do caminho do jogador comum um número que é de operação, não
         * de jogo — e não esconder um segredo, porque não há segredo num
         * agregado sem identidade nenhuma.
         *
         * Sai da tela enquanto a resposta não chega: mostrar zero seria dizer
         * "não tem ninguém", que é diferente de "ainda não sei".
         */
        ...(ehAdmin() && onlineAtual() !== null
          ? [h('span.perfil-online', {
              text: `${onlineAtual()} on`,
            })]
          : []),
        h('span.perfil-seta', { text: this.aberto ? '▴' : '▾' }),
      ),
      ...(this.aberto ? [this.gaveta(sessao)] : []),
    );
  }

  private gaveta(sessao: ReturnType<typeof sessaoGuardada>): HTMLElement {
    const st = this.sim.state;
    const nave = HULL_BY_ID.get(st.hull);

    const linha = (rotulo: string, valor: string, classe = ''): HTMLElement =>
      h(`.perfil-linha${classe}`, {},
        h('span.perfil-rot', { text: rotulo }),
        h('span.perfil-val', { text: valor }),
      );

    if (!sessao) {
      return h('.perfil-gaveta', {},
        h('.perfil-secao', { text: 'CONTA' }),
        h('p.perfil-aviso', {
          text: 'Seu progresso está só neste navegador. Limpar os dados do site apaga tudo.',
        }),
        h('button.perfil-acao.destaque', {
          text: 'Entrar ou criar conta',
          // Recarregar é o caminho honesto: a tela de login roda ANTES do laço,
          // porque um save da nuvem troca o estado inteiro. Abri-la por cima de
          // um jogo em andamento exigiria desmontar e remontar tudo — muito
          // risco para poupar dois segundos de recarga.
          onclick: () => location.reload(),
        }),
        ...this.progresso(st),
      );
    }

    return h('.perfil-gaveta', {},
      h('.perfil-identidade', {},
        h('span.perfil-identidade-rot', { text: 'PILOTO' }),
        h('strong', { text: apelidoAtual() ?? 'Piloto' }),
        h('span.perfil-privacidade', { text: 'DADOS PRIVADOS OCULTOS' }),
      ),
      linha('Nave ativa', nave?.name ?? '—'),

      ...this.progresso(st),

      h('button.perfil-acao', {
        text: 'Sair',
        onclick: () => { sair(); location.reload(); },
      }),
    );
  }

  /** O que o jogador reconhece como "meu progresso". */
  private progresso(st: Sim['state']): HTMLElement[] {
    return [
      h('.perfil-secao', { text: 'PROGRESSO' }),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Setor atual' }),
        h('span.perfil-val', { text: fmt(st.run.sector) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Melhor setor' }),
        h('span.perfil-val', { text: fmt(st.universe.bestSectorEver) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Patente' }),
        h('span.perfil-val', { text: fmt(st.command.nivel) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Frota' }),
        h('span.perfil-val', { text: `${st.fleet.length} naves` }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Carga' }),
        h('span.perfil-val', { text: `${st.inventory.length} itens` }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Tempo de jogo' }),
        h('span.perfil-val', { text: duration(st.playtime) }),
      ),
    ];
  }

  /** Repinta quando o estado muda, para os números não envelhecerem abertos. */
  atualizar(): void {
    if (this.aberto) this.render();
  }
}
