/**
 * Capacidade de carga — itens e recursos (§28, §29).
 *
 * O inventário NASCE apertado e cresce por conquista. É a diferença entre um
 * depósito e um recurso administrado: com 70 espaços desde o primeiro minuto,
 * "guardar ou desmanchar" nunca é uma decisão, e o auto-desmanche vira o único
 * jeito de o jogador interagir com o próprio loot. Com 15, cada peça que fica
 * custa o lugar de outra.
 *
 * O crescimento é o que dá utilidade a sistemas que ainda não existem: loja,
 * missões, conquistas. Por isso as fontes ficam num REGISTRO aberto em vez de
 * somadas à mão — cadastrar a primeira missão que dá espaço não pode exigir
 * mexer na fórmula de capacidade.
 */

// ── itens ───────────────────────────────────────────────────────────────────

/** Espaços com que o jogador começa. Grade 5 × 3. */
export const CARGA_INICIAL = 15;

/** Teto absoluto. Grade 7 × 10 — o formato que o painel foi desenhado para ter. */
export const CARGA_MAXIMA = 70;

/** Colunas da grade quando ela ainda é estreita, e quando já cresceu. */
export const COLUNAS_MIN = 5;
export const COLUNAS_MAX = 7;

/**
 * Até que capacidade a grade fica estreita.
 *
 * Cresce primeiro em ALTURA e só depois em largura: alargar cedo faria a grade
 * mudar de forma a cada compra, e a memória visual de onde cada item fica —
 * que é metade do valor de um inventário em grade — se perderia toda vez.
 */
export const CAPACIDADE_ESTREITA = COLUNAS_MIN * 7;

/** Colunas que a grade deve ter para uma dada capacidade. */
export function colunasDaGrade(capacidade: number): number {
  return capacidade <= CAPACIDADE_ESTREITA ? COLUNAS_MIN : COLUNAS_MAX;
}

/** Linhas visíveis, para o painel reservar altura sem contar filhos. */
export function linhasDaGrade(capacidade: number): number {
  return Math.max(1, Math.ceil(capacidade / colunasDaGrade(capacidade)));
}

// ── de onde vêm os espaços ──────────────────────────────────────────────────

export type FonteDeCarga = 'loja' | 'missao' | 'conquista' | 'chefe' | 'universo';

export interface ConcessaoDeCarga {
  /** Id estável. É o que o save guarda; nunca reaproveitar um id retirado. */
  id: string;
  fonte: FonteDeCarga;
  /** Quantos espaços de ITEM concede. */
  itens?: number;
  /** Quantos espaços de RECURSO concede — o §29 separa os dois depósitos. */
  recursos?: number;
  /** Texto curto para o painel explicar de onde veio. */
  nota: string;
}

/**
 * O registro de concessões.
 *
 * Vazio de propósito para `missao` e `conquista`: esses sistemas são da Fase 5.
 * O que existe agora é o MECANISMO — cadastrar a primeira missão que dá espaço
 * será acrescentar uma linha aqui, e não mexer em `cargoSlots`.
 *
 * A soma das concessões mais `CARGA_INICIAL` não precisa fechar exatamente em
 * `CARGA_MAXIMA`: o teto é aplicado por cima. Ficar abaixo é normal enquanto o
 * conteúdo não existe; passar do teto é o sinal de que há concessão demais, e
 * um teste guarda isso.
 */
export const CONCESSOES: readonly ConcessaoDeCarga[] = [
  { id: 'loja_carga_1', fonte: 'loja', itens: 5, recursos: 5, nota: 'Compartimento auxiliar' },
  { id: 'loja_carga_2', fonte: 'loja', itens: 5, recursos: 5, nota: 'Porão reforçado' },
  { id: 'loja_carga_3', fonte: 'loja', itens: 5, recursos: 5, nota: 'Doca de contenção' },
  { id: 'loja_carga_4', fonte: 'loja', itens: 5, recursos: 5, nota: 'Baia modular' },
  { id: 'chefe_g1', fonte: 'chefe', itens: 5, recursos: 5, nota: 'Primeiro chefe de galáxia' },
  { id: 'chefe_g5', fonte: 'chefe', itens: 5, recursos: 5, nota: 'Chefe da quinta galáxia' },
  { id: 'chefe_g10', fonte: 'chefe', itens: 5, recursos: 5, nota: 'Chefe da décima galáxia' },
  { id: 'universo_2', fonte: 'universo', itens: 10, recursos: 10, nota: 'Segundo universo' },
  { id: 'universo_3', fonte: 'universo', itens: 10, recursos: 10, nota: 'Terceiro universo' },
  // Missões (§27). A fonte já estava prevista aqui desde a 3.7 — faltava quem
  // concedesse. As três somam 15 e são a via mais barata de ampliar a carga, o
  // que é de propósito: missão é a fonte que o jogador CONTROLA.
  { id: 'missao_carga_1', fonte: 'missao', itens: 5, recursos: 5, nota: 'Linha de Suprimento' },
  { id: 'missao_carga_2', fonte: 'missao', itens: 5, recursos: 5, nota: 'Encomenda da Doca' },
  { id: 'missao_carga_3', fonte: 'missao', itens: 5, recursos: 5, nota: 'Salto Interestelar' },
];

export const CONCESSAO_POR_ID = new Map(CONCESSOES.map((c) => [c.id, c]));

/** Capacidade de ITENS, dada a lista de concessões já obtidas. */
export function capacidadeDeItens(obtidas: readonly string[]): number {
  let n = CARGA_INICIAL;
  for (const id of obtidas) n += CONCESSAO_POR_ID.get(id)?.itens ?? 0;
  return Math.min(CARGA_MAXIMA, n);
}

// ── recursos ────────────────────────────────────────────────────────────────

/**
 * O depósito de RECURSOS é separado do de itens (§29), e cresce junto.
 *
 * Separado porque são decisões diferentes: descartar um item é escolher entre
 * duas peças, e estourar o depósito de sucata é perder renda passiva. Misturar
 * os dois faria uma corrida boa de recursos comer o espaço do loot.
 */
export const RECURSO_INICIAL = 15;
export const RECURSO_MAXIMO = 70;

export function capacidadeDeRecursos(obtidas: readonly string[]): number {
  let n = RECURSO_INICIAL;
  for (const id of obtidas) n += CONCESSAO_POR_ID.get(id)?.recursos ?? 0;
  return Math.min(RECURSO_MAXIMO, n);
}
