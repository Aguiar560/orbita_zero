import { fmt } from '@core/format';
import { RECEITAS } from '@data/balance/fusao';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { rarityInfo } from '@data/rarity';
import type { Sim } from '@sim/index';
import type { Item } from '@sim/types';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * Fabricação — sacrifício e fusão de itens (§25, §26).
 *
 * A seleção é AUTOMÁTICA, e é a decisão de interface que define o painel. Num
 * jogo ocioso, "fundir dez Comuns" tem de ser um clique: obrigar a marcar dez
 * peças uma a uma transformaria a mecânica que existe para limpar o inventário
 * numa tarefa mais tediosa que limpar o inventário à mão.
 *
 * O painel escolhe as PIORES peças elegíveis — menor nível de item primeiro —,
 * porque quem funde está se desfazendo de lixo. Favorito e equipado nunca
 * entram.
 */
export class FabricacaoPanel implements Panel {
  id = 'fabricacao';
  title = 'Fabricação';
  icon = 'cat/reator';

  render(sim: Sim): HTMLElement {
    return h('.panel-body', {},
      h('p.muted.tiny', {
        text: 'Converte peças que não servem em uma tentativa de peça melhor. '
          + 'Falhar consome os itens — o custo é da tentativa, não do sucesso.',
      }),
      ...RECEITAS.map((r) => this.receita(sim, r)),
    );
  }

  /**
   * As peças que a receita consumiria: as de menor nível primeiro.
   *
   * Equipado fica de fora porque não está no inventário; favorito, porque a
   * marca existe para proteger de perda — e fundir é destrutivo.
   */
  private candidatos(sim: Sim, raridade: number, quantos: number): Item[] {
    return sim.state.inventory
      .filter((i) => i.rarity === raridade && !i.favorite)
      .sort((a, b) => a.ilvl - b.ilvl)
      .slice(0, quantos);
  }

  private receita(sim: Sim, r: typeof RECEITAS[number]): HTMLElement {
    const info = rarityInfo(r.entrada);
    const saida = rarityInfo(Math.max(...r.resultados.map((x) => x.raridade)) as 0);
    const escolhidos = this.candidatos(sim, r.entrada, r.quantidade);
    const faltas = escolhidos.length === r.quantidade
      ? sim.faltaParaFundir(escolhidos.map((i) => i.uid))
      : [`${escolhidos.length} de ${r.quantidade} ${info.name}`];
    const pode = faltas.length === 0;

    return h('.fab-receita', { style: { borderColor: pode ? saida.color : 'var(--line)' } },
      h('.fab-cabeca', {},
        h('strong', { text: r.nome }),
        h('span.tiny', {
          text: `${Math.round(r.chance * 100)}% de sucesso`,
          style: { color: r.chance >= 0.5 ? 'var(--good)' : 'var(--accent-2)' },
        }),
      ),
      h('.fab-fluxo', {},
        h('span', { text: `${r.quantidade}× ${info.name}`, style: { color: info.color } }),
        h('span.muted', { text: '→' }),
        h('span', { text: saida.name, style: { color: saida.color } }),
      ),

      // O custo aparece com o ÍCONE do recurso: no Armazém eles são
      // reconhecidos pelo desenho, e repetir o desenho aqui evita o jogador ter
      // de traduzir um nome de volta para a coisa que ele viu cair.
      h('.fab-custo', {},
        h('span.tiny.muted', { text: `${fmt(r.nucleos)} núcleos` }),
        ...Object.entries(r.custo).map(([id, n]) => {
          const rec = RECURSO_POR_ID.get(id);
          const tem = sim.state.armazem[id] ?? 0;
          return h('span.fab-item', { title: rec?.nome ?? id },
            rec ? spriteIcon(iconeDeRecurso(rec), 22) : h('span'),
            h('span.tiny', {
              text: `${fmt(tem)}/${fmt(n)}`,
              style: { color: tem >= n ? 'var(--text)' : 'var(--bad)' },
            }),
          );
        }),
      ),

      h('button.btn', {
        text: pode ? `Fabricar · ${r.quantidade} peças` : (faltas[0] ?? 'Indisponível'),
        disabled: !pode,
        onclick: () => {
          if (!pode) return;
          sim.fundirItens(escolhidos.map((i) => i.uid));
        },
      }),
      h('span.muted.tiny', { text: r.nota }),
    );
  }
}
