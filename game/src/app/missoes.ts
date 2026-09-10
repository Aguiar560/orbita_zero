import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';

import { tokenValido } from './conta';
import { avisarMarcos, type MarcoCreditado } from './marcos';
import { relatarFalha, relatarSucesso } from './recusa';

/**
 * As missões e a confiança, agora do servidor.
 *
 * ## O que mudou de dono
 *
 * A ENTREGA. `resgatarMissao` continua rodando no cliente para a tela responder
 * na hora, mas quem decide se ela vale é o servidor: ele confere que a missão
 * existe, que ainda não foi entregue e que os passos alcançam o alvo do
 * catálogo — a validação B do `PLANO-MISSOES-NO-SERVIDOR`.
 *
 * ## Por que MESCLA em vez de substituir
 *
 * As regras são monotônicas: passos pelo MAIOR, `iniciada` por OU, entrega pelo
 * primeiro carimbo. É isso que faz duas máquinas em paralelo SOMAREM em vez de
 * uma vencer — o problema que `missoes` tinha por viajar dentro do bloco do
 * save, onde a reconciliação escolhe um bloco inteiro pelo maior `playtime`.
 *
 * E é o que torna a migração segura: o cliente semeia o `state.missoes` inteiro
 * uma vez, e semear duas vezes dá o mesmo resultado.
 *
 * ## A confiança não sobe nem desce — ela DERIVA
 *
 * O servidor a calcula somando `confiancaDaMissao` sobre o que foi entregue.
 * Guardá-la seria a mesma informação duas vezes, e o argumento é o mesmo que o
 * do nível não ter coluna: duas cópias de um número divergem.
 */

interface Remoto {
  missoes: Record<string, { passos: number[]; iniciada: boolean; entregueEm: number | null }>;
  confianca: Record<string, number>;
  recusadas?: { missao: string; motivo: string }[];
  /** Marcos de cristal que ESTA chamada creditou. Ver `app/marcos.ts`. */
  marcos?: MarcoCreditado[];
}

let sincronizado = false;

async function chamar(corpo?: unknown): Promise<Remoto | null> {
  const token = await tokenValido();
  if (!token) return null;
  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/missoes`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) { await relatarFalha('/missoes', 'fundo', r); return null; }
    const dados = (await r.json()) as Remoto;
    relatarSucesso('/missoes', dados);
    return dados;
  } catch {
    await relatarFalha('/missoes', 'fundo', null);
    return null;
  }
}

function adotar(sim: Sim, r: Remoto): void {
  for (const [id, linha] of Object.entries(r.missoes)) {
    sim.state.missoes[id] = {
      passos: [...linha.passos],
      entregue: linha.entregueEm !== null,
      iniciada: linha.iniciada,
    };
  }
  // A confiança vem inteira: ela é derivada, então o que o servidor manda É a
  // verdade. Mesclar aqui só criaria um segundo lugar onde ela pode divergir.
  sim.state.confianca = { ...r.confianca };
  sincronizado = true;
  sim.touch();
}

/** O formato do fio: `entregue` vira carimbo, porque entrega é irreversível. */
function paraOServidor(sim: Sim): Record<string, unknown> {
  const fora: Record<string, unknown> = {};
  for (const [id, p] of Object.entries(sim.state.missoes)) {
    fora[id] = {
      passos: p.passos ?? [],
      iniciada: p.iniciada === true,
      // O cliente não guarda QUANDO entregou, só que entregou. O servidor
      // carimba a hora dele — e é o carimbo dele que vale, porque o relógio da
      // máquina do jogador não é de ninguém.
      entregueEm: p.entregue ? 1 : null,
    };
  }
  return fora;
}

/** Busca do servidor e adota. Chamado no boot. */
export async function sincronizarMissoes(sim: Sim): Promise<boolean> {
  const r = await chamar();
  if (!r) return false;
  adotar(sim, r);
  return true;
}

/**
 * Manda o que mudou e adota o que voltar.
 *
 * Manda o mapa INTEIRO, e não um delta: a mescla é monotônica, então reenviar o
 * que o servidor já tem não muda nada — e é isso que faz a semeadura dos saves
 * atuais ser só mais um envio, sem caminho especial de migração para manter.
 */
export async function drenarMissoes(sim: Sim): Promise<void> {
  const r = await chamar({ missoes: paraOServidor(sim) });
  if (!r) return;
  adotar(sim, r);
  // A entrega conferida pode ter sido um marco: o cristal da missão chega por
  // aqui, e não pelo `resgatarMissao` do cliente.
  await avisarMarcos(sim, r.marcos);
}

export const missoesProntas = (): boolean => sincronizado;

/** Esquece o espelho ao trocar de conta. */
export function esquecerMissoes(): void {
  sincronizado = false;
}
