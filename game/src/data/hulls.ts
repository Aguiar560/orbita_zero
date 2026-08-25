import type { ElementId, StatMap } from '@sim/types';
import { getElement } from './elements';
import { SPACESHIPS2_HULLS } from './hulls-spaceships2';

export interface ShotStyle {
  /** Sprite do projétil no atlas. */
  sprite: string;
  /** Velocidade em px lógicos por segundo. */
  speed: number;
  /** Cor do impacto e do brilho. */
  color: string;
  /** Escala do sprite. */
  scale: number;
  /** Abertura entre projéteis extras, em radianos. */
  spread: number;
}

/** Caixa de colisão do casco, em pixels lógicos e relativa ao centro da arte. */
export interface HullHitbox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_HULL_HITBOX: Readonly<HullHitbox> = {
  width: 30, height: 30, offsetX: 0, offsetY: 0,
};

export function normalizeHullHitbox(input?: Partial<HullHitbox>): HullHitbox {
  const finite = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    width: Math.round(Math.min(220, Math.max(6, finite(input?.width, DEFAULT_HULL_HITBOX.width))) * 10) / 10,
    height: Math.round(Math.min(260, Math.max(6, finite(input?.height, DEFAULT_HULL_HITBOX.height))) * 10) / 10,
    offsetX: Math.round(Math.min(100, Math.max(-100, finite(input?.offsetX, 0))) * 10) / 10,
    offsetY: Math.round(Math.min(120, Math.max(-120, finite(input?.offsetY, 0))) * 10) / 10,
  };
}

export interface Hull {
  id: string;
  name: string;
  tier: number;
  blurb: string;
  /** Sprite principal na camada vertical (nave apontando para cima). */
  sprite: string;
  /**
   * Elemento nativo do casco.
   *
   * Vale enquanto não houver arma principal equipada — a arma, quando existe,
   * manda no elemento do tiro. Assim o casco define a identidade e o item
   * define a tática do momento.
   */
  element: ElementId;
  /** Escala de desenho quando o casco não é montado em camadas. */
  scale?: number;
  /** Quadros de inclinação `[esq2, esq1, centro, dir1, dir2]`, se houver. */
  bank?: readonly [string, string, string, string, string];
  /** Sprite de perfil usado na faixa horizontal. */
  barSprite: string;
  /** Prefixo do clipe de escape da faixa horizontal. */
  barExhaust: string;
  /** Cor do rastro do motor. */
  trail: string;
  shot: ShotStyle;
  /** Contribuição de base para os atributos. */
  stats: StatMap;
  /** Custo de desbloqueio em cristais; 0 = inicial. */
  cost: number;
  /** Setor mínimo alcançado alguma vez para o casco aparecer no hangar. */
  requiresSector: number;
  /** Caixa-base. A calibração administrativa versionada pode substituí-la. */
  hitbox?: HullHitbox;
  /** Casco completo de laboratório, ainda fora da progressão da campanha. */
  prototype?: boolean;
  /**
   * Casco de partida deste piloto (`data/pilotos.ts`).
   *
   * Não é comprável e não entra na frota inicial de todo mundo: ele CHEGA com
   * o personagem escolhido. Sem esta marca os quatro cairiam juntos em
   * `INITIAL_FLEET`, que é derivada de "custo 0 e setor 0" — e a escolha da
   * primeira tela não valeria nada, porque o jogador teria os quatro.
   */
  piloto?: string;

  // ── camadas do pack Void (opcionais) ───────────────────────────────────────
  /** Quadros de casco por dano: `[intacto, leve, médio, grave]`. */
  damageStates?: readonly [string, string, string, string];
  /** Clipe do escape, desenhado atrás do casco. */
  engineClip?: string;
  /** Clipe do escape em aceleração. */
  boostClip?: string;
  /** Peça fixa do motor, sob o casco. */
  enginePart?: string;
  /** Arma animada sobreposta ao casco. */
  weaponClip?: string;
  /** Escudo animado próprio da nave. */
  shieldClip?: string;
}

/** Estados de casco da nave principal do pack Void. */
const VOID_DAMAGE = [
  'void/nave/casco_cheio',
  'void/nave/casco_leve',
  'void/nave/casco_medio',
  'void/nave/casco_grave',
] as const;

