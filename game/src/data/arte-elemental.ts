import type { ElementId } from '@sim/types';

/**
 * A arte do atlas `elemental` — 6 elementos × 7 categorias (§21, §22).
 *
 * Esta tabela existe porque o RECORTE não é uniforme: a folha tem de um a seis
 * sprites por célula, e quantos exatamente é fato medido, não escolha de
 * design. Guardar as contagens aqui deixa o resto do jogo pedir "um tiro de
 * gelo" sem saber que gelo tem quatro e químico tem cinco.
 *
 * As contagens são conferidas contra o atlas por teste. Se o recorte mudar —
 * e ele vai mudar, o resíduo está anotado em `tools/lib/elemental.mjs` — o
 * teste quebra antes de o jogo pedir um sprite que não existe e desenhar nada.
 */

export type CategoriaElemental =
  | 'tiro' | 'tiroini' | 'carga' | 'feixe' | 'fogacho' | 'estouro' | 'faisca';

/** Quantos sprites cada célula rendeu, por categoria e elemento. */
export const CONTAGENS: Record<CategoriaElemental, Record<ElementId, number>> = {
  tiro: { padrao: 2, fogo: 3, gelo: 4, cosmico: 4, raio: 4, quimico: 5 },
  tiroini: { padrao: 6, fogo: 6, gelo: 4, cosmico: 5, raio: 3, quimico: 3 },
  carga: { padrao: 2, fogo: 2, gelo: 1, cosmico: 2, raio: 4, quimico: 3 },
  feixe: { padrao: 1, fogo: 1, gelo: 1, cosmico: 1, raio: 2, quimico: 3 },
  fogacho: { padrao: 2, fogo: 3, gelo: 3, cosmico: 4, raio: 3, quimico: 4 },
  estouro: { padrao: 2, fogo: 2, gelo: 2, cosmico: 2, raio: 2, quimico: 2 },
  faisca: { padrao: 3, fogo: 3, gelo: 1, cosmico: 2, raio: 4, quimico: 1 },
};

/**
 * Id de um sprite elemental.
 *
 * `variante` é qualquer inteiro — a conta usa módulo, então quem chama pode
 * passar o índice do projétil no leque, o id do inimigo ou o quadro atual sem
 * se preocupar com o tamanho da célula.
 */
export function arteElemental(
  cat: CategoriaElemental,
  elemento: ElementId,
  variante = 0,
): string {
  const n = CONTAGENS[cat][elemento] || 1;
  // `%` de número negativo em JS devolve negativo; `variante` costuma vir de um
  // hash e pode ser qualquer coisa.
  const i = ((variante % n) + n) % n;
  return `${cat}/${elemento}_${i}`;
}
