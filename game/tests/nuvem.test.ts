/**
 * A reconciliação entre o save local e o da nuvem.
 *
 * É o código com maior consequência do módulo: errar aqui não dá erro de tela,
 * dá progresso apagado. Um jogador que joga uma hora no PC de casa e abre no do
 * trabalho tem de encontrar a hora que jogou — e o contrário também.
 *
 * ## Por que os testes não falam de relógio
 *
 * A primeira versão comparava `savedAt`, o relógio do PC do jogador, e tinha
 * dois defeitos que só apareciam ao trocar de máquina: relógio adiantado vencia
 * sempre (inclusive contra progresso mais novo), e a gravação de fim de sessão
 * era recusada pelo limite de ritmo, perdendo até dois minutos por sessão.
 *
 * Agora quem ordena é o SERVIDOR (`versaoServidor`) e quem desempata é o TEMPO
 * JOGADO (`playtime`, somado a partir de `dt`, sem relógio nenhum no meio).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createState } from '@sim/state';
import { nuvem, reconciliar, subirSave } from '@app/nuvem';

vi.mock('@app/conta', () => ({
  tokenValido: vi.fn(async () => 'token-de-teste'),
}));

const resposta = (corpo: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

let chamadas: { metodo: string; corpo: Record<string, unknown> | null }[] = [];

beforeEach(() => {
  chamadas = [];
  nuvem.ultimaSubida = null;
  nuvem.ultimoErro = null;
  nuvem.esperarAte = 0;
  nuvem.versaoServidor = 0;
  nuvem.conflitoPendente = false;
});

afterEach(() => { vi.unstubAllGlobals(); });

function servidor(aoGet: () => Response, aoPut: () => Response = () => resposta({ ok: true, versaoServidor: 1 })): void {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const metodo = init.method ?? 'GET';
    chamadas.push({ metodo, corpo: init.body ? JSON.parse(String(init.body)) : null });
    return metodo === 'GET' ? aoGet() : aoPut();
  }));
}

/** Um estado com N segundos jogados. */
const jogou = (segundos: number, nivel = 1) => {
  const s = createState(7);
  s.playtime = segundos;
  s.command.nivel = nivel;
  return s;
};

describe('reconciliação com a nuvem', () => {
  it('nuvem vazia: sobe o local', () => {
    servidor(() => resposta({ vazio: true, versaoServidor: 0 }));
    return reconciliar(jogou(600)).then((r) => {
      expect(r).toEqual({ acao: 'subiu', motivo: 'nuvem-vazia' });
      expect(chamadas.map((c) => c.metodo)).toEqual(['GET', 'PUT']);
    });
  });

  it('quem jogou mais vence, e não quem tem o relógio adiantado', () => {
    // O caso do relato: joga no PC de casa, abre no do trabalho. O save com
    // mais tempo jogado é o que tem de valer, mesmo que o outro PC ache que
    // agora é amanhã.
    const daNuvem = jogou(7200, 40);
    servidor(() => resposta({ estado: daNuvem, versao: 10, atualizadoEm: 1, versaoServidor: 5 }));

    const local = jogou(600, 3);
    // Relógio local absurdamente adiantado: não pode mudar nada.
    local.savedAt = Date.now() + 86_400_000;

    return reconciliar(local).then((r) => {
      expect(r.acao).toBe('desceu');
      if (r.acao !== 'desceu') return;
      expect(r.estado.command.nivel, 'as duas horas jogadas voltam').toBe(40);
      expect(chamadas.map((c) => c.metodo), 'não pode subir por cima').toEqual(['GET']);
    });
  });

  it('local mais adiantado: sobe', async () => {
    servidor(() => resposta({ estado: jogou(600), versao: 10, atualizadoEm: 1, versaoServidor: 5 }));
    const r = await reconciliar(jogou(7200));
    expect(r).toEqual({ acao: 'subiu', motivo: 'local-mais-adiantado' });
  });

  it('empate fica com o local', async () => {
    servidor(() => resposta({ estado: jogou(600), versao: 10, atualizadoEm: 1, versaoServidor: 5 }));
    expect(await reconciliar(jogou(600))).toEqual({ acao: 'nada', motivo: 'empate' });
  });

  describe('versão do servidor', () => {
    it('a versão do GET vai no PUT seguinte', async () => {
      // Sem isto o primeiro PUT bateria em conflito com o próprio servidor.
      servidor(() => resposta({ vazio: true, versaoServidor: 7 }));
      await reconciliar(jogou(600));
      const put = chamadas.find((c) => c.metodo === 'PUT');
      expect(put?.corpo?.base, 'a base é a versão que o cliente viu').toBe(7);
    });

    it('conflito devolve o save do servidor em vez de sobrescrever', async () => {
      // Outro dispositivo gravou no meio. Gravar por cima apagaria aquele
      // progresso sem ninguém notar.
      const doServidor = jogou(9000, 55);
      servidor(
        () => resposta({ vazio: true, versaoServidor: 0 }),
        () => resposta({ erro: 'conflito', versaoServidor: 9, estado: doServidor }, 409),
      );

      const r = await subirSave(jogou(100));
      expect(r.fase).toBe('conflito');
      if (r.fase !== 'conflito') return;
      expect(r.doServidor?.command.nivel).toBe(55);
      expect(nuvem.versaoServidor, 'o cliente adota a versão do servidor').toBe(9);
    });

    it('a subida bem-sucedida avança a versão conhecida', async () => {
      servidor(() => resposta({ vazio: true, versaoServidor: 3 }), () => resposta({ ok: true, versaoServidor: 4 }));
      await reconciliar(jogou(600));
      expect(nuvem.versaoServidor).toBe(4);
    });
  });

  describe('ritmo', () => {
    it('recusa por ritmo não é falha, e o cliente espera', async () => {
      servidor(() => resposta({ vazio: true, versaoServidor: 0 }), () => resposta({ erro: 'cedo_demais', esperar: 90 }, 429));

      const r = await subirSave(jogou(600));
      expect(r.fase).toBe('cedo');
      expect(nuvem.esperarAte).toBeGreaterThan(Math.floor(Date.now() / 1000) + 80);

      // A segunda tentativa nem chega à rede: insistir contra uma porta que o
      // cliente SABE fechada gasta a cota de todos.
      chamadas = [];
      expect((await subirSave(jogou(600))).fase).toBe('cedo');
      expect(chamadas).toEqual([]);
    });
  });

  it('sem rede: não perde nada e não afirma nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await reconciliar(jogou(600));
    expect(r).toEqual({ acao: 'nada', motivo: 'falhou' });
    expect(nuvem.ultimaSubida, 'não pode alegar backup que não houve').toBeNull();
  });

  it('save ilegível na nuvem não derruba o jogo', async () => {
    servidor(() => resposta({ estado: { version: 9999 }, versao: 9999, atualizadoEm: 1, versaoServidor: 2 }));
    const r = await reconciliar(jogou(600));
    expect(r.acao, 'sem estado utilizável, tenta subir o que tem').not.toBe('desceu');
  });
});
