import { fmt } from '@core/format';
import { rarityInfo } from '@data/rarity';
import { FAMILIAS_ORDENADAS, FAMILIA_LABEL, RECURSOS, iconeDeRecurso } from '@data/recursos';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
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
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  /** Esconde o que ainda não foi encontrado — para quem já conhece o catálogo. */
  private soPossuidos = false;

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

      return h('.armazem-grupo', {},
        h('h3.section', { text: FAMILIA_LABEL[cat] }),
        ...linhas.map((m) => {
          const n = armazem[m.id] ?? 0;
          const cor = rarityInfo(m.raridade).color;
          return h(`.armazem-linha${n > 0 ? '' : '.vazia'}`, { title: m.origens.join(', ') },
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
              h('span.muted.tiny', { text: m.origens.join(' · ') }),
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
      ...grupos,
    );
  }

  badge(sim: Sim): number {
    // O marcador avisa que o depósito está no limite, não quantos materiais há:
    // acumular material não é problema, deixar de recolher um tipo novo é.
    return sim.materiaisGuardados >= sim.resourceSlots ? 1 : 0;
  }
}
