import { DANO_STAT, ELEMENT_IDS, RES_STAT, type ElementId, type StatId } from '@sim/types';

export interface ElementInfo {
  id: ElementId;
  name: string;
  /** Sigla de uma letra, para os pips de ícone no inventário. */
  sigla: string;
  color: string;
  /** Cor de brilho/rastro, mais clara que `color`. */
  glow: string;
  /** Projéteis `[grande, pequeno]` no atlas de combate. */
  bullet: readonly [string, string];
  /** Explosão característica. */
  blast: string;
  /** Elemento que este castiga; `null` no neutro. */
  bate: ElementId | null;
  blurb: string;
}

/**
 * O anel: fogo → gelo → cósmico → raio → químico → fogo.
 *
 * A ordem tem lógica interna para o jogador conseguir memorizar sem tabela:
 * fogo derrete gelo, gelo condensa a matéria do vazio, o vazio distorce campos
 * elétricos, a eletricidade cataliza reagentes, e o reagente químico sufoca o
 * fogo. `padrao` não entra no anel de propósito — é o dano sem apostas.
 */
export const ELEMENTS: readonly ElementInfo[] = [
  {
    id: 'padrao', name: 'Padrão', sigla: 'N', color: '#dfe7f5', glow: '#ffffff',
    bullet: ['tiro/padrao_g', 'tiro/padrao_p'], blast: 'estouro/a/frio_2',
    bate: null,
    blurb: 'Cinético puro. Nunca ganha vantagem, nunca sofre penalidade.',
  },
  {
    id: 'fogo', name: 'Fogo', sigla: 'F', color: '#ff5a3c', glow: '#ffb066',
    bullet: ['tiro/fogo_g', 'tiro/fogo_p'], blast: 'estouro/a/quente_0',
    bate: 'gelo',
    blurb: 'Queima o casco depois do impacto. Derrete gelo, morre no químico.',
  },
  {
    id: 'gelo', name: 'Gelo', sigla: 'G', color: '#5ce6ff', glow: '#b6f6ff',
    bullet: ['tiro/gelo_g', 'tiro/gelo_p'], blast: 'estouro/b/frio_2',
    bate: 'cosmico',
    blurb: 'Trava servos e reduz manobra. Condensa o vazio, evapora no fogo.',
  },
  {
    id: 'cosmico', name: 'Cósmico', sigla: 'C', color: '#b45cff', glow: '#e0b0ff',
    bullet: ['tiro/cosmico_g', 'tiro/cosmico_p'], blast: 'estouro/a/frio_3',
    bate: 'raio',
    blurb: 'Ignora parte da blindagem. Distorce campos, cede ao gelo.',
  },
  {
    id: 'raio', name: 'Raio', sigla: 'R', color: '#4aa8ff', glow: '#a8d8ff',
    bullet: ['tiro/raio_g', 'tiro/raio_p'], blast: 'estouro/a/frio_0',
    bate: 'quimico',
    blurb: 'Salta entre alvos próximos. Cataliza reagentes, some no vazio.',
  },
  {
    id: 'quimico', name: 'Químico', sigla: 'Q', color: '#7ee858', glow: '#c8ffa0',
    bullet: ['tiro/quimico_g', 'tiro/quimico_p'], blast: 'estouro/a/frio_1',
    bate: 'fogo',
    blurb: 'Corrói escudo com o tempo. Sufoca o fogo, queima no raio.',
  },
];

export const ELEMENT_BY_ID = new Map(ELEMENTS.map((e) => [e.id, e]));

export const getElement = (id: ElementId | undefined): ElementInfo =>
  ELEMENT_BY_ID.get(id ?? 'padrao') ?? ELEMENTS[0]!;

/** Elemento que castiga o argumento — a resposta para "o que levo contra isso?". */
export function counterOf(id: ElementId): ElementId | null {
  return ELEMENTS.find((e) => e.bate === id)?.id ?? null;
}

// ── Confronto ───────────────────────────────────────────────────────────────

/** Vantagem, desvantagem e o desconto por atirar no próprio elemento. */
export const VANTAGEM = 1.5;
export const DESVANTAGEM = 0.7;
export const ESPELHO = 0.75;

/**
 * Multiplicador de dano de `ataque` contra `defesa`, só pelo anel.
 *
 * `padrao` sai e entra sempre em 1.0 — nem como atacante nem como defensor ele
 * participa do anel.
 */
export function matchup(ataque: ElementId, defesa: ElementId): number {
  if (ataque === 'padrao' || defesa === 'padrao') return 1;
  if (ataque === defesa) return ESPELHO;
  if (getElement(ataque).bate === defesa) return VANTAGEM;
  if (getElement(defesa).bate === ataque) return DESVANTAGEM;
  return 1;
}

/** Texto curto do confronto, para tooltip. */
export function matchupLabel(mul: number): string {
  if (mul > 1.01) return 'vantagem';
  if (mul < 0.99) return 'resistido';
  return 'neutro';
}

// ── Atributos derivados ─────────────────────────────────────────────────────

export const danoStat = (e: ElementId): StatId => DANO_STAT[e];
export const resStat = (e: ElementId): StatId => RES_STAT[e];

/** Todos os ids de elemento, para varreduras de UI. */
export const ALL_ELEMENTS = ELEMENT_IDS;

/**
 * Teto de resistência.
 *
 * Sem teto, empilhar resistência acabaria zerando uma linha inteira de dano e o
 * jogador ficaria imune a metade do bestiário — o oposto de uma escolha.
 */
export const RES_MAX = 0.75;

/** Dano final de um golpe elemental. */
export function elementalDamage(
  base: number,
  ataque: ElementId,
  defesa: ElementId,
  potencia = 0,
  resistencia = 0,
): number {
  const res = Math.min(RES_MAX, Math.max(-1, resistencia));
  return base * matchup(ataque, defesa) * (1 + potencia) * (1 - res);
}
