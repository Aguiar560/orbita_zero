import type { ElementId } from '@sim/types';

/**
 * O elemento de cada galáxia, escrito à mão.
 *
 * ## O que estava errado
 *
 * O elemento das galáxias 1 a 20 vinha da FROTA (`FLEET_INFO[índice/2]`), e os
 * inimigos vinham de um elenco montado por deslocamento de índice, sem olhar
 * elemento nenhum. As duas coisas nunca se falaram: medido em 07/09, a galáxia
 * 1 se declarava de FOGO e tinha **zero** inimigos de fogo — o elenco dela era
 * 1.608 químicos, 843 neutros, 564 cósmicos e 380 de raio.
 *
 * Pior: o elenco trazia inimigos com nome de OUTRAS galáxias. O "Vigia de
 * Rhodes" (Fenda de Rhodes, galáxia 5) aparecia no Berço de Vega, e o "Escriba
 * Terminal" (Fim da Linha, galáxia 20) na galáxia 2. Os inimigos declaram
 * `setores: [1, 0]` — disponíveis em qualquer lugar —, então não havia sequer um
 * vínculo para respeitar.
 *
 * ## O critério desta tabela
 *
 * Cada nome de galáxia já sugere um elemento, e é dele que a linha sai. As três
 * primeiras foram escolha do Rafael: Berço de Vega é raio, Corte de Ferro é
 * fogo, Mar de Cinzas é gelo.
 *
 * As galáxias 21 a 30 NÃO estão aqui: elas têm identidade autoral em
 * `PROFUNDAS`, com texto que já casa com o elemento — "Rios de escória circulam
 * uma estrela desmontada" é fogo, "Prismas quânticos repetem cada nave em
 * futuros rivais" é cósmico. Sobrescrevê-las para fechar uma conta seria trocar
 * texto escrito por aritmética.
 *
 * ## E a conta fecha assim mesmo
 *
 * As profundas trazem fogo 2, padrão 1, químico 2, raio 1 e cósmico 4. Esta
 * tabela completa cada um até CINCO, o que dá 5 galáxias por elemento nas 30 —
 * e conserta de quebra o desequilíbrio do minério elemental, que tinha oito
 * minérios cósmicos e apenas dois de gelo.
 */
export const ELEMENTO_DA_GALAXIA: readonly ElementId[] = [
  'raio',     // 1 · Berço de Vega — a estrela azul que dá nome ao berço
  'fogo',     // 2 · Corte de Ferro — forja e reentrada
  'gelo',     // 3 · Mar de Cinzas — cinza assentada é cinza fria
  'quimico',  // 4 · Pálio Verde
  'cosmico',  // 5 · Fenda de Rhodes — a fenda é a dobra
  'padrao',   // 6 · Coroa Quebrada — destroço, massa contra massa
  'gelo',     // 7 · Longa Noite
  'gelo',     // 8 · Alto Silêncio
  'fogo',     // 9 · Véu de Âmbar — âmbar é resina queimada
  'padrao',   // 10 · Última Página
  'fogo',     // 11 · Forja Fria — o nome é irônico; a forja acende
  'quimico',  // 12 · Jardim de Óxido — corrosão
  'gelo',     // 13 · Anel de Tétis — Tétis é lua de gelo
  'raio',     // 14 · Garganta Azul — descarga em cânion condutor
  'padrao',   // 15 · Espinha do Vazio — estrutura, não elemento
  'raio',     // 16 · Nona Aurora — aurora é campo magnético
  'quimico',  // 17 · Campo de Lázaro — enxerto e cultura
  'gelo',     // 18 · Trono Oco — o trono esfriou
  'padrao',   // 19 · Maré de Prata
  'raio',     // 20 · Fim da Linha — o trilho conduz

  // ── 21 a 30: ESPELHAM as identidades autorais de `PROFUNDAS` ─────────────
  //
  // Elas não foram escolhidas aqui — foram copiadas de lá, porque o texto já
  // dizia o elemento: "Rios de escória circulam uma estrela desmontada" é fogo,
  // "Prismas quânticos repetem cada nave em futuros rivais" é cósmico.
  //
  // Estão nesta lista porque o BESTIÁRIO precisa lê-las sem importar
  // `galaxies.ts` — o que criaria ciclo. Enquanto elas viviam só lá, o elenco
  // das profundas caía num rodízio que discordava do rótulo, e a medição
  // mostrava ZERO por cento do elemento em cinco galáxias seguidas.
  'fogo',     // 21 · Caldeira de Asterion
  'padrao',   // 22 · Cemitério de Khepri
  'quimico',  // 23 · Tear de Nyx
  'raio',     // 24 · Lâmina de Carbono
  'cosmico',  // 25 · Prisma de Eos
  'quimico',  // 26 · Colmeia de Ícaro
  'fogo',     // 27 · Forja de Antares
  'cosmico',  // 28 · Coroa de Caelum
  'cosmico',  // 29 · Dobra de Janus
  'cosmico',  // 30 · Umbra Terminal
];

/** Quantos inimigos-assinatura de um elenco seguem o elemento da galáxia. */
export const ASSINATURAS_DO_ELEMENTO = 2;
