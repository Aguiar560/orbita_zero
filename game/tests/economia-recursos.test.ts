import { describe, expect, it } from 'vitest';
import { quantidadeDeMaterialGalactico, ALVOS_DE_FARM } from '@data/balance/economia-recursos';
import { RECEITAS } from '@data/balance/fusao';
import { recursoDaGalaxia } from '@data/recursos';

describe('economia dirigida de recursos', () => {
  it('a renda cresce por faixa e chefe paga bônus sem Sorte dominar', () => {
    expect(quantidadeDeMaterialGalactico(1, 0)).toBe(5);
    expect(quantidadeDeMaterialGalactico(10, 0)).toBe(7);
    expect(quantidadeDeMaterialGalactico(251, 0)).toBe(10);
    expect(quantidadeDeMaterialGalactico(260, 0)).toBe(12);
    expect(quantidadeDeMaterialGalactico(260, 99)).toBe(15);
  });

  it('custos galácticos ficam em uma faixa conferível de conclusões dirigidas', () => {
    for (const receita of RECEITAS.slice(0, 5)) {
      let setores = 0;
      for (const [id, custo] of Object.entries(receita.custo)) {
        const galaxia = Array.from({ length: 30 }, (_, i) => i).find((i) => recursoDaGalaxia(i)?.id === id);
        // Tecnologia de chefe não entra na conta de setores; tem alvo próprio.
        if (galaxia === undefined) continue;
        const setorMedio = galaxia * 10 + 5;
        setores += custo / quantidadeDeMaterialGalactico(setorMedio, 0);
      }
      expect(setores, receita.id).toBeGreaterThanOrEqual(ALVOS_DE_FARM.receitaGalacticaMinSetores - 1);
      expect(setores, receita.id).toBeLessThanOrEqual(ALVOS_DE_FARM.receitaGalacticaMaxSetores + 1);
    }
  });
});
