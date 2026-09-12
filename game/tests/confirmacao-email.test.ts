import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const b64url = (valor: string | ArrayBuffer): string => {
  const bytes = typeof valor === 'string' ? new TextEncoder().encode(valor) : new Uint8Array(valor);
  return Buffer.from(bytes).toString('base64url');
};

async function tokenAssinado(urlBase: string, usuario: string): Promise<{
  token: string;
  jwk: JsonWebKey;
}> {
  const par = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await webcrypto.subtle.exportKey('jwk', par.publicKey);
  jwk.kid = 'chave-do-teste';
  jwk.alg = 'ES256';
  const cabecalho = b64url(JSON.stringify({ alg: 'ES256', kid: jwk.kid }));
  const carga = b64url(JSON.stringify({
    sub: usuario,
    email: 'piloto@orbita.zero',
    iss: `${urlBase}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3_600,
  }));
  const assinatura = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, par.privateKey,
    new TextEncoder().encode(`${cabecalho}.${carga}`),
  );
  return { token: `${cabecalho}.${carga}.${b64url(assinatura)}`, jwk };
}

async function autenticar(emailConfirmado: string | null, autoConfirmar = false) {
  vi.resetModules();
  const urlBase = 'https://auth-teste.supabase.co';
  const usuario = 'piloto-1';
  const { token, jwk } = await tokenAssinado(urlBase, usuario);
  const requisicoes: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (entrada: string | URL | Request) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    requisicoes.push(url);
    if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/auth/v1/settings')) return Response.json({ mailer_autoconfirm: autoConfirmar });
    if (url.endsWith('/auth/v1/user')) return Response.json({
      id: usuario, email: 'piloto@orbita.zero', email_confirmed_at: emailConfirmado,
    });
    return new Response(null, { status: 404 });
  }));

  const { usuarioDoToken } = await import('../server/src/auth');
  return {
    resultado: await usuarioDoToken(`Bearer ${token}`, urlBase),
    requisicoes,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('confirmação autoritativa de e-mail', () => {
  it('libera somente o perfil com e-mail confirmado no Supabase Auth', async () => {
    const { resultado, requisicoes } = await autenticar('2026-09-12T12:00:00Z');
    expect(resultado?.confirmacaoEmail).toBe('confirmado');
    expect(requisicoes.some((url) => url.endsWith('/auth/v1/user'))).toBe(true);
  });

  it('mantém inelegível quem ainda não confirmou', async () => {
    const { resultado } = await autenticar(null);
    expect(resultado?.confirmacaoEmail).toBe('nao_confirmado');
  });

  it('falha fechado se o projeto estiver confirmando contas automaticamente', async () => {
    const { resultado, requisicoes } = await autenticar('2026-09-12T12:00:00Z', true);
    expect(resultado?.confirmacaoEmail).toBe('configuracao_insegura');
    expect(requisicoes.some((url) => url.endsWith('/auth/v1/user'))).toBe(false);
  });
});
