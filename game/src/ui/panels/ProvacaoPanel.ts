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
import { iconeDeElemento } from '../elementos';
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
/**
 * Tudo que MUDA no card de um piso.
 *
 * ## Por que isto existe separado
 *
 * O card é guardado entre redesenhos e só refeito quando muda — e a assinatura
 * do cache sai DAQUI, do mesmo objeto que o card desenha. Não são duas listas
 * para manter em acordo: é uma.
 *
 * A alternativa era escrever a assinatura à mão (```${estado}|${focado}```). Ela
 * funciona hoje e tem um modo de falhar feio: quem acrescentar um estado visual
 * ao card e esquecer a assinatura ganha um card CONGELADO mostrando estado
 * velho — pior que o custo que o cache economiza, e sem erro nenhum na tela.
 *
 * O que não está aqui é o que não muda: nome, arte, elemento e arquétipo do
 * chefe saem de `chefeDoPiso(piso)`, que é tabela.
 */
interface VisualDoPiso {
  piso: number;
  estado: EstadoDoPiso;
  focado: boolean;
  marco: boolean;
}

const visualDoPiso = (sim: Sim, piso: number, focado: boolean): VisualDoPiso => ({
  piso,
  estado: estadoDoPiso(sim.state, piso),
  focado,
  marco: piso % 10 === 0,
});

export class ProvacaoPanel implements Panel {
  id = 'provacao';
  title = 'Provação';
  icon = 'aba/matriz';
  iconUrl = '/assets/ui/menu/provacao.webp';
  overlay = true;

  /** Piso em foco. `null` = o próximo a enfrentar. */
  private selecionado: number | null = null;
/** O último foco que a torre CONSEGUIU centralizar. */
  private focoCentralizado: number | null = null;
  /** Onde a barra estava, para o redesenho não jogá-la ao topo. */
  private rolagem = 0;

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
    // Os cem pisos, e não uma janela de nove.
    //
    // A janela existia por custo — "cem cards a todo quadro custam caro" — mas
    // a premissa estava errada: o painel não redesenha a todo quadro, e sim
    // quando o estado muda, no ritmo de `PANEL_HZ`. Medido, os cem cards saem
    // em ~4ms, contra ~1ms dos nove.
    //
    // E a janela cobrava caro de outro jeito: só dava para chegar ao piso 50
    // CLICANDO de nove em nove, porque a janela seguia o foco. A barra de
    // rolagem faz o mesmo trabalho num gesto, e é o que a tela já prometia —
    // `.prv-torre` sempre teve `overflow-y: auto`, sem nada para rolar.
    const lista: number[] = [];
    for (let n = PROVACAO_PISOS; n >= 1; n--) lista.push(n);

    const torre = h('.prv-torre', {}, ...lista.map((n) => this.cardCacheado(sim, n, n === foco)));

    // Centraliza no foco só quando ele MUDA. O painel se redesenha a cada
    // `PANEL_HZ`, e reposicionar em todo redesenho arrancaria a barra da mão do
    // jogador no meio do gesto — o sintoma clássico de rolagem que "puxa".
    //
    // O "mudou" tem de valer só depois de a centralização ACONTECER, e não na
    // hora de agendá-la: o painel chega a desenhar antes de a camada ter altura
    // (medido `clientHeight: 3`), e nesse quadro `scrollTop` não vai a lugar
    // nenhum. Marcar o foco como feito ali deixava a torre presa no topo, com o
    // piso 1 lá embaixo, fora de vista.
    const centralizar = this.focoCentralizado !== foco;
    if (centralizar) {
      // `setTimeout` e não `requestAnimationFrame`: o que garante a conta certa
      // é o teste de `clientHeight` logo abaixo, não o relógio que a agenda — e
      // o rAF fica SUSPENSO em aba oculta, o que deixaria a torre no topo para
      // quem abrisse a Provação e trocasse de aba antes de ela assentar.
      const tentar = (restam: number): void => {
        const focado = torre.querySelector<HTMLElement>('.prv-piso.focado');
        if (!focado || !torre.isConnected) return;
        if (torre.clientHeight < 40) {
          // Ainda sem altura útil — tenta de novo, com teto para não virar laço
          // infinito se a torre nunca abrir.
          if (restam > 0) setTimeout(() => tentar(restam - 1), 16);
          return;
        }
        torre.scrollTop = focado.offsetTop - Math.max(0, (torre.clientHeight - focado.offsetHeight) / 2);
        this.rolagem = torre.scrollTop;
        this.focoCentralizado = foco;
      };
      setTimeout(() => tentar(30), 0);
    } else {
      // Sem isso a torre voltaria ao topo a cada redesenho.
      const antes = this.rolagem;
      setTimeout(() => { torre.scrollTop = antes; }, 0);
    }
    torre.addEventListener('scroll', () => { this.rolagem = torre.scrollTop; });

