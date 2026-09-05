import { sair, sessaoGuardada } from '@app/conta';
import { nuvem } from '@app/nuvem';
import { toast } from '@app/Bus';
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
    window.addEventListener('oz:conta', () => { this.render(); });

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
        // Só o nome, sem moldura e sem avatar.
        //
        // A primeira versão era uma pílula com inicial num círculo, e ela pesava
        // como um botão de ação — na barra de cima, peso é o que separa o que se
        // usa o tempo todo do que se abre de vez em quando. Conta é a segunda
        // coisa.
        h(`span.perfil-nome${sessao ? '' : '.sem-conta'}`, { text: nome }),
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
      // Truncado para caber, mas COPIÁVEL inteiro no clique: o id é o que
      // entra na lista de `ADMINS`, e ler um UUID da tela para digitar à mão é
      // um erro de digitação esperando acontecer.
      h('.perfil-linha.perfil-id', {
        title: `${sessao.usuarioId} — clique para copiar`,
        onclick: () => {
          void navigator.clipboard?.writeText(sessao.usuarioId).then(
            () => toast('Id copiado.', 'good'),
            () => toast('Não deu para copiar.', 'bad'),
          );
        },
      },
        h('span.perfil-rot', { text: 'Id' }),
        h('span.perfil-val', { text: `${sessao.usuarioId.slice(0, 8)}…` }),
      ),
      linha(
        'Sessão',
        restam > 0 ? `renova em ${Math.max(1, Math.round(restam / 60))} min` : 'renovando…',
      ),

      ...this.progresso(st),

      h('.perfil-secao', { text: 'SINCRONIZAÇÃO' }),
      // O que o jogador precisa saber é se o backup dele EXISTE, e de quando é.
      // "Ativa" sozinho não responde isso: uma sincronização ligada que falhou
      // nas últimas duas horas parece igual a uma que funciona.
      linha('Última subida', nuvem.ultimaSubida
        ? `há ${Math.max(1, Math.round((Date.now() / 1000 - nuvem.ultimaSubida) / 60))} min`
        : 'ainda nesta sessão'),
      ...(nuvem.ultimoErro ? [h('p.perfil-aviso', { text: `Última falha: ${nuvem.ultimoErro}` })] : []),
      h('p.perfil-nota', {
        text: 'O save sobe sozinho a cada poucos minutos e ao sair da aba. O progresso continua guardado neste navegador também.',
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
