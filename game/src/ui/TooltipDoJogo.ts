const ID_TOOLTIP = 'tooltip-do-jogo';
const SELETOR = '[data-game-tip]';
const MARGEM = 8;
const DISTANCIA = 10;

let instalado = false;
let tooltip: HTMLElement | null = null;
let alvoDoMouse: HTMLElement | null = null;
let alvoDoFoco: HTMLElement | null = null;

function alvoDe(origem: EventTarget | null): HTMLElement | null {
  return origem instanceof Element ? origem.closest<HTMLElement>(SELETOR) : null;
}

function migrarTitle(elemento: Element): void {
  const texto = elemento.getAttribute('title');
  if (texto === null) return;
  if (!elemento.hasAttribute('data-game-tip')) elemento.setAttribute('data-game-tip', texto);
  elemento.removeAttribute('title');
}

function migrarArvore(no: Node): void {
  if (!(no instanceof Element)) return;
  migrarTitle(no);
  no.querySelectorAll('[title]').forEach(migrarTitle);
}

function criarTooltip(): HTMLElement {
  const el = document.createElement('div');
  el.id = ID_TOOLTIP;
  el.className = 'game-tooltip hidden';
  el.setAttribute('role', 'tooltip');
  document.body.append(el);
  return el;
}

function posicionar(alvo: HTMLElement): void {
  if (!tooltip) return;
  const ancora = alvo.getBoundingClientRect();
  const largura = tooltip.offsetWidth || 260;
  const altura = tooltip.offsetHeight || 52;

  let esquerda = ancora.right + DISTANCIA;
  if (esquerda + largura > window.innerWidth - MARGEM) {
    esquerda = ancora.left - largura - DISTANCIA;
  }
  esquerda = Math.min(
    Math.max(MARGEM, esquerda),
    Math.max(MARGEM, window.innerWidth - largura - MARGEM),
  );

  const topo = Math.min(
    Math.max(MARGEM, ancora.top + ancora.height / 2 - altura / 2),
    Math.max(MARGEM, window.innerHeight - altura - MARGEM),
  );
  tooltip.style.left = `${Math.round(esquerda)}px`;
  tooltip.style.top = `${Math.round(topo)}px`;
}

function exibir(alvo: HTMLElement | null): void {
  tooltip ??= criarTooltip();
  const texto = alvo?.dataset.gameTip?.trim();
  if (!alvo || !texto) {
    tooltip.classList.add('hidden');
    return;
  }
  tooltip.textContent = texto;
  tooltip.classList.remove('hidden');
  posicionar(alvo);
}

/**
 * Troca os balões brancos produzidos por `title` por uma superfície do cockpit.
 *
 * Os eventos são delegados porque os painéis são reconstruídos várias vezes
 * por segundo. O observer é a rede de segurança para código legado ou futuro
 * que atribua `title` diretamente, fora do construtor `h()`.
 */
export function instalarTooltipsDoJogo(): void {
  if (instalado) return;
  instalado = true;

  document.querySelectorAll('[title]').forEach(migrarTitle);

  document.addEventListener('mouseover', (evento) => {
    alvoDoMouse = alvoDe(evento.target);
    exibir(alvoDoMouse ?? alvoDoFoco);
  });
  document.addEventListener('mouseout', (evento) => {
    const saiuDe = alvoDe(evento.target);
    const entrouEm = alvoDe(evento.relatedTarget);
    if (!saiuDe || saiuDe === entrouEm) return;
    if (alvoDoMouse === saiuDe) alvoDoMouse = null;
    exibir(alvoDoFoco);
  });
  document.addEventListener('focusin', (evento) => {
    alvoDoFoco = alvoDe(evento.target);
    exibir(alvoDoFoco ?? alvoDoMouse);
  });
  document.addEventListener('focusout', (evento) => {
    const saiuDe = alvoDe(evento.target);
    const entrouEm = alvoDe(evento.relatedTarget);
    if (!saiuDe || saiuDe === entrouEm) return;
    if (alvoDoFoco === saiuDe) alvoDoFoco = null;
    exibir(alvoDoMouse);
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') exibir(null);
  });
  window.addEventListener('resize', () => exibir(alvoDoFoco ?? alvoDoMouse));

  new MutationObserver((mudancas) => {
    for (const mudanca of mudancas) {
      if (mudanca.type === 'attributes') migrarTitle(mudanca.target as Element);
      else mudanca.addedNodes.forEach(migrarArvore);
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['title'],
  });
}
