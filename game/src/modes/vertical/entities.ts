import { Pool } from '@core/pool';
import type { BossDef } from '@data/bosses';
import type { EnemyDef } from '@data/enemies';
import type { ElementId, Item } from '@sim/types';

/**
 * Espaço lógico da camada de combate.
 *
 * A ALTURA é fixa (o jogo é vertical e a dificuldade depende do tempo que um
 * inimigo leva para atravessar a tela); a LARGURA acompanha a proporção da
 * janela. Assim o campo de jogo preenche a coluna central sem tarjas pretas, em
 * vez de ficar uma tira estreita no meio de um monitor largo.
 */
export const VIEW = { w: 540, h: 960 };

/** Limites da largura lógica: estreito demais sufoca, largo demais esvazia. */
export const VIEW_W_MIN = 480;
export const VIEW_W_MAX = 1180;

/** Ajusta a largura lógica à proporção do elemento. */
export function fitView(cssW: number, cssH: number): void {
  const ratio = cssW / Math.max(1, cssH);
  VIEW.w = Math.round(Math.min(VIEW_W_MAX, Math.max(VIEW_W_MIN, VIEW.h * ratio)));
}

export interface Bullet {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  /** `true` = do jogador. */
  friendly: boolean;
  sprite: string;
  color: string;
  scale: number;
  /** Inimigos que ainda pode atravessar. */
  pierce: number;
  /** Raio de dano em área ao colidir. */
  splash: number;
  /** Força de correção de curso, em rad/s. 0 = reto. */
  homing: number;
  crit: boolean;
  /**
   * Tipo de dano que este projétil carrega.
   *
   * Fica no projétil, não em quem atirou: uma salva já no ar continua sendo do
   * elemento com que saiu, mesmo que o jogador troque de arma no meio do voo.
   */
  element: ElementId;
  life: number;
  /** Alvos já atingidos, para perfuração não bater duas vezes no mesmo. */
  hitId: number;
}

export interface Enemy {
  alive: boolean;
  id: number;
  def: EnemyDef;
  boss: BossDef | null;

  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  scale: number;
  damage: number;

  /** Fração da recompensa do encontro que este inimigo representa. */
  share: number;
  /**
   * Se `true`, abater este inimigo consome o pool de vida do encontro.
   * Lacaios invocados por chefes são `false`: eles pressionam, mas matá-los não
   * pode substituir matar o chefe.
   */
  counts: boolean;

  time: number;
  fireTimer: number;
  hitFlash: number;
  /** Ângulo acumulado dos padrões em espiral. */
  spin: number;
  /** Ponto-âncora para `pairar` e `orbita`. */
  anchorX: number;
  anchorY: number;
  /** Fase de entrada: desce sem atirar até chegar na âncora. */
  entering: boolean;
  /** Índice da fase atual do chefe. */
  phase: number;
  summonTimer: number;
  /** Fase da oscilação horizontal. */
  wobble: number;
  facing: number;
}

export type PickupKind = 'reparo' | 'escudo' | 'dano' | 'recompensa' | 'item';

export interface Pickup {
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  time: number;
  /** Puxado pelo ímã da nave. */
  magnet: boolean;
  /**
   * Item carregado por uma cápsula de loot (`kind === 'item'`).
   *
   * O item é gerado no momento do abate e só entra no inventário quando a
   * cápsula é coletada — então o jogador vê de onde cada peça veio, e um drop
   * que escapa pela base é realmente perdido.
   */
  item: Item | null;
  /** Sprite do ícone do item, resolvido uma vez no spawn. */
  icon: string;
  /** Cor da raridade, para o halo e o rastro. */
  color: string;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  hpMax: number;
  shield: number;
  shieldMax: number;
  /** Segundos até o escudo voltar a regenerar após levar dano. */
  shieldLock: number;
  radius: number;
  fireTimer: number;
  /** Invulnerabilidade pós-respawn. */
  invuln: number;
  /** Inclinação visual, -1..1. */
  bank: number;
  /** Buffs temporários de power-up. */
  buffDamage: number;
  buffRate: number;
  alive: boolean;
  deathTimer: number;
}

export function createBulletPool(capacity = 1400): Pool<Bullet> {
  return new Pool<Bullet>(
    () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 1, friendly: true,
      sprite: '', color: '#fff', scale: 1, pierce: 0, splash: 0, homing: 0, crit: false,
      element: 'padrao', life: 0, hitId: -1,
    }),
    (b) => {
      b.pierce = 0; b.splash = 0; b.homing = 0; b.crit = false; b.life = 0; b.hitId = -1;
      b.scale = 1; b.element = 'padrao';
    },
    capacity,
  );
}

export function createEnemyPool(capacity = 200): Pool<Enemy> {
  let nextId = 1;
  return new Pool<Enemy>(
    () => ({
      alive: false, id: 0, def: null as unknown as EnemyDef, boss: null,
      x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, scale: 1, damage: 1, share: 0, counts: true,
      time: 0, fireTimer: 0, hitFlash: 0, spin: 0, anchorX: 0, anchorY: 0,
      entering: true, phase: 0, summonTimer: 0, wobble: 0, facing: 0,
    }),
    (e) => {
      e.id = nextId++;
      e.boss = null; e.time = 0; e.hitFlash = 0; e.spin = 0; e.entering = true;
      e.phase = 0; e.summonTimer = 0; e.wobble = 0; e.facing = 0; e.vx = 0; e.vy = 0;
      e.counts = true;
    },
    capacity,
  );
}

export function createPickupPool(capacity = 80): Pool<Pickup> {
  return new Pool<Pickup>(
    () => ({ alive: false, kind: 'reparo', x: 0, y: 0, vx: 0, vy: 0, time: 0, magnet: false, item: null, icon: '', color: '#fff' }),
    (p) => { p.time = 0; p.magnet = false; p.vx = 0; p.item = null; p.icon = ''; p.color = '#fff'; },
    capacity,
  );
}

/** Clipe animado de cada coletável, vindo da folha `Bonuses`. */
export const PICKUP_CLIP: Record<PickupKind, string> = {
  reparo: 'pick/reparo',
  escudo: 'pick/escudo',
  dano: 'pick/dano',
  recompensa: 'pick/bonus',
  item: '',
};

/** Fallback estático, caso a folha arcade não tenha sido gerada. */
export const PICKUP_SPRITE: Record<PickupKind, string> = {
  reparo: 'powerup/drop_rapid',
  escudo: 'powerup/drop_shield',
  dano: 'powerup/drop_damage',
  recompensa: 'powerup/drop_bounty',
  item: '',
};

export const PICKUP_COLOR: Record<PickupKind, string> = {
  reparo: '#5ce08a',
  escudo: '#4db8ff',
  dano: '#ff7a4d',
  recompensa: '#ffb638',
  // Cápsulas de item usam a cor da raridade, guardada no próprio pickup.
  item: '#ffffff',
};
