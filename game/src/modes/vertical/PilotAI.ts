import type { Pool } from '@core/pool';
import { Rng, clamp, clamp01, lerp } from '@core/math';
import type { Settings } from '@sim/types';
import { VIEW, type Bullet, type Enemy, type Pickup, type Player } from './entities';

export interface PilotOutput {
  /** Direção desejada, normalizada. */
  dx: number;
  dy: number;
  /** Intensidade 0..1 do comando de movimento. */
  throttle: number;
  fire: boolean;
  targetId: number;
  /** Disparou uma manobra evasiva neste quadro. */
  dash: boolean;
  /** Ameaça percebida 0..1 — a HUD mostra isso. */
  threat: number;
}

interface Policy {
  /** Peso do desvio de projéteis. */
  evade: number;
  /** Peso de se posicionar sob o alvo. */
  aggression: number;
  /** Peso da coleta de itens. */
  greed: number;
  /** Altura preferida na tela, 0 = topo, 1 = base. */
  standoff: number;
  /** Escolha de alvo. */
  targeting: 'proximo' | 'fraco' | 'perigoso';
}

const POLICIES: Record<Settings['pilot'], Policy> = {
  agressivo:    { evade: 0.75, aggression: 1.6, greed: 0.5, standoff: 0.62, targeting: 'perigoso' },
  equilibrado:  { evade: 1.15, aggression: 1.0, greed: 0.8, standoff: 0.74, targeting: 'proximo' },
  evasivo:      { evade: 1.9,  aggression: 0.55, greed: 0.6, standoff: 0.85, targeting: 'proximo' },
  coletor:      { evade: 1.1,  aggression: 0.7, greed: 2.0, standoff: 0.76, targeting: 'fraco' },
};

const DASH_COOLDOWN = 3.2;
const DASH_THREAT = 0.72;

/**
 * Piloto de IA da camada vertical.
 *
 * O jogador não pilota: configura. A IA combina quatro campos de força —
 * desvio de projéteis, posicionamento de tiro, coleta e limites de tela — e
 * devolve uma direção. `iaSkill` (0..1) controla horizonte de previsão, raio de
 * percepção, ruído do comando e frequência de decisão, de forma que investir em
 * pilotagem se vê na tela: um piloto ruim reage tarde e tremendo, um bom desliza
 * entre as balas.
 *
 * O desvio usa aproximação mínima em vez de distância instantânea: repelir pela
 * distância atual faz a nave fugir de balas que já passaram e ignorar a que vai
 * acertar em meio segundo.
 */
export class PilotAI {
  private readonly rng = new Rng(0x9117);

  private decisionTimer = 0;
  private cachedDx = 0;
  private cachedDy = 0;
  private cachedThreat = 0;
  private dashCooldown = 0;
  private targetId = 0;
  private targetTimer = 0;
  /** Segundos restantes de travamento — o piloto perdeu a reação. */
  private panic = 0;

  update(
    dt: number,
    player: Player,
    enemies: Pool<Enemy>,
    hostile: Pool<Bullet>,
    pickups: Pool<Pickup>,
    skill: number,
    policyId: Settings['pilot'],
  ): PilotOutput {
    const policy = POLICIES[policyId] ?? POLICIES.equilibrado;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.targetTimer -= dt;
    this.panic = Math.max(0, this.panic - dt);

    // Frequência de decisão: ~3 Hz com skill 0, 60 Hz com skill 1. É o principal
    // motivo pelo qual um piloto cru "reage tarde" — ele literalmente olha para
    // a tela três vezes por segundo.
    const interval = lerp(0.32, 1 / 60, skill);
    this.decisionTimer -= dt;

    if (this.decisionTimer <= 0) {
      this.decisionTimer = interval;
      // Travamento: um piloto ruim às vezes simplesmente congela em vez de
      // desviar. É o que faz o começo do jogo ter mortes de verdade, e some
      // sozinho conforme a sincronia sobe.
      if (skill < 0.6 && this.rng.chance((0.6 - skill) * 0.45)) {
        this.panic = lerp(0.42, 0.05, skill);
      } else {
        this.think(player, enemies, hostile, pickups, skill, policy);
      }
    }

    const target = this.resolveTarget(enemies, player, policy);
    // Mira ruim também erra o gatilho: abaixo de metade da sincronia o piloto
    // perde disparos por hesitação.
    const fire = !!target && player.alive && (skill > 0.5 || this.rng.chance(0.55 + skill * 0.9));

    let dash = false;
    if (this.cachedThreat > DASH_THREAT && this.dashCooldown <= 0 && skill > 0.45) {
      dash = true;
      this.dashCooldown = DASH_COOLDOWN * lerp(1.6, 0.75, skill);
    }

    // Durante o travamento o comando de movimento é descartado: a nave segue
    // reta e absorve o que vier.
    if (this.panic > 0) {
      return { dx: 0, dy: 0, throttle: 0, fire, targetId: target?.id ?? 0, dash: false, threat: this.cachedThreat };
    }

    return {
      dx: this.cachedDx,
      dy: this.cachedDy,
      throttle: clamp01(Math.hypot(this.cachedDx, this.cachedDy)),
      fire,
      targetId: target?.id ?? 0,
      dash,
      threat: this.cachedThreat,
    };
  }

