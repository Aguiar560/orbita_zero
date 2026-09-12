/**
 * Verificação do token do Supabase, dentro do Worker.
 *
 * ## Assinatura local, confirmação de e-mail autoritativa
 *
 * O Supabase assina os tokens com ES256 e publica as chaves PÚBLICAS num JWKS.
 * Isso permite ao Worker conferir assinatura, emissor e validade sozinho. A
 * confirmação de e-mail é diferente: ela não é uma claim obrigatória do JWT,
 * então, depois dessa conferência local, consultamos `/auth/v1/user`. A resposta
 * é armazenada por poucos minutos no isolate para não colocar uma ida de rede
 * em todo pedido.
 *
 * As duas alternativas são piores:
 *
 * - **Confiar em `user_metadata`** deixaria o próprio jogador declarar que
 *   confirmou o e-mail. A autorização usa apenas o registro oficial do Auth.
 * - **Guardar o segredo HS256 no Worker** significa que um vazamento do Worker
 *   permite FORJAR tokens, não só ler os que passaram. Com ES256 a chave
 *   privada nunca sai do servidor de autenticação — o pior caso aqui é um
 *   atacante conseguir verificar assinaturas, que é o que qualquer um já pode
 *   fazer com uma chave pública.
 */

import { SUPABASE_ANON } from '@data/servidor';

export interface Usuario {
  /** `sub` do token: o id do usuário no Supabase. É a chave de tudo. */
  id: string;
  email?: string;
  anonima: boolean;
  expiraEm: number;
  confirmacaoEmail: EstadoDaConfirmacaoEmail;
}

export type EstadoDaConfirmacaoEmail =
  | 'confirmado'
  | 'nao_confirmado'
  | 'configuracao_insegura'
  | 'token_invalido'
  | 'indisponivel';

interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
}

/**
 * Cache de chaves, por isolate do Worker.
 *
 * Vive na memória do isolate e some quando ele recicla — o que é o
 * comportamento desejado: um cache que persistisse seria um cache que
 * envelheceria. A borda do Supabase já guarda o JWKS por 10 minutos, então nem
 * o pior caso (isolate novo a cada requisição) chega a castigar o servidor de
 * autenticação.
 */
let chaves: Map<string, CryptoKey> | null = null;
let buscando: Promise<Map<string, CryptoKey>> | null = null;

let configuracaoEmail: { estado: 'obrigatoria' | 'insegura' | 'indisponivel'; ate: number } | null = null;
const confirmacoesEmail = new Map<string, { estado: EstadoDaConfirmacaoEmail; ate: number }>();

/**
 * Confere somente os campos autoritativos devolvidos pelo Supabase Auth.
 *
 * Separada da chamada HTTP para a regra poder ser testada sem fabricar JWT ou
 * depender da rede. O id também precisa coincidir: uma resposta válida sobre
 * outra conta nunca confirma o token apresentado.
 */
export function perfilTemEmailConfirmado(
  perfil: { id?: string; email?: string; email_confirmed_at?: string | null },
  usuarioEsperado: string,
): boolean {
  return perfil.id === usuarioEsperado
    && Boolean(perfil.email)
    && Boolean(perfil.email_confirmed_at);
}

async function estadoDaConfiguracaoEmail(urlBase: string): Promise<'obrigatoria' | 'insegura' | 'indisponivel'> {
  const agora = Date.now();
  if (configuracaoEmail && configuracaoEmail.ate > agora) return configuracaoEmail.estado;
  try {
    const resposta = await fetch(`${urlBase}/auth/v1/settings`, {
      headers: { apikey: CHAVE_PUBLICA_SUPABASE },
    });
    if (!resposta.ok) throw new Error(`settings ${resposta.status}`);
    const dados = await resposta.json() as { mailer_autoconfirm?: boolean };
    const estado = dados.mailer_autoconfirm === false ? 'obrigatoria' : 'insegura';
    configuracaoEmail = { estado, ate: agora + 60_000 };
    return estado;
  } catch {
    configuracaoEmail = { estado: 'indisponivel', ate: agora + 15_000 };
    return 'indisponivel';
  }
}

// Pública por desenho. É a mesma anon key embarcada no cliente; nunca usar
// service_role aqui, pois ela ampliaria privilégio sem necessidade.
const CHAVE_PUBLICA_SUPABASE = SUPABASE_ANON;

async function confirmarEmailNoAuth(
  token: string, urlBase: string, usuario: string, expiraEm: number,
): Promise<EstadoDaConfirmacaoEmail> {
  const configuracao = await estadoDaConfiguracaoEmail(urlBase);
  if (configuracao === 'insegura') return 'configuracao_insegura';
  if (configuracao === 'indisponivel') return 'indisponivel';

  const agora = Date.now();
  const chave = `${usuario}:${expiraEm}`;
  const guardada = confirmacoesEmail.get(chave);
  if (guardada && guardada.ate > agora) return guardada.estado;
  try {
    const resposta = await fetch(`${urlBase}/auth/v1/user`, {
      headers: { apikey: CHAVE_PUBLICA_SUPABASE, authorization: `Bearer ${token}` },
    });
    if (resposta.status === 401 || resposta.status === 403) return 'token_invalido';
    if (!resposta.ok) return 'indisponivel';
    const perfil = await resposta.json() as {
      id?: string; email?: string; email_confirmed_at?: string | null;
    };
    const estado: EstadoDaConfirmacaoEmail = perfil.id !== usuario
      ? 'token_invalido'
      : perfilTemEmailConfirmado(perfil, usuario) ? 'confirmado' : 'nao_confirmado';
    if (confirmacoesEmail.size > 1_000) confirmacoesEmail.clear();
    confirmacoesEmail.set(chave, { estado, ate: agora + (estado === 'confirmado' ? 300_000 : 30_000) });
    return estado;
  } catch {
    return 'indisponivel';
  }
}

