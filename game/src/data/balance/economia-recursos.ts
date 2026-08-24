import { galaxyOfSector, phaseOfSector } from '@data/galaxies';

/** Metas explícitas usadas para revisar receitas futuras. */
export const ALVOS_DE_FARM = {
  receitaGalacticaMinSetores: 8,
  receitaGalacticaMaxSetores: 22,
  receitaTecnologicaChefes: [12, 20] as const,
  modulacaoRepeticoesDaProvacao: [1, 3] as const,
  eventoOcorrencias: 1,
};

/**
 * Quantidade do material-assinatura ao concluir um setor.
 *
 * Sobe um ponto a cada cinco galáxias porque as receitas tardias competem com
 * crafts mais caros. O chefe local dá +2; Sorte acrescenta pouco e com teto,
 * para não apagar a decisão de voltar à galáxia correta.
 */
export function quantidadeDeMaterialGalactico(setor: number, sorte: number): number {
  const galaxia = Math.max(0, galaxyOfSector(Math.max(1, setor)));
  const base = Math.min(10, 5 + Math.floor(galaxia / 5));
  const chefe = phaseOfSector(Math.max(1, setor)) === 10 ? 2 : 0;
  const bonusSorte = Math.min(3, Math.floor(Math.max(0, sorte) * 1.5));
  return base + chefe + bonusSorte;
}
