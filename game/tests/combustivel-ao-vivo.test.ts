/**
 * O combustível gasta com o jogo ABERTO.
 *
 * ## O defeito, relatado em 04/09
 *
 * O trilho mostrava "Combustível restante 19h 41m" para sempre. A causa não era
 * de interface: **o tanque não descia**.
 *
 * `gastarCombustivel` só era chamado de `abstractTick`, e `abstractTick` só roda
 * em `applyOffline` — ou seja, o combustível descia apenas com a aba FECHADA.
 * Jogando, ele ficava eternamente cheio, e a barra era decoração.
 *
 * O mais traiçoeiro é que o comentário dentro de `abstractTick` já afirmava a
 * regra certa — *"combustível corre no MESMO ponto do tempo ao vivo e do
 * offline. Se fossem dois caminhos, aba aberta e fechada renderiam tanques
 * diferentes"* — e ela estava correta como INTENÇÃO. Faltava o segundo caminho
 * chamar. Um comentário verdadeiro descrevendo código que não existe é pior que
 * um comentário ausente: ele faz quem lê parar de procurar.
 *
 * ## Por que o teste é assim
 *
 * O laço ao vivo mora no `Game`, que é DOM puro e não instancia em Node. Então
 * a asserção é sobre a FONTE. O segundo bloco mede o comportamento de verdade,
 * no `Sim`, que é onde a conta acontece.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { autonomiaDoCasco } from '@sim/combustivel';

const fonte = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

describe('o laço ao vivo gasta combustível', () => {
  it('o `Game` chama `gastarCombustivel` no tick', () => {
    // A linha que faltava. Sem ela o tanque só desce offline.
    expect(fonte('app/Game.ts')).toContain('this.sim.gastarCombustivel(dt * speed)');
  });

  it('e o laboratório fica de fora', () => {
    // Ali o jogo roda para MEDIR: secar o tanque no meio de uma bateria de
    // confrontos falsearia o resultado.
    expect(fonte('app/Game.ts')).toContain('if (!this.sim.laboratorio.active) this.sim.gastarCombustivel');
  });
});

describe('a conta do tanque', () => {
  it('um minuto de jogo consome um minuto de autonomia', () => {
    const sim = new Sim(createState(77));
    const hull = sim.state.hull;
    (sim.state.naves[hull] ??= { nivel: 1, xp: 0, equipped: {} }).combustivel = 1;

    sim.gastarCombustivel(60);

    const esperado = 1 - 60 / autonomiaDoCasco(hull);
    expect(sim.combustivelDe()).toBeCloseTo(esperado, 6);
  });

  it('o modo de teste NÃO gasta', () => {
    // O modo de teste existe para inspecionar conteúdo sem farmar concessão;
    // secar o tanque no meio disso seria uma armadilha sem propósito.
    const sim = new Sim(createState(78));
    sim.setTestMode(true);
    (sim.state.naves[sim.state.hull] ??= { nivel: 1, xp: 0, equipped: {} }).combustivel = 1;
    sim.gastarCombustivel(3600);
    expect(sim.combustivelDe()).toBe(1);
  });

  it('e a nave FORA de campo reabastece no mesmo passo', () => {
    // A frota em terra enche sozinha — é o que impede o jogador de ficar sem
    // saída quando o tanque da nave ativa acaba.
    const sim = new Sim(createState(79));
    const parada = sim.state.fleet.find((id) => id !== sim.state.hull);
    if (!parada) return;
    (sim.state.naves[parada] ??= { nivel: 1, xp: 0, equipped: {} }).combustivel = 0.2;
    sim.gastarCombustivel(600);
    expect(sim.combustivelDe(parada)).toBeGreaterThan(0.2);
  });
});
