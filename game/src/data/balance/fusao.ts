import type { Rarity } from '@sim/types';

/**
 * Sacrifício e fusão de itens (§26).
 *
 * O problema que resolve: no fim do jogo, um drop Comum é lixo. Ele ocupa um
 * dos 15 a 70 espaços do inventário e o único destino é desmanchar por núcleos.
 * Com fusão, dez lixos viram uma tentativa — e é isso que mantém o drop
 * inferior relevante em qualquer ponto da curva.
 *
 * **Não é conversão garantida.** O §26 é explícito: dez Comuns NÃO são um Raro.
 * A receita tem chance de sucesso e uma tabela de resultados, e falhar consome
 * os itens. Sem isso, fundir viraria uma calculadora — o jogador faria a conta
 * uma vez e nunca mais pensaria no assunto.
 */

export interface ResultadoPossivel {
  /** Raridade que sai. */
  raridade: Rarity;
  /** Peso relativo dentro dos resultados desta receita. */
  peso: number;
}

export interface ReceitaDeFusao {
  id: string;
  nome: string;
  /** Raridade EXATA dos itens consumidos. */
  entrada: Rarity;
  /** Quantos itens a receita consome. */
  quantidade: number;
  /**
   * Chance de a fusão dar certo, 0..1.
   *
   * Falhar CONSOME os itens — é o que dá peso à decisão. Sem risco, fundir
   * seria só uma conversão com passo extra.
   */
  chance: number;
  /** Custo em recursos do Armazém, por id. */
  custo: Record<string, number>;
  /** Custo em núcleos. */
  nucleos: number;
  /** O que pode sair, com pesos. */
  resultados: readonly ResultadoPossivel[];
  nota: string;
}

/**
 * As receitas.
 *
 * Uma por degrau de raridade, e a chance CAI conforme sobe: transformar Comum
 * em Incomum é rotina, transformar Mítico em Divino é aposta. O custo em
 * recurso sobe junto, e muda de família — os degraus altos pedem material que
 * só chefe solta, o que amarra a fusão ao conteúdo em vez de deixá-la
 * acontecer sozinha no inventário.
 *
 * O resultado nem sempre é o degrau seguinte: há peso para sair a MESMA
 * raridade. É o que faz uma fusão bem-sucedida ainda ser uma boa notícia sem
 * ser garantia — e o que mantém o jogador fundindo em vez de fazer a conta uma
 * vez e parar.
 */
export const RECEITAS: readonly ReceitaDeFusao[] = [
  {
    id: 'comum_incomum',
    nome: 'Síntese Básica',
    entrada: 0, quantidade: 10, chance: 0.85, nucleos: 40,
    custo: { ferrita: 200 },
    resultados: [{ raridade: 1, peso: 85 }, { raridade: 0, peso: 15 }],
    nota: 'Dez Comuns viram uma tentativa de Incomum.',
  },
  {
    id: 'incomum_raro',
    nome: 'Síntese Ligada',
    entrada: 1, quantidade: 8, chance: 0.7, nucleos: 120,
    custo: { ferrita: 400, titanio: 60 },
    resultados: [{ raridade: 2, peso: 80 }, { raridade: 1, peso: 20 }],
    nota: 'Oito Incomuns, com liga de titânio.',
  },
  {
    id: 'raro_epico',
    nome: 'Transmutação',
    entrada: 2, quantidade: 6, chance: 0.55, nucleos: 400,
    custo: { titanio: 150, cristal_quantico: 20 },
    resultados: [{ raridade: 3, peso: 75 }, { raridade: 2, peso: 25 }],
    nota: 'Seis Raros e cristal quântico.',
  },
  {
    id: 'epico_lendario',
    nome: 'Fusão Estelar',
    entrada: 3, quantidade: 5, chance: 0.4, nucleos: 1200,
    custo: { cristal_quantico: 60, aco_estelar: 25 },
    resultados: [{ raridade: 4, peso: 70 }, { raridade: 3, peso: 30 }],
    nota: 'Cinco Épicos e aço estelar.',
  },
  {
    id: 'lendario_mitico',
    nome: 'Convergência',
    entrada: 4, quantidade: 4, chance: 0.28, nucleos: 4000,
    custo: { aco_estelar: 80, nucleo_de_energia: 12 },
    resultados: [{ raridade: 5, peso: 65 }, { raridade: 4, peso: 35 }],
    nota: 'Quatro Lendários e núcleos de energia — só chefe solta.',
  },
  {
    id: 'mitico_divino',
    nome: 'Singularidade Contida',
    entrada: 5, quantidade: 3, chance: 0.15, nucleos: 14_000,
    custo: { fragmento_divino: 5, essencia_primordial: 3 },
    resultados: [{ raridade: 6, peso: 60 }, { raridade: 5, peso: 40 }],
    nota: 'Três Míticos, fragmento divino e essência primordial.',
  },
];

export const RECEITA_POR_ENTRADA = new Map(RECEITAS.map((r) => [r.entrada, r]));

/** A receita que consome itens desta raridade, se houver. */
export const receitaPara = (r: Rarity): ReceitaDeFusao | undefined =>
  RECEITA_POR_ENTRADA.get(r);

/**
 * Nível do item resultante, dado os que entraram.
 *
 * Média, e não o MAIOR: com o maior, fundir nove lixos de nível 1 com um bom de
 * nível 270 devolveria um item de nível 270 por quase nada. A média faz a
 * qualidade do que entra importar.
 */
export function ilvlDaFusao(ilvls: readonly number[]): number {
  if (!ilvls.length) return 1;
  return Math.max(1, Math.round(ilvls.reduce((s, n) => s + n, 0) / ilvls.length));
}
