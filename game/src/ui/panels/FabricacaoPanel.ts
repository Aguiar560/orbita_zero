import { fmt } from '@core/format';
import { RECEITAS, type ReceitaDeFusao } from '@data/balance/fusao';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { rarityInfo } from '@data/rarity';
import type { Sim } from '@sim/index';
import type { Item, Rarity } from '@sim/types';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * Fabricação — o reator de síntese (§25, §26).
 *
 * Era uma lista de seis cartões, e uma lista não comunica o que a mecânica é:
 * peças entram, convergem, e sai uma. O painel agora É a máquina — um núcleo
 * com as peças de entrada num ANEL em volta, a chance como arco fechando esse
 * anel, e o resultado no centro.
 *
 * A escolha do que fabricar virou uma ESCADA à esquerda, uma etapa por
 * raridade, em vez de seis blocos empilhados. É a mesma informação ocupando o
 * eixo que ela já tem — a raridade é uma progressão, e uma escada mostra isso;
 * cartões lado a lado, não.
 *
 * Tudo é SVG e CSS. Um canvas daria mais liberdade e custaria um laço de
 * animação próprio, sincronia com o passo fixo do jogo e um caminho de
 * descarte — para um painel que fica parado a maior parte do tempo.
 */
export class FabricacaoPanel implements Panel {
  id = 'fabricacao';
  title = 'Fabricação';
  icon = 'cat/reator';

  /** Degrau selecionado. Começa no primeiro, que é o que todo jogador tem. */
  private selecionada: Rarity = 0;

  render(sim: Sim): HTMLElement {
    const receita = RECEITAS.find((r) => r.entrada === this.selecionada) ?? RECEITAS[0]!;
    const escolhidos = this.candidatos(sim, receita);
    const faltas = escolhidos.length === receita.quantidade
      ? sim.faltaParaFundir(escolhidos.map((i) => i.uid))
      : [`Faltam ${receita.quantidade - escolhidos.length} peças`];

    return h('.panel-body.fab', {},
      this.escada(sim),
      h('.fab-camara', {},
        this.nucleo(receita, escolhidos, faltas.length === 0),
        this.leitura(sim, receita, escolhidos, faltas),
      ),
    );
  }

  // ── a escada de degraus ───────────────────────────────────────────────────

  private escada(sim: Sim): HTMLElement {
    return h('.fab-escada', {},
      ...RECEITAS.map((r) => {
        const info = rarityInfo(r.entrada);
        const tem = sim.state.inventory.filter((i) => i.rarity === r.entrada && !i.favorite).length;
        const pronto = tem >= r.quantidade;
        const ativo = this.selecionada === r.entrada;

        return h(`button.fab-degrau${ativo ? '.ativo' : ''}${pronto ? '.pronto' : ''}`, {
          title: `${r.nome} — ${r.nota}`,
          style: { '--cor': info.color } as never,
          onclick: () => { this.selecionada = r.entrada; sim.touch(); },
        },
          h('span.fab-gema', { style: { background: info.color } }),
          h('.fab-degrau-txt', {},
            h('strong', { text: info.name }),
            // O número que decide se dá para fabricar fica na escada, não
            // escondido dentro da etapa: é ele que faz o jogador escolher.
            h('span.tiny', {
              text: `${tem}/${r.quantidade}`,
              style: { color: pronto ? 'var(--good)' : 'var(--muted)' },
            }),
          ),
        );
      }),
    );
  }

  // ── o núcleo ──────────────────────────────────────────────────────────────

