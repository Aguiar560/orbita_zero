import type { ElementId } from '@sim/types';
import type { AttackPattern } from './enemies';

export interface BossPhase {
  /** Fração de vida em que a fase começa (1 = início). */
  at: number;
  attack: AttackPattern;
  /** Salvas por segundo. */
  fireRate: number;
  shots: number;
  bulletSpeed: number;
  /** Velocidade de estrafe horizontal. */
  strafe: number;
  /** Invoca lacaios deste tipo, se definido. */
  summon?: { enemy: string; every: number; count: number };
  /** Aviso mostrado na entrada da fase. */
  telegraph?: string;
}

export interface BossDef {
  id: string;
  name: string;
  /** Tipo de dano que causa e contra o qual resiste. */
  element: ElementId;
  title: string;
  sprite: string;
  scale: number;
  radius: number;
  /** Multiplicador de vida sobre a curva do setor. */
  hp: number;
  dano: number;
  reward: number;
  bulletSprite: string;
  bulletColor: string;
  blast: string;
  phases: readonly BossPhase[];
  /** Baús garantidos na primeira derrota. */
  firstKill: { tier: string; count: number }[];
}

export const BOSSES: readonly BossDef[] = [
  {
    id: 'nucleo_ferrugem', element: 'fogo',
    name: 'Núcleo Ferrugem',
    title: 'Reator abandonado que nunca parou de bombear',
    sprite: 'prop/reactor_tower',
    scale: 1.35, radius: 58, hp: 26, dano: 1.6, reward: 30,
    bulletSprite: 'shot/pyro_light', bulletColor: '#ff9a4d', blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'direto', fireRate: 1.2, shots: 3, bulletSpeed: 210, strafe: 40 },
      { at: 0.6, attack: 'leque', fireRate: 1.0, shots: 7, bulletSpeed: 230, strafe: 70, telegraph: 'Sobrecarga do núcleo' },
      { at: 0.25, attack: 'espiral', fireRate: 2.4, shots: 5, bulletSpeed: 250, strafe: 95, summon: { enemy: 'enxame', every: 4, count: 3 }, telegraph: 'Fusão descontrolada' },
    ],
    firstKill: [{ tier: 'prata', count: 1 }],
  },
  {
    id: 'anel_kessler', element: 'cosmico',
    name: 'Anel de Kessler',
    title: 'Estação em cascata de colisões há mil anos',
    sprite: 'prop/ring_station',
    scale: 1.4, radius: 62, hp: 34, dano: 1.5, reward: 36,
    bulletSprite: 'shot/void_light', bulletColor: '#c07dff', blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'espiral', fireRate: 1.6, shots: 4, bulletSpeed: 190, strafe: 55 },
      { at: 0.55, attack: 'espiral', fireRate: 2.6, shots: 6, bulletSpeed: 205, strafe: 85, summon: { enemy: 'asteroide', every: 3.5, count: 2 }, telegraph: 'Cascata de destroços' },
      { at: 0.2, attack: 'leque', fireRate: 1.4, shots: 11, bulletSpeed: 235, strafe: 110, telegraph: 'Colapso orbital' },
    ],
    firstKill: [{ tier: 'prata', count: 2 }],
  },
  {
    id: 'tita_rochoso', element: 'padrao',
    name: 'Titã Rochoso',
    title: 'Um asteroide que acordou com fome',
    sprite: 'prop/spike_rock',
    scale: 1.5, radius: 66, hp: 48, dano: 1.9, reward: 44,
    bulletSprite: 'shot/pyro_heavy', bulletColor: '#ffb056', blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 0.9, shots: 2, bulletSpeed: 240, strafe: 35 },
      { at: 0.65, attack: 'leque', fireRate: 0.8, shots: 9, bulletSpeed: 215, strafe: 60, summon: { enemy: 'asteroide', every: 3, count: 3 }, telegraph: 'Chuva de fragmentos' },
      { at: 0.3, attack: 'espiral', fireRate: 3.0, shots: 4, bulletSpeed: 260, strafe: 90, telegraph: 'Fúria mineral' },
    ],
    firstKill: [{ tier: 'ouro', count: 1 }],
  },
  {
    id: 'sentinela_vazia', element: 'raio',
    name: 'Sentinela Vazia',
    title: 'Guardiã sem tripulação, sem ordens e sem trégua',
    sprite: 'enemy/wraith_c',
    scale: 1.6, radius: 56, hp: 62, dano: 2.0, reward: 54,
    bulletSprite: 'shot/void_heavy', bulletColor: '#c07dff', blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 1.6, shots: 3, bulletSpeed: 265, strafe: 90 },
      { at: 0.6, attack: 'teleguiado', fireRate: 0.9, shots: 3, bulletSpeed: 190, strafe: 120, telegraph: 'Travamento de alvo' },
      { at: 0.25, attack: 'espiral', fireRate: 3.4, shots: 7, bulletSpeed: 245, strafe: 150, summon: { enemy: 'ferrao', every: 5, count: 2 }, telegraph: 'Protocolo terminal' },
    ],
    firstKill: [{ tier: 'ouro', count: 1 }],
  },
  {
    id: 'colmeia_verdante', element: 'quimico',
    name: 'Colmeia Verdante',
    title: 'Não é uma nave. É um ninho.',
    sprite: 'enemy/verdant_c',
    scale: 1.7, radius: 60, hp: 78, dano: 1.8, reward: 66,
    bulletSprite: 'shot/bio_orb', bulletColor: '#8dff5c', blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'leque', fireRate: 1.0, shots: 6, bulletSpeed: 195, strafe: 70, summon: { enemy: 'enxame', every: 3, count: 4 } },
      { at: 0.6, attack: 'teleguiado', fireRate: 1.2, shots: 4, bulletSpeed: 175, strafe: 100, summon: { enemy: 'enxame', every: 2.2, count: 5 }, telegraph: 'Eclosão' },
      { at: 0.25, attack: 'espiral', fireRate: 3.2, shots: 9, bulletSpeed: 215, strafe: 130, telegraph: 'Frenesi da colmeia' },
    ],
    firstKill: [{ tier: 'ouro', count: 2 }],
  },
  {
    id: 'destroco_vivo', element: 'gelo',
    name: 'Destroço Vivo',
    title: 'Uma frota inteira fundida num só casco',
    sprite: 'prop/wreck_beam',
    scale: 1.3, radius: 78, hp: 96, dano: 2.2, reward: 80,
    bulletSprite: 'shot/void_light', bulletColor: '#c07dff', blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'direto', fireRate: 2.2, shots: 5, bulletSpeed: 225, strafe: 130 },
      { at: 0.55, attack: 'leque', fireRate: 1.3, shots: 13, bulletSpeed: 200, strafe: 160, telegraph: 'Descarga em cortina' },
      { at: 0.2, attack: 'espiral', fireRate: 4.0, shots: 6, bulletSpeed: 250, strafe: 190, summon: { enemy: 'mina', every: 3, count: 3 }, telegraph: 'Desmonte total' },
    ],
    firstKill: [{ tier: 'ouro', count: 2 }, { tier: 'singularidade', count: 1 }],
  },
  {
    id: 'mina_prima', element: 'fogo',
    name: 'Mina Prima',
    title: 'A primeira que colocaram aqui. Ainda armada.',
    sprite: 'prop/mine_spike',
    scale: 1.8, radius: 62, hp: 120, dano: 2.6, reward: 96,
    bulletSprite: 'shot/pyro_light', bulletColor: '#ff7a3d', blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'espiral', fireRate: 2.6, shots: 8, bulletSpeed: 185, strafe: 45 },
      { at: 0.6, attack: 'espiral', fireRate: 3.4, shots: 12, bulletSpeed: 205, strafe: 70, summon: { enemy: 'mina', every: 3, count: 2 }, telegraph: 'Campo minado' },
      { at: 0.25, attack: 'leque', fireRate: 2.0, shots: 17, bulletSpeed: 240, strafe: 100, telegraph: 'Detonação iminente' },
    ],
    firstKill: [{ tier: 'singularidade', count: 1 }],
  },
  {
    id: 'obelisco', element: 'cosmico',
    name: 'Obelisco Partido',
    title: 'Um marco de fronteira de uma civilização que já era',
    sprite: 'prop/pillar_broken',
    scale: 1.5, radius: 58, hp: 150, dano: 2.4, reward: 118,
    bulletSprite: 'beam/void', bulletColor: '#c07dff', blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 2.4, shots: 3, bulletSpeed: 300, strafe: 100 },
      { at: 0.6, attack: 'espiral', fireRate: 3.0, shots: 10, bulletSpeed: 220, strafe: 140, telegraph: 'Ressonância' },
      { at: 0.25, attack: 'teleguiado', fireRate: 2.2, shots: 6, bulletSpeed: 210, strafe: 170, summon: { enemy: 'espectro', every: 6, count: 1 }, telegraph: 'Eco final' },
    ],
    firstKill: [{ tier: 'singularidade', count: 1 }],
  },
  {
    id: 'devorador', element: 'quimico',
    name: 'Cometa Devorador',
    title: 'Puxa tudo para dentro e nunca devolve',
    sprite: 'hazard/comet_ice',
    scale: 1.6, radius: 70, hp: 190, dano: 3.0, reward: 145,
    bulletSprite: 'shot/ion_light', bulletColor: '#66d9ff', blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'leque', fireRate: 1.6, shots: 9, bulletSpeed: 260, strafe: 175 },
      { at: 0.6, attack: 'espiral', fireRate: 4.2, shots: 8, bulletSpeed: 235, strafe: 210, telegraph: 'Maré gravitacional' },
      { at: 0.22, attack: 'espiral', fireRate: 5.5, shots: 13, bulletSpeed: 255, strafe: 240, summon: { enemy: 'cometa', every: 2.5, count: 2 }, telegraph: 'Horizonte de eventos' },
    ],
    firstKill: [{ tier: 'singularidade', count: 2 }],
  },
  {
    id: 'arquiteto', element: 'gelo',
    name: 'O Arquiteto',
    title: 'Desenhou este universo. Não gosta de visitas.',
    sprite: 'ship/ignis_d',
    scale: 1.9, radius: 64, hp: 260, dano: 3.4, reward: 200,
    bulletSprite: 'beam/chain', bulletColor: '#ffcf7a', blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 3.0, shots: 4, bulletSpeed: 320, strafe: 190 },
      { at: 0.7, attack: 'leque', fireRate: 2.0, shots: 15, bulletSpeed: 250, strafe: 220, summon: { enemy: 'serafim', every: 7, count: 1 }, telegraph: 'Reescrita parcial' },
      { at: 0.4, attack: 'espiral', fireRate: 5.0, shots: 11, bulletSpeed: 240, strafe: 250, telegraph: 'Geometria hostil' },
      { at: 0.15, attack: 'teleguiado', fireRate: 3.2, shots: 8, bulletSpeed: 230, strafe: 280, summon: { enemy: 'espectro', every: 5, count: 2 }, telegraph: 'Colapso autoral' },
    ],
    firstKill: [{ tier: 'singularidade', count: 3 }],
  },
];

export const BOSS_BY_ID = new Map(BOSSES.map((b) => [b.id, b]));

/** Chefes aparecem a cada 10 setores e ciclam a lista, ficando mais fortes. */
export const BOSS_INTERVAL = 10;

export function bossForSector(sector: number): BossDef {
  const idx = Math.max(0, Math.floor(sector / BOSS_INTERVAL) - 1);
  return BOSSES[idx % BOSSES.length]!;
}

export const isBossSector = (sector: number): boolean => sector > 0 && sector % BOSS_INTERVAL === 0;
