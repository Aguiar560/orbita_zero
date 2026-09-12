/**
 * Regras puras do programa de indicações.
 *
 * O cliente só carrega um código. Vínculo, elegibilidade, compra confirmada e
 * crédito pertencem ao Worker; este arquivo concentra os números e formatos
 * para que nenhum deles precise ser repetido em rota ou interface.
 */

import {
  ALFABETO_INDICACAO,
  TAMANHO_CODIGO_INDICACAO,
} from '@data/balance/indicacoes';

export {
  ALFABETO_INDICACAO,
  comissaoDeIndicacao,
  comissaoRevertida,
  ESPERA_INDICACAO_SEGUNDOS,
  INTERVALO_SAQUE_INDICACAO_SEGUNDOS,
  MARCOS_INDICACAO,
  NIVEL_QUALIFICADOR_INDICACAO,
  PERCENTUAL_INDICACAO_BPS,
  SAQUE_MINIMO_INDICACAO_CENTAVOS,
  TAMANHO_CODIGO_INDICACAO,
} from '@data/balance/indicacoes';

export type EstadoDaDecisaoDeIndicacao =
  | 'vinculada'
  | 'sem_indicacao'
  | 'bloqueada';

export type EstadoDaRecompensaDeIndicacao =
  | 'pendente'
  | 'liberada'
  | 'revertida'
  | 'bloqueada';

export function normalizarCodigoIndicacao(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

export function codigoIndicacaoValido(valor: unknown): valor is string {
  const codigo = normalizarCodigoIndicacao(valor);
  if (codigo.length !== TAMANHO_CODIGO_INDICACAO) return false;
  return [...codigo].every((simbolo) => ALFABETO_INDICACAO.includes(simbolo));
}

/** Gera um código a partir de bytes para a função continuar testável sem RNG. */
export function codigoDosBytes(bytes: Uint8Array): string {
  if (bytes.length < TAMANHO_CODIGO_INDICACAO) throw new Error('bytes_insuficientes');
  let codigo = '';
  for (let i = 0; i < TAMANHO_CODIGO_INDICACAO; i++) {
    codigo += ALFABETO_INDICACAO[bytes[i]! % ALFABETO_INDICACAO.length];
  }
  return codigo;
}
