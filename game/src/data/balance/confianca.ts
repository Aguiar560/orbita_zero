import { MISSOES, type MissaoDef } from '@data/missoes';
import { CONFIANCA_MAX } from '@data/personagens';

/**
 * Quanta confiança cada missão de um contato entrega.
 *
 * ## O defeito que isto conserta
 *
 * A confiança era escrita à mão, quase sempre `1`, e o resultado estourava o
 * teto: **Kael Voss tinha 7 missões somando 8 para um máximo de 5** (medido em
 * 07/09). A barra enchia na quarta missão e as três últimas não valiam nada —
 * fazer a cadeia inteira pagava o mesmo que largar no meio.
 *
 * ## A forma: sobe ao longo da cadeia, e fecha exatamente no teto
 *
 * As primeiras missões de um contato são as mais fáceis e entregam menos; as
 * últimas, mais. É a decisão do Rafael, e ela resolve dois problemas de uma vez:
 * dá razão para seguir até o fim, e faz a escada contar uma história — conhecer
 * alguém é diferente de trabalhar para ele há meses.
 *
 * Os pesos são NORMALIZADOS pela cadeia inteira, então terminá-la entrega
 * exatamente `CONFIANCA_MAX`. É o que permite cadastrar quinze missões novas
 * sem recalcular nada: o número de cada uma cai sozinho do tamanho da cadeia.
 *
 * ## Por que a confiança passou a ser fracionária
 *
 * Com quinze missões e teto cinco, a maioria daria zero se ela fosse inteira. A
 * escada da tela não se importa: ela pergunta `conf >= n` para cada um dos
 * cinco degraus, então 2,4 abre o I e o II e deixa o III fechado — que é
 * exatamente o que se quer dizer.
 *
 * ## Por que a rampa é suave
 *
 * `1 + (i-1) × 0,15`: a última missão de uma cadeia de quinze vale 3,1× a
 * primeira. Uma rampa proporcional pura (peso = posição) daria 15×, e aí as
 * primeiras dez missões viravam enfeite — o oposto do que se quer, já que são
 * elas que apresentam o contato.
 */

/** Quanto cada degrau da cadeia cresce em relação ao anterior. */
const INCLINACAO = 0.15;

const peso = (posicao: number): number => 1 + Math.max(0, posicao) * INCLINACAO;

/**
 * As missões de um contato, na ORDEM em que foram cadastradas.
 *
 * A ordem de declaração é a ordem da cadeia — é assim que as cadeias existentes
 * já são escritas, e um campo `ordem` à parte seria um segundo lugar para a
 * mesma informação, livre para discordar do primeiro.
 */
export function cadeiaDoContato(giverId: string): readonly MissaoDef[] {
  return MISSOES.filter((m) => m.giverId === giverId);
}

/**
 * A confiança que ESTA missão entrega.
 *
 * Sem porta de escape escrita à mão. Havia uma — o campo `confianca` na missão
 * — e ela era usada por TODAS as 21 missões, o que fazia a derivação nunca
 * valer e produzia o estouro de teto. Uma regra só, e a posição na cadeia
 * decide.
 *
 * Se um dia um contrato precisar valer mais que a posição dele sugere, o lugar
 * é aqui dentro, com nome e motivo — não um número solto na tabela.
 */
export function confiancaDaMissao(def: MissaoDef): number {
  if (!def.giverId) return 0;

  const cadeia = cadeiaDoContato(def.giverId);
  const posicao = cadeia.findIndex((m) => m.id === def.id);
  if (posicao < 0 || !cadeia.length) return 0;

  const total = cadeia.reduce((s, _, i) => s + peso(i), 0);
  return (CONFIANCA_MAX * peso(posicao)) / total;
}

/**
 * O que a cadeia inteira entrega. Deve ser `CONFIANCA_MAX`, sempre.
 *
 * Existe para o teste poder cobrar a soma sem repetir a fórmula — e para quem
 * cadastrar conteúdo poder conferir uma cadeia nova em um comando.
 */
export function confiancaDaCadeia(giverId: string): number {
  return cadeiaDoContato(giverId).reduce((s, m) => s + confiancaDaMissao(m), 0);
}
