import { ELEMENT_IDS, type ElementId } from '@sim/types';

/**
 * A matriz de confronto elemental (§5) e as constantes de dano (§3, §4).
 *
 * Antes o confronto era uma FUNÇÃO com três `if` encadeados sobre o campo
 * `bate` de `elements.ts`. Funcionava, mas não era configurável: a única forma
 * de dizer "fogo bate gelo por 1,4 e não por 1,5" era reescrever a regra, e não
 * havia como criar uma exceção — "cósmico é neutro contra tudo", por exemplo —
 * sem quebrar a simetria do anel para todo mundo.
 *
 * Aqui a matriz é uma TABELA, gerada do anel na carga e ajustável célula a
 * célula. O anel continua sendo a fonte da forma; a tabela é onde as exceções
 * podem morar sem virar `if`.
 */

// ── o anel ──────────────────────────────────────────────────────────────────

/**
 * A ordem do anel: cada elemento castiga o SEGUINTE, e o último volta ao
 * primeiro. Fogo → gelo → cósmico → raio → químico → fogo.
 *
 * Mora aqui e não em `data/elements.ts` por dois motivos. O primeiro é de
 * camada: o anel é balanceamento, e `elements.ts` é apresentação — cor, sprite,
 * sigla, texto. O segundo é concreto: `elements.ts` precisa importar o
 * confronto para os painéis, então o módulo de balanceamento não pode importar
 * de volta. O ciclo trava o boot com `ELEMENTS` ainda indefinido, que foi
 * exatamente como este arquivo quebrou os cinco arquivos de teste de uma vez.
 *
 * `padrao` fica fora de propósito: é o dano sem apostas.
 */
export const ANEL: readonly ElementId[] = ['fogo', 'gelo', 'cosmico', 'raio', 'quimico'];

/** Quem `e` castiga. `null` para quem está fora do anel. */
export function bateDe(e: ElementId): ElementId | null {
  const i = ANEL.indexOf(e);
  return i < 0 ? null : ANEL[(i + 1) % ANEL.length]!;
}

// ── multiplicadores do anel ─────────────────────────────────────────────────

/** Atacar quem o seu elemento castiga. */
export const VANTAGEM = 1.5;
/** Atacar quem castiga o seu elemento. */
export const DESVANTAGEM = 0.7;
/**
 * Atacar o próprio elemento.
 *
 * Uma nave de fogo resiste naturalmente ao fogo. Não é 1,0 porque isso tornaria
 * "atirar no espelho" indistinguível de neutro, e o jogador perderia a leitura
 * de que trocar de arma importa.
 */
export const ESPELHO = 0.75;

/**
 * Teto e piso do multiplicador de confronto.
 *
 * O anel sozinho vive entre 0,7 e 1,5, mas penetração e afixos podem empurrá-lo.
 * Sem teto, empilhar fontes elementais transformaria o encontro certo numa
 * execução instantânea, que é o que o §40 existe para impedir.
 */
export const CONFRONTO_MAX = 2.5;
export const CONFRONTO_MIN = 0.25;

/**
 * A matriz, indexada `[ataque][defesa]`.
 *
 * Gerada do anel: `bate` define quem leva 1,5, o inverso leva 0,7, igual leva
 * 0,75, e `padrao` sai e entra sempre em 1,0 — nem como atacante nem como
 * defensor ele participa. Editar uma célula aqui é o jeito previsto de criar
 * uma exceção.
 */
export const MATRIZ_ELEMENTAL: Record<ElementId, Record<ElementId, number>> = (() => {
  const m = {} as Record<ElementId, Record<ElementId, number>>;
  for (const ataque of ELEMENT_IDS) {
    m[ataque] = {} as Record<ElementId, number>;
    for (const defesa of ELEMENT_IDS) {
      m[ataque][defesa] = celulaDoAnel(ataque, defesa);
    }
  }
  return m;
})();

function celulaDoAnel(ataque: ElementId, defesa: ElementId): number {
  if (ataque === 'padrao' || defesa === 'padrao') return 1;
  if (ataque === defesa) return ESPELHO;
  if (bateDe(ataque) === defesa) return VANTAGEM;
  if (bateDe(defesa) === ataque) return DESVANTAGEM;
  return 1;
}

