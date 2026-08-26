import { bus } from '@app/Bus';
import type { ElementId } from '@sim/types';

/**
 * Uso pendente de um serviço: o jogador ativou a carga e falta escolher.
 *
 * ## Duas fases, e por que a escolha do elemento saiu do Armazém
 *
 * A aba de Serviços mostrava, dentro de cada cartão, os seis botões de elemento
 * — e no caso das naves, a frota inteira com seis botões CADA. Com quarenta
 * naves aquilo seria uma parede de duzentos e quarenta botões numa aba que
 * deveria ser um inventário.
 *
 * Agora a aba é uma LISTA de itens, como qualquer outro estoque, e o fluxo mora
 * onde ele acontece:
 *
 * 1. clicar a carga → a faixa aparece pedindo o ELEMENTO
 * 2. escolher o elemento → a faixa passa a pedir o ALVO
 * 3. clicar a peça no inventário → pronto
 *
 * ## Por que o alvo se escolhe no INVENTÁRIO
 *
 * A primeira versão pedia o alvo num modal com um `<select>` de todas as peças:
 * a lista dizia "Reator nv 30 · Raro · Fogo" e o jogador precisava DECORAR essa
 * linha para saber qual das setenta células da grade era aquela. Escolher por
 * texto uma coisa que se reconhece por ícone é pedir tradução.
 *
 * Naves são diferentes: são poucas e cada uma tem silhueta própria, mas podem
 * chegar a quarenta — lá o alvo se escolhe num modal com a frota rolável, que é
 * o formato certo para uma lista longa de coisas visualmente distintas.
 *
 * ## Por que este estado mora na UI e não no save
 *
 * "Estou no meio de escolher" não é progresso. Se o jogo fechar com uma seleção
 * pendente, a carga continua no Armazém e o jogador começa de novo — nada se
 * perde, e o save não guarda um estado de meio-caminho que teria de ser migrado.
 */
export interface SelecaoPendente {
  /** Id do serviço, em `data/shop.ts`. */
  servico: string;
  /** Nome do serviço, para a faixa dizer o que está em curso. */
  nome: string;
  /**
   * Elemento de destino. `null` enquanto o jogador ainda não escolheu — é o que
   * separa a fase 1 (escolher elemento) da fase 2 (escolher alvo).
   */
  elemento: ElementId | null;
}

let pendente: SelecaoPendente | null = null;

export const selecaoPendente = (): SelecaoPendente | null => pendente;

/**
 * A seleção já sabe o elemento e espera o alvo?
 *
 * O tipo devolvido ESTREITA `elemento` para não-nulo. Sem isso quem consome
 * precisaria de um `!` a cada uso — e um dia alguém o escreveria na fase 1, onde
 * o elemento realmente não existe.
 */
export const mirandoAlvo = (): (SelecaoPendente & { elemento: ElementId }) | null =>
  pendente && pendente.elemento ? (pendente as SelecaoPendente & { elemento: ElementId }) : null;

export function pedirSelecao(s: SelecaoPendente): void {
  pendente = s;
  // FECHA a camada. O Armazém abre em tela cheia (z-index 60) e cobre
  // exatamente o inventário que precisa ser clicado — pedir para clicar numa
  // peça e deixar um painel opaco por cima dela é um beco sem saída.
  bus.emit('panel:close');
  bus.emit('state:changed');
}

/** Fase 2: o elemento foi escolhido; agora falta o alvo. */
export function escolherElemento(elemento: ElementId): void {
  if (!pendente) return;
  pendente = { ...pendente, elemento };
  bus.emit('state:changed');
}

export function encerrarSelecao(): void {
  if (!pendente) return;
  pendente = null;
  bus.emit('state:changed');
}
