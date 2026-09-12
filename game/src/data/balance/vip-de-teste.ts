/**
 * A promoção do período de testes: passe VIP para quem chegar à patente 25.
 *
 * ## Por que os números moram aqui, e não no servidor
 *
 * Quem CONCEDE é o servidor — a vaga é contada lá, atomicamente, e o cliente
 * não tem como (nem por que) saber quantas restam. Mas quem ANUNCIA é a
 * interface: a wiki explica a promoção ao jogador, e ela vive no pacote do
 * cliente.
 *
 * Enquanto os números estavam só em `server/src/vip-de-teste.ts`, a wiki tinha
 * a própria cópia em prosa — e ela envelheceu no mesmo dia em que a regra
 * mudou, continuando a prometer "30 dias para toda conta" depois de a promoção
 * virar 40 vagas em duas faixas. Duas cópias de um número divergem; é a mesma
 * lição do nível derivado do XP.
 *
 * O servidor importa daqui, como já importa `@sim` e `@data` para não manter
 * uma segunda cópia das regras do jogo.
 */

/** Patente que dispara a cortesia. */
export const NIVEL_DA_RECOMPENSA_VIP = 25;

/** Quantas contas ao todo recebem o passe. Depois disso, ninguém mais. */
export const VAGAS_DA_RECOMPENSA_VIP = 40;

/** Das vagas acima, quantas levam a faixa maior. */
export const VAGAS_DE_30_DIAS = 10;

export const DIAS_DA_PRIMEIRA_FAIXA = 30;
export const DIAS_DA_SEGUNDA_FAIXA = 7;
