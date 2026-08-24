import { HULLS, type Hull } from '@data/hulls';
import type { StatMap } from './types';

/**
 * Perfil de uma nave.
 *
 * O jogo tem dezenas de cascos e uma tabela de 16 atributos: comparar dois deles olhando
 * números crus é trabalho, não decisão. Aqui os atributos são condensados em
 * CINCO eixos e numa nota única, para a pergunta virar "quero uma nave de
 * ataque ou de defesa?" em vez de "179 de escudo é muito?".
 *
 * A nota NÃO é uma ordenação de poder absoluta — as naves da linha Prisma são
 * extremos deliberados, e uma nota alta num eixo paga com nota baixa noutro.
 * Ela serve para situar o casco na frota, não para dizer qual é o melhor.
 */
export type AxisId = 'ataque' | 'defesa' | 'mobilidade' | 'alcance' | 'sincronia';

export interface AxisInfo {
  id: AxisId;
  name: string;
  color: string;
  /** Frase da especialidade, quando este é o eixo mais forte do casco. */
  especialidade: string;
}

export const AXES: readonly AxisInfo[] = [
  { id: 'ataque', name: 'Ataque', color: '#ff6a4d', especialidade: 'Abridor de linha' },
  { id: 'defesa', name: 'Defesa', color: '#4aa8ff', especialidade: 'Muralha' },
  { id: 'mobilidade', name: 'Mobilidade', color: '#5ce6ff', especialidade: 'Interceptador' },
  { id: 'alcance', name: 'Alcance', color: '#c58bff', especialidade: 'Artilharia' },
  { id: 'sincronia', name: 'Sincronia', color: '#7ee858', especialidade: 'Piloto veterano' },
];

export interface ShipProfile {
  axes: Record<AxisId, number>;
  /** 0..100, média ponderada dos eixos. */
  nota: number;
  /** Letra de patente derivada da nota. */
  patente: string;
  especialidade: AxisId;
}

/** Valores crus, antes de normalizar contra a frota. */
function raw(stats: StatMap): Record<AxisId, number> {
  const g = (k: keyof StatMap) => stats[k] ?? 0;
  return {
    ataque: Math.max(1, g('dano') * g('cadencia') * Math.max(1, g('projeteis')) * (1 + g('critChance') * g('critDano'))),
    defesa: Math.max(1, g('vida') + g('escudo') * 1.1 + g('regen') * 18),
    mobilidade: Math.max(1, g('velocidade')),
    alcance: Math.max(1, 8 + g('perfuracao') * 16 + g('explosao') * 0.9 + Math.max(0, g('projeteis') - 1) * 12),
    sincronia: Math.max(1, 8 + g('iaSkill') * 260 + g('sorte') * 70 + (g('sucataGanho') + g('nucleoGanho')) * 40),
  };
}

/** Peso de cada eixo na nota geral. */
const PESO: Record<AxisId, number> = {
  ataque: 0.3, defesa: 0.27, mobilidade: 0.16, alcance: 0.14, sincronia: 0.13,
};

/**
 * Faixa de cada eixo em toda a frota.
 *
 * Em escala logarítmica de propósito: o ataque cru vai de ~70 a ~9000 entre a
 * primeira e a última nave, e numa régua linear todas as intermediárias
 * ficariam empilhadas na primeira barrinha.
 */
const FAIXA = (() => {
  const todos = HULLS.map((h) => raw(h.stats));
  const out = {} as Record<AxisId, { lo: number; hi: number }>;
  for (const axis of AXES) {
    const vals = todos.map((r) => Math.log(r[axis.id]));
    out[axis.id] = { lo: Math.min(...vals), hi: Math.max(...vals) };
  }
  return out;
})();

const PATENTES: readonly [number, string][] = [
  [26, 'D'], [42, 'C'], [56, 'B'], [70, 'A'], [84, 'S'],
];

export function shipProfile(hull: Hull): ShipProfile {
  const r = raw(hull.stats);
  const axes = {} as Record<AxisId, number>;

  for (const axis of AXES) {
    const { lo, hi } = FAIXA[axis.id];
    const t = hi > lo ? (Math.log(r[axis.id]) - lo) / (hi - lo) : 0.5;
    // Piso de 6: uma barra vazia parece defeito de renderização, não "fraco".
    axes[axis.id] = Math.round(6 + Math.min(1, Math.max(0, t)) * 94);
  }

  const nota = Math.round(AXES.reduce((sum, a) => sum + axes[a.id] * PESO[a.id], 0));
  const especialidade = AXES.reduce((best, a) => (axes[a.id] > axes[best] ? a.id : best), AXES[0]!.id);
  const patente = PATENTES.find(([teto]) => nota < teto)?.[1] ?? 'S+';

  return { axes, nota, patente, especialidade };
}

/** Frase curta da especialidade, para o cabeçalho do casco. */
export function especialidadeLabel(profile: ShipProfile): string {
  return AXES.find((a) => a.id === profile.especialidade)?.especialidade ?? '';
}
