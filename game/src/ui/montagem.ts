import { bus } from '@app/Bus';
import type { Item, SlotId } from '@sim/types';

/**
 * Qual nave está sendo MONTADA, e o que está sendo arrastado até ela.
 *
 * ## Por que este estado existe
 *
 * O equipamento é por casco desde a v7, e `sim.equip(uid, hullId)` sempre
 * aceitou qualquer nave. Mas a grade do inventário chamava `sim.equip(uid)` sem
 * casco — e o padrão do parâmetro é `state.hull`, a nave EM CAMPO.
 *
 * O efeito era discreto e feio: o jogador escolhia outra nave no seletor da
 * Anatomia, via os soquetes dela, clicava uma peça na grade ao lado e a peça ia
 * para a nave errada. A coluna dizia uma coisa e o clique fazia outra, sem
 * nenhum aviso, porque as duas metades da tela não se falavam.
 *
 * ## Por que mora na UI e não no save
 *
 * Pelo mesmo motivo de `selecao.ts`: "estou montando esta nave" não é
 * progresso. Fechar o jogo no meio não perde nada — o equipamento já está
 * gravado por casco, e a coluna volta seguindo a nave em campo.
 *
 * ## Por que o arraste também vive aqui
 *
 * `dataTransfer` só devolve o que se guardou nele no `drop`; durante o
 * `dragover` o conteúdo é ilegível por segurança do navegador. E é justamente
 * no `dragover` que o soquete precisa decidir se acende como alvo válido. Sem
 * guardar a peça em algum lugar acessível, todo soquete acenderia igual, e o
 * jogador só descobriria que o slot estava errado ao soltar.
 */

/** Casco que a Anatomia está exibindo. Vazio = seguir a nave em campo. */
let montando = '';

export const cascoEmMontagem = (): string => montando;
export const definirMontagem = (hullId: string): void => { montando = hullId; };

/** Peça sob o cursor durante um arraste. `null` fora dele. */
let arrastando: Item | null = null;

export const itemArrastado = (): Item | null => arrastando;

// O aviso é síncrono e imediato, e não passa por `state:changed`: aquele é
// amostrado a cada 0,2s, e o realce chegaria depois de o cursor já ter andado.
export const iniciarArraste = (item: Item): void => {
  arrastando = item;
  bus.emit('arraste:mudou');
};
export const encerrarArraste = (): void => {
  if (!arrastando) return;
  arrastando = null;
  bus.emit('arraste:mudou');
};

/**
 * O arraste corrente serve para este slot?
 *
 * Só a compatibilidade de SLOT. A de elemento é regra de jogo e mora em
 * `sim/elemento-da-nave.ts` — repetir a segunda aqui criaria duas fontes para a
 * mesma pergunta, e a da UI seria a que envelhece.
 */
export const arrasteServeAo = (slot: SlotId): boolean => arrastando?.slot === slot;
