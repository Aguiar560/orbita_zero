import { eventoNoInstante, janelasAtivas, type JanelaDeEvento } from '@data/eventos';
import { quantoConta, type FatoDeJogo } from '@data/missoes';
import type { GameState } from './types';

export interface ProgressoDeEvento {
  janela: JanelaDeEvento;
  progresso: number;
  alvo: number;
  resgatado: boolean;
  liberado: boolean;
}

function daJanela(state: GameState, alcance: number, janela: JanelaDeEvento): ProgressoDeEvento {
  const salvo = state.eventos[janela.chave];
  return {
    janela,
    progresso: Math.min(janela.def.objetivo.alvo, salvo?.progresso ?? 0),
    alvo: janela.def.objetivo.alvo,
    resgatado: salvo?.resgatado ?? false,
    liberado: alcance >= janela.def.setorMinimo,
  };
}

/**
 * Os TRÊS eventos ativos: diário, semanal e mensal.
 *
 * Antes havia um só, e ele girava a cada 72 horas. Cada ritmo alimenta um
 * sumidouro diferente da economia — minério para a conversão elemental, gás
 * para a Engenharia, tecnologia para as peças exclusivas —, e é isso que os
 * impede de competir entre si.
 */
export function eventosAtivos(state: GameState, alcance: number, agora = Date.now()): ProgressoDeEvento[] {
  return janelasAtivas(agora).map((j) => daJanela(state, alcance, j));
}

/** O evento SEMANAL. Mantido para quem só precisa de um. */
export function progressoDoEvento(state: GameState, alcance: number, agora = Date.now()): ProgressoDeEvento {
  return daJanela(state, alcance, eventoNoInstante(agora));
}

/**
 * Um fato alimenta os TRÊS eventos ativos.
 *
 * O mesmo abate pode contar para o diário elemental e para o semanal ao mesmo
 * tempo — e deve. Filtrar por um só faria o jogador ter de escolher qual evento
 * jogar, e a escolha certa seria sempre a mesma: o que dá mais.
 */
export function aplicarFatoAoEvento(
  state: GameState,
  alcance: number,
  fato: FatoDeJogo,
  agora = Date.now(),
): { mudou: boolean; completou: boolean } {
  let mudou = false;
  let completou = false;

  for (const atual of eventosAtivos(state, alcance, agora)) {
    if (!atual.liberado || atual.resgatado || atual.progresso >= atual.alvo) continue;
    const ganho = quantoConta(atual.janela.def.objetivo, fato);
    if (ganho <= 0) continue;

    const antes = atual.progresso;
    const depois = Math.min(atual.alvo, antes + ganho);
    state.eventos[atual.janela.chave] = { progresso: depois, resgatado: false };
    mudou = true;
    if (antes < atual.alvo && depois >= atual.alvo) completou = true;
  }

  return { mudou, completou };
}
