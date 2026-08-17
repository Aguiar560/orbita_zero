import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * Quanto tempo custa cada galáxia, com um jogador que DECIDE.
 *
 * A decisão de avançar e a de farmar moram AQUI, no arnês, e não em `sim/`.
 * Chegaram a morar lá por engano: `abstractTick` roda com a janela fechada e
 * com a aba em segundo plano, então uma decisão dentro dele movia a fase do
 * jogador sem ele pedir — o oposto do que o modo ocioso é.
 *
 * O jogador modelado aqui faz o que um humano faz:
 *
 * - avança quando fecha o setor;
 * - volta três setores quando bate numa parede — encontro que leva mais que o
 *   dobro do que a nave aguenta, ou três derrotas no mesmo lugar;
 * - e, tendo voltado, sobe de novo.
 */
const PASSO = 1 / 4;
const LIMITE_HORAS = 60;

const sim = new Sim(createState(777));
const marcos: string[] = [];

let t = 0;
let proxima = 1;
let ondaAnterior = sim.state.run.wave;
let mortesNoSetor = 0;
let mortesAnteriores = 0;

while (t < LIMITE_HORAS * 3600 && proxima <= 6) {
  sim.abstractTick(PASSO);
  t += PASSO;
  const run = sim.state.run;

  // Morreu? conta a falha neste setor.
  if (sim.state.stats.deaths > mortesAnteriores) {
    mortesNoSetor += sim.state.stats.deaths - mortesAnteriores;
    mortesAnteriores = sim.state.stats.deaths;
  }

  // Fechou o setor: o jogador avança. O jogo não avança sozinho — de propósito.
  if (run.wave === 1 && ondaAnterior > 1 && sim.state.stats.deaths === mortesAnteriores
    && mortesNoSetor === 0) {
    run.sector++;
    sim.refreshEncounter();
  }
  ondaAnterior = run.wave;

  // Bateu na parede: volta a farmar.
  const parede = sim.clearTime > sim.survivalWindow * 2 || mortesNoSetor >= 3;
  if (parede && run.sector > 1) {
    run.sector = Math.max(1, run.sector - 3);
    run.wave = 1;
    run.vidaFracao = 1;
    mortesNoSetor = 0;
    sim.refreshEncounter();
  }

  const g = Math.floor((run.sector - 1) / 10);
  if (g >= proxima) {
    marcos.push(
      `galáxia ${String(proxima).padStart(2)}  ${(t / 3600).toFixed(1).padStart(6)} h`
      + `  ${String(sim.state.stats.deaths).padStart(5)} mortes`
      + `  nível ${String(sim.state.command.nivel).padStart(3)}`,
    );
    proxima = g + 1;
    mortesNoSetor = 0;
  }
}

console.log(marcos.join('\n') || `nenhuma galáxia fechada em ${LIMITE_HORAS} h`);
let anterior = 0;
console.log('\npor galáxia:');
for (const m of marcos) {
  const h = Number(/([\d.]+) h/.exec(m)![1]);
  console.log(`  ${m.slice(0, 10)} +${(h - anterior).toFixed(1)} h`);
  anterior = h;
}
console.log(`\nsetor final ${sim.state.run.sector} · meta do §2: ~10 h por galáxia`);
