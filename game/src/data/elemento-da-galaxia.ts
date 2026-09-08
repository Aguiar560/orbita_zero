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
 * ## O critério, em três camadas
 *
 * A primeira versão desta tabela saiu só dos NOMES, e ficou mal distribuída: o
 * cósmico caía na galáxia 5 e só reaparecia na 25, um vão de vinte galáxias.
 * Refeita em 07/09 com três critérios, nesta ordem de prioridade:
 *
 * 1. **O FUNDO manda.** É o que o jogador olha por dez setores. As seis
 *    primeiras têm superfícies atmosféricas longas
 *    (`biomas-atmosfericos.ts`) e elas decidem sozinhas: oceânico→raio,
 *    vulcânico→fogo, glacial→gelo, deserto→padrão, tóxica→químico,
 *    cristalina→cósmico. Isso apresenta os seis elementos nas seis primeiras
 *    galáxias, cada um com o cenário que o explica. Da 7 à 19 valem os cenários
 *    autorais de `FUNDOS` (crimson, abyss, emerald, violet, amber, cyan, aqua,
 *    blue, red, stellar, toxic, vapor, void), com o mesmo peso.
 * 2. **O NOME desempata.** Anel de Tétis é lua de gelo, Garganta Azul é
 *    descarga em cânion condutor, Campo de Lázaro é enxerto.
 * 3. **O VÃO fecha a conta.** Nenhum elemento pode sumir por meia campanha.
 *
 * Onde nome e fundo brigam, o fundo vence: Pálio Verde soa químico mas a
 * superfície dela é deserto, e ela é padrão. É tensão entre a arte e o nome, e
 * está registrada aqui em vez de resolvida em silêncio — o nome é que deveria
 * mudar, não o cenário.
 *
 * ## O que a redistribuição custou, medido
 *
 * | | Antes | Depois |
 * |---|---|---|
 * | maior vão entre aparições | 20 (cósmico: g5 → g25) | **9** |
 * | pior elemento | gelo, raio: 13 | 9 |
 *
 * Uma identidade profunda precisou ser reescrita: **Coroa de Caelum** (g28)
 * deixou de ser cósmica e virou de gelo. Sem ela o gelo não aparecia UMA vez
 * sequer nas dez galáxias finais — as profundas traziam fogo, padrão, químico,
 * raio e cósmico, e nenhum gelo —, e o vão final dele era 11 fizesse o que
 * fizesse nas vinte primeiras. Trocar duas identidades levaria o vão a 8; não
 * compensa, porque a segunda seria a Dobra de Janus, cujo texto ("todas as
 * rotas se dobram e retornam por outro ângulo") É a definição de cósmico.
 *
 * O cósmico ficou com SEIS e o padrão com QUATRO, em vez de cinco e cinco. É
 * consequência aritmética de duas coisas que não se mexem: a cristalina da
 * galáxia 6 é cósmica, e três das dez profundas também são. Com cinco cósmicas
 * o vão volta a 10.
 */
export const ELEMENTO_DA_GALAXIA: readonly ElementId[] = [
  // ── 1 a 6: as superfícies atmosféricas longas decidem ────────────────────
  'raio',     // 1 · Berço de Vega — bioma oceânico, a estrela azul do berço
  'fogo',     // 2 · Corte de Ferro — bioma vulcânico
  'gelo',     // 3 · Mar de Cinzas — bioma glacial
  'padrao',   // 4 · Pálio Verde — bioma deserto; areia e rocha, massa contra massa
  'quimico',  // 5 · Fenda de Rhodes — bioma tóxico
  'cosmico',  // 6 · Coroa Quebrada — bioma cristalino

  // ── 7 a 19: os cenários autorais de `FUNDOS`, na ordem em que caem ───────
  'raio',     // 7 · Longa Noite (07_crimson) — a noite longa é cortada por descargas
  'cosmico',  // 8 · Alto Silêncio (08_abyss)
  'fogo',     // 9 · Véu de Âmbar (09_emerald) — âmbar é resina queimada
  'padrao',   // 10 · Última Página (10_violet)
  'gelo',     // 11 · Forja Fria (11_amber) — o nome diz "fria", e é ela que manda
  'quimico',  // 12 · Jardim de Óxido (12_cyan) — corrosão
  'gelo',     // 13 · Anel de Tétis (13_aqua) — Tétis é lua de gelo
  'raio',     // 14 · Garganta Azul (14_blue) — descarga em cânion condutor
  'fogo',     // 15 · Espinha do Vazio (15_red)
  'cosmico',  // 16 · Nona Aurora (16_stellar)
  'quimico',  // 17 · Campo de Lázaro (17_toxic) — enxerto e cultura
  'padrao',   // 18 · Trono Oco (18_vapor) — o trono é estrutura, não elemento
  'gelo',     // 19 · Maré de Prata (19_void)
  'raio',     // 20 · Fim da Linha — o trilho conduz

  // ── 21 a 30: ESPELHAM as identidades autorais de `PROFUNDAS` ─────────────
  //
  // Elas não foram escolhidas aqui — foram copiadas de lá, porque o texto já
  // dizia o elemento: "Rios de escória circulam uma estrela desmontada" é fogo,
  // "Prismas quânticos repetem cada nave em futuros rivais" é cósmico.
  //
  // A ÚNICA exceção é a 28, Coroa de Caelum: ela era cósmica e foi reescrita
  // como gelo, porque sem ela o gelo não existia em nenhuma das dez profundas.
  // O texto dela mudou junto, em `galaxies.ts` — a ficção seguiu o elemento, e
  // não o contrário.
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
  'gelo',     // 28 · Coroa de Caelum — reescrita; ver acima
  'cosmico',  // 29 · Dobra de Janus
  'cosmico',  // 30 · Umbra Terminal
];

/**
 * Quantos inimigos-assinatura de um elenco seguem o elemento da galáxia.
 *
 * São TRÊS das quatro vagas regulares, e não quatro: a quarta vaga mais as duas
 * de apoio garantem que uma galáxia de fogo tenha maioria de fogo sem virar
 * monocultura — pedido do Rafael, e também o que impede o jogador de montar uma
 * resistência única e desligar o combate.
 *
 * O número é um TETO, não uma cota: quando o catálogo não tem três naves do
 * elemento, entra o que houver. Medido em 07/09, os regulares são químico 5,
 * cósmico 5, padrão 4, fogo 3, raio 2 e **gelo 1** — então as galáxias de gelo
 * ficam com uma vaga só e não chegam perto da maioria. É lacuna de ARTE, não de
 * código: repetir a mesma nave três vezes seria pior que o problema.
 */
export const ASSINATURAS_DO_ELEMENTO = 3;

/**
 * Quanto o elemento da região pesa no sorteio de tipos de cada onda.
 *
 * As vagas do elenco sozinhas não bastavam: elas dizem quem PODE aparecer, e o
 * sorteio de `buildEncounter` é que diz quem aparece. Medido em 07/09 só com as
 * vagas, a galáxia de raio ficava em 31% de raio — o rótulo dizia uma coisa e a
 * tela mostrava outra.
 *
 * 2,2 e não mais: acima disso as galáxias com bestiário farto passam de 80% e
 * viram monocultura, o que deixa o jogador montar uma resistência só e desligar
 * o combate por dez setores.
 *
 * O peso é dividido pelo número de naves do elemento no elenco (ver
 * `buildEncounter`), para a cota ser do ELEMENTO e não de cada nave. Sem isso a
 * presença virava refém do catálogo: fogo em 73% e gelo em 20%, com a mesma
 * regra.
 */
export const PESO_DO_ELEMENTO_NA_ONDA = 2.2;

/**
 * Teto da divisão acima.
 *
 * Sem teto, um elemento com UMA nave no elenco receberia peso 6,6 e essa nave
 * sozinha encheria a onda — a galáxia de gelo viraria a mesma silhueta repetida
 * por dez setores. O teto aceita que o gelo fique abaixo da maioria enquanto o
 * bestiário tiver um regular só. É lacuna de ARTE, e o número existe para
 * deixar isso explícito em vez de escondê-lo atrás de uma repetição feia.
 */
export const TETO_DO_PESO_ELEMENTAL = 4.4;
