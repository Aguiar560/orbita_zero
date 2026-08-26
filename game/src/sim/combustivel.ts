import { HULLS } from '@data/hulls';
import {
  PISO_PARA_DECOLAR, autonomiaDe, custoDe, fracaoDePoder, recargaDe,
} from '@data/balance/combustivel';
import { powerScore, resolveStats } from './stats';
import { createState } from './state';
import type { GameState } from './types';

/**
 * As regras do combustível.
 *
 * ## O tanque é uma FRAÇÃO, não segundos
 *
 * `naves[id].combustivel` vale de 0 a 1. Guardar segundos amarraria o save à
 * autonomia do dia em que foi gravado: qualquer ajuste na curva faria naves
 * antigas aparecerem com o tanque transbordando ou pela metade sem ninguém ter
 * voado. A fração sobrevive a rebalanceamento.
 *
 * Ausente significa TANQUE CHEIO. É o que faz save antigo migrar sem
 * aterrissar a frota inteira de quem já jogava.
 *
 * ## Só a nave EM CAMPO gasta
 *
 * As outras estão no hangar, e no hangar se enche. Uma frota que gastasse junta
 * puniria ter naves, que é o oposto do que o sistema quer.
 */

/**
 * Escala de poder do catálogo, medida uma vez.
 *
 * Sai de `powerScore` sobre um casco NU — sem equipamento, sem nível. É o poder
 * do chassi, e é o que deve decidir autonomia: uma nave fraca bem equipada não
 * merece o tanque de uma nave forte, senão o jogador contornaria a rotação
 * empilhando itens na primeira nave.
 */
const escala = (() => {
  let min = Infinity;
  let max = 0;
  const notas = new Map<string, number>();
  for (const h of HULLS) {
    if (h.prototype) continue;
    const st = createState(11);
    st.hull = h.id;
    const n = powerScore(resolveStats(st));
    notas.set(h.id, n);
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return { notas, min, max };
})();

/** Posição do casco na escala de poder, 0 = mais fraco, 1 = mais forte. */
export function poderDoCasco(hullId: string): number {
  const n = escala.notas.get(hullId);
  return n === undefined ? 0 : fracaoDePoder(n, escala.min, escala.max);
}

/** Segundos de voo com o tanque cheio. */
export const autonomiaDoCasco = (hullId: string): number => autonomiaDe(poderDoCasco(hullId));

/** Segundos parado no hangar para encher do zero. */
export const recargaDoCasco = (hullId: string): number => recargaDe(poderDoCasco(hullId));

/** Núcleos para encher do zero. */
export const custoCheioDoCasco = (hullId: string): number => custoDe(poderDoCasco(hullId));

/** Fração de tanque da nave. Ausente = cheio. */
export function combustivelDe(state: GameState, hullId = state.hull): number {
  const v = state.naves[hullId]?.combustivel;
  return v === undefined ? 1 : Math.min(1, Math.max(0, v));
}

/** A nave tem combustível para decolar? */
export const podeDecolar = (state: GameState, hullId = state.hull): boolean =>
  combustivelDe(state, hullId) >= PISO_PARA_DECOLAR;

/** Segundos de voo que ainda restam nesta nave. */
export const autonomiaRestante = (state: GameState, hullId = state.hull): number =>
  combustivelDe(state, hullId) * autonomiaDoCasco(hullId);

/**
 * Passa o tempo: a nave em campo gasta, as do hangar enchem.
 *
 * Um só ponto de entrada para o tempo ao vivo e para o offline. Se fossem dois,
 * ficar com a aba aberta e fechada renderiam tanques diferentes — e o jogador
 * descobriria qual dos dois é melhor.
 *
 * Devolve `true` se a nave em campo ficou sem combustível NESTE passo, que é o
 * momento em que a cena precisa aterrissá-la.
 */
export function passarTempo(state: GameState, dt: number): boolean {
  if (dt <= 0) return false;
  let acabouAgora = false;

  for (const id of state.fleet) {
    const nave = (state.naves[id] ??= { nivel: 1, xp: 0, equipped: {} });
    const antes = nave.combustivel === undefined ? 1 : nave.combustivel;

    if (id === state.hull) {
      const gasto = dt / Math.max(1, autonomiaDoCasco(id));
      const depois = Math.max(0, antes - gasto);
      nave.combustivel = depois;
      if (antes >= PISO_PARA_DECOLAR && depois < PISO_PARA_DECOLAR) acabouAgora = true;
    } else if (antes < 1) {
      const ganho = dt / Math.max(1, recargaDoCasco(id));
      nave.combustivel = Math.min(1, antes + ganho);
    }
  }

  return acabouAgora;
}

/**
 * O que custa encher esta nave AGORA.
 *
 * Proporcional ao que falta: pagar o preço cheio por um tanque em 90% seria
 * cobrar por combustível que já está lá. Mínimo de 1 para nunca sair de graça.
 */
export function custoParaEncher(state: GameState, hullId = state.hull): number {
  const falta = 1 - combustivelDe(state, hullId);
  if (falta <= 0) return 0;
  return Math.max(1, Math.round(custoCheioDoCasco(hullId) * falta));
}

/**
 * Uma nave da frota com combustível para decolar, que não seja a atual.
 *
 * A cena usa quando a nave em campo seca: aterrissar sem ter para onde ir
 * deixaria o jogador parado olhando uma tela que não avança.
 */
export function proximaComCombustivel(state: GameState): string | null {
  const candidatas = state.fleet
    .filter((id) => id !== state.hull && combustivelDe(state, id) >= PISO_PARA_DECOLAR)
    // A mais forte primeiro: quem foi obrigado a trocar não deve também ser
    // obrigado a escolher mal.
    .sort((a, b) => poderDoCasco(b) - poderDoCasco(a));
  return candidatas[0] ?? null;
}
