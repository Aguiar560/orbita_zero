import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';
import type { ComandoDeItem, Item, SlotId } from '@sim/types';

import { casarCascoComAFrota } from '@sim/state';
import { tokenValido } from './conta';
import { toast } from './Bus';

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
    const dados = (await r.json()) as {
      itens: LinhaRemota[];
      faltaram?: Record<string, number>;
    };
    /**
     * O servidor deu menos do que se pediu — e é isso que interessa aparecer.
     *
     * A rota recusava o lote inteiro nesse caso (409), e o cliente reenviava o
     * mesmo lote para sempre. Agora ela apara e conta; o desencontro fica
     * visível aqui, sem destruir os descartes e os equipamentos que vieram
     * junto. Ver `derivarColeta`.
     */
    if (dados.faltaram && Object.keys(dados.faltaram).length) {
      console.warn('[inventário] o pote deu menos do que o pedido:', dados.faltaram);
    }
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
/**
 * Busca a lista e adota. NÃO envia a fila — e é por isso que ninguém a chama.
 *
 * Ficou sem uso quando o boot passou a usar `drenarInventario`: adotar sem
 * enviar apaga da tela um `equipar` que ainda está na fila, e foi assim que
 * peças recém-equipadas voltavam para o inventário ao atualizar a página.
 *
 * Fica exportada porque `drenar` faz um GET puro quando a fila está vazia, e
 * um dia alguém vai querer só olhar. Se esse dia não chegar, apague.
 */
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
  // Uma coleta pode acontecer enquanto a resposta está viajando. Nesse caso,
  // ela descreve um instante anterior e substituir a mochila inteira faria a
  // peça recém-coletada sumir até o próximo envio. Mantemos o espelho otimista;
  // a fila restante será confirmada no ciclo seguinte.
  if (fila.length) return;
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
  // Sessão vencida era a última saída muda que restava neste caminho.
  if (!token) { toast('Sessão expirada. Recarregue a página para fundir.', 'bad'); return null; }

  /**
   * A fila VAI antes da fusão, e não depois.
   *
   * O servidor carrega as peças do banco pelo `uid` e recusa o lote inteiro se
   * faltar uma (`itens_nao_sao_seus`) — não por zelo, mas porque não sabe
   * distinguir "ainda não chegou" de "não é sua". Uma peça coletada há segundos
   * ainda está na fila do inventário, e fundir com ela dentro do anel é o caso
   * mais fácil de encontrar: o jogador pega, abre a Fabricação e funde.
   *
   * Drenar aqui troca uma recusa por uma ida a mais ao servidor. Numa ação
   * deliberada e destrutiva, que acontece uma vez a cada muitos minutos, é a
   * troca certa.
   */
  await drenarInventario(sim);

  try {
    const r = await fetch(`${API_URL}/sintetizar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ uids, sorte: sim.stats.sorte, universo: sim.state.universe.index }),
    });
    if (!r.ok) { await explicarRecusa(r); return null; }
    const dados = (await r.json()) as { item: Item; receita: string; itens: LinhaRemota[] };
    adotar(sim, dados.itens);
    return { item: dados.item, receita: dados.receita };
  } catch {
    toast('Sem resposta do servidor. A fusão não aconteceu.', 'bad');
    return null;
  }
}

/**
 * Por que a fusão não saiu — dito ao jogador, em vez de engolido.
 *
 * ## Por que isto existe
 *
 * `chamar` devolve `null` em toda falha, e o painel transformava `null` em
 * NADA: o jogador clicava e a tela não mudava. Foi o formato de dois defeitos
 * em 08/09 — a migração que não subiu e o saldo que não chegava —, e nos dois
 * o custo não foi o defeito, foi as horas até alguém entender qual era.
 *
 * As peças NÃO se perdem em nenhum destes casos: a fusão é uma transação só no
 * servidor, e recusada ela não apaga nada. Dizer isso importa, porque a fusão é
 * destrutiva e o silêncio deixa a dúvida no pior lugar possível.
 */
const RECUSA_DA_FUSAO: Record<string, string> = {
  rapido_demais: 'Muitas ações seguidas. Espere alguns segundos e tente de novo.',
  itens_nao_sao_seus: 'O servidor ainda não conhece uma das peças. Tente de novo em instantes.',
  raridades_diferentes: 'Todas as peças precisam ser da mesma raridade.',
  favorito_na_fusao: 'Há um favorito no anel. Favorito nunca é fundido.',
  quantidade_errada: 'O anel não tem a quantidade que a receita pede.',
  sem_receita: 'Não há receita para esta raridade.',
};

async function explicarRecusa(r: Response): Promise<void> {
  let erro = '';
  try {
    erro = ((await r.json()) as { erro?: string }).erro ?? '';
  } catch { /* corpo vazio ou não-JSON: o status ainda vale como resposta */ }

  // O toast some em segundos; o console fica. É o que dá para copiar e colar
  // quando o motivo precisa chegar a quem vai consertar.
  console.warn(`[fusão] recusada — HTTP ${r.status} · ${erro || 'sem motivo no corpo'}`);

  toast(
    RECUSA_DA_FUSAO[erro] ?? `A fusão foi recusada (${erro || r.status}). Nenhuma peça foi perdida.`,
    'bad',
  );
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
  /**
   * É AQUI que "casco em campo tem de estar na frota" passa a valer.
   *
   * A regra morava em `migrate`, e lá ela julgava o casco contra uma frota que
   * ainda não tinha chegado — o save da nuvem sobe `fleet: []`. O jogador
   * voltava ao jogo com a nave de partida do piloto padrão, e a ausência era
   * creditada com ela. Ver `tests/casco-sobrevive-a-nuvem`.
   *
   * Esta é a frota do SERVIDOR, que é a autoridade sobre o que o jogador tem.
   * Quem editou o save para voar com um casco que não comprou perde o casco
   * aqui, que é onde a checagem tem valor.
   */
  casarCascoComAFrota(sim.state);
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
