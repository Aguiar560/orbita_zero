import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Item, Rarity } from '@sim/types';

/**
 * Desmontar e vender automaticamente são benefício do Passe VIP.
 *
 * Regra de 12/09/2026: "auto desmontar e auto vender apenas VIP pode ter". Antes
 * disso o corte por raridade era de todos e só a VENDA era VIP.
 *
 * Medido no dia da mudança, nos saves de produção: 5 contas tinham corte
 * ligado, 3 delas VIP. Duas perderam a automação — e é por isso que a tela
 * precisa DIZER que é VIP, em vez de só parar de funcionar.
 */

const peca = (rarity: number): Item => ({
  uid: `x${rarity}`, baseId: 'principal_1', slot: 'principal', rarity: rarity as Rarity,
  ilvl: 10, affixes: [], icon: '', origin: 1,
});

const comVip = (sim: Sim, ativo: boolean): void => {
  sim.state.vip.expiresAt = ativo ? Date.now() + 86_400_000 : 0;
};

describe('o descarte automático é do Passe', () => {
  it('sem VIP, o corte por raridade não pega — nem para desmontar', () => {
    const sim = new Sim(createState(1));
    sim.state.settings.autoSalvage = 3 as Rarity;
    comVip(sim, false);

    expect(sim.descarteAutomaticoPega(peca(1)), 'desmontou sem Passe').toBe(false);
    // E a conta de espaço tem de concordar: peça que não some ocupa lugar.
    expect(sim.ocupaEspaco(peca(1))).toBe(true);
  });

  it('com VIP, pega o que está abaixo do corte', () => {
    const sim = new Sim(createState(2));
    sim.state.settings.autoSalvage = 3 as Rarity;
    comVip(sim, true);

    expect(sim.descarteAutomaticoPega(peca(1))).toBe(true);
    expect(sim.ocupaEspaco(peca(1)), 'a peça soma e some ao mesmo tempo').toBe(false);
    // No corte ou acima dele, a peça é guardada — o corte é "abaixo de".
    expect(sim.descarteAutomaticoPega(peca(3))).toBe(false);
    expect(sim.descarteAutomaticoPega(peca(4))).toBe(false);
  });

  it('e o corte desligado não pega nada, nem com VIP', () => {
    const sim = new Sim(createState(3));
    sim.state.settings.autoSalvage = 0 as Rarity;
    comVip(sim, true);

    expect(sim.descarteAutomaticoPega(peca(0))).toBe(false);
  });

  it('as duas telas desabilitam e explicam, em vez de esconder', () => {
    // Automação que some sem explicação parece defeito; a que se vê bloqueada
    // explica e convida. Lido do fonte: a suíte não tem DOM.
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');
    expect(inventario).toContain('Somente Passe VIP pode acionar o descarte automático');
    expect(inventario).toContain('disabled: !vip');

    const config = readFileSync('src/ui/panels/SettingsPanel.ts', 'utf8');
    expect(config).toContain('Somente Passe VIP pode acionar o descarte automático');
    expect(config).toContain('disabled: !vip');
  });

  it('e o Inventário escreve no MESMO ajuste que as Configurações', () => {
    // Dois lugares, um estado. Um segundo campo é que seria duplicata — e
    // divergiria no primeiro dia em que alguém mudasse um só deles.
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');
    expect(inventario).toContain('s.autoSalvage = Number(');
    expect(inventario).toContain('s.autoDispose = valor;');
  });
});