const ION: ShotStyle = { sprite: 'shot/ion_light', speed: 780, color: '#66d9ff', scale: 0.62, spread: 0.06 };
const ION_HEAVY: ShotStyle = { sprite: 'shot/ion_heavy', speed: 700, color: '#7fe4ff', scale: 0.72, spread: 0.05 };
const PYRO: ShotStyle = { sprite: 'shot/pyro_light', speed: 820, color: '#ff9a4d', scale: 0.62, spread: 0.07 };
const PYRO_HEAVY: ShotStyle = { sprite: 'shot/pyro_heavy', speed: 740, color: '#ffb056', scale: 0.72, spread: 0.05 };
const LANCE: ShotStyle = { sprite: 'beam/lance', speed: 960, color: '#9fe8ff', scale: 0.5, spread: 0.04 };
const TESLA: ShotStyle = { sprite: 'beam/tesla', speed: 880, color: '#8fd0ff', scale: 0.55, spread: 0.1 };

/**
 * Tiro que ANUNCIA o elemento.
 *
 * A folha `sprites.png` trouxe um projétil por cor, e o jogo depende disso: o
 * jogador precisa reconhecer o tipo de dano pela tela, sem abrir menu. Por isso
 * o sprite e a cor saem da tabela de elementos, não escritos à mão.
 */
const elemShot = (element: ElementId, speed: number, spread = 0.06, scale = 0.9): ShotStyle => {
  const info = getElement(element);
  return { sprite: info.bullet[0], speed, color: info.color, scale, spread };
};

