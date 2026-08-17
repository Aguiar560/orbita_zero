import { Pool } from '@core/pool';
import { Rng, clamp01 } from '@core/math';
import type { Surface } from './Surface';
import { getClip, frameAt, clipDuration, type Clip } from './Anim';

export type ParticleKind = 'spark' | 'smoke' | 'shard' | 'ring' | 'text';

export interface Particle {
  alive: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  sizeEnd: number;
  color: string;
  rotation: number;
  spin: number;
  text: string;
  additive: boolean;
}

export interface SpriteBurst {
  alive: boolean;
  clip: Clip | null;
  /**
   * Sprite ESTÁTICO, quando não há clipe.
   *
   * O atlas elemental do §21 é de quadros únicos, não de animações: cada
   * explosão é um desenho só. Em vez de um segundo pool quase idêntico, o mesmo
   * burst aceita as duas formas — com clipe anima, sem clipe cresce e some.
   */
  sprite: string;
  /** Segundos de vida, para o quadro único. Com clipe quem manda é a duração. */
  vida: number;
  /** Quanto a escala cresce até o fim da vida. 0 = fixa. */
  crescimento: number;
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  rotation: number;
  alpha: number;
  additive: boolean;
}

/**
 * Sistema de partículas + explosões em sprite.
 *
 * São dois pools separados porque têm custos bem diferentes: partículas são
 * primitivas baratas desenhadas aos milhares, enquanto explosões animadas são
 * poucas dezenas mas custam um `drawImage` com transform cada.
 */
export class Particles {
  private readonly rng = new Rng(0x5eed);

  readonly parts = new Pool<Particle>(
    () => ({
      alive: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, drag: 0, gravity: 0,
      life: 0, maxLife: 1, size: 2, sizeEnd: 0, color: '#fff', rotation: 0, spin: 0,
      text: '', additive: true,
    }),
    (p) => {
      p.kind = 'spark'; p.vx = 0; p.vy = 0; p.drag = 1.5; p.gravity = 0;
      p.life = 0; p.maxLife = 0.5; p.size = 2; p.sizeEnd = 0; p.color = '#fff';
      p.rotation = 0; p.spin = 0; p.text = ''; p.additive = true;
    },
    3000,
  );

  readonly bursts = new Pool<SpriteBurst>(
    () => ({ alive: false, clip: null, sprite: '', vida: 0.3, crescimento: 0, time: 0, x: 0, y: 0, vx: 0, vy: 0, scale: 1, rotation: 0, alpha: 1, additive: true }),
    (b) => { b.clip = null; b.sprite = ''; b.vida = 0.3; b.crescimento = 0; b.time = 0; b.vx = 0; b.vy = 0; b.scale = 1; b.rotation = 0; b.alpha = 1; b.additive = true; },
    160,
  );

  clear(): void {
    this.parts.clear();
    this.bursts.clear();
  }

  // ── emissores ─────────────────────────────────────────────────────────────

  /** Leque de faíscas — impacto de projétil. */
  sparks(x: number, y: number, count: number, color: string, speed = 160, spread = Math.PI * 2, dir = 0): void {
    for (let i = 0; i < count; i++) {
      const p = this.parts.spawn();
      if (!p) return;
      const a = dir + this.rng.range(-spread / 2, spread / 2);
      const v = speed * this.rng.range(0.35, 1);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 3.2;
      p.maxLife = this.rng.range(0.18, 0.45);
      p.size = this.rng.range(1.5, 3.2);
      p.sizeEnd = 0;
      p.color = color;
      p.kind = 'spark';
    }
  }

  /** Rastro de motor — vive pouco e desacelera rápido. */
  thrust(x: number, y: number, dirX: number, dirY: number, color: string, spread = 0.5): void {
    const p = this.parts.spawn();
    if (!p) return;
    const a = Math.atan2(dirY, dirX) + this.rng.range(-spread, spread);
    const v = this.rng.range(40, 130);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v;
    p.drag = 5;
    p.maxLife = this.rng.range(0.12, 0.3);
    p.size = this.rng.range(2, 4.5);
    p.sizeEnd = 0;
    p.color = color;
    p.kind = 'smoke';
  }

  /** Anel de choque expandindo. */
  shockwave(x: number, y: number, radius: number, color: string, life = 0.35): void {
    const p = this.parts.spawn();
    if (!p) return;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0; p.drag = 0;
    p.maxLife = life;
    p.size = radius * 0.15;
    p.sizeEnd = radius;
    p.color = color;
    p.kind = 'ring';
  }

