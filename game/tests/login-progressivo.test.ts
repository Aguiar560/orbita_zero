import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fonte = (...partes: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...partes), 'utf8');

describe('entrada progressiva na conta', () => {
  it('abre a página principal sem formulário escolhido', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("private modo: 'entrar' | 'criar' | null = null;");
    expect(login).toContain('if (!this.modo) return;');
  });

  it('oferece criar conta e entrar no topo', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("h('nav.login-acoes-topo'");
    expect(login).toContain("text: 'CRIAR CONTA'");
    expect(login).toContain("onclick: () => abrir('criar')");
    expect(login).toContain("text: 'ENTRAR'");
    expect(login).toContain("onclick: () => abrir('entrar')");
  });

  it('permite fechar o formulário e voltar para a capa', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("h('button.login-fechar'");
    expect(login).toContain('this.modo = null;');
  });

  it('mantém as ações visíveis no topo também em telas pequenas', () => {
    const css = fonte('styles', 'main.css');
    expect(css).toMatch(/\.login-acoes-topo\s*\{/);
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).toMatch(/\.login-topo-acao\s*\{/);
  });
});
