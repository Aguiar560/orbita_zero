import {
  MISSAO_POR_ID, MISSOES, quantoConta,
  type FatoDeJogo, type MissaoDef, type Requisito,
} from '@data/missoes';
import { BOSS_BY_ID } from '@data/bosses';
import { PHASES_PER_GALAXY } from '@data/galaxies';
import { CONFIANCA_MAX, PERSONAGEM_POR_ID, ROMANOS, type PersonagemDef } from '@data/personagens';
import type { GameState } from './types';

/**
 * Rastreamento de missões (§27).
 *
 * Sem DOM e sem canvas, como todo o `sim/`: é o que deixa a suíte medir o
 * progresso de uma missão sem abrir navegador.
 */

export interface ProgressoDeMissao {
  /** Quanto já andou, um número por objetivo, na ordem do `def`. */
  passos: number[];
  /** Já foi resgatada? */
  entregue: boolean;
}

export type EstadoDeMissoes = Record<string, ProgressoDeMissao>;

export type SituacaoDeMissao = 'oculta' | 'ativa' | 'pronta' | 'entregue';

/**
 * Progresso de uma missão, criado na primeira vez que alguém pergunta.
 *
 * Criar sob demanda, e não semear o save com as onze missões, mantém o save
 * pequeno e — mais importante — faz uma missão nova no catálogo já nascer
 * funcionando em save antigo, sem migração.
 */
export function progressoDe(state: GameState, def: MissaoDef): ProgressoDeMissao {
  const atual = state.missoes[def.id];
  if (atual && atual.passos.length === def.objetivos.length) return atual;

  // Objetivo acrescentado a uma missão já em andamento: preserva o que casa por
  // índice e completa com zeros, em vez de zerar o que o jogador já fez.
  const passos = def.objetivos.map((_, i) => atual?.passos[i] ?? 0);
  const novo = { passos, entregue: atual?.entregue ?? false };
  state.missoes[def.id] = novo;
  return novo;
}

/**
 * Um requisito é satisfeito? Ponto ÚNICO onde isso se decide (§42).
 *
 * A UI nunca pergunta "o nível é maior que 30 e o chefe caiu?" — ela pergunta a
 * situação da missão e desenha. Espalhar a regra pelos componentes é o que faz
 * uma tela discordar da outra sobre o que está liberado.
 */
export function requisitoSatisfeito(
  state: GameState,
  req: Requisito,
  alcance: number,
): boolean {
  switch (req.tipo) {
    case 'nivelPersonagem': return state.command.nivel >= req.valor;
    case 'nivelNave': return (state.naves[state.hull]?.nivel ?? 1) >= req.valor;
    case 'setorAlcancado': return alcance >= req.valor;
    // Galáxia CONCLUÍDA é ter passado do último setor dela, não estar nela.
    case 'galaxiaConcluida': return alcance > (req.galaxia + 1) * PHASES_PER_GALAXY;
    case 'chefeDerrotado': return state.codex.includes(req.chefeId);
    case 'missaoConcluida': return !!state.missoes[req.missaoId]?.entregue;
    case 'confianca': return (state.confianca[req.personagem] ?? 0) >= req.valor;
    case 'recurso': return (state.armazem[req.recurso] ?? 0) >= req.valor;
    case 'provacaoPiso': return (state.provacao?.pisoMax ?? 0) >= req.valor;
  }
}

/** Texto do requisito, para a tela do card bloqueado (§16). */
export function textoDoRequisito(req: Requisito): string {
  switch (req.tipo) {
    case 'nivelPersonagem': return `Nível ${req.valor} de comando`;
    case 'nivelNave': return `Nave nível ${req.valor}`;
    case 'setorAlcancado': return `Alcançar o setor ${req.valor}`;
    case 'galaxiaConcluida': return `Concluir a galáxia ${req.galaxia + 1}`;
    case 'chefeDerrotado': return `Derrotar ${BOSS_BY_ID.get(req.chefeId)?.name ?? req.chefeId}`;
    case 'missaoConcluida': return `Concluir "${MISSAO_POR_ID.get(req.missaoId)?.nome ?? req.missaoId}"`;
    case 'confianca':
      return `Confiança nível ${ROMANOS[req.valor - 1] ?? req.valor} com ${PERSONAGEM_POR_ID.get(req.personagem)?.nome ?? req.personagem}`;
    case 'recurso': return `${req.valor} de ${req.recurso}`;
    case 'provacaoPiso': return `Vencer o piso ${req.valor} da Provação`;
  }
}

/** A missão está visível para o jogador? */
export function estaLiberada(state: GameState, def: MissaoDef, alcance: number): boolean {
  return (def.requisitos ?? []).every((r) => requisitoSatisfeito(state, r, alcance));
}

