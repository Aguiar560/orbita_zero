/**
 * Extração da folha `tiros e explosoes.png` (§21).
 *
 * Ganhou módulo próprio porque as duas suposições de `imaging.mjs` falham aqui,
 * e as duas falharam de formas que só apareceram na folha de contato:
 *
 * 1. **`alphaOverDark` pressupõe fundo NEUTRO.** O fundo de cada célula desta
 *    folha é escuro mas TINGIDO na cor do elemento, e o un-premultiply divide a
 *    cor por um alfa baixo — o fundo inteiro virava um bloco opaco colorido.
 *    Arte de brilho aditivo sobre escuro não precisa de un-premultiply nenhum.
 * 2. **`rowComponents` separa por limiar ABSOLUTO, e em 1-D.** O halo faz ponte
 *    entre sprites vizinhos, então nem limiar fixo nem vale relativo em projeção
 *    davam conta: dois tiros encostados são um vale raso em 1-D e dois corpos
 *    óbvios em 2-D. A primeira versão daqui era por vales e entregava blocos de
 *    dois e três tiros colados — está no histórico, não vale ressuscitar.
 *
 * E não existe constante global que sirva: medido, o fundo vai de p10 = 12 no
 * cósmico a p10 = 86 no gelo. Tudo aqui é relativo à própria célula.
 */

/**
 * Recorta uma célula e deriva o alfa do quanto cada pixel SOBE acima do fundo
 * local.
 *
 * O fundo é o percentil 20 da própria célula — não a mediana: em células cheias
 * (as explosões grandes ocupam quase tudo) a mediana já é sprite, e o recorte
 * comeria o miolo. O percentil 20 ainda cai no fundo mesmo nessas.
 */
export function extrairCelula(data, info, x0, y0, w, h, { margem = 46, piso = 0.20 } = {}) {
  const { width: W, channels: C } = info;
  const lums = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * C;
      lums[y * w + x] = data[i] * 0.3 + data[i + 1] * 0.6 + data[i + 2] * 0.1;
    }
  }

  const ord = Float32Array.from(lums).sort();
  const base = ord[Math.floor(ord.length * piso)];

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * C;
      const o = (y * w + x) * 4;
      const t = Math.min(1, Math.max(0, (lums[y * w + x] - base) / margem));
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      // Suavização cúbica: um corte duro deixa serrilha visível no halo.
      out[o + 3] = Math.round(t * t * (3 - 2 * t) * 255);
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Segmenta uma célula por COMPONENTES 2-D.
 *
 * Substitui a separação por perfil de coluna, que não dava conta: dois tiros
 * lado a lado cujos halos se tocam são um vale raso em projeção 1-D e dois
 * corpos claramente distintos em 2-D. Medido, a versão 1-D entregava blocos de
 * dois e três tiros colados em `tiro/*`, com lascas vazias no meio.
 *
 * Três passos, e cada um resolve um defeito concreto:
 *
 * 1. **Componentes conexos em alfa ALTO.** O halo é justamente o que gruda os
 *    vizinhos, então a busca ignora o halo e acha só os núcleos brilhantes.
 * 2. **Agrupamento por sobreposição horizontal.** Um sprite só costuma ter
 *    vários núcleos — uma explosão tem o miolo e as fagulhas soltas em volta.
 *    Como os sprites de uma célula estão numa FILEIRA, dois núcleos que ocupam
 *    a mesma faixa de x são do mesmo sprite, e dois que não se sobrepõem são de
 *    sprites diferentes.
 * 3. **Expansão até o meio do caminho.** Recupera o halo que o passo 1 jogou
 *    fora, sem invadir o vizinho.
 */
