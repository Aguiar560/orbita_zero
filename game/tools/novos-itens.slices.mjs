/**
 * Recorte de `novos itens.png` — 10 categorias × 7 raridades × 2 variantes (§23).
 *
 * A folha é dez painéis numa grade 2 × 5. Cada painel tem um título, uma linha
 * de rótulos de raridade e duas fileiras de sete ícones.
 *
 * **O eixo desta folha é a RARIDADE, não o tier da base.** É a diferença que
 * importa para o resto do jogo: a folha antiga (`Itens.png`) indexava por nível
 * de acabamento, então um Comum e um Divino da mesma base tinham o mesmo ícone.
 * Aqui o Divino tem moldura dourada e desenho próprio, e é isso que faz uma
 * raridade alta ser reconhecida no inventário antes de o jogador ler o nome.
 */

/** As 140 posições são derivadas destas medidas, não escritas à mão. */

/**
 * Centros das sete colunas do painel DIREITO, medidos.
 *
 * O painel esquerdo é o mesmo deslocado — ver `DESLOCAMENTO_ESQUERDO`. Só o
 * direito foi medido porque no esquerdo duas colunas saem fundidas no perfil de
 * luminância: os ícones de Incomum e Raro têm brilho suficiente para encostar.
 */
export const COLUNAS_DIREITA = [666, 750, 831, 908, 997, 1079, 1161];

/**
 * Quanto o painel esquerdo fica à esquerda do direito.
 *
 * Conferido contra as cinco colunas que o perfil separou sozinho no esquerdo:
 * 54, 298, 385, 468 e 551 — todas batem com `direita − 612` dentro de 2 px.
 */
export const DESLOCAMENTO_ESQUERDO = 612;

/** Meia-largura da célula. As colunas distam ~82 px entre centros. */
export const MEIA_CELULA = 36;

/**
 * Faixas verticais das duas fileiras de ícones de cada painel, medidas.
 *
 * A terceira linha de painel saiu fundida no perfil (`[601,746]`) porque os
 * reatores e os sistemas de controle brilham nas bordas das duas fileiras ao
 * mesmo tempo; foi partida no meio, que é onde as outras quatro linhas partem.
 */
export const FILEIRAS = [
  { y: [[87, 163], [167, 243]] },
  { y: [[343, 418], [423, 501]] },
  { y: [[601, 673], [674, 746]] },
  { y: [[846, 919], [923, 995]] },
  { y: [[1096, 1169], [1170, 1248]] },
];

/**
 * As dez categorias, na ordem em que a folha as desenha: linha a linha, e
 * dentro de cada linha primeiro o painel esquerdo, depois o direito.
 *
 * Os nove primeiros ids são os `SlotId` que o jogo já usa — `data/items.ts`
 * depende de que sejam exatamente esses. `upgrade` é a décima categoria do §11
 * e ainda não tem slot: entra no atlas agora e ganha regra na etapa 3.6.
 */
export const CATEGORIAS = [
  { id: 'asas', lado: 'esq', linha: 0 },
  { id: 'principal', lado: 'dir', linha: 0 },
  { id: 'secundaria', lado: 'esq', linha: 1 },
  { id: 'motor', lado: 'dir', linha: 1 },
  { id: 'reator', lado: 'esq', linha: 2 },
  { id: 'controle', lado: 'dir', linha: 2 },
  { id: 'escudo', lado: 'esq', linha: 3 },
  { id: 'blindagem', lado: 'dir', linha: 3 },
  { id: 'suporte', lado: 'esq', linha: 4 },
  { id: 'upgrade', lado: 'dir', linha: 4 },
];

/**
 * A ordem das raridades na folha — a mesma de `data/balance/raridades.ts`.
 *
 * Repetida aqui de propósito: o pipeline roda em Node puro e não importa `src/`,
 * e um teste confere que as duas listas não divergiram. Se alguém reordenar as
 * raridades, o ícone de Divino passaria a sair no Mítico em silêncio.
 */
export const RARIDADES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino'];

/**
 * Recuo aplicado a cada célula.
 *
 * 8 e não 4: com 4 sobravam os CANTOS arredondados da moldura, quatro marcas em
 * L que apareciam como sujeira no canto de cada ícone. A moldura é decoração da
 * folha — no jogo quem desenha a borda de raridade é a UI, que precisa da cor
 * viva mesmo num slot pequeno.
 *
 * O que NÃO sai, e é de propósito: o brilho da placa nas raridades altas. Ele é
 * arte, não fundo — o halo dourado do Divino faz parte do desenho, e tentar
 * removê-lo por percentil só apagava o miolo do ícone.
 */
export const RECUO = 8;

/** As 140 células, prontas para o recorte. */
export function celulas() {
  const out = [];
  for (const cat of CATEGORIAS) {
    const linha = FILEIRAS[cat.linha];
    for (let variante = 0; variante < 2; variante++) {
      const [y0, y1] = linha.y[variante];
      RARIDADES.forEach((raridade, r) => {
        const centro = COLUNAS_DIREITA[r] - (cat.lado === 'esq' ? DESLOCAMENTO_ESQUERDO : 0);
        out.push({
          id: `novo/${cat.id}_${raridade}_${variante}`,
          x: centro - MEIA_CELULA + RECUO,
          y: y0 + RECUO,
          w: MEIA_CELULA * 2 - RECUO * 2,
          h: y1 - y0 - RECUO * 2,
        });
      });
    }
  }
  return out;
}
