import { assets } from '@render/Assets';

type Child = Node | string | number | false | null | undefined;

interface Attrs {
  class?: string;
  text?: string;
  html?: string;
  title?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  dataset?: Record<string, string>;
  disabled?: boolean;
  [key: string]: unknown;
}

/**
 * Construtor de elementos minimalista. Aceita seletor no estilo emmet:
 * `h('button.primary#go', { text: 'Ok' })`.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  selector: K | string,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElement {
  const match = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(selector) ?? [];
  const tag = (match[1] || 'div') as string;
  const el = document.createElement(tag);

  for (const token of (match[2] || '').match(/[.#][\w-]+/g) ?? []) {
    if (token[0] === '#') el.id = token.slice(1);
    else el.classList.add(token.slice(1));
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    switch (key) {
      case 'class':
        el.className = `${el.className} ${value as string}`.trim();
        break;
      case 'text':
        el.textContent = String(value);
        break;

      case 'style':
        if (typeof value === 'string') el.setAttribute('style', value);
        else if (value && typeof value === 'object') {
          // CSSStyleDeclaration não aceita custom properties via Object.assign:
          // `style['--cor'] = valor` é ignorado pelo navegador. Os painéis usam
          // essas variáveis para temas e efeitos dinâmicos, então elas precisam
          // passar explicitamente por setProperty.
          for (const [property, cssValue] of Object.entries(value)) {
            if (property.startsWith('--')) el.style.setProperty(property, String(cssValue));
            else Object.assign(el.style, { [property]: cssValue });
          }
        }
        break;
      case 'dataset':
        Object.assign(el.dataset, value);
        break;
      default:
        if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
        } else if (typeof value === 'boolean') {
          if (value) el.setAttribute(key, '');
        } else {
          el.setAttribute(key, String(value));
        }
    }
  }

  for (const child of children.flat(3) as Child[]) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el: HTMLElement): HTMLElement {
  el.replaceChildren();
  return el;
}

/**
 * Renderiza um sprite do atlas como elemento DOM.
 *
 * Usa `background-position` com escala, então o ícone é o pixel-art real do
 * jogo — nada de duplicar arte em SVG só para a interface.
 */
export function spriteIcon(id: string, size = 32, extraClass = ''): HTMLElement {
  // `extraClass` entra por `classList`, não concatenado no seletor: o parser de
  // `h()` só aceita `tag.classe#id` sem espaços, e um seletor com espaço falhava
  // em silêncio — o elemento saía como `<div>` sem classe nenhuma, e por isso
  // modificadores como `dim` e `silhouette` nunca surtiam efeito.
  const el = h('i.sprite', { dataset: { sprite: id } });
  for (const cls of extraClass.split(/\s+/)) {
    if (cls) el.classList.add(cls);
  }
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;

  const found = assets.atlases.lookup(id);
  if (!found) return el;

  const { frame, atlas } = found;
  // Encaixa o quadro na caixa mantendo proporção e o pivô da caixa original.
  const scale = Math.min(size / frame.sw, size / frame.sh);
  const w = frame.w * scale;
  const hgt = frame.h * scale;

  // A URL vem da imagem JÁ CARREGADA, não montada com o nome mais uma
  // extensão fixa: o formato do atlas é decisão do pipeline, e fixar `.png`
  // aqui obrigaria a lembrar deste arquivo ao trocá-lo.
  el.style.backgroundImage = `url(${(atlas.image as HTMLImageElement).src})`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  el.style.backgroundSize = `${(atlas.image as HTMLImageElement).width * scale}px ${(atlas.image as HTMLImageElement).height * scale}px`;
  el.style.backgroundPosition = `${-frame.x * scale + (size - w) / 2}px ${-frame.y * scale + (size - hgt) / 2}px`;

  // Recorta na borda do QUADRO, não na da caixa.
  //
  // O elemento é uma janela de `size × size` sobre o atlas inteiro, e o quadro
  // desenhado quase nunca preenche essa janela: a escala encaixa a caixa
  // ORIGINAL do sprite (`sw × sh`), enquanto o que se desenha é o recorte
  // aparado (`w × h`), que é menor. A sobra não fica vazia — ela mostra o que
  // estiver ao lado no atlas.
  //
  // Medido em `void/nave/casco_cheio`: quadro de 30×26 numa caixa de 48×48,
  // pedido a 62px. O desenho sai 38,8×33,6 numa janela de 62, deixando 11px de
  // vizinho visível de cada lado — e o empacotador separa os sprites por apenas
  // 1px de padding. Era por isso que apareciam armas em volta das naves no
  // Hangar e fragmentos de outro recurso no Criogás.
  //
  // `inset` resolve sem tocar no DOM nem no empacotador: aumentar o padding do
  // atlas não adiantaria, porque a janela é larga o bastante para alcançar o
  // vizinho seguinte de qualquer jeito.
  const recorteX = Math.max(0, (size - w) / 2);
  const recorteY = Math.max(0, (size - hgt) / 2);
  if (recorteX > 0.01 || recorteY > 0.01) {
    el.style.clipPath = `inset(${recorteY}px ${recorteX}px)`;
  }
  return el;
}

