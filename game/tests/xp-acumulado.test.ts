import { describe, expect, it } from 'vitest';
import { NIVEL_MAX, curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { nivelPorXpAcumulado, xpAcumuladoAte, xpAcumuladoDe } from '@sim/nivel';
import { nivelDaNave, nivelDoPiloto } from '../server/src/progresso';

/**
 * Cliente e servidor guardam progresso de formas diferentes, e ninguém convertia.
 *
 * O cliente guarda **nível + resto**: `avancarNivel` soma o ganho e subtrai a
 * faixa a cada nível. O servidor guarda **acumulado** e deriva o nível. Os dois
 * são legítimos; o que não era legítimo é o cliente mandar a diferença do RESTO
 * e o servidor somar aquilo como se fosse acumulado.
 *
 * Medido em 08/09, simulando a ida e volta em cinquenta drenagens:
 *
 * | XP ganho | nível real | o servidor derivava |
 * |---|---|---|
 * | 500.000 | 22 | 13 |
 * | 5.000.000 | 39 | 28 |
 *
 * E a nave, cuja curva é mais curta, errava mais: nível real 50 contra 21.
 */

/** O que o cliente faz com XP hoje: `xp` é o resto dentro do nível. */
function comoOClienteFaz(ganhos: number[], faixa: (n: number) => number) {
  const p = { nivel: 1, xp: 0 };
  for (const ganho of ganhos) {
    p.xp += ganho;
    while (p.nivel < NIVEL_MAX && p.xp >= faixa(p.nivel)) { p.xp -= faixa(p.nivel); p.nivel++; }
    if (p.nivel >= NIVEL_MAX) p.xp = 0;
  }
  return p;
}

describe('a conversão entre nível+resto e acumulado', () => {
  it('vai e volta sem perder nada, em toda a escada', () => {
    for (const faixa of [curvaXpPersonagem, curvaXpNave]) {
      for (const nivel of [1, 2, 7, 33, 120, NIVEL_MAX]) {
        const acumulado = xpAcumuladoAte(nivel, faixa);
        expect(nivelPorXpAcumulado(acumulado, faixa).nivel, `nível ${nivel}`).toBe(nivel);
        expect(nivelPorXpAcumulado(acumulado, faixa).resto, `resto do nível ${nivel}`).toBe(0);
      }
    }
  });

  it('e o resto de meio nível continua sendo meio nível', () => {
    const meio = Math.floor(curvaXpPersonagem(10) / 2);
    const total = xpAcumuladoAte(10, curvaXpPersonagem) + meio;
    const v = nivelPorXpAcumulado(total, curvaXpPersonagem);
    expect(v.nivel).toBe(10);
    expect(v.resto).toBe(meio);
  });

  it('e o nível 1 custa zero — senão todo save novo começaria devendo', () => {
    expect(xpAcumuladoAte(1, curvaXpNave)).toBe(0);
    expect(nivelPorXpAcumulado(0, curvaXpNave)).toEqual({ nivel: 1, resto: 0 });
  });
});

describe('o acumulado que o cliente declara', () => {
  it('reconstrói exatamente o nível a que ele chegou jogando', () => {
    /**
     * É o teste que amarra os dois modelos. Se ele passa, mandar
     * `xpAcumuladoDe` pelo fio e derivar do outro lado devolve o MESMO nível —
     * que era justamente o que não acontecia.
     */
    for (const [faixa, nome] of [[curvaXpPersonagem, 'piloto'], [curvaXpNave, 'nave']] as const) {
      for (const total of [500, 5_000, 50_000, 500_000, 5_000_000]) {
        // Em fatias, como o jogo faz: XP entra muitas vezes por segundo.
        const fatias = Array.from({ length: 50 }, () => total / 50);
        const local = comoOClienteFaz(fatias, faixa);
        const acumulado = xpAcumuladoDe(local, faixa);
        const derivado = nivelPorXpAcumulado(acumulado, faixa);
        expect(derivado.nivel, `${nome} com ${total} de XP`).toBe(local.nivel);
      }
    }
  });
});

describe('o servidor', () => {
  it('deriva o MESMO nível que o cliente tem — e não um menor', () => {
    /**
     * `nivelPorXp` comparava o acumulado contra o tamanho de UMA faixa
     * (`total >= curva(nivel + 1)`) em vez de descontar faixa a faixa. Somado
     * ao fio que mandava restos, o resultado era o nível do jogador encolhendo.
     */
    for (const total of [500, 5_000, 50_000, 500_000, 5_000_000]) {
      const fatias = Array.from({ length: 50 }, () => total / 50);

      const piloto = comoOClienteFaz(fatias, curvaXpPersonagem);
      expect(nivelDoPiloto(xpAcumuladoDe(piloto, curvaXpPersonagem)), `piloto com ${total}`)
        .toBe(piloto.nivel);

      const nave = comoOClienteFaz(fatias, curvaXpNave);
      expect(nivelDaNave(xpAcumuladoDe(nave, curvaXpNave)), `nave com ${total}`)
        .toBe(nave.nivel);
    }
  });
});