/**
 * Quanto do golpe de um inimigo ELEMENTAL é, de fato, elemental.
 *
 * O inimigo obedece ao mesmo §3 que o jogador: o golpe dele também é
 * `normal + elemental`. Sem isso, uma nave com 75% de resistência a fogo ficaria
 * praticamente imune a uma galáxia inteira, porque a resistência multiplicava o
 * golpe INTEIRO.
 *
 * 0,6 e não 1,0: sobra um terço e pouco de dano irresistível em todo golpe
 * elemental, então resistência é mitigação forte e nunca imunidade. Inimigo
 * neutro entrega 100% normal — é o que o mantém perigoso contra quem investiu
 * tudo em resistência.
 */
export const FRACAO_ELEMENTAL_INIMIGA = 0.6;

/**
 * Teto da fatia ELEMENTAL do dano do jogador (§3, §40).
 *
 * "Não transformar todo o dano da nave em elemental" é uma restrição sobre o
 * RESULTADO, então quem a garante tem de ser um teto sobre o resultado — não
 * faixas estreitas de afixo. Tentei pelas faixas primeiro: para cinco potências
 * empilhadas no T10 caberem, `max` teria de cair abaixo de 0,036, e aí o
 * crítico elemental voltava a valer zero por falta de base sobre que agir. Um
 * teto liberta as faixas.
 *
 * Medido sem ele: seis potências no tier máximo davam 74% de dano elemental.
 *
 * 0,6 e não 0,5: uma build declaradamente elemental merece ficar
 * majoritariamente elemental. O que o teto protege é a EXISTÊNCIA do
 * componente normal — 40% do dano continua atravessando resistência e anel,
 * então nenhum inimigo é imune a quem apostou tudo num elemento.
 */
export const FRACAO_ELEMENTAL_MAX = 0.6;

// ── crítico elemental (§4) ──────────────────────────────────────────────────

/**
 * O crítico elemental é SEPARADO do normal, e rola separado.
 *
 * Duas rolagens, não uma: com uma só, um tiro seria inteiramente crítico ou
 * inteiramente não, e a separação entre os componentes não teria consequência
 * nenhuma no combate — seria contabilidade. Com duas, acontece de a parte
 * elemental crititar e a normal não, e é isso que faz valer investir num
 * crítico e não no outro.
 */
/**
 * A base é ALTA — 0,15 contra os 0,03 do crítico normal — e isso não é
 * generosidade, é compensação de fonte.
 *
 * O crítico normal tem um alimentador implícito: o slot `controle` dá
 * `critChance` por nível de item, então qualquer nave montada chega perto do
 * teto sem ter rolado um único afixo de crítico. O elemental não tem nada
 * equivalente. Com base 0,02 medido, o afixo de DANO crítico elemental valia
 * 0,05× a mediana — dano crítico não vale nada sem chance de crítico, e a
 * chance só vinha do próprio par de afixos.
 *
 * Dar um implícito a ele resolveria também, mas custaria um slot inteiro do
 * orçamento de implícitos. A base carrega o papel.
 */
export const CRIT_ELEM_BASE = 0.15;
export const CRIT_ELEM_DANO_BASE = 0.4;

// ── penetração (§4) ─────────────────────────────────────────────────────────

/**
 * Quanto a penetração pode anular de uma DESVANTAGEM.
 *
 * Penetração puxa o multiplicador de volta na direção de 1,0 quando ele está
 * abaixo — ela não cria vantagem, só apaga a resistência. `mult + (1 - mult) ×
 * penetração`, com penetração em 0..1.
 *
 * O teto existe porque penetração total tornaria a escolha de elemento
 * irrelevante: bastaria empilhar penetração e atirar em qualquer coisa. Em 0,8
 * o pior confronto sai de 0,70 para 0,94 — quase neutro, nunca melhor.
 */
export const PENETRACAO_MAX = 0.8;

/**
 * Multiplicador final de `ataque` contra `defesa`, já com penetração e teto.
 *
 * Penetração só age contra o que REDUZ o dano. Deixá-la amplificar vantagem
 * faria a build ótima ser "elemento certo + penetração máxima" em vez de uma
 * escolha entre os dois.
 */
export function confronto(ataque: ElementId, defesa: ElementId, penetracao = 0): number {
  const base = MATRIZ_ELEMENTAL[ataque]?.[defesa] ?? 1;
  const p = Math.min(PENETRACAO_MAX, Math.max(0, penetracao));
  const comPenetracao = base < 1 ? base + (1 - base) * p : base;
  return Math.min(CONFRONTO_MAX, Math.max(CONFRONTO_MIN, comPenetracao));
}
