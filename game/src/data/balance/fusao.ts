import type { Rarity } from '@sim/types';

/**
 * Sacrifício e fusão de itens (§26).
 *
 * O problema que resolve: no fim do jogo, um drop Comum é lixo. Ele ocupa um
 * dos 15 a 70 espaços do inventário e o único destino é desmanchar por núcleos.
 * Com fusão, dez lixos viram uma tentativa — e é isso que mantém o drop
 * inferior relevante em qualquer ponto da curva.
 *
 * **Sempre sai um item — o que se aposta é a RARIDADE dele.** Dez Lendários dão
 * um Mítico em 7% das vezes e um Lendário nas outras 93%. Não existe perda
 * total.
 *
 * O risco não sumiu: ele mora na razão 10 para 1. Cada tentativa devora nove
 * itens líquidos, e é isso que impede a fusão de virar uma calculadora sem
 * consequência. O que sumiu foi a perda SECA — sacrificar dez Lendários e
 * receber nada, que era o desfecho mais provável no topo (93% das vezes) e
 * transformava o degrau final numa parede em vez de um caminho longo.
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
 * A chance de SUBIR despenca no topo — 72%, 48%, 30%, 15%, 7%, 3%. Os pesos
 * dizem a história inteira: o que não sobe sai na raridade de ENTRADA. Não
 * existe campo de "chance de não falhar" porque não existe mais falha — existia,
 * e ele servia só para separar duas ideias que hoje são uma.
 *
 * O custo real de um degrau é `(quantidade - 1 + p) / p` itens de entrada, e não
 * `quantidade / p`: a tentativa que não sobe devolve uma peça. Dá 13,5 Comuns
 * por Incomum e 301 Míticos por Divino. Encadeado do Comum até o Divino são
 * ~19,7 bilhões de peças comuns — Mítico e Divino seguem sendo o que o §26 pede,
 * extremamente difíceis, agora por DISTÂNCIA e não por confisco.
 *
 * O custo em recurso sobe junto e muda de família: os degraus altos pedem
 * material que só chefe solta, o que amarra a fusão ao conteúdo em vez de
 * deixá-la acontecer sozinha no inventário.
 */
export const RECEITAS: readonly ReceitaDeFusao[] = [
  {
    id: 'comum_incomum',
    nome: 'Síntese Básica',
    entrada: 0, quantidade: 10, nucleos: 40,
    custo: { ferrita: 200 },
    resultados: [{ raridade: 1, peso: 72 }, { raridade: 0, peso: 28 }],
    nota: 'Dez Comuns viram uma tentativa de Incomum.',
  },
  {
    id: 'incomum_raro',
    nome: 'Síntese Ligada',
    entrada: 1, quantidade: 10, nucleos: 150,
    custo: { ferrita: 500, titanio: 80 },
    resultados: [{ raridade: 2, peso: 48 }, { raridade: 1, peso: 52 }],
    nota: 'Dez Incomuns, com liga de titânio.',
  },
  {
    id: 'raro_epico',
    nome: 'Transmutação',
    entrada: 2, quantidade: 10, nucleos: 600,
    custo: { titanio: 250, cristal_quantico: 40 },
    resultados: [{ raridade: 3, peso: 30 }, { raridade: 2, peso: 70 }],
    nota: 'Dez Raros e cristal quântico.',
  },
  {
    id: 'epico_lendario',
    nome: 'Fusão Estelar',
    entrada: 3, quantidade: 10, nucleos: 2500,
    custo: { cristal_quantico: 120, aco_estelar: 60 },
    resultados: [{ raridade: 4, peso: 15 }, { raridade: 3, peso: 85 }],
    nota: 'Dez Épicos e aço estelar.',
  },
  {
    id: 'lendario_mitico',
    nome: 'Convergência',
    entrada: 4, quantidade: 10, nucleos: 12_000,
    custo: { aco_estelar: 200, nucleo_de_energia: 40 },
    // 7 em 100 sobem; os outros 93 devolvem um Lendário. É o degrau que mais
    // ganha com a mudança: antes, 93% das vezes dez Lendários viravam nada.
    resultados: [{ raridade: 5, peso: 7 }, { raridade: 4, peso: 93 }],
    nota: 'Dez Lendários e núcleos de energia — só chefe solta.',
  },
  {
    id: 'mitico_divino',
    nome: 'Singularidade Contida',
    entrada: 5, quantidade: 10, nucleos: 60_000,
    custo: { fragmento_divino: 25, essencia_primordial: 15 },
    resultados: [{ raridade: 6, peso: 3 }, { raridade: 5, peso: 97 }],
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

/**
 * Chance REAL de sair um item de raridade superior.
 *
 * É este o número que a tela mostra, e o único que o jogador precisa: ele não
 * está apostando em "não falhar" — sempre sai item —, está apostando em subir
 * de raridade.
 *
 * Continua sendo função dos pesos em vez de um campo à parte porque um número
 * copiado ao lado da tabela é um número que um dia discorda dela.
 */
export function chanceDeSubir(r: ReceitaDeFusao): number {
  const total = r.resultados.reduce((s, x) => s + x.peso, 0) || 1;
  const sobe = r.resultados
    .filter((x) => x.raridade > r.entrada)
    .reduce((s, x) => s + x.peso, 0);
  return sobe / total;
}