/** Os requisitos que ainda faltam — é o que o card bloqueado mostra. */
export function requisitosPendentes(
  state: GameState,
  def: MissaoDef,
  alcance: number,
): Requisito[] {
  return (def.requisitos ?? []).filter((r) => !requisitoSatisfeito(state, r, alcance));
}

// ── contatos e confiança ────────────────────────────────────────────────────

/**
 * O contato já apareceu na rede?
 *
 * Lê o CÓDEX para o ex-chefe, que já registra quem foi derrotado. Nenhum estado
 * novo: converter um chefe em aliado é reinterpretar um dado que já existia, e
 * é isso que faz a conversão funcionar em save antigo sem migração.
 */
export function contatoDesbloqueado(state: GameState, p: PersonagemDef): boolean {
  return !p.requerChefe || state.codex.includes(p.requerChefe);
}

/** Confiança atual com um contato, 0..CONFIANCA_MAX. */
export function confiancaDe(state: GameState, id: string): number {
  return Math.min(CONFIANCA_MAX, Math.max(0, state.confianca[id] ?? 0));
}

/**
 * Situação de um contato na lista, para o ícone do card (§8).
 *
 * Ordem de prioridade deliberada: "pronta para entrega" ganha de "nova missão",
 * porque entregar é a ação que o jogador pode fazer AGORA. Um contato com as
 * duas coisas mostra o ✓, não o !.
 */
export type SinalDeContato = 'bloqueado' | 'pronta' | 'especial' | 'nova' | 'nenhum';

export function sinalDoContato(
  state: GameState,
  p: PersonagemDef,
  alcance: number,
): SinalDeContato {
  if (!contatoDesbloqueado(state, p)) return 'bloqueado';

  const minhas = MISSOES.filter((m) => m.giverId === p.id);
  let temEspecial = false;
  let temNova = false;
  for (const m of minhas) {
    const s = situacaoDe(state, m, alcance);
    if (s === 'pronta') return 'pronta';
    if (s === 'ativa') {
      if (m.tipo === 'especial') temEspecial = true;
      // "Nova" é a que ainda não saiu do zero: já vista e em andamento não
      // merece chamar atenção toda vez que o painel abre.
      if (fracaoDe(state, m) === 0) temNova = true;
    }
  }
  return temEspecial ? 'especial' : temNova ? 'nova' : 'nenhum';
}

/** Todo objetivo batido? */
export function estaCompleta(state: GameState, def: MissaoDef): boolean {
  const p = progressoDe(state, def);
  return def.objetivos.every((o, i) => (p.passos[i] ?? 0) >= o.alvo);
}

export function situacaoDe(state: GameState, def: MissaoDef, alcance: number): SituacaoDeMissao {
  if (progressoDe(state, def).entregue) return 'entregue';
  if (!estaLiberada(state, def, alcance)) return 'oculta';
  return estaCompleta(state, def) ? 'pronta' : 'ativa';
}

/**
 * Aplica um fato a todas as missões e devolve as que ficaram PRONTAS agora.
 *
 * Devolver só a transição, e não a lista de tocadas, é o que permite avisar o
 * jogador uma vez — um aviso a cada abate seria ruído.
 *
 * Missão oculta NÃO acumula: sem isso, uma missão liberada no setor 25 nasceria
 * completa com o que o jogador fez antes de ela existir, e o §27 estaria
 * premiando o passado em vez do objetivo.
 */
export function aplicarFato(
  state: GameState,
  fato: FatoDeJogo,
  alcance: number,
): MissaoDef[] {
  const prontas: MissaoDef[] = [];

  for (const def of MISSOES) {
    const p = progressoDe(state, def);
    if (p.entregue) continue;
    if (!estaLiberada(state, def, alcance)) continue;

    const eraCompleta = estaCompleta(state, def);
    let mexeu = false;

    def.objetivos.forEach((obj, i) => {
      const soma = quantoConta(obj, fato);
      if (soma <= 0) return;
      const antes = p.passos[i] ?? 0;
      if (antes >= obj.alvo) return; // já batido: não passa do alvo
      p.passos[i] = Math.min(obj.alvo, antes + soma);
      mexeu = true;
    });

    if (mexeu && !eraCompleta && estaCompleta(state, def)) prontas.push(def);
  }

  return prontas;
}

/** Fração 0..1 do progresso total da missão, para a barra da tela. */
export function fracaoDe(state: GameState, def: MissaoDef): number {
  const p = progressoDe(state, def);
  const total = def.objetivos.reduce((s, o) => s + o.alvo, 0) || 1;
  const feito = def.objetivos.reduce((s, o, i) => s + Math.min(o.alvo, p.passos[i] ?? 0), 0);
  return Math.min(1, feito / total);
}
