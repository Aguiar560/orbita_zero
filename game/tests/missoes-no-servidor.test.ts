import { describe, expect, it } from 'vitest';
import {
  confiancaDerivada, linhaSa, mesclarMissao, podeEntregar, type LinhaDeMissao,
} from '../server/src/missoes';
import { MISSOES, MISSAO_POR_ID } from '@data/missoes';
import { confiancaDaMissao } from '@data/balance/confianca';
import { CONFIANCA_MAX } from '@data/personagens';

/**
 * Missões e confiança do lado do servidor — validação B, fatia 1.
 *
 * Hoje `resgatarMissao` roda inteiro no cliente: confere `situacaoDe` contra
 * `state.missoes`, que é save escrito pelo cliente, e paga com `grant()`.
 * Marcar uma missão como pronta no save faz o servidor pagar.
 *
 * E como `missoes` viaja dentro do bloco do save, duas máquinas em paralelo
 * terminam com o bloco de uma delas — a outra perde o que avançou.
 */

const linha = (p: Partial<LinhaDeMissao> = {}): LinhaDeMissao =>
  ({ passos: [], iniciada: false, entregueEm: null, ...p });

/** Uma missão real do catálogo, com um objetivo só, para os testes de alvo. */
const simples = MISSOES.find((m) => m.objetivos.length === 1)!;

describe('a mescla entre aparelhos', () => {
  it('toma o MAIOR de cada passo — progresso só sobe', () => {
    /**
     * É esta regra que faz o multi-dispositivo funcionar sem código de mescla.
     * Sem ela, quem jogou nas duas máquinas perderia o avanço de uma — que é o
     * defeito que a Matriz e o casco em campo já tiveram, cada um do seu jeito.
     */
    const r = mesclarMissao(
      linha({ passos: [40, 2] }),
      linha({ passos: [12, 9] }),
    );
    expect(r.passos).toEqual([40, 9]);
  });

  it('e aceitar em qualquer aparelho vale nos dois', () => {
    expect(mesclarMissao(linha(), linha({ iniciada: true })).iniciada).toBe(true);
    expect(mesclarMissao(linha({ iniciada: true }), linha()).iniciada).toBe(true);
  });

  it('e a ENTREGA é irreversível: o primeiro carimbo vence', () => {
    // Sem isto, um aparelho com o save antigo desfaria a entrega feita no
    // outro — e a missão voltaria a poder ser entregue de novo, pagando duas.
    expect(mesclarMissao(linha({ entregueEm: 100 }), linha({ entregueEm: 200 })).entregueEm)
      .toBe(100);
    expect(mesclarMissao(linha({ entregueEm: 100 }), linha()).entregueEm).toBe(100);
    expect(mesclarMissao(linha(), linha({ entregueEm: 200 })).entregueEm).toBe(200);
  });

  it('e mesclar duas vezes dá o mesmo que mesclar uma — a semeadura é segura', () => {
    /**
     * A migração é o cliente mandar `state.missoes` inteiro uma vez. Ela só é
     * segura porque a mescla é idempotente: semear duas vezes não duplica nada.
     */
    const a = linha({ passos: [40], iniciada: true, entregueEm: 7 });
    const uma = mesclarMissao(null, a);
    expect(mesclarMissao(uma, a)).toEqual(uma);
  });
});

