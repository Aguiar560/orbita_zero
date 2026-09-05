import { describe, expect, it, beforeEach, afterEach } from 'vitest';

/**
 * A espera pela janela do login, sob a política que o Google impõe.
 *
 * Este arquivo existe por um bug que passou por duas correções antes de ser
 * entendido. O sintoma era sempre o mesmo: o jogador clicava em "Continuar com
 * Google", a janela abria, e a página de trás dizia "Login cancelado" segundos
 * depois — com a janela aberta na frente dele.
 *
 * A causa é o `Cross-Origin-Opener-Policy: same-origin` do Google. Ele corta a
 * ligação entre as duas janelas, e o efeito colateral é que `janela.closed`
 * passa a devolver `true` para uma janela ABERTA. Quem trata `closed` como
 * "desistiu" acusa desistência de quem está digitando a senha.
 *
 * O que dá a este teste o direito de existir é a primeira tentativa de
 * conserto, que parecia sólida e não era: `closed` só valeria como cancelamento
 * se a janela tivesse sido vista aberta ANTES. Falhou porque a janela nasce no
 * Supabase, que não tem COOP — ela é vista aberta no primeiro instante, e só
 * então salta para o Google. A ordem do caminho derrubou a ressalva.
 *
 * Por isso os testes abaixo não perguntam "como está escrito". Eles montam uma
 * janela que MENTE do jeito que o COOP faz mentir, e cobram o desfecho.
 */

const CHAVE = 'oz.sessao.v1';

interface JanelaFalsa { closed: boolean }

/** Guarda o que os testes plantam em `globalThis`, para desfazer no fim. */
const original = new Map<string, unknown>();

function plantar(nome: string, valor: unknown): void {
  if (!original.has(nome)) {
    original.set(nome, (globalThis as Record<string, unknown>)[nome]);
  }
  (globalThis as Record<string, unknown>)[nome] = valor;
}

let armazem: Map<string, string>;
let janela: JanelaFalsa;
let aberturas: number;

/**
 * Monta o mundo mínimo que `conta.ts` toca.
 *
 * `abrir` decide o que a janela responde a `closed` — é o parâmetro que faz
 * cada teste ser o que é.
 */
function montar(abrir: () => JanelaFalsa | null): void {
  armazem = new Map();
  aberturas = 0;

  plantar('localStorage', {
    getItem: (k: string) => armazem.get(k) ?? null,
    setItem: (k: string, v: string) => { armazem.set(k, v); },
    removeItem: (k: string) => { armazem.delete(k); },
  });

  plantar('location', {
    origin: 'https://orbita-zero.vercel.app',
    pathname: '/',
    search: '',
    hash: '',
    href: 'https://orbita-zero.vercel.app/',
  });

  plantar('history', { replaceState: () => {} });

  plantar('window', {
    name: '',
    open: (): JanelaFalsa | null => { aberturas += 1; return abrir(); },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

/** Uma sessão válida chegando ao armazenamento, como a janela do login faz. */
function sessaoChega(): void {
  armazem.set(CHAVE, JSON.stringify({
    accessToken: 'a', refreshToken: 'r', expiraEm: 99_999_999_999,
    email: 'piloto@exemplo.com', usuarioId: 'u-1', anonima: false,
  }));
}

afterEach(() => {
  for (const [nome, valor] of original) {
    (globalThis as Record<string, unknown>)[nome] = valor;
  }
  original.clear();
});

describe('a espera pela janela do Google', () => {
  beforeEach(() => { armazem = new Map(); });

  it('entra quando a janela mente que está fechada e a sessão chega depois', async () => {
    /**
     * O caso real, na ordem real.
     *
     * Primeiro tique: a janela ainda está no Supabase, sem COOP, e responde
     * aberta. Do segundo em diante ela já saltou para o Google e passa a
     * responder fechada — enquanto o jogador escolhe a conta. A sessão chega
     * meio segundo depois disso.
     *
     * O código que estava no ar resolvia "Login cancelado." aqui, no segundo
     * tique. É esta linha que ele não passava.
     */
    let leituras = 0;
    janela = {
      get closed(): boolean { leituras += 1; return leituras > 1; },
    } as JanelaFalsa;
    montar(() => janela);

    const { entrarComProvedor } = await import('@app/conta');
    const promessa = entrarComProvedor('google');
    setTimeout(sessaoChega, 900);

    const r = await promessa;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sessao.usuarioId).toBe('u-1');
  }, 8000);

  it('e clicar de novo reaponta a mesma janela, sem criar uma segunda espera', async () => {
    /**
     * O botão continua clicável durante a espera de propósito: fechar a janela
     * no X é invisível sob COOP, e clicar de novo é a única saída do jogador.
     *
     * O que não pode acontecer é cada clique virar um relógio e um ouvinte
     * novos. A janela é reaberta — mesmo nome, mesma janela — e a promessa
     * devolvida é a MESMA, então quem espera continua sendo um só.
     */
    janela = { closed: true };
    montar(() => janela);

    const { entrarComProvedor } = await import('@app/conta');
    const primeira = entrarComProvedor('google');
    const segunda = entrarComProvedor('google');

    expect(segunda).toBe(primeira);
    expect(aberturas).toBe(2);

    sessaoChega();
    expect((await primeira).ok).toBe(true);
  }, 8000);

  it('marca onde o login acontece: janela própria ou esta página', async () => {
    /**
     * A marca é o que permite a janela se reconhecer quando o `window.name` se
     * perde no salto entre origens. E o VALOR importa: quando o pop-up é
     * bloqueado, o login acontece nesta mesma página, que não pode tentar se
     * fechar sozinha na volta — `window.close()` numa aba comum não faz nada, e
     * o jogador ficaria olhando para uma tela que nunca abre.
     */
    janela = { closed: false };
    montar(() => janela);
    const { entrarComProvedor } = await import('@app/conta');
    void entrarComProvedor('google');
    expect(armazem.get('oz:login-em-curso')).toBe('janela');

    montar(() => null);
    const r = await entrarComProvedor('google');
    expect(r.ok).toBe(false);
    expect(armazem.get('oz:login-em-curso')).toBe('pagina');

    // A espera do primeiro trecho ainda vive, e `pendente` é de módulo: deixá-la
    // pendurada faria um teste seguinte receber a promessa errada.
    sessaoChega();
    await new Promise((r) => setTimeout(r, 600));
  }, 8000);
});
