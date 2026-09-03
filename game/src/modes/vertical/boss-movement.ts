import { TAU, clamp } from '@core/math';
import type { BossMovement } from '@data/bosses';

export interface BossMovementInput {
  movement?: BossMovement;
  time: number;
  wobble: number;
  anchorX: number;
  anchorY: number;
  strafe: number;
  movementSpeed?: number;
  playerX: number;
  playerY: number;
  viewW: number;
  viewH: number;
}

export interface BossMovementTarget {
  x: number;
  y: number;
  /** Meia-vida da aproximação. Ausente significa trajetória direta. */
  smoothing?: number;
}

/**
 * Trajetória visual de um chefe depois da entrada.
 *
 * É pura para que os arquétipos possam ser comparados sem subir a cena inteira.
 * A fase continua decidindo a amplitude (`strafe`); o arquétipo decide a forma.
 */
export function bossMovementTarget(input: BossMovementInput): BossMovementTarget {
  const {
    movement, time, wobble, anchorX, anchorY, strafe,
    playerX, playerY, viewW, viewH,
  } = input;

  // Chefes da campanha conservam a trajetória que já tinham.
  if (!movement) {
    return {
      x: anchorX + Math.sin(time * 0.6) * (strafe * 1.4),
      y: anchorY + Math.sin(time * 0.9) * 22,
    };
  }

  const speed = clamp(input.movementSpeed ?? 1, 0.55, 1.8);
  const t = time * speed + wobble;
  const horizontalRoom = Math.max(80, viewW / 2 - 96);

  switch (movement) {
    case 'fortaleza':
      // Quase imóvel: presença pesada, sem virar uma estátua perfeita.
      return {
        x: anchorX + Math.sin(t * 0.38) * Math.min(horizontalRoom, strafe * 0.42),
        y: anchorY + Math.sin(t * 0.55) * 8,
      };

    case 'artilheiro':
      // Varre toda a linha de tiro, mas se mantém no fundo da arena.
      return {
        x: anchorX + Math.sin(t * 0.82) * Math.min(horizontalRoom, strafe * 1.65),
        y: anchorY - 34 + Math.cos(t * 0.48) * 10,
      };

    case 'investida': {
      // Mergulho longo e retorno; a curva contínua deixa a manobra legível.
      const cycle = ((t * 0.72) % TAU + TAU) % TAU;
      const dive = (1 - Math.cos(cycle)) * 0.5;
      const depth = Math.max(150, Math.min(viewH * 0.38, playerY - anchorY - 130));
      return {
        x: anchorX + Math.sin(cycle) * Math.min(horizontalRoom, strafe * 0.78 + 36),
        y: anchorY + dive * depth,
      };
    }

    case 'invocador':
      // Um oito compacto mantém o núcleo no centro dos lacaios.
      return {
        x: anchorX + Math.sin(t * 0.52) * Math.min(horizontalRoom, strafe * 0.82 + 28),
        y: anchorY + Math.sin(t * 1.04) * 31,
      };

    case 'orbital': {
      const radiusX = Math.min(horizontalRoom, Math.max(92, strafe * 1.08));
      return {
        x: anchorX + Math.cos(t * 0.74) * radiusX,
        y: anchorY + Math.sin(t * 0.74) * 68,
      };
    }

    case 'cacador':
      // Persegue uma posição acima do jogador; smoothing evita teletransporte.
      return {
        x: playerX + Math.sin(t * 1.35) * 34,
        y: clamp(playerY - 235 + Math.cos(t * 0.9) * 42, anchorY - 12, viewH * 0.58),
        smoothing: 0.22 / speed,
      };

    case 'dispersor':
      // Travessia larga para que o leque mude de origem o tempo todo.
      return {
        x: anchorX + Math.sin(t * 0.68) * Math.min(horizontalRoom, strafe * 1.9 + 42),
        y: anchorY + Math.cos(t * 1.36) * 19,
      };

    case 'espectro':
      // A tangente hiperbólica cria arrancadas rápidas e pausas nas extremidades.
      return {
        x: anchorX + Math.tanh(Math.sin(t * 0.92) * 3.1)
          * Math.min(horizontalRoom, strafe * 1.45 + 74),
        y: anchorY + Math.sin(t * 1.84) * 36,
      };
  }
}
