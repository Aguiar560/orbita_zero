import { toast } from '@app/Bus';
import { iconeDeElemento } from '../elementos';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { RARITIES, rarityInfo } from '@data/rarity';
import { getElement } from '@data/elements';
import { colunasDaGrade } from '@data/balance/capacidade';
import { ELEMENTS } from '@data/elements';
import { SLOTS } from '@data/items';
import { retornoDeDesmanche, valorDeVenda } from '@data/balance/descarte';
import { RECURSO_POR_ID } from '@data/recursos';
import type { ElementId } from '@sim/types';

/** O tier mais alto entre as linhas da peça. Afixo de save antigo conta como T1. */
function melhorTier(item: Item): number {
  return item.affixes.reduce((m, a) => Math.max(m, a.tier ?? 1), 0);
}

/**
 * As peças da mais nova para a mais antiga.
 *
 * A ordem de chegada É a posição na mochila: `stash` põe a peça nova no fim, e
 * o servidor devolve a mochila por ordem de gravação (`ORDER BY rowid` em
 * `inventarioDe`). Não há carimbo de data na peça, e não precisa haver — a
 * lista já é a história.
 *
 * Exceção conhecida: a peça que volta do soquete ao desequipar mantém a
 * posição de quando CHEGOU, e não a de quando voltou. Na tela local ela vai para
 * o fim até a próxima sincronização.
 */
export function ordemDeChegada(mochila: readonly Item[], lista: Item[]): Item[] {
  const posicao = new Map(mochila.map((item, i) => [item.uid, i]));
  return lista.sort((a, b) => (posicao.get(b.uid) ?? -1) - (posicao.get(a.uid) ?? -1));
}

import { scoreItem, classeDeExclusivo } from '@sim/loot';
import type { Item, Rarity, SlotId } from '@sim/types';
import type { Sim } from '@sim/index';

/**
 * A grade, com as colunas vindas da capacidade.
 *
 * Vai por `setProperty` e não pelo objeto `style` do helper porque propriedade
 * CUSTOMIZADA não existe em `CSSStyleDeclaration` — o TypeScript recusa, e com
 * razão: `style['--x']` é ignorado silenciosamente em runtime.
 */
function grade(colunas: number, cells: HTMLElement[]): HTMLElement {
  const el = h('.inv-grid', { role: 'listbox', 'aria-multiselectable': 'true' }, ...cells);
  el.style.setProperty('--inv-colunas', String(colunas));
  return el;
}

import { h, spriteIcon } from '../dom';
import { cascoEmMontagem, encerrarArraste, iniciarArraste, itemArrastado } from '../montagem';
import { buildItemCard } from '../ItemCard';
import { encerrarSelecao, mirandoAlvo } from '../selecao';
import type { Panel } from './types';

/**
 * O resumo "12 Ferrita + 3 Titânio", exportado porque o descarte AUTOMÁTICO
 * fala a mesma frase que o manual — a peça sumiu do mesmo jeito, e duas
 * redações para o mesmo fato fazem o jogador achar que são coisas diferentes.
 */
