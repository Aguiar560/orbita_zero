import { usuarioDoToken } from './auth';
import { apelidoValido, conferir, lerPlacar, normalizar, type MarcaRecebida } from './placar';
import { podeGravar, podeLer, podeUsar, type NomeDeBalde } from './ritmo';
import {
  MOEDAS, conferirLancamento, podeDebitar, saldosDoLivro,
  type Lancamento, type Moeda, type Recusa,
} from './carteira';

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

/**
 * Teto de corpo das rotas pequenas.
 *
 * 64 KB cabe oitenta marcas com folga larga e não cabe um corpo inflado de
 * propósito. O `/save` tem teto próprio porque ele é grande por natureza.
 */
const CORPO_MAX_BYTES = 64 * 1024;

/**
 * Desde quando o servidor conhece esta conta, em epoch de segundos.
 *
 * ## Por que o valor nunca vem do cliente
 *
 * É o orçamento de progresso: uma conta de dez minutos não pode ter chegado ao
 * topo da Provação. Se o cliente pudesse dizer sua própria idade, bastaria
 * mentir aqui para liberar qualquer marca — o número perderia justamente a
 * propriedade que o torna útil.
 *
 * ## O que acontece com quem já existia
 *
 * A tabela nasceu depois de haver jogadores. Para esses, a idade é semeada de
 * `saves.atualizado_em`, que também é relógio do SERVIDOR e é um limite
 * inferior honesto: quem já gravou um save há três dias existe há pelo menos
 * três dias.
 *
 * Sem isso, todo jogador atual viraria "conta nova" no dia do deploy e teria a
 * própria marca recusada — o modo de falhar mais fácil de causar aqui, e o mais
 * difícil de entender pelo lado de quem joga.
 */
async function contaDesde(env: Env, usuario: string, agora: number): Promise<number> {
  const existente = await env.DB
    .prepare('SELECT primeiro_em FROM contas WHERE usuario = ?')
    .bind(usuario)
    .first<{ primeiro_em: number }>();
  if (existente) return existente.primeiro_em;

  // Conta nova nasce AGORA. Não há semente a buscar, e a primeira versão disto
  // buscava: ela usava `saves.atualizado_em`, e estava errada de dois jeitos.
  //
  // Errada de fato, porque `atualizado_em` é a gravação MAIS RECENTE — medido
  // contra o banco de produção antes de publicar, a conta existente tinha save
  // de 94 segundos atrás e marca de galáxia 201; o orçamento dela teria sido
  // ~61, e a próxima sincronização seria recusada em silêncio.
  //
  // E errada de princípio, porque qualquer semente derivada do estado atual do
  // jogador vira brecha: bastaria gravar um save antes de mandar a primeira
  // marca para comprar idade.
  //
  // Quem já existia antes desta tabela foi apadrinhado na migração 0004 — o
  // único lugar onde isso pode acontecer sem virar porta, porque roda uma vez.
  const primeiro = agora;

  await env.DB
    .prepare('INSERT INTO contas (usuario, primeiro_em) VALUES (?, ?) ON CONFLICT(usuario) DO NOTHING')
    .bind(usuario, primeiro)
    .run();

  return primeiro;
}

/**
 * Consome uma ficha do balde do jogador, ou diz quanto falta esperar.
 *
 * O balde vive em `limites`, uma linha por (usuário, assunto) — ver a migração
 * 0003 para o motivo de não ser mais colunas em `saves`.
 *
 * Custa uma leitura e uma escrita por chamada. Vale a pena nas rotas que
 * ESCREVEM (uma chamada de `/marcas` pode virar oitenta linhas); não valeria
 * numa rota de leitura, e por isso `GET /placar` usa balde em memória.
 */
