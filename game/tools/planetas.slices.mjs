/**
 * Mapa de recortes da folha `planetas.png` (1536x1024).
 *
 * A folha é um catálogo sobre fundo preto: duas fileiras de planetas grandes com
 * rótulo embaixo, e depois blocos menores (luas, satélites, anões, anéis,
 * buracos negros, nebulosas, cinturão, cometas) separados por cabeçalhos de
 * texto. Os rótulos ficam FORA das faixas — se entrassem, virariam sprite.
 *
 * O passo entre os itens é irregular (o gigante gasoso com anel é bem mais largo
 * que o glacial), então a posição vem de detecção por coluna vazia com a
 * contagem conhecida (`sliceRow`), não de uma grade.
 */

export const PLANETAS_SHEET = 'planetas.png';

/**
 * Faixas com contagem conhecida.
 *
 * `nomes` batiza os sprites e vira, mais adiante, o vocabulário de céu do jogo;
 * são os próprios rótulos impressos na folha, em minúsculas sem acento.
 * `flood` é o brilho que o preenchimento de fundo consegue atravessar — os
 * planetas com halo forte (infernal, vórtex) precisam de um teto mais alto para
 * o halo não ser confundido com corpo.
 */
export const PLANETA_FAIXAS = [
  {
    // `gap` curto: o anel do gigante gasoso chega a 7px do glacial.
    id: 'planeta', y0: 18, y1: 214, x0: 10, x1: 1526, flood: 40, gap: 3,
    nomes: ['terrano', 'vulcano', 'gasoso', 'glacial', 'desertico', 'florestal', 'tecnologico'],
  },
  {
    id: 'planeta', y0: 246, y1: 442, x0: 10, x1: 1526, flood: 40, gap: 3,
    nomes: ['infernal', 'oceanico', 'corrompido', 'cristalino', 'densa', 'vortex', 'luminoso'],
  },
  {
    id: 'lua', y0: 514, y1: 630, x0: 10, x1: 900, flood: 40,
    nomes: ['cinza', 'ocre', 'palida', 'ferro', 'areia', 'musgo', 'ametista', 'bronze'],
  },
  {
    id: 'satelite', y0: 514, y1: 630, x0: 920, x1: 1526, flood: 40,
    nomes: ['antena', 'painel', 'anel', 'sonda', 'esfera'],
  },
  {
    id: 'anao', y0: 686, y1: 792, x0: 10, x1: 600, flood: 40,
    nomes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  },
  {
    id: 'buraco', y0: 676, y1: 828, x0: 1062, x1: 1526, flood: 90,
    nomes: ['azul', 'laranja', 'roxo'],
  },
];

/**
 * Blocos de brilho contínuo: nebulosa, anel e cauda de cometa se dissolvem uns
 * nos outros, então aqui a divisão é geométrica mesmo — não há coluna vazia para
 * detectar.
 */
export const PLANETA_BLOCOS = [
  { id: 'anel', y0: 688, y1: 812, x0: 612, x1: 1054, n: 3, flood: 90 },
  { id: 'nebulosa', y0: 856, y1: 1004, x0: 16, x1: 604, n: 4, flood: 255 },
  { id: 'cinturao', y0: 872, y1: 1000, x0: 630, x1: 1004, n: 3, flood: 40 },
  { id: 'cometa', y0: 862, y1: 1000, x0: 1050, x1: 1512, n: 4, flood: 90 },
];
