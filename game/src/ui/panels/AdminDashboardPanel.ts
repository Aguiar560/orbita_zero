import { buscarPainelAdmin, type EstadoDoPainelAdmin, type JogadorDoPainelAdmin } from '@app/painel-admin';
import { bus } from '@app/Bus';
import { fmt } from '@core/format';
import type { Sim } from '@sim/index';
import { h } from '../dom';
import type { Panel } from './types';

/** Quantos segundos desde uma atividade ainda leem como "agora". */
const AGORA = 60;

/**
 * Painel de operação — separado do Laboratório.
 *
 * Laboratório muda e mede a cena. Este só lê o estado agregado do jogo para
 * responder perguntas operacionais: quem está aqui, até onde chegou e onde a
 * progressão está concentrada. Nenhum e-mail, token ou save cru atravessa a
 * rota; identidade é o apelido público ou um código curto.
 */
export class AdminDashboardPanel implements Panel {
  id = 'admin-dashboard';
  title = 'Comando';
  icon = 'geral/b_4';
  iconUrl = '/assets/ui/menu/ranking-trofeu.webp';
  overlay = true;

  private estado: EstadoDoPainelAdmin = { fase: 'nunca' };
  private filtro = '';
  private atualizando = false;
  private aba: 'visao' | 'pilotos' | 'economia' | 'galaxias' = 'visao';

  render(_sim: Sim): HTMLElement {
    this.garantirDados();

    if (this.estado.fase === 'proibido') return this.mensagem(
      'Acesso administrativo necessário.',
      'Sua conta não está autorizada a consultar dados operacionais.',
    );
    if (this.estado.fase === 'erro') return this.mensagem(
      'Não foi possível carregar o comando.',
      'Confira a conexão com o servidor e tente atualizar.',
      true,
    );
    if (this.estado.fase !== 'pronto') return this.mensagem(
      'Lendo telemetria do jogo…',
      'Consolidando jogadores, atividade e progresso.',
    );

    const { dados } = this.estado;
    const jogadores = this.filtrar(dados.jogadores);
    const campo = h('input.admin-filtro', {
      type: 'search', value: this.filtro, placeholder: 'Filtrar piloto ou código',
      'aria-label': 'Filtrar jogadores',
      oninput: (evento: Event) => {
        this.filtro = (evento.target as HTMLInputElement).value;
        bus.emit('state:changed');
      },
    }) as HTMLInputElement;

    return h('.admin-dashboard', {},
      h('.admin-dashboard-topo', {},
        h('.admin-dashboard-contexto', {},
          h('span', { text: 'OPERAÇÃO DO JOGO' }),
          h('strong', { text: `${dados.resumo.online} online agora` }),
          h('small', { text: `Presença: save sincronizado nos últimos ${Math.round(dados.janelaOnlineSegundos / 60)} min` }),
        ),
        h('button.mini.admin-atualizar', {
          text: this.atualizando ? 'ATUALIZANDO…' : 'ATUALIZAR',
          disabled: this.atualizando,
          onclick: () => this.atualizar(),
        }),
      ),
      h('.admin-abas', {}, ...[
        ['visao', 'VISÃO GERAL'], ['pilotos', 'PILOTOS'], ['economia', 'ECONOMIA E FROTA'], ['galaxias', 'GALÁXIAS'],
      ].map(([id, nome]) => h(`button.admin-aba${this.aba === id ? '.ativa' : ''}`, {
        text: nome, onclick: () => { this.aba = id as typeof this.aba; bus.emit('state:changed'); },
      }))),
      ...(this.aba === 'visao' ? [this.visao(dados)] : []),
      ...(this.aba === 'pilotos' ? [this.pilotos(jogadores, campo, dados.geradoEm)] : []),
      ...(this.aba === 'economia' ? [this.economia(dados)] : []),
      ...(this.aba === 'galaxias' ? [this.galaxias(dados)] : []),
    );
  }

  private visao(dados: Extract<EstadoDoPainelAdmin, { fase: 'pronto' }>['dados']): HTMLElement {
    return h('.admin-kpis', {},
        ...[
          ['JOGADORES', dados.resumo.jogadores],
          ['ONLINE', dados.resumo.online],
          ['ATIVOS · 24H', dados.resumo.ativos24h],
          ['ATIVOS · 7D', dados.resumo.ativos7d],
          ['NÍVEL MÉDIO', dados.resumo.nivelMedio],
          ['MAIOR SETOR', dados.resumo.maiorSetor],
          ['NAVES', dados.resumo.naves],
          ['ITENS NA CARGA', dados.resumo.itensNaMochila],
          ['TEMPO TOTAL', this.tempo(dados.resumo.tempoDeJogo)],
        ].map(([rotulo, valor]) => h('.admin-kpi', {},
          h('span', { text: String(rotulo) }), h('strong', { text: typeof valor === 'string' ? valor : fmt(Number(valor)) }),
        )),
      );
  }

