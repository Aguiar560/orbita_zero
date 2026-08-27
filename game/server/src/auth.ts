/**
 * Verificação do token do Supabase, dentro do Worker.
 *
 * ## Por que verificamos aqui, e não perguntamos ao Supabase
 *
 * O Supabase assina os tokens com ES256 e publica as chaves PÚBLICAS num JWKS.
 * Isso permite ao Worker conferir a assinatura sozinho, com WebCrypto, sem
 * nenhum segredo compartilhado guardado aqui e sem uma ida à rede por
 * requisição.
 *
 * As duas alternativas são piores:
 *
 * - **Chamar o Supabase a cada requisição** (`/auth/v1/user`) acrescenta a
 *   latência de uma rede inteira ao caminho quente, e faz a disponibilidade do
 *   login virar a disponibilidade do jogo.
 * - **Guardar o segredo HS256 no Worker** significa que um vazamento do Worker
 *   permite FORJAR tokens, não só ler os que passaram. Com ES256 a chave
 *   privada nunca sai do servidor de autenticação — o pior caso aqui é um
 *   atacante conseguir verificar assinaturas, que é o que qualquer um já pode
 *   fazer com uma chave pública.
 */

export interface Usuario {
  /** `sub` do token: o id do usuário no Supabase. É a chave de tudo. */
  id: string;
  email?: string;
}

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

async function carregarChaves(urlBase: string): Promise<Map<string, CryptoKey>> {
  const resposta = await fetch(`${urlBase}/auth/v1/jwks`);
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
      sub?: string; exp?: number; iss?: string; email?: string;
    };

    // A assinatura só prova que o token é AUTÊNTICO. Que ele ainda vale, e que
    // foi emitido para este projeto, são perguntas separadas — e pular a
    // segunda aceitaria um token legítimo de OUTRO projeto Supabase, que
    // qualquer pessoa pode criar de graça.
    const agora = Math.floor(Date.now() / 1000);
    if (!carga.sub) return null;
    if (typeof carga.exp !== 'number' || carga.exp <= agora) return null;
    if (carga.iss !== `${urlBase}/auth/v1`) return null;

    return { id: carga.sub, email: carga.email };
  } catch {
    return null;
  }
}
