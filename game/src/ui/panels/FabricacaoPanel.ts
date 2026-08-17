import { fmt } from '@core/format';
import { RECEITAS, chanceDeSubir, type ReceitaDeFusao } from '@data/balance/fusao';
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
  /** Três colunas próprias não cabem no trilho. */
  overlay = true;

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
      placa('INVENTÁRIO'),
      h('.fab-grade', {}, ...lista.slice(0, 24).map((it) => this.pecaDoInventario(sim, it, receita))),

      placa('FILTROS'),
      h('.fab-filtros', {},
        this.chip(sim, -1, 'Todos', '#9fb0c4'),
        ...RARITIES.map((r) => this.chip(sim, r.id, r.name, r.color)),
      ),

      // O custo mora AQUI, e não na coluna do meio, por dois motivos: a coluna
      // esquerda tem espaço sobrando abaixo dos filtros, e o custo é da mesma
      // natureza do inventário — é o que você TEM contra o que precisa. Junto
      // dele, a decisão de fabricar se lê num lugar só.
      placa('MATERIAIS'),
      this.custo(sim, receita),

      h('.fab-info', {},
        h('span.tiny', {
          text: 'Combine 10 itens da mesma raridade para ter chance de obter um item de raridade superior.',
        }),
      ),
    );
  }

  /** O que a receita cobra, com o que há no armazém. */
  private custo(sim: Sim, receita: ReceitaDeFusao): HTMLElement {
    const linhas: HTMLElement[] = [
      h('.fab-custo-linha', {},
        h('span.tiny', { text: 'Núcleos' }),
        h('span.tiny', {
          text: `${fmt(sim.state.resources.nucleo)} / ${fmt(receita.nucleos)}`,
          // Verde quando bate a meta, vermelho quando falta. Branco não dizia
          // nada: obrigava a ler os dois números e comparar de cabeça, linha a
          // linha, para saber se dava para fabricar.
          style: { color: sim.state.resources.nucleo >= receita.nucleos ? 'var(--good)' : 'var(--bad)' },
        }),
      ),
    ];

    for (const [id, n] of Object.entries(receita.custo)) {
      const rec = RECURSO_POR_ID.get(id);
      const tem = sim.state.armazem[id] ?? 0;
      linhas.push(h('.fab-custo-linha', { title: rec?.origens.join(' · ') ?? '' },
        h('.fab-custo-nome', {},
          rec ? spriteIcon(iconeDeRecurso(rec), 26) : h('span'),
          h('span.tiny', { text: rec?.nome ?? id }),
        ),
        h('span.tiny', {
          text: `${fmt(tem)} / ${fmt(n)}`,
          style: { color: tem >= n ? 'var(--good)' : 'var(--bad)' },
        }),
      ));
    }
    return h('.fab-custo-lista', {}, ...linhas);
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
      placa('SÍNTESE DE ITENS'),
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
      h('span.fab-pct', { text: `${Math.round(chanceDeSubir(receita) * 100)}%` }),
    ));
    return out;
  }

  // ── coluna direita: tipos de fabricação ───────────────────────────────────

  private tipos(sim: Sim): HTMLElement {
    return h('.fab-col.fab-tipos', {},
      placa('TIPOS DE FABRICAÇÃO'),
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
            // Anel e não número: a chance é uma proporção, e um anel se compara
            // de relance entre seis linhas — seis porcentagens em texto exigem
            // ler todas.
            anelDeChance(chanceDeSubir(r), info.color),
            h('span.tiny.muted', { text: 'chance de obter' }),
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


/**
 * Placa de título com colchetes.
 *
 * O traço que se abre para os lados é o que dá a leitura de "painel de máquina"
 * — é o mesmo recurso que a arte de referência usa em cada seção, e sai de dois
 * pseudo-elementos em vez de imagem.
 */
function placa(texto: string): HTMLElement {
  return h('.fab-placa', {}, h('span', { text: texto }));
}

/**
 * Anel de porcentagem.
 *
 * SVG e não barra: a chance é uma proporção de um todo, e o anel se compara de
 * relance entre seis linhas. Seis porcentagens em texto obrigam a ler todas.
 */
function anelDeChance(fracao: number, cor: string): HTMLElement {
  const R = 13;
  const perimetro = 2 * Math.PI * R;
  const el = h('span.fab-anelinho');
  el.innerHTML = `
    <svg viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="${R}" class="fab-anelinho-trilho"/>
      <circle cx="16" cy="16" r="${R}" class="fab-anelinho-arco" stroke="${cor}"
        stroke-dasharray="${(perimetro * fracao).toFixed(1)} ${perimetro.toFixed(1)}"
        transform="rotate(-90 16 16)"/>
      <text x="16" y="16" class="fab-anelinho-txt" fill="${cor}">${Math.round(fracao * 100)}%</text>
    </svg>`;
  return el;
}
