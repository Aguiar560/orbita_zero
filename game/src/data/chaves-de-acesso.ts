import { BOSSES } from './bosses';
import { describeGalaxy } from './galaxies';
import type { ElementId } from '@sim/types';

/** Chance de uma conclusão posterior de qualquer setor pré-chefe gerar a chave. */
export const CHANCE_DROP_CHAVE_REPETICAO = 0.12;

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
