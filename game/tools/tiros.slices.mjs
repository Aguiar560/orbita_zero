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
 * O cabeçalho `[7,70]` fica de fora: são as pílulas com o nome do elemento, não
 * sprites. Os ícones (última faixa) ENTRAM — são os glifos que o painel de
 * elementos e os pips de item já pediam e que hoje usam gema de raridade.
 */
export const CATEGORIAS = [
  { id: 'tiro', y: [84, 208], nome: 'tiros do jogador' },
  { id: 'tiroini', y: [226, 328], nome: 'tiros do inimigo' },
  { id: 'carga', y: [340, 436], nome: 'tiros carregados' },
  { id: 'feixe', y: [449, 529], nome: 'raios e feixes' },
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