/**
 * Retrato enquadrado: diferente de um ícone, ocupa uma moldura retangular e
 * preserva toda a silhueta. Usa `contain` e ancora a arte na base da foto:
 * antenas, ombros e acessórios não são cortados, mas o retrato continua com
 * leitura vertical e sem parecer que o busto está flutuando.
 */
export function portraitIcon(id: string, width: number, height: number, extraClass = ''): HTMLElement {
  const el = h('i.sprite.portrait', { dataset: { sprite: id } });
  for (const cls of extraClass.split(/\s+/)) if (cls) el.classList.add(cls);
  const found = assets.atlases.lookup(id);
  if (!found) {
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    return el;
  }

  const { frame, atlas } = found;
  // PREENCHE a foto, em vez de caber dentro dela.
  //
  // Era `min` — "contain" —, e o resultado media 72×76 numa foto de 72×96:
  // sobravam 19px mortos em cima e o retrato ficava colado na base, com a
  // cabeça baixa e o rosto pequeno. Numa moldura com borda isso não lê como
  // "arte inteira preservada", lê como foto mal recortada.
  //
  // Com `max` a arte cobre a foto e o excesso sai pelos lados e pela base —
  // que é exatamente onde um retrato pode perder pixel sem perder informação.
  // Ancorar no TOPO é o que garante o enquadramento: o rosto fica no terço
  // superior e o corte cai no busto, como em retrato de verdade.
  const scale = Math.max(width / frame.w, height / frame.h);
  const w = frame.w * scale;
  const hgt = frame.h * scale;
  // O elemento tem exatamente o tamanho do DESENHO. O PAI é que cria a foto e
  // faz o recorte. Dar ao elemento o tamanho da foto deixava as margens
  // transparentes amostrarem o sprite vizinho do atlas.
  el.style.width = `${w}px`;
  el.style.height = `${hgt}px`;
  // A URL vem da imagem JÁ CARREGADA, não montada com o nome mais uma
  // extensão fixa: o formato do atlas é decisão do pipeline, e fixar `.png`
  // aqui obrigaria a lembrar deste arquivo ao trocá-lo.
  el.style.backgroundImage = `url(${(atlas.image as HTMLImageElement).src})`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  el.style.backgroundSize = `${(atlas.image as HTMLImageElement).width * scale}px ${(atlas.image as HTMLImageElement).height * scale}px`;
  el.style.backgroundPosition = `${-frame.x * scale}px ${-frame.y * scale}px`;
  return el;
}

/** Barra de progresso simples. `value` em 0..1. */
export function progressBar(value: number, color: string, height = 6): HTMLElement {
  const fill = h('.bar-fill');
  fill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  fill.style.background = color;
  const bar = h('.bar', {}, fill);
  bar.style.height = `${height}px`;
  return bar;
}

export function button(label: string, onClick: () => void, opts: { class?: string; disabled?: boolean; icon?: string } = {}): HTMLElement {
  const el = h(`button.btn ${opts.class ?? ''}`.trim(), { onclick: onClick, disabled: opts.disabled });
  if (opts.icon) el.append(spriteIcon(opts.icon, 18));
  el.append(h('span', { text: label }));
  return el;
}
