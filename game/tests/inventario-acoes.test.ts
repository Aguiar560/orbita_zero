import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const painel = readFileSync(new URL('../src/ui/panels/InventoryPanel.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

describe('ações em lote abaixo do inventário', () => {
  it('permite marcar vários itens sem confundir com a seleção da Anatomia', () => {
    expect(painel).toContain('private readonly selecionados = new Set<string>()');
    expect(painel).toContain('this.alternarMarcacao(sim, item)');
    expect(painel).toContain("'aria-selected': String(marcado)");
    expect(painel).not.toContain('button.inv-lote-toggle');
  });

  it('separa seleção em um clique de equipamento em clique duplo', () => {
    expect(painel).toContain('private tratarClique(sim: Sim, item: Item');
    expect(painel).toContain('if (anterior?.uid === item.uid)');
    expect(painel).toContain('this.equipar(sim, item)');
    expect(painel).toContain('timer: window.setTimeout(executar, 300)');
    expect(css).toContain('touch-action: manipulation');
  });

  it('oferece venda e desmontagem na barra depois da grade', () => {
    expect(painel).toContain("h('.inv-lote-bar'");
    expect(painel).toContain('button.inv-lote-acao.vender');
    expect(painel).toContain('button.inv-lote-acao.desmontar');
    expect(painel).toContain('sim.sell(item.uid)');
    expect(painel).toContain('sim.salvage(item.uid)');
  });

  it('exige confirmação antes das duas ações irreversíveis', () => {
    expect(painel).toContain('if (!confirm(`Vender ${rotulo}');
    expect(painel).toContain('if (!confirm(`Desmontar ${rotulo}');
    expect(painel.match(/Esta ação não pode ser desfeita\./g)).toHaveLength(2);
  });

  it('usa apenas o amarelo da célula e mantém as ações tocáveis no celular', () => {
    expect(css).toMatch(/\.inv-cell\.marcado \{[\s\S]*?border-color: #ffd65c !important/);
    expect(css).not.toContain('.inv-lote-toggle');
    expect(css).toMatch(/\.inv-lote-acao \{ min-height: 44px/);
  });
});
