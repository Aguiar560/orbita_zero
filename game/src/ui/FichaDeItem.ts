import type { Item } from '@sim/types';
import type { Sim } from '@sim/index';
import { h } from './dom';
import { buildItemCard } from './ItemCard';

/**
 * A ficha do item sob o cursor, compartilhada por todas as telas.
 *
 * ## Por que no `body`, e não dentro do painel
 *
 * As colunas dos painéis são `overflow: hidden` — um cartão ancorado lá dentro
 * seria cortado pela própria coluna assim que passasse da borda. É o mesmo
 * caminho que o trilho já usava.
 *
 * ## Por que um módulo, e não um método em cada painel
 *
 * Este código nasceu dentro do painel de Baús. Quando a Provação e as Missões
 * passaram a mostrar itens também, copiá-lo daria três versões da mesma
 * posicionadora — e a terceira já nasceria diferente das duas primeiras, porque
 * ninguém revisa os três lugares ao ajustar um deles.
 *
 * O nó é único e criado sob demanda: a maioria das aberturas de painel nunca
 * chega a passar o mouse por um item, e um nó a mais por painel construído
 * seria lixo acumulado a cada troca de aba.
 */
let ficha: HTMLElement | null = null;

function no(): HTMLElement {
  if (!ficha) {
    ficha = h('.item-card-float.hidden');
    document.body.append(ficha);
  }
  return ficha;
}

/** Mostra a ficha ao lado de `alvo`. `conteudo` substitui o cartão padrão. */
export function mostrarFicha(alvo: HTMLElement, conteudo: Node): void {
  const el = no();
  el.replaceChildren(conteudo);
  el.classList.remove('hidden');

  // Abre à direita do alvo; vira para a esquerda quando não couber, e nunca
  // passa da borda de baixo da janela.
  const spot = alvo.getBoundingClientRect();
  const largura = el.offsetWidth || 236;
  const altura = el.offsetHeight || 220;
  const direita = spot.right + 10;
  const cabe = direita + largura <= window.innerWidth - 8;
  el.style.left = `${cabe ? direita : Math.max(8, spot.left - largura - 10)}px`;
  el.style.top = `${Math.min(Math.max(8, spot.top - 12), Math.max(8, window.innerHeight - altura - 8))}px`;
}

/** Atalho para o caso comum: um item de verdade, com o cartão completo. */
export function mostrarFichaDeItem(sim: Sim, item: Item, alvo: HTMLElement): void {
  mostrarFicha(alvo, buildItemCard(sim, item));
}

export function esconderFicha(): void {
  ficha?.classList.add('hidden');
}

/**
 * Liga a ficha a um elemento, cobrindo mouse E teclado.
 *
 * `focus` junto de `mouseenter` porque quem navega por Tab também precisa ver o
 * que a peça faz — e é o tipo de coisa que se esquece quando cada tela liga o
 * seu próprio ouvinte.
 */
export function ligarFicha(el: HTMLElement, montar: () => Node): void {
  const abrir = (): void => { mostrarFicha(el, montar()); };
  el.addEventListener('mouseenter', abrir);
  el.addEventListener('focus', abrir);
  el.addEventListener('mouseleave', esconderFicha);
  el.addEventListener('blur', esconderFicha);
}
