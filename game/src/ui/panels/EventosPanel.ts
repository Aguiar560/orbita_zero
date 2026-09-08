import { fmt } from '@core/format';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import type { RitmoDeEvento } from '@data/eventos';
import type { ProgressoDeEvento } from '@sim/eventos';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import type { Panel } from './types';

/**
 * A Central de Eventos: três transmissões ao mesmo tempo.
 *
 * ## Por que três, e não uma
 *
 * Havia um evento só, girando a cada 72 horas, e ele pagava gás — que era
 * moeda morta: nenhuma receita do jogo consumia gás. Um conteúdo com data
 * marcada, feito para trazer o jogador de volta, pagava em nada.
 *
 * Agora cada ritmo alimenta um sumidouro diferente da economia, e é isso que os
 * impede de competir entre si:
 *
 * - **diário** paga o minério do elemento → conversão elemental de item e nave;
 * - **semanal** paga o gás → Engenharia;
 * - **mensal** paga tecnologia de chefe → peças exclusivas.
 *
 * ## Por que o mesmo abate conta para mais de um
 *
 * Porque a alternativa é o jogador ter de escolher qual evento jogar — e a
 * escolha certa seria sempre a mesma, a que paga mais. Contando nos três, a
 * decisão vira "o que eu preciso hoje", que é a decisão interessante.
 */

const RITMO: Readonly<Record<RitmoDeEvento, { rotulo: string; nota: string }>> = {
  diario: { rotulo: 'DIÁRIO', nota: 'Volta em seis dias · um por elemento' },
  semanal: { rotulo: 'SEMANAL', nota: 'Volta em dez semanas · um gás por evento' },
  mensal: { rotulo: 'MENSAL', nota: 'Volta em três meses · tecnologia de comandante' },
};

export class EventosPanel implements Panel {
  id = 'eventos';
  title = 'Eventos';
  icon = 'recurso/gas_exotico';
  iconUrl = '/assets/ui/menu/eventos.webp';
  overlay = true;

  /** Quantos estão prontos para resgatar agora. */
  badge(sim: Sim): number {
    return sim.eventosAtivos.filter((e) => e.liberado && !e.resgatado && e.progresso >= e.alvo).length;
  }

  render(sim: Sim): HTMLElement {
    const ativos = sim.eventosAtivos;

    return h('.panel-body.evt', {},
      h('.evt-top', {},
        h('span.evt-kicker', { text: 'TRANSMISSÕES TEMPORÁRIAS' }),
        h('h1', { text: 'CENTRAL DE EVENTOS' }),
        h('p', {
          text: 'Três janelas correm ao mesmo tempo. O mesmo abate conta para todas — '
            + 'o que muda é o que cada uma paga.',
        }),
      ),
      h('.evt-lista', {}, ...ativos.map((e) => this.cartao(sim, e))),
      h('.evt-foot', { text: 'DIÁRIO · SEMANAL · MENSAL — CADA UM ALIMENTA UMA OFICINA DIFERENTE' }),
    );
  }

  private cartao(sim: Sim, evento: ProgressoDeEvento): HTMLElement {
    const def = evento.janela.def;
    const recurso = RECURSO_POR_ID.get(def.recurso);
    const restante = Math.max(0, evento.janela.fim - Date.now());
    const pronto = evento.liberado && evento.progresso >= evento.alvo && !evento.resgatado;
    const info = RITMO[def.ritmo];

    return h(`.evt-card.evt-ritmo-${def.ritmo}${pronto ? '.pronto' : ''}`, {
      style: { '--evt-cor': def.cor } as Partial<CSSStyleDeclaration>,
    },
      h('.evt-cab', {},
        h('span.evt-tag', { text: info.rotulo }),
        h('.evt-clock', {}, h('small', { text: 'ENCERRA EM' }), h('b', { text: tempo(restante) })),
      ),
      h('h2', { text: def.nome }),
      h('strong.evt-sub', { text: def.subtitulo }),
      h('p.evt-desc', { text: def.descricao }),

      h('.evt-objetivo', {},
        h('small', { text: 'DIRETIVA' }),
        h('span', { text: def.objetivo.texto }),
        h('.evt-progress-copy', {},
          h('span', {
            text: evento.liberado ? 'PROGRESSO DESTA OCORRÊNCIA' : `LIBERA NO SETOR ${def.setorMinimo}`,
          }),
          h('b', { text: `${fmt(evento.progresso)} / ${fmt(evento.alvo)}` }),
        ),
        progressBar(evento.progresso / evento.alvo, def.cor, 8),
      ),

      h('.evt-mod', {}, h('small', { text: 'ANOMALIA' }), h('span', { text: def.modificador })),

      h('.evt-premio', {},
        recurso ? spriteIcon(iconeDeRecurso(recurso), 48) : h('span.evt-gas-fallback', { text: '◇' }),
        h('.evt-premio-txt', {},
          h('strong', { text: `${def.quantidade}× ${recurso?.nome ?? def.recurso}` }),
          h('small.muted', { text: info.nota }),
        ),
      ),

      h('button.evt-claim', {
        disabled: !pronto,
        // O resgate é POR CHAVE: com três eventos ao mesmo tempo, um botão que
        // resgata "o atual" resgataria o errado, e o jogador só descobriria pelo
        // recurso que apareceu no armazém.
        onclick: () => { sim.resgatarEvento(evento.janela.chave); },
        text: evento.resgatado ? 'RESGATADO'
          : pronto ? 'RESGATAR CARGA'
            : evento.liberado ? 'CONCLUA A DIRETIVA'
              : `ALCANCE O SETOR ${def.setorMinimo}`,
      }),
    );
  }
}

function tempo(ms: number): string {
  const total = Math.floor(ms / 1_000);
  const h_ = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  if (h_ >= 24) return `${Math.floor(h_ / 24)}d ${h_ % 24}h`;
  return `${h_}h ${String(m).padStart(2, '0')}m`;
}
