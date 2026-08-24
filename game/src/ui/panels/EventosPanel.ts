import { fmt } from '@core/format';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import type { Panel } from './types';

export class EventosPanel implements Panel {
  id = 'eventos';
  title = 'Eventos';
  icon = 'recurso/gas_exotico';
  overlay = true;

  badge(sim: Sim): number {
    const e = sim.eventoAtivo;
    return e.liberado && !e.resgatado && e.progresso >= e.alvo ? 1 : 0;
  }

  render(sim: Sim): HTMLElement {
    const evento = sim.eventoAtivo;
    const def = evento.janela.def;
    const gas = RECURSO_POR_ID.get(def.gas);
    const restante = Math.max(0, evento.janela.fim - Date.now());
    const pronto = evento.liberado && evento.progresso >= evento.alvo && !evento.resgatado;

    return h('.panel-body.evt', { style: { '--evt-cor': def.cor } as Partial<CSSStyleDeclaration> },
      h('.evt-top', {},
        h('span.evt-kicker', { text: 'TRANSMISSÃO TEMPORÁRIA' }),
        h('h1', { text: def.nome }),
        h('strong', { text: def.subtitulo }),
        h('p', { text: def.descricao }),
        h('.evt-clock', {}, h('small', { text: 'ENCERRA EM' }), h('b', { text: tempo(restante) })),
      ),
      h('.evt-grid', {},
        h('.evt-card.evt-objective', {},
          h('small', { text: 'DIRETIVA DO EVENTO' }),
          h('h2', { text: def.objetivo.texto }),
          h('.evt-progress-copy', {},
            h('span', { text: evento.liberado ? 'PROGRESSO DESTA OCORRÊNCIA' : `LIBERA NO SETOR ${def.setorMinimo}` }),
            h('b', { text: `${fmt(evento.progresso)} / ${fmt(evento.alvo)}` }),
          ),
          progressBar(evento.progresso / evento.alvo, def.cor, 8),
          h('.evt-mod', {}, h('small', { text: 'ANOMALIA ATIVA' }), h('strong', { text: def.modificador })),
        ),
        h('.evt-card.evt-reward', {},
          h('small', { text: 'RECOMPENSA EXCLUSIVA' }),
          gas ? spriteIcon(iconeDeRecurso(gas), 112) : h('span.evt-gas-fallback', { text: '◇' }),
          h('h2', { text: gas?.nome ?? def.gas }),
          h('strong', { text: `× ${def.quantidade}` }),
          h('p', { text: 'Este gás não cai fora do evento. Guarde-o para receitas sazonais.' }),
          h('button.evt-claim', {
            disabled: !pronto,
            onclick: () => sim.resgatarEvento(),
            text: evento.resgatado ? 'RECOMPENSA RESGATADA' : pronto ? 'RESGATAR CARGA' : evento.liberado ? 'CONCLUA A DIRETIVA' : `ALCANCE O SETOR ${def.setorMinimo}`,
          }),
        ),
      ),
      h('.evt-foot', { text: 'ROTAÇÃO DE 72H · UM GÁS POR EVENTO · SEM DROP GENÉRICO' }),
    );
  }
}

function tempo(ms: number): string {
  const total = Math.floor(ms / 1_000);
  const dias = Math.floor(total / 86_400);
  const horas = Math.floor((total % 86_400) / 3_600);
  const minutos = Math.floor((total % 3_600) / 60);
  return `${dias}D ${String(horas).padStart(2, '0')}H ${String(minutos).padStart(2, '0')}M`;
}
