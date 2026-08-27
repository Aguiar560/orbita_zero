import { API_URL } from '@data/servidor';
import { marcaDoJogador, navesClassificaveis, PLACARES, type PlacarId } from '@sim/ranking';
import type { GameState } from '@sim/types';
import { tokenValido } from './conta';

/**
 * O cliente do placar mundial: apelido, envio de marcas e leitura da lista.
 *
 * ## Por que a lista é buscada e guardada, e não lida a cada desenho
 *
 * O painel se redesenha a cada `PANEL_HZ`, e uma requisição por redesenho seria
 * dezenas por minuto — a cota da camada gratuita acabaria numa tarde, e a lista
 * piscaria a cada resposta fora de ordem. Então a busca acontece uma vez por
 * abertura de seção, o resultado fica em cache, e o painel desenha o cache.
 *
 * ## O que o servidor recusa, e por que isso aparece aqui
 *
 * A marca é conferida no servidor: faixa, monotonia e ritmo. Uma marca recusada
 * não é erro de rede e não deve ser reapresentada como tal — se o jogo insistir
 * em subir a mesma marca recusada a cada ciclo, gasta cota para sempre. Por
 * isso `recusadas` é lembrado e a mesma marca não é reenviada até mudar.
 */

export interface LinhaDoPlacar {
  posicao: number;
  apelido: string;
  valor: number;
  casco: string;
  voce: boolean;
}

export interface PlacarCarregado {
  linhas: LinhaDoPlacar[];
  minhaPosicao: number | null;
  total: number;
  /** O apelido do proprio jogador, ou `null` se ele ainda nao escolheu. */
  meuApelido: string | null;
}

export type EstadoDaBusca =
  | { fase: 'nunca' }
  | { fase: 'buscando' }
  | { fase: 'pronto'; dados: PlacarCarregado }
  | { fase: 'sem-conta' }
  | { fase: 'sem-apelido' }
  | { fase: 'erro'; motivo: string };

async function chamar(rota: string, metodo: 'GET' | 'PUT', corpo?: unknown): Promise<Response | null> {
  const token = await tokenValido();
  if (!token) return null;
  try {
    return await fetch(`${API_URL}${rota}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(corpo ? { 'content-type': 'application/json' } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    return null;
  }
}

// ── apelido ────────────────────────────────────────────────────────────────

/**
 * As mesmas regras do servidor, repetidas aqui de propósito.
 *
 * A do servidor é a que VALE — esta existe para o jogador saber que o nome não
 * serve enquanto digita, em vez de descobrir depois de uma viagem de rede. Se
 * as duas divergirem, o pior caso é o cliente deixar tentar algo que o servidor
 * recusa, que é a direção segura da divergência.
 */
const APELIDO_OK = /^[\p{L}\p{N}][\p{L}\p{N} _-]{1,14}[\p{L}\p{N}]$/u;

export function apelidoValido(bruto: string): string | null {
  const limpo = bruto.trim().replace(/\s+/g, ' ');
  if (limpo.length < 3 || limpo.length > 16) return null;
  return APELIDO_OK.test(limpo) ? limpo : null;
}

export type ResultadoDeApelido =
  | { ok: true; apelido: string }
  | { ok: false; erro: 'invalido' | 'em_uso' | 'sem_conta' | 'rede' };

export async function definirApelido(bruto: string): Promise<ResultadoDeApelido> {
  const apelido = apelidoValido(bruto);
  if (!apelido) return { ok: false, erro: 'invalido' };

  const r = await chamar('/apelido', 'PUT', { apelido });
  if (!r) return { ok: false, erro: 'sem_conta' };
  if (r.status === 409) return { ok: false, erro: 'em_uso' };
  if (!r.ok) return { ok: false, erro: 'rede' };

  apelidoLocal = apelido;
  return { ok: true, apelido };
}

/**
 * O apelido já reivindicado, ou `null`.
 *
 * Guardado em memória depois da primeira resposta do servidor: perguntar de
 * novo a cada abertura de tela gastaria requisição para saber algo que só muda
 * quando o próprio jogador muda.
 */
let apelidoLocal: string | null = null;
export const apelidoAtual = (): string | null => apelidoLocal;
export const esquecerApelido = (): void => { apelidoLocal = null; };

// ── envio das marcas ───────────────────────────────────────────────────────

/** A última marca ENVIADA de cada chave, para não reenviar o que não mudou. */
const enviadas = new Map<string, number>();

/**
 * Monta as marcas do jogador a partir do estado.
 *
 * Sai de `sim/ranking.ts`, que é onde mora a regra do que cada placar mede —
 * a tela e o servidor precisam concordar sobre isso, e uma segunda definição
 * aqui divergiria na primeira mudança.
 */
export function marcasDoEstado(state: GameState): { placar: PlacarId; casco: string; valor: number; desempate: number }[] {
  const out: { placar: PlacarId; casco: string; valor: number; desempate: number }[] = [];

  for (const p of PLACARES) {
    if (p.id === 'naves') continue; // tratado abaixo, casco a casco
    const m = marcaDoJogador(state, p.id);
    if (m.valor > 0) out.push({ placar: p.id, casco: '', valor: m.valor, desempate: m.desempate });
  }

  // O placar de naves é POR CASCO: o mesmo jogador tem uma marca por nave.
  for (const n of navesClassificaveis(state)) {
    const m = marcaDoJogador(state, 'naves', n.id);
    if (m.valor > 0) out.push({ placar: 'naves', casco: n.id, valor: m.valor, desempate: m.desempate });
  }

  return out;
}

/**
 * Sobe as marcas que MUDARAM desde o último envio.
 *
 * O filtro não é economia de bytes, é economia de escrita: o D1 gratuito dá 100
 * mil escritas de linha por dia, e reenviar quarenta marcas iguais a cada ciclo
 * consumiria a cota de todos os jogadores para não mudar nada.
 */
export async function enviarMarcas(state: GameState): Promise<boolean> {
  const todas = marcasDoEstado(state);
  const novas = todas.filter((m) => {
    const chave = `${m.placar}:${m.casco}`;
    return enviadas.get(chave) !== m.valor;
  });
  if (!novas.length) return false;

  const r = await chamar('/marcas', 'PUT', { marcas: novas });
  if (!r || !r.ok) return false;

  // Guarda o que foi ENVIADO, aceito ou não: a marca recusada por ritmo seria
  // recusada de novo pelo mesmo motivo, e insistir só gasta requisição.
  for (const m of novas) enviadas.set(`${m.placar}:${m.casco}`, m.valor);
  return true;
}

// ── leitura ────────────────────────────────────────────────────────────────

export async function buscarPlacar(id: PlacarId): Promise<EstadoDaBusca> {
  const r = await chamar(`/placar?id=${encodeURIComponent(id)}`, 'GET');
  if (!r) return { fase: 'sem-conta' };
  if (!r.ok) return { fase: 'erro', motivo: `servidor respondeu ${r.status}` };

  try {
    const dados = await r.json() as PlacarCarregado;
    return { fase: 'pronto', dados };
  } catch {
    return { fase: 'erro', motivo: 'resposta ilegível' };
  }
}
