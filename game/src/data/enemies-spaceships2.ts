import { getElement } from './elements';
import { SPACESHIPS2_ENEMY_ART } from './spaceships2';
import type { AttackPattern, EnemyDef, MovePattern } from './enemies';
import type { ElementId } from '@sim/types';

interface EnemyIdentity {
  id: string;
  name: string;
  element: ElementId;
  /** Galáxia de origem/assinatura, não uma trava de aparição. */
  galaxy: number;
  faction: string;
  elite?: boolean;
}

/**
 * Identidade autoral das 26 artes inimigas do pack Spaceships 2.0.
 *
 * O id fala sobre a criatura, nunca sobre `download (42).png`. Assim uma arte
 * pode ser substituída no futuro sem quebrar save, Códex, drop ou missão.
 */
const IDENTITIES: readonly EnemyIdentity[] = [
  { id: 'vigia_rhodes', name: 'Vigia de Rhodes', element: 'quimico', galaxy: 5, faction: 'vigias' },
  { id: 'carrasco_coroa', name: 'Carrasco da Coroa', element: 'quimico', galaxy: 6, faction: 'coroa' },
  { id: 'sombra_liturgica', name: 'Sombra Litúrgica', element: 'padrao', galaxy: 7, faction: 'liturgia' },
  { id: 'monolito_silencio', name: 'Monolito do Silêncio', element: 'fogo', galaxy: 8, faction: 'monolitos', elite: true },
  { id: 'vespa_ambar', name: 'Vespa de Âmbar', element: 'raio', galaxy: 9, faction: 'vespas' },
  { id: 'escriba_terminal', name: 'Escriba Terminal', element: 'quimico', galaxy: 10, faction: 'escribas' },
  { id: 'quebragelo_forja', name: 'Quebragelo da Forja', element: 'cosmico', galaxy: 11, faction: 'forja_fria' },
  { id: 'cultivador_oxido', name: 'Cultivador de Óxido', element: 'gelo', galaxy: 12, faction: 'jardineiros', elite: true },
  { id: 'arraia_tetis', name: 'Arraia de Tétis', element: 'padrao', galaxy: 13, faction: 'tetis' },
  { id: 'engolidor_azul', name: 'Engolidor Azul', element: 'fogo', galaxy: 14, faction: 'garganta' },
  { id: 'agulha_vazio', name: 'Agulha do Vazio', element: 'raio', galaxy: 15, faction: 'espinha' },
  { id: 'arauto_nona', name: 'Arauto da Nona', element: 'quimico', galaxy: 16, faction: 'aurora_nove', elite: true },
  { id: 'refeito_lazaro', name: 'Refeito de Lázaro', element: 'cosmico', galaxy: 17, faction: 'lazaro' },
  { id: 'custodio_oco', name: 'Custódio Oco', element: 'gelo', galaxy: 18, faction: 'trono_oco' },
  { id: 'corsario_argenteo', name: 'Corsário Argênteo', element: 'padrao', galaxy: 19, faction: 'mare_prata' },
  { id: 'executor_linha', name: 'Executor da Linha', element: 'fogo', galaxy: 20, faction: 'terminal', elite: true },
  { id: 'caldeireiro_asterion', name: 'Caldeireiro Asterion', element: 'fogo', galaxy: 21, faction: 'asterion' },
  { id: 'embalsamador_khepri', name: 'Embalsamador Khepri', element: 'padrao', galaxy: 22, faction: 'khepri' },
  { id: 'fiandeiro_nyx', name: 'Fiandeiro de Nyx', element: 'quimico', galaxy: 23, faction: 'nyx' },
  { id: 'laminador_carbono', name: 'Laminador de Carbono', element: 'raio', galaxy: 24, faction: 'carbono', elite: true },
  { id: 'duplicata_eos', name: 'Duplicata de Eos', element: 'cosmico', galaxy: 25, faction: 'eos' },
  { id: 'operario_icaro', name: 'Operário de Ícaro', element: 'quimico', galaxy: 26, faction: 'icaro' },
  { id: 'temperador_antares', name: 'Temperador de Antares', element: 'fogo', galaxy: 27, faction: 'antares' },
  { id: 'paladino_caelum', name: 'Paladino de Caelum', element: 'cosmico', galaxy: 28, faction: 'caelum', elite: true },
  { id: 'dobrador_janus', name: 'Dobrador de Janus', element: 'cosmico', galaxy: 29, faction: 'janus' },
  { id: 'eclipse_umbra', name: 'Eclipse Umbra', element: 'cosmico', galaxy: 30, faction: 'umbra' },
];

