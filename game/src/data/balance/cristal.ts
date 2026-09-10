import { isBossSector } from '@data/bosses';

/**
 * Quanto cristal o JOGO dá — e por que é tão pouco.
 *
 * ## O cristal é a moeda que se compra
 *
 * Ele é vendido por dinheiro (`CRYSTAL_PACKAGES` em `sim/vip.ts`, ~R$ 0,05 por
 * cristal) e é o que paga o VIP (500 por 30 dias), as cápsulas e os serviços da
 * Central. É a renda do jogo. Cada cristal que o jogo dá de graça é um cristal
 * que ninguém precisa comprar — então a regra, decidida em 10/09/2026, é:
 *
 * - **~700 cristais na campanha inteira** (setor 1 ao 300), para quem joga sem
 *   pagar. É pouco mais de um VIP ao longo de todo o jogo.
 * - **A maior parte no mid e no endgame.** O começo quase não paga: o jogador
 *   novo precisa conhecer o jogo, não juntar moeda.
 * - **Só marcos.** Cada fonte paga UMA vez. Nada repetível — num idle, qualquer
 *   ganho repetível é multiplicado pelas horas de aba fechada.
 *
 * ## O que estava aqui antes
 *
 * O abate de chefe pagava `floor(bounty × 0,02)` em TODO abate, e o bounty
 * cresce com a vida do chefe: 1 cristal no setor 10, 2.489 no 100, **330.826**
 * no 300. Uma passada pela campanha somava 2,1 milhões — e farmar um chefe
 * rendia milhões por hora. Baús, Provação e missões somavam mais ~27 mil.
 *
 * ## Quem credita
 *
 * O SERVIDOR, e só ele (`server/src/marcos.ts`). O cliente não gera cristal
 * nenhum: a rota da carteira ignora cristal positivo vindo dele. É o que faz a
 * moeda paga não poder ser forjada por um console aberto.
 */

/** O último setor da campanha. Marco depois dele não paga cristal. */
export const SETOR_FINAL_DA_CAMPANHA = 300;

/** O que um jogador que não paga recebe, somando todos os marcos até o 300. */
export const ALVO_DA_CAMPANHA = 700;

/**
 * A curva: `pico × (setor / 300)²`.
 *
 * Quadrática para o valor se concentrar no fim: a metade final da campanha
 * paga ~7× a primeira. É a forma mais simples que cumpre "grande parte no mid
 * e endgame" sem uma tabela escrita à mão para cada marco.
 */
export const EXPOENTE_DO_CRISTAL = 2;

/** O que o chefe do setor 300 paga na primeira vitória. */
export const PICO_DO_CHEFE = 32;

/** O que a última missão de uma cadeia de contato paga, no fim da campanha. */
export const PICO_DA_CADEIA = 31;

/** O valor da curva num setor. Nunca menos que 1: marco que não paga não é marco. */
export function cristalNoSetor(setor: number, pico: number): number {
  const s = Math.min(SETOR_FINAL_DA_CAMPANHA, Math.max(1, setor));
  return Math.max(1, Math.round(pico * Math.pow(s / SETOR_FINAL_DA_CAMPANHA, EXPOENTE_DO_CRISTAL)));
}

/**
 * O cristal da PRIMEIRA vitória sobre o chefe de um setor.
 *
 * Zero fora de setor de chefe e depois do 300. Repetir o chefe não paga: o
 * servidor credita este valor uma vez só, quando o setor alcançado passa dele.
 */
export function cristalDoChefe(setor: number): number {
  if (!isBossSector(setor) || setor > SETOR_FINAL_DA_CAMPANHA) return 0;
  return cristalNoSetor(setor, PICO_DO_CHEFE);
}

/**
 * O cristal que fecha uma cadeia de contato.
 *
 * Só a ÚLTIMA missão paga — eram três por cadeia, multiplicadas pelo tier do
 * contato, e as 33 cadeias somavam ~24 mil. O setor é o do objetivo final da
 * cadeia (chefes a 20 setores do início da galáxia do contato).
 */
export function cristalDoFimDeCadeia(setorDoObjetivoFinal: number): number {
  return cristalNoSetor(setorDoObjetivoFinal, PICO_DA_CADEIA);
}

/**
 * As missões escritas à mão que pagam cristal, e quanto.
 *
 * Todas moram no começo e no meio do jogo (setores 10 a ~100), então pagam
 * pouco — é a mesma curva aplicada de olho a um punhado de marcos narrativos.
 * A última do Kael fecha o arco principal e paga mais.
 */
export const CRISTAL_DAS_MISSOES_FIXAS: Readonly<Record<string, number>> = {
  elim_chefes: 3,
  entrega_titanio: 3,
  prog_nivel_25: 3,
  kael_08_lastro: 3,
  kael_09_cabecas: 5,
  kael_11_silencio: 5,
  kael_13_conta: 8,
  kael_14_ultima_doca: 10,
  kael_15_assinatura: 20,
};