  /**
   * O reator: anel de encaixes em volta de um núcleo hexagonal.
   *
   * O anel tem exatamente `quantidade` posições, e cada uma acende quando há
   * peça para ela. Assim "faltam três" é uma coisa que se VÊ, sem ler número.
   */
  private nucleo(receita: ReceitaDeFusao, escolhidos: Item[], pronto: boolean): HTMLElement {
    const entrada = rarityInfo(receita.entrada);
    const saida = rarityInfo(Math.max(...receita.resultados.map((x) => x.raridade)) as Rarity);

    const R = 92;
    const CENTRO = 110;
    const encaixes = Array.from({ length: receita.quantidade }, (_, i) => {
      const ang = (i / receita.quantidade) * Math.PI * 2 - Math.PI / 2;
      return {
        x: CENTRO + Math.cos(ang) * R,
        y: CENTRO + Math.sin(ang) * R,
        cheio: i < escolhidos.length,
      };
    });

    // Arco da chance: quanto do anel ele fecha é a probabilidade de sucesso.
    const perimetro = 2 * Math.PI * (R + 16);
    const arco = perimetro * receita.chance;

    const svg = `
      <svg viewBox="0 0 220 220" class="fab-svg">
        <circle cx="${CENTRO}" cy="${CENTRO}" r="${R + 16}" class="fab-trilho"/>
        <circle cx="${CENTRO}" cy="${CENTRO}" r="${R + 16}" class="fab-arco"
          stroke="${saida.color}"
          stroke-dasharray="${arco} ${perimetro}"
          transform="rotate(-90 ${CENTRO} ${CENTRO})"/>
        ${encaixes.map((e) => `
          <line x1="${e.x}" y1="${e.y}" x2="${CENTRO}" y2="${CENTRO}"
            class="fab-feixe ${e.cheio ? 'aceso' : ''}" stroke="${entrada.color}"/>`).join('')}
        ${encaixes.map((e) => `
          <circle cx="${e.x}" cy="${e.y}" r="9"
            class="fab-encaixe ${e.cheio ? 'cheio' : ''}"
            stroke="${entrada.color}" fill="${e.cheio ? entrada.color : 'transparent'}"/>`).join('')}
        <polygon class="fab-hex ${pronto ? 'pronto' : ''}" stroke="${saida.color}"
          points="${hexagono(CENTRO, CENTRO, 46)}"/>
      </svg>`;

    const camara = h('.fab-nucleo');
    camara.innerHTML = svg;
    camara.append(
      h('.fab-saida', {},
        h('span.fab-saida-nome', { text: saida.name, style: { color: saida.color } }),
        h('span.tiny.muted', { text: `${Math.round(receita.chance * 100)}%` }),
      ),
    );
    return camara;
  }

  // ── leitura e ação ────────────────────────────────────────────────────────

  private leitura(sim: Sim, receita: ReceitaDeFusao, escolhidos: Item[], faltas: string[]): HTMLElement {
    const pode = faltas.length === 0;
    return h('.fab-leitura', {},
      h('h3.fab-nome', { text: receita.nome }),
      h('span.muted.tiny', { text: receita.nota }),

      h('.fab-custo', {},
        h('span.fab-item', {}, h('span.tiny', { text: `${fmt(receita.nucleos)} núcleos` })),
        ...Object.entries(receita.custo).map(([id, n]) => {
          const rec = RECURSO_POR_ID.get(id);
          const tem = sim.state.armazem[id] ?? 0;
          return h('span.fab-item', { title: rec?.nome ?? id },
            rec ? spriteIcon(iconeDeRecurso(rec), 24) : h('span'),
            h('span.tiny', {
              text: `${fmt(tem)}/${fmt(n)}`,
              style: { color: tem >= n ? 'var(--text)' : 'var(--bad)' },
            }),
          );
        }),
      ),

      h(`button.fab-acao${pode ? '.pronta' : ''}`, {
        text: pode ? 'SINTETIZAR' : (faltas[0] ?? 'Indisponível'),
        disabled: !pode,
        onclick: () => { if (pode) sim.fundirItens(escolhidos.map((i) => i.uid)); },
      }),

      h('span.muted.tiny', {
        text: 'Falhar consome as peças — o custo é da tentativa, não do sucesso.',
      }),
    );
  }

  /** As piores peças elegíveis. Favorito e equipado nunca entram. */
  private candidatos(sim: Sim, receita: ReceitaDeFusao): Item[] {
    return sim.state.inventory
      .filter((i) => i.rarity === receita.entrada && !i.favorite)
      .sort((a, b) => a.ilvl - b.ilvl)
      .slice(0, receita.quantidade);
  }
}

/** Pontos de um hexágono apontando para cima. */
function hexagono(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
}
