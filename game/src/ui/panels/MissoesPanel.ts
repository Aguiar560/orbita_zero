import { fmt } from '@core/format';
import { CATEGORIA_LABEL, RITMO_LABEL, type CategoriaDeMissao, type MissaoDef } from '@data/missoes';
import { CONCESSAO_POR_ID } from '@data/balance/capacidade';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { rarityInfo } from '@data/rarity';
import { progressoDe } from '@sim/missoes';
import type { Sim } from '@sim/index';
import { h, spriteIcon, progressBar } from '../dom';
import type { Panel } from './types';

/**
 * Missões (§27).
 *
 * As prontas sobem para o topo — é a única situação em que o jogador tem algo a
 * fazer, e enterrar uma recompensa no meio de vinte missões em andamento é a
 * forma mais fácil de o jogador esquecer de resgatá-la.
 *
 * A ordenação e a situação vêm do `sim`: painel não decide regra de jogo. Aqui
 * só se decide o que mostrar.
 */
export class MissoesPanel implements Panel {
  id = 'missoes';
  title = 'Missões';
  // `aba/melhorias` ficou órfão quando o menu Melhorias saiu (§31): é um ícone
  // já recortado e que nada mais usa. Melhor reaproveitá-lo do que inventar um
  // nome que o atlas não tem — foi o que `cat/alvo` fez, e a aba nasceu sem arte.
  icon = 'aba/melhorias';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  private filtro: CategoriaDeMissao | 'todas' = 'todas';

  badge(sim: Sim): number {
    return sim.missoesProntas;
  }

  render(sim: Sim): HTMLElement {
    const todas = sim.missoes;
    const lista = this.filtro === 'todas'
      ? todas
      : todas.filter((m) => m.def.categoria === this.filtro);

    const categorias: (CategoriaDeMissao | 'todas')[] =
      ['todas', 'eliminacao', 'coleta', 'entrega', 'progressao'];

    return h('.panel-body.missoes', {},
      h('.missoes-topo', {},
        h('.missoes-medalhas', {},
          h('span.tiny.muted', { text: 'MEDALHAS' }),
          h('strong', { text: fmt(sim.state.medalhas) }),
        ),
        h('.missoes-filtros', {}, ...categorias.map((c) => {
          const ativo = this.filtro === c;
          const n = c === 'todas' ? todas.length : todas.filter((m) => m.def.categoria === c).length;
          return h(`button.fab-chip${ativo ? '.ativo' : ''}`, {
            text: c === 'todas' ? `Todas (${n})` : `${CATEGORIA_LABEL[c]} (${n})`,
            onclick: () => { this.filtro = c; sim.touch(); },
          });
        })),
      ),

      lista.length
        ? h('.missoes-lista', {}, ...lista.map((m) => this.cartao(sim, m.def, m.situacao, m.fracao)))
        // Lista vazia com explicação: sem ela, um filtro sem resultado parece
        // um painel quebrado.
        : h('p.muted.hint', {
            text: this.filtro === 'todas'
              ? 'Nenhuma missão liberada ainda. Avance de setor para abrir as primeiras.'
              : 'Nenhuma missão desta categoria está disponível agora.',
          }),
    );
  }

  private cartao(sim: Sim, def: MissaoDef, situacao: string, fracao: number): HTMLElement {
    const p = progressoDe(sim.state, def);
    const pronta = situacao === 'pronta';
    const entregue = situacao === 'entregue';

    // Falta material para a entrega? O botão precisa dizer por quê, senão um
    // "RESGATAR" que não faz nada parece defeito.
    const faltaEntrega = def.consomeNaEntrega
      ? Object.entries(def.consomeNaEntrega)
          .filter(([rec, n]) => sim.materialDisponivel(rec) < n)
          .map(([rec]) => RECURSO_POR_ID.get(rec)?.nome ?? rec)
      : [];

    return h(`.missao${pronta ? '.pronta' : ''}${entregue ? '.entregue' : ''}`, {},
      h('.missao-cab', {},
        h('.missao-titulo', {},
          h('strong', { text: def.nome }),
          h('span.muted.tiny', { text: `${CATEGORIA_LABEL[def.categoria]} · ${RITMO_LABEL[def.ritmo]}` }),
        ),
        entregue
          ? h('span.missao-selo', { text: '✓ CONCLUÍDA' })
          : pronta
            ? h('button.btn.missao-resgatar', {
                disabled: faltaEntrega.length > 0,
                title: faltaEntrega.length ? `Falta: ${faltaEntrega.join(', ')}` : '',
                onclick: () => { sim.resgatarMissao(def.id); },
              }, h('span', { text: faltaEntrega.length ? 'FALTA MATERIAL' : 'RESGATAR' }))
            : h('span.muted.tiny', { text: `${Math.round(fracao * 100)}%` }),
      ),

      h('p.muted.tiny.missao-desc', { text: def.descricao }),

      // Um objetivo por linha, com o número cru: a barra dá a sensação, o
      // número dá a decisão de continuar ou não.
      ...def.objetivos.map((o, i) => {
        const feito = Math.min(o.alvo, p.passos[i] ?? 0);
        const ok = feito >= o.alvo;
        return h('.missao-obj', {},
          h('.missao-obj-linha', {},
            h('span.tiny', { text: o.texto }),
            h('span.tiny', {
              text: `${fmt(feito)} / ${fmt(o.alvo)}`,
              style: { color: ok ? 'var(--good)' : 'var(--muted)' },
            }),
          ),
          progressBar(feito / o.alvo, ok ? 'var(--good)' : 'var(--accent)', 4),
        );
      }),

      h('.missao-premio', {}, ...this.premios(def)),
    );
  }

  /** A recompensa, em fichas. */
  private premios(def: MissaoDef): HTMLElement[] {
    const r = def.recompensa;
    const out: HTMLElement[] = [];
    const ficha = (texto: string, cor?: string) =>
      h('span.missao-ficha', { text: texto, style: cor ? { borderColor: cor, color: cor } : {} });

    for (const [moeda, n] of Object.entries(r.moedas ?? {})) out.push(ficha(`${fmt(n)} ${moeda}`));
    for (const [rec, n] of Object.entries(r.materiais ?? {})) {
      const d = RECURSO_POR_ID.get(rec);
      out.push(h('span.missao-ficha', {},
        d ? spriteIcon(iconeDeRecurso(d), 18) : h('span'),
        h('span', { text: `${fmt(n)} ${d?.nome ?? rec}` }),
      ));
    }
    if (r.xp) out.push(ficha(`${fmt(r.xp)} XP`));
    if (r.medalhas) out.push(ficha(`${r.medalhas} medalha${r.medalhas > 1 ? 's' : ''}`, 'var(--accent-2)'));
    for (const [tier, n] of Object.entries(r.baus ?? {})) out.push(ficha(`${n}× baú ${tier}`));
    if (r.itens) {
      const piso = r.itens.raridadeMin !== undefined ? rarityInfo(r.itens.raridadeMin) : null;
      out.push(ficha(
        `${r.itens.quantidade}× item${piso ? ` ${piso.name}+` : ''}`,
        piso?.color,
      ));
    }
    if (r.concessao) {
      const c = CONCESSAO_POR_ID.get(r.concessao);
      // O número, não o nome interno: "+5 espaços" é o que o jogador quer saber.
      out.push(ficha(`+${c?.itens ?? 0} espaços`, 'var(--good)'));
    }
    return out;
  }
}
