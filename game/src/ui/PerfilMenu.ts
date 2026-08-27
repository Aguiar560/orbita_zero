import { sair, sessaoGuardada } from '@app/conta';
import { fmt } from '@core/format';
import type { Sim } from '@sim/index';
import { clear, h } from './dom';

/**
 * O menu de perfil, no canto superior esquerdo.
 *
 * ## O que ele mostra, e por que essas coisas
 *
 * Um menu de conta que só oferece "sair" não vale o clique. O que o jogador
 * precisa saber olhando aqui é: **quem eu sou, onde meu progresso está guardado,
 * e o que acontece se eu fechar isto agora.**
 *
 * A terceira pergunta é a que costuma faltar, e é a que mais importa num jogo
 * cujo save morava só no navegador até ontem. Quem está sem conta merece ver
 * isso dito — não escondido atrás de um estado de "tudo certo" que não é
 * verdade.
 */
export class PerfilMenu {
  readonly root = h('.perfil');
  private aberto = false;

  constructor(private readonly sim: Sim) {
    // Clicar fora fecha. Sem isto o menu fica aberto atrás dos painéis, e o
    // jogador descobre que ele existe ao esbarrar nele mais tarde.
    document.addEventListener('pointerdown', (e) => {
      if (this.aberto && !this.root.contains(e.target as Node)) this.fechar();
    });
    this.render();
  }

  private fechar(): void {
    this.aberto = false;
    this.render();
  }

  private render(): void {
    const sessao = sessaoGuardada();
    const nome = sessao ? sessao.email.split('@')[0] ?? 'piloto' : 'Sem conta';

    clear(this.root).append(
      h('button.perfil-botao', {
        title: sessao ? sessao.email : 'Jogando sem conta',
        'aria-expanded': String(this.aberto),
        onclick: () => { this.aberto = !this.aberto; this.render(); },
      },
        // Inicial em vez de avatar: não há foto nenhuma para mostrar, e um
        // ícone genérico de pessoa diria menos que a primeira letra do e-mail.
        h(`span.perfil-inicial${sessao ? '' : '.sem-conta'}`, {
          text: sessao ? (nome[0] ?? '?').toUpperCase() : '·',
        }),
        h('span.perfil-nome', { text: nome }),
        h('span.perfil-seta', { text: this.aberto ? '▴' : '▾' }),
      ),
      ...(this.aberto ? [this.gaveta(sessao)] : []),
    );
  }

  private gaveta(sessao: ReturnType<typeof sessaoGuardada>): HTMLElement {
    const st = this.sim.state;

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

    const restam = sessao.expiraEm - Math.floor(Date.now() / 1000);
    return h('.perfil-gaveta', {},
      h('.perfil-secao', { text: 'CONTA' }),
      linha('E-mail', sessao.email),
      // O id inteiro é um UUID e não cabe. Os oito primeiros bastam para
      // conferir com o painel do Supabase, que é o único uso real disto.
      linha('Id', `${sessao.usuarioId.slice(0, 8)}…`),
      linha(
        'Sessão',
        restam > 0 ? `renova em ${Math.max(1, Math.round(restam / 60))} min` : 'renovando…',
      ),

      ...this.progresso(st),

      h('.perfil-secao', { text: 'SINCRONIZAÇÃO' }),
      // Dito com todas as letras enquanto for verdade. O servidor já aceita o
      // save, mas o jogo ainda não o envia — e deixar isso implícito faria o
      // jogador confiar num backup que não existe.
      h('p.perfil-aviso', {
        text: 'Ainda não implementada. O progresso continua só neste navegador.',
      }),

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
        h('span.perfil-rot', { text: 'Tempo de jogo' }),
        h('span.perfil-val', { text: `${Math.round(st.playtime / 60)} min` }),
      ),
    ];
  }

  /** Repinta quando o estado muda, para os números não envelhecerem abertos. */
  atualizar(): void {
    if (this.aberto) this.render();
  }
}
