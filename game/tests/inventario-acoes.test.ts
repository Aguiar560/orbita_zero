import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const painel = readFileSync(new URL('../src/ui/panels/InventoryPanel.ts', import.meta.url), 'utf8');
const ficha = readFileSync(new URL('../src/ui/ItemCard.ts', import.meta.url), 'utf8');
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
    expect(painel).toContain('this.botaoSelecionarTodos(sim, items)');
    expect(painel).toContain('this.barraDeLote(sim, lote)');
    expect(painel).toContain('visiveis.filter((item) => !item.favorite)');
    expect(painel).toContain('text: todosVisiveisSelecionados');
    expect(painel).toContain("'DESMARCAR TODOS'");
    expect(painel).toContain('`SELECIONAR TODOS (${selecionaveis.length})`');
    expect(painel).toContain('private alternarTodosVisiveis');
    expect(painel).toMatch(/alternarTodosVisiveis[\s\S]*?this\.selecionados\.clear\(\)[\s\S]*?for \(const item of visiveis\)/);
    expect(painel).not.toContain('Clique seleciona · duplo clique equipa');
    expect(painel).not.toContain('Um toque seleciona (amarelo)');
    expect(css).toMatch(/\.inv-selecao-filtro \{[^}]*width: 100%/);
    expect(css).toMatch(/\.inv-selecionar-todos \{[^}]*width: 100%/);
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

  it('mantém a ficha acima das ações e separa suas três seções', () => {
    expect(painel).toMatch(/this\.botaoSelecionarTodos\(sim, items\),[\s\S]*?this\.tip,[\s\S]*?h\('\.inv-wrap'/);
    expect(painel).toContain("cell.closest('.inv-body')");
    expect(css).toMatch(/\.inv-tip \{\s*position: absolute; z-index: 30/);
    expect(css).toMatch(/\.inv-lote-bar \{[\s\S]*?position: sticky; z-index: 12/);
    expect(css).toMatch(/\.tip-vs \{[^}]*margin-top: 12px; padding-top: 9px/);
    expect(css).toMatch(/\.inv-tip \.tip-foot[^}]*margin-top: 12px; padding-top: 9px/);
    expect(ficha).not.toContain('contra o equipado');
    expect(ficha).toContain("h('.tip-vs.comparando'");
  });
});
