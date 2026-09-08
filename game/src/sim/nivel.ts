import { NIVEL_MAX } from '@data/balance/curvas';

/**
 * A conversão entre "nível + resto" e "XP acumulado".
 *
 * ## Por que ela precisa existir
 *
 * O cliente guarda progresso como **nível + resto**: `avancarNivel` soma o
 * ganho em `xp` e SUBTRAI a faixa a cada nível que sobe. O servidor guarda
 * **XP acumulado** e deriva o nível — está escrito assim em
 * `server/src/progresso.ts`, e a razão é boa: duas cópias do mesmo número
 * divergem, normalmente numa migração e em silêncio.
 *
 * Os dois modelos são compatíveis, mas alguém precisa converter. Ninguém
 * convertia. O cliente mandava a diferença do RESTO e o servidor somava isso
 * como se fosse acumulado — e o resto cai toda vez que se sobe de nível, coisa
 * que o próprio código já sabia: o comentário de `MarcoDeSetor` diz que
 * "diferença de marco daria número negativo justamente na hora mais
 * comemorativa".
 *
 * Medido em 08/09, jogando a ida e volta inteira: com 5.000.000 de XP ganho, o
 * piloto está no nível 39 e o servidor derivava **28**. A nave era pior — nível
 * real 50 contra **21** derivados —, porque a curva dela é mais curta e o
 * desconto se acumula mais vezes.
 *
 * ## Onde isso doía de verdade
 *
 * `montarEstado` monta a nave da ausência com `nivel: 1` fixo, e o nível da
 * nave multiplica os atributos do casco. Medido: uma nave nível 60 com
 * equipamento épico simulava com **74% menos dano** do que tem. O jogador
 * deixava a aba fechada e recebia por uma nave que não é a dele.
 *
 * ## Uma implementação só, dos dois lados
 *
 * Mora em `sim/` porque é fórmula, não tabela — e porque o servidor já importa
 * de `@sim`. Duas cópias desta conta divergiriam na primeira vez que alguém
 * mexesse numa curva, e o sintoma seria o nível do jogador mudando ao sincronizar.
 */

/** XP acumulado necessário para CHEGAR ao nível `nivel`. O nível 1 custa zero. */
export function xpAcumuladoAte(nivel: number, faixa: (n: number) => number): number {
  const alvo = Math.min(NIVEL_MAX, Math.max(1, Math.floor(nivel)));
  let total = 0;
  for (let n = 1; n < alvo; n++) total += faixa(n);
  return total;
}

/** O nível que um XP acumulado alcança, e quanto sobra dentro dele. */
export function nivelPorXpAcumulado(
  total: number,
  faixa: (n: number) => number,
): { nivel: number; resto: number } {
  let restante = Math.max(0, Number(total) || 0);
  let nivel = 1;
  // Busca linear: são 300 níveis no máximo, e uma soma conferível de olho vale
  // mais que uma busca binária esperta num número que decide o poder do jogador.
  while (nivel < NIVEL_MAX && restante >= faixa(nivel)) {
    restante -= faixa(nivel);
    nivel++;
  }
  // No teto o resto não acumula, igual ao que `avancarNivel` faz no cliente.
  return { nivel, resto: nivel >= NIVEL_MAX ? 0 : restante };
}

/** O acumulado que corresponde a um par nível + resto guardado no cliente. */
export function xpAcumuladoDe(
  progresso: { nivel: number; xp: number },
  faixa: (n: number) => number,
): number {
  return xpAcumuladoAte(progresso.nivel, faixa) + Math.max(0, Number(progresso.xp) || 0);
}
