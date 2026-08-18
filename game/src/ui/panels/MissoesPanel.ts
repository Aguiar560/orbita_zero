import { fmt } from '@core/format';
import {
  MISSOES, TIPO_DE_MISSAO,
  type MissaoDef, type TipoDeMissao,
} from '@data/missoes';
import {
  CONFIANCA_MAX, PERSONAGEM_POR_ID, RECOMPENSA_DE_CONFIANCA, ROMANOS,
  STATUS_LABEL, type PersonagemDef,
} from '@data/personagens';
import { CONCESSAO_POR_ID } from '@data/balance/capacidade';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { rarityInfo } from '@data/rarity';
import {
  confiancaDe, progressoDe, requisitosPendentes, situacaoDe, textoDoRequisito,
  type SinalDeContato, type SituacaoDeMissao,
} from '@sim/missoes';
import type { Sim } from '@sim/index';
import { h, spriteIcon, progressBar } from '../dom';
import type { Panel } from './types';

/**
 * Missões — a Central de Contratos (§27).
 *
 * Três colunas: CONTATOS à esquerda, o contato selecionado e suas missões no
 * meio, TIPOS e ações à direita.
 *
 * **A tela gira em torno de QUEM dá a missão**, não de uma lista de contratos.
 * Uma lista plana é mais fácil de escrever e responde à pergunta errada: o
 * jogador não quer saber "quais missões existem", quer saber "com quem estou
 * progredindo". Por isso o eixo é o personagem, e as missões são o que ele
 * oferece.
 *
 * O painel NÃO decide regra de progressão (§42). Situação de missão, requisito
 * pendente e sinal de contato vêm de `sim/missoes.ts`; aqui só se decide o que
 * desenhar. É o que impede esta tela de discordar de outra sobre o que liberou.
 */
export class MissoesPanel implements Panel {
  id = 'missoes';
  title = 'Missões';
  // `aba/melhorias` ficou órfão quando o menu Melhorias saiu (§31): é um ícone
  // já recortado e que nada mais usa. Melhor reaproveitá-lo do que inventar um
  // nome que o atlas não tem — foi o que `cat/alvo` fez, e a aba nasceu sem arte.
  icon = 'aba/melhorias';
  overlay = true;

  private aba: 'contratos' | 'rede' | 'concluidas' = 'contratos';
  /** Contato selecionado. `null` = o primeiro desbloqueado. */
  private contato: string | null = null;
  private filtroTipo: TipoDeMissao | 'todos' = 'todos';

  badge(sim: Sim): number {
    return sim.missoesProntas;
  }

  render(sim: Sim): HTMLElement {
    const contatos = sim.contatos;
    const ativo = this.contatoAtivo(sim);

    return h('.panel-body.mis', {},
      this.cabecalho(sim),
      this.aba === 'contratos'
        ? h('.mis-corpo', {},
            this.colunaContatos(sim, contatos),
            h('.mis-centro', {},
              ativo ? this.ficha(sim, ativo) : h('p.muted.hint', { text: 'Nenhum contato disponível ainda.' }),
              ativo ? this.listaDeMissoes(sim, ativo) : h('div'),
            ),
            this.colunaDireita(sim),
          )
        : this.aba === 'rede'
          ? this.redeDeAliados(sim, contatos)
          : this.concluidas(sim),
    );
  }

  private contatoAtivo(sim: Sim): PersonagemDef | null {
    const livres = sim.contatos.filter((c) => c.desbloqueado);
    if (!livres.length) return null;
    const escolhido = this.contato ? livres.find((c) => c.def.id === this.contato) : undefined;
    return (escolhido ?? livres[0]!).def;
  }

  // ── cabeçalho e abas (§6) ─────────────────────────────────────────────────

