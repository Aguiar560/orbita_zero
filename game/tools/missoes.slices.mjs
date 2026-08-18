/**
 * Recorte de `missoes 3.png` — as peças da Central de Contratos (§27).
 *
 * As posições saíram de DETECÇÃO por componentes conexos sobre o alfa, com
 * núcleo em 150 para o halo de brilho não colar peças vizinhas. Quarenta
 * componentes, exatamente as quarenta peças pedidas — a IA respeitou o vão de
 * 40 px que a especificação exigia, o que na chapa da Fabricação não aconteceu.
 *
 * `slice` é a margem de 9-slice ou 3-slice em pixels DA ARTE; o CSS a converte
 * para `border-image-slice`. Só as peças que esticam precisam dela, e o valor
 * tem de conter o ornamento de canto INTEIRO: cortar no meio joga o pedaço que
 * sobra na faixa que estica, e o desenho se alonga.
 */

export const MISSOES_SHEET = 'missoes 3.png';

export const PECAS_MISSOES = [
  // ── molduras e painéis ────────────────────────────────────────────────────
  {
    id: 'mis_moldura', x: 16, y: 9, w: 862, h: 503,
    slice: 80,
    nota: 'Moldura do modal. Cantos com nó circular e colchete âmbar.',
  },
  {
    id: 'mis_painel_col', x: 892, y: 12, w: 181, h: 483,
    slice: 44,
    nota: 'Coluna lateral, estreita e alta.',
  },
  {
    id: 'mis_ficha', x: 1087, y: 15, w: 437, h: 215,
    slice: 48,
    nota: 'Painel da ficha do personagem.',
  },
  {
    id: 'mis_confianca', x: 1091, y: 241, w: 428, h: 75,
    // 32 e não mais: a peça tem 75 px de altura, e 2 × 38 já consumiria tudo.
    slice: 32,
    nota: 'Caixa da escada de confiança, com nó circular nas pontas.',
  },

  // ── abas e botões ─────────────────────────────────────────────────────────
  //
  // A IA entregou UM par de barras alongadas em vez de dois (abas e botões).
  // São a mesma família de forma, então servem aos dois usos — o que se perde é
  // a distinção entre aba e botão, que a cor do texto já dá.
  {
    id: 'mis_aba', x: 1094, y: 332, w: 274, h: 50,
    slice: 46,
    nota: 'Barra angular apagada. Serve de aba e de botão.',
  },
  {
    id: 'mis_aba_ativa', x: 1092, y: 395, w: 276, h: 53,
    slice: 46,
    nota: 'Barra acesa.',
  },
  { id: 'mis_cont_cyan', x: 1399, y: 327, w: 109, h: 46, slice: 24, nota: 'Cápsula de contador, cyan.' },
  { id: 'mis_cont_verde', x: 1399, y: 380, w: 109, h: 48, slice: 24, nota: 'Cápsula verde.' },
  { id: 'mis_cont_ambar', x: 1399, y: 435, w: 109, h: 50, slice: 24, nota: 'Cápsula âmbar.' },

  // ── cards ─────────────────────────────────────────────────────────────────
  {
    id: 'mis_card_contato', x: 13, y: 529, w: 395, h: 100,
    slice: 32,
    nota: 'Linha de contato, apagada.',
  },
  {
    id: 'mis_card_contato_sel', x: 14, y: 638, w: 394, h: 101,
    slice: 32,
    nota: 'Linha de contato selecionada, com barra à esquerda.',
  },
  {
    id: 'mis_card', x: 439, y: 526, w: 592, h: 131,
    slice: 42,
    nota: 'Card de missão. Borda BRANCA, para ser tingida pela cor do tipo.',
  },
  {
    id: 'mis_card_especial', x: 428, y: 670, w: 610, h: 135,
    slice: 50,
    nota: 'Contrato especial. Nasce dourado — não é tingido.',
  },
  {
    id: 'mis_moldura_item', x: 14, y: 820, w: 152, h: 152,
    slice: 36,
    nota: 'Moldura da recompensa exclusiva.',
  },

  // ── nós, fios e ícones ────────────────────────────────────────────────────
  // Sem `slice`: escalam inteiros, não esticam.
  { id: 'mis_no', x: 1073, y: 488, w: 95, h: 108, nota: 'Nó de confiança apagado.' },
  { id: 'mis_no_aberto', x: 1192, y: 488, w: 94, h: 108, nota: 'Nó aceso.' },
  { id: 'mis_no_travado', x: 1311, y: 488, w: 94, h: 108, nota: 'Nó com cadeado.' },
  { id: 'mis_fio', x: 1069, y: 613, w: 192, h: 13, slice: 6, nota: 'Ligação apagada.' },
  { id: 'mis_fio_aceso', x: 1292, y: 613, w: 190, h: 13, slice: 6, nota: 'Ligação acesa.' },

  { id: 'mis_tipo_principal', x: 1061, y: 641, w: 96, h: 103, nota: 'Mira concêntrica, cyan.' },
  { id: 'mis_tipo_aliado', x: 1175, y: 641, w: 97, h: 99, nota: 'Duas silhuetas, roxo.' },
  { id: 'mis_tipo_galaxia', x: 1289, y: 641, w: 98, h: 99, nota: 'Espiral, vermelho.' },
  { id: 'mis_tipo_especial', x: 1405, y: 641, w: 97, h: 103, nota: 'Losango facetado, âmbar.' },

  { id: 'mis_sinal_nova', x: 1124, y: 749, w: 78, h: 78, nota: 'Exclamação âmbar.' },
  { id: 'mis_sinal_pronta', x: 1215, y: 755, w: 69, h: 69, nota: 'Tique verde.' },
  { id: 'mis_sinal_especial', x: 1297, y: 755, w: 69, h: 70, nota: 'Losango âmbar.' },
  { id: 'mis_sinal_travado', x: 1383, y: 752, w: 58, h: 68, nota: 'Cadeado.' },

  // ── recompensas ───────────────────────────────────────────────────────────
  //
  // A ordem da fileira é a da especificação, da esquerda para a direita. Vale
  // conferir contra a imagem antes de confiar: trocar dois ícones aqui não
  // quebra nada, só faz a tela mentir sobre o que ela paga.
  { id: 'rec_xp', x: 195, y: 848, w: 92, h: 94, nota: 'Cristal de experiência, cyan.' },
  { id: 'rec_sucata', x: 293, y: 848, w: 92, h: 98, nota: 'Placas de sucata.' },
  { id: 'rec_nucleo', x: 391, y: 847, w: 93, h: 99, nota: 'Núcleo esférico, cyan.' },
  { id: 'rec_cristal', x: 496, y: 847, w: 92, h: 99, nota: 'Cristal facetado, roxo.' },
  { id: 'rec_recurso', x: 592, y: 847, w: 92, h: 99, nota: 'Cubo de minério, roxo.' },
  { id: 'rec_item', x: 692, y: 847, w: 94, h: 100, nota: 'Peça de equipamento.' },
  { id: 'rec_bau', x: 792, y: 847, w: 92, h: 100, nota: 'Baú âmbar.' },
  { id: 'rec_medalha', x: 892, y: 847, w: 93, h: 100, nota: 'Medalha hexagonal, âmbar.' },
  { id: 'rec_blueprint', x: 991, y: 848, w: 93, h: 98, nota: 'Esquema técnico.' },
  { id: 'rec_confianca', x: 1089, y: 847, w: 95, h: 99, nota: 'Elos entrelaçados, roxo.' },
  { id: 'rec_espaco', x: 1192, y: 847, w: 94, h: 99, nota: 'Contêiner de carga, verde.' },
  { id: 'rec_exclusivo', x: 1294, y: 847, w: 94, h: 99, nota: 'Estrela de quatro pontas, âmbar.' },
  {
    id: 'rec_moldura', x: 1401, y: 844, w: 110, h: 111,
    slice: 28,
    nota: 'Encaixe vazio de recompensa. Borda branca, para ser tingida.',
  },
];
