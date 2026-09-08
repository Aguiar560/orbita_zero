import { describe, expect, it } from 'vitest';
import { PERSONAGENS } from '@data/personagens';
import {
  TIER_MAX, multiplicadorDoTier, raridadeExclusivaDoTier, tierDoContato, tierDoContatoPorId,
} from '@data/balance/contatos';

/**
 * O tier do contato: escondido do jogador, sentido na recompensa.
 *
 * Ele não é uma decisão do jogador — ninguém escolhe contato por número.
 * Mostrá-lo trocaria "com quem eu quero trabalhar" por "qual dá mais", e a
 * barra de confiança perderia o sentido junto, porque ela mede vínculo.
 *
 * O jogador PERCEBE: a recompensa cresce, e a peça no fim da cadeia é Lendária
 * em vez de Épica. Ele só não lê o número.
 */

describe('o tier de cada contato', () => {
  it('é derivado da galáxia, e cobre todos os contatos', () => {
    /**
     * A galáxia já ordena o jogo inteiro — dificuldade, nível de item,
     * material. Um tier escrito à mão ao lado disso criaria uma segunda ordem,
     * livre para discordar da primeira no dia em que alguém mexesse numa e
     * esquecesse da outra.
     */
    for (const p of PERSONAGENS) {
      const t = tierDoContato(p);
      expect(t, p.nome).toBeGreaterThanOrEqual(1);
      expect(t, p.nome).toBeLessThanOrEqual(TIER_MAX);
    }
  });

  it('e sobe junto com a galáxia, sem pular degrau', () => {
    // Ordenar por galáxia tem de produzir tiers não-decrescentes: se um contato
    // de galáxia alta tivesse tier menor que um de galáxia baixa, a recompensa
    // andaria para trás no meio da campanha.
    const ordenados = [...PERSONAGENS]
      .filter((p) => p.galaxia !== null)
      .sort((a, b) => a.galaxia! - b.galaxia!);
    let anterior = 0;
    for (const p of ordenados) {
      const t = tierDoContato(p);
      expect(t, `${p.nome} (g${p.galaxia! + 1})`).toBeGreaterThanOrEqual(anterior);
      anterior = t;
    }
  });

  it('e o override explícito vence a derivação', () => {
    /**
     * A porta existe para a história pedir um contato pequeno numa galáxia
     * grande — ou o contrário. O padrão continua sendo a derivação.
     */
    const fingido = { ...PERSONAGENS[0]!, galaxia: 29, tier: 1 };
    expect(tierDoContato(fingido)).toBe(1);
  });

  it('e um id desconhecido cai no tier 1, sem estourar', () => {
    // Missão órfã ou save antigo não pode derrubar a entrega da recompensa.
    expect(tierDoContatoPorId('char_que_nao_existe')).toBe(1);
  });
});

describe('o que o tier muda', () => {
  it('a recompensa vai de 1× a 3×, sem explodir', () => {
    /**
     * Meio ponto por degrau, e não exponencial: a curva de dificuldade da
     * galáxia já é íngreme, e multiplicar íngreme por íngreme produz o salto
     * que faz o conteúdo antigo virar perda de tempo.
     */
    expect(multiplicadorDoTier(1)).toBe(1);
    expect(multiplicadorDoTier(TIER_MAX)).toBe(3);
    for (let t = 2; t <= TIER_MAX; t++) {
      expect(multiplicadorDoTier(t)).toBeGreaterThan(multiplicadorDoTier(t - 1));
    }
  });

  it('e a peça final sobe de Épica a Mítica ao longo da escada', () => {
    expect(raridadeExclusivaDoTier(1)).toBe(3);
    expect(raridadeExclusivaDoTier(2)).toBe(3);
    expect(raridadeExclusivaDoTier(3)).toBe(4);
    expect(raridadeExclusivaDoTier(4)).toBe(4);
    // Mítico no topo: decisão do Rafael em 07/09. São seis contatos no tier 5,
    // cada um com uma cadeia inteira até o fim, nas galáxias 25 a 30.
    expect(raridadeExclusivaDoTier(TIER_MAX)).toBe(5);
  });

  it('e NUNCA chega a Divino', () => {
    /**
     * O Divino CAI — peso 0,00323, ou 1 em 300 mil no teto de Sorte, medido em
     * 07/09. O que ele não pode é ser GARANTIDO: uma peça certa no fim de uma
     * cadeia de missões é o oposto de 1 em 300 mil, e apagaria a única raridade
     * do jogo cuja graça é ser quase inalcançável.
     */
    for (let t = 1; t <= TIER_MAX; t++) {
      expect(raridadeExclusivaDoTier(t), `tier ${t}`).toBeLessThanOrEqual(5);
    }
    expect(raridadeExclusivaDoTier(TIER_MAX)).toBeLessThan(6);
  });

  it('e o tier NÃO aparece em tela nenhuma', () => {
    /**
     * "Escondido" é requisito, não detalhe. Se um painel começar a desenhar o
     * número, este teste cai — e a discussão volta à mesa antes de o jogador
     * aprender a escolher contato por tabela.
     */
    const { readFileSync, readdirSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const dir = join(process.cwd(), 'src', 'ui');
    const arquivos: string[] = [];
    const varrer = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) varrer(p);
        else if (e.name.endsWith('.ts')) arquivos.push(p);
      }
    };
    varrer(dir);

    const usam = arquivos.filter((f) => /tierDoContato|multiplicadorDoTier/.test(readFileSync(f, 'utf8')));
    expect(usam, `interface não deve ler o tier: ${usam.join(', ')}`).toEqual([]);
  });
});
