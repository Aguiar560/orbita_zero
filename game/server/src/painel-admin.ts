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
  tempoDeJogo: number;
  recursos: Record<string, number>;
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
    tempoDeJogo: number;
  };
  economia: { recursos: RecursoTotal[] };
  frota: { cascos: RegistroDeCasco[] };
  galaxias: { indice: number; jogadores: number; maiorSetor: number }[];
  jogadores: JogadorDoPainelAdmin[];
}

interface RegistroBase {
  usuario: string;
}

interface RegistroDeApelido extends RegistroBase {
  apelido: string;
}

interface RegistroDeProgresso extends RegistroBase {
  xp: number;
  melhor_setor: number;
}

interface RegistroDeAtividade extends RegistroBase {
  atualizado_em: number;
  estado: string;
}

interface RegistroDeContagem extends RegistroBase {
  total: number;
}

interface RegistroDeItens extends RegistroBase {
  itens_mochila: number;
  itens_equipados: number;
}

interface RegistroDeRecurso extends RegistroBase {
  moeda: string;
  quantia: number;
}

interface RecursoTotal { moeda: string; quantia: number; }

interface RegistroDeCasco { casco: string; total: number; }

interface AcumuladoDoJogador {
  apelido: string | null;
  xp: number;
  melhorSetor: number;
  ultimaAtividade: number | null;
  naves: number;
  itensNaMochila: number;
  itensEquipados: number;
  missoesConcluidas: number;
  tempoDeJogo: number;
  recursos: Record<string, number>;
}

/**
 * Retrato operacional de cada pessoa que o jogo já viu.
 *
 * Cada fonte é lida separadamente e reunida no Worker. Isso evita dois
 * problemas importantes: contagens falsas de um `JOIN` (naves × itens ×
 * missões) e o limite de termos compostos que o D1 aplica quando uma grande
 * união é expandida por subconsultas correlacionadas. Contas antigas que só
 * possuem um save continuam entrando no retrato.
 */
