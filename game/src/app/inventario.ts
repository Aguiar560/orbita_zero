import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';
import type { ComandoDeItem, Item, SlotId } from '@sim/types';

import { tokenValido } from './conta';

/**
 * O inventário, que mora no servidor.
 *
 * ## O que a Fase 3b fechou
 *
 * A 3a tirou do cliente o poder de escolher QUAL item cai. Faltava a outra
 * metade: o inventário continuava no save, e save é blob que o cliente escreve
 * — dava para não rolar nada e simplesmente ESCREVER uma peça Divina na lista.
 *
 * Agora `inventory` e o equipamento de cada nave são ESPELHO. A verdade é a
 * tabela `itens` no D1.
 *
 * ## O item nunca sobe
 *
 * O comando `coletar` diz QUANTOS itens de cada tipo saíram do lote, nunca
 * QUAIS. O servidor tem a semente e o cursor, então deriva sozinho. Nenhum byte
 * de item viaja daqui para lá — e o que não trafega não pode ser forjado.
 *
 * ## Por que um lote de comandos
 *
 * Medido: 186 itens por hora, a maioria descartada automaticamente no mesmo
 * instante em que cai. Uma requisição por operação seriam ~370 por hora. Um
 * lote no ritmo do setor — coletei nove, descartei sete, equipei uma — é uma a
 * cada três minutos, o mesmo ritmo da carteira, porque é o mesmo evento.
 */

interface LinhaRemota {
  item: Item;
  nave: string | null;
  slot: string | null;
}

let sincronizado = false;

export const inventarioPronto = (): boolean => sincronizado;

async function chamar(metodo: 'GET' | 'POST', corpo?: unknown): Promise<LinhaRemota[] | null> {
  const token = await tokenValido();
  if (!token) return null;
  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/inventario`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) return null;
    const dados = (await r.json()) as { itens: LinhaRemota[] };
    return dados.itens ?? [];
  } catch {
    return null;
  }
}

/**
 * Substitui a mochila e o equipamento pelo que o servidor diz.
 *
 * Substituição inteira, e não junção. Juntar precisaria decidir quem vence em
 * cada divergência, e a resposta seria sempre "o servidor" — então juntar é
 * escrever um caso especial para chegar no mesmo lugar.
 */
function adotar(sim: Sim, linhas: LinhaRemota[]): void {
  sim.state.inventory = linhas.filter((l) => !l.nave).map((l) => l.item);

  for (const id of Object.keys(sim.state.naves)) {
    const nave = sim.state.naves[id];
    if (nave) nave.equipped = {};
  }
  for (const l of linhas) {
    if (!l.nave || !l.slot) continue;
    const nave = sim.state.naves[l.nave];
    if (nave) nave.equipped[l.slot as SlotId] = l.item;
  }

  sincronizado = true;
  sim.touch();
}

/** Busca o inventário do servidor. Chamado no boot. */
export async function sincronizarInventario(sim: Sim): Promise<boolean> {
  const linhas = await chamar('GET');
  if (!linhas) return false;
  adotar(sim, linhas);
  return true;
}

/**
 * Envia os comandos acumulados e adota a lista que voltar.
 *
 * A fila é copiada e LIMPA antes do envio, e devolvida ao início se falhar — o
 * contrário perderia tudo que o jogo enfileirasse durante a requisição, que num
 * idle é o tempo inteiro.
 */
export async function drenarInventario(sim: Sim): Promise<void> {
  const fila = sim.state.comandosDeItem;
  if (!fila.length && sincronizado) return;

  const enviando = fila.splice(0, fila.length);
  const linhas = enviando.length
    ? await chamar('POST', empacotar(enviando))
    : await chamar('GET');

  if (!linhas) {
    fila.unshift(...enviando);
    return;
  }
  adotar(sim, linhas);
}

/**
 * Junta os comandos no formato que a rota espera.
 *
 * As coletas viram CONTAGEM por tipo — é a forma que impede o cliente de dizer
 * qual item pegou. Descartes e equipamentos mantêm a ordem: equipar depois de
 * descartar a mesma peça precisa falhar, e não silenciosamente reordenar.
 */
function empacotar(comandos: readonly ComandoDeItem[]): {
  coletar: Record<string, number>;
  descartar: string[];
  equipar: { uid: string; nave: string | null }[];
} {
  const coletar: Record<string, number> = {};
  const descartar: string[] = [];
  const equipar: { uid: string; nave: string | null }[] = [];

  for (const c of comandos) {
    if (c.tipo === 'coletar' && c.pote) coletar[c.pote] = (coletar[c.pote] ?? 0) + 1;
    else if (c.tipo === 'descartar' && c.uid) descartar.push(c.uid);
    else if (c.tipo === 'equipar' && c.uid) equipar.push({ uid: c.uid, nave: c.nave ?? null });
  }
  return { coletar, descartar, equipar };
}

/** Esquece o espelho ao trocar de conta. */
export function esquecerInventario(): void {
  sincronizado = false;
}

/**
 * Funde peças no servidor.
 *
 * Era a última porta por onde um item nascia fora dele: a fusão consumia dez
 * peças e produzia uma com `rollItem` LOCAL, então bastava fundir lixo até o
 * resultado agradar — e o item saía legítimo pelos olhos do resto do sistema.
 *
 * Assíncrona porque tem de ser: o resultado é do servidor, e fingir um item
 * aqui para trocá-lo depois seria mostrar ao jogador uma peça que talvez não
 * exista.
 */
export async function sintetizar(
  sim: Sim,
  uids: readonly string[],
): Promise<{ item: Item; receita: string } | null> {
  const token = await tokenValido();
  if (!token) return null;
  try {
    const r = await fetch(`${API_URL}/sintetizar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ uids, sorte: sim.stats.sorte, universo: sim.state.universe.index }),
    });
    if (!r.ok) return null;
    const dados = (await r.json()) as { item: Item; receita: string; itens: LinhaRemota[] };
    adotar(sim, dados.itens);
    return { item: dados.item, receita: dados.receita };
  } catch {
    return null;
  }
}

/**
 * A frota, que também saiu do save.
 *
 * Casco é PODER: cada um tem atributos-base próprios, e os melhores custam
 * cristal. Escrever um id em `state.fleet` entregava de graça o que a loja
 * cobra — era o que sobrava depois de o item ser fechado.
 */
async function chamarFrota(corpo?: unknown): Promise<string[] | null> {
  const token = await tokenValido();
  if (!token) return null;
  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/frota`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) return null;
    const dados = (await r.json()) as { frota: string[] };
    return dados.frota ?? [];
  } catch {
    return null;
  }
}

export async function sincronizarFrota(sim: Sim): Promise<boolean> {
  const frota = await chamarFrota();
  if (!frota) return false;
  sim.state.fleet = frota;
  sim.touch();
  return true;
}

/** Compra um casco. O preço sai do livro-caixa, no servidor. */
export async function comprarCasco(sim: Sim, casco: string): Promise<boolean> {
  const frota = await chamarFrota({ casco });
  if (!frota) return false;
  sim.state.fleet = frota;
  sim.touch();
  return true;
}

/** O casco inicial do piloto escolhido. Concedido uma vez, sem custo. */
export async function registrarPiloto(sim: Sim, piloto: string): Promise<boolean> {
  const frota = await chamarFrota({ piloto });
  if (!frota) return false;
  sim.state.fleet = frota;
  sim.touch();
  return true;
}