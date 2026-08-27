import { usuarioDoToken } from './auth';
import { apelidoValido, conferir, lerPlacar, normalizar, type MarcaRecebida } from './placar';
import { podeGravar } from './ritmo';

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
 * Por isso o ritmo de gravação é limitado (ver `ritmo.ts`). Num jogo idle isso não
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

// O ritmo de gravação mora em `ritmo.ts`: é um balde de fichas, não um
// intervalo fixo. Ver lá o defeito que a mudança conserta.

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

/**
 * A origem, se ela estiver na lista.
 *
 * ## Por que existe um padrão, e por que ele é estreito
 *
 * A lista literal não cobre os deploys de PREVIEW da Vercel: cada um ganha um
 * host próprio (`orbita-zero-a1b2c3-conta.vercel.app`), e testar numa branch
 * batia em CORS — a sincronização falhava calada e o jogador via o save preso
 * no navegador sem nenhuma mensagem.
 *
 * A entrada `https://*.vercel.app` NÃO seria aceitável: qualquer pessoa publica
 * um site em `vercel.app` e passaria a poder falar com esta API usando as
 * credenciais de quem abrisse a página. O padrão aceito aqui exige o PREFIXO do
 * projeto — `orbita-zero-…` — que só quem tem acesso ao projeto consegue
 * produzir.
 *
 * Continua sem `*` em nenhuma hipótese.
 */
export const origemPermitida = (req: Request, env: Env): string => {
  const origem = req.headers.get('origin') ?? '';
  if (!origem) return '';

  for (const bruto of env.ORIGENS.split(',')) {
    const permitida = bruto.trim();
    if (!permitida) continue;
    if (permitida === origem) return origem;

    // Um `*` só vale como prefixo de host, e só num host completo. Nunca como
    // curinga solto.
    if (permitida.includes('*') && casaComPadrao(origem, permitida)) return origem;
  }
  return '';
};

/** `https://orbita-zero-*.vercel.app` casa com um preview, e só com ele. */
export function casaComPadrao(origem: string, padrao: string): boolean {
  const [antes, depois, ...resto] = padrao.split('*');
  // Um curinga só, e ele precisa de texto dos dois lados: `https://*` casaria
  // com o mundo inteiro.
  if (resto.length || !antes || !depois) return false;
  if (!antes.startsWith('https://')) return false;
  return origem.startsWith(antes)
    && origem.endsWith(depois)
    && origem.length > antes.length + depois.length
    // O miolo é um rótulo de host: nada de barra, ponto ou arroba lá dentro.
    && /^[a-z0-9-]+$/i.test(origem.slice(antes.length, origem.length - depois.length));
}

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
    .prepare('SELECT estado, versao, atualizado_em, versao_servidor FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ estado: string; versao: number; atualizado_em: number; versao_servidor: number }>();

  // `versaoServidor: 0` para quem nunca gravou. É o valor que o cliente manda de
  // volta no primeiro PUT, e é o que o INSERT espera encontrar.
  if (!linha) return json({ vazio: true, versaoServidor: 0 }, 200, origem);
  return json({
    estado: JSON.parse(linha.estado),
    versao: linha.versao,
    atualizadoEm: linha.atualizado_em,
    versaoServidor: linha.versao_servidor,
  }, 200, origem);
}

/**
 * Grava o save, se a versão bater e houver ficha.
 *
 * ## Concorrência otimista, e por que ela é necessária aqui
 *
 * O cliente manda `base`: a `versao_servidor` que ele conhecia. Se não for a
 * atual, ALGUÉM gravou no meio — outro PC, outra aba — e gravar por cima
 * apagaria aquele progresso sem ninguém notar. O 409 devolve o save do
 * servidor para o cliente decidir, em vez de escolher escondido.
 *
 * A alternativa era comparar carimbos de tempo do cliente, que foi o que havia
 * antes: dois computadores com relógios diferentes decidem errado, e o relógio
 * adiantado ganha sempre, inclusive contra progresso mais novo.
 */
async function subirSave(req: Request, env: Env, id: string, origem: string): Promise<Response> {
  const bruto = await req.text();
  if (bruto.length > SAVE_MAX_BYTES) return json({ erro: 'save_grande_demais' }, 413, origem);

  let corpo: { estado?: unknown; versao?: number; base?: number };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!corpo.estado || typeof corpo.versao !== 'number') {
    return json({ erro: 'corpo_incompleto' }, 400, origem);
  }

  const agora = Math.floor(Date.now() / 1000);
  const atual = await env.DB
    .prepare('SELECT versao_servidor, fichas, fichas_em, estado, atualizado_em FROM saves WHERE usuario = ?')
    .bind(id)
    .first<{ versao_servidor: number; fichas: number; fichas_em: number; estado: string; atualizado_em: number }>();

  const versaoAtual = atual?.versao_servidor ?? 0;
  const base = typeof corpo.base === 'number' ? corpo.base : versaoAtual;

  if (base !== versaoAtual) {
    // Conflito. Devolve o que está guardado para o cliente reconciliar — ele
    // sabe comparar progresso (tempo jogado), coisa que este Worker não faz de
    // propósito: abrir o save aqui obrigaria o servidor a entender o formato do
    // jogo, e toda mudança de save viraria deploy de servidor.
    return json({
      erro: 'conflito',
      versaoServidor: versaoAtual,
      estado: atual ? JSON.parse(atual.estado) : null,
      atualizadoEm: atual?.atualizado_em ?? 0,
    }, 409, origem);
  }

  const permissao = podeGravar(
    atual ? { fichas: atual.fichas, em: atual.fichas_em } : null,
    agora,
  );
  if (!permissao.pode) {
    // 429 e não 400: não é erro do cliente, é ritmo. A resposta diz quanto
    // falta para ele não ficar tentando.
    return json({ erro: 'cedo_demais', esperar: permissao.esperar }, 429, origem);
  }

  const nova = versaoAtual + 1;
  await env.DB
    .prepare(`INSERT INTO saves (usuario, estado, versao, atualizado_em, versao_servidor, fichas, fichas_em)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(usuario) DO UPDATE SET
                estado = excluded.estado,
                versao = excluded.versao,
                atualizado_em = excluded.atualizado_em,
                versao_servidor = excluded.versao_servidor,
                fichas = excluded.fichas,
                fichas_em = excluded.fichas_em`)
    .bind(id, JSON.stringify(corpo.estado), corpo.versao, agora, nova, permissao.fichasRestantes, agora)
    .run();

  return json({ ok: true, atualizadoEm: agora, versaoServidor: nova }, 200, origem);
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
