import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const painel = readFileSync(new URL('../src/ui/panels/GalaxyPanel.ts', import.meta.url), 'utf8');

describe('setores no mapa da galáxia', () => {
  it('mostra o cadeado sci-fi e explica o bloqueio', () => {
    expect(painel).toContain("h('img.galaxy-command-lock'");
    expect(painel).toContain('/assets/ui/provacao/icons/prv_icone_cadeado.png');
    expect(painel).toContain('Setor ${phase.sector} bloqueado. ${bloqueio}');
  });
});
