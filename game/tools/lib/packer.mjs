/**
 * Empacotador de atlas por skyline (bottom-left). Simples, determinístico e
 * bom o bastante: os sprites do jogo são poucas centenas e o atlas é gerado
 * offline, então não vale a pena um MaxRects completo.
 */

/**
 * @param {{ id: string, w: number, h: number }[]} items
 * @param {{ maxSize?: number, padding?: number }} [opts]
 * @returns {{ width: number, height: number, placements: { id: string, x: number, y: number, w: number, h: number }[] }}
 */
export function packSkyline(items, opts = {}) {
  const padding = opts.padding ?? 1;
  const maxSize = opts.maxSize ?? 4096;

  const boxes = items
    .map((it) => ({ ...it, pw: it.w + padding * 2, ph: it.h + padding * 2 }))
    .sort((a, b) => b.ph - a.ph || b.pw - a.pw);

  const area = boxes.reduce((s, b) => s + b.pw * b.ph, 0);
  let width = nextPow2(Math.max(Math.ceil(Math.sqrt(area * 1.12)), ...boxes.map((b) => b.pw)));

  for (;;) {
    const result = tryPack(boxes, width, maxSize, padding);
    if (result) return result;
    if (width >= maxSize) throw new Error(`atlas não coube em ${maxSize}px`);
    width = Math.min(width * 2, maxSize);
  }
}

function tryPack(boxes, width, maxSize, padding) {
  /** @type {{ x: number, y: number, w: number }[]} */
  const skyline = [{ x: 0, y: 0, w: width }];
  const placements = [];
  let used = 0;

  for (const box of boxes) {
    if (box.pw > width) return null;
    const spot = findSpot(skyline, box.pw, box.ph, width);
    if (!spot || spot.y + box.ph > maxSize) return null;

    placements.push({ id: box.id, x: spot.x + padding, y: spot.y + padding, w: box.w, h: box.h });
    addLevel(skyline, spot.x, spot.y + box.ph, box.pw);
    used = Math.max(used, spot.y + box.ph);
  }

  return { width, height: nextPow2(used), placements };
}

function findSpot(skyline, w, h, width) {
  let best = null;
  for (let i = 0; i < skyline.length; i++) {
    const x = skyline[i].x;
    if (x + w > width) continue;
    // Altura mínima capaz de cobrir todo o intervalo [x, x+w).
    let y = 0;
    let remaining = w;
    for (let j = i; j < skyline.length && remaining > 0; j++) {
      y = Math.max(y, skyline[j].y);
      remaining -= skyline[j].w;
    }
    if (remaining > 0) continue;
    if (!best || y < best.y || (y === best.y && x < best.x)) best = { x, y, i };
  }
  return best ? { x: best.x, y: best.y + h - h } : null;
}

function addLevel(skyline, x, y, w) {
  const node = { x, y, w };
  let idx = skyline.findIndex((n) => n.x >= x);
  if (idx < 0) idx = skyline.length;
  skyline.splice(idx, 0, node);

  // Consome os nós cobertos pelo novo nível.
  for (let i = idx + 1; i < skyline.length; ) {
    const cur = skyline[i];
    const prev = skyline[i - 1];
    const overlap = prev.x + prev.w - cur.x;
    if (overlap <= 0) break;
    if (overlap >= cur.w) {
      skyline.splice(i, 1);
    } else {
      cur.x += overlap;
      cur.w -= overlap;
      break;
    }
  }
  // Funde nós adjacentes de mesma altura.
  for (let i = 0; i < skyline.length - 1; ) {
    if (skyline[i].y === skyline[i + 1].y) {
      skyline[i].w += skyline[i + 1].w;
      skyline.splice(i + 1, 1);
    } else i++;
  }
}

function nextPow2(v) {
  let p = 2;
  while (p < v) p *= 2;
  return p;
}
