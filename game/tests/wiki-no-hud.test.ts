import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('atalho da wiki no HUD', () => {
  const shell = readFileSync(join(process.cwd(), 'src/ui/Shell.ts'), 'utf8');

  it('fica entre os recursos e a engrenagem', () => {
    const recursos = shell.indexOf("h('.resources'");
    const wiki = shell.indexOf("h('a.wiki-shortcut'");
    const engrenagem = shell.indexOf("h('button.gear'");
    expect(recursos).toBeGreaterThan(-1);
    expect(wiki).toBeGreaterThan(recursos);
    expect(engrenagem).toBeGreaterThan(wiki);
  });

  it('abre a wiki sem substituir a partida e usa um ícone versionado', () => {
    expect(shell).toContain("href: '/wiki/'");
    expect(shell).toContain("target: '_blank'");
    expect(shell).toContain("rel: 'noopener'");
    expect(shell).toContain("'aria-label': 'Abrir a Wiki de Órbita Zero'");
    expect(existsSync(join(process.cwd(), 'public/assets/ui/menu/codex.webp'))).toBe(true);
  });
});
