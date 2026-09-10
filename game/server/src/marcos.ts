import { marcosCumpridos, type MarcoDeCristal } from '@sim/marcos-de-cristal';

/**
 * O cristal que o JOGO dá, creditado pelo único lado que não mente.
 *
 * ## A regra
 *
 * Cristal ganho em jogo é MARCO: primeira vitória sobre cada chefe e missões
 * que o servidor conferiu. Cada marco paga uma vez. A lista e os valores moram
 * em `sim/marcos-de-cristal.ts` e `data/balance/cristal.ts` — o mesmo arquivo
 * que o cliente lê para mostrar o que falta.
 *
 * ## Por que a origem é `usuario:marco`
 *
 * O livro tem índice único em `(motivo, origem)`, feito para o webhook do
 * pagamento não creditar duas vezes. Ele serve igual aqui: a segunda tentativa
 * de lançar o mesmo marco falha no BANCO, e não num `if` que uma corrida entre
 * duas abas poderia atravessar. O usuário entra na origem porque o índice é
 * global.
 *
 * ## O que ele confia
 *
 * O setor alcançado é declarado pelo cliente (só sobe, e `placar.ts` explica
 * por que conferir o combate de verdade não vale ainda). O que limita o estrago
 * é o orçamento: mentir o setor 300 rende no máximo os ~340 cristais de chefe,
 * uma vez por conta — contra o infinito que a carteira aceitava antes.
 */

export const origemDoMarco = (usuario: string, marco: string): string => `${usuario}:${marco}`;

/** Os marcos cumpridos que ainda não entraram no livro. */
export function marcosACreditar(
  usuario: string,
  melhorSetor: number,
  entregues: ReadonlySet<string>,
  origensJaLancadas: ReadonlySet<string>,
): MarcoDeCristal[] {
  return marcosCumpridos(melhorSetor, entregues)
    .filter((m) => !origensJaLancadas.has(origemDoMarco(usuario, m.id)));
}