export function segmentarPorComponentes(cel, {
  alphaNucleo = 170,
  areaMinima = 24,
  minLargura = 10,
  vaoFracao = 0.12,
} = {}) {
  const { width: w, height: h, data } = cel;
  const rotulo = new Int32Array(w * h).fill(-1);
  const caixas = [];
  const fila = new Int32Array(w * h);

  for (let p0 = 0; p0 < w * h; p0++) {
    if (rotulo[p0] >= 0 || data[p0 * 4 + 3] < alphaNucleo) continue;

    const id = caixas.length;
    const caixa = { x0: p0 % w, x1: p0 % w, area: 0 };
    let cabeca = 0;
    let cauda = 0;
    fila[cauda++] = p0;
    rotulo[p0] = id;

    // Fila explícita e não recursão: uma explosão grande passa de dez mil
    // pixels e a versão recursiva estourava a pilha do Node.
    while (cabeca < cauda) {
      const p = fila[cabeca++];
      const x = p % w;
      const y = (p / w) | 0;
      caixa.area++;
      if (x < caixa.x0) caixa.x0 = x;
      if (x > caixa.x1) caixa.x1 = x;

      // Vizinhança de 8: com 4 vizinhos, um traço fino na diagonal — comum nos
      // estilhaços de gelo — vira uma dúzia de componentes soltos.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (rotulo[q] >= 0 || data[q * 4 + 3] < alphaNucleo) continue;
          rotulo[q] = id;
          fila[cauda++] = q;
        }
      }
    }

    caixas.push(caixa);
  }

  const vivas = caixas.filter((c) => c.area >= areaMinima).sort((a, b) => a.x0 - b.x0);
  if (!vivas.length) return [];

  // Passo 2: funde as que partilham faixa de x — ou que estão perto demais.
  //
  // A tolerância de vão existe por causa das fagulhas SOLTAS: uma explosão de
  // gelo espalha estilhaços que não encostam no miolo nem se sobrepõem a ele em
  // x, e sem ela cada estilhaço virava um sprite. Sprites de verdade da mesma
  // célula têm um vão bem maior — é o espaçamento com que a folha foi
  // desenhada —, então a distância separa os dois casos sozinha.
  const vaoMax = Math.round(h * vaoFracao);
  const brutos = [];
  for (const c of vivas) {
    const ultimo = brutos[brutos.length - 1];
    if (ultimo && c.x0 <= ultimo.x1 + vaoMax) {
      ultimo.x1 = Math.max(ultimo.x1, c.x1);
      ultimo.area += c.area;
    } else {
      brutos.push({ x0: c.x0, x1: c.x1, area: c.area });
    }
  }

  /**
   * Descarta os FRAGMENTOS DE VIZINHO.
   *
   * A célula é recortada por meia-largura fixa, então ela morde um pedaço do
   * sprite da coluna ao lado. Esse pedaço tem núcleo próprio e virava um sprite
   * — as lascas de gradiente que apareciam na folha de contato.
   *
   * O critério é relativo ao maior corpo da própria célula, e não absoluto: o
   * tamanho dos sprites varia demais entre categorias para um limiar em pixels.
   * Um fragmento de borda é uma fração do corpo de que foi cortado; um sprite
   * pequeno de verdade — as fagulhas de `faisca` — ainda passa de 10%.
   */
  const maior = brutos.reduce((m, g) => Math.max(m, g.area), 0);
  const grupos = brutos.filter((g) => g.area >= maior * 0.10);
  if (!grupos.length) return [];

  // Passo 3: cada fronteira cai no meio do vão entre grupos vizinhos.
  return grupos
    .map((g, i) => {
      const anterior = grupos[i - 1];
      const proximo = grupos[i + 1];
      const a = anterior ? Math.ceil((anterior.x1 + g.x0) / 2) : 0;
      const z = proximo ? Math.ceil((g.x1 + proximo.x0) / 2) : w;
      return [a, z];
    })
    .filter(([a, z]) => z - a >= minLargura);
}


/**
 * ► RESÍDUO CONHECIDO, conferido em folha de contato.
 *
 * A segmentação acerta a grande maioria dos corpos, e o que sobra é sempre um
 * dos dois casos abaixo. Nenhum deles é aleatório, então dá para conferir à
 * mão o punhado de ids que a Fase 2.7 for consumir de fato.
 *
 * - **Blocos**: em duas ou três células os sprites estão tão juntos que os
 *   núcleos se tocam mesmo em alfa 170, e saem colados (`tiro/padrao`, com três
 *   hastes brancas quase encostadas, é o pior caso).
 * - **Lascas**: sobra alguma faixa fina de gradiente quando o fragmento de
 *   vizinho tem núcleo grande o bastante para passar do corte de 10%.
 *
 * A saída para os dois é a mesma e é barata: `MEIA_CELULA` por coluna, em vez
 * de uma constante, encolhendo a janela nas colunas mais apertadas. Não fiz
 * porque exige medir seis larguras à mão e o jogo ainda não consome o atlas.
 */
