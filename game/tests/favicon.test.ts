import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(process.cwd());
const html = readFileSync(resolve(raiz, 'index.html'), 'utf8');
const favicon = readFileSync(resolve(raiz, 'public/favicon.svg'), 'utf8');
const wiki = readFileSync(resolve(raiz, 'src/wiki/WikiApp.ts'), 'utf8');

describe('identidade do navegador', () => {
  it('publica o favicon vetorial em todas as rotas do jogo e da Wiki', () => {
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(favicon).toContain('<title id="title">Órbita Zero</title>');
    expect(favicon).toContain('viewBox="0 0 64 64"');
  });

  it('documenta a insígnia na Wiki', () => {
    expect(wiki).toContain("titulo: 'Identidade no navegador'");
    expect(wiki).toContain('O mesmo favicon é usado na página principal e em todas as rotas da Wiki');
  });
});
