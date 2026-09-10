import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { PILOTOS } from '@data/pilotos';
import {
  ATOS_DA_HISTORIA, FACCOES, HISTORIAS_DOS_PILOTOS, HISTORIA_POR_PILOTO,
  LORE_DAS_GALAXIAS, loreDoChefe,
} from '@data/lore';

describe('cânone de Órbita Zero', () => {
  it('documenta os três atos e todas as trinta galáxias', () => {
    expect(ATOS_DA_HISTORIA).toHaveLength(3);
    expect(LORE_DAS_GALAXIAS).toHaveLength(30);
    expect(new Set(LORE_DAS_GALAXIAS.map((lore) => lore.galaxia)).size).toBe(30);
  });

  it('todo chefe tem motivo, verdade e destino como aliado', () => {
    expect(BOSSES).toHaveLength(30);
    for (const boss of BOSSES) {
      const lore = loreDoChefe(boss.id);
      expect(lore, boss.name).toBeDefined();
      expect(lore!.conflito.length, boss.name).toBeGreaterThan(20);
      expect(lore!.verdade.length, boss.name).toBeGreaterThan(20);
      expect(lore!.depoisDaVitoria.length, boss.name).toBeGreaterThan(20);
    }
  });

  it('os quatro pilotos têm passado, segredo, arco e próximos passos', () => {
    expect(HISTORIAS_DOS_PILOTOS).toHaveLength(PILOTOS.length);
    for (const piloto of PILOTOS) {
      const historia = HISTORIA_POR_PILOTO.get(piloto.id);
      expect(historia, piloto.nome).toBeDefined();
      expect(historia!.capitulos).toHaveLength(3);
      expect(historia!.proximosPassos).toHaveLength(3);
      expect(historia!.conexoes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('toda região pertence a uma facção existente', () => {
    const ids = new Set(FACCOES.map((faccao) => faccao.id));
    for (const lore of LORE_DAS_GALAXIAS) expect(ids.has(lore.faccaoId), `galáxia ${lore.galaxia + 1}`).toBe(true);
  });
});
