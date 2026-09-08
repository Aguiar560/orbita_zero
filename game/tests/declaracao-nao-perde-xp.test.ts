import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { WAVES_PER_SECTOR, precoDoEncontro } from '@sim/progression';
import { xpAcumuladoDe } from '@sim/nivel';
import { curvaXpPersonagem } from '@data/balance/curvas';

/**
 * A declaração de encontros cobre TODO o XP de combate?
 *
 * É a pergunta que decide se o servidor pode parar de acreditar no cliente e
 * passar a pagar. Enquanto a resposta for "quase", virar a chave tiraria XP de
 * quem jogou honesto — que é o erro que as duas primeiras tentativas da Fase 5
 * cometeram, e o que este trabalho inteiro existe para não repetir.
 *
 * O invariante:
 *
 * > a soma de `precoDoEncontro` sobre os encontros declarados é igual ao XP que
 * > o jogo creditou por combate.
 *
 * Se ele valer, virar a chave é seguro. Se não valer, a diferença é exatamente
 * o que o jogador perderia.
 */

const xpTotal = (sim: Sim): number => xpAcumuladoDe(sim.state.command, curvaXpPersonagem);

/** Soma o preço de tudo que o cliente declarou. */
function precoDeclarado(sim: Sim): number {
  let total = 0;
  for (const [chave, abates] of Object.entries(sim.state.encontros)) {
    const [setor, onda] = chave.split(':').map(Number);
    total += precoDoEncontro(sim.state, setor!, onda!, abates);
  }
  return total;
}

describe('o que o cliente declara', () => {
  it('cobre exatamente o XP que o combate pagou', () => {
    /**
     * Percorre um setor inteiro como a cena faz: abate cada onda em pedaços e
     * conclui. No fim, o preço do declarado tem de bater com o XP creditado.
     */
    for (const setor of [1, 8, 40]) {
      const sim = new Sim(createState(31));
      sim.state.run.sector = setor;
      sim.state.run.wave = 1;
      sim.refreshEncounter();

      const antes = xpTotal(sim);
      for (let onda = 1; onda <= WAVES_PER_SECTOR + 1; onda++) {
        const e = sim.encounter;
        let mortos = 0;
        while (mortos < e.unidades) {
          const lote = Math.min(9, e.unidades - mortos);
          sim.premiarAbates(lote, 1 / Math.max(1, e.unidades));
          mortos += lote;
        }
        sim.completeEncounter();
      }
      const pago = xpTotal(sim) - antes;

      expect(
        precoDeclarado(sim),
        `setor ${setor}: a declaração não cobre o XP do combate`,
      ).toBeCloseTo(pago, 3);
    }
  });

  it('e o caminho OFFLINE declara igual — os dois passam pelo mesmo funil', () => {
    /**
     * `premiarAbates` é o funil único do abate: a cena e o `abstractTick` passam
     * pelos dois. Se a declaração ficasse na cena, quem jogasse com a aba
     * fechada perderia tudo quando o servidor virasse pagador.
     */
    const sim = new Sim(createState(31));
    sim.jumpSector(8);
    for (let t = 0; t < 300; t += 0.5) sim.abstractTick(0.5);

    expect(Object.keys(sim.state.encontros).length, 'o offline não declarou nada')
      .toBeGreaterThan(0);
  });

  it('e nunca declara mais inimigos do que a onda tem', () => {
    // Um save honesto não pode dizer que matou 500 numa onda de 44 — o servidor
    // apara de novo, mas aparar aqui mantém o save coerente com o jogo.
    const sim = new Sim(createState(31));
    sim.state.run.sector = 40;
    sim.refreshEncounter();
    const e = sim.encounter;

    sim.premiarAbates(e.unidades * 10, 1 / Math.max(1, e.unidades));
    expect(sim.state.encontros[`${e.sector}:${e.wave}`]).toBe(e.unidades);
  });

  it('e sobrevive a fechar a aba: mora no save, não na memória', () => {
    /**
     * Fechar a aba entre duas drenagens é o caso comum num jogo idle. Se a
     * declaração vivesse em memória, esse trecho sumiria — e com o servidor
     * pagando, o XP dele junto.
     */
    const sim = new Sim(createState(31));
    sim.state.run.sector = 8;
    sim.refreshEncounter();
    sim.premiarAbates(5, 0.1);

    expect(Object.keys(sim.state.encontros).length).toBeGreaterThan(0);
    // O campo é do `GameState`, então o que o save grava já o inclui.
    expect(JSON.parse(JSON.stringify(sim.state)).encontros).toEqual(sim.state.encontros);
  });
});
