import type { ElementId } from '@sim/types';
import { getElement } from './elements';
import { VOID_ENEMIES } from './fleets';

export type MovePattern =
  | 'mergulho'   // desce reto, acelerando
  | 'senoide'    // desce oscilando na horizontal
  | 'pairar'     // desce até uma altura e fica lá, estrafeando
  | 'deriva'     // rocha à deriva, gira e cai
  | 'investida'  // recua, mira e mergulha na direção do jogador
  | 'orbita';    // circula um ponto de âncora

export type AttackPattern =
  | 'nenhum'
  | 'direto'     // atira para baixo
  | 'mirado'     // mira no jogador
  | 'leque'      // várias balas em leque
  | 'espiral'    // rotaciona o ângulo a cada salva
  | 'teleguiado' // projétil com correção de curso
  | 'explosivo'; // detona por proximidade

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  /** Quadros de inclinação, se o sprite tiver. */
  bank?: readonly string[];
  /** Clipe em loop, quando o corpo inteiro é animado (minas, por exemplo). */
  clip?: string;
  /** Escape, desenhado sob o casco em loop. */
  engineClip?: string;
  /** Animação de destruição, tocada no lugar da explosão genérica. */
  deathClip?: string;
  /** Arma animada, sobreposta ao casco em loop. */
  weaponClip?: string;
  /** Escudo animado, sobreposto em elites. */
  shieldClip?: string;
  /**
   * Marcadores livres, para as regras de drop (§10) casarem por GRUPO.
   *
   * O eixo pensado para conteúdo futuro: em vez de listar quarenta inimigos de
   * uma facção nova numa regra, marca-se todos com a mesma tag e uma regra só
   * os cobre. Inimigo sem tag continua funcionando — cai na regra base.
   */
  tags?: readonly string[];
  /** Raio de colisão em px lógicos. */
  radius: number;
  /** Escala de desenho. */
  scale: number;

  /**
   * Tipo de dano que este inimigo causa E contra o qual ele se defende.
   *
   * Um só campo para os dois papéis porque é o que o jogador consegue LER: a
   * cor do tiro na tela é a mesma informação que "o que ele resiste". Duas
   * tabelas separadas seriam invisíveis em combate.
   */
  element: ElementId;

  /** Multiplicadores sobre a curva base do setor. */
  hp: number;
  dano: number;
  reward: number;

  speed: number;
  move: MovePattern;

  attack: AttackPattern;
  /** Salvas por segundo. */
  fireRate: number;
  /** Projéteis por salva. */
  shots: number;
  bulletSprite: string;
  bulletSpeed: number;
  bulletColor: string;

  /** Faixa de setor em que aparece: `[min, max]` (max 0 = sem limite). */
  sectors: readonly [number, number];
  /** Peso na composição da onda. */
  weight: number;
  /** Clipe de explosão ao morrer. */
  blast: string;
  /** Marca elites: entram em ondas especiais e soltam mais loot. */
  elite?: boolean;
}

const base = {
  bulletSprite: 'shot/void_light',
  bulletSpeed: 260,
  bulletColor: '#c07dff',
  blast: 'blast/fire',
  element: 'cosmico',
} as const;