export async function lerPainelAdmin(env: { DB: D1Database }, agora: number): Promise<PainelAdmin> {
  const [contas, apelidos, progressos, atividades, naves, itens, missoes, saldos, frotaPorCasco] = await Promise.all([
    env.DB.prepare('SELECT usuario FROM contas').all<RegistroBase>(),
    env.DB.prepare('SELECT usuario, apelido FROM apelidos').all<RegistroDeApelido>(),
    env.DB.prepare('SELECT usuario, xp, melhor_setor FROM progresso').all<RegistroDeProgresso>(),
    env.DB.prepare('SELECT usuario, atualizado_em, estado FROM saves').all<RegistroDeAtividade>(),
    env.DB.prepare('SELECT usuario, COUNT(*) AS total FROM frota GROUP BY usuario').all<RegistroDeContagem>(),
    env.DB.prepare(`
      SELECT usuario,
             SUM(CASE WHEN nave IS NULL THEN 1 ELSE 0 END) AS itens_mochila,
             SUM(CASE WHEN nave IS NOT NULL THEN 1 ELSE 0 END) AS itens_equipados
        FROM itens
       GROUP BY usuario
    `).all<RegistroDeItens>(),
    env.DB.prepare(`
      SELECT usuario, COUNT(*) AS total
        FROM missoes
       WHERE entregue_em IS NOT NULL
       GROUP BY usuario
    `).all<RegistroDeContagem>(),
    env.DB.prepare('SELECT usuario, moeda, quantia FROM saldos').all<RegistroDeRecurso>(),
    env.DB.prepare('SELECT casco, COUNT(*) AS total FROM frota GROUP BY casco').all<RegistroDeCasco>(),
  ]);

  const porUsuario = new Map<string, AcumuladoDoJogador>();
  const garantir = (usuario: string): AcumuladoDoJogador => {
    let jogador = porUsuario.get(usuario);
    if (!jogador) {
      jogador = {
        apelido: null, xp: 0, melhorSetor: 1, ultimaAtividade: null,
        naves: 0, itensNaMochila: 0, itensEquipados: 0, missoesConcluidas: 0,
        tempoDeJogo: 0, recursos: {},
      };
      porUsuario.set(usuario, jogador);
    }
    return jogador;
  };

  for (const linha of contas.results ?? []) garantir(linha.usuario);
  for (const linha of apelidos.results ?? []) garantir(linha.usuario).apelido = linha.apelido;
  for (const linha of progressos.results ?? []) {
    const jogador = garantir(linha.usuario);
    jogador.xp = Number(linha.xp) || 0;
    jogador.melhorSetor = Math.max(1, Math.floor(Number(linha.melhor_setor) || 1));
  }
  for (const linha of atividades.results ?? []) {
    const jogador = garantir(linha.usuario);
    jogador.ultimaAtividade = Number(linha.atualizado_em) || null;
    try {
      const estado = JSON.parse(linha.estado) as { playtime?: unknown };
      jogador.tempoDeJogo = Math.max(0, Number(estado.playtime) || 0);
    } catch { /* save antigo ou truncado: atividade ainda vale, tempo não */ }
  }
  for (const linha of naves.results ?? []) garantir(linha.usuario).naves = Math.max(0, Number(linha.total) || 0);
  for (const linha of itens.results ?? []) {
    const jogador = garantir(linha.usuario);
    jogador.itensNaMochila = Math.max(0, Number(linha.itens_mochila) || 0);
    jogador.itensEquipados = Math.max(0, Number(linha.itens_equipados) || 0);
  }
  for (const linha of missoes.results ?? []) garantir(linha.usuario).missoesConcluidas = Math.max(0, Number(linha.total) || 0);
  for (const linha of saldos.results ?? []) {
    if (!linha.moeda) continue;
    garantir(linha.usuario).recursos[linha.moeda] = Math.max(0, Number(linha.quantia) || 0);
  }

  const desdeOnline = agora - JANELA_ONLINE_SEGUNDOS;
  const jogadores = [...porUsuario.entries()]
    .map(([usuario, linha]): JogadorDoPainelAdmin => ({
      codigo: usuario.slice(0, 8),
      apelido: linha.apelido,
      nivel: nivelDoPiloto(linha.xp),
      melhorSetor: linha.melhorSetor,
      naves: linha.naves,
      itensNaMochila: linha.itensNaMochila,
      itensEquipados: linha.itensEquipados,
      missoesConcluidas: linha.missoesConcluidas,
      tempoDeJogo: linha.tempoDeJogo,
      recursos: linha.recursos,
      online: (linha.ultimaAtividade ?? 0) > desdeOnline,
      ultimaAtividade: linha.ultimaAtividade,
    }))
    .sort((a, b) => (b.ultimaAtividade ?? 0) - (a.ultimaAtividade ?? 0) || a.codigo.localeCompare(b.codigo));

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
    total.tempoDeJogo += jogador.tempoDeJogo;
    return total;
  }, {
    jogadores: 0, online: 0, ativos24h: 0, ativos7d: 0, nivelMedio: 0,
    maiorNivel: 0, maiorSetor: 0, naves: 0, itensNaMochila: 0,
    itensEquipados: 0, missoesConcluidas: 0, tempoDeJogo: 0,
  });

  if (resumo.jogadores) resumo.nivelMedio = Math.round(resumo.nivelMedio / resumo.jogadores);

  const recursos = new Map<string, number>([['sucata', 0], ['nucleo', 0], ['cristal', 0]]);
  for (const jogador of jogadores) for (const [moeda, quantia] of Object.entries(jogador.recursos)) {
    recursos.set(moeda, (recursos.get(moeda) ?? 0) + quantia);
  }
  const galaxias = new Map<number, { indice: number; jogadores: number; maiorSetor: number }>();
  for (const jogador of jogadores) {
    const indice = Math.floor((jogador.melhorSetor - 1) / 10) + 1;
    const galáxia = galaxias.get(indice) ?? { indice, jogadores: 0, maiorSetor: 0 };
    galáxia.jogadores++;
    galáxia.maiorSetor = Math.max(galáxia.maiorSetor, jogador.melhorSetor);
    galaxias.set(indice, galáxia);
  }

  return {
    geradoEm: agora, janelaOnlineSegundos: JANELA_ONLINE_SEGUNDOS, resumo, jogadores,
    economia: { recursos: [...recursos].map(([moeda, quantia]) => ({ moeda, quantia })) },
    frota: { cascos: (frotaPorCasco.results ?? []).map((linha) => ({ casco: linha.casco, total: Number(linha.total) || 0 })) },
    galaxias: [...galaxias.values()].sort((a, b) => a.indice - b.indice),
  };
}
