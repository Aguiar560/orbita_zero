/**
 * Mapa de recortes da folha `sprites.png` (1536x1024).
 *
 * A folha traz DOIS painéis idênticos lado a lado, com o mesmo layout interno:
 * naves do jogador, naves inimigas, obstáculos, tiros, explosões, power-ups e um
 * bloco de HUD. Só muda a paleta — o painel esquerdo é frio (azul/verde/dourado)
 * e o direito é quente (vermelho/roxo/lima). Por isso as coordenadas abaixo são
 * do painel esquerdo e o direito sai da mesma tabela deslocada em `PAINEL_PASSO`.
 *
 * O bloco de HUD fica de fora: o jogo já desenha a própria interface em DOM, e
 * as barras da folha vêm com número embutido na arte.
 */

export const SPRITES_SHEET = 'sprites.png';

/** Deslocamento horizontal do segundo painel. */
export const PAINEL_PASSO = 765;

/**
 * Fileiras com contagem conhecida, em coordenadas do painel esquerdo.
 *
 * `x0`/`x1` aceitam par `[esquerdo, direito]` quando os dois painéis não
 * coincidem: os filetes internos e as margens de cada bloco ficaram alguns
 * pixels fora de registro entre um painel e outro, e uma borda só ora decepa um
 * sprite, ora arrasta o filete junto.
 */
export const SPRITE_FILEIRAS = [
  // ── naves ────────────────────────────────────────────────────────────────
  { id: 'nave', y0: 40, y1: 174, x0: 18, x1: 380, n: 3 },
  { id: 'hostil', y0: 40, y1: 174, x0: 398, x1: 752, n: 3 },

  // ── obstáculos: duas fileiras de quatro ──────────────────────────────────
  // `x1` para antes de 406: ali corre o filete que separa OBSTÁCULOS de TIROS,
  // e ele é aceso o bastante para virar corpo e grudar no último obstáculo.
  { id: 'obstaculo/a', y0: 322, y1: 442, x0: 20, x1: [403, 391], n: 4 },
  { id: 'obstaculo/b', y0: 448, y1: 546, x0: 20, x1: [403, 391], n: 4 },

  // ── explosões: duas fileiras de cinco ────────────────────────────────────
  { id: 'estouro/a', y0: 590, y1: 682, x0: 20, x1: [482, 470], n: 5, flood: 120 },
  { id: 'estouro/b', y0: 686, y1: 768, x0: 20, x1: [482, 470], n: 5, flood: 120 },

  // ── power-ups: duas fileiras de cinco ────────────────────────────────────
  { id: 'bonus/a', y0: 604, y1: 662, x0: [496, 486], x1: 750, n: 5 },
  { id: 'bonus/b', y0: 670, y1: 726, x0: [496, 486], x1: 750, n: 5 },
];

/** Nome do painel por índice, usado como sufixo dos ids. */
export const PAINEIS = ['frio', 'quente'];

/**
 * Projéteis.
 *
 * Cada grupo de cor traz três projéteis lado a lado; o do meio é o mais legível
 * isolado, então é o único aproveitado. Só o painel esquerdo entra: ele já cobre
 * as seis cores que o sistema de elementos usa, e o direito repete as mesmas em
 * versão feixe/onda, que não cabem num shmup vertical de tiro curto.
 */
export const TIRO_FILEIRAS = [
  { y0: 330, y1: 388, tamanho: 'g', cores: ['raio', 'quimico', 'padrao'] },
  { y0: 388, y1: 424, tamanho: 'p', cores: ['raio', 'quimico', 'padrao'] },
  { y0: 434, y1: 506, tamanho: 'g', cores: ['cosmico', 'fogo', 'gelo'] },
  { y0: 506, y1: 542, tamanho: 'p', cores: ['cosmico', 'fogo', 'gelo'] },
];

/** Limites horizontais do bloco de tiros e largura de cada grupo de cor. */
export const TIRO_BLOCO = { x0: 418, x1: 748 };

/**
 * O elemento neutro não tem projétil próprio na folha: o grupo dourado vira
 * branco na saída para não parecer fogo.
 */
export const TIRO_DESSATURA = 'padrao';