  /** Estilhaços com gravidade — destroços de casco. */
  debris(x: number, y: number, count: number, color: string, speed = 120): void {
    for (let i = 0; i < count; i++) {
      const p = this.parts.spawn();
      if (!p) return;
      const a = this.rng.range(0, Math.PI * 2);
      const v = speed * this.rng.range(0.3, 1.1);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.drag = 1.1;
      p.gravity = 140;
      p.maxLife = this.rng.range(0.5, 1.1);
      p.size = this.rng.range(2, 4);
      p.sizeEnd = 1;
      p.color = color;
      p.rotation = a;
      p.spin = this.rng.range(-8, 8);
      p.kind = 'shard';
      p.additive = false;
    }
  }

  /** Número de dano flutuante. */
  popup(x: number, y: number, text: string, color = '#ffe98a', size = 13): void {
    const p = this.parts.spawn();
    if (!p) return;
    p.x = x; p.y = y;
    p.vx = this.rng.range(-14, 14);
    p.vy = -46;
    p.drag = 1.4;
    p.maxLife = 0.85;
    p.size = size;
    p.sizeEnd = size;
    p.color = color;
    p.text = text;
    p.kind = 'text';
    p.additive = false;
  }

  /**
   * Lampejo de um sprite ESTÁTICO — o formato do atlas elemental (§22).
   *
   * Existe ao lado de `burst` e não no lugar dele: a arte de nave e de chefe
   * continua vindo de clipes animados, e trocar tudo por quadro único perderia
   * animação já pronta.
   */
  flash(
    spriteId: string,
    x: number,
    y: number,
    scale = 1,
    opts: { vida?: number; crescimento?: number; rotation?: number; additive?: boolean } = {},
  ): void {
    if (!spriteId) return;
    const b = this.bursts.spawn();
    if (!b) return;
    b.clip = null;
    b.sprite = spriteId;
    b.x = x; b.y = y;
    b.scale = scale;
    b.vida = opts.vida ?? 0.28;
    b.crescimento = opts.crescimento ?? 0.6;
    b.rotation = opts.rotation ?? 0;
    b.additive = opts.additive ?? true;
  }

  /** Explosão animada a partir de um clipe registrado. */
  burst(clipId: string, x: number, y: number, scale = 1, opts: { vx?: number; vy?: number; rotation?: number; additive?: boolean } = {}): void {
    const clip = getClip(clipId);
    if (!clip) return;
    const b = this.bursts.spawn();
    if (!b) return;
    b.clip = clip;
    b.x = x; b.y = y;
    b.vx = opts.vx ?? 0;
    b.vy = opts.vy ?? 0;
    b.scale = scale;
    b.rotation = opts.rotation ?? 0;
    b.additive = opts.additive ?? true;
  }

  // ── ciclo ─────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.parts.each((p) => {
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        return;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    });
    this.parts.compact();

    this.bursts.each((b) => {
      b.time += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.clip ? b.time >= clipDuration(b.clip) : b.time >= b.vida) b.alive = false;
    });
    this.bursts.compact();
  }

  draw(s: Surface): void {
    const { ctx } = s;

    ctx.globalCompositeOperation = 'lighter';
    this.parts.each((p) => {
      if (!p.additive) return;
      this.drawParticle(s, p);
    });
    ctx.globalCompositeOperation = 'source-over';

    this.parts.each((p) => {
      if (p.additive) return;
      this.drawParticle(s, p);
    });

    this.bursts.each((b) => {
      const comClipe = !!b.clip;
      const id = comClipe ? frameAt(b.clip!, b.time) : b.sprite;
      if (!id) return;
      const t = clamp01(b.time / (comClipe ? clipDuration(b.clip!) : b.vida));
      s.sprite(id, b.x, b.y, {
        // O quadro único não tem animação para dar vida ao efeito, então ela
        // vem do movimento: cresce e desaparece. Com clipe isso não se aplica —
        // a animação já é o efeito, e escalar por cima dela dá um zoom estranho.
        scale: b.scale * (comClipe ? 1 : 1 + b.crescimento * t),
        rotation: b.rotation,
        // Some por completo no quadro único; o clipe só perde um pouco de força
        // no fim, porque o último quadro dele já é quase transparente.
        alpha: comClipe ? 1 - t * t * 0.35 : (1 - t) * (1 - t),
        composite: b.additive ? 'lighter' : undefined,
      });
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticle(s: Surface, p: Particle): void {
    const { ctx } = s;
    const t = clamp01(p.life / p.maxLife);
    const size = p.size + (p.sizeEnd - p.size) * t;
    const alpha = 1 - t * t;

    ctx.globalAlpha = alpha;
    switch (p.kind) {
      case 'ring':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3 * (1 - t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `800 ${p.size}px "Rajdhani", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,.65)';
        ctx.fillText(p.text, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        break;
      case 'shard':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-size * 0.5, -size * 0.25, size, size * 0.5);
        ctx.restore();
        break;
      default:
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
    }
    ctx.globalAlpha = 1;
  }
}