const CORE_HULLS: readonly Hull[] = [
  // ── linha Void: casco em camadas, com dano visível e armas animadas ───────
  {
    id: 'void_canhao',
    name: 'Vetor VC-1',
    tier: 1,
    element: 'raio',
    blurb: 'Casco padrão da frota. Canhão automático e motor básico — o ponto de partida.',
    sprite: 'void/nave/casco_cheio',
    damageStates: VOID_DAMAGE,
    enginePart: 'void/nave/motor_base',
    engineClip: 'void/nave/motorfx_base_idle',
    boostClip: 'void/nave/motorfx_base_forca',
    weaponClip: 'void/nave/arma_canhao',
    shieldClip: 'void/nave/escudo_frontal',
    barSprite: 'hull/ship1',
    barExhaust: 'hull/ship1_exhaust_idle_',
    trail: '#7fe4ff',
    shot: { sprite: 'void/tiro/canhao_0', speed: 760, color: '#8fe8ff', scale: 1, spread: 0.06 },
    // Regeneração baixa de fábrica: é ela que decide se o casco cru aguenta o
    // piloto cru. Com 3/s a nave inicial era imortal apesar de levar tiro.
    stats: { dano: 7, cadencia: 3.4, vida: 110, escudo: 45, regen: 1.4, velocidade: 215, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
  },
  {
    id: 'void_zapper',
    name: 'Vetor VZ-3',
    tier: 3,
    element: 'cosmico',
    blurb: 'Zapper de arco e motor de pulso. Cadência alta, projétil que rasga fileiras.',
    sprite: 'void/nave/casco_cheio',
    damageStates: VOID_DAMAGE,
    enginePart: 'void/nave/motor_pulso',
    engineClip: 'void/nave/motorfx_pulso_idle',
    boostClip: 'void/nave/motorfx_pulso_forca',
    weaponClip: 'void/nave/arma_zapper',
    shieldClip: 'void/nave/escudo_lateral',
    barSprite: 'hull/ship2',
    barExhaust: 'hull/ship2_exhaust_idle_',
    trail: '#a86bff',
    shot: { sprite: 'void/tiro/zapper_0', speed: 900, color: '#c79bff', scale: 1, spread: 0.05 },
    stats: { dano: 16, cadencia: 4.6, vida: 165, escudo: 90, regen: 5, velocidade: 245, projeteis: 2, perfuracao: 1 },
    cost: 90,
    requiresSector: 14,
  },
  {
    id: 'void_foguete',
    name: 'Vetor VF-5',
    tier: 4,
    element: 'fogo',
    blurb: 'Bateria de foguetes e motor de rajada. Cada salva explode em área.',
    sprite: 'void/nave/casco_cheio',
    damageStates: VOID_DAMAGE,
    enginePart: 'void/nave/motor_rajada',
    engineClip: 'void/nave/motorfx_rajada_idle',
    boostClip: 'void/nave/motorfx_rajada_forca',
    weaponClip: 'void/nave/arma_foguetes',
    shieldClip: 'void/nave/escudo_redondo',
    barSprite: 'hull/ship4',
    barExhaust: 'hull/ship4_exhaust_idle_',
    trail: '#ff9a4d',
    shot: { sprite: 'void/tiro/foguetes_0', speed: 640, color: '#ffb056', scale: 1, spread: 0.09 },
    stats: { dano: 34, cadencia: 2.8, vida: 240, escudo: 150, regen: 9, velocidade: 230, projeteis: 2, explosao: 34 },
    cost: 260,
    requiresSector: 28,
  },
  {
    id: 'void_canhaozao',
    name: 'Vetor VX-9',
    tier: 6,
    element: 'padrao',
    blurb: 'Canhão espacial pesado com motor supercarregado. Tiro lento, buraco enorme.',
    sprite: 'void/nave/casco_cheio',
    damageStates: VOID_DAMAGE,
    enginePart: 'void/nave/motor_turbo',
    engineClip: 'void/nave/motorfx_turbo_idle',
    boostClip: 'void/nave/motorfx_turbo_forca',
    weaponClip: 'void/nave/arma_canhaozao',
    shieldClip: 'void/nave/escudo_invulneravel',
    barSprite: 'hull/ship6',
    barExhaust: 'hull/ship6_exhaust_boost_',
    trail: '#ffe08a',
    shot: { sprite: 'void/tiro/canhaozao_0', speed: 700, color: '#ffe08a', scale: 1, spread: 0.04 },
    stats: {
      dano: 96, cadencia: 2.4, vida: 400, escudo: 320, regen: 18, velocidade: 260,
      projeteis: 2, perfuracao: 3, critChance: 0.15, critDano: 0.7, explosao: 40, iaSkill: 0.1,
    },
    cost: 1200,
    requiresSector: 48,
  },

  // ── linha clássica (folha Espaço / SpaceRage) ─────────────────────────────
  {
    id: 'aurora1',
    name: 'Aurora Mk I',
    tier: 1,
    element: 'raio',
    blurb: 'Interceptador de série. Barato, confiável, sem surpresas.',
    sprite: 'ship/aurora_a',
    barSprite: 'hull/ship1',
    barExhaust: 'hull/ship1_exhaust_idle_',
    trail: '#4fc3ff',
    shot: ION,
    stats: { dano: 6, cadencia: 3.2, vida: 100, escudo: 40, regen: 3, velocidade: 210, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
  },
  {
    id: 'aurora2',
    name: 'Aurora Mk II',
    tier: 2,
    element: 'raio',
    blurb: 'Asas reforçadas e um segundo canhão de íons acoplado.',
    sprite: 'ship/aurora_b',
    barSprite: 'hull/ship2',
    barExhaust: 'hull/ship2_exhaust_idle_',
    trail: '#4fc3ff',
    shot: ION,
    stats: { dano: 9, cadencia: 3.4, vida: 130, escudo: 60, regen: 4, velocidade: 220, projeteis: 2 },
    cost: 30,
    requiresSector: 8,
  },
  {
    id: 'ignis1',
    name: 'Ignis Mk I',
    tier: 2,
    element: 'fogo',
    blurb: 'Casco de assalto. Troca escudo por cadência bruta.',
    sprite: 'ship/ignis_a',
    barSprite: 'hull/ship3',
    barExhaust: 'hull/ship3_exhaust_idle_',
    trail: '#ff7a3d',
    shot: PYRO,
    stats: { dano: 8, cadencia: 4.6, vida: 115, escudo: 30, regen: 2.5, velocidade: 235, projeteis: 1, critChance: 0.05 },
    cost: 45,
    requiresSector: 12,
  },
  {
    id: 'aurora3',
    name: 'Aurora Mk III',
    tier: 3,
    element: 'gelo',
    blurb: 'Reator secundário: escudo denso e regeneração acelerada.',
    sprite: 'ship/aurora_c',
    barSprite: 'hull/ship4',
    barExhaust: 'hull/ship4_exhaust_idle_',
    trail: '#4fc3ff',
    shot: ION_HEAVY,
    stats: { dano: 14, cadencia: 3.1, vida: 180, escudo: 120, regen: 8, velocidade: 215, projeteis: 2, perfuracao: 1 },
    cost: 120,
    requiresSector: 20,
  },
  {
    id: 'ignis2',
    name: 'Ignis Mk II',
    tier: 3,
    element: 'fogo',
    blurb: 'Canhões pirolíticos gêmeos. Aquece rápido, mata mais rápido.',
    sprite: 'ship/ignis_b',
    barSprite: 'hull/ship5',
    barExhaust: 'hull/ship5_exhaust_idle_',
    trail: '#ff7a3d',
    shot: PYRO_HEAVY,
    stats: { dano: 17, cadencia: 4.2, vida: 160, escudo: 70, regen: 4, velocidade: 240, projeteis: 2, critChance: 0.1, critDano: 0.3 },
    cost: 180,
    requiresSector: 26,
  },
  {
    id: 'falcao_b',
    name: 'Falcão Azul',
    tier: 4,
    element: 'gelo',
    blurb: 'Protótipo ágil com controle de inclinação real. Coleta melhor.',
    sprite: 'sr/player/player_b_m',
    bank: ['sr/player/player_b_l2', 'sr/player/player_b_l1', 'sr/player/player_b_m', 'sr/player/player_b_r1', 'sr/player/player_b_r2'],
    barSprite: 'hull/ship6',
    barExhaust: 'hull/ship6_exhaust_idle_',
    trail: '#5ad8ff',
    shot: LANCE,
    stats: { dano: 22, cadencia: 3.8, vida: 210, escudo: 140, regen: 9, velocidade: 285, projeteis: 2, sorte: 0.15, perfuracao: 1 },
    cost: 320,
    requiresSector: 34,
  },
  {
    id: 'falcao_r',
    name: 'Falcão Rubro',
    tier: 4,
    element: 'fogo',
    blurb: 'Mesma célula do Azul, calibrada para crítico em série.',
    sprite: 'sr/player/player_r_m',
    bank: ['sr/player/player_r_l2', 'sr/player/player_r_l1', 'sr/player/player_r_m', 'sr/player/player_r_r1', 'sr/player/player_r_r2'],
    barSprite: 'hull/ship5',
    barExhaust: 'hull/ship5_exhaust_idle_',
    trail: '#ff6a5a',
    shot: PYRO_HEAVY,
    stats: { dano: 26, cadencia: 3.6, vida: 190, escudo: 110, regen: 7, velocidade: 275, projeteis: 2, critChance: 0.18, critDano: 0.6 },
    cost: 320,
    requiresSector: 34,
  },
  {
    id: 'aurora4',
    name: 'Aurora Mk IV',
    tier: 5,
    element: 'gelo',
    blurb: 'Configuração de linha de frente. Perfura fileiras inteiras.',
    sprite: 'ship/aurora_d',
    barSprite: 'hull/ship4',
    barExhaust: 'hull/ship4_exhaust_boost_',
    trail: '#8ae6ff',
    shot: LANCE,
    stats: { dano: 38, cadencia: 3.4, vida: 280, escudo: 220, regen: 14, velocidade: 250, projeteis: 3, perfuracao: 3, explosao: 18 },
    cost: 700,
    requiresSector: 45,
  },
  {
    id: 'ignis4',
    name: 'Ignis Mk IV',
    tier: 5,
    element: 'fogo',
    blurb: 'Bateria de plasma instável. Dano absurdo, casco de papel.',
    sprite: 'ship/ignis_d',
    barSprite: 'hull/ship3',
    barExhaust: 'hull/ship3_exhaust_boost_',
    trail: '#ff5a3d',
    shot: TESLA,
    stats: { dano: 52, cadencia: 2.3, vida: 210, escudo: 90, regen: 5, velocidade: 300, projeteis: 2, critChance: 0.25, critDano: 1.0, explosao: 26 },
    cost: 900,
    requiresSector: 55,
  },
  {
    id: 'aurora_x',
    name: 'Aurora Zênite',
    tier: 6,
    element: 'cosmico',
    blurb: 'Casco de relíquia remontado com núcleos de universos mortos.',
    sprite: 'ship/aurora_c',
    barSprite: 'hull/ship6',
    barExhaust: 'hull/ship6_exhaust_boost_',
    trail: '#c9a7ff',
    shot: { sprite: 'beam/chain', speed: 900, color: '#ffcf7a', scale: 0.55, spread: 0.05 },
    stats: {
      dano: 90, cadencia: 1.6, vida: 420, escudo: 380, regen: 22, velocidade: 290,
      projeteis: 2, perfuracao: 2, critChance: 0.2, critDano: 0.8, explosao: 34, sorte: 0.4, iaSkill: 0.15,
    },
    cost: 2400,
    requiresSector: 70,
  },

  // ── linha Prisma: uma nave por elemento ──────────────────────────────────
  // É a única linha que cobre os seis tipos de dano, e cada casco é o extremo
  // de um eixo — o perfil de atributos de um não se parece com o de nenhum
  // outro. Serve para o jogador ESCOLHER, não para "a próxima é sempre melhor".
  {
    id: 'prisma_raio',
    name: 'Prisma Arco',
    tier: 2,
    element: 'raio',
    blurb: 'Bateria de arco em cascata. Cadência absurda, casco fino.',
    sprite: 'nave/frio_0',
    scale: 0.5,
    barSprite: 'hull/ship2',
    barExhaust: 'hull/ship2_exhaust_idle_',
    trail: '#4aa8ff',
    shot: elemShot('raio', 900, 0.05),
    stats: { dano: 9, cadencia: 6.2, vida: 120, escudo: 55, regen: 3, velocidade: 250, projeteis: 2 },
    cost: 40,
    requiresSector: 6,
  },
  {
    id: 'prisma_gelo',
    name: 'Prisma Aegis',
    tier: 3,
    element: 'gelo',
    blurb: 'Casco criogênico. Aguenta o que ninguém aguenta e devolve devagar.',
    sprite: 'nave/frio_1',
    scale: 0.5,
    barSprite: 'hull/ship4',
    barExhaust: 'hull/ship4_exhaust_idle_',
    trail: '#5ce6ff',
    shot: elemShot('gelo', 700, 0.06),
    stats: { dano: 13, cadencia: 2.6, vida: 260, escudo: 180, regen: 11, velocidade: 190, projeteis: 1, resGelo: 0.25 },
    cost: 150,
    requiresSector: 16,
  },
  {
    id: 'prisma_padrao',
    name: 'Prisma Áureo',
    tier: 4,
    element: 'padrao',
    blurb: 'Sem apostas: dano neutro, tudo mediano e um faro absurdo para carga.',
    sprite: 'nave/frio_2',
    scale: 0.5,
    barSprite: 'hull/ship6',
    barExhaust: 'hull/ship6_exhaust_idle_',
    trail: '#ffe08a',
    shot: elemShot('padrao', 800, 0.06),
    stats: {
      dano: 24, cadencia: 3.6, vida: 210, escudo: 130, regen: 8, velocidade: 240,
      projeteis: 2, sorte: 0.35, sucataGanho: 0.3, nucleoGanho: 0.25,
    },
    cost: 380,
    requiresSector: 30,
  },
  {
    id: 'prisma_fogo',
    name: 'Prisma Pirônio',
    tier: 4,
    element: 'fogo',
    blurb: 'Ogivas incendiárias. Cada salva abre uma cratera — e não perdoa erro.',
    sprite: 'nave/quente_0',
    scale: 0.5,
    barSprite: 'hull/ship3',
    barExhaust: 'hull/ship3_exhaust_boost_',
    trail: '#ff5a3c',
    shot: elemShot('fogo', 660, 0.09),
    stats: {
      dano: 58, cadencia: 2.2, vida: 175, escudo: 80, regen: 4, velocidade: 235,
      projeteis: 2, explosao: 46, danoFogo: 0.2,
    },
    cost: 420,
    requiresSector: 32,
  },
  {
    id: 'prisma_cosmico',
    name: 'Prisma Vazio',
    tier: 5,
    element: 'cosmico',
    blurb: 'Perfura fileiras inteiras e crava crítico atrás de crítico.',
    sprite: 'nave/quente_1',
    scale: 0.5,
    barSprite: 'hull/ship5',
    barExhaust: 'hull/ship5_exhaust_boost_',
    trail: '#b45cff',
    shot: elemShot('cosmico', 940, 0.04),
    stats: {
      dano: 40, cadencia: 3, vida: 200, escudo: 150, regen: 7, velocidade: 275,
      projeteis: 2, perfuracao: 2, critChance: 0.26, critDano: 0.9, danoCosmico: 0.2,
    },
    cost: 860,
    requiresSector: 44,
  },
  {
    id: 'prisma_quimico',
    name: 'Prisma Verdete',
    tier: 6,
    element: 'quimico',
    blurb: 'Reator biocatalítico: regenera sem parar e conversa melhor com o piloto.',
    sprite: 'nave/quente_2',
    scale: 0.5,
    barSprite: 'hull/ship1',
    barExhaust: 'hull/ship1_exhaust_boost_',
    trail: '#7ee858',
    shot: elemShot('quimico', 780, 0.07),
    stats: {
      dano: 62, cadencia: 3.3, vida: 340, escudo: 260, regen: 26, velocidade: 265,
      projeteis: 2, perfuracao: 2, iaSkill: 0.18, danoQuimico: 0.25, resQuimico: 0.2,
    },
    cost: 1600,
    requiresSector: 58,
  },

  // ── cascos de piloto (§ escolha inicial) ──────────────────────────────────
  //
  // Quatro formas, UMA nota. `powerScore` é a média geométrica de ataque e
  // defesa, e os quatro batem em 1,10× o Aurora Mk I com 1,58% de dispersão
  // entre si — contra 34% de diferença em dps e 30% em vida efetiva. É isso
  // que faz a escolha ser de gosto e não de vantagem, e `tests/pilotos.test.ts`
  // é quem não deixa esquecer.
  //
  // O casco do personagem é melhor que o genérico de propósito: se empatasse,
  // o jogador trocaria pelo Aurora no primeiro minuto e a escolha morreria
  // ali. Mas 1,10 e não 1,15, e o teto veio de MEDIÇÃO, não de gosto — com
  // 1,15 o setor 1 dava 90,8 golpes de sobrevivência contra o teto de 90 do
  // §2, e a régua reprovava a introdução por ser mansa demais. Em 1,10 dá
  // 87,7, com folga real.
  {
    id: 'nucleo_vektor',
    name: 'Núcleo Vektor',
    tier: 1,
    element: 'raio',
    blurb: 'Casco de navegação sintético. Faz tudo bem e nada de espetacular.',
    sprite: 'ship/aurora_a',
    barSprite: 'hull/ship1',
    barExhaust: 'hull/ship1_exhaust_idle_',
    trail: '#4fc3ff',
    shot: elemShot('raio', 800),
    stats: { dano: 6.8, cadencia: 3.2, vida: 115, escudo: 40, regen: 3, velocidade: 210, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
    piloto: 'piloto_vektor',
  },
  {
    id: 'lanca_rubra',
    name: 'Lança Rubra',
    tier: 1,
    element: 'fogo',
    blurb: 'Casco de corrida convertido para combate. Rápido de matar, fácil de morrer.',
    sprite: 'ship/ignis_a',
    barSprite: 'hull/ship2',
    barExhaust: 'hull/ship2_exhaust_idle_',
    trail: '#ff8a4d',
    shot: elemShot('fogo', 820),
    stats: { dano: 7.3, cadencia: 3.4, vida: 95, escudo: 38, regen: 3, velocidade: 210, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
    piloto: 'piloto_darin',
  },
  {
    id: 'baluarte_glacial',
    name: 'Baluarte Glacial',
    tier: 1,
    element: 'gelo',
    blurb: 'Blindagem de doca fria sobre um casco leve. Absorve o que os outros desviam.',
    sprite: 'ship/aurora_c',
    barSprite: 'hull/ship3',
    barExhaust: 'hull/ship3_exhaust_idle_',
    trail: '#5ce6ff',
    shot: elemShot('gelo', 760),
    stats: { dano: 5.8, cadencia: 3.2, vida: 125, escudo: 48, regen: 3.9, velocidade: 210, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
    piloto: 'piloto_sora',
  },
  {
    id: 'sopro_astral',
    name: 'Sopro Astral',
    tier: 1,
    element: 'cosmico',
    blurb: 'Responde antes do comando. Ninguém a bordo sabe explicar como.',
    sprite: 'ship/ignis_c',
    barSprite: 'hull/ship4',
    barExhaust: 'hull/ship4_exhaust_idle_',
    trail: '#b45cff',
    shot: elemShot('cosmico', 860),
    stats: { dano: 6.4, cadencia: 3.5, vida: 95, escudo: 38, regen: 3, velocidade: 255, projeteis: 1 },
    cost: 0,
    requiresSector: 0,
    piloto: 'piloto_nharu',
  },
];

/** Vinte cascos originais + as 29 artes Spaceships 2.0 já balanceadas. */
export const HULLS: readonly Hull[] = [...CORE_HULLS, ...SPACESHIPS2_HULLS];

export const HULL_BY_ID = new Map(HULLS.map((h) => [h.id, h]));

export const getHull = (id: string): Hull => HULL_BY_ID.get(id) ?? HULLS[0]!;