  private think(
    player: Player,
    enemies: Pool<Enemy>,
    hostile: Pool<Bullet>,
    pickups: Pool<Pickup>,
    skill: number,
    policy: Policy,
  ): void {
    // Percepção e previsão escalam com a competência do piloto. Num piloto cru
    // o raio mal cobre o próprio casco, então ele só vê a bala quando ela já
    // está em cima.
    const senseRadius = lerp(52, 280, skill);
    const horizon = lerp(0.14, 1.2, skill);
    const safeRadius = player.radius + lerp(4, 28, skill);

    let ex = 0;
    let ey = 0;
    let threat = 0;

    // ── 1. desvio de projéteis ────────────────────────────────────────────
    hostile.each((b) => {
      const dpx = player.x - b.x;
      const dpy = player.y - b.y;
      const rough = dpx * dpx + dpy * dpy;
      if (rough > senseRadius * senseRadius) return;

      const dvx = player.vx - b.vx;
      const dvy = player.vy - b.vy;
      const vv = dvx * dvx + dvy * dvy;
      if (vv < 1) return;

      // Instante da aproximação mínima. Negativo = a bala já está se afastando.
      const t = clamp(-(dpx * dvx + dpy * dvy) / vv, 0, horizon);
      if (t <= 0) return;

      const mx = dpx + dvx * t;
      const my = dpy + dvy * t;
      const miss = Math.hypot(mx, my);
      if (miss > safeRadius * 2.2) return;

      // Perto no tempo e no espaço = urgente.
      const urgency = (1 - t / horizon) * (1 - clamp01(miss / (safeRadius * 2.2)));
      threat = Math.max(threat, urgency);

      // Escapa perpendicular à trajetória, pelo lado em que a nave já está —
      // é o desvio mais curto e evita atravessar a linha de tiro.
      const bl = Math.hypot(b.vx, b.vy) || 1;
      let px = -b.vy / bl;
      let py = b.vx / bl;
      if (px * dpx + py * dpy < 0) {
        px = -px;
        py = -py;
      }
      const w = urgency * 2.6;
      ex += px * w;
      ey += py * w;
      // Um empurrão para longe do ponto de impacto quebra empates simétricos.
      ex += (mx / (miss + 1)) * urgency * 0.6;
      ey += (my / (miss + 1)) * urgency * 0.6;
    });

    // ── 2. corpos inimigos ────────────────────────────────────────────────
    enemies.each((e) => {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy);
      const danger = e.radius + player.radius + 34;
      if (d > danger || d < 0.001) return;
      const w = (1 - d / danger) * 2.2;
      ex += (dx / d) * w;
      ey += (dy / d) * w;
      threat = Math.max(threat, (1 - d / danger) * 0.85);
    });

