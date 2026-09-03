import { toast } from '@app/Bus';
import { iconeDeElemento } from '../elementos';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { RARITIES, rarityInfo } from '@data/rarity';
import { getElement } from '@data/elements';
import { colunasDaGrade } from '@data/balance/capacidade';
import { ELEMENTS } from '@data/elements';
import { RECURSO_POR_ID } from '@data/recursos';
import type { ElementId } from '@sim/types';

/** O tier mais alto entre as linhas da peça. Afixo de save antigo conta como T1. */
function melhorTier(item: Item): number {
  return item.affixes.reduce((m, a) => Math.max(m, a.tier ?? 1), 0);
}

import { scoreItem } from '@sim/loot';
import type { Item, Rarity } from '@sim/types';
import type { Sim } from '@sim/index';

/**
 * A grade, com as colunas vindas da capacidade.
 *
 * Vai por `setProperty` e não pelo objeto `style` do helper porque propriedade
 * CUSTOMIZADA não existe em `CSSStyleDeclaration` — o TypeScript recusa, e com
 * razão: `style['--x']` é ignorado silenciosamente em runtime.
 */
function grade(colunas: number, cells: HTMLElement[]): HTMLElement {
  const el = h('.inv-grid', {}, ...cells);
  el.style.setProperty('--inv-colunas', String(colunas));
  return el;
}

import { h, spriteIcon } from '../dom';
import { cascoEmMontagem, encerrarArraste, iniciarArraste } from '../montagem';
import { buildItemCard } from '../ItemCard';
import { encerrarSelecao, mirandoAlvo } from '../selecao';
import type { Panel } from './types';

function resumoDeMateriais(materiais: Readonly<Record<string, number>>): string {
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
  /** Só favoritos — o inventário nasce com 15 espaços, então marcar importa. */
  private soFavoritos = false;
  private sort: 'poder' | 'raridade' | 'slot' | 'tier' | 'nivel' = 'poder';
  private readonly tip = h('.inv-tip.hidden');

  badge(sim: Sim): number {
    return sim.state.inventory.length;
  }

  render(sim: Sim): HTMLElement {
    const items = this.sorted(sim);
    // A grade tem exatamente os espaços que o jogador LIBEROU (§28), não um
    // número fixo. Desenhar 70 células com capacidade 15 mostrava 55 espaços
    // que não existem — o oposto do que um inventário apertado deve comunicar.
    const capacidade = sim.cargoSlots;
    const cells: HTMLElement[] = items.slice(0, capacidade).map((item) => this.cell(sim, item));
    // Preenche o resto com espaços vazios para a grade nunca "desmontar".
    while (cells.length < capacidade) cells.push(h('.inv-cell.vazio'));

    return h('.panel-body.inv-body', {},
      h('.inv-console', {},
        h('.inv-console-head', {},
          h('span.inv-signal', { 'aria-hidden': 'true' }),
          h('span', { text: 'TRIAGEM DE CARGA' }),
          h('strong', { text: `${items.length} VISÍVEIS` }),
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
            h('option', { value: 'poder', text: 'Ganho de poder', selected: this.sort === 'poder' }),
            h('option', { value: 'raridade', text: 'Raridade', selected: this.sort === 'raridade' }),
            h('option', { value: 'slot', text: 'Slot', selected: this.sort === 'slot' }),
            h('option', { value: 'nivel', text: 'Nível de item', selected: this.sort === 'nivel' }),
            h('option', { value: 'tier', text: 'Melhor tier', selected: this.sort === 'tier' }),
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
          // Os botões de VENDER e DESMONTAR em lote saíram: vão voltar como
          // funcionalidade premium. A venda e o desmonte peça a peça continuam,
          // por Alt+clique e Shift+clique — o que saiu é fazer os dois de uma vez
          // na barra inteira, não a ação.
        ),
      ),

      h('p.muted.tiny.hint', { text: 'Clique equipa · Shift+clique desmonta · Alt+clique vende · botão direito favorita.' }),
      h('.inv-wrap', {},
        grade(colunasDaGrade(capacidade), cells),
        this.tip),
    );
  }

  private sorted(sim: Sim): Item[] {
    const list = sim.state.inventory.filter((i) =>
      (this.filter < 0 || i.rarity === this.filter)
      && (this.elemento === 'todos' || (i.element ?? 'padrao') === this.elemento)
      && (!this.soFavoritos || i.favorite));

    switch (this.sort) {
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

    const cell = h(`.inv-cell${mira ? (alvoValido ? '.mirado' : '.fora-de-mira') : ''}`, {
      style: { borderColor: info.color, boxShadow: `inset 0 0 16px ${info.glow}` },
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

    // Arrastável para os soquetes da Anatomia. O clique continua existindo e
    // faz a mesma coisa — arrastar é o gesto que DIZ para onde vai, e é o que
    // faltava para montar uma nave guardada sem adivinhar.
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
        const valor = sim.sell(item.uid);
        if (valor > 0) toast(`Vendido · +${fmt(valor)} sucata`, 'good', 'ui/icon_coin');
        else toast('Item favorito: desmarque antes de vender.', 'bad');
      } else if (e.shiftKey) {
        const retorno = sim.salvage(item.uid);
        if (retorno) toast(`Desmontado · ${resumoDeMateriais(retorno.materiais)}`, 'good', 'recurso/ferrita');
        else toast(item.favorite
          ? 'Item favorito: desmarque antes de desmontar.'
          : 'Sem espaço para os novos materiais no Armazém.', 'bad');
      } else {
        // Na nave que a Anatomia está mostrando, não na que está voando.
        // Eram sempre a mesma até a coluna ganhar seletor; desde então o
        // jogador podia montar uma nave guardada e ver a peça ir para outra.
        const casco = cascoEmMontagem() || sim.state.hull;
        if (!sim.equip(item.uid, casco)) {
          toast('Esta nave não aceita peça deste elemento', 'bad');
        }
      }
      this.tip.classList.add('hidden');
      sim.touch();
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
    const wrap = cell.closest('.inv-wrap') as HTMLElement | null;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const spot = cell.getBoundingClientRect();
    this.tip.classList.remove('hidden');
    const tipH = this.tip.offsetHeight || 200;
    this.tip.style.left = `${clamp(spot.left - box.left + spot.width + 8, 0, Math.max(0, box.width - 236))}px`;
    this.tip.style.top = `${clamp(spot.top - box.top - 10, 0, Math.max(0, box.height - tipH))}px`;
  }
}
