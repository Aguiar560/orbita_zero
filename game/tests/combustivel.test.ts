import { describe, expect, it } from 'vitest';
import { HULLS } from '@data/hulls';
import { AUTONOMIA_MAX, AUTONOMIA_MIN, PISO_PARA_DECOLAR } from '@data/balance/combustivel';
import {
  autonomiaDoCasco, combustivelDe, custoCheioDoCasco, custoParaEncher,
  passarTempo, poderDoCasco, podeDecolar, proximaComCombustivel, recargaDoCasco,
} from '@sim/combustivel';
import { Sim } from '@sim/index';
import { SAVE_VERSION, createState, migrate } from '@sim/state';

/**
 * O combustível existe para forçar ROTAÇÃO de frota. Se ele não for inverso ao
 * poder, a nave forte fica estritamente melhor e a rotação nunca acontece — que
 * é exatamente o estado que o sistema veio corrigir.
 *
 * É esse invariante que estes testes protegem, mais do que qualquer número.
 */

const FRACO = 'aurora1';
const FORTE = 'bastiao_8';

describe('a curva', () => {
  it('autonomia é INVERSA ao poder — a razão de existir do sistema', () => {
    const cascos = HULLS.filter((h) => !h.prototype);
    for (const a of cascos) {
      for (const b of cascos) {
        if (poderDoCasco(a.id) <= poderDoCasco(b.id)) continue;
        // mais poderoso ⇒ nunca mais autonomia
        expect(autonomiaDoCasco(a.id)).toBeLessThanOrEqual(autonomiaDoCasco(b.id));
      }
    }
  });

  it('vai de 20h no mais fraco a 6h no mais forte', () => {
    expect(autonomiaDoCasco(FRACO)).toBeCloseTo(AUTONOMIA_MAX, 0);
    expect(autonomiaDoCasco(FORTE)).toBeCloseTo(AUTONOMIA_MIN, 0);
  });

  it('as 6h do casco mais forte são o teto de ausência diária', () => {
    // Não é coincidência: a melhor nave carrega exatamente uma janela de
    // offline. Mais que isso criaria uma nave que dispensa rotação.
    expect(AUTONOMIA_MIN).toBe(6 * 3600);
  });

  it('recarga é a inversa da autonomia — senão bastariam duas naves fortes', () => {
    expect(recargaDoCasco(FORTE)).toBeGreaterThan(recargaDoCasco(FRACO));
  });

  it('encher custa mais nas fortes', () => {
    expect(custoCheioDoCasco(FORTE)).toBeGreaterThan(custoCheioDoCasco(FRACO) * 10);
  });
});

describe('gastar e encher', () => {
  const comFrota = (fleet: string[], hull = fleet[0]!) => {
    const st = createState(11);
    st.fleet = [...fleet];
    st.hull = hull;
    return st;
  };

  it('tanque ausente conta como CHEIO', () => {
    // É o que faz save antigo migrar sem aterrissar a frota de quem já jogava.
    const st = comFrota([FRACO]);
    expect(st.naves[FRACO]?.combustivel).toBeUndefined();
    expect(combustivelDe(st, FRACO)).toBe(1);
  });

  it('só a nave EM CAMPO gasta; as do hangar enchem', () => {
    const st = comFrota([FRACO, FORTE], FRACO);
    st.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.2 };
    passarTempo(st, 3600);
    expect(combustivelDe(st, FRACO)).toBeLessThan(1);
    expect(combustivelDe(st, FORTE)).toBeGreaterThan(0.2);
  });

  it('uma nave cheia no hangar não transborda', () => {
    const st = comFrota([FRACO, FORTE], FRACO);
    passarTempo(st, 99 * 3600);
    expect(combustivelDe(st, FORTE)).toBe(1);
  });

  it('o tanque nunca fica negativo', () => {
    const st = comFrota([FORTE]);
    passarTempo(st, 999 * 3600);
    expect(combustivelDe(st, FORTE)).toBe(0);
  });

  it('a nave forte seca antes da fraca no mesmo tempo', () => {
    const a = comFrota([FRACO]);
    const b = comFrota([FORTE]);
    passarTempo(a, 5 * 3600);
    passarTempo(b, 5 * 3600);
    expect(combustivelDe(b, FORTE)).toBeLessThan(combustivelDe(a, FRACO));
  });

  it('há um piso para decolar — não é zero', () => {
    // Uma nave que decola com 0,5% cai em vinte segundos e devolve o jogador à
    // mesma tela. O piso faz "sem combustível" ser um estado que se resolve.
    const st = comFrota([FRACO]);
    st.naves[FRACO] = { nivel: 1, xp: 0, equipped: {}, combustivel: PISO_PARA_DECOLAR / 2 };
    expect(podeDecolar(st, FRACO)).toBe(false);
    st.naves[FRACO]!.combustivel = PISO_PARA_DECOLAR;
    expect(podeDecolar(st, FRACO)).toBe(true);
  });

  it('encher pela metade custa metade', () => {
    const st = comFrota([FORTE]);
    st.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.5 };
    const meio = custoParaEncher(st, FORTE);
    expect(meio).toBeCloseTo(custoCheioDoCasco(FORTE) / 2, -1);
    // e um tanque cheio não cobra nada
    st.naves[FORTE]!.combustivel = 1;
    expect(custoParaEncher(st, FORTE)).toBe(0);
  });
});

