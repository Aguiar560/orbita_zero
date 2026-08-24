import raw from './hitbox-calibrations.json';
import { normalizeHullHitbox, type HullHitbox } from './hulls';

export interface ShipCalibration extends HullHitbox {
  scale: number;
}

interface HitboxCalibrationFile {
  players: Record<string, Partial<ShipCalibration>>;
  enemies: Record<string, Partial<ShipCalibration>>;
  bosses: Record<string, Partial<ShipCalibration>>;
}

const source = raw as HitboxCalibrationFile;

const normalizeMap = (entries: Record<string, Partial<ShipCalibration>>): Readonly<Record<string, HullHitbox>> =>
  Object.freeze(Object.fromEntries(Object.entries(entries).map(([id, box]) => [id, normalizeHullHitbox(box)])));
const scaleMap = (entries: Record<string, Partial<ShipCalibration>>): Readonly<Record<string, number>> =>
  Object.freeze(Object.fromEntries(Object.entries(entries).flatMap(([id, entry]) =>
    Number.isFinite(entry.scale) ? [[id, Math.min(4, Math.max(.05, Number(entry.scale)))]] : [])));

/**
 * Fonte canônica gerada pelo Laboratório administrativo.
 *
 * Não pertence ao save do jogador: o endpoint local atualiza o JSON ao lado e
 * o Vite recarrega estas tabelas como qualquer outro dado do jogo.
 */
export const PLAYER_HITBOX_CALIBRATIONS = normalizeMap(source.players);
export const ENEMY_HITBOX_CALIBRATIONS = normalizeMap(source.enemies);
export const BOSS_HITBOX_CALIBRATIONS = normalizeMap(source.bosses);
export const PLAYER_SCALE_CALIBRATIONS = scaleMap(source.players);
export const ENEMY_SCALE_CALIBRATIONS = scaleMap(source.enemies);
export const BOSS_SCALE_CALIBRATIONS = scaleMap(source.bosses);

export function calibratedEnemyHitbox(key: string): HullHitbox | undefined {
  const [kind, id] = key.split(':');
  if (!id) return undefined;
  return kind === 'boss' ? BOSS_HITBOX_CALIBRATIONS[id] : kind === 'enemy' ? ENEMY_HITBOX_CALIBRATIONS[id] : undefined;
}

export function calibratedEnemyScale(key: string): number | undefined {
  const [kind, id] = key.split(':');
  if (!id) return undefined;
  return kind === 'boss' ? BOSS_SCALE_CALIBRATIONS[id] : kind === 'enemy' ? ENEMY_SCALE_CALIBRATIONS[id] : undefined;
}