export const ENEMIES: readonly EnemyDef[] = [
  {
    ...base,
    id: 'dardo', name: 'Dardo', sprite: 'enemy/verdant_a', element: 'quimico',
    radius: 17, scale: 0.52, hp: 0.55, dano: 0.8, reward: 0.8,
    speed: 155, move: 'mergulho', attack: 'nenhum', fireRate: 0, shots: 0,
    bulletColor: '#8dff5c', sectors: [1, 0], weight: 100,
  },
  {
    ...base,
    id: 'lanceiro', name: 'Lanceiro', sprite: 'enemy/wraith_a', element: 'cosmico',
    radius: 19, scale: 0.55, hp: 1.0, dano: 1.0, reward: 1.0,
    speed: 88, move: 'pairar', attack: 'mirado', fireRate: 0.75, shots: 1,
    bulletSprite: 'shot/void_light', bulletSpeed: 250, sectors: [1, 0], weight: 90,
  },
  {
    ...base,
    id: 'tecelao', name: 'Tecelão', sprite: 'enemy/verdant_b', element: 'quimico',
    radius: 20, scale: 0.56, hp: 0.9, dano: 0.9, reward: 1.1,
    speed: 110, move: 'senoide', attack: 'leque', fireRate: 0.5, shots: 3,
    bulletSprite: 'shot/bio_light', bulletSpeed: 210, bulletColor: '#8dff5c',
    sectors: [3, 0], weight: 80,
  },
  {
    ...base,
    id: 'enxame', name: 'Enxame', sprite: 'sr/enemy/enemy_1_g_m', element: 'quimico',
    bank: ['sr/enemy/enemy_1_g_l2', 'sr/enemy/enemy_1_g_l1', 'sr/enemy/enemy_1_g_m', 'sr/enemy/enemy_1_g_r1', 'sr/enemy/enemy_1_g_r2'],
    radius: 13, scale: 0.7, hp: 0.3, dano: 0.6, reward: 0.5,
    speed: 195, move: 'senoide', attack: 'nenhum', fireRate: 0, shots: 0,
    bulletColor: '#8dff5c', sectors: [2, 0], weight: 110, blast: 'arc/boom_plasma',
  },
  {
    ...base,
    id: 'baluarte', name: 'Baluarte', sprite: 'enemy/wraith_c', element: 'cosmico',
    radius: 26, scale: 0.68, hp: 3.4, dano: 1.4, reward: 2.2,
    speed: 58, move: 'pairar', attack: 'leque', fireRate: 0.42, shots: 5,
    bulletSprite: 'shot/void_heavy', bulletSpeed: 200, sectors: [6, 0], weight: 55,
  },
  {
    ...base,
    id: 'ferrao', name: 'Ferrão', sprite: 'sr/enemy/enemy_2_r_m', element: 'fogo',
    bank: ['sr/enemy/enemy_2_r_l2', 'sr/enemy/enemy_2_r_l1', 'sr/enemy/enemy_2_r_m', 'sr/enemy/enemy_2_r_r1', 'sr/enemy/enemy_2_r_r2'],
    radius: 16, scale: 0.72, hp: 0.8, dano: 1.3, reward: 1.2,
    speed: 240, move: 'investida', attack: 'direto', fireRate: 0.9, shots: 1,
    bulletSprite: 'shot/pyro_light', bulletSpeed: 300, bulletColor: '#ff9a4d',
    sectors: [8, 0], weight: 70,
  },
  {
    ...base,
    id: 'mina', name: 'Mina Flutuante', sprite: 'mina/a_0', clip: 'arc/mina_a', element: 'fogo',
    radius: 18, scale: 1.2, hp: 1.6, dano: 2.4, reward: 1.0,
    speed: 42, move: 'deriva', attack: 'explosivo', fireRate: 0, shots: 0,
    bulletColor: '#ff6a3d', sectors: [5, 0], weight: 45, blast: 'arc/mina_a_boom',
  },
  {
    ...base,
    id: 'asteroide', name: 'Asteroide', sprite: 'rock/g_0', element: 'padrao',
    radius: 24, scale: 1.1, hp: 2.2, dano: 1.8, reward: 0.6,
    speed: 90, move: 'deriva', attack: 'nenhum', fireRate: 0, shots: 0,
    bulletColor: '#c9b28f', sectors: [1, 0], weight: 60, blast: 'arc/boom_fogo',
  },
  {
    ...base,
    id: 'cometa', name: 'Cometa', sprite: 'hazard/comet_fire', element: 'fogo',
    radius: 26, scale: 0.6, hp: 1.4, dano: 2.6, reward: 1.4,
    speed: 300, move: 'mergulho', attack: 'nenhum', fireRate: 0, shots: 0,
    bulletColor: '#ff9a4d', sectors: [10, 0], weight: 30, blast: 'blast/fire',
  },
  {
    ...base,
    id: 'serafim', name: 'Serafim', sprite: 'enemy/verdant_c', element: 'quimico',
    radius: 28, scale: 0.7, hp: 5.5, dano: 1.6, reward: 4.0,
    speed: 72, move: 'orbita', attack: 'teleguiado', fireRate: 0.5, shots: 2,
    bulletSprite: 'shot/bio_orb', bulletSpeed: 170, bulletColor: '#8dff5c',
    sectors: [14, 0], weight: 22, elite: true, blast: 'blast/void',
  },
  {
    ...base,
    id: 'espectro', name: 'Espectro', sprite: 'enemy/wraith_b', element: 'cosmico',
    radius: 26, scale: 0.68, hp: 4.6, dano: 1.5, reward: 3.6,
    speed: 130, move: 'investida', attack: 'espiral', fireRate: 1.1, shots: 4,
    bulletSprite: 'shot/void_orb', bulletSpeed: 190, sectors: [18, 0], weight: 20,
    elite: true, blast: 'blast/void',
  },
  {
    ...base,
    id: 'sentinela', name: 'Sentinela', sprite: 'prop/mine_spike', element: 'raio',
    radius: 30, scale: 0.72, hp: 8.0, dano: 2.0, reward: 6.0,
    speed: 34, move: 'pairar', attack: 'espiral', fireRate: 1.6, shots: 6,
    bulletSprite: 'shot/void_light', bulletSpeed: 165, sectors: [25, 0], weight: 14,
    elite: true, blast: 'blast/void',
  },
];

// ── Corsários elementais ────────────────────────────────────────────────────

