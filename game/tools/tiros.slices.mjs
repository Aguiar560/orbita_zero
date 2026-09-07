/**
 * Recorte de `tiros e explosoes.png` — 6 elementos × 8 categorias (§21).
 *
 * A folha é uma GRADE rotulada: uma coluna de rótulos à esquerda, uma linha de
 * cabeçalho com as pílulas dos elementos, e daí em diante cada célula é um
 * elemento × uma categoria com dois a seis sprites dentro.
 *
 * As fronteiras não são chutadas: saem de perfis de luminância medidos na
 * própria imagem (`node -e` com sharp, o mesmo caminho das outras folhas). As
 * faixas de linha vieram do perfil horizontal ignorando a coluna de rótulos, e
 * as colunas vieram das seis pílulas do cabeçalho, que são os únicos blocos
 * limpos o bastante para separar — o conteúdo das células sangra de uma coluna
 * para a outra por causa do brilho.
 */

/** Onde a coluna de rótulos termina. Nada à esquerda disto é arte. */
export const ROTULOS_ATE = 133;

/**
 * Faixas verticais de cada categoria, medidas.
 *
 * `vao` é a tolerância de fusão da segmentação, em fração da altura da célula,
 * e existe porque as categorias têm formas OPOSTAS. Explosão espalha fagulhas
 * soltas que precisam ser recolhidas ao corpo, então quer tolerância generosa;
 * tiro é uma fileira de hastes verticais próximas, e a mesma tolerância colava
 * três tiros num sprite só. Uma constante única servia mal aos dois — e servir
 * mal aqui não aparece em número nenhum, só na folha de contato.
 *
 * O cabeçalho `[7,70]` fica de fora: são as pílulas com o nome do elemento, não
 * sprites.
 */
export const CATEGORIAS = [
  { id: 'tiro', y: [84, 208], nome: 'tiros do jogador', vao: 0.03 },
  { id: 'tiroini', y: [226, 328], nome: 'tiros do inimigo', vao: 0.03 },
  { id: 'carga', y: [340, 436], nome: 'tiros carregados', vao: 0.03 },
  { id: 'feixe', y: [449, 529], nome: 'raios e feixes', vao: 0.03 },
  { id: 'fogacho', y: [546, 608], nome: 'efeitos de disparo' },
  { id: 'estouro', y: [626, 735], nome: 'explosões' },
  { id: 'faisca', y: [746, 846], nome: 'detalhes e partículas' },
  /**
   * ► A fileira de ícones fica DE FORA do atlas, de propósito.
   *
   * Ela não segue a grade de colunas: são 12 glifos espalhados na largura toda
   * — seis grandes e seis pequenos —, e não dois por elemento. Recortá-la pela
   * grade misturava metade de um elemento com metade do vizinho.
   *
   * Recortada na largura inteira, oito dos doze saem limpos e quatro viram
   * lascas; pior, a ORDEM extraída não bate com a da folha, então nomear por
   * índice produziria `glifo/fogo_g` num floco de neve. Um id errado é pior que
   * um id ausente: ele é consumido em silêncio.
   *
   * O jogo ainda não consome glifo nenhum, então isto não bloqueia nada. Quando
   * consumir, o caminho é segmentar esta fileira por PROJEÇÃO VERTICAL (os doze
   * ícones são redondos e bem separados na vertical) em vez de por vales.
   */
];

/**
 * Centros das seis colunas, medidos nas pílulas do cabeçalho.
 *
 * A ORDEM É A DA FOLHA, não a de `data/elements.ts`: fogo, raio, gelo, cósmico,
 * químico, normal. Traduzir aqui, uma vez, é o que impede o resto do jogo de
 * ter de saber que a arte foi desenhada noutra ordem — e foi o tipo de detalhe
 * que já custou um recorte inteiro errado noutra folha.
 */
export const COLUNAS = [
  { elemento: 'fogo', centro: 259 },
  { elemento: 'raio', centro: 490 },
  { elemento: 'gelo', centro: 704 },
  { elemento: 'cosmico', centro: 945 },
  { elemento: 'quimico', centro: 1196 },
  { elemento: 'padrao', centro: 1410 },
];

/**
 * Meia-largura da célula.
 *
 * O espaçamento medido entre centros varia de 214 a 251 px; 115 é folgado o
 * bastante para pegar o sprite inteiro com o halo e apertado o bastante para
 * não invadir a coluna vizinha no par mais próximo (gelo → cósmico, 241 px).
 */
export const MEIA_CELULA = 112;