interface CombatProfile {
  hp: number;
  dano: number;
  reward: number;
  speed: number;
  move: MovePattern;
  attack: AttackPattern;
  fireRate: number;
  shots: number;
  bulletSpeed: number;
  radius: number;
  weight: number;
}

/** Seis papéis legíveis: batedor, atacante, artilharia, caçador, supressor e orbital. */
const PROFILES: readonly CombatProfile[] = [
  { hp: 0.62, dano: 0.82, reward: 0.8, speed: 190, move: 'senoide', attack: 'direto', fireRate: 1.25, shots: 1, bulletSpeed: 300, radius: 17, weight: 105 },
  { hp: 1.05, dano: 1.22, reward: 1.15, speed: 142, move: 'mergulho', attack: 'mirado', fireRate: 0.8, shots: 1, bulletSpeed: 285, radius: 20, weight: 88 },
  { hp: 1.72, dano: 1.55, reward: 1.65, speed: 72, move: 'pairar', attack: 'leque', fireRate: 0.48, shots: 5, bulletSpeed: 225, radius: 25, weight: 58 },
  { hp: 1.28, dano: 1.82, reward: 1.7, speed: 205, move: 'investida', attack: 'teleguiado', fireRate: 0.58, shots: 2, bulletSpeed: 245, radius: 22, weight: 52 },
  { hp: 2.45, dano: 1.32, reward: 2.05, speed: 62, move: 'pairar', attack: 'espiral', fireRate: 1.2, shots: 4, bulletSpeed: 205, radius: 28, weight: 42 },
  { hp: 1.88, dano: 1.08, reward: 1.8, speed: 98, move: 'orbita', attack: 'leque', fireRate: 0.72, shots: 3, bulletSpeed: 250, radius: 24, weight: 48 },
];

export const SPACESHIPS2_ENEMIES: readonly EnemyDef[] = IDENTITIES.map((identity, index) => {
  const profile = PROFILES[index % PROFILES.length]!;
  const art = SPACESHIPS2_ENEMY_ART[index]!;
  const element = getElement(identity.element);
  const elite = !!identity.elite;
  return {
    id: identity.id,
    name: identity.name,
    sprite: art.sprite,
    tags: ['spaceships_2', `faccao_${identity.faction}`, `origem_galaxia_${identity.galaxy}`],
    element: identity.element,
    radius: elite ? Math.max(34, profile.radius + 9) : profile.radius,
    scale: elite ? art.scale * 1.32 : art.scale,
    hp: elite ? 6.2 + (index % 4) * 0.85 : profile.hp,
    dano: elite ? 1.75 + (index % 3) * 0.24 : profile.dano,
    reward: elite ? 5.4 + (index % 4) * 0.65 : profile.reward,
    speed: elite ? profile.speed * 0.82 : profile.speed,
    move: profile.move,
    attack: profile.attack,
    fireRate: elite ? profile.fireRate * 1.18 : profile.fireRate,
    shots: elite ? profile.shots + 2 : profile.shots,
    bulletSprite: element.bullet[elite ? 0 : 1],
    bulletSpeed: profile.bulletSpeed,
    // O elenco por galáxia é quem decide aparição; a faixa ampla permite que
    // a composição faça rodízio sem criar buracos em fases iniciais.
    sectors: [1, 0],
    weight: elite ? 18 : profile.weight,
    blast: element.blast,
    ...(elite ? { elite: true } : {}),
  };
});

export const SPACESHIPS2_REGULAR_ENEMIES = SPACESHIPS2_ENEMIES.filter((enemy) => !enemy.elite);
export const SPACESHIPS2_ELITE_ENEMIES = SPACESHIPS2_ENEMIES.filter((enemy) => !!enemy.elite);
