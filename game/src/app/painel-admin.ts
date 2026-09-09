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
  ultimaAtividade: number | null;
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
  };
  economia: {
    recursos: { moeda: string; quantia: number }[];
    materiais: { material: string; quantia: number }[];
    movimentacao: { moeda: string; entradas: number; saidas: number; operacoes: number }[];
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
