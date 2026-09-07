import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const painel = readFileSync(new URL('../src/ui/panels/InventoryPanel.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

describe('ações visíveis de cada item do inventário', () => {
  it('oferece venda e desmontagem na ficha do item selecionado', () => {
    expect(painel).toContain("h('button.inv-item-action.vender'");
    expect(painel).toContain("h('button.inv-item-action.desmontar'");
  });

  it('usa as operações econômicas existentes', () => {
    expect(painel).toContain('sim.sell(item.uid)');
    expect(painel).toContain('sim.salvage(item.uid)');
  });

  it('mantém os botões tocáveis no celular', () => {
    expect(css).toMatch(/\.inv-tip:not\(\.hidden\)[\s\S]*?pointer-events: auto/);
    expect(css).toMatch(/\.inv-item-action \{ min-height: 44px/);
  });
});
