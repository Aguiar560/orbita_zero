import { usuarioDoToken } from './auth';
import { apelidoValido, conferir, lerPlacar, normalizar, type MarcaRecebida } from './placar';

/**
 * A API do Órbita Zero.
 *
 * ## O princípio, e ele governa tudo aqui
 *
 * **O servidor não confia no cliente.** A simulação roda no navegador, então
 * todo número que chega aqui foi calculado por uma máquina que o jogador
 * controla. Este Worker guarda o save e, no passo seguinte, vai conferir a
 * PLAUSIBILIDADE do que recebe contra as mesmas tabelas que o jogo usa.
 *
 * Guardar sem conferir já vale a pena — sincroniza entre dispositivos e
 * sobrevive a limpar o navegador. O que não vale é publicar um placar antes de
 * a conferência existir: um placar que aceita o que o cliente relata é
 * decoração.
 *
 * ## Orçamento da camada gratuita
 *
 * Workers dá 100 mil requisições por dia e D1 dá 100 mil ESCRITAS de linha por
 * dia. Com mil jogadores registrados e uns oitenta simultâneos no pico, salvar
 * a cada 60s daria ~115 mil — estoura os dois.
 *
 * Por isso `INTERVALO_MINIMO_DE_SAVE` existe e é grande. Num jogo idle isso não
 * custa quase nada: o progresso é função do TEMPO, e o cliente recalcula o que
 * passou desde o último save. Perder dois minutos de relógio não é perder duas
 * jogadas.
 */

export interface Env {
  DB: D1Database;
  /** `https://<ref>.supabase.co`. Não é segredo — é o endereço do JWKS. */
  SUPABASE_URL: string;
  /** Origens que podem chamar esta API, separadas por vírgula. */
  ORIGENS: string;
}

/**
 * Intervalo mínimo entre gravações do mesmo jogador, em segundos.
 *
 * É o botão que faz a conta da camada gratuita fechar. Ver o cálculo acima.
 * Também é a defesa mais barata contra um cliente com defeito que salve em
 * laço — sem ele, um bug de um jogador consome a cota de todos.
 */
const INTERVALO_MINIMO_DE_SAVE = 120;

/** Teto do corpo do save, em bytes. */
const SAVE_MAX_BYTES = 512 * 1024;

const json = (dados: unknown, status = 200, origem = ''): Response =>
  new Response(JSON.stringify(dados), {
    status,
    headers: {
      'content-type': 'application/json',
      ...cabecalhosDeOrigem(origem),
      // O save é dado de conta: nenhum intermediário deve guardá-lo.
      'cache-control': 'no-store',
    },
  });

/**
 * CORS por lista, nunca `*`.
 *
 * `*` seria mais simples e erraria feio: qualquer página aberta pelo jogador
 * poderia falar com esta API usando as credenciais dele.
 */
function cabecalhosDeOrigem(origem: string): Record<string, string> {
  if (!origem) return {};
  return {
    'access-control-allow-origin': origem,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'vary': 'origin',
  };
}

const origemPermitida = (req: Request, env: Env): string => {
  const origem = req.headers.get('origin') ?? '';
  const lista = env.ORIGENS.split(',').map((o) => o.trim()).filter(Boolean);
  return lista.includes(origem) ? origem : '';
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origem = origemPermitida(req, env);
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecalhosDeOrigem(origem) });
    }

    // Saúde: sem autenticação de propósito. É o endpoint que prova que a
    // infraestrutura subiu, e exigir login para isso faria depurar um deploy
    // depender de o login já funcionar.
    if (url.pathname === '/saude') {
      return json({ ok: true, agora: new Date().toISOString() }, 200, origem);
    }

    const usuario = await usuarioDoToken(req.headers.get('authorization'), env.SUPABASE_URL);
    if (!usuario) return json({ erro: 'nao_autenticado' }, 401, origem);

    if (url.pathname === '/save') {
      if (req.method === 'GET') return baixarSave(env, usuario.id, origem);
      if (req.method === 'PUT') return subirSave(req, env, usuario.id, origem);
    }

    if (url.pathname === '/apelido' && req.method === 'PUT') {
      return definirApelido(req, env, usuario.id, origem);
    }

    if (url.pathname === '/marcas' && req.method === 'PUT') {
      return enviarMarcas(req, env, usuario.id, origem);
    }

    if (url.pathname === '/placar' && req.method === 'GET') {
      const qual = url.searchParams.get('id') ?? '';
      const dados = await lerPlacar(env, qual, usuario.id);
      return json(dados, 200, origem);
    }

    return json({ erro: 'nao_encontrado' }, 404, origem);
  },
} satisfies ExportedHandler<Env>;

