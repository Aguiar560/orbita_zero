import { BASE_BY_ID } from '@data/items';
import type { Item, Rarity } from '@sim/types';

/** Resultado puro e previsível da desmontagem de uma peça. */
export interface RetornoDeDesmanche {
  materiais: Readonly<Record<string, number>>;
}

/**
 * Multiplicadores de valor por raridade.
 *
 * Venda sobe mais rápido que desmontagem porque Lendário+ é extremamente raro:
 * vender uma conquista precisa resolver uma necessidade relevante de Sucata,
 * sem gerar a moeda premium (Cristal) nem substituir Núcleos de combate.
 */
export const MULTIPLICADOR_DE_VENDA: Readonly<Record<Rarity, number>> = {
  0: 1, 1: 2, 2: 4, 3: 8, 4: 18, 5: 45, 6: 120,
};

const MULTIPLICADOR_DE_DESMANCHE: Readonly<Record<Rarity, number>> = {
  0: 1, 1: 1.45, 2: 2.1, 3: 3, 4: 4.2, 5: 6, 6: 8.5,
};

/**
 * Materiais por raridade. Todos são galácticos: desmontar equipamento jamais
 * deve substituir Missões, Eventos, Chefes ou Provação.
 */
export const MATERIAIS_POR_RARIDADE: Readonly<Record<Rarity, readonly [string, string?]>> = {
  0: ['ferrita'],
  1: ['ferrita', 'titanio'],
  2: ['titanio', 'cristal_quantico'],
  3: ['cristal_quantico', 'aco_estelar'],
  4: ['aco_estelar', 'liga_celestial'],
  5: ['liga_celestial', 'fluxo_dimensional'],
  6: ['fluxo_dimensional', 'materia_escura'],
};

/**
 * Qualidade econômica da rolagem, de aproximadamente 0,93 a 1,30.
 *
 * O tier importa mais que a posição dentro do tier (`quality`), mas nenhum dos
 * dois domina a raridade. Assim uma peça boa vale mais sem transformar a ação
 * em uma calculadora que exige inspecionar sete linhas.
 */
export function fatorDeQualidade(item: Item): number {
  if (!item.affixes.length) return 1;
  const mediaTier = item.affixes.reduce((s, a) => s + (Number.isFinite(a.tier) ? a.tier! : 1), 0) / item.affixes.length;
  const mediaQualidade = item.affixes.reduce((s, a) => {
    const q = Number.isFinite(a.quality) ? a.quality : 0.5;
    return s + Math.max(0, Math.min(1, q));
  }, 0) / item.affixes.length;
  return 0.9 + mediaTier * 0.025 + mediaQualidade * 0.15;
}

function tierDaBase(item: Item): number {
  return BASE_BY_ID.get(item.baseId)?.tier ?? 0;
}

function arredondarVenda(valor: number): number {
  if (valor < 100) return Math.max(1, Math.round(valor));
  if (valor < 1000) return Math.round(valor / 5) * 5;
  return Math.round(valor / 25) * 25;
}

/**
 * Venda sempre paga Sucata.
 *
 * Fórmula: `(12 + ilvl × 2,4) × raridade × base × qualidade × conjunto`.
 * A base acrescenta até 49%; conjunto acrescenta 20%. Nenhum atributo do item
 * muda qual moeda sai, mantendo o valor simples de conferir na interface.
 */
export function valorDeVenda(item: Item): number {
  const nivel = 12 + Math.max(1, item.ilvl) * 2.4;
  const base = 1 + tierDaBase(item) * 0.07;
  const conjunto = item.set ? 1.2 : 1;
  return arredondarVenda(
    nivel * MULTIPLICADOR_DE_VENDA[item.rarity] * base * fatorDeQualidade(item) * conjunto,
  );
}

/**
 * Desmontagem por faixas de 20 níveis.
 *
 * Usar degraus, em vez de crescimento por ponto, deixa a previsão estável:
 * subir de nv 99 para 100 não torna a peça subitamente irreconhecível. O nível
 * da base acrescenta até 42%, qualidade até ~30% e conjunto 10%.
 */
export function retornoDeDesmanche(item: Item): RetornoDeDesmanche {
  const faixaNivel = 1 + Math.floor((Math.max(1, item.ilvl) - 1) / 20);
  const base = 1 + tierDaBase(item) * 0.06;
  const conjunto = item.set ? 1.1 : 1;
  const unidades = Math.max(1, Math.round(
    faixaNivel * MULTIPLICADOR_DE_DESMANCHE[item.rarity] * base * fatorDeQualidade(item) * conjunto,
  ));
  const [principal, secundario] = MATERIAIS_POR_RARIDADE[item.rarity];
  return {
    materiais: {
      [principal]: unidades,
      ...(secundario ? { [secundario]: Math.max(1, Math.round(unidades * 0.25)) } : {}),
    },
  };
}
