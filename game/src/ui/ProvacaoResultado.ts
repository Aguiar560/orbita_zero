import { fmt, duration } from '@core/format';
import { camadaDoPiso } from '@data/provacao-chefes';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import type { ResultadoDaProvacao, Sim } from '@sim/index';
import { h, spriteIcon } from './dom';

/**
 * As telas de vitória e derrota da Provação (§30–§33).
 *
 * Vive fora dos painéis porque a luta acontece com o painel FECHADO: o
 * resultado tem de aparecer sobre o jogo, não dentro de uma aba que o jogador
 * não está olhando.
 *
 * ## O que faz a vitória parecer vitória
 *
 * O pedido do Rafael foi explícito: "tem que ter um sentimento de vitória ao
 * derrotar cada andar". Isso não sai de uma mensagem — sai de três coisas que
 * a tela faz de propósito:
 *
 * 1. **Escala com o feito.** Um piso comum tem um selo; a primeira conclusão
 *    ganha faixa própria; o marco muda de cor, ganha moldura dourada e um
 *    título que não se repete. Se tudo comemorasse igual, nada comemoraria.
 * 2. **Mostra o que MUDOU**, não só o que caiu: o piso liberado, o recorde
 *    batido, o tempo contra o anterior. Recompensa se guarda no inventário;
 *    progresso é o que o jogador veio buscar.
 * 3. **A derrota não humilha.** Mostra o quanto faltou e uma dica que aponta o
 *    problema, não a solução — porque o §16 quer que ele experimente builds, e
 *    entregar a resposta mataria isso.
 */
export function montarResultadoDaProvacao(sim: Sim, r: ResultadoDaProvacao, fechar: () => void): HTMLElement {
  const primeira = r.camadas.includes('primeira');
  const marco = r.camadas.includes('marco');
  const cam = camadaDoPiso(r.piso);

  const fundo = h('.prv-res', {
    onclick: (e: Event) => { if (e.target === fundo) fechar(); },
  },
    h(`.prv-res-caixa${r.venceu ? '.venceu' : '.perdeu'}${marco ? '.marco' : ''}`, {},
      // ── faixa de título ───────────────────────────────────────────────────
      h('.prv-res-topo', {},
        h('span.prv-res-piso', { text: `PISO ${r.piso}` }),
        h('h2.prv-res-tit', {
          text: !r.venceu ? 'DESAFIO FRACASSADO'
            : marco ? 'MARCO DA PROVAÇÃO CONQUISTADO'
              : primeira ? 'PRIMEIRA CONCLUSÃO'
                : 'PISO CONCLUÍDO',
        }),
        h('span.muted.tiny', { text: r.chefe }),
        ...(marco ? [h('span.prv-res-camada', { text: cam.nome.toUpperCase(), style: { color: cam.cor } })] : []),
      ),

      // ── os números da luta ────────────────────────────────────────────────
      h('.prv-res-numeros', {},
        linha('TEMPO', duration(Math.round(r.tempo))),
        linha('DANO CAUSADO', fmt(Math.round(r.danoCausado))),
        linha('DANO RECEBIDO', fmt(Math.round(r.danoRecebido))),
        ...(!r.venceu && r.vidaRestanteDoChefe > 0
          // O quanto FALTOU é a informação que decide se vale tentar de novo com
          // a mesma build ou voltar e melhorar.
          ? [linha('VIDA RESTANTE DO CHEFE', `${Math.round(r.vidaRestanteDoChefe * 100)}%`, 'var(--bad)')]
          : []),
        ...(r.recorde
          ? [linha('NOVO RECORDE', `−${duration(Math.round(r.recordeAnterior - r.tempo))}`, 'var(--accent-2)')]
          : []),
      ),

      // ── vitória: o que mudou e o que caiu ─────────────────────────────────
      ...(r.venceu
        ? [
            ...(primeira || marco
              ? [h('.prv-res-faixa', {
                  text: marco ? '★ RECOMPENSA DE MARCO' : '★ RECOMPENSA DE PRIMEIRA CONCLUSÃO',
                })]
              : [h('span.muted.tiny.prv-res-nota', {
                  text: 'Repetição — recompensa reduzida, sem itens.',
                })]),

            h('.prv-res-premios', {}, ...premios(r)),

            ...(r.proximoPiso
              ? [h('.prv-res-liberado', {},
                  h('span.tiny', { text: 'LIBERADO' }),
                  h('strong', { text: `PISO ${r.proximoPiso}` }),
                )]
              : []),
          ]
        : [
            ...(r.dica
              ? [h('.prv-res-dica', {}, h('span.tiny', { text: r.dica }))]
              : []),
            h('span.muted.tiny.prv-res-nota', {
              text: `Tentativas restantes: ${sim.provacaoTentativas.tem}`,
            }),
          ]),

      h('button.btn.prv-res-ok', {
        onclick: fechar,
      }, h('span', { text: r.venceu ? 'CONTINUAR' : 'VOLTAR' })),
    ),
  );

  // Esc fecha — a tela é informativa, não uma decisão.
  const esc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    window.removeEventListener('keydown', esc, true);
    fechar();
  };
  window.addEventListener('keydown', esc, true);

  return fundo;
}

function linha(rotulo: string, valor: string, cor?: string): HTMLElement {
  return h('.prv-res-linha', {},
    h('span.muted.tiny', { text: rotulo }),
    h('span.tiny', { text: valor, style: cor ? { color: cor } : {} }),
  );
}

/** O que a vitória rendeu, com ícone. */
function premios(r: ResultadoDaProvacao): HTMLElement[] {
  const out: HTMLElement[] = [];
  const ficha = (classe: string, valor: string, titulo: string) =>
    h(`.mis-premio.r-${classe}`, { title: titulo }, h('span.mis-premio-n', { text: valor }));

  if (r.ganhos.sucata > 0) out.push(ficha('sucata', fmt(Math.round(r.ganhos.sucata)), 'sucata'));
  if (r.ganhos.nucleos > 0) out.push(ficha('nucleo', fmt(Math.round(r.ganhos.nucleos)), 'núcleos'));
  for (const [id, n] of Object.entries(r.ganhos.materiais)) {
    const d = RECURSO_POR_ID.get(id);
    out.push(h('.mis-premio.r-recurso', { title: `${fmt(n)} de ${d?.nome ?? id}` },
      d ? spriteIcon(iconeDeRecurso(d), 20) : h('span'),
      h('span.mis-premio-n', { text: fmt(n) }),
    ));
  }
  if (r.ganhos.itens > 0) out.push(ficha('item', String(r.ganhos.itens), 'itens'));
  if (r.ganhos.medalhas > 0) out.push(ficha('medalha', String(r.ganhos.medalhas), 'medalhas'));
  return out;
}
