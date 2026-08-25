import { bus } from '@app/Bus';
import { fmt, duration } from '@core/format';
import { getElement, counterOf } from '@data/elements';
import { PROVACAO_NOME, PROVACAO_PISOS, MODIFICADOR_POR_ID, pisoDaProvacao } from '@data/provacao';
import { CAMADAS, camadaDoPiso, chefeDoPiso, ARQUETIPOS } from '@data/provacao-chefes';
import { ESPECIAL_POR_ID } from '@data/provacao-especiais';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { rarityInfo } from '@data/rarity';
import { TENTATIVAS_MAX, estadoDoPiso, type EstadoDoPiso } from '@sim/provacao';
import { powerScore } from '@sim/stats';
import type { Sim } from '@sim/index';
import { h, spriteIcon, progressBar } from '../dom';
import type { Panel } from './types';

const PRV_ASSET = '/assets/ui/provacao';

function prvImage(file: string, className: string, alt = ''): HTMLElement {
  return h('img', {
    class: className,
    src: `${PRV_ASSET}/${file}`,
    alt,
    draggable: 'false',
  });
}

/**
 * Núcleo de Provação — cem pisos de chefes (§32–§35).
 *
 * Três regiões, como a referência: à esquerda o que o modo é e onde o jogador
 * está; ao centro a coluna de pisos; à direita o piso selecionado e o botão.
 *
 * **O piso de MARCO é visualmente diferente**, e não só maior: moldura dourada,
 * altura maior, selo próprio e a camada anunciada. O jogador precisa VER que a
 * cada dez a coisa muda antes de descobrir apanhando.
 *
 * O painel não decide regra: estado do piso, tentativas e liberação vêm de
 * `sim/provacao.ts`. Aqui só se decide o que desenhar.
 */
export class ProvacaoPanel implements Panel {
  id = 'provacao';
  title = 'Provação';
  icon = 'aba/matriz';
  iconUrl = '/assets/ui/menu/provacao.webp';
  overlay = true;

  /** Piso em foco. `null` = o próximo a enfrentar. */
  private selecionado: number | null = null;

  badge(sim: Sim): number {
    // O selo mostra tentativas disponíveis: é a informação que decide se vale
    // abrir a tela agora.
    return sim.provacaoTentativas.tem;
  }

  private foco(sim: Sim): number {
    const proximo = Math.min(PROVACAO_PISOS, sim.state.provacao.pisoMax + 1);
    return this.selecionado ?? proximo;
  }

  render(sim: Sim): HTMLElement {
    const piso = this.foco(sim);

    return h('.panel-body.prv', {},
      this.cabecalho(sim),
      h('.prv-corpo', {},
        this.colunaEsquerda(sim),
        this.colunaDePisos(sim, piso),
        this.detalhe(sim, piso),
      ),
      h('.prv-rodape', {},
        h('span', { text: 'A TORRE OBSERVA. CADA VITÓRIA ABRE A PRÓXIMA CÂMARA.' }),
        h('span', { text: `PROGRESSO GLOBAL ${sim.state.provacao.pisoMax}/${PROVACAO_PISOS}` }),
      ),
    );
  }

  // ── cabeçalho ─────────────────────────────────────────────────────────────

  private cabecalho(sim: Sim): HTMLElement {
    const t = sim.provacaoTentativas;
    const p = sim.state.provacao;

    return h('.prv-topo', {},
      h('.prv-titulo', {},
        prvImage('icons/prv_alvo_torre.png', 'prv-titulo-icone', ''),
        h('.prv-titulo-copy', {},
          h('h1', { text: PROVACAO_NOME }),
          h('span.muted.tiny', { text: `${p.pisoMax} de ${PROVACAO_PISOS} pisos vencidos` }),
        ),
      ),
      h('.prv-contadores', {},
        // Tentativas primeiro: é o recurso escasso, e é ele que decide se o
        // jogador entra agora ou volta depois.
        h(`.prv-tentativas${t.tem === 0 ? '.vazio' : ''}`, {
          title: t.segundosParaProxima > 0
            ? `Próxima tentativa em ${duration(t.segundosParaProxima)}`
            : 'Estoque cheio',
        },
          h('span.tiny.muted', { text: 'TENTATIVAS' }),
          h('.prv-pips', {}, ...Array.from({ length: TENTATIVAS_MAX }, (_, i) =>
            prvImage(
              `icons/prv_tentativa_${i < t.tem ? 'cheia' : 'vazia'}.png`,
              `prv-pip${i < t.tem ? ' cheio' : ''}`,
            ),
          )),
          ...(t.segundosParaProxima > 0
            ? [h('span.tiny.prv-relogio', { text: `+1 em ${duration(t.segundosParaProxima)}` })]
            : []),
        ),
        h('.prv-cont', {},
          prvImage('icons/rewards/prv_rec_medalha.png', 'prv-cont-icone'),
          h('span', { text: `${fmt(p.vitorias)} vitórias` }),
        ),
      ),
    );
  }

