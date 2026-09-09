import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOSSES } from '@data/bosses';
import { HULLS } from '@data/hulls';
import { AFFIXES, ITEM_BASES, ITEM_SETS } from '@data/items';
import { MISSOES } from '@data/missoes';
import { PERSONAGENS } from '@data/personagens';
import { PROVACAO_PISOS } from '@data/provacao';
import { RECURSOS } from '@data/recursos';
import { RECEITAS } from '@data/balance/fusao';
import { OPERACOES_DE_MODULACAO } from '@data/balance/modulacao';

const fonte = (arquivo: string): string => readFileSync(join(process.cwd(), arquivo), 'utf8');
const wiki = fonte('src/wiki/WikiApp.ts');

describe('wiki oficial', () => {
  it('tem uma entrada isolada do motor do jogo', () => {
    const main = fonte('src/main.ts');
    expect(main).toContain("location.pathname.startsWith('/wiki/')");
    expect(main).toContain("await import('./wiki/WikiApp')");
    expect(main).toContain("import('@app/Game')");

    const vercel = JSON.parse(fonte('vercel.json')) as { rewrites?: { source: string }[] };
    expect(vercel.rewrites?.map((item) => item.source)).toEqual(['/wiki', '/wiki/', '/wiki/:path*']);
    const vercelDaRaiz = JSON.parse(readFileSync(join(process.cwd(), '..', 'vercel.json'), 'utf8')) as {
      outputDirectory?: string;
      rewrites?: { source: string }[];
    };
    expect(vercelDaRaiz.outputDirectory).toBe('game/dist');
    expect(vercelDaRaiz.rewrites?.some((item) => item.source === '/wiki/:path*')).toBe(true);
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

  it('expõe o conteúdo completo dos sistemas, sem amostras limitadas', () => {
    expect(MISSOES).toHaveLength(499);
    expect(PERSONAGENS.length).toBeGreaterThanOrEqual(30);
    expect(ITEM_BASES).toHaveLength(80);
    expect(AFFIXES).toHaveLength(35);
    expect(ITEM_SETS).toHaveLength(4);
    expect(RECEITAS).toHaveLength(6);
    expect(OPERACOES_DE_MODULACAO).toHaveLength(10);
    expect(PROVACAO_PISOS).toBe(100);
    expect(wiki).toContain('MISSOES.map');
    expect(wiki).toContain('ITEM_BASES.filter');
    expect(wiki).toContain('AFFIXES.map');
    expect(wiki).toContain('RECEITAS.map');
    expect(wiki).toContain('OPERACOES_DE_MODULACAO.map');
    expect(wiki).toContain('pisoDaProvacao');
    expect(wiki).not.toMatch(/MISSOES\.slice|ITEM_BASES\.slice|AFFIXES\.slice/);
  });

  it('mostra objetivos, requisitos e recompensas de cada missão', () => {
    expect(wiki).toContain('formatarRecompensa(missao.recompensa)');
    expect(wiki).toContain('missao.objetivos.map');
    expect(wiki).toContain('missao.requisitos.map');
    expect(wiki).toContain('missao.recompensaExclusiva');
    expect(wiki).toContain('PERSONAGEM_POR_ID.get');
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
