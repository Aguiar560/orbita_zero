import { API_URL } from '@data/servidor';
import { SAVE_VERSION, migrate } from '@sim/state';
import type { GameState } from '@sim/types';
import { tokenValido } from './conta';

/**
 * O save na nuvem: descer ao entrar, subir de tempos em tempos.
 *
 * ## Por que o save local continua sendo o principal
 *
 * O jogo roda inteiro sem conta, e isso não muda. `localStorage` continua sendo
 * gravado a cada dez segundos e é dele que o jogo lê ao abrir. A nuvem é uma
 * CÓPIA que sobrevive a limpar o navegador e atravessa dispositivos — não é a
 * fonte de verdade durante a partida.
 *
 * A alternativa, ler do servidor a cada abertura e escrever a cada mudança,
 * quebraria o jogo offline e estouraria a cota da camada gratuita no primeiro
 * dia. Ver `INTERVALO_MINIMO_DE_SAVE` no Worker.
 *
 * ## Quem vence quando os dois discordam
 *
 * O mais recente, comparando `savedAt` do estado local com `atualizadoEm` do
 * servidor. É a única regra que não perde progresso nas duas pontas:
 *
 * - servidor vazio → sobe o local (primeira vez, ou conta nova);
 * - servidor mais novo → desce (outro dispositivo jogou; ou o navegador foi
 *   limpo e o local nasceu agora);
 * - local mais novo → sobe (jogou offline desde a última subida).
 *
 * O empate fica com o local, de propósito: em empate os dois valem o mesmo, e
 * trocar o estado em memória por um idêntico só arrisca.
 *
 * ## O que este módulo NÃO faz
 *
 * Não confere se o save é plausível — isso é trabalho do servidor, e ainda não
 * existe. Enquanto não existir, um cliente adulterado sobe o que quiser. É por
 * isso que o placar continua fora do ar: um placar alimentado por saves não
 * conferidos é decoração.
 */

/** Margem antes de tentar subir de novo depois de um `cedo_demais`. */
const FOLGA_APOS_RECUSA = 5;

export interface EstadoDaNuvem {
  /** `null` enquanto ninguém entrou numa conta. */
  ultimaSubida: number | null;
  ultimoErro: string | null;
  /** Segundos a esperar antes da próxima tentativa, quando o servidor recusou. */
  esperarAte: number;
}

export const nuvem: EstadoDaNuvem = {
  ultimaSubida: null,
  ultimoErro: null,
  esperarAte: 0,
};

async function chamar(metodo: 'GET' | 'PUT', corpo?: unknown): Promise<Response | null> {
  const token = await tokenValido();
  if (!token) return null;

  try {
    return await fetch(`${API_URL}/save`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(corpo ? { 'content-type': 'application/json' } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch (err) {
    // Rede fora do ar não é erro de jogo: o save local está intacto e a próxima
    // tentativa acontece sozinha.
    nuvem.ultimoErro = err instanceof Error ? err.message : 'sem rede';
    return null;
  }
}

/**
 * O save guardado no servidor, ou `null` se não houver (ou não der para falar).
 *
 * Passa pelo mesmo `migrate` do save local — e por isso herda todo o
 * saneamento. O que ele NÃO faz é marcar `contaminado`: isto é o progresso do
 * próprio jogador voltando, não um save colado de fora.
 */
export async function baixarSave(): Promise<{ estado: GameState; atualizadoEm: number } | null> {
  const r = await chamar('GET');
  if (!r || !r.ok) {
    if (r) nuvem.ultimoErro = `servidor respondeu ${r.status}`;
    return null;
  }

  try {
    const dados = await r.json() as { vazio?: boolean; estado?: unknown; atualizadoEm?: number };
    if (dados.vazio || !dados.estado) return null;

    const estado = migrate(dados.estado);
    if (!estado) {
      nuvem.ultimoErro = 'save da nuvem ilegível';
      return null;
    }
    return { estado, atualizadoEm: dados.atualizadoEm ?? 0 };
  } catch {
    nuvem.ultimoErro = 'resposta da nuvem ilegível';
    return null;
  }
}

/**
 * Sobe o estado. `false` quando não subiu — sem conta, sem rede, ou cedo demais.
 *
 * Recusa por ritmo (429) não é falha: o servidor limita uma gravação a cada dois
 * minutos por jogador, e é o que faz a conta da camada gratuita fechar. Guardar
 * `esperarAte` evita o cliente insistir contra uma porta que ele sabe fechada.
 */
export async function subirSave(estado: GameState): Promise<boolean> {
  const agora = Math.floor(Date.now() / 1000);
  if (agora < nuvem.esperarAte) return false;

  const r = await chamar('PUT', { estado, versao: SAVE_VERSION });
  if (!r) return false;

  if (r.status === 429) {
    try {
      const { esperar } = await r.json() as { esperar?: number };
      nuvem.esperarAte = agora + (esperar ?? 60) + FOLGA_APOS_RECUSA;
    } catch {
      nuvem.esperarAte = agora + 60;
    }
    return false;
  }

  if (!r.ok) {
    nuvem.ultimoErro = `servidor respondeu ${r.status}`;
    return false;
  }

  nuvem.ultimaSubida = agora;
  nuvem.ultimoErro = null;
  return true;
}

export type Reconciliacao =
  | { acao: 'sem-conta' }
  | { acao: 'subiu'; motivo: 'nuvem-vazia' | 'local-mais-novo' }
  | { acao: 'desceu'; estado: GameState; atualizadoEm: number }
  | { acao: 'nada'; motivo: 'empate' | 'falhou' };

/**
 * Junta o save local e o da nuvem, e diz o que fazer.
 *
 * Devolve a decisão em vez de aplicá-la porque trocar `sim.state` é assunto de
 * quem tem o `Sim` na mão — e porque uma função que decide E age não dá para
 * testar sem montar o jogo inteiro.
 */
export async function reconciliar(local: GameState): Promise<Reconciliacao> {
  if (!await tokenValido()) return { acao: 'sem-conta' };

  const daNuvem = await baixarSave();
  if (!daNuvem) {
    // Pode ser nuvem vazia (conta nova) ou falha de rede. Nos dois casos tentar
    // subir é o certo: se foi falha, a subida também falha e nada se perde.
    const subiu = await subirSave(local);
    return subiu ? { acao: 'subiu', motivo: 'nuvem-vazia' } : { acao: 'nada', motivo: 'falhou' };
  }

  // `savedAt` é epoch em MILISSEGUNDOS; `atualizadoEm` é em SEGUNDOS. Comparar
  // sem converter daria o servidor como mais velho por um fator de mil, sempre,
  // e o save da nuvem nunca desceria.
  const localEm = Math.floor((local.savedAt ?? 0) / 1000);

  if (daNuvem.atualizadoEm > localEm) {
    return { acao: 'desceu', estado: daNuvem.estado, atualizadoEm: daNuvem.atualizadoEm };
  }
  if (localEm > daNuvem.atualizadoEm) {
    const subiu = await subirSave(local);
    return subiu ? { acao: 'subiu', motivo: 'local-mais-novo' } : { acao: 'nada', motivo: 'falhou' };
  }
  return { acao: 'nada', motivo: 'empate' };
}