    // ── 3. posicionamento de ataque ───────────────────────────────────────
    const target = this.resolveTarget(enemies, player, policy);
    let ax = 0;
    let ay = 0;
    if (target) {
      // Antecipa o movimento lateral do alvo — quanto melhor o piloto, mais longe olha.
      const lead = lerp(0, 0.42, skill);
      // Grampeado à área jogável: alvos que saem pela lateral não devem arrastar
      // a nave para a parede, onde ela fica sem espaço para desviar.
      const aimX = clamp(target.x + target.vx * lead, 70, VIEW.w - 70);
      const dx = aimX - player.x;
      ax += clamp(dx / 120, -1, 1);
    }
    const restY = VIEW.h * policy.standoff;
    ay += clamp((restY - player.y) / 180, -1, 1);

    // ── 4. coleta ─────────────────────────────────────────────────────────
    let gx = 0;
    let gy = 0;
    const hurt = 1 - player.hp / Math.max(1, player.hpMax);
    pickups.each((p) => {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > 320 || d < 0.001) return;
      // Reparo vale muito mais quando a nave está machucada.
      const need = p.kind === 'reparo' ? 0.5 + hurt * 2.5 : 1;
      const w = ((320 - d) / 320) * need;
      gx += (dx / d) * w;
      gy += (dy / d) * w;
    });

    // ── 5. limites da tela ────────────────────────────────────────────────
    // Margem generosa: encostar na parede tira metade das rotas de fuga, então
    // o piloto trata a borda como ameaça, não como limite rígido.
    const margin = 96;
    let bx = 0;
    let by = 0;
    if (player.x < margin) bx += (margin - player.x) / margin;
    if (player.x > VIEW.w - margin) bx -= (player.x - (VIEW.w - margin)) / margin;
    if (player.y < margin) by += (margin - player.y) / margin;
    if (player.y > VIEW.h - margin) by -= (player.y - (VIEW.h - margin)) / margin;

    let dx = ex * policy.evade + ax * policy.aggression + gx * policy.greed + bx * 3.2;
    let dy = ey * policy.evade + ay * policy.aggression + gy * policy.greed + by * 3.2;

    // Ruído de mão: um piloto cru não traça a linha ideal, ele treme.
    const noise = lerp(1.15, 0.02, skill);
    dx += this.rng.range(-noise, noise);
    dy += this.rng.range(-noise, noise);

    const len = Math.hypot(dx, dy);
    if (len > 0.0001) {
      const scale = Math.min(1, len) / len;
      this.cachedDx = dx * scale;
      this.cachedDy = dy * scale;
    } else {
      this.cachedDx = 0;
      this.cachedDy = 0;
    }
    this.cachedThreat = clamp01(threat);
  }

  /**
   * Escolhe o alvo e o mantém por ~0.6s. Sem essa histerese, a nave fica
   * trocando de alvo a cada quadro e nunca alinha o tiro com nada.
   */
  private resolveTarget(enemies: Pool<Enemy>, player: Player, policy: Policy): Enemy | null {
    if (this.targetTimer > 0) {
      const held = enemies.items.find((e) => e.alive && e.id === this.targetId);
      if (held) return held;
    }

    let best: Enemy | null = null;
    let bestScore = -Infinity;

    enemies.each((e) => {
      if (e.y < -40) return;
      const dy = e.y - player.y;
      // Alvos abaixo da nave não podem ser atingidos: o tiro sobe.
      if (dy > 40) return;
      const d = Math.hypot(e.x - player.x, dy);

      let score: number;
      switch (policy.targeting) {
        case 'fraco':
          score = -e.hp - d * 0.4;
          break;
        case 'perigoso':
          score = (e.boss ? 4000 : 0) + e.damage * 120 + e.def.hp * 60 - d * 0.7;
          break;
        default:
          score = -d + (e.boss ? 2000 : 0);
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    });

    if (best) {
      this.targetId = (best as Enemy).id;
      this.targetTimer = 0.6;
    }
    return best;
  }

  reset(): void {
    this.panic = 0;
    this.decisionTimer = 0;
    this.cachedDx = 0;
    this.cachedDy = 0;
    this.cachedThreat = 0;
    this.dashCooldown = 0;
    this.targetId = 0;
    this.targetTimer = 0;
  }
}
