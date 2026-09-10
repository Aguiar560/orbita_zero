import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * O encontro é concluído no COMEÇO da pausa de vitória, não no fim.
 *
 * Relato de 10/09/2026: recarregar a página durante o painel "SETOR
 * CONCLUÍDO" trazia a guarda de elite de volta, com drop novo — farm infinito
 * da última onda. A pausa de 5 s era uma janela em que a onda estava vencida e
 * o save ainda dizia "última onda".
 *
 * Lido do fonte porque a regra mora na cena, e a suíte não tem DOM nem canvas.
 */

const cena = readFileSync(new URL('../src/modes/vertical/VerticalMode.ts', import.meta.url), 'utf8');

/** O corpo de um método, do nome até a próxima declaração no mesmo nível. */
function corpo(nome: string): string {
  const inicio = cena.indexOf(`private ${nome}(`);
  expect(inicio, `método ${nome} não encontrado`).toBeGreaterThan(-1);
  const resto = cena.slice(inicio + 1);
  const fim = resto.search(/\n {2}(private|public|get|set|\/\*\*|[a-zA-Z]+\()/);
  return resto.slice(0, fim < 0 ? undefined : fim);
}

describe('a pausa de vitória é só tela', () => {
  it('beginVictory conclui o encontro, fora da Provação', () => {
    expect(corpo('beginVictory')).toContain('if (!d) this.sim.completeEncounter();');
  });

  it('o fim da pausa não conclui de novo', () => {
    expect(corpo('checkCleared')).not.toContain('completeEncounter');
  });

  it('e a cena não monta a próxima onda por trás do painel', () => {
    expect(cena).toContain('if (this.victory <= 0) this.syncEncounter();');
  });
});