/**
 * Uma nave hostil por elemento, da folha `sprites.png`.
 *
 * As frotas Void cobrem só três elementos (fogo, cósmico, químico) porque a
 * paleta delas é essa. Sem estes seis, gelo e raio existiriam no papel e nunca
 * na tela — e resistência a gelo seria um atributo que o jogador nunca teria
 * motivo de equipar. Aqui cada elemento tem cara, tiro e comportamento próprios.
 */
interface CorsarioSpec {
  id: string;
  name: string;
  sprite: string;
  element: ElementId;
  hp: number;
  dano: number;
  reward: number;
  speed: number;
  move: MovePattern;
  attack: AttackPattern;
  fireRate: number;
  shots: number;
  radius: number;
  scale: number;
  from: number;
  weight: number;
  elite?: boolean;
}

const CORSARIOS: readonly CorsarioSpec[] = [
  {
    id: 'corsario_raio', name: 'Corsário Arco', sprite: 'hostil/frio_0',
    element: 'raio', hp: 0.8, dano: 0.9, reward: 1.1, speed: 150,
    move: 'senoide', attack: 'direto', fireRate: 1.3, shots: 2, radius: 20, scale: 0.4, from: 4, weight: 85,
  },
  {
    id: 'corsario_fogo', name: 'Corsário Brasa', sprite: 'hostil/frio_1',
    element: 'fogo', hp: 1.2, dano: 1.5, reward: 1.3, speed: 108,
    move: 'mergulho', attack: 'mirado', fireRate: 0.7, shots: 1, radius: 21, scale: 0.4, from: 6, weight: 75,
  },
  {
    id: 'corsario_gelo', name: 'Portador Glacial', sprite: 'hostil/frio_2',
    element: 'gelo', hp: 3.2, dano: 1.1, reward: 2.3, speed: 62,
    move: 'pairar', attack: 'leque', fireRate: 0.4, shots: 5, radius: 30, scale: 0.42, from: 9, weight: 48,
  },
  {
    id: 'corsario_padrao', name: 'Corsário Áureo', sprite: 'hostil/quente_0',
    element: 'padrao', hp: 1.6, dano: 1.2, reward: 1.6, speed: 96,
    move: 'pairar', attack: 'direto', fireRate: 1.0, shots: 3, radius: 22, scale: 0.4, from: 11, weight: 60,
  },
  {
    id: 'corsario_lamina', name: 'Lâmina Rubra', sprite: 'hostil/quente_1',
    element: 'fogo', hp: 1.4, dano: 2.0, reward: 1.9, speed: 215,
    move: 'investida', attack: 'direto', fireRate: 0.9, shots: 1, radius: 22, scale: 0.4, from: 14, weight: 52,
  },
  {
    id: 'bastiao_raio', name: 'Bastião de Arco', sprite: 'hostil/quente_2',
    element: 'raio', hp: 8.5, dano: 1.8, reward: 5.5, speed: 44,
    move: 'pairar', attack: 'espiral', fireRate: 1.4, shots: 6, radius: 34, scale: 0.45, from: 20, weight: 18, elite: true,
  },
];

const CORSARIO_ENEMIES: readonly EnemyDef[] = CORSARIOS.map((c) => {
  const info = getElement(c.element);
  return {
    id: c.id,
    name: c.name,
    sprite: c.sprite,
    element: c.element,
    radius: c.radius,
    scale: c.scale,
    hp: c.hp,
    dano: c.dano,
    reward: c.reward,
    speed: c.speed,
    move: c.move,
    attack: c.attack,
    fireRate: c.fireRate,
    shots: c.shots,
    // O projétil sai da tabela de elementos: é a cor do tiro que ensina o anel
    // de vantagens ao jogador, e ela não pode divergir do dano que ele causa.
    bulletSprite: info.bullet[c.elite ? 0 : 1],
    bulletSpeed: 240,
    bulletColor: info.color,
    sectors: [c.from, 0] as const,
    weight: c.weight,
    blast: info.blast,
    ...(c.elite ? { elite: true } : {}),
  };
});

/**
 * Bestiário completo: os arquétipos originais (rochas, minas, enxames), as três
 * frotas do pack Void e os corsários elementais. Os originais continuam porque
 * cobrem perigos que as frotas não têm — obstáculos inertes e minas.
 */
export const ALL_ENEMIES: readonly EnemyDef[] = [...ENEMIES, ...VOID_ENEMIES, ...CORSARIO_ENEMIES];

export const ENEMY_BY_ID = new Map(ALL_ENEMIES.map((e) => [e.id, e]));

/** Inimigos elegíveis para um setor, já filtrados por faixa. */
export function enemiesForSector(sector: number, elite: boolean): EnemyDef[] {
  return ALL_ENEMIES.filter(
    (e) => !!e.elite === elite && sector >= e.sectors[0] && (e.sectors[1] === 0 || sector <= e.sectors[1]),
  );
}
