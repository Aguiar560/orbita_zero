import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('../src/ui/LeftRail.ts', import.meta.url), 'utf8');

describe('atalho de repetir setor no cockpit', () => {
  it('fica no módulo do piloto, logo após o combustível', () => {
    const combustivel = fonte.indexOf('rail-fuel');
    const atalho = fonte.indexOf('rail-repeat-sector');
    expect(combustivel).toBeGreaterThanOrEqual(0);
    expect(atalho).toBeGreaterThan(combustivel);
    expect(fonte).toContain('sim.state.settings.repetirSetor = !sim.state.settings.repetirSetor');
    expect(fonte).toContain("text: 'Repetir setor'");
  });
});