    return h('.prv-col.prv-centro', {},
      h('.prv-secao-tit', { text: 'CÂMARAS' }),
      torre,
    );
  }

  /**
   * O card do piso, reaproveitado enquanto nada nele muda.
   *
   * ## Por que existe
   *
   * Medido: construir os cem cards custa ~10ms, e é praticamente o painel
   * inteiro (as duas colunas laterais somam 0,46ms). O painel se redesenha a
   * `PANEL_HZ` — cinco vezes por segundo —, então a torre gastava um quadro
   * inteiro cinco vezes por segundo enquanto a tela estivesse aberta.
   *
   * A causa não era desenhar cem cards; era desenhá-los DE NOVO sem nada ter
   * mudado. Entre dois redesenhos, no máximo dois cards mudam: o que perdeu o
   * foco e o que ganhou.
   *
   * ## Por que cache de NÓ e não janela de rolagem
   *
   * A saída clássica é desenhar só os visíveis. Ela exige saber a altura de
   * cada linha em JS — e as linhas têm duas alturas (o piso de marco é maior),
   * o que obrigaria a repetir em código um número que vive no CSS. Repetir
   * constante entre as duas linguagens é como divergência começa.
   *
   * O cache não precisa saber altura nenhuma, e leva o custo de estado estável
   * a quase zero — que é o mesmo destino, por um caminho que não pode divergir.
   *
   * A assinatura carrega tudo que o card DESENHA. Um campo esquecido aqui vira
   * card congelado mostrando estado velho, que é pior que o custo original.
   */
  private cardCacheado(sim: Sim, piso: number, focado: boolean): HTMLElement {
    const visual = visualDoPiso(sim, piso, focado);
    const assinatura = JSON.stringify(visual);

    const guardado = this.cardsDaTorre.get(piso);
    if (guardado && guardado.assinatura === assinatura) return guardado.el;

    const el = this.cardDePiso(sim, visual);
    this.cardsDaTorre.set(piso, { assinatura, el });
    return el;
  }

  /** Um nó por piso, enquanto a assinatura dele não muda. */
  private readonly cardsDaTorre = new Map<number, { assinatura: string; el: HTMLElement }>();

  private cardDePiso(sim: Sim, v: VisualDoPiso): HTMLElement {
    const { piso, estado, focado, marco } = v;
    const chefe = chefeDoPiso(piso);
    const cam = camadaDoPiso(piso);

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
        // Ícone e não a sigla: numa coluna de cem pisos varrida de relance, `F`
        // e `G` são duas letras parecidas, e uma chama e um floco não são. É a
        // mesma razão que `ui/elementos.ts` já documenta — esta tela era o
        // último lugar que ainda desenhava a letra à mão.
        iconeDeElemento(chefe.elemento, 18, 'prv-elem-icone'),
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
        // O marcador só aparece quando tem o que dizer. O `=` do caso neutro
        // ocupava a coluna do meio para informar que não há informação — e
        // colado no rótulo lia-se como "= DO CHEFE", que não quer dizer nada.
        vantagem === 'neutra'
          ? h('span.prv-vs.v-neutra')
          : h(`span.prv-vs.v-${vantagem}`, {
            text: vantagem === 'boa' ? '▲' : '▼',
            title: vantagem === 'boa'
              ? 'Vantagem elemental'
              : 'O chefe resiste ao seu elemento',
          }),
        h('.prv-elem-lado', {},
          h('span.muted.tiny', { text: 'CHEFE' }),
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