  private cabecalho(sim: Sim): HTMLElement {
    const abas: [typeof this.aba, string][] = [
      ['contratos', 'CONTRATOS'],
      ['rede', 'REDE DE ALIADOS'],
      ['concluidas', 'CONCLUÍDAS'],
    ];
    const ativas = sim.missoes.filter((m) => m.situacao === 'ativa').length;

    return h('.mis-topo', {},
      h('.mis-abas', {}, ...abas.map(([id, rotulo]) =>
        h(`button.mis-aba${this.aba === id ? '.ativa' : ''}`, {
          text: rotulo,
          onclick: () => { this.aba = id; sim.touch(); },
        }),
      )),
      h('.mis-contadores', {},
        h('span.mis-cont', { title: 'Missões em andamento' }, h('span', { text: `▤ ${ativas}` })),
        h('span.mis-cont.pronta', { title: 'Prontas para entregar' }, h('span', { text: `✓ ${sim.missoesProntas}` })),
        h('span.mis-cont.medalha', { title: 'Medalhas' }, h('span', { text: `◈ ${fmt(sim.state.medalhas)}` })),
      ),
    );
  }

  // ── coluna esquerda: contatos (§7, §8) ────────────────────────────────────

  private colunaContatos(sim: Sim, contatos: Sim['contatos']): HTMLElement {
    return h('.mis-col.mis-contatos', {},
      h('.mis-secao-tit', { text: 'CONTATOS' }),
      h('.mis-lista-contatos', {}, ...contatos.map((c) => this.cardDeContato(sim, c))),
    );
  }

  private cardDeContato(
    sim: Sim,
    c: { def: PersonagemDef; desbloqueado: boolean; sinal: SinalDeContato; confianca: number },
  ): HTMLElement {
    if (!c.desbloqueado) {
      // Silhueta com a CONDIÇÃO à mostra. Esconder o requisito faria a linha
      // parecer defeito; mostrá-lo transforma o bloqueio em objetivo (§8).
      return h('.mis-contato.travado', {},
        h('.mis-retrato.silhueta', {}, h('span', { text: '?' })),
        h('.mis-contato-txt', {},
          h('strong', { text: '??????' }),
          h('span.muted.tiny', { text: c.def.dicaDeDesbloqueio ?? 'DESCONHECIDO' }),
        ),
        h('span.mis-sinal', { text: '🔒' }),
      );
    }

    const sel = this.contatoAtivo(sim)?.id === c.def.id;
    const sinal = SINAL[c.sinal];

    return h(`.mis-contato${sel ? '.sel' : ''}`, {
      style: { borderColor: sel ? c.def.cor : 'var(--line)' },
      onclick: () => { this.contato = c.def.id; sim.touch(); },
    },
      h('.mis-retrato', { style: { borderColor: c.def.cor } }, spriteIcon(c.def.retrato, 44)),
      h('.mis-contato-txt', {},
        h('strong', { text: c.def.nome }),
        h('span.muted.tiny', { text: c.def.faccao }),
      ),
      sinal ? h('span.mis-sinal', { text: sinal.glifo, style: { color: sinal.cor }, title: sinal.titulo }) : h('span'),
    );
  }

  // ── ficha do personagem (§10, §11) ────────────────────────────────────────

  private ficha(sim: Sim, p: PersonagemDef): HTMLElement {
    const conf = confiancaDe(sim.state, p.id);

    return h('.mis-ficha', { style: { borderColor: p.cor } },
      h('.mis-ficha-retrato', { style: { borderColor: p.cor } }, spriteIcon(p.retrato, 116)),

      h('.mis-ficha-dados', {},
        h('h2.mis-ficha-nome', { text: p.nome, style: { color: p.cor } }),
        h('span.muted.tiny', { text: p.titulo }),
        h('.mis-ficha-linha', {},
          h('span.muted.tiny', { text: 'GALÁXIA' }),
          h('span.tiny', { text: p.galaxia !== null ? `${p.galaxia + 1}` : '—', style: { color: p.cor } }),
        ),
        h('.mis-ficha-linha', {},
          h('span.muted.tiny', { text: 'AFINIDADE' }),
          // Marcadores, não número: o §10 pede que a afinidade não polua a
          // interface com dígitos.
          h('span.mis-afinidade', {}, ...Array.from({ length: 8 }, (_, i) =>
            h('span.mis-pip', { style: { background: i < conf * 1.6 ? p.cor : 'transparent', borderColor: p.cor } }),
          )),
        ),
        h('.mis-ficha-linha', {},
          h('span.muted.tiny', { text: 'STATUS' }),
          h('span.tiny', {
            text: STATUS_LABEL[p.status],
            style: { color: p.status === 'bloqueado' ? 'var(--muted)' : 'var(--good)' },
          }),
        ),
        ...(p.deChefe
          ? [h('span.mis-selo-exchefe', { text: '⚔ ANTIGO CHEFE — AGORA ALIADO' })]
          : []),
      ),

      this.confianca(p, conf),
    );
  }

