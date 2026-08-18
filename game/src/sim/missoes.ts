import {
  MISSAO_POR_ID, MISSOES, quantoConta,
  type FatoDeJogo, type MissaoDef,
} from '@data/missoes';
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

/** A missão está visível para o jogador? */
export function estaLiberada(state: GameState, def: MissaoDef, alcance: number): boolean {
  if (def.requerSetor !== undefined && alcance < def.requerSetor) return false;
  if (def.requer) {
    for (const id of def.requer) {
      const pre = MISSAO_POR_ID.get(id);
      if (!pre) continue;
      if (!state.missoes[id]?.entregue) return false;
    }
  }
  return true;
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
