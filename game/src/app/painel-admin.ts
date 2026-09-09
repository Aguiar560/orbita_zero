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
  };
  economia: { recursos: { moeda: string; quantia: number }[] };
  frota: { cascos: { casco: string; total: number }[] };
  galaxias: { indice: number; jogadores: number; maiorSetor: number }[];
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