describe('quando seca', () => {
  it('troca sozinho para a melhor nave que ainda tem tanque', () => {
    // Deixar o jogador numa nave que não decola transformaria o sistema numa
    // punição por estar ausente. A rotação é o objetivo; o castigo não.
    const sim = new Sim(createState(11));
    sim.state.fleet = [FORTE, FRACO];
    sim.state.hull = FORTE;
    sim.state.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.06 };
    sim.gastarCombustivel(3600);
    expect(sim.state.hull).toBe(FRACO);
  });

  it('com a frota inteira em terra, a incursão PARA', () => {
    const sim = new Sim(createState(11));
    sim.state.fleet = [FORTE];
    sim.state.hull = FORTE;
    sim.state.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.01 };
    // devolver `true` é o sinal de parar; sem isto a frota em terra continuaria
    // rendendo e a barra seria decorativa
    expect(sim.gastarCombustivel(60)).toBe(true);
    expect(sim.frotaEmTerra).toBe(true);
  });

  it('mas o relógio continua correndo, senão não haveria saída', () => {
    const sim = new Sim(createState(11));
    sim.state.fleet = [FORTE, FRACO];
    sim.state.hull = FORTE;
    sim.state.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0 };
    sim.state.naves[FRACO] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0 };
    sim.gastarCombustivel(2 * 3600);
    expect(combustivelDe(sim.state, FRACO)).toBeGreaterThan(0);
  });

  it('proximaComCombustivel escolhe a mais forte disponível', () => {
    const st = createState(11);
    st.fleet = ['aurora1', 'void_canhao', FORTE];
    st.hull = 'aurora1';
    st.naves[FORTE] = { nivel: 1, xp: 0, equipped: {}, combustivel: 1 };
    expect(proximaComCombustivel(st)).toBe(FORTE);
  });
});

describe('pagar para encher', () => {
  it('cobra em núcleo e enche o tanque', () => {
    const sim = new Sim(createState(11));
    sim.state.naves[sim.state.hull] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0 };
    sim.state.resources.nucleo = 99_999;
    const antes = sim.state.resources.nucleo;
    expect(sim.reabastecer()).toBe(true);
    expect(sim.combustivelDe()).toBe(1);
    expect(sim.state.resources.nucleo).toBeLessThan(antes);
  });

  it('sem núcleo não enche nem cobra', () => {
    const sim = new Sim(createState(11));
    sim.state.naves[sim.state.hull] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.1 };
    sim.state.resources.nucleo = 0;
    expect(sim.reabastecer()).toBe(false);
    expect(sim.combustivelDe()).toBe(0.1);
  });

  it('tanque cheio não aceita pagamento', () => {
    const sim = new Sim(createState(11));
    sim.state.resources.nucleo = 99_999;
    const antes = sim.state.resources.nucleo;
    expect(sim.reabastecer()).toBe(false);
    expect(sim.state.resources.nucleo).toBe(antes);
  });
});

describe('save', () => {
  it('o tanque sobrevive à migração', () => {
    const st = createState(11);
    st.naves[st.hull] = { nivel: 1, xp: 0, equipped: {}, combustivel: 0.42 };
    const m = migrate({ ...st, version: SAVE_VERSION })!;
    expect(m.naves[m.hull]?.combustivel).toBeCloseTo(0.42, 5);
  });

  it('save sem o campo chega com a frota cheia, não em terra', () => {
    const st = createState(11);
    const m = migrate({ ...st, version: 9 })!;
    for (const id of m.fleet) expect(combustivelDe(m, id)).toBe(1);
  });
});
