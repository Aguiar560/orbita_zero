import { fmt } from '@core/format';
import { PLACARES, marcaDoJogador, navesClassificaveis, type PlacarId } from '@sim/ranking';
import {
  dataDeBrasilia, horaDeBrasilia, segundosAteVirar, temporadaComecou, temporadaEm,
} from '@data/temporadas';
import { pilotoDe } from '@data/pilotos';
import { DEMO_ATIVA, placarDeDemonstracao } from '@sim/ranking-demo';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * Ranking — placares SAZONAIS e MUNDIAIS.
 *
 * Cinco seções, uma por eixo de progresso: Provação, Galáxia, Personagem, Naves
 * (com filtro por casco) e Missões. O relógio é o do servidor, em horário de
 * Brasília, porque uma temporada que virasse no fuso de cada um teria fim
 * diferente para cada jogador — e o último dia é justamente quando o placar
 * decide.
 *
 * ## A tela diz que a lista está vazia, e isso é deliberado
 *
 * Placar mundial precisa de back-end, e ele ainda não existe: o jogo não tem
 * conta, não tem save em nuvem e não tem para onde enviar marca nenhuma.
 *
 * Havia duas saídas ruins. Esconder a tela até o servidor existir — e aí o
 * jogador não saberia que o esforço dele será pontuado, que é exatamente o que
 * faz valer a pena subir um andar a mais. Ou preencher a lista com nomes
 * inventados — e aí ele decidiria o que jogar comparando-se com gente que não
 * existe, e descobriria a mentira no dia em que o placar de verdade chegasse.
 *
 * A terceira é esta: a estrutura inteira de pé, a marca REAL dele em cada
 * eixo, e uma linha dizendo o que falta. Quando o servidor entrar, a lista
 * enche e nada mais muda.
 */
export class RankingPanel implements Panel {
  id = 'ranking';
  title = 'Ranking';
  icon = 'geral/b_4';
  overlay = true;

  /** Seção visível. Mora na instância: é onde o jogador estava, não preferência. */
  private secao: PlacarId = 'provacao';
  /** Casco escolhido no filtro do placar de naves; vazio = a melhor. */
  private casco = '';

  render(sim: Sim): HTMLElement {
    const agora = Date.now();
    const temp = temporadaEm(agora);

    return h('.panel-body.ranking', {},
      this.cabecalho(agora, temp),
      h('nav.ranking-abas', { role: 'tablist', 'aria-label': 'Placares' },
        ...PLACARES.map((p) => h(`button.ranking-aba${p.id === this.secao ? '.ativa' : ''}`, {
          role: 'tab',
          'aria-selected': String(p.id === this.secao),
          onclick: () => { this.secao = p.id; sim.touch(); },
          text: p.nome,
        })),
      ),
      this.corpo(sim),
    );
  }

  // ── cabeçalho: a temporada e o relógio ────────────────────────────────────

  private cabecalho(agora: number, temp: ReturnType<typeof temporadaEm>): HTMLElement {
    const restam = segundosAteVirar(agora);
    const dias = Math.floor(restam / 86400);
    const horas = Math.floor((restam % 86400) / 3600);
    const min = Math.floor((restam % 3600) / 60);
    const comecou = temporadaComecou(agora);

    return h('.ranking-topo', {},
      h('.ranking-temporada', {},
        h('span.ranking-selo', { text: 'MUNDIAL' }),
        h('strong', { text: comecou ? `Temporada ${temp.numero}` : 'Pré-temporada' }),
        h('span.muted.tiny', {
          text: comecou
            ? `${dataDeBrasilia(temp.inicio)} → ${dataDeBrasilia(temp.fim - 1)}`
            : `A primeira temporada começa em ${dataDeBrasilia(temp.inicio)}`,
        }),
      ),
      h('.ranking-relogio', {},
        h('span.muted.tiny', { text: comecou ? 'Vira em' : 'Começa em' }),
        // Sem segundos de propósito: o painel é reconstruído a ~5 Hz, e um
        // contador de segundos piscaria a cada quadro sem dizer nada de útil
        // num prazo de semanas.
        h('strong.ranking-conta', { text: dias > 0 ? `${dias}d ${horas}h` : `${horas}h ${min}min` }),
        h('span.muted.tiny', { text: `${horaDeBrasilia(agora)} · Brasília` }),
      ),
    );
  }

  // ── corpo: a seção escolhida ──────────────────────────────────────────────

  private corpo(sim: Sim): HTMLElement {
    const placar = PLACARES.find((p) => p.id === this.secao)!;
    const naves = this.secao === 'naves' ? navesClassificaveis(sim.state) : [];
    const casco = this.secao === 'naves' ? (this.casco || naves[0]?.id) : undefined;
    const marca = marcaDoJogador(sim.state, this.secao, casco);
    const piloto = sim.state.piloto ? pilotoDe(sim.state.piloto) : null;

    return h('.ranking-corpo', { role: 'tabpanel' },
      h('p.muted.hint.ranking-criterio', { text: placar.criterio }),

      ...(this.secao === 'naves' && naves.length ? [this.filtroDeNaves(sim, naves, casco)] : []),

      // A marca do jogador é REAL e vem primeiro. Ela é a única coisa que esta
      // tela sabe hoje, e é o que dá sentido a abri-la antes do servidor.
      h('.ranking-sua-marca', {},
        h('.ranking-marca-info', {},
          h('span.muted.tiny', { text: 'SUA MARCA' }),
          h('strong.ranking-valor', { text: marca.valor > 0 ? fmt(marca.valor) : '—' }),
          h('span.muted.tiny', { text: marca.detalhe ? `${placar.unidade} · ${marca.detalhe}` : placar.unidade }),
        ),
        h('.ranking-marca-quem', {},
          ...(piloto
            ? [
                h('strong', { text: piloto.nome, style: { color: piloto.cor } as Partial<CSSStyleDeclaration> }),
                h('span.muted.tiny', { text: `${piloto.raca} · nível ${sim.state.command.nivel}` }),
              ]
            : [h('span.muted.tiny', { text: 'Nenhum personagem escolhido' })]),
        ),
      ),

      DEMO_ATIVA ? this.listaDemo(sim, placar.nome, casco) : this.listaPendente(placar.nome),
    );
  }

