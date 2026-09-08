import { PERSONAGENS, type PersonagemDef } from '@data/personagens';
import type { Rarity } from '@sim/types';

/**
 * O TIER de um contato: escondido do jogador, sentido na recompensa.
 *
 * ## Por que derivado da galáxia, e não escrito 33 vezes
 *
 * Todo contato pertence a uma galáxia — os 33 de hoje cobrem as 30, sem
 * exceção. A galáxia já ordena o jogo inteiro: dificuldade, nível de item,
 * material. Escrever um tier à mão ao lado disso criaria uma segunda ordem,
 * livre para discordar da primeira no dia em que alguém mexesse numa e
 * esquecesse da outra.
 *
 * `tier` explícito na definição do contato continua vencendo, para o caso em
 * que a história pedir um contato pequeno numa galáxia grande — ou o contrário.
 * A porta existe; o padrão é a derivação.
 *
 * ## Por que ESCONDIDO
 *
 * Porque o tier não é uma decisão do jogador: ele não escolhe contato por
 * número. Mostrá-lo transformaria a escolha de "com quem eu quero trabalhar"
 * em "qual dá mais", e a barra de confiança perderia o sentido junto — ela
 * mede vínculo, e vínculo não se compara em tabela.
 *
 * O jogador PERCEBE o tier: as recompensas crescem, e a peça no fim da cadeia
 * é Lendária em vez de Épica. Ele só não lê o número.
 */

/** Quantas galáxias cabem em cada degrau. 30 galáxias ÷ 5 tiers. */
const GALAXIAS_POR_TIER = 6;

export const TIER_MAX = 5;

export function tierDoContato(p: PersonagemDef): number {
  const explicito = (p as { tier?: number }).tier;
  if (typeof explicito === 'number') return Math.max(1, Math.min(TIER_MAX, explicito));
  const galaxia = Math.max(0, p.galaxia ?? 0);
  return Math.max(1, Math.min(TIER_MAX, Math.floor(galaxia / GALAXIAS_POR_TIER) + 1));
}

export const tierDoContatoPorId = (id: string): number => {
  const p = PERSONAGENS.find((x) => x.id === id);
  return p ? tierDoContato(p) : 1;
};

/**
 * Quanto o tier multiplica a recompensa em moeda, material e XP.
 *
 * Meio ponto por degrau: T1 paga o valor escrito na missão, T5 paga o triplo.
 * Não é exponencial de propósito — a curva de dificuldade da galáxia já é
 * íngreme, e multiplicar uma coisa íngreme por outra íngreme produz o salto que
 * faz o conteúdo antigo virar perda de tempo.
 *
 * O ITEM não entra aqui: item é poder, e poder tem orçamento próprio. O tier
 * mexe no item por outra porta, mais legível — a raridade da peça exclusiva.
 */
export const multiplicadorDoTier = (tier: number): number =>
  1 + (Math.max(1, Math.min(TIER_MAX, tier)) - 1) * 0.5;

/**
 * A raridade da peça que fecha a cadeia de um contato.
 *
 * Épico até o tier 2, Lendário nos 3 e 4, **Mítico no 5**.
 *
 * ## Sobre o Mítico no topo
 *
 * Eu havia proposto parar no Lendário, com o argumento de que o Mítico é o teto
 * da Provação (piso 90) e uma segunda fonte o esvaziaria. O Rafael decidiu
 * incluí-lo em 07/09, e o desenho aguenta: são SEIS contatos no tier 5, cada um
 * com uma cadeia inteira até o fim, nas galáxias 25 a 30. Não é uma fonte
 * paralela de Mítico — é o prêmio de terminar o conteúdo mais profundo do jogo,
 * uma vez por contato.
 *
 * ## O Divino continua fora, e por um motivo diferente do que eu disse antes
 *
 * Eu havia escrito que ele "só sai da fusão". Está errado: o Divino CAI, com
 * peso 0,00323 contra 10.000 do Comum. Medido em 07/09 com
 * `npm run simular -- drops`: 1 em 3,56 milhões de sorteios sem Sorte, e 1 em
 * 300 mil no teto do atributo. O alvo escrito em `raridades.ts` é "de 1000
 * jogadores no teto, uns 20 com um Divino".
 *
 * A razão de ele ficar fora daqui é outra, e mais forte: uma peça garantida no
 * fim de uma cadeia de missões é o oposto de 1 em 300 mil. Não competiria com a
 * fusão — apagaria a raridade inteira, que é a única do jogo cuja graça é ser
 * quase inalcançável. O Mítico aguenta ser prêmio de conteúdo profundo; o
 * Divino, não.
 */
export function raridadeExclusivaDoTier(tier: number): Rarity {
  if (tier >= TIER_MAX) return 5 as Rarity;
  return (tier >= 3 ? 4 : 3) as Rarity;
}
