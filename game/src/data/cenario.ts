/**
 * A régua que separa CENÁRIO de JOGO.
 *
 * ## O problema
 *
 * Fundo e jogo estavam no mesmo nível de presença. Um planeta laranja renderizado
 * competia com o inimigo que precisa ser acertado e com o projétil que precisa ser
 * desviado — e num jogo de reação, o que compete pela atenção com a ameaça é um
 * defeito, não um enfeite.
 *
 * ## A regra
 *
 * Tudo que é cenário fica entre **40% e 65%** da luminosidade e da saturação do
 * que é jogável. Não é escurecer por escurecer: é estabelecer que o jogador e os
 * projéteis são sempre os elementos mais legíveis da tela, e que o resto existe
 * para dar lugar, não para disputar.
 *
 * ## Por que dois números e não um
 *
 * Escurecer sozinho deixa o fundo cinza-sujo e mata a identidade de cor de cada
 * galáxia — o que se quer é um planeta que ainda seja laranja, só que um laranja
 * que não grita. Dessaturar sozinho deixa o fundo claro demais e ele continua
 * puxando o olho pelo brilho. Os dois juntos é que produzem "longe".
 */

/**
 * Quanto da luminosidade original o cenário conserva.
 *
 * 0,82 e não 0,55, e o número veio de MEDIÇÃO depois de errar duas vezes.
 *
 * Medindo o percentil 99,9 de luminância do fundo contra o do gameplay, o
 * cenário já estava em 57% — dentro da faixa de 40 a 65 que se queria. Com
 * 0,55 o véu o empurrou para 36%, ABAIXO da faixa: o fundo sumia em vez de
 * recuar.
 *
 * A média enganava porque o fundo é escuríssimo (luminância média 12,9 de
 * 255) — escurecer o quase-preto não muda nada, e o que compete pela atenção
 * é o PICO, não a média.
 */
export const CENARIO_LUMINOSIDADE = 0.82;

/** Quanto da saturação original o cenário conserva. */
export const CENARIO_SATURACAO = 0.68;

/**
 * Teto de opacidade de um corpo celeste.
 *
 * O verdadeiro competidor não era o fundo inteiro: era UM prop. Medido, o
 * `planeta/infernal` entrava a 0,78 de alfa com 297px de lado, enquanto a
 * nebulosa estava em 0,22 e o anel em 0,42. Um planeta quase opaco e do
 * tamanho de um chefe disputa com o inimigo que precisa ser acertado.
 *
 * O teto é 0,65 porque é o topo da faixa de presença que o cenário pode ter.
 * Cortar mais apagaria a identidade de cor da galáxia, que é justamente o que
 * o corpo celeste existe para dar.
 */
export const ALFA_MAX_DE_CORPO = 0.65;

/**
 * As três camadas de profundidade, e a velocidade de cada uma.
 *
 * O que cria profundidade não é a arte, é a DIFERENÇA de velocidade: três
 * imagens rolando junto são três imagens sobrepostas. Os multiplicadores abaixo
 * são relativos entre si, e é a razão entre eles que o olho lê como distância.
 *
 * O primeiro plano ambiental existe para dar a terceira referência. Com duas
 * camadas o cérebro lê "fundo e frente"; com três ele lê espaço.
 */
export const PROFUNDIDADE = {
  /** Nebulosa e estrelas pequenas. Quase parada. */
  distante: 0.25,
  /** Planetas, luas, estruturas gigantes. */
  media: 0.6,
  /** Poeira e cascalho passando perto. */
  ambiente: 1.6,
} as const;

/**
 * Poeira estelar do primeiro plano ambiental.
 *
 * Em baixa intensidade de propósito. O pedido de "integração ambiental" é fácil
 * de exagerar: partícula demais vira ruído visual e come exatamente a legibilidade
 * que o véu acabou de comprar.
 */
export const POEIRA = {
  /** Quantos grãos existem ao mesmo tempo. */
  quantidade: 46,
  /** Velocidade base de descida, multiplicando a da camada ambiente. */
  velocidade: 42,
  /** Opacidade máxima de um grão. */
  alfaMax: 0.34,
  /** Raio em unidades lógicas. */
  raioMin: 0.6,
  raioMax: 1.8,
} as const;

/**
 * Presença do projétil.
 *
 * O gênero inteiro se comunica por projétil, e o nosso saía como um sprite a
 * 0,92 de alfa, sem brilho e sem rastro — medido: mediana de 1,3 marcas em
 * tela, contra as dezenas de qualquer shooter. O jogo não PARECIA um shooter.
 *
 * O comentário antigo em `drawBullets` estava certo no diagnóstico e errado na
 * conclusão: em `lighter`, dezenas de sprites somam até estourar em branco. A
 * saída do gênero não é aditivo puro nem desistir — é HALO por baixo e NÚCLEO
 * por cima. O halo dá massa, o núcleo dá a leitura, e nenhum dos dois precisa
 * de opacidade cheia para isso.
 */
export const PROJETIL = {
  /**
   * Quantas marcas de rastro cada projétil deixa.
   *
   * Três e não oito: o rastro serve para dizer DIREÇÃO e velocidade, e a
   * partir da quarta marca ele deixa de informar e começa a sujar a tela —
   * que é exatamente o custo que se está tentando não pagar.
   */
  rastroPassos: 3,
  /**
   * Distância entre marcas, em segundos de voo.
   *
   * Em segundos e não em pixels de propósito: o rastro sai da VELOCIDADE do
   * projétil, então um tiro rápido deixa risco longo e um lento deixa risco
   * curto, sem tabela nenhuma. E como a posição anterior é dedutível de
   * `x - vx * t`, não é preciso guardar histórico de posição por projétil.
   */
  rastroPasso: 0.014,
  /** Raio do halo, multiplicando o raio do projétil. */
  haloRaio: 2.4,
  /** Opacidade do halo. Baixa porque ele é aditivo e vai se somar. */
  haloAlfa: 0.2,
} as const;

/**
 * Congelamento de impacto — o "hitstop" do gênero.
 *
 * Dois a quatro quadros de mundo parado no abate. É o efeito com maior retorno
 * por linha escrita num shooter: sem ele o inimigo simplesmente some, e o
 * golpe não tem peso nenhum.
 *
 * ## Por que o comum congela tão pouco
 *
 * Uma onda tem de 50 a 90 inimigos comuns. Congelar três quadros em cada um
 * daria uma tela piscando o setor inteiro — não é crocância, é estroboscópio.
 * O comum leva o mínimo perceptível; o peso fica guardado para quando o abate
 * significa alguma coisa.
 *
 * ## Por que existe orçamento
 *
 * Abates vêm em rajada — uma explosão em área mata seis de uma vez. Sem teto,
 * a rajada viraria meio segundo de tela travada, que o jogador lê como queda
 * de quadros e não como efeito. O orçamento recarrega a `porSegundo` e limita
 * QUANTO do tempo real pode estar congelado, não quantos abates cabem.
 */
export const CONGELAMENTO = {
  comum: 0.022,
  elite: 0.06,
  chefe: 0.14,
  /** Segundos de congelamento ganhos por segundo real. */
  porSegundo: 0.1,
  /** Teto acumulado, para uma rajada não gastar tudo de uma vez. */
  reserva: 0.16,
} as const;