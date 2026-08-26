import { Pool } from '@core/pool';
import type { BossDef } from '@data/bosses';
import type { EnemyDef } from '@data/enemies';
import type { ElementId, Item } from '@sim/types';
import type { DamagePacket } from '@sim/dano';
import type { HullHitbox } from '@data/hulls';

/**
 * Espaço lógico da camada de combate.
 *
 * A ALTURA é fixa (o jogo é vertical e a dificuldade depende do tempo que um
 * inimigo leva para atravessar a tela); a LARGURA acompanha a proporção da
 * janela. Assim o campo de jogo preenche a coluna central sem tarjas pretas, em
 * vez de ficar uma tira estreita no meio de um monitor largo.
 */
export const VIEW = { w: 540, h: 960 };

/**
 * Limite mínimo apenas. A largura cresce com a tela para o canvas sempre
 * ocupar o palco; um teto aqui criava faixas escuras nas laterais em telas
 * largas, pois o canvas precisava preservar pixels quadrados.
 */
export const VIEW_W_MIN = 480;

/** Ajusta a largura lógica à proporção do elemento. */
export function fitView(cssW: number, cssH: number): void {
  const ratio = cssW / Math.max(1, cssH);
  VIEW.w = Math.round(Math.max(VIEW_W_MIN, VIEW.h * ratio));
}

export interface Bullet {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /**
   * Dano em COMPONENTES (§3): normal + Σ elementais.
   *
   * Antes era um número só com um elemento ao lado, e o confronto multiplicava
   * o número inteiro — toda a nave virava elemental ao equipar uma arma de
   * fogo. O pacote é o que separa a parte irresistível da parte que aposta.
   */
  damage: DamagePacket;
  /** Só a soma, para o número que aparece na tela e para o dano do inimigo. */
  damageTotal: number;
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
  /** Crítico do componente NORMAL. */
  crit: boolean;
  /** Crítico do componente ELEMENTAL — rolado à parte (§4). */
  critElem: boolean;
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
  /** Caixa personalizada. `null` mantém a colisão circular histórica. */
  hitbox: HullHitbox | null;
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
  /**
   * Multiplicador de cadência vindo do perfil da onda.
   *
   * Fica no inimigo e não no encontro porque os lacaios que um chefe invoca não
   * herdam a pressão da onda — eles têm a cadência do próprio arquétipo.
   */
  pressao: number;
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
  /** Estados transitórios dos modificadores mecânicos da Provação. */
  invulnerable: boolean;
  barrierActive: boolean;
  challengeClone: boolean;
}

/**
 * O que uma cápsula pode conter.
 *
 * Os power-ups de reparo, escudo e dano saíram (§30): melhoria temporária e
 * aleatória não pode ser fonte de poder. Sobraram os dois tipos que não são
 * melhoria — moeda e item —, e é por isso que a máquina de coletáveis continua
 * de pé apesar de o sistema de power-up ter sido removido.
 */
export type PickupKind = 'recompensa' | 'item';

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
  /** Caixa real; `radius` permanece como raio conservador para a IA. */
  hitbox: HullHitbox;
  fireTimer: number;
  /** Invulnerabilidade pós-respawn. */
  invuln: number;
  /** Inclinação visual, -1..1. */
  bank: number;
  alive: boolean;
  deathTimer: number;
  /**
   * Segundos sem responder a comando. Vem dos especiais da Provação.
   *
   * Atordoar é a única coisa que um chefe faz que o jogador não pode contornar
   * com atributo — por isso os especiais que atordoam têm a telegrafia mais
   * longa do catálogo.
   */
  stun: number;
  /** Corte de velocidade, 0..1, enquanto `slowFor` durar. */
  slow: number;
  slowFor: number;
}

export function createBulletPool(capacity = 1400): Pool<Bullet> {
  return new Pool<Bullet>(
    () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4,
      damage: { normal: 1, elementais: {} }, damageTotal: 1, friendly: true,
      sprite: '', color: '#fff', scale: 1, pierce: 0, splash: 0, homing: 0,
      crit: false, critElem: false, element: 'padrao', life: 0, hitId: -1,
    }),
    (b) => {
      b.pierce = 0; b.splash = 0; b.homing = 0; b.crit = false; b.critElem = false;
      b.life = 0; b.hitId = -1; b.scale = 1; b.element = 'padrao';
      // Objeto NOVO, não o mesmo limpo: o pacote sai do pool e é lido durante o
      // voo, então reaproveitar a referência faria uma salva nova sobrescrever
      // o dano de uma que ainda está no ar.
      b.damage = { normal: 0, elementais: {} };
      b.damageTotal = 0;
    },
    capacity,
  );
}

