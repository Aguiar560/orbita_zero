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
 * As missões de um contato, na ordem em que se DESTRAVAM.
 *
 * ## Por que não a ordem de declaração
 *
 * Foi a primeira tentativa, e ela estava errada. As missões de um contato não
 * são escritas em sequência no arquivo — as sete antigas de Kael Voss estavam
 * espalhadas entre missões de outros contatos, e as novas entraram no fim. O
 * peso saía embaralhado: "Fronteira Interior", que vem logo depois de "Batismo
 * de Fogo" na história, aparecia em quarto lugar.
 *
 * A ordem verdadeira já existe e está escrita nos REQUISITOS: cada missão
 * declara qual ela exige. Derivar dali é o que garante que o peso siga a
 * narrativa sem ninguém ter de manter uma segunda lista — e faz uma missão
 * inserida no meio da cadeia acertar o lugar só por declarar o elo.
 *
 * ## O que acontece com o que não está ligado
 *
 * Missão sem elo vem primeiro, na ordem de declaração. É o caso das raízes de
 * cadeia e de contatos que ainda não foram organizados; ordenar o resto em
 * volta delas é melhor que recusar a lista inteira.
 *
 * Ciclo não trava: quem já saiu não volta, e o que sobrar entra no fim. Uma
 * cadeia circular é erro de conteúdo, e o lugar de gritar sobre ela é um teste
 * — não uma função que o jogo chama a cada entrega.
 */
export function cadeiaDoContato(giverId: string): readonly MissaoDef[] {
  const minhas = MISSOES.filter((m) => m.giverId === giverId);
  const porId = new Map(minhas.map((m) => [m.id, m]));

  /** De quem esta missão depende, dentro da MESMA cadeia. */
  const exige = (m: MissaoDef): string[] =>
    (m.requisitos ?? [])
      .filter((r): r is Extract<typeof r, { tipo: 'missaoConcluida' }> => r.tipo === 'missaoConcluida')
      .map((r) => r.missaoId)
      .filter((id) => porId.has(id));

  const ordenada: MissaoDef[] = [];
  const dentro = new Set<string>();
  let restam = [...minhas];

  while (restam.length) {
    const prontas = restam.filter((m) => exige(m).every((id) => dentro.has(id)));
    // Ciclo: nada ficou pronto. Despeja o resto na ordem de declaração.
    if (!prontas.length) { ordenada.push(...restam); break; }
    for (const m of prontas) { ordenada.push(m); dentro.add(m.id); }
    restam = restam.filter((m) => !dentro.has(m.id));
  }

  return ordenada;
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
