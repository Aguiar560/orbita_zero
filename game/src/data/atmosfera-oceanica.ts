/** Atmosfera da galáxia 1 (índice zero), em campanha/teste, nunca Provação/laboratório. */
export function atmosferaOceanicaAtiva(galaxia: number, desafio: boolean, laboratorio: boolean): boolean {
  return galaxia === 0 && !desafio && !laboratorio;
}

export const ARTES_ATMOSFERA_OCEANICA = {
  nuvem: 'fundo/atmosfera-teste/nuvem.webp',
} as const;

/** Movimento puramente visual; não consome o RNG do combate. */
export function passagemAtmosferica(tempo: number, velocidade: number, fase: number, altura: number, margem: number): number {
  const percurso = altura + margem * 2;
  return (((tempo * velocidade + fase * percurso) % percurso) + percurso) % percurso - margem;
}

export const NUVENS_OCEANICAS = [
  { x: .12, fase: .19, escala: .95, velocidade: 30, alfa: .24, angulo: -.28, plano: 'baixo' },
  { x: .85, fase: .61, escala: .88, velocidade: 34, alfa: .22, angulo: 2.75, plano: 'baixo' },
  { x: .09, fase: .56, escala: 1.05, velocidade: 53, alfa: .38, angulo: .25, plano: 'medio' },
  { x: .94, fase: .20, escala: .97, velocidade: 59, alfa: .34, angulo: 3.35, plano: 'medio' },
  { x: -.52, fase: .32, escala: 1.65, velocidade: 102, alfa: .22, angulo: -.32, plano: 'frente' },
  { x: 1.52, fase: .76, escala: 1.52, velocidade: 116, alfa: .19, angulo: 2.92, plano: 'frente' },
] as const;
