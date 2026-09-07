import { describe, expect, it, afterEach } from 'vitest';
import { createState } from '@sim/state';

/**
 * Conta nova não herda a partida do navegador sem perguntar.
 *
 * Criar conta numa máquina onde alguém já jogou entrava DIRETO no jogo com o
 * progresso da outra pessoa — setor 201, 589 minutos —, sem escolha de piloto,
 * sem nome e sem tutorial. Não era só herança indevida: era o caminho de
 * entrada do jogador novo desaparecendo, e foi assim que o teste de onboarding
 * ficou impossível de fazer.
 *
 * A causa mora numa mistura: `baixarSave` devolvia `null` tanto para "esta
 * conta não tem save" quanto para "o servidor não respondeu". O servidor sempre
 * soube dizer `vazio: true`; a informação se perdia no caminho.
 *
 * Os dois casos são indistinguíveis do lado do jogo e os dois são comuns —
 * joguei sem conta e acabei de criar uma, ou é a máquina de outra pessoa. Por
 * isso a resposta é PERGUNTAR. Adotar calado foi o defeito; apagar calado seria
 * um pior.
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

function comConta(): void {
  const armazem = new Map<string, string>([['oz.sessao.v1', JSON.stringify({
    accessToken: 'a', refreshToken: 'r',
    expiraEm: Math.floor(Date.now() / 1000) + 3600,
    email: 'novo@exemplo.com', usuarioId: 'u-novo', anonima: false,
  })]]);
  plantar('localStorage', {
    getItem: (k: string) => armazem.get(k) ?? null,
    setItem: (k: string, v: string) => { armazem.set(k, v); },
    removeItem: (k: string) => { armazem.delete(k); },
  });
  plantar('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
}

/** O que o servidor responde ao GET. `null` significa erro de rede. */
function servidorResponde(corpo: unknown | null): string[] {
  const metodos: string[] = [];
  plantar('fetch', async (_u: string, init: { method: string }) => {
    metodos.push(init.method);
    if (corpo === null) throw new Error('sem rede');
    if (init.method === 'GET') return { ok: true, status: 200, json: async () => corpo };
    return { ok: true, status: 200, json: async () => ({ versaoServidor: 1 }) };
  });
  return metodos;
}

/** Um save com história: piloto escolhido e tempo de jogo de verdade. */
function partidaDeAlguem() {
  const s = createState(7, 'vektor_9');
  s.playtime = 35_340;
  return s;
}

describe('conta nova com partida no navegador', () => {
  it('pergunta em vez de adotar o progresso alheio', async () => {
    comConta();
    const metodos = servidorResponde({ vazio: true, versaoServidor: 0 });

    const { reconciliar } = await import('@app/nuvem');
    const r = await reconciliar(partidaDeAlguem());

    expect(r.acao).toBe('perguntar');
    // E nada foi subido antes de perguntar: a conta nova continua vazia.
    expect(metodos).toEqual(['GET']);
  });

  it('e não pergunta a quem não tem nada a herdar', async () => {
    /**
     * Sem piloto escolhido não há partida nenhuma — a tela de escolha aparece
     * de qualquer jeito, e uma pergunta aqui seria ruído no primeiro minuto de
     * quem acabou de chegar.
     */
    comConta();
    servidorResponde({ vazio: true, versaoServidor: 0 });

    const { reconciliar } = await import('@app/nuvem');
    const r = await reconciliar(createState(7));

    expect(r.acao).toBe('subiu');
  });

  it('e não pergunta por causa de dez segundos de jogo', async () => {
    // O corte de tempo existe para quem abriu o jogo, olhou e foi criar conta.
    comConta();
    servidorResponde({ vazio: true, versaoServidor: 0 });

    const curta = createState(7, 'vektor_9');
    curta.playtime = 20;

    const { reconciliar } = await import('@app/nuvem');
    expect((await reconciliar(curta)).acao).toBe('subiu');
  });

  it('e servidor fora do ar NÃO vira pergunta', async () => {
    /**
     * A distinção que o conserto inteiro depende. Antes, rede fora e conta nova
     * chegavam iguais aqui. Perguntar "quer recomeçar?" porque a rede caiu seria
     * oferecer destruir um save por causa de um problema passageiro.
     */
    comConta();
    servidorResponde(null);

    const { reconciliar } = await import('@app/nuvem');
    const r = await reconciliar(partidaDeAlguem());

    expect(r.acao).toBe('nada');
    if (r.acao === 'nada') expect(r.motivo).toBe('falhou');
  });

  it('e a conta com save na nuvem segue pelo caminho de sempre', async () => {
    // Regressão: a mudança não pode afetar quem já tem save do lado de lá.
    comConta();
    const daNuvem = { ...createState(9, 'vektor_9'), playtime: 99_000 };
    servidorResponde({ estado: daNuvem, atualizadoEm: 1, versaoServidor: 3 });

    const { reconciliar } = await import('@app/nuvem');
    const r = await reconciliar(partidaDeAlguem());

    expect(r.acao).toBe('desceu');
  });
});
