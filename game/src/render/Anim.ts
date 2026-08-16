import { assets } from './Assets';

export interface Clip {
  readonly id: string;
  readonly frames: readonly string[];
  /** Quadros por segundo. */
  readonly fps: number;
  readonly loop: boolean;
}

const clips = new Map<string, Clip>();

/**
 * Registra um clipe a partir de um prefixo do atlas (`fx/blast_fire_` →
 * `fx/blast_fire_0..4`, em ordem natural). Devolve `null` se o prefixo não
 * casar com nada — assim um pack ausente degrada em silêncio em vez de
 * quebrar o boot.
 */
export function defineClip(id: string, prefix: string, fps: number, loop = true): Clip | null {
  const frames = assets.atlases.sequence(prefix);
  if (frames.length === 0) {
    console.warn(`[anim] nenhum quadro para "${prefix}"`);
    return null;
  }
  const clip: Clip = { id, frames, fps, loop };
  clips.set(id, clip);
  return clip;
}

/** Registra um clipe com lista explícita de quadros. */
export function defineClipFrames(id: string, frames: readonly string[], fps: number, loop = true): Clip {
  const clip: Clip = { id, frames, fps, loop };
  clips.set(id, clip);
  return clip;
}

export function getClip(id: string): Clip | undefined {
  return clips.get(id);
}

/**
 * Resolve o id do quadro de um clipe num dado tempo.
 * Clipes sem loop travam no último quadro.
 */
export function frameAt(clip: Clip, time: number): string {
  const i = Math.floor(time * clip.fps);
  if (clip.loop) return clip.frames[((i % clip.frames.length) + clip.frames.length) % clip.frames.length]!;
  return clip.frames[Math.min(i, clip.frames.length - 1)]!;
}

/** Duração total, em segundos. */
export function clipDuration(clip: Clip): number {
  return clip.frames.length / clip.fps;
}

/** Estado de reprodução leve, para entidades que precisam guardar posição. */
export class Playback {
  time = 0;
  clip: Clip | null = null;

  play(clip: Clip | null, restart = true): void {
    if (clip === this.clip && !restart) return;
    this.clip = clip;
    if (restart) this.time = 0;
  }

  update(dt: number): void {
    this.time += dt;
  }

  get finished(): boolean {
    return !!this.clip && !this.clip.loop && this.time >= clipDuration(this.clip);
  }

  get frame(): string | null {
    return this.clip ? frameAt(this.clip, this.time) : null;
  }
}
