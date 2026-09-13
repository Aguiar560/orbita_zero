import { API_URL } from '@app/api';
import type { Sim } from '@sim/index';

import { tokenValido } from './conta';
import { relatarFalha, relatarSucesso } from './recusa';

/**
 * As chaves de acesso, agora espelho do servidor.
 *
 * ## Por que elas saíram do save
 *
 * "As chaves têm que ser igual os recursos e itens: se eles estão no D1, então
 * as chaves também precisam estar" — Rafael, 12/09/2026. O save é um blob que o
 * cliente escreve, e a chave decide a entrada no chefe.
 *
 * Havia uma consequência medida no mesmo dia: a trava do servidor contra entrar
 * no setor do chefe teve de ser uma DECISÃO ("a ausência não enfrenta chefe")
 * em vez de uma VERIFICAÇÃO, porque o servidor não sabia quais chaves a conta
 * tinha. Agora sabe.
 *
 * ## A assimetria que organiza este arquivo
 *
 * O GANHO sobe como fila, no padrão de `materiaisPendentes`: o drop acontece na
 * cena, e segurar o quadro esperando a rede seria pior que a dívida de
 * confiança. O GASTO não sobe — ele é PEDIDO. Quem debita é o servidor, numa
 * transação só com a abertura do acesso, e a nave só entra depois que ele
 * confirma.
 *
 * É a mesma forma do resto do Passo 9: o cliente declara intenção, nunca
 * resultado.
 */

interface Remoto {
  chaves: Record<string, number>;
  acesso: string | null;
}

let sincronizado = false;
/** O último acesso que o SERVIDOR disse ter. Ver `drenarChaves`. */
let acessoConhecido: string | null = null;

async function chamar(corpo?: unknown): Promise<Remoto | null> {
  const token = await tokenValido();
  if (!token) return null;
  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/chaves`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) { await relatarFalha('/chaves', 'fundo', r); return null; }
    const dados = (await r.json()) as Remoto;
    relatarSucesso('/chaves', dados);
    return dados;
  } catch {
    await relatarFalha('/chaves', 'fundo', null);
    return null;
  }
}

/**
 * Adota o que o servidor disse, com a fila DAQUI por cima.
 *
 * Mesmo raciocínio do Armazém: o que está na fila ainda não foi aplicado em
 * lugar nenhum, então somá-lo sobre a resposta não conta nada duas vezes — e
 * não somá-lo apagaria a chave que caiu enquanto a resposta viajava.
 */
function adotar(sim: Sim, r: Remoto): void {
  const chaves: Record<string, number> = { ...r.chaves };
  for (const [id, n] of Object.entries(sim.state.chavesPendentes)) {
    const soma = (chaves[id] ?? 0) + n;
    if (soma > 0) chaves[id] = soma;
    else delete chaves[id];
  }
  sim.state.chavesAcesso = chaves;
  sim.state.run.chaveAcessoConsumida = r.acesso ?? undefined;
  acessoConhecido = r.acesso;
  sincronizado = true;
  sim.touch();
}

/** Busca do servidor e adota. Chamado no boot. */
export async function sincronizarChaves(sim: Sim): Promise<boolean> {
  const r = await chamar();
  if (!r) return false;
  adotar(sim, r);
  return true;
}

/**
 * Sobe o que caiu, e devolve o acesso que a nave já deixou para trás.
 *
 * As duas coisas no mesmo ciclo porque são o mesmo evento: a nave saiu do setor
 * do chefe, e a fila do setor seguinte começou a encher. Um relógio próprio
 * para cada uma dobraria as requisições sem dobrar a informação.
 */
export async function drenarChaves(sim: Sim): Promise<void> {
  const fila = { ...sim.state.chavesPendentes };
  const temGanho = Object.keys(fila).length > 0;
  // A nave saiu do setor do chefe: o recibo do servidor precisa ser rasgado
  // junto, senão ele continuaria autorizando uma entrada que já acabou.
  const precisaLiberar = sincronizado
    && acessoConhecido !== null && sim.state.run.chaveAcessoConsumida === undefined;

  if (!temGanho && !precisaLiberar) return;

  if (precisaLiberar) {
    const r = await chamar({ acao: 'liberar' });
    if (!r) return;
    acessoConhecido = null;
  }
  if (!temGanho) return;

  const r = await chamar({ ganhos: fila });
  if (!r) return;
  // Só depois da confirmação, e por CHAVE: o jogador continuou abatendo
  // enquanto a resposta viajava, e um `= {}` apagaria o que caiu no meio.
  for (const [id, enviado] of Object.entries(fila)) {
    const resto = (sim.state.chavesPendentes[id] ?? 0) - enviado;
    if (resto <= 0) delete sim.state.chavesPendentes[id];
    else sim.state.chavesPendentes[id] = resto;
  }
  adotar(sim, r);
}

/**
 * Pede ao servidor para GASTAR a chave e abrir o acesso.
 *
 * Devolve `true` só quando ele confirma. É a rede do desenho inteiro: enquanto
 * a chave morava no save, entrar no chefe era palavra do cliente.
 *
 * Uma falha aqui é AÇÃO, não fundo — tem gente parada na frente do cartão
 * esperando —, então a frase aparece na hora.
 */
export async function consumirChaveNoServidor(
  sim: Sim, chaveId: string, bossId: string,
): Promise<boolean> {
  const token = await tokenValido();
  if (!token) return false;
  try {
    const r = await fetch(`${API_URL}/chaves`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'consumir', chave: chaveId, boss: bossId }),
    });
    if (!r.ok) { await relatarFalha('/chaves', 'acao', r); return false; }
    const dados = (await r.json()) as Remoto;
    relatarSucesso('/chaves', dados);
    adotar(sim, dados);
    return true;
  } catch {
    await relatarFalha('/chaves', 'acao', null);
    return false;
  }
}

export const chavesProntas = (): boolean => sincronizado;

/** Esquece o espelho ao trocar de conta. */
export function esquecerChaves(): void {
  sincronizado = false;
  acessoConhecido = null;
}
