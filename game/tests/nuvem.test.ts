/**
 * A reconciliação entre o save local e o da nuvem.
 *
 * É o código com maior consequência do módulo: errar aqui não dá erro de tela,
 * dá progresso apagado. Um jogador que joga uma hora no celular e abre no PC
 * tem de encontrar a hora que jogou — e o caminho contrário também.
 *
 * O `fetch` é substituído porque o que se testa é a DECISÃO, não a rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createState } from '@sim/state';
import { reconciliar, nuvem, subirSave } from '@app/nuvem';

// A sessão é o que decide se há conta; sem ela `reconciliar` sai na primeira
// linha e nenhum outro caminho é exercitado.
vi.mock('@app/conta', () => ({
  tokenValido: vi.fn(async () => 'token-de-teste'),
}));

const SEGUNDO = 1000;

/** Uma resposta do Worker, na forma que ele realmente devolve. */
const resposta = (corpo: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

let chamadas: { metodo: string; corpo: unknown }[] = [];

beforeEach(() => {
  chamadas = [];
  nuvem.ultimaSubida = null;
  nuvem.ultimoErro = null;
  nuvem.esperarAte = 0;
});

afterEach(() => { vi.unstubAllGlobals(); });

/** Instala um `fetch` que responde o que o teste mandar. */
function servidor(aoGet: () => Response, aoPut: () => Response = () => resposta({ ok: true })): void {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const metodo = init.method ?? 'GET';
    chamadas.push({ metodo, corpo: init.body ? JSON.parse(String(init.body)) : null });
    return metodo === 'GET' ? aoGet() : aoPut();
  }));
}

describe('reconciliação com a nuvem', () => {
  it('nuvem vazia: sobe o local', () => {
    // Conta nova, ou primeira vez que este jogador liga a sincronização.
    servidor(() => resposta({ vazio: true }));
    const local = createState(7);
    local.savedAt = Date.now();

    return reconciliar(local).then((r) => {
      expect(r).toEqual({ acao: 'subiu', motivo: 'nuvem-vazia' });
      expect(chamadas.map((c) => c.metodo)).toEqual(['GET', 'PUT']);
    });
  });

  it('nuvem mais nova: desce', async () => {
    // O caso do outro dispositivo — ou do navegador limpo, em que o save local
    // nasceu agora e vale menos que o guardado.
    const daNuvem = createState(7);
    daNuvem.command.nivel = 40;
    const agora = Math.floor(Date.now() / 1000);
    servidor(() => resposta({ estado: daNuvem, versao: 10, atualizadoEm: agora }));

    const local = createState(7);
    local.command.nivel = 3;
    local.savedAt = (agora - 3600) * SEGUNDO;

    const r = await reconciliar(local);
    expect(r.acao).toBe('desceu');
    if (r.acao !== 'desceu') return;
    expect(r.estado.command.nivel, 'o progresso guardado tem de voltar').toBe(40);
    // Não pode subir o local por cima do que acabou de descer.
    expect(chamadas.map((c) => c.metodo)).toEqual(['GET']);
  });

  it('local mais novo: sobe', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const daNuvem = createState(7);
    servidor(() => resposta({ estado: daNuvem, versao: 10, atualizadoEm: agora - 3600 }));

    const local = createState(7);
    local.savedAt = agora * SEGUNDO;

    const r = await reconciliar(local);
    expect(r).toEqual({ acao: 'subiu', motivo: 'local-mais-novo' });
  });

  it('milissegundos e segundos não se confundem', async () => {
    // `savedAt` é em MILISSEGUNDOS e `atualizadoEm` em SEGUNDOS. Comparar sem
    // converter faria o local parecer mil vezes mais novo SEMPRE, e o save da
    // nuvem nunca desceria — o defeito não daria erro nenhum, só perderia o
    // progresso do outro dispositivo em silêncio.
    const agora = Math.floor(Date.now() / 1000);
    const daNuvem = createState(7);
    daNuvem.command.nivel = 99;
    servidor(() => resposta({ estado: daNuvem, versao: 10, atualizadoEm: agora }));

    const local = createState(7);
    local.savedAt = (agora - 60) * SEGUNDO; // um minuto mais velho

    const r = await reconciliar(local);
    expect(r.acao, 'a nuvem é mais nova por um minuto').toBe('desceu');
  });

  it('empate fica com o local', async () => {
    const agora = Math.floor(Date.now() / 1000);
    servidor(() => resposta({ estado: createState(7), versao: 10, atualizadoEm: agora }));
    const local = createState(7);
    local.savedAt = agora * SEGUNDO;

    expect(await reconciliar(local)).toEqual({ acao: 'nada', motivo: 'empate' });
  });

  it('sem rede: não perde nada e não afirma nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await reconciliar(createState(7));
    expect(r).toEqual({ acao: 'nada', motivo: 'falhou' });
    expect(nuvem.ultimaSubida, 'não pode alegar backup que não houve').toBeNull();
  });

  it('recusa por ritmo não é falha, e o cliente espera', async () => {
    // O Worker aceita uma gravação a cada 120s por jogador — é o que faz a
    // conta da camada gratuita fechar. Insistir contra uma porta que o cliente
    // SABE fechada só gasta a cota de todos.
    servidor(() => resposta({ vazio: true }), () => resposta({ erro: 'cedo_demais', esperar: 90 }, 429));

    const local = createState(7);
    expect(await subirSave(local), 'recusado').toBe(false);
    expect(nuvem.esperarAte).toBeGreaterThan(Math.floor(Date.now() / 1000) + 80);

    // A segunda tentativa nem chega à rede.
    chamadas = [];
    expect(await subirSave(local)).toBe(false);
    expect(chamadas, 'não pode nem tentar').toEqual([]);
  });

  it('save ilegível na nuvem não derruba o jogo', async () => {
    // `migrate` devolve `null` para save de versão futura ou corrompido. O
    // certo é continuar com o local, não abrir o jogo sem estado.
    servidor(() => resposta({ estado: { version: 9999 }, versao: 9999, atualizadoEm: 1 }));
    const local = createState(7);
    local.savedAt = Date.now();

    const r = await reconciliar(local);
    expect(r.acao, 'sem estado utilizável, tenta subir o que tem').not.toBe('desceu');
  });
});
