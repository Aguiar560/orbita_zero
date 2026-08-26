import { bus } from '@app/Bus';
import type { ElementId } from '@sim/types';

/**
 * Uso pendente de um serviço: o jogador ativou a carga e falta escolher o alvo.
 *
 * ## Por que o alvo se escolhe no INVENTÁRIO, e não num modal
 *
 * A primeira versão abria um modal com um `<select>` de todas as peças. Não
 * funcionava: a lista dizia "Reator nv 30 · Raro · Fogo" e o jogador precisava
 * DECORAR essa linha para saber qual das setenta células da grade era aquela.
 * Escolher por texto uma coisa que ele reconhece por ÍCONE é pedir tradução.
 *
 * O inventário já está permanentemente na tela — é a coluna direita fixa. Então
 * a carga não abre nada: ela põe a grade em modo de seleção, e o jogador clica
 * na peça que está vendo.
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
  /** Elemento de destino já escolhido. */
  elemento: ElementId;
  /** Texto curto mostrado sobre a grade. */
  instrucao: string;
}

let pendente: SelecaoPendente | null = null;

export const selecaoPendente = (): SelecaoPendente | null => pendente;

export function pedirSelecao(s: SelecaoPendente): void {
  pendente = s;
  bus.emit('state:changed');
}

export function encerrarSelecao(): void {
  if (!pendente) return;
  pendente = null;
  bus.emit('state:changed');
}
