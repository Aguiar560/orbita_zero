/**
 * Tiers de afixo, T1 a T10 (§6).
 *
 * Cada linha de um item rola num TIER, e o tier é o que decide a magnitude
 * daquela linha. Antes a magnitude vinha de duas fontes ao mesmo tempo — uma
 * rolagem uniforme dentro da faixa do afixo, multiplicada pelo `power` da
 * raridade — e nenhuma das duas era legível na ficha: dois itens Épicos com
 * "+Dano" podiam diferir 3× sem nada na tela explicando por quê.
 *
 * Com tier, "T8 de Dano" é uma frase completa. E é o que dá o que caçar depois
 * que a raridade já saiu boa: um Divino T4 é um item de transição, um Divino
 * T10 é o fim da busca daquele slot.
 *
 * Por isso `power` sai de cena como multiplicador de afixo. A raridade continua
 * mandando em três eixos — quantas linhas (`afixos`), até onde elas podem subir
 * (`tierMax`) e a chance de conjunto —, mas a magnitude POR LINHA é do tier.
 * Deixar os dois multiplicando faria a raridade contar duas vezes, e um Divino
 * T10 sairia 7× acima do que a curva de poder pressupõe.
 */

/** Quantos tiers existem. T1 é o mais fraco, T10 o mais forte. */
export const TIERS = 10;

/**
 * Multiplicador de magnitude de cada tier, do T1 ao T10.
 *
 * Geométrico de 1,0 a 7,0 — deliberadamente a mesma escada que o `power` das
 * sete raridades percorria (1,0 · 1,3 · 1,75 · 2,4 · 3,4 · 4,9 · 7,0). Assim o
 * TETO do jogo não se move ao trocar o modelo: o que muda é que chegar nele
 * passa a ser uma rolagem, e não um efeito colateral da raridade.
 */
export const fatorDoTier = (tier: number): number =>
  Math.pow(7, (clampTier(tier) - 1) / (TIERS - 1));

/**
 * Nível de item mínimo para cada tier aparecer.
 *
 * Tabela à mão, e não fórmula, porque este é o eixo que decide quando cada
 * faixa do jogo "abre" — é para ser lido e ajustado de relance, sem resolver um
 * expoente de cabeça. O índice é `tier - 1`.
 *
 * O topo (T10) abre em ilvl 160, o que pela `curvaIlvl` cai por volta do setor
 * 178: sobra mais de um terço do jogo caçando o tier máximo depois que ele
 * passa a existir. Abrir mais cedo esvaziaria o fim do jogo; mais tarde faria a
 * caçada começar quando quase não há setor sobrando.
 */
export const TIER_ILVL: readonly number[] = [1, 5, 14, 27, 45, 66, 91, 119, 148, 160];

/** O maior tier que este nível de item permite. */
export function tierPorIlvl(ilvl: number): number {
  let teto = 1;
  for (let t = TIERS; t >= 1; t--) {
    if (ilvl >= (TIER_ILVL[t - 1] ?? Infinity)) { teto = t; break; }
  }
  return teto;
}

/**
 * Quantos tiers abaixo do teto ainda podem sair.
 *
 * A janela é o que impede o fim do jogo de continuar soltando T1. Sem ela, um
 * item de ilvl 270 sortearia entre dez tiers e quase sempre cairia num baixo —
 * itens de nível alto seriam PIORES que os de hoje, que é o contrário do que
 * subir de setor tem de significar.
 */
export const JANELA_DE_TIERS = 4;

/**
 * Peso de cada tier da janela, indexado pela DISTÂNCIA ATÉ O TETO.
 *
 * Índice 0 é o próprio teto e leva o menor peso: o tier máximo sai em 10% das
 * linhas. É o número que separa "achei um Divino" de "achei O Divino" — o
 * suficiente para a caçada existir sem transformar cada peça boa em loteria.
 */
const PESOS_DA_JANELA: readonly number[] = [1, 2, 3, 4];

/**
 * Os tiers que uma linha pode rolar, dado o nível do item e o teto da raridade.
 *
 * Devolve pares `[tier, peso]` já prontos para o sorteio ponderado.
 */
export function tiersDisponiveis(ilvl: number, tierMax: number): { tier: number; peso: number }[] {
  const teto = Math.min(clampTier(tierMax), tierPorIlvl(ilvl));
  const piso = Math.max(1, teto - JANELA_DE_TIERS + 1);

  const out: { tier: number; peso: number }[] = [];
  for (let t = piso; t <= teto; t++) {
    // Indexado pela distância ATÉ O TETO, não pela posição no vetor: perto do
    // começo do jogo a janela é mais curta que `JANELA_DE_TIERS`, e indexar
    // pelo fundo faria o teto herdar o peso do fundo — o tier máximo sairia na
    // MAIORIA das linhas justo onde ele deveria ser conquista.
    out.push({ tier: t, peso: PESOS_DA_JANELA[teto - t] ?? PESOS_DA_JANELA[PESOS_DA_JANELA.length - 1]! });
  }
  return out;
}

function clampTier(tier: number): number {
  return Math.min(TIERS, Math.max(1, Math.round(tier)));
}