export function resumoDeMateriais(materiais: Readonly<Record<string, number>>): string {
  return Object.entries(materiais)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${fmt(n)} ${RECURSO_POR_ID.get(id)?.nome ?? id}`)
    .join(' + ');
}

/**
 * A forma da grade vem de `data/balance/capacidade.ts` (§28).
 *
 * Eram `COLS = 7` e `ROWS = 10` fixos aqui. Não é decisão de painel: quantos
 * espaços o jogador tem é regra de jogo, e ela cresce de 15 até 70 por loja,
 * chefe e universo. Manter a constante aqui faria a UI desenhar 70 células
 * enquanto a simulação só permitia guardar 15.
 */

/**
 * Inventário em grade.
 *
 * A lista anterior gastava meia tela por item e exigia rolar muito para
 * comparar duas peças. Aqui cada item é uma célula com o ícone e a moldura da
 * raridade; os detalhes vivem num cartão que aparece no hover, então dá para
 * varrer o inventário inteiro de relance e só parar no que interessa.
 */
export class InventoryPanel implements Panel {
  id = 'inventario';
  title = 'Inventário';
  icon = 'aba/inventario';

  private filter: Rarity | -1 = -1;
  /**
   * Filtro por ELEMENTO. Passou a fazer falta com a Fase 2: escolher escudo
   * virou leitura do inimigo, e "achar meu escudo de gelo" era rolar a grade
   * inteira olhando os pips.
   */
  private elemento: ElementId | 'todos' = 'todos';
  /**
   * Filtro por SLOT: "só asas", "só arma principal".
   *
   * Ordenar por slot já agrupava as peças, mas agrupar não é filtrar: com o
   * inventário cheio, achar as três asas no meio de setenta peças exigia rolar
   * a grade inteira contando ícones. A pergunta que se faz aqui é "o que tenho
   * para ESTE soquete", e ela merece resposta direta.
   */
  private slot: SlotId | 'todos' = 'todos';
  /** Só favoritos — o inventário nasce com 15 espaços, então marcar importa. */
  private soFavoritos = false;
  /**
   * A ordem da grade. Nasce em "Mais recentes".
   *
   * Era "Ganho de poder", e a peça que acabava de cair entrava no meio das
   * outras, no lugar que o poder dela mandava — o jogador via a cápsula ser
   * coletada e não achava a peça (pedido de 10/09/2026). Com a mais nova
   * primeiro, o que chegou está sempre no mesmo lugar: o começo da grade.
   */
  private sort: 'recentes' | 'poder' | 'raridade' | 'slot' | 'tier' | 'nivel' = 'recentes';
  /** Seleção exclusiva das ações em lote; não interfere na peça da Anatomia. */
  private readonly selecionados = new Set<string>();
  /** Aguarda o segundo clique para separar seleção de equipamento. */
  private cliquePendente: { uid: string; timer: number; executar: () => void } | null = null;
  /** Confirmação interna do jogo; no máximo uma pode existir. */
  private confirmacao: HTMLElement | null = null;
  private readonly tip = h('.inv-tip.hidden');

  badge(sim: Sim): number {
    return sim.state.inventory.length;
  }

  render(sim: Sim): HTMLElement {
    const items = this.sorted(sim);
    const lote = this.itensSelecionados(sim);
    // A grade tem exatamente os espaços que o jogador LIBEROU (§28), não um
    // número fixo. Desenhar 70 células com capacidade 15 mostrava 55 espaços
    // que não existem — o oposto do que um inventário apertado deve comunicar.
    const capacidade = sim.cargoSlots;

    /**
     * TODO item vira célula, mesmo passando da capacidade.
     *
     * Havia um `.slice(0, capacidade)` aqui, e ele ESCONDIA. Com 30 peças e 15
     * espaços a grade desenhava 15 e as outras 15 sumiam da tela — sem aviso, e
     * sem forma de chegar nelas para vender ou desmontar. O jogador via
     * "30 / 15" no contador e metade do inventário inalcançável.
     *
     * Passar da capacidade não deveria acontecer pelo caminho normal: a coleta
     * recusa o que não cabe. Mas `adotar`, em `app/inventario.ts`, substitui a
     * mochila inteira pelo que o SERVIDOR diz, e não consulta capacidade
     * nenhuma — basta o servidor ter mais peças que a carga atual do save.
     *
     * Mostrar tudo é a saída segura: excesso vira um estado VISÍVEL, que o
     * jogador resolve descartando. Esconder transforma o mesmo excesso em perda
     * silenciosa, que é o que aconteceu.
     */
    const cells: HTMLElement[] = items.map((item) => this.cell(sim, item));
    // Preenche o resto com espaços vazios para a grade nunca "desmontar".
    while (cells.length < capacidade) cells.push(h('.inv-cell.vazio'));

    return h('.panel-body.inv-body', {},
      h('.inv-console', {},
        h('.inv-console-head', {},
          h('span.inv-signal', { 'aria-hidden': 'true' }),
          h('span', { text: 'TRIAGEM DE CARGA' }),
          // Quando um filtro esconde peça, o contador DIZ quanto escondeu.
          // Sem isso, "26 VISÍVEIS" ao lado de "70 / 70" parecia defeito — e
          // era só o seletor de elemento em "Padrão", que é um elemento e não
          // "sem filtro". O jogador não relacionava os dois números.
          h('strong', {
            text: items.length === sim.state.inventory.length
              ? `${items.length} VISÍVEIS`
              : `${items.length} DE ${sim.state.inventory.length} · FILTRADO`,
          }),
        ),
        h('.toolbar.inv-rarity-toolbar', {},
          h('.filters', {},
            this.chip(sim, -1, 'Tudo', '#9fb0c4'),
            ...RARITIES.map((r) => this.chip(sim, r.id, r.name, r.color)),
          ),
        ),
        h('.toolbar.inv-control-toolbar', {},
          h('select.select', {
            onchange: (e: Event) => { this.sort = (e.target as HTMLSelectElement).value as typeof this.sort; sim.touch(); },
          },
            h('option', { value: 'recentes', text: 'Mais recentes', selected: this.sort === 'recentes' }),
            h('option', { value: 'poder', text: 'Ganho de poder', selected: this.sort === 'poder' }),
            h('option', { value: 'raridade', text: 'Raridade', selected: this.sort === 'raridade' }),
            h('option', { value: 'slot', text: 'Slot', selected: this.sort === 'slot' }),
            h('option', { value: 'nivel', text: 'Nível de item', selected: this.sort === 'nivel' }),
            h('option', { value: 'tier', text: 'Melhor tier', selected: this.sort === 'tier' }),
          ),

          /**
           * Filtro por SLOT, o primeiro dos dois seletores de filtro.
           *
           * Vem antes do de elemento porque é a pergunta mais frequente: "o que
           * tenho para este soquete" se faz toda vez que uma peça cai, e "o que
           * tenho de fogo" só quando se monta um conjunto elemental.
           *
           * Usa o nome CURTO (`short`). O longo — "Asas / Estrutura",
           * "Sistemas de Controle" — estoura a largura do seletor no trilho de
           * 378px, e o nome inteiro já está no cartão de cada peça.
           */
          h('select.select', {
            onchange: (e: Event) => {
              this.slot = (e.target as HTMLSelectElement).value as SlotId | 'todos';
              sim.touch();
            },
          },
            h('option', { value: 'todos', text: 'Todas as peças', selected: this.slot === 'todos' }),
            ...SLOTS.map((sl) => h('option', {
              value: sl.id, text: sl.short, selected: this.slot === sl.id,
            })),
          ),

          // Filtro por elemento, ao lado da ordenação e não junto das raridades:
          // são dois eixos independentes, e empilhar tudo numa fileira de chips
          // faria vinte botões numa barra de 378px.
          h('select.select', {
            onchange: (e: Event) => {
              this.elemento = (e.target as HTMLSelectElement).value as ElementId | 'todos';
              sim.touch();
            },
          },
            h('option', { value: 'todos', text: 'Todos os elementos', selected: this.elemento === 'todos' }),
            ...ELEMENTS.map((el) => h('option', {
              value: el.id, text: el.name, selected: this.elemento === el.id,
            })),
          ),

          h(`button.mini${this.soFavoritos ? '.ativa' : ''}`, {
            text: this.soFavoritos ? '★ Favoritos' : '☆ Favoritos',
            title: 'Mostra só o que está marcado. Com 15 espaços no começo, marcar é o que protege uma peça do desmanche automático.',
            onclick: () => { this.soFavoritos = !this.soFavoritos; sim.touch(); },
          }),
          h('span.inv-capacity', {},
            h('span.muted.tiny', { text: 'OCUPAÇÃO' }),
            h('strong.tiny', { text: `${sim.state.inventory.length} / ${sim.cargoSlots}` }),
          ),
        ),
        this.automacao(sim),
      ),

      this.botaoSelecionarTodos(sim, items),
      // Fora de `.inv-wrap`: o rack usa `clip-path`, que cria um contexto de
      // empilhamento próprio e prendia a ficha atrás da barra de ações.
      this.tip,
      h('.inv-wrap', {},
        grade(colunasDaGrade(capacidade), cells)),
      this.barraDeLote(sim, lote),
    );
  }

  private sorted(sim: Sim): Item[] {
    const list = sim.state.inventory.filter((i) =>
      (this.filter < 0 || i.rarity === this.filter)
      && (this.elemento === 'todos' || (i.element ?? 'padrao') === this.elemento)
      && (this.slot === 'todos' || i.slot === this.slot)
      && (!this.soFavoritos || i.favorite));

    switch (this.sort) {
      case 'recentes':
        return ordemDeChegada(sim.state.inventory, list);
      case 'raridade':
        return list.sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
      case 'slot':
        return list.sort((a, b) => a.slot.localeCompare(b.slot) || b.rarity - a.rarity);
      case 'nivel':
        return list.sort((a, b) => b.ilvl - a.ilvl || b.rarity - a.rarity);
      case 'tier':
        // Pelo MELHOR tier da peça, não pela média: uma linha T10 é o que faz
        // um item valer a pena guardar, e a média a diluiria entre as outras.
        return list.sort((a, b) => melhorTier(b) - melhorTier(a) || b.rarity - a.rarity);
      default:
        return list.sort((a, b) => scoreItem(sim.state, b) - scoreItem(sim.state, a));
    }
  }

  private chip(sim: Sim, rarity: Rarity | -1, label: string, color: string): HTMLElement {
    const active = this.filter === rarity;
    return h(`button.chip${active ? '.active' : ''}`, {
      text: label,
      style: { color, borderColor: active ? color : 'transparent' },
      onclick: () => { this.filter = rarity; sim.touch(); },
    });
  }

  private cell(sim: Sim, item: Item): HTMLElement {
    const info = rarityInfo(item.rarity);
    const gain = scoreItem(sim.state, item);

    // Com uma carga de serviço ativa, a grade vira SELETOR. A peça que já está
    // no elemento de destino fica apagada: gastar a carga para não mudar nada
    // é o erro óbvio, e recusar depois de consumir seria pior que não deixar
    // clicar.
    // `mirandoAlvo` e não `selecaoPendente`: na fase 1 o jogador ainda está
    // escolhendo o elemento na faixa, e a grade não deve piscar antes de haver
    // um destino — piscar sem alvo definido ensinaria o gesto errado.
    const mira = mirandoAlvo();
    const alvoValido = !!mira && (item.element ?? 'padrao') !== mira.elemento;

    const selecionado = itemArrastado()?.uid === item.uid;
    const marcado = this.selecionados.has(item.uid);
    const cell = h(`.inv-cell${mira ? (alvoValido ? '.mirado' : '.fora-de-mira') : ''}${selecionado ? '.selecionado' : ''}${marcado ? '.marcado' : ''}${classeDeExclusivo(item)}`, {
      style: { borderColor: info.color, boxShadow: `inset 0 0 16px ${info.glow}` },
      role: 'option', tabindex: 0, 'aria-selected': String(marcado),
      'aria-disabled': String(item.favorite),
    }, spriteIcon(item.icon, 40));

    // Elemento no canto inferior esquerdo: numa grade de setenta ícones, é o
    // que permite achar "o canhão de gelo" sem passar o mouse em cada célula.
    if (item.element && item.element !== 'padrao') {
      // Ícone e não sigla. A letra exigia LER, e ler não acontece numa grade de
      // setenta células que o jogador varre em um segundo — além de "F" de fogo
      // e "G" de gelo serem parecidas em tamanho pequeno, enquanto uma chama e
      // um floco não se confundem nunca.
      cell.append(h('i.pip.elem', { title: `Elemento ${getElement(item.element).name.toLowerCase()}` },
        iconeDeElemento(item.element, 14),
      ));
    }

    // Marcadores de canto: melhoria, conjunto e favorito, legíveis sem hover.
    if (gain > 0) cell.append(h('i.pip.up', { title: 'Melhora a nave' }));
    if (item.set) cell.append(h('i.pip.set'));
    if (item.favorite) cell.append(h('i.pip.fav', { text: '★' }));

    // Arrastar continua sendo o gesto de equipar. O clique agora marca a peça
    // para a barra em lote: o amarelo na célula substitui qualquer checkbox.
    cell.setAttribute('draggable', 'true');
    cell.addEventListener('dragstart', (e) => {
      iniciarArraste(item);
      e.dataTransfer?.setData('text/plain', item.uid);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      this.tip.classList.add('hidden');
    });
    cell.addEventListener('dragend', () => encerrarArraste());

    cell.addEventListener('mouseenter', () => this.showTip(sim, item, cell, gain));
    cell.addEventListener('mouseleave', () => this.tip.classList.add('hidden'));
    cell.addEventListener('click', (e) => {
      // Modo de seleção intercepta TUDO: enquanto a carga está ativa, clicar
      // não equipa nem vende. Uma grade que faz duas coisas diferentes conforme
      // um estado invisível seria a forma mais rápida de queimar uma carga sem
      // querer.
      if (mira) {
        e.preventDefault();
        if (!alvoValido) {
          toast('Esta peça já está nesse elemento', 'bad');
          return;
        }
        if (sim.usarCargaNoItem(mira.servico, item.uid, mira.elemento)) {
          toast(`Convertida para ${getElement(mira.elemento).name.toLowerCase()}`, 'good');
          encerrarSelecao();
          sim.touch();
        }
        return;
      }
      if (e.altKey) {
        e.preventDefault();
        this.cancelarCliquePendente();
        this.selecionados.clear();
        this.selecionados.add(item.uid);
        this.confirmarVenda(sim);
      } else if (e.shiftKey) {
        this.cancelarCliquePendente();
        this.selecionados.clear();
        this.selecionados.add(item.uid);
        this.confirmarDesmonte(sim);
      } else {
        this.tratarClique(sim, item, cell, gain);
      }
    });
    cell.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.alternarMarcacao(sim, item);
    });
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      sim.toggleFavorite(item.uid);
      sim.touch();
    });
    return cell;
  }

  private showTip(sim: Sim, item: Item, cell: HTMLElement, gain: number): void {
    this.tip.replaceChildren(
      buildItemCard(sim, item),
      h('.tip-power', {},
        h('span.muted.tiny', { text: 'ganho de poder' }),
        h('strong.tiny', {
          text: gain > 0 ? `+${fmt(gain, 1)}` : fmt(gain, 1),
          style: { color: gain > 0 ? '#7ed957' : '#7f93b3' },
        }),
      ),
    );

    // Ancora o cartão à célula, mantendo-o dentro do painel.
    const body = cell.closest('.inv-body') as HTMLElement | null;
    if (!body) return;
    const box = body.getBoundingClientRect();
    const spot = cell.getBoundingClientRect();
    this.tip.classList.remove('hidden');
    const tipH = this.tip.offsetHeight || 200;
    const tipW = this.tip.offsetWidth || 252;
    this.tip.style.left = `${clamp(spot.left - box.left + spot.width + 8, 0, Math.max(0, box.width - tipW))}px`;
    this.tip.style.top = `${clamp(spot.top - box.top - 10, 0, Math.max(0, box.height - tipH))}px`;
  }

  private itensSelecionados(sim: Sim): Item[] {
    const porId = new Map(sim.state.inventory.map((item) => [item.uid, item]));
    for (const uid of this.selecionados) {
      const item = porId.get(uid);
      if (!item || item.favorite) this.selecionados.delete(uid);
    }
    return [...this.selecionados].map((uid) => porId.get(uid)!).filter(Boolean);
  }

  private tratarClique(sim: Sim, item: Item, cell: HTMLElement, gain: number): void {
    const anterior = this.cliquePendente;
    if (anterior?.uid === item.uid) {
      window.clearTimeout(anterior.timer);
      this.cliquePendente = null;
      this.equipar(sim, item);
      return;
    }

    // Se o primeiro clique foi em outra peça, ele é uma seleção legítima e não
    // deve desaparecer só porque o jogador clicou rapidamente na vizinha.
    if (anterior) {
      window.clearTimeout(anterior.timer);
      anterior.executar();
    }

    this.showTip(sim, item, cell, gain);
    const executar = () => {
      if (this.cliquePendente?.uid === item.uid) this.cliquePendente = null;
      this.alternarMarcacao(sim, item);
    };
    this.cliquePendente = {
      uid: item.uid,
      timer: window.setTimeout(executar, 300),
      executar,
    };
  }

  private cancelarCliquePendente(): void {
    if (!this.cliquePendente) return;
    window.clearTimeout(this.cliquePendente.timer);
    this.cliquePendente = null;
  }

  private equipar(sim: Sim, item: Item): void {
    this.cancelarCliquePendente();
    const casco = cascoEmMontagem() || sim.state.hull;
    if (!sim.equip(item.uid, casco)) {
      toast('Esta nave não aceita peça deste elemento', 'bad');
      return;
    }
    this.selecionados.delete(item.uid);
    this.tip.classList.add('hidden');
    sim.touch();
  }

  private alternarMarcacao(sim: Sim, item: Item): void {
    if (item.favorite) {
      toast('Item favorito: desmarque antes de selecionar.', 'bad');
      return;
    }
    if (this.selecionados.has(item.uid)) {
      this.selecionados.delete(item.uid);
      if (itemArrastado()?.uid === item.uid) encerrarArraste();
    } else {
      this.selecionados.add(item.uid);
    }
    sim.touch();
  }

  private botaoSelecionarTodos(sim: Sim, visiveis: Item[]): HTMLElement {
    const selecionaveis = visiveis.filter((item) => !item.favorite);
    const todosVisiveisSelecionados = selecionaveis.length > 0
      && selecionaveis.every((item) => this.selecionados.has(item.uid));
    return h('.inv-selecao-filtro', {},
      h('button.inv-selecionar-todos', {
        type: 'button',
        disabled: selecionaveis.length === 0,
        text: todosVisiveisSelecionados
          ? 'DESMARCAR TODOS'
          : `SELECIONAR TODOS (${selecionaveis.length})`,
        title: 'Seleciona somente os itens exibidos pelos filtros atuais. Itens favoritos permanecem protegidos.',
        onclick: () => this.alternarTodosVisiveis(sim, selecionaveis, todosVisiveisSelecionados),
      }),
    );
  }

  /**
   * O descarte automático, na tela onde a decisão acontece.
   *
   * Os dois controles já existiam — em **Configurações**, três telas longe da
   * carga que eles esvaziam. Pedido do Rafael em 12/09/2026: eles moram aqui.
   *
   * Não é duplicata: os dois lugares escrevem o MESMO `settings`, e o de
   * Configurações continua valendo para quem for procurar lá. Um segundo estado
   * é que seria duplicata.
   *
   * ## Tudo aqui é VIP, e a tela DIZ isso
   *
   * Desmontar e vender automaticamente são benefício do Passe desde
   * 12/09/2026. Sem passe, os controles ficam desabilitados e explicam o
   * motivo ao passar o mouse — e não escondidos: automação que some sem
   * explicação parece defeito, e a que se vê bloqueada é a que faz alguém
   * querer o passe.
   */
  private automacao(sim: Sim): HTMLElement {
    const s = sim.state.settings;
    const vip = sim.vipAtivo;
    const vendendo = vip && s.autoDispose === 'vender';

    const AVISO_VIP = 'Somente Passe VIP pode acionar o descarte automático.';

    /**
     * UM alternador, e não dois botões.
     *
     * Dois botões gastavam a largura de duas palavras para dizer uma escolha
     * entre duas — e numa barra de 378px essa largura é o recurso escasso. O
     * alternador ocupa o espaço de um, mostra os dois rótulos e diz qual vale
     * pela posição: esquerda desmonta, direita vende.
     *
     * É um `button` e não dois `radio`: a escolha tem exatamente duas opções e
     * nenhuma delas é "nada", então clicar TROCA — não há estado a escolher,
     * só um lado para o qual ir. O nome acessível carrega o valor atual, que é
     * o que o leitor de tela precisa e a posição não conta.
     */
    const alternador = h(
      `button.inv-destino-switch${vendendo ? '.vender' : ''}${vip ? '' : '.bloqueada'}`,
      {
        type: 'button',
        disabled: !vip,
        title: vip
          ? `Peça abaixo do corte vira ${vendendo ? 'sucata na hora' : 'material de fabricação'}. Clique para alternar.`
          : AVISO_VIP,
        'aria-label': `Destino do descarte: ${vendendo ? 'Vender' : 'Desmontar'}. Clique para alternar.`,
        onclick: () => {
          if (!vip) return;
          s.autoDispose = vendendo ? 'desmontar' : 'vender';
          sim.touch();
        },
      },
      h('span', { text: 'Desmontar' }),
      h('span', { text: 'Vender' }),
    );

    return h(`.toolbar.inv-auto-toolbar${vip ? '' : '.bloqueada'}`, {
      // O `title` no bloco inteiro, e não só nos controles: o ponteiro passa
      // pelo rótulo antes de chegar no seletor, e é ali que a pergunta nasce.
      ...(vip ? {} : { title: AVISO_VIP }),
    },
      h('span.muted.tiny', { text: vip ? 'DESCARTE AUTOMÁTICO' : 'DESCARTE AUTOMÁTICO · VIP' }),
      h('select.select', {
        'aria-label': 'Descartar peças abaixo desta raridade',
        title: vip
          ? 'Peça que cair abaixo deste corte não chega a ocupar espaço na carga. Favoritos nunca entram.'
          : AVISO_VIP,
        disabled: !vip,
        onchange: (e: Event) => {
          s.autoSalvage = Number((e.target as HTMLSelectElement).value) as Rarity;
          sim.touch();
        },
      },
        h('option', { value: '0', text: 'Desligado', selected: s.autoSalvage === 0 }),
        ...RARITIES.slice(1).map((r) => h('option', {
          value: String(r.id), text: `Abaixo de ${r.name}`, selected: s.autoSalvage === r.id,
        })),
      ),
      alternador,
    );
  }

  private barraDeLote(sim: Sim, lote: Item[]): HTMLElement {
    const quantidade = lote.length;
    return h('.inv-lote-bar', { 'aria-label': 'Ações dos itens selecionados' },
      h('.inv-lote-status', {},
        quantidade
          ? h('strong', { text: `${quantidade} ${quantidade === 1 ? 'ITEM SELECIONADO' : 'ITENS SELECIONADOS'}` })
          : null,
      ),
      h('.inv-lote-acoes', {},
        h('button.inv-lote-acao.vender', {
          type: 'button', disabled: quantidade === 0,
          onclick: () => this.confirmarVenda(sim),
        }, spriteIcon('ui/icon_coin', 18), h('span', { text: `VENDER${quantidade ? ` (${quantidade})` : ''}` })),
        h('button.inv-lote-acao.desmontar', {
          type: 'button', disabled: quantidade === 0,
          onclick: () => this.confirmarDesmonte(sim),
        }, spriteIcon('recurso/ferrita', 18), h('span', { text: `DESMONTAR${quantidade ? ` (${quantidade})` : ''}` })),
      ),
    );
  }

  /**
   * Seleção em lote é um retrato do filtro atual, não uma soma invisível de
   * filtros usados antes. Limpar primeiro evita vender, sem perceber, uma peça
   * que ficou marcada e depois desapareceu da grade ao trocar o filtro.
   */
  private alternarTodosVisiveis(sim: Sim, visiveis: Item[], desmarcar: boolean): void {
    this.cancelarCliquePendente();
    this.selecionados.clear();
    if (!desmarcar) {
      for (const item of visiveis) this.selecionados.add(item.uid);
    }
    this.tip.classList.add('hidden');
    sim.touch();
  }

  private confirmarVenda(sim: Sim): void {
    const lote = this.itensSelecionados(sim);
    if (!lote.length) return;
    const totalPrevisto = lote.reduce((soma, item) => soma + valorDeVenda(item), 0);
    const rotulo = `${lote.length} ${lote.length === 1 ? 'item' : 'itens'}`;
    this.abrirConfirmacao({
      tipo: 'vender',
      titulo: 'CONFIRMAR VENDA',
      resumo: `Vender ${rotulo}?`,
      retorno: `Você receberá ${fmt(totalPrevisto)} de sucata.`,
      confirmar: 'VENDER AGORA',
      icone: 'ui/icon_coin',
      aoConfirmar: () => {
        let vendidos = 0;
        let total = 0;
        for (const item of lote) {
          const valor = sim.sell(item.uid);
          if (valor <= 0) continue;
          vendidos++;
          total += valor;
        }
        this.concluirLote(sim, lote);
        toast(`${vendidos} ${vendidos === 1 ? 'item vendido' : 'itens vendidos'} · +${fmt(total)} sucata`, 'good', 'ui/icon_coin');
      },
    });
  }

  private confirmarDesmonte(sim: Sim): void {
    const lote = this.itensSelecionados(sim);
    if (!lote.length) return;
    const previstos: Record<string, number> = {};
    for (const item of lote) {
      for (const [id, n] of Object.entries(retornoDeDesmanche(item).materiais)) {
        previstos[id] = (previstos[id] ?? 0) + n;
      }
    }
    const rotulo = `${lote.length} ${lote.length === 1 ? 'item' : 'itens'}`;
    this.abrirConfirmacao({
      tipo: 'desmontar',
      titulo: 'CONFIRMAR DESMONTAGEM',
      resumo: `Desmontar ${rotulo}?`,
      retorno: `Materiais: ${resumoDeMateriais(previstos)}.`,
      confirmar: 'DESMONTAR AGORA',
      icone: 'recurso/ferrita',
      aoConfirmar: () => {
        const recebidos: Record<string, number> = {};
        let desmontados = 0;
        for (const item of lote) {
          const retorno = sim.salvage(item.uid);
          if (!retorno) continue;
          desmontados++;
          for (const [id, n] of Object.entries(retorno.materiais)) recebidos[id] = (recebidos[id] ?? 0) + n;
        }
        this.concluirLote(sim, lote);
        toast(`${desmontados} ${desmontados === 1 ? 'item desmontado' : 'itens desmontados'} · ${resumoDeMateriais(recebidos)}`, 'good', 'recurso/ferrita');
      },
    });
  }

  private abrirConfirmacao(opcoes: {
    tipo: 'vender' | 'desmontar';
    titulo: string;
    resumo: string;
    retorno: string;
    confirmar: string;
    icone: string;
    aoConfirmar: () => void;
  }): void {
    this.confirmacao?.remove();
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let camada!: HTMLElement;

    const fechar = (): void => {
      camada.remove();
      if (this.confirmacao === camada) this.confirmacao = null;
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
    const cancelar = h('button.inv-confirmacao-cancelar', {
      type: 'button', text: 'CANCELAR', onclick: fechar,
    }) as HTMLButtonElement;
    const confirmar = h(`button.inv-confirmacao-confirmar.${opcoes.tipo}`, {
      type: 'button',
      text: opcoes.confirmar,
      onclick: () => {
        fechar();
        opcoes.aoConfirmar();
      },
    }) as HTMLButtonElement;
    const cartao = h(`section.inv-confirmacao-cartao.${opcoes.tipo}`, {
      role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'inv-confirmacao-titulo',
    },
      h('.inv-confirmacao-topo', {},
        h('.inv-confirmacao-icone', {}, spriteIcon(opcoes.icone, 32)),
        h('.inv-confirmacao-titulos', {},
          h('span', { text: 'PROTOCOLO DE DESCARTE' }),
          h('h2#inv-confirmacao-titulo', { text: opcoes.titulo }),
        ),
      ),
      h('.inv-confirmacao-resumo', {},
        h('strong', { text: opcoes.resumo }),
        h('span', { text: opcoes.retorno }),
      ),
      h('.inv-confirmacao-alerta', {},
        h('i', { text: '!' }),
        h('span', { text: 'Esta ação não pode ser desfeita.' }),
      ),
      h('.inv-confirmacao-acoes', {}, cancelar, confirmar),
    );

    camada = h('.inv-confirmacao-camada', {
      tabindex: -1,
      onclick: (e: Event) => { if (e.target === camada) fechar(); },
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          fechar();
          return;
        }
        if (e.key !== 'Tab') return;
        const botoes = [cancelar, confirmar];
        const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        botoes[(atual + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length]!.focus();
      },
    }, cartao);
    this.confirmacao = camada;
    document.body.append(camada);
    requestAnimationFrame(() => confirmar.focus());
  }

  private concluirLote(sim: Sim, lote: Item[]): void {
    const removidos = new Set(lote.map((item) => item.uid));
    if (itemArrastado() && removidos.has(itemArrastado()!.uid)) encerrarArraste();
    this.selecionados.clear();
    this.tip.classList.add('hidden');
    sim.touch();
  }
}
