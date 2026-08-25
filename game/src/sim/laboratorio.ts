import type { AttackPattern, MovePattern } from '@data/enemies';
import type { HullHitbox } from '@data/hulls';
import type { ElementId } from './types';

export type LabControl = 'manual' | 'agressivo' | 'evasivo' | 'coletor';
export type LabHitboxTarget = 'player' | 'enemy';
export type LabScenarioId = 'elite' | 'enxame' | 'cerco';

export interface LabScenario {
  id: LabScenarioId;
  name: string;
  description: string;
  duration: number;
  seeds: readonly [number, number, number];
  enemyId: string;
  config: Partial<LaboratorioConfig>;
}

export interface LaboratorioConfig {
  scenario: LabScenarioId;
  seed: number;
  playerHullId: string;
  playerShotHullId: string;
  enemyId: string;
  enemyShotEnemyId: string;
  /** Visual independente dos atributos: permite testar arte ainda não balanceada. */
  playerSprite: string;
  playerSpriteScale: number;
  playerHitboxWidth: number;
  playerHitboxHeight: number;
  playerHitboxOffsetX: number;
  playerHitboxOffsetY: number;
  enemySprite: string;
  enemySpriteScale: number;
  enemyHitboxKey: string;
  enemyHitboxWidth: number;
  enemyHitboxHeight: number;
  enemyHitboxOffsetX: number;
  enemyHitboxOffsetY: number;
  /** Alvo dos controles rápidos exibidos durante o confronto. */
  hitboxTarget: LabHitboxTarget;
  playerOnlyUncalibrated: boolean;
  enemyOnlyUncalibrated: boolean;
  enemyCount: number;
  control: LabControl;
  autoFire: boolean;
  immortal: boolean;
  autoRespawn: boolean;
  showHitboxes: boolean;
  showPlayerShieldVisual: boolean;
  speed: number;

  playerElement: ElementId;
  defenseElement: ElementId;
  elementalFraction: number;
  playerDamage: number;
  playerFireRate: number;
  playerShots: number;
  playerBulletSpeed: number;
  playerSpread: number;
  playerPierce: number;
  playerSplash: number;
  playerCritChance: number;
  playerCritDamage: number;
  playerPenetration: number;
  playerHp: number;
  playerShield: number;
  playerRegen: number;
  playerSpeed: number;
  playerAiSkill: number;

  enemyMove: MovePattern;
  enemyAttack: AttackPattern;
  enemyElement: ElementId;
  enemyElementalFraction: number;
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;
  enemyFireRate: number;
  enemyShots: number;
  enemyBulletSpeed: number;
}

export interface LaboratorioMetrics {
  elapsed: number;
  playerShots: number;
  playerHits: number;
  playerDamage: number;
  enemyShots: number;
  enemyHits: number;
  enemyDamage: number;
  kills: number;
  deaths: number;
  activeEnemies: number;
}

export interface LaboratorioState {
  active: boolean;
  paused: boolean;
  step: number;
  revision: number;
  config: LaboratorioConfig;
  metrics: LaboratorioMetrics;
}

export const DEFAULT_LAB_CONFIG: LaboratorioConfig = {
  scenario: 'elite', seed: 1103,
  playerHullId: 'void_canhao', playerShotHullId: 'void_canhao',
  enemyId: 'lanceiro', enemyShotEnemyId: 'lanceiro', enemyCount: 3,
  playerSprite: 'void/nave/casco_cheio', playerSpriteScale: 1.5,
  playerHitboxWidth: 30, playerHitboxHeight: 30,
  playerHitboxOffsetX: 0, playerHitboxOffsetY: 0,
  enemySprite: 'enemy/wraith_a', enemySpriteScale: 0.55,
  enemyHitboxKey: 'enemy:lanceiro',
  enemyHitboxWidth: 20.9, enemyHitboxHeight: 20.9,
  enemyHitboxOffsetX: 0, enemyHitboxOffsetY: 0,
  hitboxTarget: 'player',
  playerOnlyUncalibrated: false, enemyOnlyUncalibrated: false,
  control: 'manual', autoFire: true, immortal: false, autoRespawn: true,
  showHitboxes: false, showPlayerShieldVisual: true, speed: 1,
  playerElement: 'raio', defenseElement: 'padrao', elementalFraction: 0.35,
  playerDamage: 36, playerFireRate: 4, playerShots: 1, playerBulletSpeed: 780,
  playerSpread: 0.08, playerPierce: 0, playerSplash: 0,
  playerCritChance: 0.05, playerCritDamage: 0.5, playerPenetration: 0,
  playerHp: 500, playerShield: 180, playerRegen: 12, playerSpeed: 330, playerAiSkill: 0.7,
  enemyMove: 'pairar', enemyAttack: 'mirado', enemyElement: 'cosmico',
  enemyElementalFraction: 0.55, enemyHp: 240, enemyDamage: 24,
  enemySpeed: 90, enemyFireRate: 0.75, enemyShots: 1, enemyBulletSpeed: 250,
};