  private pilotos(jogadores: JogadorDoPainelAdmin[], campo: HTMLInputElement, agora: number): HTMLElement {
    return h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {},
          h('.admin-lista-texto', {},
            h('span', { text: 'PILOTOS' }),
            h('small', { text: `${jogadores.length} ${jogadores.length === 1 ? 'resultado' : 'resultados'} · dados públicos de operação` }),
          ),
          campo,
        ),
        h('.admin-lista-tabela', { role: 'table', 'aria-label': 'Jogadores e progresso' },
          h('.admin-linha.admin-cabecalho', { role: 'row' },
            h('span', { text: 'PILOTO' }), h('span', { text: 'STATUS' }),
            h('span', { text: 'NÍVEL' }), h('span', { text: 'SETOR' }),
            h('span', { text: 'NAVES' }), h('span', { text: 'ITENS' }),
            h('span', { text: 'MISSÕES' }), h('span', { text: 'TEMPO' }), h('span', { text: 'RECURSOS' }), h('span', { text: 'ÚLTIMA ATIVIDADE' }),
          ),
          ...(jogadores.length
            ? jogadores.map((jogador) => this.linha(jogador, agora))
            : [h('.admin-vazio', { text: 'Nenhum piloto corresponde ao filtro.' })]),
        ),
      );
  }

  private economia(dados: Extract<EstadoDoPainelAdmin, { fase: 'pronto' }>['dados']): HTMLElement {
    const recursos = dados.economia.recursos.map((r) => h('.admin-dado', {},
      h('span', { text: r.moeda.toUpperCase() }), h('strong', { text: fmt(r.quantia) }),
    ));
    const cascos = dados.frota.cascos.length
      ? dados.frota.cascos.map((n) => h('.admin-dado', {},
        h('span', { text: n.casco.replaceAll('_', ' ').toUpperCase() }), h('strong', { text: fmt(n.total) }),
      ))
      : [h('.admin-vazio', { text: 'Nenhuma nave registrada.' })];
    return h('.admin-duas-colunas', {},
      h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'RECURSOS NO SERVIDOR' }), h('small', { text: 'Carteiras atuais de todos os pilotos.' }))),
        h('.admin-cartoes', {}, ...recursos),
      ),
      h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'FROTA POR CASCO' }), h('small', { text: 'Naves liberadas no servidor.' }))),
        h('.admin-cartoes', {}, ...cascos),
      ),
    );
  }

  private galaxias(dados: Extract<EstadoDoPainelAdmin, { fase: 'pronto' }>['dados']): HTMLElement {
    const cartoes = dados.galaxias.map((g) => h('.admin-dado', {},
      h('span', { text: `GALÁXIA ${g.indice}` }), h('strong', { text: `${g.jogadores} pilotos` }), h('small', { text: `Maior setor: ${g.maiorSetor}` }),
    ));
    return h('.admin-dashboard-lista', {},
      h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'PROGRESSÃO POR GALÁXIA' }), h('small', { text: 'Pilotos agrupados pela galáxia mais distante alcançada.' }))),
      h('.admin-cartoes', {}, ...cartoes),
    );
  }

  private garantirDados(): void {
    if (this.estado.fase === 'nunca') this.atualizar();
  }

  private atualizar(): void {
    if (this.atualizando) return;
    this.atualizando = true;
    if (this.estado.fase === 'nunca') this.estado = { fase: 'carregando' };
    void buscarPainelAdmin().then((estado) => {
      this.estado = estado;
      this.atualizando = false;
      bus.emit('state:changed');
    });
  }

  private filtrar(jogadores: readonly JogadorDoPainelAdmin[]): JogadorDoPainelAdmin[] {
    const termo = this.filtro.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [...jogadores];
    return jogadores.filter((jogador) =>
      jogador.codigo.toLocaleLowerCase('pt-BR').includes(termo)
      || (jogador.apelido ?? '').toLocaleLowerCase('pt-BR').includes(termo));
  }

  private linha(jogador: JogadorDoPainelAdmin, agora: number): HTMLElement {
    return h(`.admin-linha${jogador.online ? '.online' : ''}`, { role: 'row' },
      h('.admin-piloto', {},
        h('strong', { text: jogador.apelido ?? 'Piloto sem apelido' }),
        h('small', { text: `ID · ${jogador.codigo}` }),
      ),
      h('span.admin-status', { text: jogador.online ? 'ONLINE' : 'OFFLINE' }),
      h('strong', { text: String(jogador.nivel) }),
      h('strong', { text: String(jogador.melhorSetor) }),
      h('span', { text: String(jogador.naves) }),
      h('span', { text: `${jogador.itensNaMochila} / ${jogador.itensEquipados}` }),
      h('span', { text: String(jogador.missoesConcluidas) }),
      h('span', { text: this.tempo(jogador.tempoDeJogo) }),
      h('span', { text: this.recursos(jogador.recursos) }),
      h('span.admin-atividade', { text: this.atividade(jogador.ultimaAtividade, agora) }),
    );
  }

  private tempo(segundos: number): string {
    const horas = Math.floor(Math.max(0, segundos) / 3_600);
    if (horas >= 24) return `${Math.floor(horas / 24)}d ${horas % 24}h`;
    return `${horas}h ${Math.floor((segundos % 3_600) / 60)}m`;
  }

  private recursos(recursos: Record<string, number>): string {
    return ['sucata', 'nucleo', 'cristal'].map((id) => `${id[0]!.toUpperCase()}:${fmt(recursos[id] ?? 0)}`).join(' · ');
  }

  private atividade(atividade: number | null, agora: number): string {
    if (!atividade) return 'Sem save';
    const segundos = Math.max(0, agora - atividade);
    if (segundos <= AGORA) return 'Agora';
    if (segundos < 3_600) return `${Math.floor(segundos / 60)} min`;
    if (segundos < 86_400) return `${Math.floor(segundos / 3_600)} h`;
    return `${Math.floor(segundos / 86_400)} d`;
  }

  private mensagem(titulo: string, detalhe: string, atualizar = false): HTMLElement {
    return h('.admin-dashboard.admin-mensagem', {},
      h('strong', { text: titulo }), h('span', { text: detalhe }),
      ...(atualizar ? [h('button.mini', { text: 'TENTAR DE NOVO', onclick: () => this.atualizar() })] : []),
    );
  }
}