async function carregarChaves(urlBase: string): Promise<Map<string, CryptoKey>> {
  // `/auth/v1/.well-known/jwks.json`, e nao `/auth/v1/jwks`.
  //
  // O segundo existe e responde 401 pedindo cabecalho `apikey` — descoberto
  // testando contra um projeto real, nao lendo documentacao. O caminho
  // .well-known e publico por desenho, que e o que permite a este Worker nao
  // guardar credencial nenhuma.
  const resposta = await fetch(`${urlBase}/auth/v1/.well-known/jwks.json`);
  if (!resposta.ok) throw new Error(`jwks ${resposta.status}`);
  const { keys } = (await resposta.json()) as { keys: Jwk[] };

  const mapa = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    // Só ES256. Um JWKS do Supabase pode trazer junto a chave simétrica antiga
    // (HS256), e importá-la aqui reabriria a porta que o assimétrico fechou:
    // quem tem a chave simétrica assina, não só confere.
    if (!jwk.kid || jwk.kty !== 'EC') continue;
    try {
      mapa.set(jwk.kid, await crypto.subtle.importKey(
        'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
      ));
    } catch {
      // Chave que não importa é chave que não serve. Seguir com as outras é
      // melhor que derrubar a autenticação inteira por uma entrada estranha.
    }
  }
  return mapa;
}

/** Busca as chaves uma vez por isolate, sem estouro de chamadas simultâneas. */
async function chavesDe(urlBase: string, forcar = false): Promise<Map<string, CryptoKey>> {
  if (chaves && !forcar) return chaves;
  // Sem esta coalescência, uma rajada de requisições num isolate frio dispara
  // uma busca de JWKS por requisição.
  buscando ??= carregarChaves(urlBase).then((m) => { chaves = m; buscando = null; return m; });
  return buscando;
}

const b64url = (texto: string): Uint8Array => {
  const base = texto.replace(/-/g, '+').replace(/_/g, '/');
  const cru = atob(base.padEnd(base.length + ((4 - (base.length % 4)) % 4), '='));
  return Uint8Array.from(cru, (c) => c.charCodeAt(0));
};

/**
 * Confere o token e devolve quem é. `null` = não autenticado.
 *
 * Devolve `null` para TODOS os modos de falha, de propósito: token expirado,
 * assinatura errada, emissor errado e token ausente não são distinguidos na
 * resposta. Dizer qual foi ajuda quem está testando um ataque muito mais do que
 * ajuda quem tem um cliente correto — o cliente correto só precisa saber que
 * deve entrar de novo.
 */
export async function usuarioDoToken(
  authorization: string | null,
  urlBase: string,
): Promise<Usuario | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    const [cabecalhoB64, cargaB64, assinaturaB64] = partes as [string, string, string];
    const cabecalho = JSON.parse(new TextDecoder().decode(b64url(cabecalhoB64))) as { kid?: string; alg?: string };
    if (cabecalho.alg !== 'ES256' || !cabecalho.kid) return null;

    let mapa = await chavesDe(urlBase);
    let chave = mapa.get(cabecalho.kid);
    if (!chave) {
      // `kid` desconhecido é o sinal de rotação de chave. Recarregar UMA vez é
      // o que faz a rotação passar despercebida; recarregar sempre que um kid
      // não bate transformaria token forjado em ataque de negação de serviço
      // contra o JWKS.
      mapa = await chavesDe(urlBase, true);
      chave = mapa.get(cabecalho.kid);
      if (!chave) return null;
    }

    const assinado = new TextEncoder().encode(`${cabecalhoB64}.${cargaB64}`);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, chave, b64url(assinaturaB64), assinado,
    );
    if (!ok) return null;

    const carga = JSON.parse(new TextDecoder().decode(b64url(cargaB64))) as {
      sub?: string; exp?: number; iss?: string; email?: string; is_anonymous?: boolean;
    };

    // A assinatura só prova que o token é AUTÊNTICO. Que ele ainda vale, e que
    // foi emitido para este projeto, são perguntas separadas — e pular a
    // segunda aceitaria um token legítimo de OUTRO projeto Supabase, que
    // qualquer pessoa pode criar de graça.
    const agora = Math.floor(Date.now() / 1000);
    if (!carga.sub) return null;
    if (typeof carga.exp !== 'number' || carga.exp <= agora) return null;
    if (carga.iss !== `${urlBase}/auth/v1`) return null;

    const confirmacaoEmail = await confirmarEmailNoAuth(token, urlBase, carga.sub, carga.exp);
    return {
      id: carga.sub, email: carga.email,
      anonima: carga.is_anonymous ?? !carga.email,
      expiraEm: carga.exp, confirmacaoEmail,
    };
  } catch {
    return null;
  }
}