  private filtroDeNaves(
    sim: Sim,
    naves: ReturnType<typeof navesClassificaveis>,
    ativo: string | undefined,
  ): HTMLElement {
    return h('.ranking-filtro', {},
      h('span.muted.tiny', { text: 'PLACAR DE' }),
      h('select.select', {
        'aria-label': 'Nave do placar',
        onchange: (e: Event) => { this.casco = (e.target as HTMLSelectElement).value; sim.touch(); },
      }, ...naves.map((n) => {
        const o = h('option', { value: n.id, text: `${n.nome} · nível ${n.nivel}` }) as HTMLOptionElement;
        if (n.id === ativo) o.selected = true;
        return o;
      })),
      h('span.muted.tiny', { text: `${naves.length} na frota` }),
    );
  }

  /**
   * A lista com jogadores FICTÍCIOS, para avaliar o layout.
   *
   * Andaime, e a tela diz isso num selo que não dá para não ver — o risco de
   * dado falso num placar é o jogador se comparar com gente que não existe.
   * `DEMO_ATIVA` desliga tudo numa linha.
   *
   * Mostra o topo E a linha do jogador na posição real dele, separadas por uma
   * quebra. Só o topo esconderia justamente o que precisa ser julgado: como a
   * própria linha se destaca quando não está entre os primeiros.
   */
  private listaDemo(sim: Sim, nome: string, casco: string | undefined): HTMLElement {
    const { topo, eu, total } = placarDeDemonstracao(sim.state, this.secao, casco, Date.now());
    const foraDoTopo = eu.posicao > topo.length;

    return h('.ranking-lista', {},
      h('.ranking-cabecalho', {},
        h('span.tiny', { text: '#' }),
        h('span.tiny', { text: 'PILOTO' }),
        h('span.tiny', { text: nome.toUpperCase() }),
      ),
      h('.ranking-linhas', {}, ...topo.map((l) => this.linha(l))),
      // A linha do jogador fica FORA da rolagem. Ela é a que ele abriu a tela
      // para ver, e dentro do container ela nasce abaixo da dobra — medido, com
      // doze linhas de topo era preciso rolar para se encontrar. É também como
      // todo placar de verdade se comporta.
      ...(foraDoTopo
        ? [h('.ranking-eu', {},
            h('.ranking-quebra', {}, h('span.tiny', { text: `${total - topo.length} pilotos entre você e o topo` })),
            this.linha(eu),
          )]
        : []),
      h('.ranking-demo-aviso', {},
        h('span.ranking-demo-selo', { text: 'DEMONSTRAÇÃO' }),
        h('span.tiny', {
          text: 'Estes pilotos não existem. A lista é gerada no seu navegador para dar forma à tela enquanto o placar mundial não tem servidor — '
            + 'a SUA marca, acima, é a única coisa real aqui.',
        }),
      ),
    );
  }

  private linha(l: ReturnType<typeof placarDeDemonstracao>['topo'][number]): HTMLElement {
    return h(`.ranking-linha${l.euMesmo ? '.eu' : ''}`, {},
      h('span.ranking-pos', { text: `${l.posicao}` }),
      h('.ranking-nome', {},
        h('strong', { text: l.nome, style: { color: l.cor } as Partial<CSSStyleDeclaration> }),
        ...(l.detalhe ? [h('span.muted.tiny', { text: l.detalhe })] : []),
      ),
      h('strong.ranking-pontos', { text: l.valor > 0 ? fmt(l.valor) : '—' }),
    );
  }

  /**
   * O lugar da lista, e o que falta para ela existir.
   *
   * Desenhado como uma lista de verdade — cabeçalho de colunas e tudo — para o
   * jogador ver o formato do que vem. Um retângulo vazio com um texto no meio
   * pareceria erro; isto parece o que é: um placar esperando os outros.
   */
  private listaPendente(nome: string): HTMLElement {
    return h('.ranking-lista', {},
      h('.ranking-cabecalho', {},
        h('span.tiny', { text: '#' }),
        h('span.tiny', { text: 'PILOTO' }),
        h('span.tiny', { text: nome.toUpperCase() }),
      ),
      h('.ranking-vazio', {},
        spriteIcon('geral/b_4', 26, 'ranking-vazio-icone'),
        h('strong', { text: 'O placar mundial ainda não está no ar.' }),
        h('span.tiny', {
          text: 'Ele precisa de conta e save em nuvem, que ainda não existem — sem isso não há para onde enviar a sua marca nem de onde trazer a dos outros. '
            + 'A sua marca acima é real e continua sendo registrada; nada do que você conquistar agora se perde.',
        }),
        h('span.tiny.ranking-vazio-nota', {
          text: 'A temporada e o horário de Brasília já são os definitivos: quando o servidor entrar, ele e o jogo vão concordar sobre qual temporada está correndo.',
        }),
      ),
    );
  }
}
