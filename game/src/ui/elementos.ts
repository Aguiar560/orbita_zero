import { getElement } from '@data/elements';
import type { ElementId } from '@sim/types';
import { h } from './dom';

/**
 * O ícone de um elemento, em qualquer tamanho.
 *
 * ## Por que existe um único ponto
 *
 * O elemento aparece em cinco lugares com cinco tamanhos diferentes — canto da
 * célula de item (11px), ameaça da galáxia (14px), resistências (14px), chip do
 * trilho (22px) e a ficha do item. Antes cada um montava a própria sigla à mão,
 * e trocar letra por ícone significaria cinco edições com cinco chances de
 * divergir. Agora é uma função.
 *
 * ## Por que ícone e não a letra
 *
 * A sigla (F, G, R, Q, C) exige LER, e ler não acontece numa grade de setenta
 * células que o jogador varre em um segundo. E `F` de fogo e `G` de gelo são
 * duas letras parecidas em tamanho pequeno, enquanto uma chama e um floco não se
 * confundem nunca.
 *
 * ## Por que a cor não é a única diferença
 *
 * O jogo tem alto contraste como opção de acessibilidade, e daltonismo
 * vermelho-verde tornaria fogo e químico idênticos se a cor fosse tudo. As seis
 * formas foram desenhadas para se separarem pelo CONTORNO — verificado a 11px,
 * que é o menor uso real: chama pontuda, floco radial, raio diagonal, gota
 * curva, orbe com anel e losango de quatro pontas.
 */

const ARTE = (id: ElementId): string => `/assets/ui/elementos/${id}.webp`;

/**
 * Ícone quadrado do elemento.
 *
 * `title` sai do nome do elemento por padrão — o ícone dispensa leitura, mas
 * quem passar o mouse merece a palavra.
 */
export function iconeDeElemento(
  id: ElementId,
  tamanho: number,
  classeExtra = '',
): HTMLElement {
  const info = getElement(id);
  const el = h(`img.elem-icone${classeExtra ? `.${classeExtra}` : ''}`, {
    src: ARTE(id),
    alt: '',
    'aria-hidden': true,
    draggable: false,
    title: info.name,
  }) as HTMLImageElement;
  el.width = tamanho;
  el.height = tamanho;
  el.style.width = `${tamanho}px`;
  el.style.height = `${tamanho}px`;
  return el;
}

/**
 * Ícone mais o nome, para onde a palavra cabe.
 *
 * A cor vai no TEXTO e não no ícone: o ícone já tem a própria arte colorida, e
 * pintá-lo de novo por cima só o sujaria.
 */
export function elementoComNome(id: ElementId, tamanho = 16): HTMLElement {
  const info = getElement(id);
  return h('.elem-linha', {},
    iconeDeElemento(id, tamanho),
    h('span', {
      text: info.name,
      style: { color: info.color } as Partial<CSSStyleDeclaration>,
    }),
  );
}
