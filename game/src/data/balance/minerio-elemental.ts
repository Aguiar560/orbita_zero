import { ILVL_POR_SETOR } from './curvas';
import { PHASES_PER_GALAXY, describeGalaxy } from '@data/galaxies';
import { RECURSOS } from '@data/recursos';
import type { ElementId } from '@sim/types';

/**
 * Qual minério cada elemento pede, e em que nível de item.
 *
 * ## Por que isto existe
 *
 * Dos 70 recursos do jogo, 49 caíam sem ter onde ser gastos — e 27 deles eram
 * minério de galáxia. Medido em 07/09 com `npm run recursos`: da galáxia 2 até
 * a 24, quase tudo que o jogador minerava era peso morto.
 *
 * A ligação com elemento não precisou de tabela nova: **cada galáxia já tem um
 * elemento**, e o material-assinatura dela o herda. Cromita vem da Galáxia 12,
 * que é de gelo; logo Cromita é minério de gelo.
 *
 * ## Por que o NÍVEL do item escolhe, e não uma lista fixa
 *
 * Um elemento tem de dois a oito minérios — cósmico tem oito, gelo tem dois.
 * Escolher um por elemento e ignorar o resto deixaria 24 materiais mortos do
 * mesmo jeito, com um nome mais bonito.
 *
 * Aqui o minério sai da GALÁXIA compatível com o nível da peça: modular uma
 * peça de nível 250 pede o minério de gelo tardio, não o mesmo da peça de nível
 * 20. Os 30 minérios entram em uso, e a escada acompanha a campanha sozinha —
 * sem ninguém manter uma tabela de faixas à mão.
 *
 * ## O piso, e por que ele não é um buraco
 *
 * Uma peça de gelo de nível 5 não encontra galáxia de gelo abaixo dela: a
 * primeira é a 12. Nesse caso vale a MAIS BARATA do elemento — a de galáxia
 * mais baixa. O jogador não fica travado, mas também não recebe de graça: ele
 * ainda precisa de Cromita, que só cai na Galáxia 12.
 *
 * É essa escassez que o evento diário elemental resolve, transformando "muro"
 * em "agenda". Ver `docs/ECONOMIA-DOS-RECURSOS.md`.
 */

/** O nível de item que a primeira fase de uma galáxia entrega. */
const ilvlDaGalaxia = (galaxia: number): number =>
  Math.max(1, Math.floor((galaxia * PHASES_PER_GALAXY + 1) * ILVL_POR_SETOR));

interface MinerioDeElemento {
  id: string;
  galaxia: number;
  ilvl: number;
}

/**
 * Minérios por elemento, do mais raso ao mais profundo.
 *
 * Derivado, e não escrito: acrescentar uma galáxia ao jogo acrescenta o minério
 * dela aqui sozinho. Uma lista à mão viraria mentira na primeira galáxia nova,
 * e o erro seria silencioso — o jogo continuaria cobrando o minério errado.
 */
export const MINERIOS_POR_ELEMENTO: Readonly<Record<string, readonly MinerioDeElemento[]>> = (() => {
  const mapa: Record<string, MinerioDeElemento[]> = {};
  for (const r of RECURSOS) {
    if (r.escopo !== 'galaxia' || r.galaxia === undefined) continue;
    const elemento = describeGalaxy(r.galaxia).element;
    (mapa[elemento] ??= []).push({
      id: r.id,
      galaxia: r.galaxia,
      ilvl: ilvlDaGalaxia(r.galaxia),
    });
  }
  for (const lista of Object.values(mapa)) lista.sort((a, b) => a.galaxia - b.galaxia);
  return mapa;
})();

/**
 * O minério que uma peça deste elemento e deste nível consome.
 *
 * Devolve `null` só se um elemento não tiver galáxia nenhuma — hoje impossível,
 * e um teste guarda isso. Quem chama trata `null` como "esta operação não pede
 * minério", em vez de travar a Engenharia por um dado ausente.
 */
export function minerioParaItem(elemento: ElementId, ilvl: number): string | null {
  const lista = MINERIOS_POR_ELEMENTO[elemento];
  if (!lista?.length) return null;

  // O mais profundo que o nível da peça alcança; abaixo de todos, o mais raso.
  let escolhido = lista[0]!;
  for (const m of lista) if (m.ilvl <= ilvl) escolhido = m;
  return escolhido.id;
}
