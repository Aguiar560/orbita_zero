import { describe, expect, it, afterEach } from 'vitest';
import { createState } from '@sim/state';

/**
 * "Apagar progresso" precisa apagar dos DOIS lados.
 *
 * O botão limpava só o `localStorage`. Para quem tem conta, o boot seguinte
 * chama `reconciliar`, encontra a nuvem com 542 minutos jogados contra os 0 do
 * save recém-nascido, e **baixa tudo de volta**. Do lado do jogador o botão
 * simplesmente não fazia nada — e o aviso ao lado dele prometia que não havia
 * cópia em outro lugar, o que deixou de ser verdade no dia em que a conta
 * passou a existir.
 *
 * O primeiro teste aqui é o do defeito: ele descreve, com o mecanismo real de
 * reconciliação, por que apagar só o local não apaga nada.
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

/** Uma sessão viva, para `tokenValido` responder sem ir à rede. */
function comConta(): void {
  const armazem = new Map<string, string>([[CHAVE, JSON.stringify({
    accessToken: 'token-de-teste', refreshToken: 'r',
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

interface Chamada { metodo: string; corpo: { estado?: { playtime?: number; piloto?: string } } | null }

/** Troca o `fetch` por um registrador, e diz o que o PUT deve responder. */
function rede(respostaDoPut: { status: number }): Chamada[] {
  const feitas: Chamada[] = [];
  plantar('fetch', async (_url: string, init: { method: string; body?: string }) => {
    feitas.push({
      metodo: init.method,
      corpo: init.body ? JSON.parse(init.body) as Chamada['corpo'] : null,
    });
    if (init.method === 'GET') {
      // A nuvem tem o save antigo, com muito tempo jogado.
      return {
        ok: true, status: 200,
        json: async () => ({ estado: { ...createState(1), playtime: 32_520 }, versaoServidor: 7 }),
      };
    }
    return { ok: respostaDoPut.status < 300, status: respostaDoPut.status, json: async () => ({ versaoServidor: 8 }) };
  });
  return feitas;
}

describe('apagar o progresso', () => {
  it('sem apagar na nuvem, o save antigo desce de volta no boot seguinte', async () => {
    /**
     * O defeito, escrito com o mecanismo de verdade.
     *
     * `reconciliar` compara TEMPO JOGADO. Depois de `clearStorage`, o local
     * nasce com zero e a nuvem tem as nove horas — então a decisão é `desceu`, e
     * o jogador volta exatamente para onde estava.
     */
    comConta();
    rede({ status: 200 });

    const { reconciliar } = await import('@app/nuvem');
    const r = await reconciliar(createState(1));

    expect(r.acao).toBe('desceu');
    if (r.acao === 'desceu') expect(r.estado.playtime).toBe(32_520);
  });

  it('apagar na nuvem sobe um jogador NOVO, sem piloto escolhido', async () => {
    /**
     * O que sobe precisa ser um estado de quem nunca jogou — inclusive sem
     * piloto. É o piloto vazio que faz a tela de escolha voltar a aparecer; um
     * estado zerado mas com piloto definido daria um jogo novo sem o começo
     * dele.
     *
     * O GET antes do PUT não é desperdício: ele carimba `versaoServidor`, e sem
     * o carimbo a subida bate na trava de conflito e volta 409.
     */
    comConta();
    const feitas = rede({ status: 200 });

    const { apagarNaNuvem } = await import('@app/nuvem');
    expect(await apagarNaNuvem(createState())).toBe(true);

    expect(feitas.map((c) => c.metodo)).toEqual(['GET', 'PUT']);
    const subido = feitas[1]?.corpo?.estado;
    expect(subido?.playtime).toBe(0);
    expect(subido?.piloto).toBe('');
  });

  it('e responde NÃO quando a nuvem recusa, para o local não sumir sozinho', async () => {
    /**
     * A ordem é o que este teste guarda. Se o local fosse apagado primeiro e a
     * rede falhasse, o save da nuvem desceria inteiro no boot seguinte: o
     * jogador teria feito uma coisa irreversível para ficar onde já estava.
     *
     * 429 é o caso realista — o servidor limita o ritmo de gravação, e quem
     * acabou de jogar costuma ter subido há poucos segundos.
     */
    comConta();
    rede({ status: 429 });

    const { apagarNaNuvem } = await import('@app/nuvem');
    expect(await apagarNaNuvem(createState())).toBe(false);
  });

  it('e sem conta não há nuvem para apagar: segue direto', async () => {
    plantar('localStorage', {
      getItem: () => null, setItem: () => {}, removeItem: () => {},
    });
    plantar('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
    plantar('fetch', async () => { throw new Error('não deveria ir à rede'); });

    const { apagarNaNuvem } = await import('@app/nuvem');
    expect(await apagarNaNuvem(createState())).toBe(true);
  });
});