describe('a validação da entrega (nível B)', () => {
  it('recusa missão que não existe no catálogo', () => {
    expect(podeEntregar('missao_inventada', linha({ passos: [999] })))
      .toBe('missao_desconhecida');
  });

  it('e recusa entregar duas vezes', () => {
    expect(podeEntregar(simples.id, linha({ passos: [999], entregueEm: 1 })))
      .toBe('ja_entregue');
  });

  it('e recusa quem não alcançou o ALVO de cada objetivo', () => {
    /**
     * É o que fecha "marquei como pronta no save". O catálogo é `@data`, que o
     * servidor já importa, então a conferência usa a MESMA tabela do cliente —
     * não há cópia da regra para divergir.
     */
    const alvo = simples.objetivos[0]!.alvo;
    expect(podeEntregar(simples.id, linha({ passos: [alvo - 1] })))
      .toBe('passos_insuficientes');
    expect(podeEntregar(simples.id, linha({ passos: [alvo] }))).toBeNull();
  });

  it('e cobra TODOS os objetivos, não só o primeiro', () => {
    const composta = MISSOES.find((m) => m.objetivos.length > 1);
    if (!composta) return; // catálogo sem missão composta hoje
    const alvos = composta.objetivos.map((o) => o.alvo);
    expect(podeEntregar(composta.id, linha({ passos: [alvos[0]!, 0] })))
      .toBe('passos_insuficientes');
    expect(podeEntregar(composta.id, linha({ passos: alvos }))).toBeNull();
  });
});

describe('a confiança', () => {
  it('é DERIVADA das entregas, sem coluna própria', () => {
    /**
     * No cliente ela é `min(MAX, atual + confiancaDaMissao(def))`, concedida
     * uma vez por entrega. Somar sobre o que foi entregue devolve o mesmo
     * número — então guardar uma segunda cópia só criaria uma coisa a mais para
     * divergir, que é o argumento que o servidor já usa para o nível e o XP.
     */
    const doContato = MISSOES.filter((m) => m.giverId === MISSOES[0]!.giverId).slice(0, 3);
    if (!doContato.length || !doContato[0]!.giverId) return;

    const esperado = Math.min(
      CONFIANCA_MAX,
      doContato.reduce((s, m) => s + confiancaDaMissao(m), 0),
    );
    const r = confiancaDerivada(doContato.map((m) => m.id));
    expect(r[doContato[0]!.giverId!]).toBeCloseTo(esperado, 6);
  });

  it('e nunca passa do teto, por mais missões que sejam entregues', () => {
    const todas = MISSOES.filter((m) => m.giverId).map((m) => m.id);
    for (const valor of Object.values(confiancaDerivada(todas))) {
      expect(valor).toBeLessThanOrEqual(CONFIANCA_MAX);
    }
  });

  it('e missão sem contato não gera confiança para ninguém', () => {
    const semContato = MISSOES.find((m) => !m.giverId);
    if (!semContato) return;
    expect(Object.keys(confiancaDerivada([semContato.id]))).toHaveLength(0);
  });
});

describe('o que vem do cliente', () => {
  it('é saneado antes de virar linha — nada é acreditado como veio', () => {
    const r = linhaSa({ passos: ['12', -4, Number.NaN], iniciada: 'sim', entregueEm: -1 })!;
    expect(r.passos).toEqual([12, 0, 0]);
    expect(r.iniciada, 'só o booleano true liga').toBe(false);
    expect(r.entregueEm, 'carimbo negativo não é carimbo').toBeNull();
  });

  it('e lixo vira nulo em vez de derrubar o envio', () => {
    expect(linhaSa(null)).toBeNull();
    expect(linhaSa('missao')).toBeNull();
    expect(linhaSa(42)).toBeNull();
  });

  it('e um vetor de passos absurdo é aparado', () => {
    // Nenhuma missão do catálogo tem oito objetivos; o teto existe para um
    // envio adulterado não virar uma linha gigante no D1.
    const maior = Math.max(...MISSOES.map((m) => m.objetivos.length));
    expect(maior).toBeLessThanOrEqual(8);
    expect(linhaSa({ passos: new Array(500).fill(1) })!.passos.length).toBeLessThanOrEqual(8);
  });
});

describe('o catálogo', () => {
  it('tem alvo positivo em todo objetivo — senão a validação B aceita tudo', () => {
    for (const m of MISSOES) {
      for (const o of m.objetivos) {
        expect(o.alvo, `${m.id} tem objetivo sem alvo`).toBeGreaterThan(0);
      }
    }
    expect(MISSAO_POR_ID.size).toBe(MISSOES.length);
  });
});
