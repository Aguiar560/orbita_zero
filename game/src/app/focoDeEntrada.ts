/** Também considera botões: espaço/setas em controles não são comandos da nave. */
export function focoDeEntrada(alvo: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && alvo instanceof Element
    && !!alvo.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [data-chat]');
}
