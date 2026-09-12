import { API_URL } from '@data/servidor';
import { tokenValido } from './conta';

export type ResumoDeIndicacao = { ativo: false } | {
  ativo: true;
  codigo: string | null;
  codigoAtivo: boolean;
  vinculados: number;
  qualificadosNivel25: number;
  compradores: number;
  pendenteCentavos: number;
  disponivelCentavos: number;
  reservadoCentavos: number;
  recebidoCentavos: number;
  dividaCentavos: number;
  proximaLiberacao: number | null;
  proximoSaque: number | null;
  pix: { tipo: string; chaveMascarada: string } | null;
  marcos: Array<{ jogadores: number; cristais: number; atingido: boolean }>;
  saques: Array<{
    id: string; centavos: number; estado: string; solicitadoEm: number; pagoEm: number | null;
  }>;
};

/** Lê apenas agregados do próprio jogador; nenhuma identidade indicada é exposta. */
export async function buscarResumoDeIndicacao(): Promise<ResumoDeIndicacao | null> {
  const token = await tokenValido();
  if (!token) return null;
  try {
    const resposta = await fetch(`${API_URL}/indicacao`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) return null;
    return await resposta.json() as ResumoDeIndicacao;
  } catch { return null; }
}

export async function salvarChavePix(
  tipo: string, chave: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const token = await tokenValido();
  if (!token) return { ok: false, erro: 'Sua sessão expirou.' };
  try {
    const resposta = await fetch(`${API_URL}/indicacao/pix`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ tipo, chave }),
    });
    if (resposta.ok) return { ok: true };
    const dados = await resposta.json().catch(() => ({})) as { erro?: string };
    return { ok: false, erro: dados.erro === 'chave_pix_invalida'
      ? 'Confira o tipo e o formato da chave Pix.' : 'Não foi possível salvar a chave Pix agora.' };
  } catch { return { ok: false, erro: 'Sem conexão com o servidor.' }; }
}

export async function solicitarSaque(
  centavos: number,
): Promise<{ ok: true } | { ok: false; erro: string; proximoSaque?: number }> {
  const token = await tokenValido();
  if (!token) return { ok: false, erro: 'Sua sessão expirou.' };
  try {
    const resposta = await fetch(`${API_URL}/indicacao/saque`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ centavos }),
    });
    if (resposta.ok) return { ok: true };
    const dados = await resposta.json().catch(() => ({})) as { erro?: string; proximoSaque?: number };
    const mensagens: Record<string, string> = {
      pix_ausente: 'Cadastre uma chave Pix antes de solicitar o saque.',
      saldo_insuficiente: 'O valor ultrapassa seu saldo disponível.',
      saque_semanal: 'Você já fez uma solicitação nesta janela semanal.',
      saque_abaixo_do_minimo: 'O saque mínimo é de R$ 15,00.',
      codigo_bloqueado: 'Seu código está bloqueado para saques.',
      valor_invalido: 'Informe um valor válido.',
    };
    return { ok: false, erro: mensagens[dados.erro ?? ''] ?? 'Não foi possível solicitar o saque.', proximoSaque: dados.proximoSaque };
  } catch { return { ok: false, erro: 'Sem conexão com o servidor.' }; }
}
