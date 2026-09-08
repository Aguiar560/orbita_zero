import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const anatomia = readFileSync(new URL('../src/ui/Anatomia.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

describe('poder da nave na Anatomia', () => {
  it('mostra o poder total logo abaixo do elemento', () => {
    const elemento = anatomia.indexOf("h('.anat-elemento'");
    const poder = anatomia.indexOf("h('.anat-poder'");

    expect(elemento).toBeGreaterThan(-1);
    expect(poder).toBeGreaterThan(elemento);
    expect(anatomia).toContain("text: 'PODER DA NAVE'");
    expect(anatomia).toContain('fmt(poder)');
  });

  it('calcula o casco exibido, inclusive quando ele nao esta em campo', () => {
    expect(anatomia).toContain('powerScore(resolveStats(');
    expect(anatomia).toContain("emCampo ? sim.state : { ...sim.state, hull: this.vendo }");
  });

  it('mantem a nova linha responsiva no celular', () => {
    expect(css).toContain('.layout > .anatomia .anat-poder,');
  });
});
