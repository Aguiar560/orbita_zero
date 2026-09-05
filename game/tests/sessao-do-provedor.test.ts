import { describe, expect, it, afterEach } from 'vitest';

/**
 * A volta do provedor: o token vira uma sessão que o jogo CONSEGUE LER.
 *
 * Este arquivo nasceu do bug que fez o login pelo Google nunca funcionar, nem
 * com janela nem com o redirecionamento antigo. `recolherSessaoDaUrl` guardava
 * `usuarioId: atual?.usuarioId ?? ''`, e num login novo não existe sessão
 * anterior — então o id saía vazio. Só que `sessaoGuardada` recusa sessão sem
 * id. A sessão era gravada e nascia ilegível.
 *
 * O sintoma não parecia com a causa: a janelinha do Google abria e fechava
 * certinho, e a página de trás simplesmente ficava esperando. Duas correções
 * foram feitas no mecanismo da janela antes de alguém olhar para o que estava
 * sendo gravado.
 *
 * Por isso o teste central aqui não pergunta se `recolherSessaoDaUrl` devolveu
 * `true` — a versão quebrada também devolvia. Ele pergunta se a sessão pode ser
 * LIDA DE VOLTA, que é a única coisa que o resto do jogo faz com ela.
 */

const CHAVE = 'oz.sessao.v1';

const original = new Map<string, unknown>();
function plantar(nome: string, valor: unknown): void {
  if (!original.has(nome)) {
    original.set(nome, (globalThis as Record<string, unknown>)[nome]);
  }
  (globalThis as Record<string, unknown>)[nome] = valor;
}

afterEach(() => {
  for (const [nome, valor] of original) {
    (globalThis as Record<string, unknown>)[nome] = valor;
  }
  original.clear();
});

/** Um JWT no formato do Supabase. Só o miolo importa; a assinatura é enfeite. */
function token(carga: Record<string, unknown>): string {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o), 'utf8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(carga)}.assinatura-de-mentira`;
}

let armazem: Map<string, string>;

/** Monta o mundo com a URL de volta do provedor no fragmento. */
function voltandoCom(hash: string): void {
  armazem = new Map();
  plantar('localStorage', {
    getItem: (k: string) => armazem.get(k) ?? null,
    setItem: (k: string, v: string) => { armazem.set(k, v); },
    removeItem: (k: string) => { armazem.delete(k); },
  });
  plantar('location', {
    origin: 'https://orbita-zero.vercel.app',
    pathname: '/',
    search: '',
    hash,
  });
  plantar('history', { replaceState: () => {} });
  plantar('window', { name: '', dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
}

describe('a sessão que volta do provedor', () => {
  it('nasce legível: o dono sai de dentro do token', async () => {
    /**
     * O teste que a versão quebrada não passava.
     *
     * Ela também devolvia `true` aqui — por isso a asserção que importa é a
     * segunda: ler a sessão de volta. Era ali que vinha `null`.
     */
    const jwt = token({
      sub: '9f1c0e2a-0000-4000-8000-abcdefabcdef',
      email: 'piloto@exemplo.com',
      exp: 9_999_999_999,
    });
    voltandoCom(`#access_token=${jwt}&refresh_token=r-123&expires_in=3600&token_type=bearer`);

    const { recolherSessaoDaUrl, sessaoGuardada } = await import('@app/conta');
    expect(recolherSessaoDaUrl()).toBe(true);

    const sessao = sessaoGuardada();
    expect(sessao).not.toBeNull();
    expect(sessao?.usuarioId).toBe('9f1c0e2a-0000-4000-8000-abcdefabcdef');
    expect(sessao?.email).toBe('piloto@exemplo.com');
    expect(sessao?.anonima).toBe(false);
  });

  it('e sem dono no token não finge que deu certo', async () => {
    /**
     * Guardar uma sessão sem id é o próprio bug. Se o token vier sem `sub` —
     * coisa que não deveria acontecer —, a resposta é "não deu", e não uma
     * gravação que ninguém consegue ler depois.
     */
    voltandoCom(`#access_token=${token({ email: 'sem-id@exemplo.com' })}&refresh_token=r&expires_in=3600`);

    const { recolherSessaoDaUrl } = await import('@app/conta');
    expect(recolherSessaoDaUrl()).toBe(false);
    expect(armazem.get(CHAVE)).toBeUndefined();
  });

  it('e a janela do login avisa quando o token não vira sessão', async () => {
    /**
     * O silêncio foi o que custou caro: a janela fechava, nada era gravado, e a
     * página de trás esperava cinco minutos por algo que não vinha.
     *
     * Agora ela grava um recado antes de fechar, e quem espera mostra o recado.
     */
    voltandoCom(`#access_token=${token({ email: 'sem-id@exemplo.com' })}&refresh_token=r&expires_in=3600`);
    const fechou = { sim: false };
    plantar('window', {
      name: 'oz-login',
      close: () => { fechou.sim = true; },
      dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {},
    });

    const { finalizarLoginEmPopup } = await import('@app/conta');
    expect(finalizarLoginEmPopup()).toBe(true);
    expect(fechou.sim).toBe(true);
    expect(armazem.get('oz:login-pronto') ?? '').toMatch(/^erro:/);
  });

  it('e uma volta sem token nenhum deixa o jogo abrir normalmente', async () => {
    /**
     * A guarda que impede a página comum de se tratar como janela de login. Sem
     * ela, abrir o jogo pelo endereço normal tentaria fechar a própria aba.
     */
    voltandoCom('');
    plantar('window', { name: 'oz-login', close: () => {}, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });

    const { finalizarLoginEmPopup } = await import('@app/conta');
    expect(finalizarLoginEmPopup()).toBe(false);
  });
});
