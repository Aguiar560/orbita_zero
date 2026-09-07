import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { OPERACOES_DE_MODULACAO, custoDeModulacao } from '@data/balance/modulacao';
import { aplicarModulacao } from '@sim/modulacao';
import { rollItem } from '@sim/loot';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

describe('Bancada de Modulação', () => {
  it('tem exatamente uma operação para cada essência da Provação', () => {
    expect(OPERACOES_DE_MODULACAO).toHaveLength(10);
    expect(new Set(OPERACOES_DE_MODULACAO.map((o) => o.id)).size).toBe(10);
    expect(new Set(OPERACOES_DE_MODULACAO.map((o) => o.essencia)).size).toBe(10);
  });

  it('cobra núcleos e a essência declarada sem cobrar uma operação inválida', () => {
    const state = createState(22);
    state.resources.nucleo = 1_000_000;
    const sim = new Sim(state);
    const item = rollItem(new Rng(220), 80, 0, 0, { exata: 3, slot: 'principal' });
    sim.state.inventory.push(item);
    const op = OPERACOES_DE_MODULACAO[0]!;
    // O custo consulta a MESMA linha que a operação vai transformar: o tier
    // dela pesa no preço, e sem o índice o teste mediria outra conta.
    const custo = custoDeModulacao(item, op, 0);
    sim.guardarMaterial(op.essencia, 20);
    // O terceiro ingrediente: o minério do elemento da peça. Sem ele a operação
    // é recusada — e recusar por falta é o comportamento certo.
    if (custo.minerio) sim.guardarMaterial(custo.minerio, custo.quantidadeDeMinerio + 10);
    const nucleos = sim.state.resources.nucleo;
    const essencias = sim.materialDisponivel(op.essencia);
    const minerios = custo.minerio ? sim.materialDisponivel(custo.minerio) : 0;

    expect(sim.modulateItem(item.uid, op.id, 0)).not.toBeNull();
    expect(sim.state.resources.nucleo).toBe(nucleos - custo.nucleos);
    expect(sim.materialDisponivel(op.essencia)).toBe(essencias - custo.quantidade);
    if (custo.minerio) {
      expect(sim.materialDisponivel(custo.minerio)).toBe(minerios - custo.quantidadeDeMinerio);
    }

    const depois = sim.materialDisponivel(op.essencia);
    expect(sim.modulateItem(item.uid, 'dissolver', 999)).toBeNull();
    expect(sim.materialDisponivel(op.essencia)).toBe(depois);
  });

  it('ancora, abre espaço, imprime e desfaz pelo Eco Temporal', () => {
    const rng = new Rng(331);
    const item = rollItem(rng, 100, 0, 0, { exata: 4, slot: 'principal' });
    const quantidadeOriginal = item.affixes.length;

    expect(aplicarModulacao(rng, item, 'ancorar', 0)).not.toBeNull();
    expect(item.affixes[0]!.locked).toBe(true);
    expect(aplicarModulacao(rng, item, 'lapidar', 0)).toBeNull();

    expect(aplicarModulacao(rng, item, 'dissolver', 1)).not.toBeNull();
    expect(item.affixes).toHaveLength(quantidadeOriginal - 1);
    expect(aplicarModulacao(rng, item, 'imprimir_prefixo', -1)).not.toBeNull();
    expect(item.affixes).toHaveLength(quantidadeOriginal);

    const antesDoEco = item.affixes.map((a) => a.id);
    expect(aplicarModulacao(rng, item, 'eco_temporal', -1)).not.toBeNull();
    expect(item.affixes.map((a) => a.id)).not.toEqual(antesDoEco);
  });

  it('o aperfeiçoamento primordial respeita linhas ancoradas e garante 75%', () => {
    const rng = new Rng(442);
    const item = rollItem(rng, 120, 0, 0, { exata: 5, slot: 'escudo' });
    item.affixes[0]!.locked = true;
    const locked = { ...item.affixes[0]! };
    expect(aplicarModulacao(rng, item, 'primordial', -1)).not.toBeNull();
    expect(item.affixes[0]).toEqual(locked);
    expect(item.affixes.slice(1).every((a) => a.quality >= 0.75)).toBe(true);
  });
});
