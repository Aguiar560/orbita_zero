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
 * ## O abate é a ÚNICA porta
 *
 * Todo recurso de jogo nasce aqui, e nada mais gera recurso. Concluir o setor
 * não paga nada — ele apenas DEPOSITA no banco a carga que a incursão já tinha
 * juntado, e é a morte no meio que a perde. Ver `grantCarga` e `bankCarga`.
 *
 * ## Duas fontes foram fechadas para chegar aqui
 *
 * **A cápsula de moeda**, um orbe que caía de 7% dos abates com arte de
 * power-up. Media 57 a 62% de todo o núcleo e da sucata, e acoplava a economia
 * à densidade da onda: ela pagava por drop, o abate divide um orçamento.
 *
 * **A patrulha**, uma renda de fundo que rodava em paralelo ao combate, sem
 * cena e sem decisão do jogador. Ela era o resto de um modo horizontal que foi
 * removido — os biomas dela descreviam a subida da superfície de um planeta até
 * a órbita, o que não tem lugar num jogo de galáxias. Medida antes de sair, era
 * **97 a 99,9% de toda a sucata**. E depositava DIRETO no banco, fora da
 * incursão: renda sem risco, enquanto o combate arriscava tudo.
 *
 * Também saiu o bolo de fim de onda (`bounty × 4` e `bounty × 0,8`), pago por
 * limpar independente de quantos inimigos morreram.
 *
 * ## Os números
 *
 * Calibrados para PRESERVAR a renda que o jogador tinha, medida no setor 12 —
 * o que mudou é a fonte, não o volume. Média de três amostras de 60s:
 *
 * | | alvo | medido | desvio |
 * |---|---|---|---|
 * | sucata/s | 34,73 | 34,6 | **0%** |
 * | núcleo/s | 0,125 | 0,124 | **−1%** |
 *
 * A dispersão entre corridas é de ±20% mesmo em janelas de 90s, porque os
 * perfis de onda têm densidades muito diferentes e poucas ondas cabem numa
 * janela. Perseguir o número numa amostra só me fez subir o parâmetro e a
 * leitura CAIR; a média de três é o que fecha.
 *
 * ## A forma da curva mudou, e essa é a mudança de verdade
 *
 * A patrulha era um faucet PLANO: ~33,9/s no setor 1 e no setor 200. O abate
 * escala com o `bounty` do setor. Preservar o volume no meio significa que o
 * começo empobrece e o fim enriquece:
 *
 * | setor | antes | agora |
 * |---|---|---|
 * | 3 | ~33,9 | **4,1** |
 * | 8 | ~34,0 | **28,2** |
 * | 12 | 34,7 | **34,6** |
 *
 * É a direção certa — recurso deve seguir progressão, não relógio —, mas é uma
 * mudança de ritmo real no início do jogo, e não um efeito colateral neutro.
 * Se o começo ficar apertado demais na prática, o ajuste é aqui.
 */
export const RENDA_POR_ABATE = {
  nucleo: 3.4,
  sucata: 1000,
} as const;
