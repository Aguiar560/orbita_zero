import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ler = (arquivo: string): string => readFileSync(resolve(process.cwd(), arquivo), 'utf8');

describe('tooltips dentro do jogo', () => {
  it('converte title do construtor DOM sem criar tooltip nativa', () => {
    const source = ler('src/ui/dom.ts');
    expect(source).toContain("case 'title':");
    expect(source).toContain('el.dataset.gameTip = String(value)');
  });

  it('cobre mouse, teclado e elementos inseridos depois', () => {
    const source = ler('src/ui/TooltipDoJogo.ts');
    expect(source).toContain("'[data-game-tip]'");
    expect(source).toContain("removeAttribute('title')");
    expect(source).toContain("'mouseover'");
    expect(source).toContain("'focusin'");
    expect(source).toContain('new MutationObserver');
    expect(source).toContain("setAttribute('role', 'tooltip')");
  });

  it('é instalado pelo shell e estilizado como parte do cockpit', () => {
    const shell = ler('src/ui/Shell.ts');
    const css = ler('src/styles/main.css');
    expect(shell).toContain('instalarTooltipsDoJogo();');
    expect(css).toMatch(/\.game-tooltip\s*\{/);
    expect(css).toContain('position: fixed');
    expect(css).toContain('white-space: pre-line');
  });

  it('não deixa atribuição direta de title na interface principal', () => {
    const anatomia = ler('src/ui/Anatomia.ts');
    expect(anatomia).not.toMatch(/\.title\s*=/);
    expect(anatomia).toContain('dataset.gameTip');
  });

  it('não exibe explicações ao passar o mouse nas abas do menu superior', () => {
    const shell = ler('src/ui/Shell.ts');
    const inicio = shell.indexOf('private buildTabs(): void');
    const fim = shell.indexOf('\n  /**', inicio);
    const buildTabs = shell.slice(inicio, fim);

    expect(buildTabs).not.toContain('title:');
    expect(buildTabs).not.toContain('data-game-tip');
    expect(buildTabs).toContain("'aria-label': panel.title");
  });
});
