import sharp from 'sharp';
import path from 'node:path';

/**
 * Todo caminho de arquivo que o pipeline chegou a abrir.
 *
 * Serve para a auditoria (`npm run assets:audit`) separar a arte que virou
 * sprite da que ficou parada nas pastas — sem isso a única forma de saber
 * seria reimplementar a lógica de seleção do pipeline, que muda toda hora.
 */
export const readPaths = new Set();

/** Registra um caminho lido. Chame para leituras que não passam por `toRaw`. */
export function noteRead(file) {
  if (typeof file === 'string') readPaths.add(path.resolve(file));
}

/**
 * Buffer RGBA cru + dimensões. É a moeda de troca entre todas as funções aqui.
 * @typedef {{ data: Buffer, width: number, height: number }} Raw
 */

/** @returns {Promise<Raw>} */
export async function toRaw(input) {
  noteRead(input);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** @param {Raw} raw */
export function rawToSharp(raw) {
  return sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } });
}

/**
 * Remove a matte sólida de uma folha de sprites e recupera a cor original.
 *
 * A folha foi achatada sobre uma cor de fundo `bg`, ou seja cada pixel vale
 * `out = src*a + bg*(1-a)`. Estimamos `a` pela distância até `bg` e então
 * desfazemos a composição (`src = (out - bg*(1-a)) / a`). Sem esse passo os
 * sprites ficam com halo escuro nas bordas quando desenhados sobre o espaço.
 *
 * @param {Raw} raw
 * @param {{ r: number, g: number, b: number }} bg
 * @param {'solid'|'glow'} mode
 * @returns {Raw}
 */
export function unmatte(raw, bg, mode = 'solid') {
  const { data, width, height } = raw;
  const out = Buffer.allocUnsafe(data.length);
  // 'solid' quer alpha quase binário (bordas de pixel-art são duras);
  // 'glow' quer alpha proporcional ao brilho, para o rastro sumir suavemente.
  const lo = mode === 'glow' ? 6 : 26;
  const hi = mode === 'glow' ? 150 : 54;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);

    let a = (dist - lo) / (hi - lo);
    a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a); // smoothstep

    if (a <= 0.004) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    const inv = 1 - a;
    out[i] = clamp255((r - bg.r * inv) / a);
    out[i + 1] = clamp255((g - bg.g * inv) / a);
    out[i + 2] = clamp255((b - bg.b * inv) / a);
    out[i + 3] = Math.round(a * 255);
  }
  return { data: out, width, height };
}

/**
 * Extrai alfa de uma folha achatada sobre fundo PRETO.
 *
 * `unmatte` não serve aqui: ele deduz o alfa da distância até a cor de fundo, e
 * num fundo preto a lateral escura de um planeta fica indistinguível do vazio —
 * o resultado eram esferas furadas. Este caminho separa vazio de miolo por
 * TOPOLOGIA, não por brilho: um preenchimento a partir das bordas atravessa
 * pixels escuros e marca o que é exterior; tudo que ficou cercado por pixel
 * aceso é corpo do sprite e sai opaco. Sobra o halo — que é exterior e aceso —,
 * e só ele recebe alfa proporcional ao brilho, com a cor desmultiplicada para o
 * brilho não escurecer nas pontas.
 *
 * @param {Raw} raw
 * @param {{ flood?: number, lo?: number, hi?: number }} [opts]
 *        `flood` = brilho máximo que o preenchimento consegue atravessar.
 * @returns {Raw}
 */
export function alphaOverDark(raw, opts = {}) {
  const flood = opts.flood ?? 60;
  const lo = opts.lo ?? 5;
  const hi = opts.hi ?? 64;
  const { data, width, height } = raw;
  const n = width * height;

  const lum = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const v = data[i] > data[i + 1] ? data[i] : data[i + 1];
    lum[p] = v > data[i + 2] ? v : data[i + 2];
  }

  const exterior = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p) => {
    if (!exterior[p] && lum[p] <= flood) {
      exterior[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < n - width) push(p + width);
  }

  const out = Buffer.allocUnsafe(data.length);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!exterior[p]) {
      out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; out[i + 3] = 255;
      continue;
    }
    let a = (lum[p] - lo) / (hi - lo);
    a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
    if (a <= 0.004) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    // Desmultiplica: sobre preto a folha guarda `src*a`.
    out[i] = clamp255(data[i] / a);
    out[i + 1] = clamp255(data[i + 1] / a);
    out[i + 2] = clamp255(data[i + 2] / a);
    out[i + 3] = Math.round(a * 255);
  }
  return { data: out, width, height };
}

/**
 * Puxa um recorte para o branco, preservando o brilho.
 *
 * Existe por causa do tiro "padrão": a folha não traz projétil branco, e o
 * elemento neutro não pode herdar a cor de outro. Dessaturar o dourado dá o
 * projétil neutro sem redesenhar arte.
 *
 * @param {Raw} raw
 * @param {number} amount 0 = intocado, 1 = cinza puro
 */