async function consumirFicha(
  env: Env,
  usuario: string,
  balde: NomeDeBalde,
  agora: number,
): Promise<{ pode: true } | { pode: false; esperar: number }> {
  const linha = await env.DB
    .prepare('SELECT fichas, em FROM limites WHERE usuario = ? AND balde = ?')
    .bind(usuario, balde)
    .first<{ fichas: number; em: number }>();

  const v = podeUsar(balde, linha ? { fichas: linha.fichas, em: linha.em } : null, agora);
  if (!v.pode) return { pode: false, esperar: v.esperar };

  await env.DB.prepare(`
    INSERT INTO limites (usuario, balde, fichas, em) VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario, balde) DO UPDATE SET fichas = excluded.fichas, em = excluded.em
  `).bind(usuario, balde, v.fichasRestantes, agora).run();

  return { pode: true };
}

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
      // Leitura barata, mas não de graça: são três consultas por chamada, e o
      // painel pergunta a cada vinte segundos com a tela aberta. O balde em
      // memória cabe isso e não cabe um laço.
      if (!podeLer(usuario.id, Math.floor(Date.now() / 1000))) {
        return json({ erro: 'rapido_demais' }, 429, origem);
      }
      const qual = url.searchParams.get('id') ?? '';
      const casco = (url.searchParams.get('casco') ?? '').slice(0, 40);
      const dados = await lerPlacar(env, qual, usuario.id, casco);
      return json(dados, 200, origem);
    }

    if (url.pathname === '/carteira' && req.method === 'GET') {
      // Mesma defesa do placar: leitura barata, mas perguntada com frequência
      // pela tela da Loja. Balde em memória, não linha no banco.
      if (!podeLer(usuario.id, Math.floor(Date.now() / 1000))) {
        return json({ erro: 'rapido_demais' }, 429, origem);
      }
      return json({ saldos: await saldosDe(env, usuario.id) }, 200, origem);
    }

    return json({ erro: 'nao_encontrado' }, 404, origem);
  },
} satisfies ExportedHandler<Env>;

// ── carteira ────────────────────────────────────────────────────────────────

/**
 * Os saldos do jogador, do cache.
 *
 * Lê `saldos` e não soma `transacoes`: somar a história inteira a cada
 * requisição funciona no primeiro mês e fica caro no primeiro ano. O livro
 * continua sendo a verdade — `saldosDoLivroDe` reconstrói quando é preciso
 * conferir, e é o que a auditoria do pódio vai usar.
 */
async function saldosDe(env: Env, usuario: string): Promise<Record<Moeda, number>> {
  const { results } = await env.DB
    .prepare('SELECT moeda, quantia FROM saldos WHERE usuario = ?')
    .bind(usuario)
    .all<{ moeda: string; quantia: number }>();

  const r = {} as Record<Moeda, number>;
  for (const m of MOEDAS) r[m] = 0;
  for (const linha of results) {
    if ((MOEDAS as readonly string[]).includes(linha.moeda)) r[linha.moeda as Moeda] = linha.quantia;
  }
  return r;
}

/** Reconstrói os saldos a partir do livro. A verdade, para conferir o cache. */
export async function saldosDoLivroDe(env: Env, usuario: string): Promise<Record<Moeda, number>> {
  const { results } = await env.DB
    .prepare('SELECT usuario, moeda, quantia, motivo, origem, em FROM transacoes WHERE usuario = ?')
    .bind(usuario)
    .all<Lancamento>();
  return saldosDoLivro(results);
}

/**
 * Grava um lançamento e move o saldo, atomicamente.
 *
 * ## Por que `batch` e não duas chamadas
 *
 * `batch` do D1 é uma transação: ou as duas linhas entram, ou nenhuma. Sem
 * isso existiria o intervalo em que o saldo já mudou e o livro ainda não sabe
 * — e é exatamente o estado que torna a auditoria impossível, porque não há
 * como distinguir "faltou gravar" de "alguém mexeu".
 *
 * ## Por que o débito é condicional
 *
 * O `WHERE quantia >= ?` recusa no próprio banco em vez de ler o saldo antes e
 * decidir aqui. Ler-decidir-escrever tem uma janela entre a leitura e a
 * escrita, e dois pedidos ao mesmo tempo passariam os dois pela mesma leitura.
 * Com a condição no UPDATE, o segundo encontra o saldo já baixado e não muda
 * linha nenhuma.
 */
