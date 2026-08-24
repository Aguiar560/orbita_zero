/**
 * Catálogo das artes avulsas em `spaceships new/spaceships 2.0`.
 *
 * Estas entradas são VISUAIS: podem ser usadas livremente no Laboratório antes
 * de virarem um casco ou inimigo balanceado. Conteúdo de campanha continua com
 * ids autorais próprios; o nome do arquivo nunca vira id de gameplay.
 */
export type Spaceship2Role = 'player' | 'enemy' | 'boss';

export interface Spaceship2Art {
  id: string;
  name: string;
  sprite: string;
  role: Spaceship2Role;
  /** Escala adequada ao canvas vertical após normalização para 256 px. */
  scale: number;
  source: string;
}

const slug = (source: string): string => {
  const stem = source.replace(/\.png$/i, '');
  const parenthesized = /^\((\d+)\)$/.exec(stem);
  if (parenthesized) return `p_${parenthesized[1]}`;
  const download = /^download(?: \((\d+)\))?$/i.exec(stem);
  if (download) return download[1] ? `d_${download[1]}` : 'd_base';
  return `n_${stem.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
};

const catalog = (
  role: Spaceship2Role,
  sources: readonly string[],
  prefix: string,
  scale: number,
): readonly Spaceship2Art[] => sources.map((source, index) => {
  const code = String(index + 1).padStart(2, '0');
  const key = slug(source);
  return {
    id: `spaceships2_${role}_${key}`,
    name: `${prefix} ${code}`,
    sprite: `s2/${role}/${key}`,
    role,
    scale,
    source,
  };
});

const PLAYER_SOURCES = [
  '(11).png', '(22).png', '(24).png', '(62).png',
  '9.png', '11.png', '15.png', '21.png',
  'download (6).png', 'download (12).png', 'download (16).png',
  'download (17).png', 'download (19).png', 'download (23).png',
  'download (32).png', 'download (35).png', 'download (39).png',
  'download (49).png', 'download (50).png', 'download (52).png',
  'download (55).png', 'download (60).png', 'download (64).png',
] as const;

const ENEMY_SOURCES = [
  '3.png', '5.png', '44.png', '47.png',
  'download (5).png', 'download (14).png', 'download (15).png',
  'download (18).png', 'download (20).png', 'download (21).png',
  'download (22).png', 'download (25).png', 'download (26).png',
  'download (37).png', 'download (42).png', 'download (44).png',
  'download (45).png', 'download (47).png', 'download (51).png',
  'download (53).png', 'download (54).png', 'download (56).png',
  'download (62).png', 'download (63).png', 'download (71).png',
  'download (81).png',
] as const;

const BOSS_SOURCES = [
  '1.png', '2.png', '4.png', '6.png', '7.png', 'download.png',
  'download (1).png', 'download (2).png', 'download (3).png',
  'download (4).png', 'download (7).png', 'download (8).png',
  'download (9).png', 'download (10).png', 'download (11).png',
  'download (13).png', 'download (24).png', 'download (27).png',
  'download (28).png', 'download (29).png', 'download (30).png',
  'download (31).png', 'download (33).png', 'download (34).png',
  'download (36).png', 'download (38).png', 'download (40).png',
  'download (41).png', 'download (43).png', 'download (46).png',
  'download (48).png', 'download (57).png', 'download (58).png',
  'download (61).png', 'download (65).png', 'download (66).png',
  'download (67).png', 'download (68).png', 'download (69).png',
  'download (70).png', 'download (73).png', 'download (74).png',
  'download (75).png', 'download (76).png', 'download (77).png',
  'download (78).png', 'download (79).png', 'download (80).png',
  'download (82).png', 'download (83).png',
] as const;

export const SPACESHIPS2_PLAYER_ART = catalog('player', PLAYER_SOURCES, 'Caça J', 0.36);
export const SPACESHIPS2_ENEMY_ART = catalog('enemy', ENEMY_SOURCES, 'Hostil I', 0.34);
export const SPACESHIPS2_BOSS_ART = catalog('boss', BOSS_SOURCES, 'Comandante B', 0.64);

/** Seis artes que já estavam soltas antes da organização em três pastas. */
export const SPACESHIPS2_LEGACY_PLAYER_ART: readonly Spaceship2Art[] = [
  '(16).png', '(60).png', '10.png', '19.png', '23.png', '30.png',
].map((source, index) => {
  const key = `legacy_${slug(source)}`;
  return {
    id: `spaceships2_player_${key}`,
    name: `Caça legado ${String(index + 1).padStart(2, '0')}`,
    sprite: `s2/player/${key}`,
    role: 'player' as const,
    scale: 0.36,
    source,
  };
});

export const ALL_SPACESHIPS2_ART: readonly Spaceship2Art[] = [
  ...SPACESHIPS2_PLAYER_ART,
  ...SPACESHIPS2_LEGACY_PLAYER_ART,
  ...SPACESHIPS2_ENEMY_ART,
  ...SPACESHIPS2_BOSS_ART,
];
