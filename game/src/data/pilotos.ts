/**
 * Os personagens jogáveis (§ escolha inicial).
 *
 * Não confundir com `data/personagens.ts`: aquele é a rede de CONTATOS das
 * missões — gente que dá contrato. Aqui é quem o jogador É. Os dois iam se
 * chamar "personagem" e brigar pelo nome, então o jogável ficou "piloto".
 *
 * ## O que a escolha vale, e o que ela não vale
 *
 * Vale a NAVE DE PARTIDA, e só. Raça, galáxia e descrição são identidade — não
 * tocam em número nenhum. Isso é decisão de projeto, não economia de trabalho:
 * o `CLAUDE.md` proíbe uma quarta fonte de poder além de item, craft e Matriz,
 * e um bônus de piloto seria exatamente isso.
 *
 * A escolha CONVERGE. Todo casco comprável continua aberto a todos, então por
 * volta do primeiro casco de loja o piloto deixou de ser uma restrição e virou
 * preferência. É o que impede a escolha de virar armadilha para quem escolheu
 * "errado" na primeira tela, antes de conhecer o jogo.
 *
 * ## Por que os quatro são justos, e como conferir
 *
 * Os quatro cascos têm a MESMA nota de poder — `powerScore`, a média
 * geométrica de ataque e defesa que o resto do balanceamento já usa. Medido:
 * 1,64% de dispersão entre eles, contra 34% de diferença em dps e 32% em vida
 * efetiva. Ou seja: formas bem distintas, poder praticamente idêntico.
 *
 * Isso é verificável, e o teste `tests/pilotos.test.ts` verifica. Se alguém
 * mexer num stat e desequilibrar, o teste cai.
 */

export interface PilotoDef {
  id: string;
  nome: string;
  /** Raça. Puramente identidade — não altera número nenhum. */
  raca: string;
  /** Galáxia de origem, por índice. Idem: sabor. */
  galaxia: number;
  /** Duas ou três linhas na tela de escolha. */
  descricao: string;
  /** Sprite do retrato, no atlas `characters`. */
  retrato: string;
  /** Cor de acento do cartão. */
  cor: string;
  /** Casco de partida, por id de `hulls.ts`. É a única coisa que pesa. */
  casco: string;
  /** Rótulo curto da forma do casco, mostrado no cartão. */
  arquetipo: string;
  /**
   * O que o casco faz melhor e pior, em texto.
   *
   * Escrito à mão e não derivado dos stats de propósito: o jogador na primeira
   * tela não tem vocabulário para "cadência 3,4" nem referência para saber se
   * 135 de vida é muito. Ele precisa da FRASE.
   */
  forte: string;
  fraco: string;
}

export const PILOTOS: readonly PilotoDef[] = [
  {
    id: 'piloto_vektor',
    nome: 'VEKTOR-9',
    raca: 'Sintético',
    galaxia: 0,
    descricao:
      'Unidade de navegação recuperada de um estaleiro morto. Não lembra quem '
      + 'o construiu, e decidiu que isso não importa.',
    retrato: 'character/ally/android_2',
    cor: '#4FC3FF',
    casco: 'nucleo_vektor',
    arquetipo: 'EQUILIBRADO',
    forte: 'Sem pontos fracos. Aguenta e machuca em igual medida.',
    fraco: 'Também sem pontos fortes: nunca é a melhor ferramenta.',
  },
  {
    id: 'piloto_darin',
    nome: 'DARIN KOSS',
    raca: 'Humano',
    galaxia: 1,
    descricao:
      'Ex-piloto de corrida de carga. Foi banido das rotas internas por '
      + 'atravessar um campo de detritos que a torre havia fechado.',
    retrato: 'character/player/man',
    cor: '#FF5A3C',
    casco: 'lanca_rubra',
    arquetipo: 'AGRESSIVO',
    forte: 'O maior dano de saída dos quatro. Derruba onda antes de apanhar.',
    fraco: 'Casco fino. Um erro custa caro.',
  },
  {
    id: 'piloto_sora',
    nome: 'SORA VEY',
    raca: 'Humana',
    galaxia: 2,
    descricao:
      'Engenheira de casco das docas geladas. Voa com a nave que ela mesma '
      + 'blindou, e confia mais na blindagem do que na pontaria.',
    retrato: 'character/player/woman_2',
    cor: '#5CE6FF',
    casco: 'baluarte_glacial',
    arquetipo: 'RESISTENTE',
    forte: 'Vida, escudo e regeneração acima de todos. Erra e sobrevive.',
    fraco: 'Mata devagar. Ondas longas ficam mais longas.',
  },
  {
    id: 'piloto_nharu',
    nome: 'NHARU',
    raca: 'Ser cósmico',
    galaxia: 3,
    descricao:
      'Não pilota a nave: ocupa-a. O casco responde antes do comando, e '
      + 'ninguém a bordo sabe explicar como.',
    retrato: 'character/ally/friend_5',
    cor: '#B45CFF',
    casco: 'sopro_astral',
    arquetipo: 'ÁGIL',
    forte: 'A mais rápida e a de maior cadência. Desvia do que não quer levar.',
    fraco: 'Frágil como a agressiva, sem o dano dela.',
  },
];

export const PILOTO_POR_ID = new Map(PILOTOS.map((p) => [p.id, p]));

/**
 * Piloto de quem não escolheu.
 *
 * Existe para o save antigo e para o teste, que precisam de um estado válido
 * sem passar pela tela. É o equilibrado de propósito: se alguém cair aqui por
 * engano, cai no casco sem armadilha.
 */
export const PILOTO_PADRAO = PILOTOS[0]!.id;

export const pilotoDe = (id: string): PilotoDef =>
  PILOTO_POR_ID.get(id) ?? PILOTO_POR_ID.get(PILOTO_PADRAO)!;

/** Os cascos que pertencem a um piloto. Nenhum deles é comprável. */
export const CASCOS_DE_PILOTO: ReadonlySet<string> = new Set(PILOTOS.map((p) => p.casco));
