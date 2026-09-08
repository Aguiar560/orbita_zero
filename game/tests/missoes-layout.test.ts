import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const painel = readFileSync(new URL('../src/ui/panels/MissoesPanel.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

describe('layout dos contratos especiais', () => {
  it('nao cria uma celula vazia que distorce a grade do contrato', () => {
    const inicio = painel.indexOf('private cardEspecial');
    const fim = painel.indexOf('private arteDoExclusivo', inicio);
    const cardEspecial = painel.slice(inicio, fim);

    expect(cardEspecial).toContain("...(pronta");
    expect(cardEspecial).not.toContain(": h('span')");
  });

  it('empilha o contrato especial dentro da propria caixa em tela estreita', () => {
    expect(css).toMatch(/\.camada:has\(\.mis\) \.mis-card\.mis-especial \{\s*grid-template-columns: minmax\(0, 1fr\); grid-template-rows: auto;/);
    expect(css).toMatch(/\.mis-card\.mis-especial > \.mis-esp-esq,[\s\S]*?grid-column: 1; grid-row: auto; width: 100%; min-width: 0;/);
  });
});