export function createEnemyPool(capacity = 260): Pool<Enemy> {
  let nextId = 1;
  return new Pool<Enemy>(
    () => ({
      alive: false, id: 0, def: null as unknown as EnemyDef, boss: null,
      x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, scale: 1, hitbox: null, damage: 1, share: 0, counts: true,
      time: 0, fireTimer: 0, pressao: 1, hitFlash: 0, spin: 0, anchorX: 0, anchorY: 0,
      entering: true, phase: 0, summonTimer: 0, wobble: 0, facing: 0,
      invulnerable: false, barrierActive: false, challengeClone: false,
    }),
    (e) => {
      e.id = nextId++;
      e.boss = null; e.time = 0; e.hitFlash = 0; e.spin = 0; e.entering = true;
      e.phase = 0; e.summonTimer = 0; e.wobble = 0; e.facing = 0; e.vx = 0; e.vy = 0;
      e.counts = true; e.pressao = 1; e.hitbox = null;
      e.invulnerable = false; e.barrierActive = false; e.challengeClone = false;
    },
    capacity,
  );
}

/**
 * Um detrito em campo: asteroide ou lixo espacial.
 *
 * Entidade PRÓPRIA e não um inimigo com recompensa zero. Um inimigo passa por
 * `rewardKill`, entra em `restam`, alimenta missão e conta abate — e desligar
 * cada uma dessas coisas com um `if` deixaria quatro lugares onde alguém
 * poderia esquecer. Sendo outro tipo, ele nunca chega perto desses caminhos.
 */
export interface Detrito {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  raio: number;
  vida: number;
  vidaMax: number;
  /** Rotação atual, em radianos. */
  giro: number;
  /** Velocidade de rotação, em radianos por segundo. */
  giroVel: number;
  sprite: string;
  /** Dano no encontrão com a nave. */
  impacto: number;
  /** Piscada branca ao levar tiro. */
  flash: number;
  /** Já bateu na nave? Impede o mesmo detrito cobrar duas vezes. */
  bateu: boolean;
}

/**
 * Capacidade 80: o teto de vivos é 70 (`DETRITOS_MAX`), e a folga cobre o
 * quadro em que uma chuva solta a última leva antes de a primeira sair de tela.
 */
export function createDetritoPool(capacity = 80): Pool<Detrito> {
  return new Pool<Detrito>(
    () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, raio: 12,
      vida: 1, vidaMax: 1, giro: 0, giroVel: 0, sprite: '',
      impacto: 0, flash: 0, bateu: false,
    }),
    (d) => { d.flash = 0; d.bateu = false; d.vx = 0; d.giro = 0; },
    capacity,
  );
}

export function createPickupPool(capacity = 80): Pool<Pickup> {
  return new Pool<Pickup>(
    () => ({ alive: false, kind: 'recompensa', x: 0, y: 0, vx: 0, vy: 0, time: 0, magnet: false, item: null, icon: '', color: '#fff' }),
    (p) => { p.time = 0; p.magnet = false; p.vx = 0; p.item = null; p.icon = ''; p.color = '#fff'; },
    capacity,
  );
}

/** Clipe animado de cada coletável, vindo da folha `Bonuses`. */
export const PICKUP_CLIP: Record<PickupKind, string> = {
  recompensa: 'pick/bonus',
  item: '',
};

/** Fallback estático, caso a folha arcade não tenha sido gerada. */
export const PICKUP_SPRITE: Record<PickupKind, string> = {
  recompensa: 'powerup/drop_bounty',
  item: '',
};

export const PICKUP_COLOR: Record<PickupKind, string> = {
  recompensa: '#ffb638',
  // Cápsulas de item usam a cor da raridade, guardada no próprio pickup.
  item: '#ffffff',
};
