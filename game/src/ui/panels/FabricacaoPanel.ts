import { fmt } from '@core/format';
import { RECEITAS, type ReceitaDeFusao } from '@data/balance/fusao';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { RARITIES, rarityInfo } from '@data/rarity';
import type { Sim } from '@sim/index';
import type { Item, Rarity } from '@sim/types';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * Fabricação — a câmara de síntese (§25, §26).
 *
 * Três colunas: o inventário à esquerda, a câmara no meio, os tipos de
 * fabricação à direita.
 *
 * **O jogador escolhe as peças, uma a uma.** A versão anterior selecionava
 * sozinha as piores, o que era cômodo e errado: fundir é destrutivo e
 * irreversível, e escolher o que se perde é a decisão inteira. Automatizar isso
 * é automatizar a única coisa que o painel existe para o jogador fazer.
 *
 * Continua havendo um atalho para encher o anel — o que se remove é a
 * obrigação, não a comodidade.
 */
export class FabricacaoPanel implements Panel {
  id = 'fabricacao';
  title = 'Fabricação';
  icon = 'cat/reator';

  private selecionada: Rarity = 0;
  /** Uids nos encaixes do anel. `null` = vazio. */
  private slots: (string | null)[] = [];
  /** Filtro do inventário. `-1` = tudo. */
  private filtro: Rarity | -1 = -1;

  render(sim: Sim): HTMLElement {
    const receita = this.receita();
    this.ajustarSlots(sim, receita);

    return h('.panel-body.fab', {},
      this.inventario(sim, receita),
      this.camara(sim, receita),
      this.tipos(sim),
    );
  }

  private receita(): ReceitaDeFusao {
    return RECEITAS.find((r) => r.entrada === this.selecionada) ?? RECEITAS[0]!;
  }

  /**
   * Mantém o anel do tamanho da receita e sem peça fantasma.
   *
   * Sem isto, trocar de tipo com o anel cheio deixaria dez encaixes numa
   * receita de três, e desmanchar uma peça pelo inventário deixaria um encaixe
   * apontando para um item que já não existe.
   */
  private ajustarSlots(sim: Sim, receita: ReceitaDeFusao): void {
    const vivos = new Set(sim.state.inventory.map((i) => i.uid));
    const limpos = this.slots
      .filter((u): u is string => !!u && vivos.has(u))
      .filter((u) => sim.state.inventory.find((i) => i.uid === u)?.rarity === receita.entrada);

    this.slots = Array.from({ length: receita.quantidade }, (_, i) => limpos[i] ?? null);
  }

  // ── coluna esquerda: inventário ───────────────────────────────────────────

  private inventario(sim: Sim, receita: ReceitaDeFusao): HTMLElement {
    const noAnel = new Set(this.slots.filter(Boolean) as string[]);
    const lista = sim.state.inventory
      .filter((i) => !noAnel.has(i.uid))
      .filter((i) => this.filtro < 0 || i.rarity === this.filtro)
      .sort((a, b) => a.rarity - b.rarity || a.ilvl - b.ilvl);

    return h('.fab-col.fab-inv', {},
      h('.fab-titulo', { text: 'INVENTÁRIO' }),
      h('.fab-grade', {}, ...lista.slice(0, 24).map((it) => this.pecaDoInventario(sim, it, receita))),

      h('.fab-titulo', { text: 'FILTROS' }),
      h('.fab-filtros', {},
        this.chip(sim, -1, 'Todos', '#9fb0c4'),
        ...RARITIES.map((r) => this.chip(sim, r.id, r.name, r.color)),
      ),

      h('.fab-info', {},
        h('span.tiny', {
          text: 'Combine itens da mesma raridade para ter chance de obter um item de raridade superior.',
        }),
      ),
    );
  }

  private pecaDoInventario(sim: Sim, item: Item, receita: ReceitaDeFusao): HTMLElement {
    const info = rarityInfo(item.rarity);
    // Peça de outra raridade fica visível mas apagada: esconder faria o jogador
    // achar que ela sumiu, e ver o que NÃO serve ensina a regra da receita.
    const serve = item.rarity === receita.entrada && !item.favorite;

    return h(`button.fab-peca${serve ? '' : '.inerte'}`, {
      style: { borderColor: info.color },
      title: item.favorite
        ? 'Favorito — protegido da fabricação'
        : serve ? 'Clique para pôr no anel' : `Precisa ser ${rarityInfo(receita.entrada).name}`,
      onclick: () => {
        if (!serve) return;
        const vaga = this.slots.indexOf(null);
        if (vaga < 0) return;
        this.slots[vaga] = item.uid;
        sim.touch();
      },
    },
      spriteIcon(item.icon, 38),
      h('span.fab-peca-lvl', { text: String(item.ilvl) }),
      ...(item.favorite ? [h('span.fab-fav', { text: '★' })] : []),
    );
  }

  private chip(sim: Sim, r: Rarity | -1, label: string, cor: string): HTMLElement {
    const ativo = this.filtro === r;
    return h(`button.fab-chip${ativo ? '.ativo' : ''}`, {
      text: label,
      style: { color: ativo ? '#04060e' : cor, background: ativo ? cor : 'transparent', borderColor: cor },
      onclick: () => { this.filtro = r; sim.touch(); },
    });
  }

