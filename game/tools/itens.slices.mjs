/**
 * Mapa de recortes da folha `Jogando/Itens.png` (1024x1536).
 *
 * As colunas dos itens NÃO são uniformes — as molduras crescem com a raridade
 * (60px na comum, 88px na lendária). As bordas abaixo foram medidas por
 * detecção de coluna e valem para todas as 9 linhas de categoria.
 */

/** `[x0, x1]` das 8 molduras de item, iguais em todas as linhas. */
export const ITEM_COLUMNS = [
  [27, 87], [97, 173], [184, 257], [268, 345],
  [357, 436], [449, 530], [543, 624], [637, 725],
];

/** `[y0, y1]` da faixa de cada categoria, na ordem em que aparecem na folha. */
export const ITEM_ROWS = [
  { slot: 'asas', y: [139, 212] },
  { slot: 'principal', y: [276, 348] },
  { slot: 'secundaria', y: [412, 483] },
  { slot: 'motor', y: [546, 618] },
  { slot: 'reator', y: [681, 753] },
  { slot: 'controle', y: [812, 884] },
  { slot: 'escudo', y: [943, 1015] },
  { slot: 'blindagem', y: [1074, 1146] },
  { slot: 'suporte', y: [1208, 1280] },
];

/**
 * Recuo aplicado a cada célula antes do recorte.
 *
 * Descarta a moldura colorida e seu brilho: a raridade é desenhada pela
 * interface, então gravá-la no sprite travaria cada ícone a uma raridade só.
 */
export const ITEM_INSET = 9;

/** Placas de "UPGRADES GERAIS" — viram os nós da árvore de passivas. */
export const NODE_PLATES = [
  { id: 'exp', x: [26, 91] },
  { id: 'crit', x: [101, 177] },
  { id: 'vel', x: [188, 259] },
  { id: 'dano', x: [270, 338] },
  { id: 'escudo', x: [349, 420] },
  { id: 'energia', x: [432, 501] },
  { id: 'cooldown', x: [513, 583] },
  { id: 'peso', x: [595, 664] },
  { id: 'alcance', x: [674, 742] },
];

/** Só o glifo interno da placa, sem o rótulo de texto acima. */
export const NODE_PLATE_Y = [1352, 1390];

/** Ícones grandes de tipo de slot, no rodapé da folha. */
export const SLOT_GLYPHS = [
  { id: 'principal', x: [30, 62] },
  { id: 'secundaria', x: [94, 124] },
  { id: 'motor', x: [168, 194] },
  { id: 'suporte', x: [220, 246] },
  { id: 'escudo', x: [284, 314] },
];
export const SLOT_GLYPH_Y = [1444, 1480];

/** Hexágonos de raridade, no rodapé da folha. */
export const RARITY_GEMS = [
  { id: 0, x: [349, 392] },
  { id: 1, x: [399, 442] },
  { id: 2, x: [455, 494] },
  { id: 3, x: [505, 547] },
  { id: 4, x: [557, 599] },
];
export const RARITY_GEM_Y = [1444, 1486];

/** Ícones pequenos de categoria, na coluna direita ("CATEGORIAS"). */
export const CATEGORY_GLYPHS = [
  'asas', 'principal', 'secundaria', 'motor', 'reator', 'controle', 'escudo', 'blindagem', 'suporte',
];
export const CATEGORY_GLYPH_X = [787, 816];
export const CATEGORY_GLYPH_Y0 = 659;
export const CATEGORY_GLYPH_PITCH = 26.6;
export const CATEGORY_GLYPH_H = 22;

/** Ícones dos conjuntos, na coluna direita ("SETS / CONJUNTOS"). */
export const SET_ROWS = [
  { id: 'vanguarda', y: [976, 1012] },
  { id: 'sobrevivente', y: [1083, 1119] },
  { id: 'aniquilador', y: [1189, 1225] },
  { id: 'ancestral', y: [1295, 1331] },
];
export const SET_COLUMNS = [
  [784, 820], [824, 860], [864, 900], [904, 940], [944, 980],
];

/** Cor de fundo dos painéis da folha, amostrada. */
export const ITENS_MATTE = { r: 2, g: 9, b: 21 };
