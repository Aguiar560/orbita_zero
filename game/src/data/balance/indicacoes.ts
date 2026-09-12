/** Números públicos e fórmulas do programa de indicações. */

/** 1.000 pontos-base = 10%. Pontos-base evitam porcentagem em ponto flutuante. */
export const PERCENTUAL_INDICACAO_BPS = 1_000;

/** A espera cobre a janela de arrependimento da compra à distância. */
export const ESPERA_INDICACAO_SEGUNDOS = 7 * 24 * 60 * 60;

/** No máximo uma solicitação de Pix em cada janela móvel de sete dias. */
export const INTERVALO_SAQUE_INDICACAO_SEGUNDOS = 7 * 24 * 60 * 60;

/** Piso operacional definido para cada solicitação: R$ 15,00 já liberados. */
export const SAQUE_MINIMO_INDICACAO_CENTAVOS = 1_500;

/**
 * Bônus de progressão, separado do dinheiro real da comissão.
 *
 * Os dois primeiros valores vieram da regra de produto. Os três seguintes são
 * a primeira curva de balanceamento e ficam neste único ponto para a revisão
 * antes de o programa ser ativado.
 */
export const MARCOS_INDICACAO = [
  { jogadores: 10, cristais: 300 },
  { jogadores: 25, cristais: 700 },
  { jogadores: 50, cristais: 1_500 },
  { jogadores: 75, cristais: 2_500 },
  { jogadores: 100, cristais: 4_000 },
] as const;

export const NIVEL_QUALIFICADOR_INDICACAO = 25;

/** Dez símbolos dão espaço suficiente sem transformar o link em uma senha. */
export const TAMANHO_CODIGO_INDICACAO = 10;

/** Sem I, L, O, 0 e 1: o código continua legível quando copiado à mão. */
export const ALFABETO_INDICACAO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Calcula a obrigação financeira sobre o dinheiro efetivamente pago. */
export function comissaoDeIndicacao(
  centavosPagos: number,
  percentualBps = PERCENTUAL_INDICACAO_BPS,
): number {
  if (!Number.isSafeInteger(centavosPagos) || centavosPagos <= 0) return 0;
  if (!Number.isSafeInteger(percentualBps) || percentualBps <= 0 || percentualBps > 10_000) return 0;
  return Math.floor((centavosPagos * percentualBps) / 10_000);
}

/** Reembolso parcial reduz a comissão pelo total acumulado, sem erro por evento. */
export function comissaoRevertida(
  comissaoCentavos: number,
  centavosReembolsados: number,
  centavosDaCompra: number,
): number {
  if (!Number.isSafeInteger(comissaoCentavos) || comissaoCentavos <= 0) return 0;
  if (!Number.isSafeInteger(centavosDaCompra) || centavosDaCompra <= 0) return 0;
  const devolvido = Math.min(centavosDaCompra, Math.max(0, Math.trunc(centavosReembolsados)));
  return Math.floor((comissaoCentavos * devolvido) / centavosDaCompra);
}
