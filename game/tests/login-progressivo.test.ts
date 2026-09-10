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

  it('oferece entrar e jogar no topo, pela capa', () => {
    /**
     * O topo é da CAPA, não do `Login`. Este teste cobrava
     * `h('nav.login-acoes-topo'` — uma marcação que já não existia: sobrevivia
     * num COMENTÁRIO deixado em `Login.ts` só para a asserção continuar
     * passando, e mantinha viva no `main.css` uma barra que ninguém desenhava.
     *
     * Um teste que casa com comentário não testa nada. O que importa é o
     * caminho: a capa recebe as três ações e as liga ao formulário certo.
     */
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("entrar: () => abrir('entrar')");
    expect(login).toContain("criarConta: () => abrir('criar')");
    expect(login).toContain("jogar: () => abrir('criar')");

    const landing = fonte('ui', 'Landing.ts');
    expect(landing).toContain("botao('ENTRAR', acoes.entrar");
    expect(landing).toContain("botao('JOGAR', acoes.jogar");
  });

  it('permite fechar o formulário e voltar para a capa', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("h('button.login-fechar'");
    expect(login).toContain('this.modo = null;');
  });

  it('permite voltar a entrar em uma conta criada pelo Google', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("`${modo === 'criar' ? 'Criar conta' : 'Entrar'} com ${NOME_DO_PROVEDOR[p]}`");
    expect(login).not.toContain("...(modo === 'criar' ? [");
    expect(login).toContain("modo === 'criar' ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar conta'");
    expect(login).toContain("const r = modo === 'criar' ? await cadastrar(e, s) : await entrar(e, s);");
  });

  it('mantém as ações visíveis no topo também em telas pequenas', () => {
    // No estreito a capa esconde o MENU de seções — rolar até uma seção é
    // conveniência. Entrar e jogar são o motivo da tela, e ficam.
    const css = fonte('styles', 'landing.css');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.landing-menu { display: none; }');
    expect(css).not.toMatch(/\.landing-conta\s*\{[^}]*display:\s*none/);
  });
});
