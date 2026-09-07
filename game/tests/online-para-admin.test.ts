import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Quantos estão online, ao lado do nome — e só para quem administra.
 *
 * O número é a contagem de contas cujo save subiu nos últimos cinco minutos.
 * Não é "sockets abertos": o jogo sobe sozinho a cada poucos minutos, então
 * quem está jogando entra na conta mesmo sem o chat aberto — e o chat só
 * conecta depois de escolher apelido, o que deixaria de fora justamente o
 * jogador novo, que é quem mais interessa acompanhar num alfa.
 */

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

function comSessao(): void {
  const armazem = new Map<string, string>([['oz.sessao.v1', JSON.stringify({
    accessToken: 'a', refreshToken: 'r',
    expiraEm: Math.floor(Date.now() / 1000) + 3600,
    email: 'piloto@exemplo.com', usuarioId: 'u-1', anonima: false,
  })]]);
  plantar('localStorage', {
    getItem: (k: string) => armazem.get(k) ?? null,
    setItem: (k: string, v: string) => { armazem.set(k, v); },
    removeItem: (k: string) => { armazem.delete(k); },
  });
  plantar('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
}

describe('o número de quem está online', () => {
  it('é null antes da primeira resposta, e não zero', async () => {
    /**
     * A distinção que o selo depende para não mentir. Zero é "não tem
     * ninguém"; `null` é "ainda não sei". Mostrar zero enquanto a resposta não
     * chegou faria a barra afirmar que o jogo está vazio toda vez que ela é
     * desenhada antes da rede responder — que é sempre, no primeiro instante.
     */
    comSessao();
    const { onlineAtual } = await import('@app/placar');
    expect(onlineAtual()).toBeNull();
  });

  it('guarda a resposta e não repete a pergunta em seguida', async () => {
    /**
     * O selo fica na barra de cima, visível o tempo todo. Sem a memória, cada
     * redesenho viraria requisição — e o servidor tem balde de leitura, então
     * estourá-lo faria o número alternar entre aparecer e sumir.
     */
    comSessao();
    let pedidos = 0;
    plantar('fetch', async () => {
      pedidos += 1;
      return { ok: true, status: 200, json: async () => ({ online: 4, janelaSegundos: 300 }) };
    });

    const { buscarOnline, onlineAtual } = await import('@app/placar');
    expect(await buscarOnline()).toBe(4);
    expect(await buscarOnline()).toBe(4);
    expect(pedidos).toBe(1);
    expect(onlineAtual()).toBe(4);
  });

  it('e uma falha de rede mantém o último número, em vez de apagá-lo', async () => {
    // Um erro de rede não é notícia sobre quantos estão jogando. Zerar o selo
    // por causa dele daria um susto falso a quem administra.
    comSessao();
    plantar('fetch', async () => { throw new Error('sem rede'); });

    const { onlineAtual } = await import('@app/placar');
    expect(onlineAtual()).toBe(4);
  });
});

describe('o portão do selo', () => {
  const perfil = readFileSync(join(process.cwd(), 'src', 'ui', 'PerfilMenu.ts'), 'utf8');

  it('só desenha o selo para admin, e só com número em mãos', () => {
    expect(perfil).toContain('...(ehAdmin() && onlineAtual() !== null');
  });

  it('e não gasta requisição de quem não vai ver', () => {
    // A conferência vem ANTES do `buscarOnline`, e não depois de perguntar.
    const relogio = perfil.slice(perfil.indexOf('const olharOnline'));
    const corpo = relogio.slice(0, relogio.indexOf('};'));
    expect(corpo.indexOf('if (!ehAdmin()) return;')).toBeLessThan(corpo.indexOf('buscarOnline'));
  });

  it('e o servidor exige sessão, mesmo o número não tendo identidade nenhuma', () => {
    /**
     * A rota não confere admin de propósito: a lista mora no pacote do cliente,
     * e duplicá-la no Worker criaria duas verdades que se desencontram na
     * primeira mudança. O que sai é um agregado — mas sessão continua sendo
     * exigida, como em toda rota do servidor.
     */
    const worker = readFileSync(join(process.cwd(), 'server', 'src', 'index.ts'), 'utf8');
    expect(worker).toContain("if (url.pathname === '/online' && req.method === 'GET') {");
    expect(worker).toContain("SELECT COUNT(*) AS n FROM saves WHERE atualizado_em > ?");
    // O balde de leitura, como no placar: o selo pergunta de minuto em minuto.
    const rota = worker.slice(worker.indexOf("url.pathname === '/online'"));
    expect(rota.slice(0, rota.indexOf('return json({ online'))).toContain('podeLer(usuario.id');
  });
});
