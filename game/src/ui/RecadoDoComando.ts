import type { Recado } from '@app/recados';
import { h } from './dom';

/**
 * O cartão que entrega o recado do comando.
 *
 * ## Por que ele PARA o jogador, ao contrário da faixa de versão
 *
 * A faixa de "nova versão" fica no rodapé e não interrompe nada: o jogador não
 * precisa fazer nada, e o jogo se atualiza sozinho. Aqui é o contrário — a
 * mensagem só existe porque alguém quis que ele lesse. Um aviso que se pode
 * não ver não serve para "avisamos você".
 *
 * Ainda assim não é modal de verdade: o jogo continua rodando atrás. O que ele
 * exige é um clique, não atenção exclusiva.
 *
 * ## Um por vez
 *
 * A fila é entregue em ordem, um cartão de cada vez. Dois recados empilhados
 * viram um bloco de texto que ninguém lê inteiro — e o segundo, que costuma ser
 * o mais recente, é o que se perde.
 */
export function mostrarRecado(
  host: HTMLElement,
  recado: Recado,
  aoFechar: (id: number) => void,
): HTMLElement {
  const fechar = (): void => {
    cartao.classList.add('saindo');
    // A confirmação sai ANTES da animação terminar: se o jogador fechar a aba
    // no meio dela, o recado não pode voltar no próximo boot como se nunca
    // tivesse sido lido.
    aoFechar(recado.id);
    window.setTimeout(() => cartao.remove(), 180);
  };

  const cartao = h('.recado', {
    role: 'dialog',
    'aria-modal': 'false',
    'aria-live': 'assertive',
    'aria-label': 'Recado do comando',
  },
    h('.recado-feixe', { 'aria-hidden': true }),
    h('.recado-topo', {},
      h('span', { text: 'TRANSMISSÃO DO COMANDO' }),
      h('button.recado-x', {
        type: 'button', text: '✕', 'aria-label': 'Fechar', onclick: fechar,
      }),
    ),
    h('.recado-conteudo', {},
      h('p', { text: recado.texto }),
    ),
    h('button.btn.recado-ok', { type: 'button', text: 'ENTENDIDO', onclick: fechar }),
  );

  host.append(cartao);
  return cartao;
}
