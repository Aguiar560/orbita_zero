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
 * SEMPRE DEZ ITENS, do Comum ao Divino. A quantidade fixa é o que torna a
 * escada legível: o jogador aprende a regra uma vez e ela vale em todo degrau.
 * O que muda de um degrau para o outro é a CHANCE e o CUSTO.
 *
 * A chance despenca no topo — 85%, 60%, 38%, 20%, 7%, 3%. Mítico e Divino são
 * para ser extremamente difíceis, e a conta composta mostra por quê: sair de
 * dez Comuns até um Divino exige, no caminho direto, 100 mil peças comuns.
 *
 * O custo em recurso sobe junto e muda de família: os degraus altos pedem
 * material que só chefe solta, o que amarra a fusão ao conteúdo em vez de
 * deixá-la acontecer sozinha no inventário.
 *
 * Os quatro primeiros degraus têm CONSOLAÇÃO — peso para sair a mesma raridade
 * —, o que faz uma fusão bem-sucedida ser boa notícia sem ser garantia. Os dois
 * últimos NÃO têm: com 7% e 3% de chance, dividir o sucesso outra vez tornaria
 * o número anunciado uma mentira. Lá em cima, acertar é subir.
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
    entrada: 1, quantidade: 10, chance: 0.6, nucleos: 150,
    custo: { ferrita: 500, titanio: 80 },
    resultados: [{ raridade: 2, peso: 80 }, { raridade: 1, peso: 20 }],
    nota: 'Dez Incomuns, com liga de titânio.',
  },
  {
    id: 'raro_epico',
    nome: 'Transmutação',
    entrada: 2, quantidade: 10, chance: 0.38, nucleos: 600,
    custo: { titanio: 250, cristal_quantico: 40 },
    resultados: [{ raridade: 3, peso: 75 }, { raridade: 2, peso: 25 }],
    nota: 'Dez Raros e cristal quântico.',
  },
  {
    id: 'epico_lendario',
    nome: 'Fusão Estelar',
    entrada: 3, quantidade: 10, chance: 0.2, nucleos: 2500,
    custo: { cristal_quantico: 120, aco_estelar: 60 },
    resultados: [{ raridade: 4, peso: 80 }, { raridade: 3, peso: 20 }],
    nota: 'Dez Épicos e aço estelar.',
  },
  {
    id: 'lendario_mitico',
    nome: 'Convergência',
    entrada: 4, quantidade: 10, chance: 0.07, nucleos: 12_000,
    custo: { aco_estelar: 200, nucleo_de_energia: 40 },
    // Sem consolação: com 7% de chance, dividir o sucesso outra vez tornaria o
    // número anunciado uma mentira. Aqui acertar É subir de raridade.
    resultados: [{ raridade: 5, peso: 100 }],
    nota: 'Dez Lendários e núcleos de energia — só chefe solta.',
  },
  {
    id: 'mitico_divino',
    nome: 'Singularidade Contida',
    entrada: 5, quantidade: 10, chance: 0.03, nucleos: 60_000,
    custo: { fragmento_divino: 25, essencia_primordial: 15 },
    resultados: [{ raridade: 6, peso: 100 }],
    nota: 'Dez Míticos, fragmento divino e essência primordial.',
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
