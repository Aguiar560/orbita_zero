import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';
import type { ResourceId } from '@sim/types';

import { tokenValido } from './conta';
import { bus } from './Bus';

/**
 * O espelho local dos saldos e do passe, que moram no servidor.
 *
 * ## Por que existe um espelho, se a verdade está lá
 *
 * Porque a tela desenha sessenta vezes por segundo e não pode perguntar o saldo
 * ao servidor a cada quadro. O espelho é o valor mais recente que o servidor
 * confirmou — nunca um palpite do cliente —, e toda operação que muda dinheiro
 * devolve o saldo novo, que substitui o espelho inteiro.
 *
 * A diferença em relação ao save antigo é onde a soma acontece. Antes o cliente
 * somava e mandava o total; agora ele manda o MOVIMENTO e o servidor soma. Quem
 * editar o espelho no console vê o número mudar na tela e não muda nada de
 * verdade: o próximo \`sincronizar\` traz o valor do servidor por cima, e
 * qualquer gasto é recusado por saldo insuficiente.
 *
 * ## Por que não fica no save
 *
 * Era o buraco inteiro. \`state.resources\` e \`state.vip\` iam no corpo do save, o
 * servidor gravava o save como blob opaco sem olhar dentro, e por isso bastava
 * escrever no console para ter cristal e passe. Com o ranking valendo prêmio,
 * isso deixou de ser trapaça consigo mesmo.
 */

export interface EstadoDaCarteira {
  saldos: Record<ResourceId, number>;
  /** Epoch em SEGUNDOS. Zero e passado significam a mesma coisa: sem passe. */
  vipExpiraEm: number;
}

export interface Movimento {
  moeda: ResourceId;
  /** Positivo credita, negativo debita. */
  quantia: number;
  motivo: 'drop' | 'missao' | 'loja' | 'craft' | 'morte' | 'semente';
}

const VAZIA = (): EstadoDaCarteira => ({
  saldos: { sucata: 0, nucleo: 0, cristal: 0 },
  vipExpiraEm: 0,
});

let espelho: EstadoDaCarteira = VAZIA();
let sincronizada = false;

/** O último estado que o servidor confirmou. */
export const carteira = (): Readonly<EstadoDaCarteira> => espelho;

/**
 * Já falamos com o servidor nesta sessão?
 *
 * A tela precisa saber para não mostrar zero como se fosse saldo. "Ainda não
 * sei" e "você tem zero" são coisas diferentes, e confundir as duas faz o
 * jogador achar que perdeu tudo enquanto a rede responde.
 */
export const carteiraPronta = (): boolean => sincronizada;

export const vipAtivo = (agora = Date.now()): boolean =>
  espelho.vipExpiraEm * 1000 > agora;

function adotar(novo: EstadoDaCarteira): void {
  espelho = {
    saldos: {
      sucata: Math.max(0, Math.trunc(novo.saldos?.sucata ?? 0)),
      nucleo: Math.max(0, Math.trunc(novo.saldos?.nucleo ?? 0)),
      cristal: Math.max(0, Math.trunc(novo.saldos?.cristal ?? 0)),
    },
    vipExpiraEm: Math.max(0, Math.trunc(novo.vipExpiraEm ?? 0)),
  };
  sincronizada = true;
  bus.emit('resources:changed');
}

async function chamar(metodo: 'GET' | 'POST', corpo?: unknown): Promise<EstadoDaCarteira | null> {
  const token = await tokenValido();
  if (!token) return null;

  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/carteira`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) return null;
    return (await r.json()) as EstadoDaCarteira;
  } catch {
    // Rede fora não é erro de jogo. O espelho continua valendo, e o jogador
    // segue vendo o último saldo confirmado em vez de um zero assustador.
    return null;
  }
}

/** Busca o estado atual. Chamado no boot e depois de reconciliar o save. */
export async function sincronizar(): Promise<boolean> {
  const r = await chamar('GET');
  if (!r) return false;
  adotar(r);
  return true;
}

/**
 * Envia um lote de movimentos e adota o saldo que voltar.
 *
 * ## Por que lote, e por que tudo ou nada
 *
 * Uma recompensa de missão entrega três moedas juntas. Em três chamadas, a
 * segunda pode falhar e deixar o jogador com um terço do prêmio — e um livro
 * que registra uma entrega que não aconteceu inteira.
 *
 * ## O que acontece quando falha
 *
 * Nada muda, e é de propósito. O ganho perdido por rede fora é pequeno e
 * recuperável; um espelho que avança sem o servidor concordar é uma mentira que
 * o jogador só descobre na próxima sincronização, quando o número CAI sozinho.
 * Melhor não creditar do que descreditar depois.
 */
export async function movimentar(movimentos: readonly Movimento[]): Promise<boolean> {
  const uteis = movimentos.filter((m) => Number.isFinite(m.quantia) && Math.trunc(m.quantia) !== 0);
  if (!uteis.length) return true;
  const r = await chamar('POST', { movimentos: uteis.map((m) => ({ ...m, quantia: Math.trunc(m.quantia) })) });
  if (!r) return false;
  adotar(r);
  return true;
}

/** Compra ou renova o passe. O servidor debita; o cliente só pede. */
export async function comprarVip(): Promise<boolean> {
  const token = await tokenValido();
  if (!token) return false;
  try {
    const r = await fetch(`${API_URL}/vip`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;
    adotar((await r.json()) as EstadoDaCarteira);
    return true;
  } catch {
    return false;
  }
}

/** Zera o espelho ao sair da conta, para o saldo de um não aparecer para outro. */
export function esquecer(): void {
  espelho = VAZIA();
  sincronizada = false;
}

/**
 * Esvazia a fila de saída e adota o saldo que o servidor devolver.
 *
 * ## A ordem importa, e é esta
 *
 * A fila é copiada e LIMPA antes do envio, e devolvida ao início se falhar.
 * O contrário — limpar depois — perderia tudo que o jogo enfileirasse durante
 * a requisição, que num idle é o tempo inteiro.
 *
 * ## Por que o saldo do servidor entra por cima
 *
 * Ele já inclui o que a fila acabou de levar. Somar de novo aqui dobraria o
 * ganho; ignorar deixaria o espelho preso no valor local para sempre. Adotar
 * é a única das três que fecha a conta.
 */
export async function drenarCarteira(sim: Sim): Promise<void> {
  const fila = sim.state.pendentes;
  if (!fila.length && carteiraPronta()) return;

  const enviando = fila.splice(0, fila.length);
  const ok = enviando.length ? await movimentar(enviando) : await sincronizar();

  if (!ok) {
    // Volta ao INÍCIO da fila: a ordem dos lançamentos é o que o livro-caixa
    // vai contar depois, e reordenar torna a auditoria mais difícil de ler.
    fila.unshift(...enviando);
    return;
  }

  const c = carteira();
  sim.state.resources.sucata = c.saldos.sucata;
  sim.state.resources.nucleo = c.saldos.nucleo;
  sim.state.resources.cristal = c.saldos.cristal;
  sim.state.vip.expiresAt = c.vipExpiraEm * 1000;
  sim.touch();
}