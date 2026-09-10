import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOSSES } from '@data/bosses';
import { PILOTOS } from '@data/pilotos';
import { transmissaoAoEntrarNoSetor, transmissaoAposVitoria } from '@data/narrativa-campanha';

describe('direção narrativa da campanha', () => {
  it('intercepta no setor 6, depois de conquistar metade da galáxia', () => {
    expect(transmissaoAoEntrarNoSetor(5, PILOTOS[0]!.id)).toBeNull();
    expect(transmissaoAoEntrarNoSetor(6, PILOTOS[0]!.id)?.falas).toHaveLength(2);
    expect(transmissaoAoEntrarNoSetor(16, PILOTOS[0]!.id)?.id).toBe('g2:interceptacao');
    expect(transmissaoAoEntrarNoSetor(15, PILOTOS[0]!.id)).toBeNull();
  });

  it('todos os trinta guardiões ameaçam, revelam a verdade e viram aliados', () => {
    BOSSES.forEach((boss, galaxia) => {
      const marco = transmissaoAoEntrarNoSetor(galaxia * 10 + 6, PILOTOS[0]!.id);
      const vitoria = transmissaoAposVitoria(boss.id, (galaxia + 1) * 10, PILOTOS[0]!.id);
      expect(marco?.falas[0]?.autor, boss.name).toBe(boss.name.toUpperCase());
      expect(vitoria?.falas, boss.name).toHaveLength(3);
      expect(vitoria?.titulo, boss.name).toContain('NOVO PACTO');
      expect(vitoria?.falas[0]?.cargo, boss.name).toContain('ANTIGO GUARDIÃO');
    });
  });

  it('cada piloto responde com sua própria voz', () => {
    const respostas = PILOTOS.map((piloto) => transmissaoAoEntrarNoSetor(6, piloto.id)?.falas[1]?.texto);
    expect(new Set(respostas).size).toBe(PILOTOS.length);
  });

  it('a UI só abre cenas inéditas e pausa o combate enquanto são lidas', () => {
    const shell = readFileSync(join(process.cwd(), 'src/ui/Shell.ts'), 'utf8');
    const game = readFileSync(join(process.cwd(), 'src/app/Game.ts'), 'utf8');
    const sim = readFileSync(join(process.cwd(), 'src/sim/index.ts'), 'utf8');
    expect(shell).toContain('sector === this.sim.state.universe.bestSectorEver');
    expect(shell).toContain('if (first) this.transmissoes.enfileirar');
    expect(sim).toContain('sector: e.sector, first');
    expect(game).toContain("bus.on('narrativa:estado'");
    expect(game).toContain('aberta ? this.loop.stop() : this.loop.start()');
  });
});
