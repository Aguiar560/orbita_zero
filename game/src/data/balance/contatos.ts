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
 * Épico nos tiers baixos, Lendário nos altos — a decisão do Rafael em 07/09.
 * O corte fica no meio da escada: quem trabalha para um contato das primeiras
 * doze galáxias termina com uma peça Épica; das galáxias 13 em diante, Lendária.
 *
 * Mítico e Divino NÃO entram: o Mítico é o teto da Provação (piso 90) e o
 * Divino só sai da fusão, a 301 Míticos por Divino. Se a última missão de um
 * contato pagasse Divino, os dois sistemas que existem para isso viravam
 * enfeite.
 */
export function raridadeExclusivaDoTier(tier: number): Rarity {
  return (tier >= 3 ? 4 : 3) as Rarity;
}
