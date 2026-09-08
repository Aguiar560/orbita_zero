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
    expect(painel).not.toContain('NENHUM ITEM SELECIONADO');
    expect(painel).toContain("quantidade\n          ? h('strong'");
    expect(painel).toContain('button.inv-lote-acao.vender');
    expect(painel).toContain('button.inv-lote-acao.desmontar');
    expect(painel).toContain('sim.sell(item.uid)');
    expect(painel).toContain('sim.salvage(item.uid)');
  });

  it('seleciona todos os itens permitidos pelo filtro atual', () => {
    expect(painel).toContain('this.barraDeLote(sim, lote, items)');
    expect(painel).toContain('visiveis.filter((item) => !item.favorite)');
    expect(painel).toContain('text: todosVisiveisSelecionados');
    expect(painel).toContain("'DESMARCAR TODOS'");
    expect(painel).toContain('`SELECIONAR TODOS (${selecionaveis.length})`');
    expect(painel).toContain('private alternarTodosVisiveis');
    expect(painel).toMatch(/alternarTodosVisiveis[\s\S]*?this\.selecionados\.clear\(\)[\s\S]*?for \(const item of visiveis\)/);
  });

  it('reserva o canto do chat sem repetir a explicação da confirmação', () => {
    expect(css).toMatch(/\.inv-lote-bar \{[\s\S]*?padding: 10px 112px 10px 10px/);
    expect(painel).not.toContain('A ação só acontece depois da confirmação.');
  });

  it('exige confirmação antes das duas ações irreversíveis', () => {
    expect(painel).not.toMatch(/\bconfirm\(/);
    expect(painel).toContain("h('.inv-confirmacao-camada'");
    expect(painel).toContain("role: 'dialog', 'aria-modal': 'true'");
    expect(painel).toContain("h('span', { text: 'Esta ação não pode ser desfeita.' })");
    expect(painel).toContain("if (e.key === 'Escape')");
  });

  it('usa apenas o amarelo da célula e mantém as ações tocáveis no celular', () => {
    expect(css).toMatch(/\.inv-cell\.marcado \{[\s\S]*?border-color: #ffd65c !important/);
    expect(css).not.toContain('.inv-lote-toggle');
    expect(css).toMatch(/\.inv-lote-acao,\s*\.inv-selecionar-todos \{ min-height: 44px/);
  });
});