/**
 * ► ESTE RECORTE AINDA NÃO FUNCIONA. As medidas acima estão certas; a EXTRAÇÃO
 *   de alfa não.
 *
 * Duas falhas, ambas observadas numa folha de contato de `estouro`:
 *
 * 1. Os corpos de cada célula continuam FUNDIDOS. A folha tem de dois a seis
 *    sprites por célula e a detecção devolve um. `rowComponents` com piso de
 *    alfa 120 e 205 deu o mesmo resultado.
 * 2. O fundo vira um BLOCO OPACO da cor do elemento, em vez de transparente. É
 *    o un-premultiply de `alphaOverDark` amplificando um fundo escuro TINGIDO —
 *    cada célula tem um leve gradiente na cor do elemento, e o de `sprites.png`
 *    era cinza neutro.
 *
 * O que já está medido e não precisa ser refeito:
 * - fundo da célula tem luminância ~75 (não ~20). `flood: 40` não inundava nada.
 * - com `flood: 88`, a contagem foi de 48 para 54 — melhorou e continua errado.
 *
 * A pista mais forte para a próxima tentativa: o fundo tingido pede extração
 * por CROMA e não por luminância, ou uma subtração do gradiente de fundo por
 * célula antes de inundar. `alphaOverDark` pressupõe fundo neutro.
 */

/**
 * Faixas MEDIDAS À MÃO, para as células que a segmentação não separa.
 *
 * ## Por que existe
 *
 * O aviso de resíduo acima terminava com "não fiz porque exige medir seis
 * larguras à mão e o jogo ainda não consome o atlas". O jogo passou a consumir,
 * e o resíduo virou defeito visível: `faisca/quimico_0` saía com 224×100 — a
 * célula INTEIRA —, e desenhado em modo aditivo no impacto contra a nave virava
 * um quadrado verde ao lado dela. `faisca/gelo_0`, com 209 de largura, tem o
 * mesmo defeito na cor do gelo.
 *
 * ## Por que não deu para consertar por parâmetro
 *
 * Nessas duas células o borrão de fundo é OPACO de ponta a ponta, então subir
 * `alphaNucleo` não separa nada: medido em 170, 200, 220, 235 e 245, as duas
 * continuam devolvendo uma faixa de 224.
 *
 * Exigir núcleo CLARO além de opaco separa as duas — o borrão é opaco e escuro,
 * a faísca é clara —, mas foi medido em todas as 36 células e não serve como
 * regra geral: zera `faisca/raio` e `faisca/cosmico`, e transforma três `feixe`
 * em blocos de 224. Trocar dois defeitos por cinco não é conserto.
 *
 * ## De onde saíram os números
 *
 * Do perfil de núcleo claro (alfa > 200 e luminância > 190) por coluna, com as
 * fronteiras no meio do vão entre aglomerados:
 *
 * - gelo: aglomerados em 16–29, 61–79, 112–135 e 182–195 → quatro faíscas.
 * - quimico: 44–73 e 108–116. O aglomerado em 0–9 é fragmento do vizinho, que a
 *   célula morde por ser recortada com meia-largura fixa, e o de 168–169 tem uma
 *   coluna só de núcleo: ruído, não sprite.
 *
 * Se a folha crua mudar, estes números mentem. `tests/arte-elemental.test.ts`
 * confere as contagens contra o atlas e quebra antes de o jogo pedir um sprite
 * que não existe.
 */
export const FAIXAS_A_MAO = {
  'faisca/gelo': [[0, 45], [45, 95], [95, 158], [158, 224]],
  'faisca/quimico': [[30, 90], [90, 140]],
};

/**
 * Parâmetros de ALFA à mão, para as células de fundo largo.
 *
 * `extrairCelula` estima o fundo no percentil `piso` (20% por padrão) e satura
 * a alfa `margem` acima dele. Funciona quando o fundo é estreito — em
 * `faisca/raio` ele vai de 75 a 103, e os 46 de margem cobrem a folga.
 *
 * Em `faisca/quimico` o fundo vai de 64 a 124: mais largo que a margem, então o
 * borrão inteiro satura e o sprite sai como um retângulo opaco da cor do
 * elemento. Desenhado com mistura aditiva no impacto contra a nave, é o quadrado
 * verde que o jogador viu. `faisca/gelo` tem o mesmo perfil, de 86 a 133.
 *
 * Subir o `piso` para 95% põe a base no TOPO do borrão: o fundo vira alfa zero
 * e só as faíscas — que passam de 199 nas duas células — sobram.
 *
 * Percentis medidos na folha crua, e é por isso que são dois números e não uma
 * regra: as outras 34 células não têm esse perfil, e mexer no padrão para
 * atender a duas quebraria as que já estão certas.
 */
export const ALFA_A_MAO = {
  'faisca/gelo': { piso: 0.95 },
  'faisca/quimico': { piso: 0.95 },
};
