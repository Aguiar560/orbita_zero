import { API_URL } from '@data/servidor';
import { tokenValido } from './conta';

export interface JogadorDoPainelAdmin {
  codigo: string;
  apelido: string | null;
  nivel: number;
  melhorSetor: number;
  naves: number;
  itensNaMochila: number;
  itensEquipados: number;
  missoesConcluidas: number;
  tempoDeJogo: number;
  recursos: Record<string, number>;
  materiais: Record<string, number>;
  primeiroAcesso: number | null;
  cascoEmCampo: string | null;
  abates: number;
  chefesAbatidos: number;
  mortes: number;
  itensEncontrados: number;
  bausAbertos: number;
  medalhas: number;
  online: boolean;
  /** Passe ativo agora. `vipExpiraEm` fica com o vencimento de quem já teve. */
  vip: boolean;
  vipExpiraEm: number;
  vipCortesiaDias: number;
  ultimaAtividade: number | null;
  equipamentos: EquipamentoDoPainelAdmin[];
}

export interface EquipamentoDoPainelAdmin {
  nome: string;
  baseId: string;
  nave: string;
  slot: string;
  raridade: number;
  nivel: number;
  elemento: string | null;
  conjunto: string | null;
}

export interface PainelAdmin {
  geradoEm: number;
  janelaOnlineSegundos: number;
  resumo: {
    jogadores: number;
    online: number;
    ativos24h: number;
    ativos7d: number;
    nivelMedio: number;
    maiorNivel: number;
    maiorSetor: number;
    naves: number;
    itensNaMochila: number;
    itensEquipados: number;
    missoesConcluidas: number;
    tempoDeJogo: number;
    tempoMedio: number;
    novos24h: number;
    novos7d: number;
    ativos30d: number;
    cadastrosPendentes: number;
    vips: number;
    vipsExpirados: number;
    vipVagasUsadas: number;
    vipVagasTotais: number;
  };
  economia: {
    receita: {
      liquidoCentavos: number;
      brutoCentavos: number;
      reembolsadoCentavos: number;
      compras: number;
      compradores: number;
      ticketMedioCentavos: number;
      centavos24h: number;
      centavos7d: number;
      pendentes: number;
    };
    recursos: { moeda: string; quantia: number }[];
    materiais: { material: string; quantia: number }[];
    movimentacao: { moeda: string; entradas: number; saidas: number; operacoes: number }[];
    indicacoes: {
      vinculados: number; compradores: number; receitaCentavos: number;
      pendentes: number; liberados: number; revertidos: number; divida: number;
      bloqueados: number; tentativasRecusadas: number;
      vinculados24h: number; maiorConcentracaoCompras: number;
    };
  };
  frota: {
    cascos: { casco: string; total: number }[];
    emCampo: { casco: string; total: number }[];
    raridades: { raridade: number; total: number; equipados: number }[];
  };
  galaxias: { indice: number; jogadores: number; maiorSetor: number }[];
  niveis: { faixa: string; jogadores: number }[];
  missoes: {
    iniciadas: number;
    entregues: number;
    emAndamento: number;
    maisEntregues: { missao: string; total: number }[];
  };
  saude: { semApelido: number; semSave: number; savesInvalidos: number };
  jogadores: JogadorDoPainelAdmin[];
}

export type EstadoDoPainelAdmin =
  | { fase: 'nunca' }
  | { fase: 'carregando' }
  | { fase: 'pronto'; dados: PainelAdmin }
  | { fase: 'proibido' }
  | { fase: 'erro' };

/**
 * Busca o retrato operacional. O servidor decide a autorização; este módulo
 * nunca presume que esconder a aba é proteção suficiente.
 */
export async function buscarPainelAdmin(): Promise<EstadoDoPainelAdmin> {
  const token = await tokenValido();
  if (!token) return { fase: 'proibido' };

  try {
    const resposta = await fetch(`${API_URL}/admin/painel`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (resposta.status === 403) return { fase: 'proibido' };
    if (!resposta.ok) return { fase: 'erro' };
    return { fase: 'pronto', dados: await resposta.json() as PainelAdmin };
  } catch {
    return { fase: 'erro' };
  }
}

export async function alterarCodigoDeIndicacao(
  codigo: string, acao: 'bloquear' | 'desbloquear', motivo: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const token = await tokenValido();
  if (!token) return { ok: false, erro: 'Sessão administrativa expirada.' };
  try {
    const resposta = await fetch(`${API_URL}/admin/indicacoes/codigo`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ codigo, acao, motivo }),
    });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({})) as { erro?: string };
      return { ok: false, erro: dados.erro === 'codigo_desconhecido'
        ? 'Código não encontrado.' : 'Confira o código e informe um motivo com pelo menos 5 caracteres.' };
    }
    return { ok: true };
  } catch { return { ok: false, erro: 'Servidor indisponível.' }; }
}

export interface SaqueDeIndicacaoAdmin {
  id: string;
  usuario: string;
  centavos: number;
  tipoPix: string;
  chavePix: string;
  chavePixMascarada: string;
  estado: string;
  solicitadoEm: number;
  dividaCentavos: number;
}

export async function buscarSaquesDeIndicacao(): Promise<SaqueDeIndicacaoAdmin[] | null> {
  const token = await tokenValido();
  if (!token) return null;
  try {
    const resposta = await fetch(`${API_URL}/admin/indicacoes/saques`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json() as { saques?: SaqueDeIndicacaoAdmin[] };
    return dados.saques ?? [];
  } catch { return null; }
}

export async function decidirSaqueDeIndicacao(
  id: string, acao: 'pagar' | 'recusar', texto: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const token = await tokenValido();
  if (!token) return { ok: false, erro: 'Sessão administrativa expirada.' };
  try {
    const resposta = await fetch(`${API_URL}/admin/indicacoes/saque`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, acao, [acao === 'pagar' ? 'referencia' : 'motivo']: texto }),
    });
    if (resposta.ok) return { ok: true };
    const dados = await resposta.json().catch(() => ({})) as { erro?: string };
    return { ok: false, erro: dados.erro === 'saque_com_estorno_pendente'
      ? 'Há estorno pendente; recuse e devolva a reserva antes de pagar.'
      : 'Não foi possível concluir. Informe referência ou motivo auditável.' };
  } catch { return { ok: false, erro: 'Servidor indisponível.' }; }
}
