import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import {
  carteira, carteiraPronta, drenarCarteira, esquecer, sincronizar,
} from '@app/carteira';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * O saldo confirmado pelo servidor precisa chegar a `state.resources`.
 *
 * ## O defeito que isto pega
 *
 * O espelho da carteira mora em `app/carteira.ts`, mas quem desenha o topo, a
 * Loja e a Fabricação lê `sim.state.resources` — e a ÚNICA cópia de um para o
 * outro está no fim de `drenarCarteira`.
 *
 * O boot fazia, nesta ordem:
 *
 *     await sincronizarCarteira();   // enche o espelho, marca "pronta"
 *     await drenarCarteira(sim);     // `if (!fila.length && pronta) return;`
 *
 * A primeira linha era exatamente o que fazia a segunda desistir. Com a fila
 * vazia — que é o caso de quem acabou de abrir o jogo — a cópia nunca
 * acontecia, e `state.resources` ficava com o que o save local tinha: ZERO,
 * num navegador que nunca jogou.
 *
 * O sintoma relatado em 08/09 foi **"a fabricação não faz nada"**. Não era a
 * fabricação: com núcleo zero na tela, `faltaParaFundir` devolve "núcleos
 * insuficientes" e o botão FABRICAR nasce desabilitado. Clicar num botão
 * desabilitado não faz nada mesmo. No servidor havia 2.582 núcleos.
 *
 * É o mesmo formato do defeito da migração que não subiu: o cliente não mostra
 * "o servidor falhou", mostra um número plausível e errado.
 */

const respondeCom = (saldos: Record<string, number>, vipExpiraEm = 0): void => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ saldos, vipExpiraEm }),
  } as unknown as Response)));
};

describe('o saldo do servidor chega à tela', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    esquecer();
  });

  it('chega mesmo quando não há nada na fila para enviar', async () => {
    /**
     * É o caso do BOOT: fila vazia, espelho já buscado. Era aqui que a cópia
     * não acontecia — e é o caso mais comum que existe, porque toda sessão
     * começa assim.
     */
    respondeCom({ sucata: 9, nucleo: 2582, cristal: 4 });
    const sim = new Sim(createState(11));

    await sincronizar();
    expect(carteiraPronta(), 'o espelho já sabe o saldo').toBe(true);
    expect(carteira().saldos.nucleo).toBe(2582);

    await drenarCarteira(sim);

    expect(sim.state.resources.nucleo, 'a tela lê daqui').toBe(2582);
    expect(sim.state.resources.sucata).toBe(9);
    expect(sim.state.resources.cristal).toBe(4);
  });

  it('e o passe vem junto, pelo mesmo caminho', async () => {
    // `vip.expiresAt` sai da mesma cópia. Sem ela o jogador que pagou entra
    // sem passe, o que é pior que ver saldo zero.
    respondeCom({ sucata: 0, nucleo: 0, cristal: 0 }, 1_800_000_000);
    const sim = new Sim(createState(11));

    await sincronizar();
    await drenarCarteira(sim);

    expect(sim.state.vip.expiresAt).toBe(1_800_000_000 * 1000);
  });

  it('mas um servidor mudo NÃO zera o que já estava na tela', async () => {
    /**
     * A outra metade, e a razão de a cópia ser condicionada a `carteiraPronta`:
     * espelhar um espelho vazio escreveria zero por cima do saldo do save. Sem
     * esta guarda, o conserto de cima vira um defeito pior que o consertado —
     * "não sei" e "você tem zero" não são a mesma coisa.
     */
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as unknown as Response));
    const sim = new Sim(createState(11));
    sim.state.resources.nucleo = 777;

    await drenarCarteira(sim);

    expect(sim.state.resources.nucleo).toBe(777);
  });

  it('e o que estava na fila continua lá quando o envio falha', async () => {
    // Regressão do arranjo antigo: a fila é esvaziada ANTES do envio, e um
    // envio que falha tem de devolvê-la — senão some o ganho de um setor.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as unknown as Response));
    const sim = new Sim(createState(11));
    sim.state.pendentes.push({ moeda: 'sucata', quantia: 120, motivo: 'drop' });

    await drenarCarteira(sim);

    expect(sim.state.pendentes).toEqual([{ moeda: 'sucata', quantia: 120, motivo: 'drop' }]);
  });
});
