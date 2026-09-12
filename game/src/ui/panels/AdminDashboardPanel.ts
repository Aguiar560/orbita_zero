import { buscarPainelAdmin, type EstadoDoPainelAdmin, type JogadorDoPainelAdmin, type PainelAdmin } from '@app/painel-admin';
import { HULL_BY_ID } from '@data/hulls';
import { BASE_BY_ID, SLOT_BY_ID } from '@data/items';
import { RARITIES } from '@data/balance/raridades';
import { bus } from '@app/Bus';
import { fmt } from '@core/format';
import type { Sim } from '@sim/index';
import type { SlotId } from '@sim/types';
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
  private aba: 'visao' | 'pilotos' | 'atividade' | 'progressao' | 'economia' | 'frota' | 'missoes' | 'saude' = 'visao';
  private pilotoAberto: string | null = null;

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
        ['visao', 'VISÃO GERAL'], ['pilotos', 'PILOTOS'], ['atividade', 'ATIVIDADE'],
        ['progressao', 'PROGRESSÃO'], ['economia', 'ECONOMIA'], ['frota', 'FROTA E ITENS'],
        ['missoes', 'MISSÕES'], ['saude', 'SAÚDE'],
      ].map(([id, nome]) => h(`button.admin-aba${this.aba === id ? '.ativa' : ''}`, {
        text: nome, onclick: () => { this.aba = id as typeof this.aba; bus.emit('state:changed'); },
      }))),
      ...(this.aba === 'visao' ? [this.visao(dados)] : []),
      ...(this.aba === 'pilotos' ? [this.pilotos(jogadores, campo, dados.geradoEm)] : []),
      ...(this.aba === 'atividade' ? [this.atividadeGeral(dados)] : []),
      ...(this.aba === 'progressao' ? [this.progressao(dados)] : []),
      ...(this.aba === 'economia' ? [this.economia(dados)] : []),
      ...(this.aba === 'frota' ? [this.frota(dados)] : []),
      ...(this.aba === 'missoes' ? [this.missoes(dados)] : []),
      ...(this.aba === 'saude' ? [this.saude(dados)] : []),
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
          ['TEMPO MÉDIO', this.tempo(dados.resumo.tempoMedio)],
          ['NOVOS · 7D', dados.resumo.novos7d],
          ['ATIVOS · 30D', dados.resumo.ativos30d],
        ].map(([rotulo, valor]) => h('.admin-kpi', {},
          h('span', { text: String(rotulo) }), h('strong', { text: typeof valor === 'string' ? valor : fmt(Number(valor)) }),
        )),
      );
  }

  private pilotos(jogadores: JogadorDoPainelAdmin[], campo: HTMLInputElement, agora: number): HTMLElement {
    const selecionado = jogadores.find((jogador) => jogador.codigo === this.pilotoAberto) ?? null;
    return h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {},
          h('.admin-lista-texto', {},
            h('span', { text: 'PILOTOS' }),
            h('small', { text: `${jogadores.length} ${jogadores.length === 1 ? 'resultado' : 'resultados'} · dados públicos de operação` }),
          ),
          campo,
        ),
        ...(selecionado ? [this.detalheDoPiloto(selecionado)] : []),
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

  private economia(dados: PainelAdmin): HTMLElement {
    const recursos = dados.economia.recursos.map((r) => h('.admin-dado', {},
      h('span', { text: r.moeda.toUpperCase() }), h('strong', { text: fmt(r.quantia) }),
    ));
    const materiais = dados.economia.materiais.map((m) => h('.admin-dado', {},
      h('span', { text: m.material.replaceAll('_', ' ').toUpperCase() }), h('strong', { text: fmt(m.quantia) }),
    ));
    const movimentos = dados.economia.movimentacao.map((m) => h('.admin-dado.admin-movimento', {},
      h('span', { text: m.moeda.toUpperCase() }), h('strong', { text: `+${fmt(m.entradas)} / −${fmt(m.saidas)}` }),
      h('small', { text: `${fmt(m.operacoes)} lançamentos` }),
    ));
    return h('.admin-duas-colunas', {},
      h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'RECURSOS NO SERVIDOR' }), h('small', { text: 'Carteiras atuais de todos os pilotos.' }))),
        h('.admin-cartoes', {}, ...recursos),
      ),
      h('.admin-dashboard-lista', {},
        h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'MATERIAIS' }), h('small', { text: 'Estoque de fabricação no servidor.' }))),
        h('.admin-cartoes', {}, ...materiais),
      ),
      h('.admin-dashboard-lista.admin-coluna-inteira', {},
        h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'FLUXO ECONÔMICO' }), h('small', { text: 'Entradas, saídas e volume do livro-caixa.' }))),
        h('.admin-cartoes', {}, ...movimentos),
      ),
    );
  }

  private progressao(dados: PainelAdmin): HTMLElement {
    const cartoes = dados.galaxias.map((g) => h('.admin-dado', {},
      h('span', { text: `GALÁXIA ${g.indice}` }), h('strong', { text: `${g.jogadores} pilotos` }), h('small', { text: `Maior setor: ${g.maiorSetor}` }),
    ));
    const niveis = dados.niveis.map((n) => h('.admin-dado', {}, h('span', { text: `NÍVEL ${n.faixa}` }), h('strong', { text: `${n.jogadores} pilotos` })));
    return h('.admin-duas-colunas', {},
      h('.admin-dashboard-lista', {}, h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'POR GALÁXIA' }), h('small', { text: 'Galáxia mais distante alcançada.' }))), h('.admin-cartoes', {}, ...cartoes)),
      h('.admin-dashboard-lista', {}, h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: 'POR NÍVEL' }), h('small', { text: 'Distribuição atual da base.' }))), h('.admin-cartoes', {}, ...niveis)),
    );
  }

  private atividadeGeral(dados: PainelAdmin): HTMLElement {
    return h('.admin-kpis', {}, ...[
      ['ONLINE · 5 MIN', dados.resumo.online], ['ATIVOS · 24H', dados.resumo.ativos24h],
      ['ATIVOS · 7D', dados.resumo.ativos7d], ['ATIVOS · 30D', dados.resumo.ativos30d],
      ['NOVOS · 24H', dados.resumo.novos24h], ['NOVOS · 7D', dados.resumo.novos7d],
      ['TEMPO TOTAL', this.tempo(dados.resumo.tempoDeJogo)], ['TEMPO MÉDIO', this.tempo(dados.resumo.tempoMedio)],
    ].map(([r, v]) => this.cartao(String(r), typeof v === 'string' ? v : fmt(Number(v)))));
  }

  private frota(dados: PainelAdmin): HTMLElement {
    const cascos = dados.frota.cascos.map((n) => this.cartao(n.casco.replaceAll('_', ' ').toUpperCase(), fmt(n.total), 'liberadas'));
    const campo = dados.frota.emCampo.map((n) => this.cartao(n.casco.replaceAll('_', ' ').toUpperCase(), fmt(n.total), 'em campo'));
    const raridades = dados.frota.raridades.map((r) => this.cartao(`RARIDADE ${r.raridade}`, fmt(r.total), `${r.equipados} equipados`));
    return h('.admin-tres-colunas', {},
      this.grupo('NAVES LIBERADAS', 'Quantidade de cada casco no servidor.', cascos),
      this.grupo('NAVES EM CAMPO', 'Preferência atual dos pilotos.', campo),
      this.grupo('INVENTÁRIO POR RARIDADE', 'Total existente e peças equipadas.', raridades),
    );
  }

  private missoes(dados: PainelAdmin): HTMLElement {
    const populares = dados.missoes.maisEntregues.map((m) => this.cartao(m.missao.replaceAll('_', ' ').toUpperCase(), fmt(m.total), 'entregas'));
    return h('.admin-duas-colunas', {},
      h('.admin-kpis.admin-kpis-curtos', {}, this.cartao('INICIADAS', fmt(dados.missoes.iniciadas)), this.cartao('EM ANDAMENTO', fmt(dados.missoes.emAndamento)), this.cartao('ENTREGUES', fmt(dados.missoes.entregues))),
      this.grupo('MAIS CONCLUÍDAS', 'Missões com maior número de entregas.', populares),
    );
  }

  private saude(dados: PainelAdmin): HTMLElement {
    return h('.admin-kpis', {},
      this.cartao('CADASTROS PENDENTES', fmt(dados.saude.semApelido), 'sem apelido'),
      this.cartao('SEM SAVE', fmt(dados.saude.semSave), 'contas sem sincronização'),
      this.cartao('SAVES INVÁLIDOS', fmt(dados.saude.savesInvalidos), 'JSON que não pôde ser lido'),
    );
  }

  private grupo(titulo: string, subtitulo: string, conteudo: HTMLElement[]): HTMLElement {
    return h('.admin-dashboard-lista', {}, h('.admin-lista-topo', {}, h('.admin-lista-texto', {}, h('span', { text: titulo }), h('small', { text: subtitulo }))), h('.admin-cartoes', {}, ...conteudo));
  }

  private cartao(rotulo: string, valor: string, detalhe?: string): HTMLElement {
    return h('.admin-dado', {}, h('span', { text: rotulo }), h('strong', { text: valor }), ...(detalhe ? [h('small', { text: detalhe })] : []));
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
    return h(`.admin-linha${jogador.online ? '.online' : ''}`, {
      role: 'row', tabindex: '0', onclick: () => {
        this.pilotoAberto = this.pilotoAberto === jogador.codigo ? null : jogador.codigo;
        bus.emit('state:changed');
      },
    },
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

  private detalheDoPiloto(jogador: JogadorDoPainelAdmin): HTMLElement {
    const recursos = Object.entries(jogador.recursos).map(([id, valor]) => `${id}: ${fmt(valor)}`).join(' · ') || 'sem saldo';
    const materiais = Object.entries(jogador.materiais).map(([id, valor]) => `${id}: ${fmt(valor)}`).join(' · ') || 'sem materiais';
    const equipamentos = jogador.equipamentos.length
      ? jogador.equipamentos.map((item) => {
        const base = BASE_BY_ID.get(item.baseId);
        const slot = SLOT_BY_ID.get(item.slot as SlotId);
        const raridade = RARITIES[item.raridade];
        const nave = HULL_BY_ID.get(item.nave)?.name ?? item.nave.replaceAll('_', ' ');
        const nome = item.nome === item.baseId ? (base?.name ?? item.baseId) : item.nome;
        const extras = [item.elemento, item.conjunto].filter(Boolean).join(' · ');
        return h('.admin-equipamento', {},
          h('.admin-equipamento-principal', {},
            h('strong', { text: nome }),
            h('span', { text: `${slot?.short ?? item.slot} · ${nave}` }),
          ),
          h('.admin-equipamento-meta', {},
            h('b', { text: raridade?.name ?? `Raridade ${item.raridade}`, style: { color: raridade?.color ?? '#cbd6df' } }),
            h('span', { text: `nível ${item.nivel}` }),
            ...(extras ? [h('span', { text: extras })] : []),
          ),
        );
      })
      : [h('.admin-vazio', { text: 'Nenhuma peça equipada.' })];
    return h('.admin-detalhe-piloto', {},
      h('.admin-detalhe-titulo', {}, h('strong', { text: jogador.apelido ?? 'Cadastro pendente' }), h('span', { text: `ID ${jogador.codigo}` })),
      h('.admin-cartoes', {},
        this.cartao('NAVE EM CAMPO', jogador.cascoEmCampo
          ? (HULL_BY_ID.get(jogador.cascoEmCampo)?.name ?? jogador.cascoEmCampo.replaceAll('_', ' '))
          : 'registro indisponível'),
        this.cartao('GALÁXIA', String(Math.floor((jogador.melhorSetor - 1) / 10) + 1), `setor ${jogador.melhorSetor}`),
        this.cartao('ABATES', fmt(jogador.abates), `${fmt(jogador.chefesAbatidos)} chefes`),
        this.cartao('MORTES', fmt(jogador.mortes)),
        this.cartao('ITENS ENCONTRADOS', fmt(jogador.itensEncontrados)),
        this.cartao('BAÚS ABERTOS', fmt(jogador.bausAbertos)),
        this.cartao('MEDALHAS', fmt(jogador.medalhas)),
        this.cartao('PRIMEIRO REGISTRO', jogador.primeiroAcesso ? this.data(jogador.primeiroAcesso) : 'desconhecido'),
      ),
      h('p.admin-detalhe-linha', { text: `Recursos · ${recursos}` }),
      h('p.admin-detalhe-linha', { text: `Materiais · ${materiais}` }),
      h('.admin-equipamentos', {},
        h('.admin-equipamentos-titulo', {},
          h('strong', { text: 'EQUIPAMENTOS EQUIPADOS' }),
          h('span', { text: `${jogador.equipamentos.length} peças` }),
        ),
        h('.admin-equipamento-lista', {}, ...equipamentos),
      ),
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

  private data(epoch: number): string {
    return new Date(epoch * 1000).toLocaleDateString('pt-BR');
  }

  private mensagem(titulo: string, detalhe: string, atualizar = false): HTMLElement {
    return h('.admin-dashboard.admin-mensagem', {},
      h('strong', { text: titulo }), h('span', { text: detalhe }),
      ...(atualizar ? [h('button.mini', { text: 'TENTAR DE NOVO', onclick: () => this.atualizar() })] : []),
    );
  }
}
