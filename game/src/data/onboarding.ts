import type { PassoDoTour } from '@ui/Tour';

/**
 * O que o jogador precisa entender antes de jogar sozinho.
 *
 * ## O critério de entrada
 *
 * Um passo só existe se a ausência dele deixaria o jogador PARADO ou fazendo a
 * coisa errada por não saber. "Dá para assumir o controle" entra: quem não sabe
 * joga o jogo inteiro assistindo, sem descobrir metade dele. "Existe uma aba de
 * Códex" não entra: ninguém trava por não abrir o Códex, e ele se explica ao ser
 * aberto.
 *
 * Foi assim que a lista ficou em dez passos e não em vinte e cinco. Um passeio
 * longo demais é pulado inteiro — e aí o jogador perde também os três passos que
 * realmente importavam.
 *
 * ## A ordem segue o olho, não o menu
 *
 * Começa no centro (a nave, que é o que se está olhando), abre para o que está
 * em volta e só então chega às abas. Percorrer o menu da esquerda para a direita
 * seria a ordem do desenvolvedor, não a de quem chegou agora.
 *
 * ## Do todo para a parte
 *
 * O trilho da esquerda é apresentado inteiro ANTES dos botões de modo que vivem
 * dentro dele. Explicar o botão antes do painel que o contém faz o jogador
 * procurar depois onde aquilo ficava.
 */
export const PASSOS_DO_ONBOARDING: readonly PassoDoTour[] = [
  {
    titulo: 'Bem-vindo ao Órbita Zero',
    texto: 'Um minuto para você saber onde tudo fica. Dá para pular a qualquer momento — e reabrir depois em Ajustes.',
  },
  {
    alvo: '.stage-wrap',
    titulo: 'O combate acontece aqui',
    texto: 'A nave avança pelos setores, enfrenta ondas e derruba chefes. Por padrão ela luta sozinha: mira, desvia e atira sem você — mas isso é uma escolha, não uma regra.',
    escala: 1.02,
    folga: 6,
  },
  {
    alvo: '.rail-left',
    titulo: 'O painel da esquerda acompanha a luta',
    texto: 'Vida, escudo, elementos e o setor atual. É aqui que você vê se a nave está aguentando o que enfrenta ou se é hora de melhorar o equipamento.',
    escala: 1.01,
    folga: 6,
  },
  {
    alvo: '.rail-control',
    titulo: 'Você escolhe quem pilota',
    texto: 'IDLE deixa a IA no comando — o jogo avança sozinho, inclusive com a aba fechada. PILOTAR passa a nave para você, com WASD ou as setas; o disparo continua automático. Dá para trocar no meio da luta.',
    escala: 1.14,
    folga: 10,
  },
  {
    alvo: '.anatomia',
    // A coluna recolhe, e recolhida ela é um talo de poucos pixels — o recorte
    // ficaria do tamanho de nada e o balão explicaria algo invisível.
    exige: 'anatomia',
    titulo: 'A Anatomia é onde a nave se monta',
    texto: 'Cada soquete aceita um tipo de peça. Arraste um item do inventário até o soquete certo, ou clique nele. Aqui embaixo também aparece o elemento da nave.',
    escala: 1.04,
  },
  {
    alvo: '.panel-host',
    titulo: 'O inventário fica sempre à mão',
    texto: 'Esta coluna não fecha: é de onde saem as peças que você arrasta para a nave. O que cai em combate chega aqui.',
    escala: 1.01,
    folga: 6,
  },
  {
    alvo: '.resources',
    titulo: 'Seus recursos',
    texto: 'Sucata, núcleos e cristais. Saem de combate e de desmontar o que não presta — e é com eles que se fabrica, melhora e recalibra.',
    escala: 1.06,
  },
  {
    alvo: '.tabs',
    titulo: 'Cada aba é um sistema',
    texto: 'Galáxia leva a nave a campo. Fabricação e Afixos constroem peças. Matriz é a árvore de talentos. Elas abrem conforme você avança — não precisa entender todas hoje.',
    escala: 1.02,
    folga: 4,
  },
  {
    alvo: '.perfil-botao',
    titulo: 'Sua conta, e o progresso na nuvem',
    texto: 'Com conta, o save sobe para o servidor e você continua de qualquer computador. Sem conta, o jogo funciona igual — mas o progresso fica só neste navegador.',
    escala: 1.12,
  },
  {
    alvo: '.gear',
    titulo: 'Ajustes, e este guia de novo',
    texto: 'Volume, vídeo, dados da conta — e o botão para rever este passeio quando quiser. Bom jogo.',
    escala: 1.15,
  },
];