  // ── coluna esquerda: o modo e o progresso ─────────────────────────────────

  private colunaEsquerda(sim: Sim): HTMLElement {
    const p = sim.state.provacao;
    const cam = camadaDoPiso(Math.max(1, p.pisoMax));

    return h('.prv-col.prv-esq', {},
      h('.prv-secao-tit', { text: 'O NÚCLEO' }),
      h('p.muted.tiny', {
        text: 'Uma estrutura ancestral de cem câmaras. Cada uma guarda um chefe próprio, com regras e recompensas próprias.',
      }),

      h('.prv-secao-tit', { text: 'CAMADA ATUAL' }),
      h('.prv-camada', { style: { borderColor: cam.cor } },
        h('strong', { text: cam.nome.toUpperCase(), style: { color: cam.cor } }),
        h('span.muted.tiny', { text: cam.tema }),
      ),

      h('.prv-secao-tit', { text: 'PROGRESSO' }),
      progressBar(p.pisoMax / PROVACAO_PISOS, 'var(--accent)', 6),
      h('.prv-linha', {},
        h('span.muted.tiny', { text: 'Maior piso' }),
        h('span.tiny', { text: String(p.pisoMax) }),
      ),
      h('.prv-linha', {},
        h('span.muted.tiny', { text: 'Marcos' }),
        h('span.tiny', { text: `${p.marcos.length} / 10` }),
      ),

      // Os dez marcos cabem numa fita compacta (§45, §46).
      h('.prv-secao-tit', { text: 'MARCOS' }),
      h('.prv-marcos', {}, ...CAMADAS.map((c) => {
        const piso = c.indice * 10;
        const feito = p.marcos.includes(piso);
        const proximo = !feito && p.marcos.length === c.indice - 1;
        return h(`.prv-marco${feito ? '.feito' : ''}${proximo ? '.proximo' : ''}`, {
          text: String(piso),
          title: `${c.nome} — piso ${piso}`,
          onclick: () => { this.selecionado = piso; sim.touch(); },
        });
      })),
    );
  }

  // ── centro: a coluna de pisos ─────────────────────────────────────────────

  private colunaDePisos(sim: Sim, foco: number): HTMLElement {
    // Mostra uma janela em volta do foco, não os cem: cem cards renderizados a
    // todo quadro custam caro e o jogador só olha meia dúzia (§72).
    const inicio = Math.max(1, foco - 4);
    const fim = Math.min(PROVACAO_PISOS, inicio + 8);
    const lista: number[] = [];
    for (let n = fim; n >= inicio; n--) lista.push(n);

    const torre = h('.prv-torre', {}, ...lista.map((n) => this.cardDePiso(sim, n, n === foco)));
    requestAnimationFrame(() => {
      const focado = torre.querySelector<HTMLElement>('.prv-piso.focado');
      if (!focado) return;
      torre.scrollTop = focado.offsetTop - Math.max(0, (torre.clientHeight - focado.offsetHeight) / 2);
    });

    return h('.prv-col.prv-centro', {},
      h('.prv-secao-tit', { text: 'CÂMARAS' }),
      torre,
    );
  }