export function desaturate(raw, amount = 1) {
  const out = Buffer.from(raw.data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const l = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
    out[i] = clamp255(out[i] + (l - out[i]) * amount);
    out[i + 1] = clamp255(out[i + 1] + (l - out[i + 1]) * amount);
    out[i + 2] = clamp255(out[i + 2] + (l - out[i + 2]) * amount);
  }
  return { data: out, width: raw.width, height: raw.height };
}

/**
 * Recorta as bordas totalmente transparentes.
 * @param {Raw} raw
 * @param {number} alphaFloor alpha abaixo disso conta como vazio (mata poeira de glow)
 * @returns {{ raw: Raw, ox: number, oy: number } | null} null se a imagem for vazia
 */
export function trimAlpha(raw, alphaFloor = 4) {
  const { data, width, height } = raw;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > alphaFloor) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = Buffer.allocUnsafe(w * h * 4);
  for (let y = 0; y < h; y++) {
    data.copy(out, y * w * 4, ((y + y0) * width + x0) * 4, ((y + y0) * width + x0 + w) * 4);
  }
  return { raw: { data: out, width: w, height: h }, ox: x0, oy: y0 };
}

/**
 * Recorta uma região de um Raw maior. Regiões fora dos limites são clampadas.
 * @param {Raw} raw
 */
export function crop(raw, x, y, w, h) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(raw.width, x + w), y1 = Math.min(raw.height, y + h);
  const cw = Math.max(0, x1 - x0), ch = Math.max(0, y1 - y0);
  const out = Buffer.alloc(cw * ch * 4);
  for (let row = 0; row < ch; row++) {
    raw.data.copy(out, row * cw * 4, ((row + y0) * raw.width + x0) * 4, ((row + y0) * raw.width + x1) * 4);
  }
  return { data: out, width: cw, height: ch };
}

/** Cola `src` dentro de `dst` em (dx,dy). Sobrescreve (sem blend) — o destino é vazio. */
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    src.data.copy(dst.data, (ty * dst.width + dx) * 4, y * src.width * 4, (y + 1) * src.width * 4);
  }
}

/** @returns {Raw} */
export function blank(width, height) {
  return { data: Buffer.alloc(width * height * 4), width, height };
}

/**
 * Fatia uma folha em sprites detectando colunas vazias dentro de cada faixa.
 *
 * Existe porque várias folhas não são grades regulares: os quadros de explosão
 * crescem, os asteroides vêm em três tamanhos e as naves inimigas ficam menores
 * da esquerda para a direita. Uma grade fixa cortaria os grandes e deixaria os
 * pequenos boiando fora do centro.
 *
 * @param {Raw} raw
 * @param {{ y0: number, y1: number, name: string }[]} bands faixas horizontais
 * @param {{ gap?: number, alphaFloor?: number, minWidth?: number }} [opts]
 *        `gap` = quantas colunas vazias seguidas encerram um sprite.
 * @returns {{ name: string, index: number, x: number, y: number, w: number, h: number }[]}
 */
export function rowComponents(raw, bands, opts = {}) {
  const gap = opts.gap ?? 3;
  const alphaFloor = opts.alphaFloor ?? 8;
  const minWidth = opts.minWidth ?? 3;
  const { data, width } = raw;
  const out = [];

  for (const band of bands) {
    const y0 = Math.max(0, band.y0);
    const y1 = Math.min(raw.height, band.y1);

    /** Uma coluna "conta" se tiver qualquer pixel visível dentro da faixa. */
    const filled = new Array(width).fill(false);
    for (let x = 0; x < width; x++) {
      for (let y = y0; y < y1; y++) {
        if (data[(y * width + x) * 4 + 3] > alphaFloor) {
          filled[x] = true;
          break;
        }
      }
    }

    let index = 0;
    let x = 0;
    while (x < width) {
      if (!filled[x]) {
        x++;
        continue;
      }
      const start = x;
      let empty = 0;
      while (x < width && empty < gap) {
        x++;
        empty = filled[x] ? 0 : empty + 1;
      }
      const end = x - empty;
      if (end - start >= minWidth) {
        out.push({ name: band.name, index: index++, x: start, y: y0, w: end - start, h: y1 - y0 });
      }
    }
  }
  return out;
}

