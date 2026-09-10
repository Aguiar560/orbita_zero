import { h } from './dom';

/**
 * A faixa que avisa que saiu versão nova.
 *
 * ## Por que uma faixa, e não um `toast`
 *
 * O toast some sozinho em segundos. Quem estava olhando o combate não lê, e a
 * informação vai embora — que é exatamente o estado de hoje, em que o jogador
 * não sabe que precisa atualizar. Esta fica até ser resolvida.
 *
 * ## E por que ela não bloqueia nada
 *
 * Nada de modal. O jogador pode estar no meio de um chefe, e interromper isso
 * para anunciar uma correção que ele não pediu troca um incômodo pequeno
 * (versão velha) por um grande (partida atrapalhada). A faixa fica no rodapé,
 * fora do caminho, e o jogo continua.
 *
 * O `Game` recarrega sozinho no primeiro momento seguro — fim de setor, ou aba
 * escondida. A faixa existe para quem quiser antes disso, e para o caso de o
 * momento seguro demorar.
 */
export function mostrarAvisoDeVersao(host: HTMLElement, aoAtualizar: () => void): () => void {
  const anterior = host.querySelector('.aviso-versao');
  if (anterior) return () => anterior.remove();

  const faixa = h('.aviso-versao', { role: 'status' },
    h('span.aviso-versao-texto', {},
      h('strong', { text: 'NOVA VERSÃO DISPONÍVEL' }),
      h('small', { text: 'O jogo atualiza sozinho no fim do setor. Se preferir, agora:' }),
    ),
    h('button.btn.aviso-versao-acao', {
      type: 'button', text: 'ATUALIZAR', onclick: aoAtualizar,
    }),
    h('button.aviso-versao-fechar', {
      type: 'button',
      text: '×',
      'aria-label': 'Esconder o aviso',
      // Fechar esconde a FAIXA, não cancela a atualização: o jogo continua
      // marcado para recarregar no próximo momento seguro. Deixar o jogador
      // desligar a atualização seria oferecer a ele a escolha de ficar com o
      // defeito, escondida atrás de um "x".
      onclick: () => faixa.remove(),
    }),
  );

  host.append(faixa);
  return () => faixa.remove();
}