  private cardDePiso(sim: Sim, piso: number, focado: boolean): HTMLElement {
    const estado = estadoDoPiso(sim.state, piso);
    const chefe = chefeDoPiso(piso);
    const cam = camadaDoPiso(piso);
    const marco = piso % 10 === 0;
    const el = getElement(chefe.elemento);

    const classes = [
      'prv-piso',
      `e-${estado}`,
      marco ? 'marco' : '',
      focado ? 'focado' : '',
    ].filter(Boolean).join('.');

    return h(`.${classes}`, {
      style: marco ? { borderColor: '#FFB638' } : focado ? { borderColor: 'var(--accent)' } : {},
      title: estado === 'travado' ? 'Vença o piso anterior para abrir' : chefe.caracteristica,
      onclick: () => { this.selecionado = piso; sim.touch(); },
    },
      h('.prv-piso-n', { text: String(piso) }),
      h('.prv-piso-arte', {},
        estado === 'travado'
          ? prvImage('icons/prv_icone_cadeado.png', 'prv-cadeado', 'Bloqueado')
          : spriteIcon(chefe.sprite, marco ? 46 : 34),
      ),
      h('.prv-piso-txt', {},
        h('strong', { text: estado === 'travado' ? '???' : chefe.nome }),
        h('span.muted.tiny', {
          text: marco ? `GUARDIÃO · ${cam.nome}` : ARQUETIPOS[chefe.arquetipo].nota,
        }),
      ),
      h('.prv-piso-sinais', {},
        h('span.prv-elem', { text: el.sigla, style: { background: el.color }, title: el.name }),
        ...(estado === 'vencido' || estado === 'mestrado'
          ? [prvImage('icons/prv_icone_check.png', 'prv-check', 'Concluído')]
          : []),
        ...(marco ? [prvImage('icons/prv_icone_chefe.png', 'prv-selo-marco', 'Chefe de marco')] : []),
      ),
    );
  }

  // ── direita: o piso selecionado ───────────────────────────────────────────

  private detalhe(sim: Sim, piso: number): HTMLElement {
    const def = pisoDaProvacao(piso);
    const chefe = chefeDoPiso(piso);
    const cam = camadaDoPiso(piso);
    const estado = estadoDoPiso(sim.state, piso);
    const marco = piso % 10 === 0;
    const el = getElement(chefe.elemento);
    const especial = ESPECIAL_POR_ID.get(chefe.especial)!;
    const t = sim.provacaoTentativas;

    // Poder recomendado é ESTIMATIVA (§12): mostra e não impede.
    const recomendado = Math.round(powerScore(sim.stats) * def.escala * chefe.vida * 0.9);
    const meu = Math.round(powerScore(sim.stats));

    const meuEl = sim.element;
    const contra = counterOf(chefe.elemento);
    const vantagem = counterOf(meuEl) === chefe.elemento ? 'boa'
      : contra === meuEl ? 'boa' : chefe.elemento === meuEl ? 'ruim' : 'neutra';

    return h(`.prv-col.prv-dir${marco ? '.marco' : ''}`, {},
      h('.prv-secao-tit', { text: `PISO ${piso}` }),

      h('.prv-chefe', { style: { borderColor: marco ? '#FFB638' : cam.cor } },
        h('.prv-chefe-arte', {}, spriteIcon(chefe.sprite, 72)),
        h('.prv-chefe-txt', {},
          ...(marco ? [h('span.prv-tag-marco', { text: 'GUARDIÃO DE MARCO' })] : []),
          h('strong', { text: chefe.nome.toUpperCase() }),
          h('span.muted.tiny', { text: chefe.caracteristica }),
          h('.prv-linha', {},
            h('span.muted.tiny', { text: 'ARQUÉTIPO' }),
            h('span.tiny', { text: chefe.arquetipo.toUpperCase() }),
          ),
        ),
      ),

      // Comparação elemental (§44): discreta, sem entregar a estratégia toda.
      h('.prv-elemental', {},
        h('.prv-elem-lado', {},
          h('span.muted.tiny', { text: 'SEU ELEMENTO' }),
          h('span.tiny', { text: getElement(meuEl).name, style: { color: getElement(meuEl).color } }),
        ),
        h(`span.prv-vs.v-${vantagem}`, {
          text: vantagem === 'boa' ? '▲' : vantagem === 'ruim' ? '▼' : '=',
          title: vantagem === 'boa' ? 'Vantagem elemental'
            : vantagem === 'ruim' ? 'O chefe resiste ao seu elemento' : 'Sem vantagem',
        }),
        h('.prv-elem-lado', {},
          h('span.muted.tiny', { text: 'DO CHEFE' }),
          h('span.tiny', { text: el.name, style: { color: el.color } }),
        ),
      ),

      h('.prv-poder', {},
        h('.prv-linha', {},
          h('span.muted.tiny', { text: 'PODER RECOMENDADO' }),
          h('span.tiny', {
            text: fmt(recomendado),
            style: { color: meu >= recomendado ? 'var(--good)' : 'var(--bad)' },
          }),
        ),
        h('.prv-poder-bar', {},
          h('.prv-poder-fill', {
            style: { width: `${Math.min(100, (meu / Math.max(1, recomendado)) * 100)}%` },
          }),
        ),
      ),

      // O especial do chefe — a informação que muda como se joga a luta.
      h('.prv-especial', {},
        h('span.muted.tiny', { text: 'ESPECIAL' }),
        h('strong.tiny', { text: especial.nome, style: { color: especial.cor } }),
        h('span.muted.tiny', { text: especial.descricao }),
      ),

      ...(def.modificadores.length
        ? [
            h('.prv-secao-tit', { text: 'MODIFICADORES' }),
            h('.prv-mods', {}, ...def.modificadores.map((id) => {
              const m = MODIFICADOR_POR_ID.get(id)!;
              return h('.prv-mod', { title: m.descricao },
                prvImage(`icons/modifiers/prv_mod_${id}.png`, 'prv-mod-icone'),
                h('.prv-mod-txt', {},
                  h('strong', { text: m.nome }),
                  h('span', { text: m.descricao }),
                ),
              );
            })),
          ]
        : []),

      h('.prv-secao-tit', { text: estado === 'vencido' || estado === 'mestrado' ? 'RECOMPENSA (REPETIÇÃO)' : 'RECOMPENSA' }),
      h('.prv-premios', {}, ...this.premios(sim, piso, estado)),

      ...(marco
        ? [h('.prv-conclusao', {},
            prvImage('icons/rewards/prv_bau_torre.png', 'prv-conclusao-bau', 'Baú da camada'),
            h('.prv-conclusao-txt', {},
              h('strong', { text: 'RECOMPENSA DE CONCLUSÃO' }),
              h('span', { text: `Supere o guardião e conclua ${cam.nome}.` }),
            ),
          )]
        : []),

      h(`button.btn.prv-iniciar${marco ? '.marco' : ''}`, {
        disabled: estado === 'travado' || t.tem === 0,
        title: estado === 'travado'
          ? 'Vença o piso anterior para abrir esta câmara'
          : t.tem === 0
            ? `Sem tentativas — a próxima volta em ${duration(t.segundosParaProxima)}`
            : '',
        onclick: () => {
          if (sim.iniciarPisoDaProvacao(piso)) bus.emit('panel:close');
        },
      }, h('span', {
        text: estado === 'travado' ? 'BLOQUEADO'
          : t.tem === 0 ? 'SEM TENTATIVAS'
            : 'INICIAR DESAFIO',
      })),
    );
  }

