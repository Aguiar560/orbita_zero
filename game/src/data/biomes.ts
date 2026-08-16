import type { LayerConfig } from '@render/Parallax';

export interface Biome {
  id: string;
  name: string;
  /** Pasta do bioma dentro de `assets/parallax/`. */
  folder: string;
  /** Cor do céu por trás das camadas — evita flash branco enquanto carrega. */
  sky: string;
  /** Tonalidade sobreposta na faixa, para dar identidade sem repintar arte. */
  wash: string;
  /** Camadas do fundo para o trás. */
  layers: LayerConfig[];
  /** Distância percorrida necessária para desbloquear. */
  unlockAt: number;
  /** Multiplicador de recompensa da patrulha. */
  bounty: number;
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'luar',
    name: 'Mar da Tranquilidade',
    folder: 'moon',
    sky: '#05060f',
    wash: 'rgba(90,120,190,.10)',
    unlockAt: 0,
    bounty: 1,
    layers: [
      { key: 'moon_sky', speed: 0.0 },
      { key: 'moon_earth', speed: 0.015, repeat: false, align: 0.15 },
      { key: 'moon_back', speed: 0.06 },
      { key: 'moon_mid', speed: 0.16 },
      { key: 'moon_front', speed: 0.34 },
      { key: 'moon_floor', speed: 0.7 },
    ],
  },
  {
    id: 'dunas',
    name: 'Cinturão de Dunas',
    folder: 'desert',
    sky: '#1a1020',
    wash: 'rgba(210,140,70,.12)',
    unlockAt: 6000,
    bounty: 1.45,
    layers: [
      { key: 'desert_sky', speed: 0.0 },
      { key: 'desert_moon', speed: 0.015, repeat: false, align: 0.1 },
      { key: 'desert_cloud', speed: 0.05, alpha: 0.85 },
      { key: 'desert_mountain', speed: 0.14 },
      { key: 'desert_dunemid', speed: 0.3 },
      { key: 'desert_dunefrontt', speed: 0.62 },
    ],
  },
  {
    id: 'mata',
    name: 'Bioma Verdejante',
    folder: 'forest',
    sky: '#050d12',
    wash: 'rgba(70,190,140,.10)',
    unlockAt: 22000,
    bounty: 2.1,
    layers: [
      { key: 'forest_sky', speed: 0.0 },
      { key: 'forest_moon', speed: 0.015, repeat: false, align: 0.1 },
      { key: 'forest_back', speed: 0.07 },
      { key: 'forest_mountain', speed: 0.13 },
      { key: 'forest_mid', speed: 0.26 },
      { key: 'forest_long', speed: 0.44 },
      { key: 'forest_short', speed: 0.72 },
    ],
  },
  {
    id: 'estratos',
    name: 'Alta Estratosfera',
    folder: 'skies',
    sky: '#070c1c',
    wash: 'rgba(140,170,255,.10)',
    unlockAt: 60000,
    bounty: 3.0,
    layers: [
      { key: 'sky_sky', speed: 0.0 },
      { key: 'sky_moon', speed: 0.015, repeat: false, align: 0.1 },
      { key: 'sky_back_mountain', speed: 0.08 },
      { key: 'sky_clouds', speed: 0.15, alpha: 0.9 },
      { key: 'sky_front_mountain', speed: 0.28 },
      { key: 'sky_cloud_floor', speed: 0.45, alpha: 0.95 },
      { key: 'sky_front_cloud', speed: 0.8, alpha: 0.85 },
    ],
  },
];

export const BIOME_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));

export const getBiome = (id: string): Biome => BIOME_BY_ID.get(id) ?? BIOMES[0]!;

/** Biomas já desbloqueados pela distância total de patrulha. */
export function unlockedBiomes(distance: number): Biome[] {
  return BIOMES.filter((b) => distance >= b.unlockAt);
}
