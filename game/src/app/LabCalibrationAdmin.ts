import { toast } from './Bus';
import { normalizeHullHitbox, type HullHitbox } from '@data/hulls';

export type LabCalibrationKind = 'player' | 'enemy' | 'boss';
export type LabCalibrationAction = 'save' | 'restore';

interface CalibrationResponse {
  ok: boolean;
  error?: string;
  path?: string;
}

const NOTICE_KEY = 'orbita-zero:lab-calibration-notice';

export const LAB_CODE_WRITE_AVAILABLE = import.meta.env.DEV;

/** Grava ou remove uma calibração na tabela versionada do projeto. */
export async function writeHitboxCalibration(
  action: LabCalibrationAction,
  kind: LabCalibrationKind,
  id: string,
  hitbox?: HullHitbox,
  scale?: number,
): Promise<boolean> {
  if (!LAB_CODE_WRITE_AVAILABLE) {
    toast('Gravação no código disponível somente no servidor administrativo local.', 'bad');
    return false;
  }

  try {
    const response = await fetch('/__lab/hitboxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, kind, id, hitbox: hitbox ? normalizeHullHitbox(hitbox) : undefined, scale }),
    });
    const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` })) as CalibrationResponse;
    if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);

    const message = action === 'save'
      ? `Hitbox e escala de ${id} gravadas com sucesso no código do jogo.`
      : `Calibração de ${id} removida; o padrão da ficha foi restaurado.`;
    try { sessionStorage.setItem(NOTICE_KEY, message); } catch { /* ambiente sem storage */ }
    toast(message, 'good');
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    toast(`Não foi possível gravar a hitbox: ${detail}`, 'bad');
    return false;
  }
}

/** Reexibe a confirmação depois do reload disparado pela alteração do JSON. */
export function consumeCalibrationNotice(): string | null {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY);
    if (message) sessionStorage.removeItem(NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}
