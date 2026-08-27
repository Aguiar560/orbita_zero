/**
 * Remove fundo chapado de uma arte, por preenchimento a partir da BORDA.
 *
 * ## Por que não basta apagar pixel claro
 *
 * O jeito óbvio — "todo pixel quase branco vira transparente" — fura a nave.
 * Estas artes têm cabine prateada, brilho especular e detalhe branco no casco,
 * e nenhum deles é fundo. Uma passada por cor deixaria buracos exatamente nas
 * partes mais bonitas.
 *
 * O preenchimento resolve porque usa CONECTIVIDADE, não só cor: só some o que
 * é claro E alcançável desde a borda sem atravessar a nave. Prata cercada de
 * casco fica.
 *
 * ## A tolerância
 *
 * Os fundos medidos variam de 245 a 255 em cada canal — não são um branco só,
 * porque saíram de geração de imagem e têm ruído. A tolerância é sobre a
 * distância até a cor do canto, e não um limiar absoluto de claridade: assim a
 * mesma função serve para um fundo bege ou cinza sem virar outro caso.
 */

/**
 * @param {{data: Buffer, width: number, height: number}} raw  RGBA
 * @param {number} tolerancia  distância máxima por canal até a cor da borda
 * @returns {number} quantos pixels foram apagados
 */
export function removerFundoChapado(raw, tolerancia = 26) {
  const { data, width: w, height: h } = raw;
  const idx = (x, y) => (y * w + x) * 4;

  // A cor de referência é a MEDIANA dos quatro cantos, não a de um só: um canto
  // pode calhar de ter um pedaço de nave ou uma sombra, e ancorar tudo nele
  // faria a função apagar a coisa errada.
  const cantos = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
    .map(([x, y]) => idx(x, y))
    .filter((i) => data[i + 3] > 200);
  if (!cantos.length) return 0;

  const canal = (c) => {
    const vs = cantos.map((i) => data[i + c]).sort((a, b) => a - b);
    return vs[Math.floor(vs.length / 2)];
  };
  const [fr, fg, fb] = [canal(0), canal(1), canal(2)];

  const parecido = (i) =>
    Math.abs(data[i] - fr) <= tolerancia
    && Math.abs(data[i + 1] - fg) <= tolerancia
    && Math.abs(data[i + 2] - fb) <= tolerancia;

  // Fila explícita, não recursão: uma arte de 1024² tem um milhão de pixels, e
  // recursão estoura a pilha muito antes disso.
  const visto = new Uint8Array(w * h);
  const fila = [];
  const enfileirar = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visto[p]) return;
    visto[p] = 1;
    if (data[p * 4 + 3] < 8) return;   // já transparente: atravessa sem apagar
    if (!parecido(p * 4)) return;      // chegou na nave: para
    fila.push(p);
  };

  for (let x = 0; x < w; x++) { enfileirar(x, 0); enfileirar(x, h - 1); }
  for (let y = 0; y < h; y++) { enfileirar(0, y); enfileirar(w - 1, y); }

  let apagados = 0;
  while (fila.length) {
    const p = fila.pop();
    data[p * 4 + 3] = 0;
    apagados++;
    const x = p % w;
    const y = (p / w) | 0;
    enfileirar(x + 1, y); enfileirar(x - 1, y);
    enfileirar(x, y + 1); enfileirar(x, y - 1);
  }
  return apagados;
}