  /** A escada I–V (§11). */
  private confianca(p: PersonagemDef, conf: number): HTMLElement {
    return h('.mis-confianca', {},
      h('.mis-secao-tit', { text: 'CONFIANÇA', style: { color: p.cor } }),
      h('.mis-nos', {}, ...Array.from({ length: CONFIANCA_MAX }, (_, i) => {
        const n = i + 1;
        const aberto = conf >= n;
        const premio = RECOMPENSA_DE_CONFIANCA.find((r) => r.nivel === n);
        return h('.mis-no-wrap', {},
          ...(i > 0 ? [h('.mis-fio', { style: { background: aberto ? p.cor : 'var(--line)' } })] : []),
          h(`.mis-no${aberto ? '.aberto' : ''}`, {
            style: { borderColor: aberto ? p.cor : 'var(--line)', color: aberto ? p.cor : 'var(--muted)' },
            title: `Nível ${ROMANOS[i]} — ${premio?.texto ?? ''}`,
          }, h('span', { text: aberto ? '✳' : '🔒' })),
          h('span.mis-no-rom', { text: ROMANOS[i]!, style: { color: aberto ? p.cor : 'var(--muted)' } }),
        );
      })),
      h('p.muted.tiny', { text: 'Complete missões deste contato para aumentar a confiança e desbloquear recompensas exclusivas.' }),
    );
  }

  // ── centro: as missões do contato (§13) ───────────────────────────────────

