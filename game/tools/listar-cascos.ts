import { HULLS } from '../src/data/hulls';
import {
  HULL_ARCHETYPES,
  HULL_TUNINGS,
  HULL_WEAPONS,
  SPACESHIPS2_HULL_SPEC_BY_ID,
} from '../src/data/hulls-spaceships2';

const archetypes = new Map(HULL_ARCHETYPES.map((entry) => [entry.id, entry.name]));
const tunings = new Map(HULL_TUNINGS.map((entry) => [entry.id, entry.name]));
const weapons = new Map(HULL_WEAPONS.map((entry) => [entry.id, entry.name]));

console.log([
  'id', 'nome', 'origem', 'estado', 'tier', 'elemento', 'arquetipo', 'calibracao', 'arma',
  'dano', 'cadencia', 'vida', 'escudo', 'regen', 'velocidade', 'projeteis',
  'perfuracao', 'explosao', 'critChance', 'critDano', 'iaSkill', 'sorte',
  'sprite', 'tiro', 'velTiro', 'custo', 'setor',
].join('\t'));

for (const hull of HULLS) {
  const spec = SPACESHIPS2_HULL_SPEC_BY_ID.get(hull.id);
  const stats = hull.stats;
  console.log([
    hull.id, hull.name, spec ? 'spaceships2' : 'original', hull.prototype ? 'calibracao' : 'campanha', hull.tier, hull.element,
    spec ? archetypes.get(spec.archetype) : '', spec ? tunings.get(spec.tuning) : '',
    spec ? weapons.get(spec.weapon) : '',
    stats.dano ?? 0, stats.cadencia ?? 0, stats.vida ?? 0, stats.escudo ?? 0,
    stats.regen ?? 0, stats.velocidade ?? 0, stats.projeteis ?? 0,
    stats.perfuracao ?? 0, stats.explosao ?? 0, stats.critChance ?? 0,
    stats.critDano ?? 0, stats.iaSkill ?? 0, stats.sorte ?? 0,
    hull.sprite, hull.shot.sprite, hull.shot.speed, hull.cost, hull.requiresSector,
  ].join('\t'));
}
