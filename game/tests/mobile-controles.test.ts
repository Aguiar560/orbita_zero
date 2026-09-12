import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { vetorDoManche } from '@modes/vertical/VerticalMode';

const vertical = readFileSync(new URL('../src/modes/vertical/VerticalMode.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/ui/Shell.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

describe('controle manual por toque', () => {
  it('fica neutro antes de o dedo se deslocar', () => {
    expect(vetorDoManche(100, 200, 100, 200)).toEqual({ dx: 0, dy: 0 });
  });

  it('preserva direção e intensidade dentro do curso do manche', () => {
    const vetor = vetorDoManche(100, 100, 126, 100);
    expect(vetor.dx).toBeCloseTo(0.5);
    expect(vetor.dy).toBeCloseTo(0);
  });

  it('limita o vetor ao alcance máximo', () => {
    const vetor = vetorDoManche(0, 0, 200, 200);
    expect(Math.hypot(vetor.dx, vetor.dy)).toBeCloseTo(1);
    expect(vetor.dx).toBeGreaterThan(0);
    expect(vetor.dy).toBeGreaterThan(0);
  });

  it('liga os eventos nativos de toque usados pelo Safari móvel', () => {
    expect(vertical).toContain("addEventListener('touchstart', this.onTouchStart, { passive: false })");
    expect(vertical).toContain("addEventListener('touchmove', this.onTouchMove, { passive: false })");
  });
});

describe('superfícies mobile', () => {
  it('abre a Anatomia ao selecionar a única aba disponível no telefone', () => {
    expect(shell).toContain("if (view === 'anatomia' && !this.anatomia.aberta) this.anatomia.alternar()");
    expect(css).toMatch(/\.layout > \.anatomia \{[\s\S]*?grid-area: auto !important/);
  });

  it('usa fluxo normal e rolagem vertical na caixa comum das telas', () => {
    expect(css).toMatch(/\.camada-caixa \{[\s\S]*?display: block !important;[\s\S]*?overflow-y: auto !important/);
  });

  it('mantém o relatório de ausência rolável e o botão final acessível', () => {
    expect(css).toMatch(/\.modal\.offline-modal \{[\s\S]*?max-height: calc\(100dvh[\s\S]*?overflow-y: auto !important/);
    expect(css).toContain('-webkit-overflow-scrolling: touch;');
  });
});
