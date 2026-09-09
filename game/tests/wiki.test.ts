import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOSSES } from '@data/bosses';
import { HULLS } from '@data/hulls';
import { MISSOES } from '@data/missoes';
import { RECURSOS } from '@data/recursos';

const fonte = (arquivo: string): string => readFileSync(join(process.cwd(), arquivo), 'utf8');
const wiki = fonte('src/wiki/WikiApp.ts');

describe('wiki oficial', () => {
  it('tem uma entrada isolada do motor do jogo', () => {
    const main = fonte('src/main.ts');
    expect(main).toContain("location.pathname.startsWith('/wiki/')");
    expect(main).toContain("await import('./wiki/WikiApp')");
    expect(main).toContain("import('@app/Game')");

    const vercel = JSON.parse(fonte('vercel.json')) as { rewrites?: { source: string }[] };
    expect(vercel.rewrites?.map((item) => item.source)).toEqual(['/wiki', '/wiki/:path*']);
  });

  it('oferece guias para todos os sistemas essenciais', () => {
    for (const rota of [
      '/guia/inicio', '/guia/combate', '/guia/progressao', '/guia/equipamentos',
      '/sistemas/equipamentos', '/sistemas/fabricacao', '/sistemas/missoes',
      '/sistemas/provacao', '/sistemas/engenharia', '/guia/conta',
    ]) expect(wiki, rota).toContain(`'${rota}'`);
  });

  it('documenta as centrais como telas, sem linguagem de landing page', () => {
    for (const tela of ['Fabricação', 'Missões', 'Equipamentos', 'Provação', 'Engenharia']) {
      expect(wiki).toContain(`'${tela}'`);
    }
    expect(wiki).toContain('wiki-system-prose');
    expect(wiki).toContain('O que esta tela faz');
    expect(wiki).toContain('/assets/ui/menu/fabricacao.webp');
    expect(wiki).toContain('/assets/ui/menu/missoes.webp');
    expect(wiki).toContain('/assets/ui/menu/provacao.webp');
    expect(wiki).toContain('/assets/ui/menu/afixos.webp');
  });

  it('gera catálogos a partir das tabelas reais', () => {
    expect(wiki).toContain('HULLS.map');
    expect(wiki).toContain('GALAXIAS.map');
    expect(wiki).toContain('RECURSOS.map');
    expect(wiki).toContain('MISSOES.map');
    expect(wiki).toContain('BOSSES.map');
    expect(HULLS.length).toBeGreaterThan(40);
    expect(RECURSOS).toHaveLength(70);
    expect(MISSOES.length).toBeGreaterThan(100);
    expect(BOSSES).toHaveLength(30);
  });

  it('usa artes versionadas do jogo e preserva spoilers', () => {
    for (const nome of ['tela.webp', 'elementos.webp', 'fabricacao.webp', 'naves.png', 'galaxias.png', 'comunidade.png']) {
      expect(existsSync(join(process.cwd(), 'public/assets/landing', nome)), nome).toBe(true);
    }
    expect(wiki).toContain('data-reveal-bosses');
    expect(wiki).toContain("sessionStorage.setItem('oz-wiki-spoilers', 'sim')");
    expect(wiki).toContain('/assets/atlas/');
  });

  it('tem busca global, filtro de catálogo e metadados por rota', () => {
    expect(wiki).toContain('data-global-search');
    expect(wiki).toContain('data-catalog-filter');
    expect(wiki).toContain('link[rel="canonical"]');
    expect(wiki).toContain('meta[property="og:title"]');
  });
});
