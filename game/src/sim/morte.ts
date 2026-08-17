import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import type { GameState, NivelProgresso } from './types';

/**
 * A punição por morrer.
 *
 * Fica num módulo próprio porque é a regra mais delicada do jogo: mexe em
 * nível, XP, Matriz e saldo ao mesmo tempo, e um erro aqui apaga horas de
 * progresso de alguém. Isolada, dá para testar cada perda em separado.
 *
 * O que NÃO se perde: itens. O que caiu, caiu — o jogador arriscou a incursão,
 * não o inventário.
 */

/** Fração do XP da faixa atual perdida a cada morte. */
export const XP_PERDIDO = 0.15;

/** Fração da sucata JÁ DEPOSITADA perdida a cada morte. */
export const SUCATA_PERDIDA = 0.1;

export interface PerdaDeNivel {
  /** XP subtraído no total. */
  xp: number;
  /** Quantos níveis caíram. */
  niveis: number;
}

/**
 * Aplica a perda de XP a um progresso de nível.
 *
 * `xp` guarda o acumulado DENTRO da faixa do nível atual, e é sobre ele que a
 * fração incide — como no exemplo do pedido: no nível 10, com 200 acumulados de
 * uma faixa de 400, a morte tira 30.
 *
 * Quando a faixa já está zerada, a morte passa a cobrar do nível anterior: cai
 * um nível e o jogador reaparece no topo da faixa de baixo, já descontado.
 * Sem essa regra o acumulado só encolheria assintoticamente e ninguém jamais
 * perderia um nível, o que contraria o pedido.
 */
export function aplicarPerdaDeXp(
  progresso: NivelProgresso,
  faixaDe: (nivel: number) => number,
  fracao = XP_PERDIDO,
): PerdaDeNivel {
  // Uma faixa "vazia" não é exatamente zero: o XP é fracionário e sobra poeira.
  const VAZIO = 1;

  if (progresso.xp >= VAZIO) {
    const perda = progresso.xp * fracao;
    progresso.xp -= perda;
    return { xp: perda, niveis: 0 };
  }

  if (progresso.nivel <= 1) {
    // Nível 1 é o piso: não há de onde tirar.
    const perda = progresso.xp;
    progresso.xp = 0;
    return { xp: perda, niveis: 0 };
  }

  progresso.nivel--;
  const faixa = faixaDe(progresso.nivel);
  const perda = faixa * fracao;
  progresso.xp = faixa - perda;
  return { xp: perda + VAZIO, niveis: 1 };
}

export interface ResumoDaMorte {
  xpPersonagem: number;
  niveisPersonagem: number;
  xpNave: number;
  niveisNave: number;
  /** Nós da Matriz devolvidos por queda de nível. */
  nosDevolvidos: string[];
  sucata: number;
}

/**
 * Cobra tudo o que a morte cobra, menos a carga da incursão — essa é
 * descartada por quem chama, junto com o reinício do setor.
 */
export function cobrarMorte(state: GameState): ResumoDaMorte {
  const personagem = aplicarPerdaDeXp(state.command, curvaXpPersonagem);

  const nave = state.naves[state.hull] ?? { nivel: 1, xp: 0 };
  state.naves[state.hull] = nave;
  const perdaNave = aplicarPerdaDeXp(nave, curvaXpNave);

  // Perder nível encolhe o orçamento da Matriz. Devolver o ÚLTIMO ponto
  // alocado é o que o pedido descreve, e é também a escolha menos arbitrária:
  // desfaz na ordem inversa da que o jogador construiu, então o que sobra
  // continua sendo um caminho conectado a partir do centro.
  const nosDevolvidos: string[] = [];
  for (let i = 0; i < personagem.niveis; i++) {
    const ultimo = state.command.allocated.pop();
    if (!ultimo) break;
    nosDevolvidos.push(ultimo);
  }

  const sucata = state.resources.sucata * SUCATA_PERDIDA;
  state.resources.sucata -= sucata;

  return {
    xpPersonagem: personagem.xp,
    niveisPersonagem: personagem.niveis,
    xpNave: perdaNave.xp,
    niveisNave: perdaNave.niveis,
    nosDevolvidos,
    sucata,
  };
}