  // ── coluna central: a câmara ──────────────────────────────────────────────

  private camara(sim: Sim, receita: ReceitaDeFusao): HTMLElement {
    const cheios = this.slots.filter(Boolean) as string[];
    const faltas = cheios.length === receita.quantidade
      ? sim.faltaParaFundir(cheios)
      : [`Adicione ${receita.quantidade} itens da mesma raridade para começar`];
    const pode = faltas.length === 0;
    const saida = rarityInfo(Math.max(...receita.resultados.map((x) => x.raridade)) as Rarity);

    return h('.fab-col.fab-centro', {},
      h('.fab-titulo', { text: 'SÍNTESE DE ITENS' }),
      h('.fab-anel', {}, ...this.encaixes(sim, receita, saida)),

      h(`button.fab-acao${pode ? '.pronta' : ''}`, {
        text: pode ? 'FABRICAR' : 'FABRICAR',
        disabled: !pode,
        onclick: () => {
          if (!pode) return;
          sim.fundirItens(cheios);
          this.slots = this.slots.map(() => null);
        },
      }),
      h('.fab-dica', { text: faltas[0] ?? 'Pronto para sintetizar' }),

      h('button.fab-encher', {
        text: 'Encher com as piores peças',
        title: 'Comodidade — a escolha continua sendo sua, peça a peça.',
        onclick: () => {
          const noAnel = new Set(this.slots.filter(Boolean) as string[]);
          const disponiveis = sim.state.inventory
            .filter((i) => i.rarity === receita.entrada && !i.favorite && !noAnel.has(i.uid))
            .sort((a, b) => a.ilvl - b.ilvl);
          this.slots = this.slots.map((u) => u ?? disponiveis.shift()?.uid ?? null);
          sim.touch();
        },
      }),
    );
  }

  /** Os encaixes do anel, dispostos em círculo, mais o miolo com a chance. */
  private encaixes(sim: Sim, receita: ReceitaDeFusao, saida: { name: string; color: string }): HTMLElement[] {
    const n = receita.quantidade;
    const out = this.slots.map((uid, i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const item = uid ? sim.state.inventory.find((x) => x.uid === uid) : null;

      const el = h(`button.fab-encaixe${item ? '.cheio' : ''}`, {
        title: item ? 'Clique para devolver ao inventário' : `Encaixe ${i + 1}`,
        onclick: () => { this.slots[i] = null; sim.touch(); },
      },
        item ? spriteIcon(item.icon, 34) : h('span.fab-mais', { text: '+' }),
      );
      // Posição em porcentagem: o anel acompanha a largura da coluna sem
      // precisar de medida em pixels nem de recalcular no resize.
      el.style.left = `${50 + Math.cos(ang) * 38}%`;
      el.style.top = `${50 + Math.sin(ang) * 38}%`;
      return el;
    });

    out.push(h('.fab-miolo', {},
      h('span.tiny.muted', { text: 'CHANCE DE OBTER' }),
      h('span.fab-saida-nome', { text: saida.name.toUpperCase(), style: { color: saida.color } }),
      h('span.fab-pct', { text: `${Math.round(receita.chance * 100)}%` }),
    ));
    return out;
  }

  // ── coluna direita: tipos de fabricação ───────────────────────────────────

  private tipos(sim: Sim): HTMLElement {
    return h('.fab-col.fab-tipos', {},
      h('.fab-titulo', { text: 'TIPOS DE FABRICAÇÃO' }),
      ...RECEITAS.map((r) => {
        const info = rarityInfo(r.entrada);
        const tem = sim.state.inventory.filter((i) => i.rarity === r.entrada && !i.favorite).length;
        const pronto = tem >= r.quantidade;
        const ativo = this.selecionada === r.entrada;

        return h(`button.fab-tipo${ativo ? '.ativo' : ''}`, {
          style: { '--cor': info.color } as never,
          title: r.nota,
          onclick: () => { this.selecionada = r.entrada; this.slots = []; sim.touch(); },
        },
          h('.fab-tipo-topo', {},
            h('span.fab-gema', { style: { background: info.color } }),
            h('strong', { text: info.name.toUpperCase(), style: { color: info.color } }),
            h('span.tiny', {
              text: `${tem}/${r.quantidade}`,
              style: { color: pronto ? 'var(--good)' : 'var(--bad)' },
            }),
          ),
          h('.fab-tipo-baixo', {},
            h('span.tiny.muted', { text: 'chance' }),
            h('span.fab-tipo-pct', {
              text: `${Math.round(r.chance * 100)}%`,
              style: { color: info.color },
            }),
            // Custo em recurso resumido: o painel do meio mostra o detalhe.
            ...Object.keys(r.custo).slice(0, 2).map((id) => {
              const rec = RECURSO_POR_ID.get(id);
              const temRec = (sim.state.armazem[id] ?? 0) >= (r.custo[id] ?? 0);
              return rec
                ? h('span.fab-tipo-rec', { title: `${rec.nome} · ${fmt(r.custo[id] ?? 0)}`, style: { opacity: temRec ? '1' : '0.35' } },
                  spriteIcon(iconeDeRecurso(rec), 18))
                : h('span');
            }),
          ),
        );
      }),
    );
  }
}
