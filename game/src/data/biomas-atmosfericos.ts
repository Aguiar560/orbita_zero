/**
 * Cenários planetários da camada vertical.
 *
 * A configuração fica centralizada porque os biomas precisam responder
 * como uma coleção: mesma escala, duração da passagem, interpolação nas
 * junções e tratamento de contraste. Alterar um deles isoladamente faria uma
 * galáxia parecer lenta, pixelada ou mais brilhante que as demais.
 */
export const CONFIG_BIOMA_ATMOSFERICO = {
  larguraFonte: 1024,
  alturaFaixa: 4288,
  sobreposicaoDeTransicao: 160,
  velocidade: 24,
  filtro: 'saturate(.72) brightness(.62) contrast(.86)',
} as const;

export interface BiomaAtmosferico {
  /** Índice zero-based da única galáxia que usa esta superfície. */
  galaxia: number;
  id: string;
  src: string;
  /** Artes já escuras podem dispensar o rebaixamento usado nas fotografias. */
  filtro?: string;
}

/**
 * As seis superfícies longas entram uma vez cada, nas galáxias 1–6.
 *
 * As dezenove anteriores já possuem cenários autorais em `galaxies.ts`; pôr
 * estas artes no começo da campanha apresenta imediatamente os biomas que antes
 * só existiam no teste. Os cenários autorais restantes continuam nas galáxias
 * 7–19 e depois o jogo usa o backdrop determinístico, sem repetir arquivos.
 */
export const BIOMAS_ATMOSFERICOS: readonly BiomaAtmosferico[] = [
  { galaxia: 0, id: 'oceanico', src: 'fundo/bioma-atmosfera-longo.webp' },
  { galaxia: 1, id: 'vulcanico', src: 'fundo/bioma-vulcanico-longo.webp' },
  { galaxia: 2, id: 'glacial', src: 'fundo/bioma-glacial-longo.webp' },
  { galaxia: 3, id: 'deserto', src: 'fundo/bioma-deserto-longo.webp' },
  { galaxia: 4, id: 'toxica', src: 'fundo/bioma-toxica-longo.webp' },
  { galaxia: 5, id: 'cristalina', src: 'fundo/bioma-cristalina-longo.webp' },
];

/** Prévia exclusiva do modo de teste; não substitui a coleção da campanha. */
export const BIOMAS_ATMOSFERICOS_DE_TESTE: readonly BiomaAtmosferico[] = [
  { galaxia: 5, id: 'bosque-fotonico', src: 'fundo/teste/bioma-bosque-fotonico.webp' },
  { galaxia: 6, id: 'necropole-mecanica', src: 'fundo/teste/bioma-necropole-mecanica.webp' },
  { galaxia: 7, id: 'tempestade-de-ambar', src: 'fundo/teste/bioma-tempestade-de-ambar.webp' },
  { galaxia: 8, id: 'recife-carmesim', src: 'fundo/teste/bioma-recife-carmesim.webp' },
  { galaxia: 9, id: 'mar-de-regolito', src: 'fundo/teste/bioma-mar-de-regolito.webp' },
].map((bioma) => ({ ...bioma, filtro: 'saturate(.9) brightness(.95)' }));

export function biomaAtmosfericoDaGalaxia(
  indiceDaGalaxia: number,
  modoDeTeste = false,
): BiomaAtmosferico | null {
  if (modoDeTeste) {
    const previa = BIOMAS_ATMOSFERICOS_DE_TESTE.find((bioma) => bioma.galaxia === indiceDaGalaxia);
    if (previa) return previa;
  }
  return BIOMAS_ATMOSFERICOS.find((bioma) => bioma.galaxia === indiceDaGalaxia) ?? null;
}