export async function lancar(env: Env, l: Lancamento): Promise<{ ok: true } | { ok: false; erro: Recusa | 'repetido' }> {
  const recusa = conferirLancamento(l);
  if (recusa) return { ok: false, erro: recusa };

  if (l.quantia < 0) {
    const saldo = (await saldosDe(env, l.usuario))[l.moeda];
    if (!podeDebitar(saldo, -l.quantia)) return { ok: false, erro: 'saldo_insuficiente' };
  }

  const inserir = env.DB.prepare(
    'INSERT INTO transacoes (usuario, moeda, quantia, motivo, origem, em) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(l.usuario, l.moeda, l.quantia, l.motivo, l.origem ?? null, l.em);

  // O crédito cria a linha se não existir; o débito exige que ela exista COM
  // saldo suficiente, e por isso não pode usar `ON CONFLICT`.
  const mover = l.quantia > 0
    ? env.DB.prepare(`
        INSERT INTO saldos (usuario, moeda, quantia, atualizado_em) VALUES (?, ?, ?, ?)
        ON CONFLICT(usuario, moeda) DO UPDATE SET
          quantia = quantia + excluded.quantia, atualizado_em = excluded.atualizado_em
      `).bind(l.usuario, l.moeda, l.quantia, l.em)
    : env.DB.prepare(`
        UPDATE saldos SET quantia = quantia - ?, atualizado_em = ?
         WHERE usuario = ? AND moeda = ? AND quantia >= ?
      `).bind(-l.quantia, l.em, l.usuario, l.moeda, -l.quantia);

  try {
    const [, r] = await env.DB.batch([inserir, mover]);
    // Débito que não moveu linha perdeu a corrida: o saldo caiu entre a
    // conferência acima e este UPDATE. A transação inteira é revertida pelo
    // `batch`, então não sobra lançamento órfão.
    if (l.quantia < 0 && r.meta.changes === 0) return { ok: false, erro: 'saldo_insuficiente' };
    return { ok: true };
  } catch {
    // O índice único em (motivo, origem) barrou: este evento externo já foi
    // processado. É o caminho normal quando o provedor de pagamento reenvia o
    // webhook, e não um erro.
    return { ok: false, erro: 'repetido' };
  }
}

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
  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { apelido?: unknown };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }

  const apelido = apelidoValido(corpo.apelido);
  if (!apelido) return json({ erro: 'apelido_invalido' }, 400, origem);

  // A ficha é cobrada DEPOIS da validação de formato: recusar um nome mal
  // digitado não pode gastar a cota de quem está tentando escolher um. Mas
  // ANTES da escrita, que é o que precisa ser limitado — inclusive a tentativa
  // de varrer nomes livres um por um.
  const ritmo = await consumirFicha(env, id, 'apelido', Math.floor(Date.now() / 1000));
  if (!ritmo.pode) return json({ erro: 'cedo_demais', esperar: ritmo.esperar }, 429, origem);

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
  const bruto = await req.text();
  if (bruto.length > CORPO_MAX_BYTES) return json({ erro: 'corpo_grande_demais' }, 413, origem);

  let corpo: { marcas?: MarcaRecebida[] };
  try {
    corpo = JSON.parse(bruto) as typeof corpo;
  } catch {
    return json({ erro: 'json_invalido' }, 400, origem);
  }
  if (!Array.isArray(corpo.marcas)) return json({ erro: 'corpo_incompleto' }, 400, origem);
  // Teto de itens: o placar de naves tem uma marca por casco, e são ~50.
  if (corpo.marcas.length > 80) return json({ erro: 'marcas_demais' }, 413, origem);

  const temApelido = await env.DB.prepare('SELECT 1 FROM apelidos WHERE usuario = ?').bind(id).first();
  if (!temApelido) return json({ erro: 'sem_apelido' }, 409, origem);

  const agora = Math.floor(Date.now() / 1000);
  const desde = await contaDesde(env, id, agora);

  // Esta é a rota mais cara do servidor: uma chamada podia virar oitenta
  // leituras e oitenta escritas. Sem limite, um cliente em laço queimava a cota
  // diária de escrita do D1 — que é COMPARTILHADA por todos os jogadores.
  const ritmo = await consumirFicha(env, id, 'marcas', agora);
  if (!ritmo.pode) return json({ erro: 'cedo_demais', esperar: ritmo.esperar }, 429, origem);

  /**
   * As marcas atuais do jogador, numa consulta só.
   *
   * Eram oitenta `SELECT`, um por marca, dentro do laço. O jogador tem no
   * máximo algumas dezenas de linhas no total — trazer todas de uma vez custa
   * uma consulta e evita as outras setenta e nove.
   */
  const atuais = new Map<string, { valor: number; desempate: number; atualizado_em: number }>();
  const linhas = await env.DB
    .prepare('SELECT placar, casco, valor, desempate, atualizado_em FROM marcas WHERE usuario = ?')
    .bind(id)
    .all<{ placar: string; casco: string; valor: number; desempate: number; atualizado_em: number }>();
  for (const l of linhas.results ?? []) atuais.set(`${l.placar}:${l.casco}`, l);

  const aceitas: string[] = [];
  const recusadas: { placar: string; casco: string; motivo: string }[] = [];

  for (const m of corpo.marcas) {
    const casco = typeof m.casco === 'string' ? m.casco.slice(0, 40) : '';
    const anterior = atuais.get(`${m.placar}:${casco}`) ?? null;

    const v = conferir(m, anterior, agora, desde);
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
