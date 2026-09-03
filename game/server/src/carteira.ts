/**
 * O livro-caixa das moedas.
 *
 * ## A divisão deste módulo
 *
 * A parte de cima é PURA — valida lançamento, soma livro e reconcilia saldo,
 * tudo sobre vetores em memória. É o mesmo arranjo de `ritmo.ts`: o que decide
 * fica testável em Node, e o D1 entra só embaixo, onde não há decisão nenhuma
 * a tomar. Regra de dinheiro conferida por teste, não por inspeção visual.
 *
 * ## O invariante
 *
 * `transacoes` é a verdade e nunca é alterada nem apagada. `saldos` é cache, e
 * a qualquer momento tem de ser igual à soma do livro — `divergencias()` existe
 * para provar isso, e é o que a auditoria do pódio vai usar.
 *
 * Se os dois discordarem, o livro vence. Sempre.
 */

/** As moedas do jogo. Espelha `ResourceId` de `sim/types.ts`. */
export const MOEDAS = ['sucata', 'nucleo', 'cristal'] as const;
export type Moeda = (typeof MOEDAS)[number];

/**
 * Por que um lançamento existe.
 *
 * Fechado de propósito: motivo livre vira campo de texto que ninguém consulta,
 * e a pergunta "de onde saíram estes cristais" volta a não ter resposta.
 */
export const MOTIVOS = [
  'compra',   // pagamento confirmado pelo provedor
  'drop',     // caiu em combate
  'missao',   // recompensa de missão
  'loja',     // gasto na Central de Serviços
  'vip',      // gasto no passe
  'craft',    // fabricação e síntese
  'estorno',  // devolução de uma compra
  'ajuste',   // correção administrativa, sempre com justificativa fora do banco
  'semente',  // migração do save antigo para o servidor
] as const;
export type Motivo = (typeof MOTIVOS)[number];

export interface Lancamento {
  usuario: string;
  moeda: Moeda;
  /** Positivo credita, negativo debita. Nunca zero. */
  quantia: number;
  motivo: Motivo;
  /** Id do evento externo que causou o lançamento. Nulo quando é interno. */
  origem?: string | null;
  em: number;
}

export type Recusa =
  | 'moeda_desconhecida'
  | 'motivo_desconhecido'
  | 'quantia_invalida'
  | 'quantia_absurda'
  | 'saldo_insuficiente';

/**
 * Teto por lançamento.
 *
 * Não é balanceamento — é sanidade. Um lançamento de um bilhão só chega aqui
 * por defeito ou por ataque, e nos dois casos é melhor recusar do que gravar
 * no livro que é justamente o que não se pode corrigir depois.
 */
export const TETO_POR_LANCAMENTO = 1_000_000_000;

/** O lançamento é bem formado? Não olha saldo — isso é `podeDebitar`. */
export function conferirLancamento(l: Lancamento): Recusa | null {
  if (!(MOEDAS as readonly string[]).includes(l.moeda)) return 'moeda_desconhecida';
  if (!(MOTIVOS as readonly string[]).includes(l.motivo)) return 'motivo_desconhecido';
  // `Number.isSafeInteger` cobre de uma vez NaN, infinito, fracionário e o
  // ponto em que o próprio JavaScript deixa de somar inteiro com exatidão.
  if (!Number.isSafeInteger(l.quantia) || l.quantia === 0) return 'quantia_invalida';
  if (Math.abs(l.quantia) > TETO_POR_LANCAMENTO) return 'quantia_absurda';
  return null;
}

/** Saldo de uma moeda a partir do livro. É a definição de saldo. */
export function saldoDoLivro(livro: readonly Lancamento[], moeda: Moeda): number {
  let n = 0;
  for (const l of livro) if (l.moeda === moeda) n += l.quantia;
  return n;
}

/** Todos os saldos, com as moedas ausentes em zero. */
export function saldosDoLivro(livro: readonly Lancamento[]): Record<Moeda, number> {
  const r = {} as Record<Moeda, number>;
  for (const m of MOEDAS) r[m] = saldoDoLivro(livro, m);
  return r;
}

/**
 * Onde o cache discorda do livro.
 *
 * Devolve vazio quando estão de acordo. Serve para a auditoria do ranking
 * premiado e para o conserto: reconstruir `saldos` a partir daqui é seguro
 * porque o livro nunca muda.
 */
export function divergencias(
  livro: readonly Lancamento[],
  cache: Partial<Record<Moeda, number>>,
): { moeda: Moeda; livro: number; cache: number }[] {
  const fora: { moeda: Moeda; livro: number; cache: number }[] = [];
  for (const m of MOEDAS) {
    const noLivro = saldoDoLivro(livro, m);
    const noCache = cache[m] ?? 0;
    if (noLivro !== noCache) fora.push({ moeda: m, livro: noLivro, cache: noCache });
  }
  return fora;
}

/**
 * O débito cabe no saldo?
 *
 * Saldo nunca fica negativo. É decisão e não consequência: sem isso, um pedido
 * concorrente poderia deixar a conta devendo, e "devendo" não é um estado que
 * o jogo saiba mostrar nem cobrar.
 */
export function podeDebitar(saldo: number, quantia: number): boolean {
  return quantia > 0 && saldo >= quantia;
}
