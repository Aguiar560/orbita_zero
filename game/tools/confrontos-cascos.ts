import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Sim } from '@sim/index';
import { VerticalMode } from '@modes/vertical/VerticalMode';
import { HULLS } from '@data/hulls';
import { HULL_ARCHETYPES, SPACESHIPS2_HULL_SPECS } from '@data/hulls-spaceships2';
import { LAB_SCENARIOS, type LaboratorioMetrics } from '@sim/laboratorio';

const noop = () => undefined;
Object.assign(globalThis, {
  window: { addEventListener: noop, removeEventListener: noop },
  performance: globalThis.performance ?? { now: () => 0 },
});

const surface = { resize: noop } as never;
const sim = new Sim();
const mode = new VerticalMode(surface, sim);
const representatives = HULL_ARCHETYPES.map((archetype) => {
  const spec = SPACESHIPS2_HULL_SPECS.find((entry) => entry.archetype === archetype.id)!;
  const hull = HULLS.find((entry) => entry.id === spec.id)!;
  return { archetype: archetype.name, archetypeId: archetype.id, weapon: spec.weapon, id: hull.id, name: hull.name };
});
const allHulls = SPACESHIPS2_HULL_SPECS.map((spec) => {
  const hull = HULLS.find((entry) => entry.id === spec.id)!;
  const archetype = HULL_ARCHETYPES.find((entry) => entry.id === spec.archetype)!;
  return { archetype: archetype.name, archetypeId: archetype.id, weapon: spec.weapon, id: hull.id, name: hull.name };
});
const selectedHulls = process.argv.includes('--all') ? allHulls : representatives;

interface Result extends LaboratorioMetrics {
  scenario: string;
  seed: number;
  archetype: string;
  hullId: string;
  hull: string;
  archetypeId: string;
  weapon: string;
  dps: number;
  precision: number;
}

const results: Result[] = [];
for (const scenario of LAB_SCENARIOS) {
  for (const hull of selectedHulls) {
    for (const seed of scenario.seeds) {
      const metrics = mode.executarConfrontoLaboratorio(hull.id, scenario.id, seed);
      results.push({
        ...metrics, scenario: scenario.id, seed, archetype: hull.archetype, archetypeId: hull.archetypeId,
        weapon: hull.weapon, hullId: hull.id, hull: hull.name,
        dps: metrics.playerDamage / Math.max(.01, metrics.elapsed),
        precision: metrics.playerHits / Math.max(1, metrics.playerShots),
      });
    }
  }
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const lines = [
  '# Bateria de confrontos dos cascos', '',
  `Gerada com ${results.length} execuções no combate real: três cenários × ${selectedHulls.length} cascos × três sementes.`, '',
];
for (const scenario of LAB_SCENARIOS) {
  lines.push(`## ${scenario.name}`, '', scenario.description, '',
    '| Arquétipo | Casco | DPS mediano | Impactos/projétil | Abates | Dano recebido | Mortes |',
    '|---|---|---:|---:|---:|---:|---:|');
  for (const hull of selectedHulls) {
    const sample = results.filter((entry) => entry.scenario === scenario.id && entry.hullId === hull.id);
    lines.push(`| ${hull.archetype} | ${hull.name} | ${round(median(sample.map((x) => x.dps)))} | ${round(median(sample.map((x) => x.precision)) * 100)}% | ${round(median(sample.map((x) => x.kills)), 0)} | ${round(median(sample.map((x) => x.enemyDamage)), 0)} | ${round(median(sample.map((x) => x.deaths)), 0)} |`);
  }
  lines.push('');
}

if (process.argv.includes('--all')) {
  for (const dimension of ['archetypeId', 'weapon'] as const) {
    lines.push(`## Medianas por ${dimension === 'weapon' ? 'família de tiro' : 'arquétipo'}`, '',
      '| Grupo | Elite DPS | Enxame DPS | Cerco DPS | Elite mortes | Enxame mortes | Cerco mortes |',
      '|---|---:|---:|---:|---:|---:|---:|');
    const groups = [...new Set(results.map((entry) => entry[dimension]))];
    for (const group of groups) {
      const byScenario = Object.fromEntries(LAB_SCENARIOS.map((scenario) => {
        const sample = results.filter((entry) => entry[dimension] === group && entry.scenario === scenario.id);
        return [scenario.id, {
          dps: round(median(sample.map((x) => x.dps))),
          deaths: round(median(sample.map((x) => x.deaths))),
        }];
      })) as Record<string, { dps: number; deaths: number }>;
      lines.push(`| ${group} | ${byScenario.elite.dps} | ${byScenario.enxame.dps} | ${byScenario.cerco.dps} | ${byScenario.elite.deaths} | ${byScenario.enxame.deaths} | ${byScenario.cerco.deaths} |`);
    }
    lines.push('');
  }
}

console.log(lines.join('\n'));
if (process.argv.includes('--write')) {
  const suffix = process.argv.includes('--all') ? '-COMPLETA' : '';
  const target = resolve(`docs/RELATORIO-BATERIA-CONFRONTOS${suffix}.md`);
  writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');
  writeFileSync(resolve(`docs/RELATORIO-BATERIA-CONFRONTOS${suffix}.json`), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`\nRelatórios gravados em ${target}`);
}