  private listaDeMissoes(sim: Sim, p: PersonagemDef): HTMLElement {
    const alcance = sim.alcanceLiberado;
    const minhas = MISSOES
      .filter((m) => m.giverId === p.id)
      .filter((m) => this.filtroTipo === 'todos' || (m.tipo ?? 'principal') === this.filtroTipo)
      .map((def) => ({ def, situacao: situacaoDe(sim.state, def, alcance) }))
      .filter((m) => m.situacao !== 'entregue')
      .sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]);

    return h('.mis-missoes', {},
      h('.mis-secao-tit', { text: 'MISSÕES DISPONÍVEIS' }),
      minhas.length
        ? h('.mis-cards', {}, ...minhas.map((m) => m.situacao === 'oculta'
            ? this.cardBloqueado(sim, m.def)
            : m.def.tipo === 'especial'
              ? this.cardEspecial(sim, m.def, m.situacao)
              : this.cardNormal(sim, m.def, m.situacao)))
        : h('p.muted.hint', { text: 'Este contato não tem missões abertas no momento.' }),
    );
  }

  private cardNormal(sim: Sim, def: MissaoDef, situacao: SituacaoDeMissao): HTMLElement {
    const t = TIPO_DE_MISSAO[def.tipo ?? 'principal'];
    const prog = progressoDe(sim.state, def);
    const pronta = situacao === 'pronta';

    return h(`.mis-card${pronta ? '.pronta' : ''}`, { style: { borderColor: t.cor } },
      h('.mis-card-icone', { style: { borderColor: t.cor, color: t.cor } }, h('span', { text: t.glifo })),

      h('.mis-card-txt', {},
        h('strong', { text: def.nome.toUpperCase(), style: { color: t.cor } }),
        h('span.muted.tiny', { text: def.descricao }),
      ),

      h('.mis-card-prog', {}, ...def.objetivos.map((o, i) => {
        const feito = Math.min(o.alvo, prog.passos[i] ?? 0);
        return h('.mis-obj', { title: o.texto },
          h('.mis-obj-linha', {},
            h('span.muted.tiny', { text: 'PROGRESSO' }),
            h('span.tiny', { text: `${fmt(feito)}/${fmt(o.alvo)}`, style: { color: feito >= o.alvo ? 'var(--good)' : 'var(--text)' } }),
          ),
          progressBar(feito / o.alvo, feito >= o.alvo ? 'var(--good)' : t.cor, 4),
        );
      })),

      h('.mis-card-premio', {},
        h('span.muted.tiny', { text: 'RECOMPENSAS' }),
        h('.mis-fichas', {}, ...this.premios(def)),
      ),

      pronta
        ? h('button.btn.mis-entregar', {
            onclick: () => { sim.resgatarMissao(def.id); },
          }, h('span', { text: 'ENTREGAR' }))
        : h('span'),
    );
  }

  /**
   * Contrato especial (§4.4).
   *
   * Card maior e com a recompensa exclusiva DOMINANTE — é ela que dá razão ao
   * contrato existir. Um especial que parecesse com os outros desperdiçaria a
   * única peça da tela feita para ser desejada.
   */
  private cardEspecial(sim: Sim, def: MissaoDef, situacao: SituacaoDeMissao): HTMLElement {
    const t = TIPO_DE_MISSAO.especial;
    const prog = progressoDe(sim.state, def);
    const ex = def.recompensaExclusiva;
    const pronta = situacao === 'pronta';
    const feito = Math.min(def.objetivos[0]!.alvo, prog.passos[0] ?? 0);

    return h(`.mis-card.mis-especial${pronta ? '.pronta' : ''}`, {},
      h('.mis-esp-esq', {},
        h('.mis-card-icone.grande', { style: { borderColor: t.cor, color: t.cor } }, h('span', { text: t.glifo })),
        h('.mis-esp-txt', {},
          h('span.mis-esp-tag', { text: 'CONTRATO ESPECIAL' }),
          h('strong', { text: def.nome.toUpperCase() }),
          h('span.muted.tiny', { text: def.descricao }),
          h('.mis-obj', {},
            progressBar(feito / def.objetivos[0]!.alvo, t.cor, 4),
            h('span.tiny', { text: `${fmt(feito)}/${fmt(def.objetivos[0]!.alvo)}` }),
          ),
        ),
      ),

      ...(ex
        ? [h('.mis-esp-dir', {},
            h('span.muted.tiny', { text: 'RECOMPENSA EXCLUSIVA' }),
            h('.mis-esp-item', {},
              h('.mis-esp-arte', {}, spriteIcon(iconeExclusivo(ex.raridadeMin), 54)),
              h('.mis-esp-info', {},
                h('strong', { text: ex.nome, style: { color: t.cor } }),
                ...(ex.de ? [h('span.mis-esp-dono', { text: `★ ITEM EXCLUSIVO DE ${ex.de}` })] : []),
                h('.mis-fichas', {}, ...this.premios(def)),
              ),
            ),
          )]
        : []),

      pronta
        ? h('button.btn.mis-entregar.esp', {
            onclick: () => { sim.resgatarMissao(def.id); },
          }, h('span', { text: 'RECLAMAR CONTRATO' }))
        : h('span'),
    );
  }

  /** Missão travada: escurecida, com cadeado e o requisito legível (§16). */
  private cardBloqueado(sim: Sim, def: MissaoDef): HTMLElement {
    const faltam = requisitosPendentes(sim.state, def, sim.alcanceLiberado);
    return h('.mis-card.mis-travada', {},
      h('.mis-card-icone', {}, h('span', { text: '🔒' })),
      h('.mis-card-txt', {},
        h('strong', { text: def.nome.toUpperCase() }),
        h('span.muted.tiny', { text: def.descricao }),
      ),
      h('.mis-card-req', {},
        h('span.muted.tiny', { text: 'REQUISITOS' }),
        ...faltam.map((r) => h('span.tiny.mis-req', { text: `🔒 ${textoDoRequisito(r)}` })),
      ),
    );
  }

  // ── coluna direita (§18, §19, §20) ────────────────────────────────────────

  private colunaDireita(sim: Sim): HTMLElement {
    const tipos = Object.keys(TIPO_DE_MISSAO) as TipoDeMissao[];
    const n = sim.entregaveisEmLote;

    return h('.mis-col.mis-dir', {},
      h('.mis-secao-tit', { text: 'TIPOS DE MISSÃO' }),
      ...tipos.map((id) => {
        const t = TIPO_DE_MISSAO[id];
        const ativo = this.filtroTipo === id;
        return h(`.mis-tipo${ativo ? '.ativo' : ''}`, {
          style: { borderColor: t.cor },
          title: 'Clique para filtrar',
          // Legenda E filtro, como o §18 previu: a mesma peça ensina o código
          // de cores e serve para reduzir a lista.
          onclick: () => { this.filtroTipo = ativo ? 'todos' : id; sim.touch(); },
        },
          h('.mis-tipo-icone', { style: { borderColor: t.cor, color: t.cor } }, h('span', { text: t.glifo })),
          h('.mis-tipo-txt', {},
            h('strong', { text: t.nome, style: { color: t.cor } }),
            h('span.muted.tiny', { text: t.explicacao }),
          ),
        );
      }),

      h('.mis-secao-tit', { text: 'RECOMPENSAS GERAIS' }),
      h('.mis-fichas', {},
        h('span.mis-ficha', { text: 'XP' }),
        h('span.mis-ficha', { text: 'SUCATA' }),
        h('span.mis-ficha', { text: 'RECURSOS' }),
        h('span.mis-ficha', { text: 'ITENS' }),
        h('span.mis-ficha', { text: '◈ MEDALHAS', style: { borderColor: 'var(--accent-2)', color: 'var(--accent-2)' } }),
      ),

      h('button.btn.mis-entregar-tudo', {
        disabled: n === 0,
        title: n === 0
          ? 'Nenhuma missão pronta para entrega em lote'
          : 'Contratos especiais ficam de fora — eles têm recompensa exclusiva e são entregues um a um.',
        onclick: () => { sim.entregarTudo(); },
      }, h('span', { text: n > 0 ? `ENTREGAR TUDO (${n})` : 'ENTREGAR TUDO' })),
    );
  }

  // ── aba: rede de aliados (§22) ────────────────────────────────────────────

  /**
   * Grade de contatos, e não a árvore do §22.
   *
   * A árvore de nós é explicitamente opcional na primeira versão, e a grade já
   * entrega o que ela existe para dar: quem se conheceu, quanta confiança há e o
   * que falta descobrir. A árvore entra quando houver ramificação real para
   * desenhar — hoje seria uma linha reta enfeitada.
   */
  private redeDeAliados(_sim: Sim, contatos: Sim['contatos']): HTMLElement {
    return h('.mis-rede', {},
      h('.mis-secao-tit', { text: 'REDE DE ALIADOS' }),
      h('.mis-rede-grade', {}, ...contatos.map((c) => {
        if (!c.desbloqueado) {
          return h('.mis-no-rede.travado', {},
            h('.mis-retrato.silhueta', {}, h('span', { text: '?' })),
            h('strong', { text: '??????' }),
            h('span.muted.tiny', { text: c.def.dicaDeDesbloqueio ?? 'DESCONHECIDO' }),
          );
        }
        return h('.mis-no-rede', { style: { borderColor: c.def.cor } },
          h('.mis-retrato', { style: { borderColor: c.def.cor } }, spriteIcon(c.def.retrato, 64)),
          h('strong', { text: c.def.nome, style: { color: c.def.cor } }),
          h('span.muted.tiny', { text: c.def.titulo }),
          h('.mis-nos.compacto', {}, ...Array.from({ length: CONFIANCA_MAX }, (_, i) =>
            h('.mis-no.mini', {
              style: {
                borderColor: c.confianca > i ? c.def.cor : 'var(--line)',
                background: c.confianca > i ? c.def.cor : 'transparent',
              },
              title: `Confiança ${ROMANOS[i]}`,
            }),
          )),
          ...(c.def.deChefe ? [h('span.mis-selo-exchefe', { text: '⚔ ANTIGO CHEFE' })] : []),
        );
      })),
    );
  }

  // ── aba: concluídas (§23) ─────────────────────────────────────────────────

  private concluidas(sim: Sim): HTMLElement {
    const feitas = MISSOES.filter((m) => sim.state.missoes[m.id]?.entregue);
    return h('.mis-concluidas', {},
      h('.mis-secao-tit', { text: `CONCLUÍDAS (${feitas.length})` }),
      feitas.length
        ? h('.mis-cards', {}, ...feitas.map((def) => {
            const p = def.giverId ? PERSONAGEM_POR_ID.get(def.giverId) : undefined;
            // Discreto de propósito (§23): é histórico, não chamada para ação.
            return h('.mis-card.mis-feita', {},
              h('.mis-card-icone', {}, h('span', { text: '✓' })),
              h('.mis-card-txt', {},
                h('strong', { text: def.nome.toUpperCase() }),
                h('span.muted.tiny', { text: p ? `${p.nome} · ${TIPO_DE_MISSAO[def.tipo ?? 'principal'].nome}` : '' }),
              ),
              h('.mis-fichas', {}, ...this.premios(def)),
            );
          }))
        : h('p.muted.hint', { text: 'Nenhuma missão concluída ainda.' }),
    );
  }

  // ── recompensas em fichas ─────────────────────────────────────────────────

  private premios(def: MissaoDef): HTMLElement[] {
    const r = def.recompensa;
    const out: HTMLElement[] = [];
    const ficha = (texto: string, cor?: string) =>
      h('span.mis-ficha', { text: texto, style: cor ? { borderColor: cor, color: cor } : {} });

    if (r.xp) out.push(ficha(`${fmt(r.xp)} XP`));
    for (const [moeda, n] of Object.entries(r.moedas ?? {})) out.push(ficha(`${fmt(n)} ${moeda}`));
    for (const [rec, n] of Object.entries(r.materiais ?? {})) {
      const d = RECURSO_POR_ID.get(rec);
      out.push(h('span.mis-ficha', {},
        d ? spriteIcon(iconeDeRecurso(d), 16) : h('span'),
        h('span', { text: `${fmt(n)} ${d?.nome ?? rec}` }),
      ));
    }
    if (r.medalhas) out.push(ficha(`◈ ${r.medalhas}`, 'var(--accent-2)'));
    for (const [tier, n] of Object.entries(r.baus ?? {})) out.push(ficha(`${n}× ${tier}`));
    if (r.itens && !def.recompensaExclusiva) {
      const piso = r.itens.raridadeMin !== undefined ? rarityInfo(r.itens.raridadeMin) : null;
      out.push(ficha(`${r.itens.quantidade}× item${piso ? ` ${piso.name}+` : ''}`, piso?.color));
    }
    if (r.concessao) {
      const c = CONCESSAO_POR_ID.get(r.concessao);
      out.push(ficha(`+${c?.itens ?? 0} espaços`, 'var(--good)'));
    }
    if (def.confianca) out.push(ficha(`+${def.confianca} confiança`, '#B45CFF'));
    return out;
  }
}

/** Prontas primeiro, travadas por último. */
const ORDEM: Record<SituacaoDeMissao, number> = {
  pronta: 0, ativa: 1, oculta: 2, entregue: 3,
};

/** O ícone de cada sinal de contato (§8). Glifo E cor, nunca só cor (§39). */
const SINAL: Record<SinalDeContato, { glifo: string; cor: string; titulo: string } | null> = {
  pronta: { glifo: '✓', cor: 'var(--good)', titulo: 'Missão pronta para entrega' },
  especial: { glifo: '◆', cor: '#FFB638', titulo: 'Contrato especial disponível' },
  nova: { glifo: '!', cor: '#FFB638', titulo: 'Nova missão disponível' },
  bloqueado: { glifo: '🔒', cor: 'var(--muted)', titulo: 'Contato bloqueado' },
  nenhum: null,
};

/**
 * Ícone da recompensa exclusiva.
 *
 * Usa a gema da raridade, que é sprite existente e verificado. Um nome inventado
 * passaria por typecheck e nasceria sem arte — foi assim que a aba de missões
 * apareceu vazia na etapa anterior.
 */
function iconeExclusivo(raridade?: number): string {
  return `gem/${Math.min(4, Math.max(0, raridade ?? 4))}`;
}
