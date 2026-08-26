import { fmt } from '@core/format';
import { rarityInfo } from '@data/rarity';
import { ESCOPO_LABEL, FAMILIAS_ORDENADAS, FAMILIA_LABEL, RECURSOS, iconeDeRecurso } from '@data/recursos';
import { ELEMENTS, getElement } from '@data/elements';
import { HULL_BY_ID } from '@data/hulls';
import { SHOP } from '@data/shop';
import { pedirSelecao } from '../selecao';
import type { Sim } from '@sim/index';
import { clear, h, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * O Armazém — materiais e componentes, separados do Inventário (§29).
 *
 * A separação não é de arrumação, é de natureza. Um equipamento é uma escolha
 * que compete por espaço com outro equipamento; um material é um acúmulo que só
 * existe para virar outra coisa no craft. Misturados, uma corrida boa de
 * mineração comeria o espaço das peças.
 *
 * O painel mostra o catálogo INTEIRO, inclusive o que o jogador ainda não tem,
 * agrupado por categoria. É deliberado: metade do valor de um armazém é saber o
 * que existe para caçar, e uma lista que só mostra o que já se possui esconde
 * exatamente a informação que faria alguém ir atrás.
 */
export class ArmazemPanel implements Panel {
  id = 'armazem';
  title = 'Armazém';
  icon = 'aba/inventario';
  iconUrl = '/assets/ui/menu/armazem.webp';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  /** Esconde o que ainda não foi encontrado — para quem já conhece o catálogo. */
  private soPossuidos = false;

  /**
   * Aba visível. Seis famílias mais os SERVIÇOS.
   *
   * As seis vinham empilhadas numa página só, e o catálogo tem 70 materiais:
   * achar um gás exigia rolar por minérios, ligas e orgânicos no caminho. Com
   * aba, cada família é uma tela.
   */
  private aba: string = 'servicos';


  render(sim: Sim): HTMLElement {
    const armazem = sim.state.armazem;
    const guardados = sim.materiaisGuardados;
    const teto = sim.resourceSlots;
    const cheio = guardados >= teto;

    const grupos = FAMILIAS_ORDENADAS.map((cat) => {
      const linhas = RECURSOS
        .filter((m) => m.familia === cat)
        .filter((m) => !this.soPossuidos || (armazem[m.id] ?? 0) > 0)
        .sort((a, b) => b.raridade - a.raridade || a.nome.localeCompare(b.nome));
      if (!linhas.length) return null;

      return h('.armazem-grupo', { dataset: { familia: cat } },
        ...linhas.map((m) => {
          const n = armazem[m.id] ?? 0;
          const cor = rarityInfo(m.raridade).color;
          const status = `${m.dropEstado === 'ativo' ? 'drop ativo' : 'drop planejado'} · ${m.arte === 'final' ? 'arte 2.0' : 'arte provisória'}`;
          return h(`.armazem-linha${n > 0 ? '' : '.vazia'}`, {
            title: `${m.drop}\nUso: ${m.funcao}\n${status}`,
          },
            /**
             * 44 px e não 26.
             *
             * Os ícones de recurso foram desenhados em ~139 px, com muito
             * detalhe: a 26 px viravam ruído colorido e o jogador não
             * reconhecia nenhum, mesmo com o id correto por trás. O tamanho é
             * o mínimo em que a silhueta de um cristal se distingue da de um
             * frasco.
             */
            spriteIcon(iconeDeRecurso(m), 44),
            h('.armazem-texto', {},
              h('strong', { text: m.nome, style: { color: n > 0 ? cor : 'var(--muted)' } }),
              h('span.armazem-origem.tiny', {
                text: `${ESCOPO_LABEL[m.escopo]} · ${m.dropEstado === 'ativo' ? 'disponível' : 'planejado'}`,
              }),
              h('span.muted.tiny.armazem-funcao', { text: m.funcao }),
            ),
            h('span.armazem-qtd', {
              text: n > 0 ? fmt(n) : '—',
              style: { color: n > 0 ? 'var(--text)' : 'var(--muted)' },
            }),
          );
        }),
      );
    }).filter(Boolean) as HTMLElement[];

    return h('.panel-body', {},
      h('.toolbar', {},
        h('span.muted.tiny', {
          // O número que importa é TIPOS guardados, não unidades: é isso que a
          // capacidade limita, e é o que decide se um material novo cabe.
          text: `${guardados} / ${teto} tipos`,
          style: cheio ? { color: 'var(--bad)' } : {},
        }),
        h(`button.mini${this.soPossuidos ? '.ativa' : ''}`, {
          text: this.soPossuidos ? 'Só o que tenho' : 'Catálogo inteiro',
          title: 'O catálogo inteiro mostra também o que ainda não caiu — é como saber o que existe para caçar.',
          onclick: () => { this.soPossuidos = !this.soPossuidos; sim.touch(); },
        }),
      ),
      ...(cheio
        ? [h('.aviso', { text: 'Armazém cheio: materiais de tipo NOVO serão perdidos. Amplie a carga para acompanhar mais tipos.' })]
        : []),

      h('nav.armazem-abas', { role: 'tablist', 'aria-label': 'Grupos do armazém' },
        // Serviços vem PRIMEIRO: é a única aba com algo a fazer, não só a ver.
        this.botaoDeAba(sim, 'servicos', 'Serviços', this.totalDeCargas(sim)),
        ...FAMILIAS_ORDENADAS.map((cat) => this.botaoDeAba(
          sim, cat, FAMILIA_LABEL[cat],
          RECURSOS.filter((m) => m.familia === cat && (armazem[m.id] ?? 0) > 0).length,
        )),
      ),
      h('.armazem-conteudo', { role: 'tabpanel' },
        ...(this.aba === 'servicos' ? this.abaDeServicos(sim) : grupos.filter((g) => g?.dataset.familia === this.aba)),
      ),
    );
  }

  /** Quantas cargas de serviço há guardadas, somando todos os tipos. */
  private totalDeCargas(sim: Sim): number {
    return Object.values(sim.state.servicos ?? {}).reduce((s, n) => s + (n ?? 0), 0);
  }

  private botaoDeAba(sim: Sim, id: string, rotulo: string, quantos: number): HTMLElement {
    return h(`button.armazem-aba${id === this.aba ? '.ativa' : ''}`, {
      role: 'tab',
      'aria-selected': String(id === this.aba),
      onclick: () => { this.aba = id; sim.touch(); },
    },
      h('span', { text: rotulo }),
      // O número é quantos tipos você TEM, não quantos existem: o catálogo
      // inteiro é o mesmo para todo mundo e não diz nada sobre esta partida.
      ...(quantos > 0 ? [h('i.armazem-conta', { text: String(quantos) })] : []),
    );
  }

  /**
   * A aba de Serviços: uma LISTA de cargas, como qualquer outro estoque.
   *
   * Antes cada carga era um cartão com os seis botões de elemento por dentro —
   * e a de nave trazia a frota inteira, seis botões CADA. Com quarenta naves
   * aquilo vira uma parede de duzentos e quarenta botões numa aba que deveria
   * ser um inventário.
   *
   * A linha só diz o que é e quantas você tem. O que fazer com ela acontece
   * onde faz sentido: peça, no inventário; nave, num modal com a frota.
   */
  private abaDeServicos(sim: Sim): HTMLElement[] {
    const cargas = SHOP.filter((s) => s.alvo && (sim.state.servicos?.[s.id] ?? 0) > 0);
    if (!cargas.length) {
      return [h('.armazem-vazio', {},
        h('strong', { text: 'Nenhuma carga guardada.' }),
        h('span.tiny', { text: 'Serviços com alvo comprados na Central de Serviços ficam aqui até você escolher em que usá-los.' }),
      )];
    }

    return [h('.armazem-servicos', {}, ...cargas.map((s) => {
      const n = sim.state.servicos[s.id] ?? 0;
      return h('button.armazem-servico', {
        onclick: () => {
          if (s.alvo === 'nave') { this.abrirModalDeNaves(sim, s.id, s.name); return; }
          // Peça: a faixa assume a partir daqui — elemento, depois alvo.
          pedirSelecao({ servico: s.id, nome: s.name, elemento: null });
          sim.touch();
        },
      },
        spriteIcon('geral/b_1', 34, 'armazem-servico-art'),
        h('.armazem-servico-txt', {},
          h('strong', { text: s.name }),
          h('span.muted.tiny', { text: s.desc }),
        ),
        h('i.armazem-conta', { text: String(n) }),
        h('span.armazem-servico-seta', { text: '›', 'aria-hidden': true }),
      );
    }))];
  }

  /**
   * Modal da frota: escolher nave e elemento num lugar só.
   *
   * Naves não sofrem o problema que o `<select>` de peças tinha — cada casco
   * tem silhueta própria e a lista é curta hoje. Mas ela pode chegar a quarenta,
   * e é por isso que aqui é modal ROLÁVEL e não linhas soltas na aba: uma lista
   * longa precisa de um lugar com fim, não de uma aba que cresce para sempre.
   *
   * O elemento fica em cada linha, e não numa etapa separada, porque a decisão
   * é sempre "esta nave, para aquele elemento" — separar em dois passos faria o
   * jogador escolher o elemento sem ver de que nave está falando.
   */
  private abrirModalDeNaves(sim: Sim, servico: string, nome: string): void {
    const modal = h('.modal-backdrop');
    const fechar = () => modal.remove();

    const desenhar = (): void => {
      const restam = sim.cargasDe(servico);
      clear(modal).append(h('.modal.armazem-modal', {},
        h('h2', { text: nome }),
        h('p.muted.tiny', { text: restam > 0
          ? `${restam} carga${restam > 1 ? 's' : ''} · escolha a nave e o elemento de destino. As peças que deixarem de servir continuam instaladas.`
          : 'Sem cargas. Compre outra na Central de Serviços.' }),

        h('.armazem-frota', {}, ...sim.state.fleet.map((id) => {
          const casco = HULL_BY_ID.get(id);
          if (!casco) return null;
          const atual = sim.elementoDe(id);
          return h('.armazem-nave', {},
            spriteIcon(casco.sprite, 34, 'armazem-nave-art'),
            h('.armazem-nave-txt', {},
              h('strong.tiny', { text: casco.name }),
              h('span.tiny', {
                text: getElement(atual).name,
                style: { color: getElement(atual).color } as Partial<CSSStyleDeclaration>,
              }),
            ),
            h('.armazem-elementos', {}, ...ELEMENTS.filter((el) => el.id !== atual).map((el) => h('button.chip', {
              text: el.sigla,
              title: `Trocar para ${el.name}`,
              disabled: restam <= 0,
              style: { color: el.color } as Partial<CSSStyleDeclaration>,
              onclick: () => {
                if (!sim.usarCargaNaNave(servico, id, el.id)) return;
                sim.touch();
                // Redesenha em vez de fechar: quem tem duas cargas costuma
                // usar as duas, e reabrir o modal a cada uso seria atrito.
                if (sim.cargasDe(servico) > 0) desenhar(); else fechar();
              },
            }))),
          );
        }).filter(Boolean) as HTMLElement[]),

        h('button.btn', { onclick: fechar }, h('span', { text: 'Fechar' })),
      ));
    };

    desenhar();
    modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
    document.body.append(modal);
  }
  badge(sim: Sim): number {
    // O marcador avisa que o depósito está no limite, não quantos materiais há:
    // acumular material não é problema, deixar de recolher um tipo novo é.
    return sim.materiaisGuardados >= sim.resourceSlots ? 1 : 0;
  }
}