/** Protocolos fixos da bateria de balanceamento. */
export const LAB_SCENARIOS: readonly LabScenario[] = [
  {
    id: 'elite', name: 'Elite', duration: 90, seeds: [1103, 2207, 3301], enemyId: 'paladino_caelum',
    description: 'Um alvo resistente para medir dano sustentado, precisão e tempo de execução.',
    config: {
      enemyCount: 1, autoRespawn: true, enemyMove: 'pairar', enemyAttack: 'mirado',
      enemyElement: 'padrao', enemyElementalFraction: 0, enemyHp: 6500, enemyDamage: 34,
      enemySpeed: 72, enemyFireRate: .85, enemyShots: 2, enemyBulletSpeed: 285,
    },
  },
  {
    id: 'enxame', name: 'Enxame', duration: 75, seeds: [1201, 2401, 3607], enemyId: 'dardo',
    description: 'Oito alvos frágeis para medir cobertura, troca de alvo e excesso de dano.',
    config: {
      enemyCount: 8, autoRespawn: true, enemyMove: 'senoide', enemyAttack: 'direto',
      enemyElement: 'padrao', enemyElementalFraction: 0, enemyHp: 150, enemyDamage: 12,
      enemySpeed: 125, enemyFireRate: .65, enemyShots: 1, enemyBulletSpeed: 245,
    },
  },
  {
    id: 'cerco', name: 'Cerco', duration: 120, seeds: [1301, 2609, 3907], enemyId: 'lanceiro',
    description: 'Quatro emissores resistentes e muitos projéteis para medir sobrevivência por 120 segundos.',
    config: {
      enemyCount: 4, autoRespawn: false, enemyMove: 'pairar', enemyAttack: 'leque',
      enemyElement: 'padrao', enemyElementalFraction: 0, enemyHp: 1e9, enemyDamage: 18,
      enemySpeed: 55, enemyFireRate: 1.55, enemyShots: 7, enemyBulletSpeed: 260,
    },
  },
] as const;

export function labScenario(id: LabScenarioId): LabScenario {
  return LAB_SCENARIOS.find((entry) => entry.id === id) ?? LAB_SCENARIOS[0]!;
}

export function emptyLabMetrics(): LaboratorioMetrics {
  return { elapsed: 0, playerShots: 0, playerHits: 0, playerDamage: 0,
    enemyShots: 0, enemyHits: 0, enemyDamage: 0, kills: 0, deaths: 0, activeEnemies: 0 };
}

export function createLaboratorio(): LaboratorioState {
  return { active: false, paused: false, step: 0, revision: 0,
    config: { ...DEFAULT_LAB_CONFIG }, metrics: emptyLabMetrics() };
}

const finite = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const between = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, finite(value, fallback)));

