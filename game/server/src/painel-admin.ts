import { ADMINS } from '@data/servidor';
import { nivelDoPiloto } from './progresso';

/** Janela que define "online" em toda a operação do jogo. */
export const JANELA_ONLINE_SEGUNDOS = 300;

/**
 * O portão que VALE para dados operacionais.
 *
 * A lista de ids não é secreta; o que impede uma pessoa de se passar por
 * admin é o JWT, validado antes de esta função receber o id. Mantê-la no
 * mesmo arquivo do cliente evita duas listas que poderiam divergir, mas aqui
 * ela deixa de ser só uma escolha de interface: sem ela, a rota entregaria a
 * atividade de todos os jogadores a qualquer conta autenticada.
 */
export const podeLerPainelAdmin = (usuario: string): boolean => ADMINS.includes(usuario);

export interface JogadorDoPainelAdmin {
  /** Só os oito primeiros caracteres: serve para distinguir sem expor o UUID. */
  codigo: string;
  /** Nome público escolhido no jogo. `null` quando ainda não escolheu. */
  apelido: string | null;
  nivel: number;
  melhorSetor: number;
  naves: number;
  itensNaMochila: number;
  itensEquipados: number;
  missoesConcluidas: number;
  online: boolean;
  /** Epoch em segundos, ou null para conta ainda sem save. */
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
  };
  jogadores: JogadorDoPainelAdmin[];
}

interface LinhaBruta {
  usuario: string;
  apelido: string | null;
  xp: number;
  melhor_setor: number;
  ultima_atividade: number;
  naves: number;
  itens_mochila: number;
  itens_equipados: number;
  missoes_concluidas: number;
}

/**
 * Retrato operacional de cada pessoa que o jogo já viu.
 *
 * `contas` sozinho não basta: jogadores anteriores à tabela e contas que só
 * têm um save precisam aparecer também. A união evita que um deles desapareça
 * justamente do painel usado para encontrar migrações ou falhas de entrada.
 * As contagens entram como subconsultas para não multiplicar naves × itens ×
 * missões num `JOIN` e reportar números falsos.
 */
export async function lerPainelAdmin(env: { DB: D1Database }, agora: number): Promise<PainelAdmin> {
  const { results } = await env.DB.prepare(`
    WITH jogadores AS (
      SELECT usuario FROM contas
      UNION SELECT usuario FROM saves
      UNION SELECT usuario FROM progresso
      UNION SELECT usuario FROM frota
      UNION SELECT usuario FROM itens
      UNION SELECT usuario FROM missoes
    )
    SELECT j.usuario,
           a.apelido,
           COALESCE(p.xp, 0) AS xp,
           COALESCE(p.melhor_setor, 1) AS melhor_setor,
           COALESCE(s.atualizado_em, 0) AS ultima_atividade,
           (SELECT COUNT(*) FROM frota f WHERE f.usuario = j.usuario) AS naves,
           (SELECT COUNT(*) FROM itens i WHERE i.usuario = j.usuario AND i.nave IS NULL) AS itens_mochila,
           (SELECT COUNT(*) FROM itens i WHERE i.usuario = j.usuario AND i.nave IS NOT NULL) AS itens_equipados,
           (SELECT COUNT(*) FROM missoes m WHERE m.usuario = j.usuario AND m.entregue_em IS NOT NULL) AS missoes_concluidas
      FROM jogadores j
      LEFT JOIN apelidos a ON a.usuario = j.usuario
      LEFT JOIN progresso p ON p.usuario = j.usuario
      LEFT JOIN saves s ON s.usuario = j.usuario
     ORDER BY ultima_atividade DESC, j.usuario ASC
  `).all<LinhaBruta>();

  const desdeOnline = agora - JANELA_ONLINE_SEGUNDOS;
  const jogadores = (results ?? []).map((linha): JogadorDoPainelAdmin => ({
    codigo: linha.usuario.slice(0, 8),
    apelido: linha.apelido,
    nivel: nivelDoPiloto(Number(linha.xp) || 0),
    melhorSetor: Math.max(1, Math.floor(Number(linha.melhor_setor) || 1)),
    naves: Math.max(0, Number(linha.naves) || 0),
    itensNaMochila: Math.max(0, Number(linha.itens_mochila) || 0),
    itensEquipados: Math.max(0, Number(linha.itens_equipados) || 0),
    missoesConcluidas: Math.max(0, Number(linha.missoes_concluidas) || 0),
    online: Number(linha.ultima_atividade) > desdeOnline,
    ultimaAtividade: Number(linha.ultima_atividade) || null,
  }));

  const resumo = jogadores.reduce<PainelAdmin['resumo']>((total, jogador) => {
    total.jogadores++;
    total.online += Number(jogador.online);
    total.ativos24h += Number((jogador.ultimaAtividade ?? 0) > agora - 86_400);
    total.ativos7d += Number((jogador.ultimaAtividade ?? 0) > agora - 604_800);
    total.nivelMedio += jogador.nivel;
    total.maiorNivel = Math.max(total.maiorNivel, jogador.nivel);
    total.maiorSetor = Math.max(total.maiorSetor, jogador.melhorSetor);
    total.naves += jogador.naves;
    total.itensNaMochila += jogador.itensNaMochila;
    total.itensEquipados += jogador.itensEquipados;
    total.missoesConcluidas += jogador.missoesConcluidas;
    return total;
  }, {
    jogadores: 0, online: 0, ativos24h: 0, ativos7d: 0, nivelMedio: 0,
    maiorNivel: 0, maiorSetor: 0, naves: 0, itensNaMochila: 0,
    itensEquipados: 0, missoesConcluidas: 0,
  });

  if (resumo.jogadores) resumo.nivelMedio = Math.round(resumo.nivelMedio / resumo.jogadores);

  return { geradoEm: agora, janelaOnlineSegundos: JANELA_ONLINE_SEGUNDOS, resumo, jogadores };
}
