import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const fonte = (...partes: string[]): string => readFileSync(join(process.cwd(), 'src', ...partes), 'utf8');

describe('landing navegável antes do login', () => {
  it('oferece as quatro páginas no mesmo menu', () => {
    const landing = fonte('ui', 'Landing.ts');
    expect(landing).toContain("['jogo', 'O JOGO']");
    expect(landing).toContain("['naves', 'NAVES']");
    expect(landing).toContain("['galaxias', 'GALÁXIAS']");
    expect(landing).toContain("['comunidade', 'COMUNIDADE']");
    expect(landing).toContain("'aria-current': pagina === id ? 'page' : undefined");
  });

  it('troca o conteúdo sem recarregar a página', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain('private pagina: PaginaLanding');
    expect(login).toContain('this.pagina = pagina;');
    expect(login).toContain('montarLanding(this.pagina');
    expect(login).not.toMatch(/navegar[\s\S]{0,250}location\.reload/);
  });

  it('liga entrar, criar conta e jogar agora ao formulário correto', () => {
    const login = fonte('ui', 'Login.ts');
    expect(login).toContain("entrar: () => abrir('entrar')");
    expect(login).toContain("criarConta: () => abrir('criar')");
    expect(login).toContain("jogar: () => abrir('criar')");
  });

  it('possui conteúdo próprio para naves, galáxias e comunidade', () => {
    const landing = fonte('ui', 'Landing.ts');
    expect(landing).toContain('function paginaNaves');
    expect(landing).toContain('function paginaGalaxias');
    expect(landing).toContain('function paginaComunidade');
    expect(landing).toContain('ANATOMIA DA NAVE');
    expect(landing).toContain('DETALHES DO SETOR');
    expect(landing).toContain('RANKING MUNDIAL');
    expect(landing).toContain('COMUNICAÇÕES');
  });

  it('usa as quatro artes aprovadas no desktop com controles clicáveis', () => {
    const landing = fonte('ui', 'Landing.ts');
    for (const nome of ['o-jogo', 'naves', 'galaxias', 'comunidade']) {
      expect(landing).toContain(`/assets/landing/${nome}.png`);
      expect(existsSync(join(process.cwd(), 'public', 'assets', 'landing', `${nome}.png`))).toBe(true);
    }
    expect(landing).toContain('landing-art-hotspot');
    expect(landing).toContain("pontoClicavel('conta-entrar'");
    expect(landing).toContain("pontoClicavel('conta-criar'");
    const css = fonte('styles', 'landing.css');
    expect(css).toContain('transform: translateY(-12%)');
    expect(css).toContain('aspect-ratio: 1672 / 941');
    expect(css).toContain('.landing-art-hotspot.conta-entrar { top: 2.1%');
    expect(css).toContain('.landing-art-hotspot.acao-galaxias { top: 76.9%');
    expect(css).toContain('.landing-art-hotspot.acao-comunidade { top: 90.1%');
  });

  it('é responsiva e deixa a landing rolar no celular', () => {
    const css = fonte('styles', 'landing.css');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('.landing-nav');
    expect(css).toContain('.landing-community-grid');
  });
});
