import type { GameState } from './types';

export const VIP_COST_CRYSTALS = 500;
export const VIP_DURATION_DAYS = 30;
export const VIP_DURATION_MS = VIP_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const VIP_MANUAL_LEVEL = 15;

export interface CrystalPackage {
  id: string;
  name: string;
  base: number;
  bonus: number;
  priceCents: number;
  badge?: string;
}

/** Catálogo visual; o checkout real será ligado ao provedor de pagamento depois. */
export const CRYSTAL_PACKAGES: readonly CrystalPackage[] = [
  { id: 'faisca', name: 'Faísca', base: 80, bonus: 0, priceCents: 490 },
  { id: 'piloto', name: 'Piloto', base: 250, bonus: 20, priceCents: 1490 },
  { id: 'comando', name: 'Comando', base: 450, bonus: 50, priceCents: 2490, badge: '1 PASSE VIP' },
  { id: 'frota', name: 'Frota', base: 950, bonus: 150, priceCents: 4990, badge: 'MAIS ESCOLHIDO' },
  { id: 'singularidade', name: 'Singularidade', base: 1900, bonus: 500, priceCents: 9990, badge: 'MELHOR VALOR' },
];

export function cristaisDoPacote(pack: CrystalPackage): number {
  return pack.base + pack.bonus;
}

export function vipAtivo(state: GameState, agora = Date.now()): boolean {
  return state.vip.expiresAt > agora;
}

export function limiteTentativasDaProvacao(state: GameState, agora = Date.now()): number {
  return vipAtivo(state, agora) ? 6 : 5;
}

export function limiteDeMissoes(state: GameState, agora = Date.now()): number {
  return vipAtivo(state, agora) ? 5 : 4;
}

/** Até o nível 14 todos experimentam os dois modos; depois, manual é benefício VIP. */
export function controleManualDisponivel(state: GameState, agora = Date.now()): boolean {
  return state.settings.testMode || state.command.nivel < VIP_MANUAL_LEVEL || vipAtivo(state, agora);
}

export function controleManualAtivo(state: GameState, agora = Date.now()): boolean {
  return state.settings.controlMode === 'manual' && controleManualDisponivel(state, agora);
}
