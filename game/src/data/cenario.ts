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
/**
 * A marca do que MACHUCA.
 *
 * ## O problema, e por que a solução do gênero não serve aqui
 *
 * Ikaruga, Touhou e Nex Machina reservam uma COR para "isto encosta em você e
 * dói", e nada mais na tela usa essa cor. É a regra mais rígida do gênero.
 *
 * Aqui ela não cabe: a cor do projétil é a do ELEMENTO, e o anel elemental é
 * quem decide o dano. Pintar todo tiro inimigo de uma cor só apagaria a única
 * informação que o jogador precisa ler no ar — de que elemento vem o golpe.
 *
 * ## O que se reserva quando não se pode reservar a cor
 *
 * A FORMA. O tiro do jogador é um risco: alongado, com rastro comprido, subindo.
 * O tiro inimigo é um olho: redondo, com auréola escura em volta e rastro curto.
 * Duas gramáticas distintas que sobrevivem a qualquer matiz — e o jogador lê
 * ameaça pelo formato e elemento pela cor, sem que uma leitura custe a outra.
 *
 * A auréola ESCURA é a peça central. Ela resolve dois problemas de uma vez:
 * separa o hostil do amistoso, e dá ao projétil um contorno que o destaca de
 * qualquer fundo — inclusive do planeta claro que o item 5 ainda deixa em cena.
 */
export const AMEACA = {
  /**
   * Raio externo do anel escuro, multiplicando o raio do projétil.
   *
   * Maior que o halo (2,4) de propósito: o anel precisa sobrar POR FORA dele.
   * A primeira versão usava 1,9 e ficava por baixo do halo aditivo, que pintava
   * por cima e apagava a auréola — medido, o anel saía 3,1 mais CLARO que o
   * fundo local, o oposto do que se queria.
   */
  auroraRaio: 3.2,
  /** Onde o escuro começa a aparecer. Antes disso, transparente. */
  auroraInterna: 0.68,
  /** Onde o escuro é máximo. Depois disso, some de volta. */
  auroraPico: 0.84,
  /** Opacidade no pico. */
  auroraAlfa: 0.8,
  /**
   * Passos de rastro do tiro INIMIGO.
   *
   * Um contra os três do jogador. O rastro comprido diz "eu saí daqui e vou
   * para lá", que é leitura de quem atira; de quem desvia, o que importa é
   * ONDE a coisa está agora.
   */
  rastroPassos: 1,
} as const;

/**
 * O corpo celeste sai da pista.
 *
 * Medido em 200 setores, o corpo principal ocupava 62% da largura da tela (até
 * 78%), cobria **75% da pista central** e nascia com o centro DENTRO dela em
 * 72% dos setores. Inimigos passavam por cima e a silhueta sumia.
 *
 * ## Por que não basta encolher
 *
 * Um planeta pequeno no meio da tela é um adesivo; um planeta enorme cortado
 * pela borda é um mundo. Cortar é o que os filmes fazem para dar escala, e sai
 * de graça: a parte que sobra na tela é menor, e a parte que o olho IMAGINA é
 * maior. Então o corpo continua grande e vai para a margem.
 *
 * ## Contraste interno, não brilho
 *
 * A medição anterior olhou o PICO de luminância e disse que o cenário estava
 * dentro da faixa. Estava — e mesmo assim comia silhueta, porque o que engole
 * um contorno não é o brilho médio, é a TEXTURA: um planeta escuro cheio de
 * crateras destrói leitura igual a um claro.
 *
 * `contrast` achata a textura interna; `brightness` compensa o efeito colateral
 * de o `contrast` puxar tudo na direção do cinza médio, que sozinho deixaria o
 * lado escuro do planeta MAIS claro do que era.
 *
 * ## A calibração, medida em quatro corpos
 *
 * O primeiro par que escrevi — `contrast(0,62) brightness(0,82)` — cortava 44%
 * do contraste interno e CLAREAVA todos os quatro, de +4 a +11. O `brightness`
 * estava compensando de menos, e eu só descobri porque medi a média junto com o
 * desvio em vez de olhar só o desvio, que era o número que eu queria ver.
 *
 * | par | queda do contraste | pior clareamento |
 * |---|---|---|
 * | 0,62 / 0,82 | 44% | **+11** |
 * | 0,70 / 0,68 | 48% | −2,9 |
 * | 0,62 / 0,62 | 56% | −3,0 |
 * | **0,55 / 0,60** | **60%** | **−1,7** |
 *
 * O escolhido ganha nos dois critérios ao mesmo tempo. E as médias dos quatro
 * corpos, que iam de 42 a 68, passam a ir de 40 a 55: além de achatar cada
 * corpo por dentro, o par aproxima os corpos ENTRE SI — que é o que "cenário"
 * quer dizer, um plano só em vez de quatro objetos disputando.
 */
export const CORPO_CELESTE = {
  /** Até onde o centro do corpo principal pode entrar, por lado. */
  margem: 0.22,
  /** Achatamento da textura interna. */
  contraste: 0.55,
  /** Compensação, para o achatamento não clarear o corpo. */
  luminosidade: 0.6,
} as const;