/**
 * Vocabulário de corpos celestes do atlas `orbe`.
 *
 * É a contraparte no jogo do mapa de recortes em `tools/planetas.slices.mjs`:
 * os nomes precisam ser os mesmos, e ter a lista aqui — em vez de espalhada
 * como strings pelo código de cena — é o que permite sortear por FAMÍLIA.
 * Sortear por família importa: há oito luas e três anéis, então um sorteio
 * plano sobre a lista inteira faria quase todo céu virar duas esferas cinza.
 */

export const LUAS = ['cinza', 'ocre', 'palida', 'ferro', 'areia', 'musgo', 'ametista', 'bronze'] as const;
export const ANOES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const SATELITES = ['antena', 'painel', 'anel', 'sonda', 'esfera'] as const;
export const BURACOS = ['azul', 'laranja', 'roxo'] as const;
export const ANEIS = ['0', '1', '2'] as const;
export const CINTUROES = ['0', '1', '2'] as const;
export const NEBULOSAS = ['0', '1', '2', '3'] as const;
export const COMETAS = ['0', '1', '2', '3'] as const;

/** Famílias que podem compor a vizinhança de uma fase, com os ids já montados. */
export const SKY_FAMILIES: readonly (readonly string[])[] = [
  LUAS.map((n) => `lua/${n}`),
  ANOES.map((n) => `anao/${n}`),
  SATELITES.map((n) => `satelite/${n}`),
  ANEIS.map((n) => `anel/${n}`),
  BURACOS.map((n) => `buraco/${n}`),
  CINTUROES.map((n) => `cinturao/${n}`),
];

export const SKY_NEBULAE: readonly string[] = NEBULOSAS.map((n) => `nebulosa/${n}`);
export const SKY_COMETS: readonly string[] = COMETAS.map((n) => `cometa/${n}`);
