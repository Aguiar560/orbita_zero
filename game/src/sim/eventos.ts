import { eventoNoInstante, type JanelaDeEvento } from '@data/eventos';
import { quantoConta, type FatoDeJogo } from '@data/missoes';
import type { GameState } from './types';

export interface ProgressoDeEvento {
  janela: JanelaDeEvento;
  progresso: number;
  alvo: number;
  resgatado: boolean;
  liberado: boolean;
}

export function progressoDoEvento(state: GameState, alcance: number, agora = Date.now()): ProgressoDeEvento {
  const janela = eventoNoInstante(agora);
  const salvo = state.eventos[janela.chave];
  return {
    janela,
    progresso: Math.min(janela.def.objetivo.alvo, salvo?.progresso ?? 0),
    alvo: janela.def.objetivo.alvo,
    resgatado: salvo?.resgatado ?? false,
    liberado: alcance >= janela.def.setorMinimo,
  };
}

export function aplicarFatoAoEvento(
  state: GameState,
  alcance: number,
  fato: FatoDeJogo,
  agora = Date.now(),
): { mudou: boolean; completou: boolean } {
  const atual = progressoDoEvento(state, alcance, agora);
  if (!atual.liberado || atual.resgatado || atual.progresso >= atual.alvo) return { mudou: false, completou: false };
  const ganho = quantoConta(atual.janela.def.objetivo, fato);
  if (ganho <= 0) return { mudou: false, completou: false };
  const antes = atual.progresso;
  const depois = Math.min(atual.alvo, antes + ganho);
  state.eventos[atual.janela.chave] = { progresso: depois, resgatado: false };
  return { mudou: true, completou: antes < atual.alvo && depois >= atual.alvo };
}
