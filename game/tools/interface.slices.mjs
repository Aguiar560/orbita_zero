/**
 * Recorte de `fabricação 2.png` — as peças de interface do §25.
 *
 * A folha veio de uma IA de imagem, a partir da especificação em
 * `docs/ARTE-UI-FABRICACAO.md`: nove peças numa chapa, com alfa de verdade e
 * sem texto gravado — que era a condição para elas servirem às seis receitas,
 * que têm de 3 a 10 encaixes.
 *
 * As posições saíram de DETECÇÃO por componentes conexos sobre o alfa, não de
 * régua: a IA não respeitou a grade que eu pedi, e medir é mais barato que
 * negociar com ela.
 */

export const INTERFACE_SHEET = 'fabricação 2.png';

/**
 * As peças, na ordem em que a detecção as encontrou (de cima para baixo, da
 * esquerda para a direita).
 *
 * `slice` é a margem de 9-slice ou 3-slice em pixels DA ARTE — o CSS a converte
 * para `border-image-slice`. Só as peças que esticam precisam dela.
 */
export const PECAS = [
  {
    id: 'moldura_modal', x: 24, y: 9, w: 620, h: 596,
    slice: 74,
    nota: 'Moldura do modal. Estica de 620 para até 1180 px, então a margem é '
      + 'generosa: o canto ornamentado inteiro precisa caber dentro dela.',
  },
  {
    id: 'placa_titulo', x: 737, y: 10, w: 746, h: 93,
    slice: 120,
    nota: 'Placa de título, 3-slice horizontal. As pontas com seta são fixas.',
  },
  {
    id: 'anel_fundo', x: 704, y: 112, w: 541, h: 539,
    nota: 'Disco do reator, com furo central. Não estica — escala inteiro.',
  },
  {
    id: 'encaixe_vazio', x: 1281, y: 142, w: 223, h: 223,
    nota: 'Soquete apagado.',
  },
  {
    id: 'encaixe_cheio', x: 1281, y: 392, w: 223, h: 229,
    nota: 'Soquete aceso. Mesma silhueta do vazio.',
  },
  {
    id: 'nucleo_hex', x: 36, y: 608, w: 323, h: 362,
    nota: 'Hexágono do núcleo, vazio por dentro.',
  },
  {
    id: 'painel_secao', x: 430, y: 634, w: 325, h: 315,
    slice: 46,
    nota: 'Moldura discreta das colunas laterais.',
  },
  {
    id: 'botao', x: 809, y: 688, w: 398, h: 116,
    slice: 58,
    nota: 'Botão apagado, 3-slice horizontal.',
  },
  {
    id: 'celula_item', x: 1267, y: 689, w: 231, h: 227,
    slice: 40,
    nota: 'Célula de inventário. Borda clara, para ser tingida pela raridade.',
  },
  {
    id: 'botao_ativo', x: 808, y: 816, w: 399, h: 120,
    slice: 58,
    nota: 'Botão aceso.',
  },
];
