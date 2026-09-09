import { readFileSync, readdirSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { bus } from '@app/Bus';
import { FALHAS_ATE_FALAR, relatarFalha, relatarSucesso } from '@app/recusa';

/**
 * O cliente conta a recusa em vez de engoli-la.
 *
 * ## O defeito que isto fecha
 *
 * Todo módulo de `src/app/` fala com o Worker por um `chamar()` que faz
 * `if (!r.ok) return null`, e quem chama transforma `null` em "usa o que já
 * tinha". Em 08/09/2026 quatro defeitos chegaram com esse disfarce: o jogador
 * via nível zerado, saldo zero e um botão mudo, nunca "o servidor falhou".
 *
 * ## A regra que estes testes guardam
 *
 * Consertar isso tem uma armadilha óbvia: avisar sempre. Um aviso a cada
 * oscilação de rede treina o jogador a ignorar avisos, e aí o aviso que importa
 * passa junto. Por isso **ação** e **fundo** são tratados diferente, e é essa
 * distinção que os testes protegem.
 */

const resposta = (status: number, erro?: string): Response => ({
  status,
  json: async () => (erro ? { erro } : {}),
} as unknown as Response);

let ditos: string[] = [];
let calar = () => {};

beforeEach(() => {
  ditos = [];
  calar();
  calar = bus.on('toast', (t) => { ditos.push(t.text); });
  for (const rota of ['/carteira', '/inventario', '/sintetizar', '/frota', '/lote']) {
    relatarSucesso(rota);
  }
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('a ação deliberada fala sempre', () => {
  it('porque recusada ela é um botão que não funciona', async () => {
    // A fusão foi o caso que originou tudo: FABRICAR aceso, dez peças no anel,
    // e nada acontecendo por três rodadas de investigação.
    await relatarFalha('/sintetizar', 'acao', resposta(429, 'rapido_demais'));
    expect(ditos).toHaveLength(1);
    expect(ditos[0]).toMatch(/segundos/i);
  });

  it('e fala na PRIMEIRA vez, não na terceira', async () => {
    await relatarFalha('/frota', 'acao', resposta(409, 'saldo_insuficiente'));
    expect(ditos).toHaveLength(1);
  });

  it('e uma recusa desconhecida diz o código e que nada se perdeu', async () => {
    // O código é o que o jogador consegue repetir para quem conserta. Foi
    // assim que `itens_nao_sao_seus` levou à causa raiz.
    await relatarFalha('/sintetizar', 'acao', resposta(500, 'coisa_nova'));
    expect(ditos[0]).toContain('coisa_nova');
    expect(ditos[0]).toContain('Nada foi perdido');
  });
});

describe('a sincronização de fundo só fala quando INSISTE', () => {
  it('a primeira falha não incomoda ninguém', async () => {
    /**
     * Recusada uma vez, ela tenta de novo no ciclo seguinte e ninguém percebe.
     * Avisar aqui seria um carrossel de avisos a cada oscilação de rede — e o
     * conserto viraria um defeito pior que o consertado.
     */
    await relatarFalha('/carteira', 'fundo', resposta(500));
    expect(ditos).toHaveLength(0);
  });

  it('mas a insistência fala, porque aí o progresso está mesmo parado', async () => {
    for (let i = 0; i < FALHAS_ATE_FALAR; i++) {
      await relatarFalha('/carteira', 'fundo', resposta(500));
    }
    expect(ditos).toHaveLength(1);
  });

  it('e fala UMA vez por queda, não a cada tentativa seguinte', async () => {
    // Sem isto, uma queda de dez minutos vira dezenas de avisos idênticos.
    for (let i = 0; i < 20; i++) {
      await relatarFalha('/carteira', 'fundo', resposta(500));
    }
    expect(ditos).toHaveLength(1);
  });

  it('e um sucesso zera a contagem — a próxima queda volta a poder avisar', async () => {
    for (let i = 0; i < 20; i++) await relatarFalha('/lote', 'fundo', resposta(500));
    expect(ditos).toHaveLength(1);

    relatarSucesso('/lote');
    for (let i = 0; i < FALHAS_ATE_FALAR; i++) {
      await relatarFalha('/lote', 'fundo', resposta(500));
    }
    expect(ditos).toHaveLength(2);
  });

  it('e cada rota conta sozinha', async () => {
    // Duas rotas falhando uma vez cada não somam três. Sem isso, o limiar
    // dispararia por causa de rotas que não têm nada a ver uma com a outra.
    await relatarFalha('/carteira', 'fundo', resposta(500));
    await relatarFalha('/inventario', 'fundo', resposta(500));
    expect(ditos).toHaveLength(0);
  });
});

describe('o console recebe tudo, sempre', () => {
  it('inclusive a primeira falha de fundo, que a tela não mostra', async () => {
    // O toast some em segundos; o console fica, e é o que se copia e cola.
    await relatarFalha('/carteira', 'fundo', resposta(409, 'lote_esgotado'));
    expect(ditos).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(console.warn).mock.calls[0]![0]).toContain('lote_esgotado');
  });

  it('e diz o status quando não há motivo no corpo', async () => {
    await relatarFalha('/carteira', 'fundo', resposta(502));
    expect(vi.mocked(console.warn).mock.calls[0]![0]).toContain('HTTP 502');
  });

  it('e distingue rede fora de recusa do servidor', async () => {
    await relatarFalha('/carteira', 'fundo', null);
    expect(vi.mocked(console.warn).mock.calls[0]![0]).toContain('sem resposta');
  });
});

describe('nenhuma rota ficou de fora', () => {
  /**
   * O conserto vale zero na rota que alguém esquecer — e a esquecida seria
   * justamente a que ninguém ia procurar. Este teste varre `src/app/` e cobra
   * que todo `if (!r.ok)` relate.
   */
  const dir = new URL('../src/app/', import.meta.url);

  const modulos = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')] as const)
    // Só quem fala com a API do jogo. `conta.ts` fala com o Supabase e
    // `ChatClient` com outro Worker, com vocabulário de erro próprio.
    .filter(([f, s]) => s.includes('API_URL') && f !== 'conta.ts');

  it('varre os módulos que falam com a API — e são vários', () => {
    // Se a varredura parar de achar arquivos, o teste passaria vazio e
    // silencioso, que é o pior jeito de um teste morrer.
    expect(modulos.length).toBeGreaterThanOrEqual(6);
  });

  /**
   * As exceções, com o motivo escrito.
   *
   * Elas não engolem a recusa — DEVOLVEM a falha descrita a quem chamou, que
   * tem superfície própria para mostrá-la. Uma lista explícita e pequena é
   * melhor que uma expressão regular esperta: uma rota nova entra como
   * exceção só se alguém escrever aqui por que ela é uma.
   */
  const COM_SUPERFICIE_PROPRIA: Record<string, string> = {
    // Guarda em `nuvem.ultimoErro`, que o menu de perfil mostra como o estado
    // da sincronização do save.
    'nuvem.ts': 'ultimoErro',
    // Devolve `{ ok: false, erro }` e `{ fase: 'erro', motivo }`; a tela do
    // apelido e a do ranking renderizam os dois.
    'placar.ts': 'erro',
  };

  for (const [arquivo, fonte] of modulos) {
    it(`${arquivo} relata toda recusa`, () => {
      const excecao = COM_SUPERFICIE_PROPRIA[arquivo];
      const mudos = fonte
        .split('\n')
        .map((linha, i) => [i + 1, linha] as const)
        .filter(([, l]) => /if \(!r\.ok\)/.test(l) && !l.includes('relatarFalha'));

      if (excecao) {
        // A exceção não é passe livre: ela precisa continuar descrevendo a
        // falha. Se alguém trocar isso por um `return null` mudo, cai aqui.
        expect(fonte, `${arquivo} está na lista de exceções e parou de descrever a falha`)
          .toContain(excecao);
        return;
      }

      expect(
        mudos.map(([n, l]) => `${arquivo}:${n} — ${l.trim()}`).join('\n'),
        'recusa engolida sem relato',
      ).toBe('');
    });
  }
});
