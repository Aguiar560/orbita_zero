/**
 * Mapa de recortes da folha `Jogando/Espaço.png` (1024x1536).
 *
 * As caixas abaixo são deliberadamente FOLGADAS: o pipeline (`build-assets.mjs`)
 * remove a matte (fundo azul-escuro sólido da folha) e faz auto-trim no conteúdo
 * real, então basta que a caixa contenha o sprite e não invada o vizinho.
 *
 * `mode`:
 *   'solid' → sprite opaco (naves, rochas, ícones). Alpha quase binário.
 *   'glow'  → sprite emissivo (tiros, explosões, rastros). Alpha proporcional ao brilho.
 */

/** @typedef {{ id: string, x: number, y: number, w: number, h: number, mode?: 'solid'|'glow', trim?: boolean }} Slice */

/** @type {Slice[]} */
export const ESPACO_SLICES = [
  // ── Jogador · Nave 1 (azul) — 4 variantes de casco ────────────────────────
  { id: 'ship/aurora_a', x: 18, y: 60, w: 100, h: 132 },
  { id: 'ship/aurora_b', x: 124, y: 60, w: 96, h: 132 },
  { id: 'ship/aurora_c', x: 224, y: 60, w: 96, h: 132 },
  { id: 'ship/aurora_d', x: 324, y: 60, w: 84, h: 132 },

  // ── Jogador · Nave 2 (vermelha) — 4 variantes de casco ────────────────────
  { id: 'ship/ignis_a', x: 18, y: 362, w: 100, h: 124 },
  { id: 'ship/ignis_b', x: 124, y: 362, w: 96, h: 124 },
  { id: 'ship/ignis_c', x: 224, y: 362, w: 94, h: 124 },
  { id: 'ship/ignis_d', x: 324, y: 362, w: 82, h: 124 },

  // ── Inimigo 1 (roxo) — 3 variantes ────────────────────────────────────────
  { id: 'enemy/wraith_a', x: 424, y: 96, w: 80, h: 104 },
  { id: 'enemy/wraith_b', x: 506, y: 96, w: 84, h: 106 },
  { id: 'enemy/wraith_c', x: 594, y: 96, w: 92, h: 106 },

  // ── Inimigo 2 (verde) — 3 variantes ───────────────────────────────────────
  { id: 'enemy/verdant_a', x: 422, y: 366, w: 80, h: 106 },
  { id: 'enemy/verdant_b', x: 504, y: 366, w: 88, h: 106 },
  { id: 'enemy/verdant_c', x: 594, y: 366, w: 92, h: 116 },

  // ── Tiros do jogador · azul ───────────────────────────────────────────────
  { id: 'shot/ion_heavy', x: 30, y: 214, w: 30, h: 78, mode: 'glow' },
  { id: 'shot/ion_light', x: 204, y: 212, w: 20, h: 54, mode: 'glow' },
  { id: 'shot/ion_spark', x: 204, y: 264, w: 20, h: 28, mode: 'glow' },

  // ── Tiros do jogador · laranja ────────────────────────────────────────────
  { id: 'shot/pyro_heavy', x: 28, y: 506, w: 34, h: 74, mode: 'glow' },
  { id: 'shot/pyro_light', x: 204, y: 504, w: 20, h: 40, mode: 'glow' },
  { id: 'shot/pyro_spark', x: 204, y: 552, w: 20, h: 34, mode: 'glow' },

  // ── Tiros inimigos · roxo ─────────────────────────────────────────────────
  { id: 'shot/void_heavy', x: 436, y: 218, w: 26, h: 80, mode: 'glow' },
  { id: 'shot/void_light', x: 518, y: 216, w: 24, h: 46, mode: 'glow' },
  { id: 'shot/void_orb', x: 630, y: 218, w: 44, h: 30, mode: 'glow' },

  // ── Tiros inimigos · verde ────────────────────────────────────────────────
  { id: 'shot/bio_heavy', x: 436, y: 504, w: 26, h: 80, mode: 'glow' },
  { id: 'shot/bio_light', x: 536, y: 502, w: 24, h: 44, mode: 'glow' },
  { id: 'shot/bio_orb', x: 632, y: 546, w: 46, h: 38, mode: 'glow' },

  // ── Cometas ───────────────────────────────────────────────────────────────
  { id: 'hazard/comet_fire', x: 22, y: 672, w: 100, h: 102 },
  { id: 'hazard/comet_rock', x: 116, y: 672, w: 104, h: 104 },
  { id: 'hazard/comet_ice', x: 220, y: 660, w: 96, h: 118 },

  // ── Asteroides ────────────────────────────────────────────────────────────
  { id: 'hazard/asteroid_lg', x: 24, y: 788, w: 88, h: 84 },
  { id: 'hazard/asteroid_md', x: 128, y: 800, w: 70, h: 70 },
  { id: 'hazard/asteroid_sm', x: 210, y: 800, w: 70, h: 66 },
  { id: 'hazard/debris_a', x: 24, y: 888, w: 76, h: 70 },
  { id: 'hazard/debris_b', x: 110, y: 888, w: 68, h: 70 },
  { id: 'hazard/debris_c', x: 184, y: 890, w: 62, h: 68 },
  { id: 'hazard/debris_d', x: 252, y: 890, w: 66, h: 64 },

  // ── Obstáculos / estruturas ───────────────────────────────────────────────
  { id: 'prop/pillar_broken', x: 350, y: 666, w: 84, h: 144 },
  { id: 'prop/ring_station', x: 460, y: 674, w: 92, h: 134 },
  { id: 'prop/spike_rock', x: 570, y: 674, w: 120, h: 126 },
  { id: 'prop/reactor_tower', x: 350, y: 820, w: 84, h: 144 },
  { id: 'prop/wreck_beam', x: 452, y: 842, w: 148, h: 120 },
  { id: 'prop/mine_spike', x: 600, y: 818, w: 84, h: 84 },

  // ── Explosão · fogo (5 quadros) ───────────────────────────────────────────
  { id: 'fx/blast_fire_0', x: 16, y: 1046, w: 48, h: 52, mode: 'glow' },
  { id: 'fx/blast_fire_1', x: 60, y: 1032, w: 72, h: 74, mode: 'glow' },
  { id: 'fx/blast_fire_2', x: 130, y: 1026, w: 92, h: 88, mode: 'glow' },
  { id: 'fx/blast_fire_3', x: 220, y: 1018, w: 104, h: 96, mode: 'glow' },
  { id: 'fx/blast_fire_4', x: 322, y: 1016, w: 118, h: 100, mode: 'glow' },

  // ── Explosão · vazio/EMP (5 quadros) ──────────────────────────────────────
  { id: 'fx/blast_void_0', x: 16, y: 1134, w: 46, h: 60, mode: 'glow' },
  { id: 'fx/blast_void_1', x: 58, y: 1126, w: 74, h: 76, mode: 'glow' },
  { id: 'fx/blast_void_2', x: 130, y: 1120, w: 90, h: 88, mode: 'glow' },
  { id: 'fx/blast_void_3', x: 220, y: 1118, w: 104, h: 94, mode: 'glow' },
  { id: 'fx/blast_void_4', x: 326, y: 1118, w: 104, h: 94, mode: 'glow' },

  // ── Power-ups · ícone em moldura ──────────────────────────────────────────
  { id: 'powerup/icon_rapid', x: 472, y: 1030, w: 50, h: 56 },
  { id: 'powerup/icon_shield', x: 526, y: 1030, w: 50, h: 56 },
  { id: 'powerup/icon_damage', x: 580, y: 1030, w: 52, h: 56 },
  { id: 'powerup/icon_bounty', x: 634, y: 1030, w: 52, h: 56 },

  // ── Power-ups · drop em queda (com rastro) ────────────────────────────────
  { id: 'powerup/drop_rapid', x: 470, y: 1088, w: 54, h: 114, mode: 'glow' },
  { id: 'powerup/drop_shield', x: 524, y: 1086, w: 54, h: 118, mode: 'glow' },
  { id: 'powerup/drop_damage', x: 578, y: 1088, w: 54, h: 114, mode: 'glow' },
  { id: 'powerup/drop_bounty', x: 634, y: 1090, w: 52, h: 114, mode: 'glow' },

  // ── Feixes / efeitos verticais ────────────────────────────────────────────
  { id: 'beam/ion', x: 32, y: 1282, w: 34, h: 132, mode: 'glow' },
  { id: 'beam/lance', x: 88, y: 1282, w: 32, h: 178, mode: 'glow' },
  { id: 'beam/pyro', x: 146, y: 1282, w: 36, h: 168, mode: 'glow' },
  { id: 'beam/void', x: 202, y: 1282, w: 36, h: 192, mode: 'glow' },
  { id: 'beam/bio', x: 266, y: 1282, w: 34, h: 190, mode: 'glow' },
  { id: 'beam/tesla', x: 328, y: 1280, w: 58, h: 196, mode: 'glow' },
  { id: 'beam/chain', x: 404, y: 1280, w: 40, h: 198, mode: 'glow' },

  // ── HUD / UI ──────────────────────────────────────────────────────────────
  { id: 'ui/portrait_frame', x: 498, y: 1294, w: 70, h: 80 },
  { id: 'ui/bar_frame', x: 566, y: 1308, w: 124, h: 44 },
  { id: 'ui/score_frame', x: 566, y: 1362, w: 124, h: 44 },
  { id: 'ui/icon_heart', x: 498, y: 1410, w: 48, h: 52 },
  { id: 'ui/icon_star', x: 545, y: 1410, w: 48, h: 52 },
  { id: 'ui/icon_coin', x: 591, y: 1410, w: 50, h: 52 },
  { id: 'ui/icon_pause', x: 638, y: 1410, w: 50, h: 52 },

  // ── Backdrop (coluna de nebulosa da direita) ──────────────────────────────
  // Sem remoção de matte: é um fundo, não um sprite.
  { id: 'bg/nebula_column', x: 713, y: 62, w: 295, h: 1433, mode: 'opaque', trim: false },
];

/** Cor sólida do fundo da folha (amostrada). */
export const ESPACO_MATTE = { r: 3, g: 7, b: 22 };
