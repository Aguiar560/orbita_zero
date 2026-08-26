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

/**
 * Quanto cada abate paga, como fração da recompensa do encontro.
 *
 * ## Por que os números subiram 3,5 vezes
 *
 * Havia uma cápsula de moeda que caía de 7% dos abates e dava, cada uma,
 * `bounty × 0,25` de núcleo. Ela foi removida — era desenhada com arte de
 * power-up e lida como tal —, e a renda dela veio para cá.
 *
 * A cápsula não era um detalhe: medida em jogo, ela era 57 a 62% de TODO o
 * núcleo e da sucata, contra 12 a 15% do abate. O jogador ganhava mais
 * apanhando orbes do que matando.
 *
 * ## E ela acoplava a economia à densidade da onda
 *
 * Este é o defeito de fundo, e ele nasceu quando as ondas foram adensadas dez
 * vezes. A cápsula paga POR DROP; o abate divide UM ORÇAMENTO entre todos os
 * inimigos da onda. Dobrar o número de inimigos dobrava a renda da cápsula e
 * não mexia na do abate.
 *
 * O adensamento teve o cuidado de preservar a XP — `abatesDeReferencia` existe
 * só para isso — e ninguém olhou os recursos. Eles multiplicaram por dez em
 * silêncio, e o efeito ficou escondido dentro de um orbe rosa.
 *
 * Trazer a renda para o abate a torna independente da densidade, que era a
 * intenção desde o começo.
 */
export const RENDA_POR_ABATE = {
  nucleo: 1.19,
  sucata: 5.6,
} as const;