/**
 * Detecção de colunas com contagem conhecida.
 *
 * As duas folhas novas (`planetas.png`, `sprites.png`) têm fileiras de itens em
 * passo IRREGULAR — uma grade fixa corta os grandes —, mas o halo às vezes cola
 * dois vizinhos num componente só. Como sabemos quantos itens cada fileira tem,
 * dá para reconciliar: sobrando, ficam os mais largos; faltando, o mais largo é
 * partido ao meio até fechar a conta.
 *
 * @param {Raw} raw faixa já com alfa
 * @param {number} expected quantos sprites a fileira contém
 * @param {{ gap?: number, alphaFloor?: number, minWidth?: number }} [opts]
 * @returns {{ x: number, w: number }[]} da esquerda para a direita
 */
export function sliceRow(raw, expected, opts = {}) {
  const parts = rowComponents(raw, [{ y0: 0, y1: raw.height, name: 'x' }], {
    gap: opts.gap ?? 4,
    alphaFloor: opts.alphaFloor ?? 12,
    minWidth: opts.minWidth ?? 6,
  }).map((c) => ({ x: c.x, w: c.w }));
  const detected = parts.length;

  if (parts.length > expected) {
    parts.sort((a, b) => b.w - a.w);
    parts.length = expected;
    parts.sort((a, b) => a.x - b.x);
  }
  while (parts.length && parts.length < expected) {
    let widest = 0;
    for (let i = 1; i < parts.length; i++) if (parts[i].w > parts[widest].w) widest = i;
    const p = parts[widest];
    const half = Math.floor(p.w / 2);
    parts.splice(widest, 1, { x: p.x, w: half }, { x: p.x + half, w: p.w - half });
  }
  // O chamador precisa saber que houve reconciliação: partir ao meio acerta a
  // contagem mas não acerta o corte, e o sintoma (sprite cortado no talo) só
  // aparece muito depois, olhando o atlas.
  parts.detected = detected;
  return parts;
}

/**
 * Estica cada coluna até o meio do vão para o vizinho.
 *
 * Anda junto com `sliceRow` num piso de alfa alto: detectar só o CORPO opaco é
 * o que separa dois planetas cujos halos se tocam, mas recortar no corpo
 * decepa o halo. Esticar depois devolve o brilho sem reencostar um no outro.
 *
 * @param {{ x: number, w: number }[]} cols
 * @param {number} width largura da faixa
 * @param {number} [margem] folga máxima em cada lado
 */
export function expandToNeighbours(cols, width, margem = 1e9) {
  return cols.map((c, i) => {
    const prev = cols[i - 1];
    const next = cols[i + 1];
    const left = prev ? Math.ceil((prev.x + prev.w + c.x) / 2) : 0;
    const right = next ? Math.floor((c.x + c.w + next.x) / 2) : width;
    const x = Math.max(0, Math.max(left, c.x - margem));
    return { x, w: Math.min(width, Math.min(right, c.x + c.w + margem)) - x };
  });
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Cortes de uma fileira onde ela é mais ESCURA, não onde a régua manda.
 *
 * Alguns blocos da folha de planetas (anéis, nebulosas) têm corpos que se
 * tocam pelo halo: `sliceRow` não os separa em componente nenhum, nem com piso
 * de alfa em 245. A divisão em partes iguais era o recurso, e ela cortava —
 * medido em `anel`, o passo caía nas colunas 147 e 295, de brilho 18 e 30,
 * enquanto os vales reais estavam em 177 e 310, de brilho 5 e 10. O corte
 * passava por cima da galáxia e ainda levava um pedaço da vizinha junto.
 *
 * Aqui a régua vira PALPITE: procura-se a coluna mais escura numa janela ao
 * redor de cada divisa nominal. Se a arte estiver mesmo regular, o vale cai em
 * cima do passo e nada muda; se estiver torta, o corte acompanha.
 *
 * @param {Raw} raw faixa já com alfa
 * @param {number} n quantos corpos
 * @param {number} [fracaoDaJanela] quanto do passo se pode andar para cada lado
 * @returns {number[]} n+1 posições, de 0 a `raw.width`
 */
export function cortesPorVale(raw, n, fracaoDaJanela = 0.4) {
  const { data, width, height } = raw;
  const brilho = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let soma = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      // Pondera pelo alfa: uma coluna opaca e escura é fundo, não vão.
      soma += Math.max(data[i], data[i + 1], data[i + 2]) * (data[i + 3] / 255);
    }
    brilho[x] = soma / height;
  }

  const passo = width / n;
  const janela = Math.max(1, Math.round(passo * fracaoDaJanela));
  const cortes = [0];
  for (let k = 1; k < n; k++) {
    const alvo = Math.round(k * passo);
    let melhor = alvo;
    let menor = Infinity;
    const de = Math.max(cortes[k - 1] + 1, alvo - janela);
    const ate = Math.min(width - 1, alvo + janela);
    for (let x = de; x <= ate; x++) {
      if (brilho[x] < menor) { menor = brilho[x]; melhor = x; }
    }
    cortes.push(melhor);
  }
  cortes.push(width);
  return cortes;
}
