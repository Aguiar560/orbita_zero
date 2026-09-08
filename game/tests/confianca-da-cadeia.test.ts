import { describe, expect, it } from 'vitest';
import { CONFIANCA_MAX, PERSONAGENS } from '@data/personagens';
import { cadeiaDoContato, confiancaDaCadeia, confiancaDaMissao } from '@data/balance/confianca';
import { MISSOES } from '@data/missoes';

/**
 * A confiança sobe ao longo da cadeia, e a cadeia fecha exatamente no teto.
 *
 * Ela era escrita à mão, quase sempre `1`, e o resultado estourava: **Kael Voss
 * tinha 7 missões somando 8 para um máximo de 5** (medido em 07/09). A barra
 * enchia na quarta missão e as três últimas não valiam nada — fazer a cadeia
 * inteira pagava o mesmo que largar no meio.
 *
 * Agora as primeiras missões de um contato entregam menos e as últimas mais,
 * com os pesos normalizados pela cadeia. Isso dá razão para seguir até o fim e
 * faz a escada contar uma história: conhecer alguém é diferente de trabalhar
 * para ele há meses.
 */

describe('a escada de confiança de cada contato', () => {
  it('a cadeia inteira entrega exatamente o teto', () => {
    /**
     * O invariante que permite cadastrar quinze missões novas sem recalcular
     * nada: o valor de cada uma cai sozinho do tamanho da cadeia.
     */
    for (const p of PERSONAGENS) {
      const cadeia = cadeiaDoContato(p.id);
      if (!cadeia.length) continue;
      expect(confiancaDaCadeia(p.id), p.nome).toBeCloseTo(CONFIANCA_MAX, 6);
    }
  });

  it('e NENHUM contato estoura o teto', () => {
    /**
     * A linha de base antiga registrava três contatos estourando — Kael Voss
     * com 8, Lira Nexus com 7, Zyrak com 6. Ela existia para falhar quando o
     * conserto viesse. Veio.
     */
    const excedem = PERSONAGENS
      .filter((p) => cadeiaDoContato(p.id).length)
      .filter((p) => confiancaDaCadeia(p.id) > CONFIANCA_MAX + 1e-9)
      .map((p) => p.nome);
    expect(excedem).toEqual([]);
  });

  it('e cada missão vale mais que a anterior', () => {
    for (const p of PERSONAGENS) {
      const cadeia = cadeiaDoContato(p.id);
      if (cadeia.length < 2) continue;
      for (let i = 1; i < cadeia.length; i++) {
        expect(
          confiancaDaMissao(cadeia[i]!),
          `${p.nome}: ${cadeia[i]!.nome} deveria valer mais que ${cadeia[i - 1]!.nome}`,
        ).toBeGreaterThan(confiancaDaMissao(cadeia[i - 1]!));
      }
    }
  });

  it('e a rampa é suave: a última vale ~2× a primeira, não 15×', () => {
    /**
     * Uma rampa proporcional pura (peso = posição) daria 15× numa cadeia de
     * quinze, e aí as primeiras dez missões virariam enfeite — o oposto do que
     * se quer, já que são elas que apresentam o contato.
     */
    for (const p of PERSONAGENS) {
      const cadeia = cadeiaDoContato(p.id);
      if (cadeia.length < 2) continue;
      const razao = confiancaDaMissao(cadeia[cadeia.length - 1]!) / confiancaDaMissao(cadeia[0]!);
      expect(razao, p.nome).toBeGreaterThan(1);
      expect(razao, p.nome).toBeLessThan(4);
    }
  });

  it('e uma cadeia de quinze fecha no teto do mesmo jeito', () => {
    /**
     * O caso que ainda não existe no catálogo, e é para onde o conteúdo vai.
     * Testar a fórmula com quinze aqui é o que garante que cadastrar as missões
     * não vai exigir um segundo conserto.
     */
    const INCLINACAO = 0.15;
    const pesos = Array.from({ length: 15 }, (_, i) => 1 + i * INCLINACAO);
    const total = pesos.reduce((s, w) => s + w, 0);
    const valores = pesos.map((w) => (CONFIANCA_MAX * w) / total);

    expect(valores.reduce((s, v) => s + v, 0)).toBeCloseTo(CONFIANCA_MAX, 6);
    expect(valores[0]!).toBeCloseTo(0.16, 2);
    expect(valores[14]!).toBeCloseTo(0.50, 2);
  });

  it('e missão sem contato não entrega confiança nenhuma', () => {
    const orfa = { ...MISSOES[0]!, giverId: undefined };
    expect(confiancaDaMissao(orfa)).toBe(0);
  });

  it('e o valor NÃO é mais escrito à mão em missão nenhuma', () => {
    /**
     * O campo existia e era usado por todas as 21 missões, o que fazia a
     * derivação nunca valer. Uma regra só — se um contrato precisar valer mais
     * que a posição sugere, o lugar é dentro de `confianca.ts`, com nome e
     * motivo, não um número solto na tabela.
     */
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const fonte = readFileSync(join(process.cwd(), 'src', 'data', 'missoes.ts'), 'utf8');
    expect(fonte).not.toMatch(/^\s*confianca: \d+,/m);
  });
});
