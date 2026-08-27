import { fmt } from '@core/format';
import { PLACARES, marcaDoJogador, navesClassificaveis, type PlacarId } from '@sim/ranking';
import {
  dataDeBrasilia, horaDeBrasilia, segundosAteVirar, temporadaComecou, temporadaEm,
} from '@data/temporadas';
import { pilotoDe } from '@data/pilotos';
import { describeGalaxy } from '@data/galaxies';
import {
  apelidoValido, buscarPlacar, definirApelido,
  type EstadoDaBusca, type LinhaDoPlacar,
} from '@app/placar';
import { bus } from '@app/Bus';
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
  /** Galáxia trazida pelo mapa; nula deixa o placar de campanha amplo. */
  private galaxy: number | null = null;

  /**
   * O placar buscado, por seção.
   *
   * Em cache porque o painel se redesenha a cada `PANEL_HZ`: buscar a cada
   * desenho seriam dezenas de requisições por minuto, a cota da camada gratuita
   * acabaria numa tarde, e a lista piscaria a cada resposta fora de ordem.
   */
  private busca = new Map<string, EstadoDaBusca>();
  /** O que o jogador digitou no campo de apelido, entre um desenho e outro. */
  private apelidoDigitado = '';
  private erroDeApelido = '';

  /** Dispara a busca da seção, uma vez. */
  private garantirBusca(id: PlacarId): EstadoDaBusca {
    const atual = this.busca.get(id) ?? { fase: 'nunca' as const };
    if (atual.fase !== 'nunca') return atual;

    this.busca.set(id, { fase: 'buscando' });
    void buscarPlacar(id).then((r) => {
      this.busca.set(id, r);
      // O painel não sabe sozinho que a resposta chegou: ele desenha do cache.
      bus.emit('state:changed');
    });
    return { fase: 'buscando' };
  }

  abrirPlacarDaGalaxia(galaxy: number): void {
    this.secao = 'galaxia';
    this.galaxy = galaxy;
  }

  render(sim: Sim): HTMLElement {
    const agora = Date.now();
    const temp = temporadaEm(agora);

    return h('.panel-body.ranking', {},
      this.cabecalho(agora, temp),
      h('nav.ranking-abas', { role: 'tablist', 'aria-label': 'Placares' },
        ...PLACARES.map((p) => h(`button.ranking-aba${p.id === this.secao ? '.ativa' : ''}`, {
          role: 'tab',
          'aria-selected': String(p.id === this.secao),
          onclick: () => {
            this.secao = p.id;
            if (p.id !== 'galaxia') this.galaxy = null;
            sim.touch();
          },
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
    const galaxy = this.secao === 'galaxia' && this.galaxy !== null
      ? describeGalaxy(this.galaxy)
      : null;
    const naves = this.secao === 'naves' ? navesClassificaveis(sim.state) : [];
    const casco = this.secao === 'naves' ? (this.casco || naves[0]?.id) : undefined;
    const marca = marcaDoJogador(sim.state, this.secao, casco);
    const piloto = sim.state.piloto ? pilotoDe(sim.state.piloto) : null;

    return h('.ranking-corpo', { role: 'tabpanel' },
      h('p.muted.hint.ranking-criterio', { text: placar.criterio }),

      ...(galaxy
        ? [h('.ranking-galaxy-context', { style: { '--ranking-galaxy-color': galaxy.color } as Partial<CSSStyleDeclaration> },
            h('span', { text: 'PLACAR DA GALÁXIA' }),
            h('strong', { text: galaxy.name }),
            h('small', { text: `Setores ${galaxy.firstSector} – ${galaxy.lastSector}` }),
          )]
        : []),

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

      this.lista(sim, placar.nome),
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
   * A lista de verdade.
   *
   * Cinco estados, e cada um diz o que está acontecendo em vez de mostrar uma
   * lista vazia: sem conta, sem apelido, buscando, erro, ou o placar. A tela
   * anterior tinha um sexto — pilotos inventados no navegador — e ele saiu:
   * o jogador decidia o que jogar comparando-se com gente que não existe.
   */
  private lista(sim: Sim, nome: string): HTMLElement {
    const cabecalho = h('.ranking-cabecalho', {},
      h('span.tiny', { text: '#' }),
      h('span.tiny', { text: 'PILOTO' }),
      h('span.tiny', { text: nome.toUpperCase() }),
    );

    const estado = this.garantirBusca(this.secao);

    if (estado.fase === 'sem-conta') {
      return h('.ranking-lista', {}, cabecalho, this.aviso(
        'O placar precisa de conta.',
        'O jogo inteiro funciona sem uma — mas sem conta não há para onde enviar a sua marca nem de onde trazer a dos outros. '
        + 'A sua marca acima continua real e registrada; nada do que você conquistar agora se perde.',
      ));
    }

    if (estado.fase === 'buscando') {
      return h('.ranking-lista', {}, cabecalho,
        h('.ranking-vazio', {}, h('span.tiny.muted', { text: 'Buscando o placar…' })));
    }

    if (estado.fase === 'erro') {
      return h('.ranking-lista', {}, cabecalho, this.aviso(
        'Não deu para falar com o placar.',
        `${estado.motivo}. A sua marca continua guardada — quando a conexão voltar, ela sobe sozinha.`,
      ));
    }

    if (estado.fase !== 'pronto') {
      return h('.ranking-lista', {}, cabecalho,
        h('.ranking-vazio', {}, h('span.tiny.muted', { text: 'Buscando o placar…' })));
    }

    // Sem apelido não dá para aparecer: a lista mostra nomes, e o servidor
    // recusa marca de quem não tem um. Pedir aqui, e não numa tela de entrada,
    // é o que evita cobrar um nome de quem nunca vai abrir o placar.
    if (!estado.dados.meuApelido) return h('.ranking-lista', {}, cabecalho, this.pedirApelido(sim));

    const { linhas, minhaPosicao, total } = estado.dados;

    if (!linhas.length) {
      return h('.ranking-lista', {}, cabecalho, this.aviso(
        'Ninguém marcou ainda neste placar.',
        'Você pode ser o primeiro — a sua marca sobe sozinha nos próximos minutos.',
      ));
    }

    const estouNoTopo = linhas.some((l) => l.voce);

    return h('.ranking-lista', {}, cabecalho,
      h('.ranking-linhas', {}, ...linhas.map((l) => this.linha(l))),
      // A linha do jogador fica FORA da rolagem quando ele não está no topo.
      // Ela é a que ele abriu a tela para ver, e dentro do container nasce
      // abaixo da dobra.
      ...(!estouNoTopo && minhaPosicao
        ? [h('.ranking-eu', {},
            h('.ranking-quebra', {}, h('span.tiny', {
              text: `${Math.max(0, minhaPosicao - linhas.length - 1)} pilotos entre você e o topo`,
            })),
            this.linha({
              posicao: minhaPosicao, apelido: estado.dados.meuApelido,
              valor: 0, casco: '', voce: true,
            }, true),
          )]
        : []),
      h('span.tiny.muted.ranking-total', { text: `${fmt(total)} pilotos classificados` }),
    );
  }

  private aviso(titulo: string, corpo: string): HTMLElement {
    return h('.ranking-vazio', {},
      spriteIcon('geral/b_4', 26, 'ranking-vazio-icone'),
      h('strong', { text: titulo }),
      h('span.tiny', { text: corpo }),
    );
  }

  /**
   * O campo de apelido.
   *
   * O nome é público e único, então ele é reivindicado no servidor — e a
   * validação daqui é só para o jogador saber que não serve ENQUANTO digita.
   * Quem decide é o servidor; divergir para o lado permissivo é seguro, para o
   * outro seria recusar nome válido sem explicação.
   */
  private pedirApelido(sim: Sim): HTMLElement {
    const campo = h('input.ranking-apelido-campo', {
      type: 'text',
      maxlength: '16',
      placeholder: 'Seu nome no placar',
      'aria-label': 'Apelido no placar',
      value: this.apelidoDigitado,
      oninput: (e: Event) => { this.apelidoDigitado = (e.target as HTMLInputElement).value; },
    }) as HTMLInputElement;

    const enviar = async (): Promise<void> => {
      const r = await definirApelido(this.apelidoDigitado);
      if (r.ok) {
        this.erroDeApelido = '';
        // Força a busca de novo: agora há apelido, e a lista muda.
        this.busca.delete(this.secao);
        sim.touch();
        return;
      }
      this.erroDeApelido = {
        invalido: 'De 3 a 16 caracteres, começando e terminando com letra ou número.',
        em_uso: 'Esse nome já é de outro piloto. Tente outro.',
        sem_conta: 'Entre na sua conta para escolher um nome.',
        rede: 'Não deu para falar com o servidor. Tente de novo.',
      }[r.erro];
      sim.touch();
    };

    return h('.ranking-vazio.ranking-apelido', {},
      h('strong', { text: 'Escolha seu nome no placar.' }),
      h('span.tiny', {
        text: 'É como os outros pilotos vão ver você. De 3 a 16 caracteres; dá para trocar depois.',
      }),
      h('.ranking-apelido-linha', {},
        campo,
        h('button.btn', {
          onclick: () => { void enviar(); },
        }, h('span', { text: 'CONFIRMAR' })),
      ),
      ...(this.erroDeApelido ? [h('span.tiny.ranking-apelido-erro', { text: this.erroDeApelido })] : []),
      ...(this.apelidoDigitado && !apelidoValido(this.apelidoDigitado) && !this.erroDeApelido
        ? [h('span.tiny.muted', { text: 'De 3 a 16 caracteres, começando e terminando com letra ou número.' })]
        : []),
    );
  }

  private linha(l: LinhaDoPlacar, semValor = false): HTMLElement {
    return h(`.ranking-linha${l.voce ? '.eu' : ''}`, {},
      h('span.ranking-pos', { text: `${l.posicao}` }),
      h('.ranking-nome', {},
        // `text:` e não marcação: este é o único texto da tela escrito por
        // OUTRO jogador, e `h()` grava por `textContent`. Um teste impede o
        // sink de `innerHTML` de voltar ao `dom.ts`.
        h('strong', { text: l.voce ? `${l.apelido} (você)` : l.apelido }),
        ...(l.casco ? [h('span.muted.tiny', { text: l.casco })] : []),
      ),
      h('strong.ranking-pontos', { text: semValor ? '—' : (l.valor > 0 ? fmt(l.valor) : '—') }),
    );
  }
}
