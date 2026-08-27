import type { PassoDoTour } from '@ui/Tour';

/**
 * O que o jogador precisa entender antes de jogar sozinho.
 *
 * ## O critério de entrada
 *
 * Um passo só existe se a ausência dele deixaria o jogador PARADO ou fazendo a
 * coisa errada por não saber. "A nave atira sozinha" entra: quem não sabe fica
 * procurando o botão de tiro e conclui que o jogo está quebrado. "Existe uma
 * aba de Códex" não entra: ninguém trava por não abrir o Códex, e ele se explica
 * ao ser aberto.
 *
 * Foi assim que a lista ficou em nove passos e não em vinte e cinco. Um passeio
 * longo demais é pulado inteiro — e aí o jogador perde também os três passos que
 * realmente importavam.
 *
 * ## A ordem segue o olho, não o menu
 *
 * Começa no centro (a nave, que é o que se está olhando), abre para o que está
 * em volta e só então chega às abas. Percorrer o menu da esquerda para a direita
 * seria a ordem do desenvolvedor, não a de quem chegou agora.
 */
export const PASSOS_DO_ONBOARDING: readonly PassoDoTour[] = [
  {
    titulo: 'Bem-vindo ao Órbita Zero',
    texto: 'Um minuto para você saber onde tudo fica. Dá para pular a qualquer momento — e reabrir depois em Ajustes.',
  },
  {
    alvo: '.stage-wrap',
    titulo: 'A nave voa e atira sozinha',
    texto: 'Você não pilota. A nave tem piloto de IA: ela mira, desvia e atira sem você. O seu trabalho é decidir COM O QUE ela vai lutar — nave, peças e talentos.',
    escala: 1.02,
    folga: 6,
  },
  {
    alvo: '.anatomia',
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
    alvo: '.rail-left',
    titulo: 'O painel da esquerda acompanha a luta',
    texto: 'Vida, escudo, setor e o que estiver caindo. É aqui que você vê se a nave está aguentando o setor atual ou se é hora de melhorar o equipamento.',
    escala: 1.01,
    folga: 6,
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