async function baixarSave(env: Env, id: string, origem: string): Promise<Response> {
  const linha = await env.DB
    .prepare('SELECT estado, versao, atualizado_em FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ estado: string; versao: number; atualizado_em: number }>();

  if (!linha) return json({ vazio: true }, 200, origem);
  return json({
    estado: JSON.parse(linha.estado),
    versao: linha.versao,
    atualizadoEm: linha.atualizado_em,
  }, 200, origem);
}

async function subirSave(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > SAVE_MAX_BYTES) return json({ erro: 'save_grande_demais' }, 413, origem);

  let corpo: { estado?: unknown; versao?: number };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!corpo.estado || typeof corpo.versao !== 'number') {
    return json({ erro: 'corpo_incompleto' }, 400, origem);
  }

  const agora = Math.floor(Date.now() / 1000);
  const anterior = await env.DB
    .prepare('SELECT atualizado_em FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ atualizado_em: number }>();

  if (anterior && agora - anterior.atualizado_em < INTERVALO_MINIMO_DE_SAVE) {
    // 429 e não 400: não é erro do cliente, é ritmo. A resposta diz quanto
    // falta para ele não ficar tentando.
    return json({
      erro: 'cedo_demais',
      esperar: INTERVALO_MINIMO_DE_SAVE - (agora - anterior.atualizado_em),
    }, 429, origem);
  }

  await env.DB
    .prepare(`INSERT INTO saves (usuario, estado, versao, atualizado_em)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(usuario) DO UPDATE SET
                estado = excluded.estado,
                versao = excluded.versao,
                atualizado_em = excluded.atualizado_em`)
    .bind(id, JSON.stringify(corpo.estado), corpo.versao, agora)
    .run();

  return json({ ok: true, atualizadoEm: agora }, 200, origem);
}


// ── placar ─────────────────────────────────────────────────────────────────

/**
 * Reivindica o apelido público do jogador.
 *
 * A unicidade é do banco (`apelido_normal UNIQUE`) e não de um SELECT antes do
 * INSERT: entre a checagem e a escrita cabem duas requisições simultâneas, e o
 * segundo lugar levaria o mesmo nome. Deixar a restrição falhar é a única forma
 * que não tem janela.
 */
async function definirApelido(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  let corpo: { apelido?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const apelido = apelidoValido(corpo.apelido);
  if (!apelido) return json({ erro: 'apelido_invalido' }, 400, origem);

  try {
    await env.DB.prepare(`
      INSERT INTO apelidos (usuario, apelido, apelido_normal, criado_em)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(usuario) DO UPDATE SET
        apelido = excluded.apelido,
        apelido_normal = excluded.apelido_normal
    `).bind(id, apelido, normalizar(apelido), Math.floor(Date.now() / 1000)).run();
  } catch {
    // A única restrição que pode estourar aqui é a de `apelido_normal`.
    return json({ erro: 'apelido_em_uso' }, 409, origem);
  }

  return json({ ok: true, apelido }, 200, origem);
}

/**
 * Recebe as marcas do jogador, uma por placar.
 *
 * Cada marca é conferida SOZINHA: uma recusada não derruba as outras. O
 * jogador que subiu de nível legitimamente e tem um andar de Provação
 * implausível deve ter o nível registrado — e a resposta diz o que foi recusado.
 */
async function enviarMarcas(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  let corpo: { marcas?: MarcaRecebida[] };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!Array.isArray(corpo.marcas)) return json({ erro: 'corpo_incompleto' }, 400, origem);
  // Teto de itens: o placar de naves tem uma marca por casco, e são ~50.
  if (corpo.marcas.length > 80) return json({ erro: 'marcas_demais' }, 413, origem);

  const temApelido = await env.DB.prepare('SELECT 1 FROM apelidos WHERE usuario = ?').bind(id).first();
  if (!temApelido) return json({ erro: 'sem_apelido' }, 409, origem);

  const agora = Math.floor(Date.now() / 1000);
  const aceitas: string[] = [];
  const recusadas: { placar: string; casco: string; motivo: string }[] = [];

  for (const m of corpo.marcas) {
    const casco = typeof m.casco === 'string' ? m.casco.slice(0, 40) : '';
    const anterior = await env.DB
      .prepare('SELECT valor, desempate, atualizado_em FROM marcas WHERE usuario = ? AND placar = ? AND casco = ?')
      .bind(id, m.placar, casco)
      .first<{ valor: number; desempate: number; atualizado_em: number }>();

    const v = conferir(m, anterior, agora);
    if (!v.ok) {
      recusadas.push({ placar: String(m.placar), casco, motivo: v.motivo });
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO marcas (usuario, placar, casco, valor, desempate, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario, placar, casco) DO UPDATE SET
        valor = excluded.valor,
        desempate = excluded.desempate,
        atualizado_em = excluded.atualizado_em
    `).bind(id, m.placar, casco, v.valor, v.desempate, agora).run();
    aceitas.push(`${m.placar}${casco ? ':' + casco : ''}`);
  }

  return json({ ok: true, aceitas, recusadas }, 200, origem);
}
