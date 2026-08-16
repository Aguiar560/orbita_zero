/**
 * Mapa de recortes da folha `novos icones.png` (1024x1536).
 *
 * Os blocos de baú, moeda, galáxia e ícone geral são sprites soltos sobre
 * painéis escuros, então são detectados por componente (coluna vazia) dentro de
 * cada faixa — o mesmo mecanismo dos outros packs.
 *
 * Os BOTÕES DE MENU são o caso especial: cada um tem a moldura e o rótulo de
 * texto embutidos na arte. As abas do jogo já desenham a própria moldura e o
 * próprio texto, então recortamos só a área do ÍCONE, dentro da moldura e acima
 * do rótulo.
 */

export const ICONES_SHEET = 'novos icones.png';

// ── botões de menu ──────────────────────────────────────────────────────────

/** Canto superior esquerdo do primeiro botão. */
export const MENU_ORIGIN = { x: 22, y: 47 };
/** Passo entre botões. */
export const MENU_PITCH = { x: 119, y: 110 };
export const MENU_BUTTON = { w: 110, h: 93 };
/**
 * Recorte do ícone dentro do botão: afasta da moldura e para antes do rótulo.
 */
export const MENU_ICON_INSET = { x: 15, y: 7, w: 80, h: 56 };

/** Ordem de leitura da folha: 4 colunas × 2 linhas. */
export const MENU_ICONS = [
  'galaxia', 'inventario', 'matriz', 'melhorias',
  'hangar', 'baus', 'loja', 'codex',
];

// ── faixas detectadas por componente ────────────────────────────────────────

/**
 * `y0/y1` delimitam a faixa; `name` vira o prefixo dos ids `<name>_<n>`.
 * `gap` maior junta partes de um mesmo sprite (o brilho dos baús, por exemplo).
 */
export const ICON_BANDS = [
  // Moedas e recursos — a primeira é a moeda dourada da sucata.
  { y0: 46, y1: 100, name: 'moeda', gap: 6 },

  // Ícones gerais: três fileiras. A engrenagem está na segunda.
  { y0: 205, y1: 246, name: 'geral/a', gap: 5 },
  { y0: 256, y1: 297, name: 'geral/b', gap: 5 },
  { y0: 306, y1: 345, name: 'geral/c', gap: 5 },

  // Baús: três fileiras de seis.
  { y0: 396, y1: 462, name: 'bau/a', gap: 8 },
  { y0: 476, y1: 540, name: 'bau/b', gap: 8 },
  { y0: 552, y1: 620, name: 'bau/c', gap: 8 },

  // Galáxias do mapa estelar: duas fileiras. O halo delas se dissolve no fundo,
  // então o piso de alfa é alto — senão o brilho de uma encosta na vizinha e as
  // duas viram um sprite só.
  { y0: 676, y1: 748, name: 'galaxia/a', gap: 4, alphaFloor: 46 },
  { y0: 754, y1: 820, name: 'galaxia/b', gap: 4, alphaFloor: 46 },
];

/** Limites horizontais do painel direito, onde ficam as faixas acima. */
export const RIGHT_PANEL = { x0: 536, x1: 1014 };

/** Cor de fundo dos painéis, amostrada — é quase preto, não o cinza-azulado. */
export const ICONES_MATTE = { r: 1, g: 4, b: 11 };