/** Normaliza entradas do painel antes que cheguem ao laço de combate. */
export function normalizeLabConfig(input: Partial<LaboratorioConfig>, base = DEFAULT_LAB_CONFIG): LaboratorioConfig {
  const c = { ...base, ...input };
  return {
    ...c,
    scenario: c.scenario === 'enxame' || c.scenario === 'cerco' ? c.scenario : 'elite',
    seed: Math.round(between(c.seed, 1, 0x7fffffff, base.seed)),
    hitboxTarget: c.hitboxTarget === 'enemy' ? 'enemy' : 'player',
    enemyCount: Math.round(between(c.enemyCount, 1, 30, base.enemyCount)),
    playerSpriteScale: between(c.playerSpriteScale, 0.05, 4, base.playerSpriteScale),
    playerHitboxWidth: between(c.playerHitboxWidth, 6, 220, base.playerHitboxWidth),
    playerHitboxHeight: between(c.playerHitboxHeight, 6, 260, base.playerHitboxHeight),
    playerHitboxOffsetX: between(c.playerHitboxOffsetX, -100, 100, base.playerHitboxOffsetX),
    playerHitboxOffsetY: between(c.playerHitboxOffsetY, -120, 120, base.playerHitboxOffsetY),
    enemySpriteScale: between(c.enemySpriteScale, 0.05, 4, base.enemySpriteScale),
    enemyHitboxWidth: between(c.enemyHitboxWidth, 6, 220, base.enemyHitboxWidth),
    enemyHitboxHeight: between(c.enemyHitboxHeight, 6, 260, base.enemyHitboxHeight),
    enemyHitboxOffsetX: between(c.enemyHitboxOffsetX, -100, 100, base.enemyHitboxOffsetX),
    enemyHitboxOffsetY: between(c.enemyHitboxOffsetY, -120, 120, base.enemyHitboxOffsetY),
    speed: Math.round(between(c.speed, 1, 8, base.speed)),
    elementalFraction: between(c.elementalFraction, 0, 1, base.elementalFraction),
    playerDamage: between(c.playerDamage, 0.1, 1e9, base.playerDamage),
    playerFireRate: between(c.playerFireRate, 0.1, 60, base.playerFireRate),
    playerShots: Math.round(between(c.playerShots, 1, 24, base.playerShots)),
    playerBulletSpeed: between(c.playerBulletSpeed, 40, 2400, base.playerBulletSpeed),
    playerSpread: between(c.playerSpread, 0, 1.5, base.playerSpread),
    playerPierce: Math.round(between(c.playerPierce, 0, 30, base.playerPierce)),
    playerSplash: between(c.playerSplash, 0, 600, base.playerSplash),
    playerCritChance: between(c.playerCritChance, 0, 1, base.playerCritChance),
    playerCritDamage: between(c.playerCritDamage, 0, 20, base.playerCritDamage),
    playerPenetration: between(c.playerPenetration, 0, 1, base.playerPenetration),
    playerHp: between(c.playerHp, 1, 1e9, base.playerHp),
    playerShield: between(c.playerShield, 0, 1e9, base.playerShield),
    playerRegen: between(c.playerRegen, 0, 1e8, base.playerRegen),
    playerSpeed: between(c.playerSpeed, 40, 1500, base.playerSpeed),
    playerAiSkill: between(c.playerAiSkill, 0, 1, base.playerAiSkill),
    enemyElementalFraction: between(c.enemyElementalFraction, 0, 1, base.enemyElementalFraction),
    enemyHp: between(c.enemyHp, 1, 1e12, base.enemyHp),
    enemyDamage: between(c.enemyDamage, 0, 1e9, base.enemyDamage),
    enemySpeed: between(c.enemySpeed, 0, 1500, base.enemySpeed),
    enemyFireRate: between(c.enemyFireRate, 0, 60, base.enemyFireRate),
    enemyShots: Math.round(between(c.enemyShots, 0, 48, base.enemyShots)),
    enemyBulletSpeed: between(c.enemyBulletSpeed, 20, 2000, base.enemyBulletSpeed),
  };
}

export function labHitbox(config: LaboratorioConfig): HullHitbox {
  return {
    width: config.playerHitboxWidth,
    height: config.playerHitboxHeight,
    offsetX: config.playerHitboxOffsetX,
    offsetY: config.playerHitboxOffsetY,
  };
}

export function labEnemyHitbox(config: LaboratorioConfig): HullHitbox {
  return {
    width: config.enemyHitboxWidth,
    height: config.enemyHitboxHeight,
    offsetX: config.enemyHitboxOffsetX,
    offsetY: config.enemyHitboxOffsetY,
  };
}
