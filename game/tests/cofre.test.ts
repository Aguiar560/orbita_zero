/**
 * O cofre do save.
 *
 * ## Por que ele existe
 *
 * `sim/state.ts` nomeava `localStorage` direto. Nunca foi um impedimento de
 * EXECUÇÃO — as chamadas estavam em `try/catch` e degradavam sozinhas —, mas
 * era o suficiente para o arquivo não compilar no Worker, e o Passo 9 depende
 * de `sim/` rodar lá.
 *
 * O problema prático era outro e mais chato: em ambiente sem `localStorage`,
 * cada gravação registrava um `console.error`, e o jogo grava a cada dez
 * segundos. Log que sempre aparece é log que ninguém lê — e ele afogaria o erro
 * de verdade quando houvesse um.
 *
 * ## O que estes testes protegem
 *
 * O caminho do save é o único do jogo em que um defeito custa o progresso do
 * jogador, e ele falha em SILÊNCIO por natureza: quem grava não fica olhando
 * para ver se gravou.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  COFRE_VAZIO, SAVE_KEY, allowSaving, clearStorage, createState,
  definirCofre, loadFromStorage, saveToStorage, temCofre, type Cofre,
} from '@sim/state';

/** Um cofre de mentira, que também conta o que foi pedido a ele. */
function cofreDeTeste(): Cofre & { dados: Map<string, string>; escritas: number } {
  const dados = new Map<string, string>();
  return {
    dados,
    escritas: 0,
    ler: (c) => dados.get(c) ?? null,
    gravar(c, v) { this.escritas++; dados.set(c, v); },
    apagar: (c) => { dados.delete(c); },
  };
}

describe('o cofre é injetável', () => {
  beforeEach(() => { allowSaving(); });

  it('sem navegador, o padrão é o cofre vazio', () => {
    // A suíte roda em Node, sem `localStorage`. É a MESMA situação do Worker, e
    // é o que este teste está de fato medindo.
    expect(typeof (globalThis as Record<string, unknown>).localStorage).toBe('undefined');
    definirCofre(COFRE_VAZIO);
    expect(temCofre()).toBe(false);
  });

  it('gravar num cofre vazio não estoura e não guarda nada', () => {
    // O comportamento que o Worker precisa: silencioso, sem exceção e sem log.
    definirCofre(COFRE_VAZIO);
    expect(() => saveToStorage(createState(1))).not.toThrow();
    expect(loadFromStorage()).toBeNull();
  });

  it('com cofre, grava e lê de volta', () => {
    const cofre = cofreDeTeste();
    definirCofre(cofre);

    const estado = createState(7);
    estado.playtime = 4242;
    saveToStorage(estado);

    expect(cofre.dados.has(SAVE_KEY)).toBe(true);
    expect(loadFromStorage()?.state.playtime).toBe(4242);
  });

  it('grava o carimbo de tempo junto', () => {
    // `savedAt` é o que calcula a ausência ao voltar. Sem ele, todo retorno
    // pareceria instantâneo e o progresso offline nunca seria creditado.
    const cofre = cofreDeTeste();
    definirCofre(cofre);
    const estado = createState(3);
    estado.savedAt = 0;
    saveToStorage(estado);
    expect(estado.savedAt).toBeGreaterThan(0);
  });
});

describe('a trava de apagamento', () => {
  beforeEach(() => { allowSaving(); });

  it('depois de apagar, nada mais grava', () => {
    /**
     * Sem a trava, apagar o progresso não funcionava: `clearStorage` removia a
     * chave, mas o `location.reload()` seguinte disparava `beforeunload`, que
     * salvava o estado ainda em memória de volta — com todos os itens.
     */
    const cofre = cofreDeTeste();
    definirCofre(cofre);
    saveToStorage(createState(1));
    expect(cofre.dados.has(SAVE_KEY)).toBe(true);

    clearStorage();
    expect(cofre.dados.has(SAVE_KEY)).toBe(false);

    const escritasAntes = cofre.escritas;
    saveToStorage(createState(2));
    expect(cofre.escritas, 'gravou depois de apagar').toBe(escritasAntes);
  });

  it('importar um save reabilita a gravação', () => {
    const cofre = cofreDeTeste();
    definirCofre(cofre);
    clearStorage();
    allowSaving();
    saveToStorage(createState(9));
    expect(cofre.dados.has(SAVE_KEY)).toBe(true);
  });
});

describe('save corrompido não trava o boot', () => {
  it('lixo no cofre devolve nulo em vez de estourar', () => {
    // É a restrição do `CLAUDE.md`: save malformado nunca pode travar o boot.
    const cofre = cofreDeTeste();
    cofre.dados.set(SAVE_KEY, '{isso nao e json');
    definirCofre(cofre);
    expect(loadFromStorage()).toBeNull();
  });

  it('JSON válido mas sem forma de save também', () => {
    const cofre = cofreDeTeste();
    cofre.dados.set(SAVE_KEY, '"uma string solta"');
    definirCofre(cofre);
    expect(loadFromStorage()).toBeNull();
  });
});