  /** As recompensas do piso, como fichas com ícone. */
  private premios(_sim: Sim, piso: number, estado: EstadoDoPiso): HTMLElement[] {
    const r = pisoDaProvacao(piso).recompensa;
    const repetindo = estado === 'vencido' || estado === 'mestrado';
    // A repetição paga um quarto e não dá item nem medalha — a tela mostra o
    // que o jogador VAI receber, não o que o piso pagou um dia.
    const f = repetindo ? 0.25 : 1;
    const out: HTMLElement[] = [];
    const ficha = (classe: string, valor: string, titulo: string) =>
      h(`.mis-premio.r-${classe}`, { title: titulo }, h('span.mis-premio-n', { text: valor }));

    out.push(ficha('sucata', fmt(Math.round(r.sucata * f)), `${fmt(Math.round(r.sucata * f))} de sucata`));
    out.push(ficha('nucleo', fmt(Math.round(r.nucleos * f)), `${fmt(Math.round(r.nucleos * f))} de núcleos`));
    if (r.cristais) out.push(ficha('cristal', fmt(Math.round(r.cristais * f)), 'cristais'));
    for (const [id, n] of Object.entries(r.materiais)) {
      const d = RECURSO_POR_ID.get(id);
      out.push(h('.mis-premio.r-recurso', { title: `${fmt(Math.round(n * f))} de ${d?.nome ?? id}` },
        d ? spriteIcon(iconeDeRecurso(d), 20) : h('span'),
        h('span.mis-premio-n', { text: fmt(Math.max(1, Math.round(n * f))) }),
      ));
    }
    if (!repetindo) {
      const piso2 = rarityInfo(r.itens.raridadeMin);
      out.push(ficha('item', String(r.itens.quantidade), `${r.itens.quantidade}× item ${piso2.name} ou melhor`));
      if (r.medalhas) out.push(ficha('medalha', String(r.medalhas), `${r.medalhas} medalha(s)`));
    }
    return out;
  }
}
