import { BOSSES } from './bosses';
import { describeGalaxy } from './galaxies';
import type { ElementId } from '@sim/types';

/** Chance de uma conclusão posterior de qualquer setor pré-chefe gerar a chave. */
/**
 * Chance por inimigo abatido em cada um dos nove setores pré-chefe.
 * A mesma curva se repete em todas as galáxias.
 */
export const CHANCES_DROP_CHAVE_POR_FASE = [
  0.001, 0.0015, 0.002, 0.0025, 0.003, 0.004, 0.0055, 0.0075, 0.01,
] as const;

export function chanceDropChavePorAbate(fase: number): number {
  return CHANCES_DROP_CHAVE_POR_FASE[Math.floor(fase) - 1] ?? 0;
}

export interface ChaveDeAcessoDef {
  id: string;
  galaxia: number;
  bossId: string;
  nome: string;
  elemento: ElementId;
  cor: string;
  arte: string;
  descricao: string;
}

/** Uma chave por galáxia; a posição acompanha a posição do chefe no catálogo. */
export const CHAVES_DE_ACESSO: readonly ChaveDeAcessoDef[] = BOSSES.map((boss, galaxia) => {
  const info = describeGalaxy(galaxia);
  return {
    id: `chave-galaxia-${galaxia + 1}`,
    galaxia,
    bossId: boss.id,
    nome: `Chave de ${info.name}`,
    elemento: boss.element,
    cor: info.color,
    arte: `chaves/chave-${boss.element}.svg`,
    descricao: `Autoriza uma tentativa contra ${boss.name}, no setor ${(galaxia + 1) * 10}. Só funciona nesta galáxia.`,
  };
});

export const CHAVE_POR_ID = new Map(CHAVES_DE_ACESSO.map((chave) => [chave.id, chave]));
export const chaveDaGalaxia = (galaxia: number): ChaveDeAcessoDef => CHAVES_DE_ACESSO[galaxia % CHAVES_DE_ACESSO.length] ?? CHAVES_DE_ACESSO[0]!;
