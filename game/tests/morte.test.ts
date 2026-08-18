import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { XP_PERDIDO, SUCATA_PERDIDA, aplicarPerdaDeXp, cobrarMorte } from '@sim/morte';
import { WAVES_PER_SECTOR, curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';

/**
 * A punição por morrer.
 *
 * A regra mais delicada do jogo: mexe em nível, XP, Matriz e saldo de uma vez,
 * e um erro aqui apaga horas de progresso de alguém.
 */
describe('perda de XP por morte (§1B.3)', () => {
  /**
   * O exemplo do próprio pedido, virado teste.
   *
   * Nível 10, faixa de 400 de XP, 200 acumulados nela. A morte tira 15% de 200,
   * ou seja 30 — a fração incide sobre o ACUMULADO na faixa, não sobre a faixa
   * inteira nem sobre o XP de uma vida.
   */
  it('tira 15% do acumulado dentro da faixa do nível', () => {
    const p = { nivel: 10, xp: 200 };
    const faixa = () => 400;

    const perda = aplicarPerdaDeXp(p, faixa);

    expect(perda.xp).toBeCloseTo(30, 6);
    expect(p.xp).toBeCloseTo(170, 6);
    expect(p.nivel).toBe(10);
    expect(perda.niveis).toBe(0);
  });

  it('mortes seguidas vão comendo a faixa', () => {
    const p = { nivel: 10, xp: 200 };
    const faixa = () => 400;
    for (let i = 0; i < 3; i++) aplicarPerdaDeXp(p, faixa);
    expect(p.xp).toBeCloseTo(200 * 0.85 ** 3, 6);
    expect(p.nivel).toBe(10);
  });

  /**
   * Com a faixa esgotada, a cobrança passa para o nível de baixo.
   *
   * Sem esta regra o acumulado só encolheria assintoticamente e ninguém jamais
   * perderia um nível — o pedido é explícito que perder nível tem de acontecer.
   */
  it('com a faixa esgotada, cai de nível e cobra da faixa anterior', () => {
    const p = { nivel: 10, xp: 0 };
    const faixa = (n: number) => (n === 9 ? 300 : 400);

    const perda = aplicarPerdaDeXp(p, faixa);

    expect(p.nivel).toBe(9);
    expect(perda.niveis).toBe(1);
    // Reaparece no topo da faixa de baixo, já descontado.
    expect(p.xp).toBeCloseTo(300 * (1 - XP_PERDIDO), 6);
  });

  it('o nível 1 é o piso — não dá para cair abaixo dele', () => {
    const p = { nivel: 1, xp: 0 };
    const perda = aplicarPerdaDeXp(p, () => 100);
    expect(p.nivel).toBe(1);
    expect(p.xp).toBe(0);
    expect(perda.niveis).toBe(0);
  });
});

describe('a cobrança completa da morte', () => {
  const comProgresso = () => {
    const s = createState(7);
    s.command.nivel = 12;
    s.command.xp = 500;
    s.command.allocated = ['no_a', 'no_b', 'no_c'];
    s.naves[s.hull] = { nivel: 8, xp: 300 };
    s.resources.sucata = 10_000;
    return s;
  };

  it('cobra personagem e nave ao mesmo tempo', () => {
    const s = comProgresso();
    const resumo = cobrarMorte(s);

    expect(resumo.xpPersonagem).toBeCloseTo(500 * XP_PERDIDO, 6);
    expect(s.command.xp).toBeCloseTo(500 * (1 - XP_PERDIDO), 6);
    expect(resumo.xpNave).toBeCloseTo(300 * XP_PERDIDO, 6);
    expect(s.naves[s.hull]!.xp).toBeCloseTo(300 * (1 - XP_PERDIDO), 6);
  });

  it('leva uma fatia da sucata já depositada', () => {
    const s = comProgresso();
    const resumo = cobrarMorte(s);
    expect(resumo.sucata).toBeCloseTo(10_000 * SUCATA_PERDIDA, 6);
    expect(s.resources.sucata).toBeCloseTo(10_000 * (1 - SUCATA_PERDIDA), 6);
  });

  it('não encosta nos itens', () => {
    const s = comProgresso();
    s.inventory = [{ uid: 'x' } as never];
    cobrarMorte(s);
    expect(s.inventory).toHaveLength(1);
  });

  /**
   * Perder nível encolhe o orçamento da Matriz, então um ponto precisa voltar.
   * Devolver o ÚLTIMO alocado desfaz na ordem inversa da construção, o que
   * mantém o que sobra ligado ao centro.
   */
  it('cair de nível devolve o último ponto da Matriz', () => {
    const s = comProgresso();
    s.command.xp = 0;

    const resumo = cobrarMorte(s);

    expect(resumo.niveisPersonagem).toBe(1);
    expect(s.command.nivel).toBe(11);
    expect(resumo.nosDevolvidos).toEqual(['no_c']);
    expect(s.command.allocated).toEqual(['no_a', 'no_b']);
  });

  it('sem cair de nível, a Matriz fica intacta', () => {
    const s = comProgresso();
    const resumo = cobrarMorte(s);
    expect(resumo.niveisPersonagem).toBe(0);
    expect(s.command.allocated).toHaveLength(3);
  });
});

describe('morrer no jogo', () => {
  it('reinicia o setor da onda 1 e perde a carga', () => {
    const sim = new Sim(createState(99));
    sim.jumpSector(12);
    sim.state.run.wave = 4;
    sim.grantCarga('sucata', 2000);
    sim.grantCarga('nucleo', 80);

    sim.failEncounter();

    expect(sim.state.run.wave, 'refaz o setor inteiro').toBe(1);
    expect(sim.state.run.sector, 'o setor não regride').toBe(12);
    expect(sim.state.run.carga.sucata).toBe(0);
    expect(sim.state.run.carga.nucleo).toBe(0);
    expect(sim.state.stats.deaths).toBe(1);
  });
});

describe('níveis de personagem e de nave (§17)', () => {
  it('cada nave tem nível próprio e trocar não transfere', () => {
    const sim = new Sim(createState(3));
    const primeira = sim.state.hull;
    sim.grantXp(5000);
    const nivelPrimeira = sim.naveAtiva.nivel;
    expect(nivelPrimeira).toBeGreaterThan(1);

    // Uma nave que nunca voou começa do zero.
    sim.state.hull = 'aurora1';
    expect(sim.naveAtiva.nivel).toBe(1);
    expect(sim.naveAtiva.xp).toBe(0);

    // E a primeira guarda o que conquistou.
    sim.state.hull = primeira;
    expect(sim.naveAtiva.nivel).toBe(nivelPrimeira);
  });

  it('as curvas de nível são polinomiais, então 300 é alcançável', () => {
    /**
     * Teto de 10⁸, não de 10⁷.
     *
     * O número antigo era um PROXY para "300 é alcançável", e ele reprovou uma
     * curva em que o 300 é alcançável de fato — medido, no setor 270. A curva
     * ficou mais cara de propósito: com a anterior o teto era batido lá pelo
     * setor 140, e mais da metade da campanha não dava nível nenhum.
     *
     * O que a asserção protege é o que ela sempre protegeu: que a curva seja
     * POLINOMIAL. Com a exponencial antiga o nível 300 custaria 7 × 10²⁰ — vinte
     * ordens de grandeza acima deste teto, então ele continua pegando a
     * regressão que importa.
     */
    expect(curvaXpPersonagem(300)).toBeLessThan(1e8);
    expect(curvaXpNave(300)).toBeLessThan(1e8);
    // E ainda assim cada nível custa mais que o anterior.
    for (const n of [2, 50, 150, 299]) {
      expect(curvaXpPersonagem(n + 1)).toBeGreaterThan(curvaXpPersonagem(n));
      expect(curvaXpNave(n + 1)).toBeGreaterThan(curvaXpNave(n));
    }
  });
});

/**
 * A trava de fase (§1B.4).
 *
 * Farmar é parte do desenho — o chefe é dimensionado para quem já voltou atrás
 * atrás de item e de nível. A trava é o que torna isso viável num jogo ocioso.
 */
describe('repetir a fase em vez de avançar', () => {
  const noFimDoSetor = (repetir: boolean) => {
    const sim = new Sim(createState(21));
    sim.state.settings.repetirSetor = repetir;
    sim.jumpSector(8);
    sim.state.run.wave = WAVES_PER_SECTOR + 1;
    return sim;
  };

  it('desligada, a incursão segue para a fase seguinte', () => {
    const sim = noFimDoSetor(false);
    sim.completeEncounter();
    expect(sim.state.run.sector).toBe(9);
    expect(sim.state.run.wave).toBe(1);
  });

  it('ligada, a incursão fica onde está e refaz da onda 1', () => {
    const sim = noFimDoSetor(true);
    sim.completeEncounter();
    expect(sim.state.run.sector).toBe(8);
    expect(sim.state.run.wave).toBe(1);
  });

  /**
   * O ponto delicado: travar não pode custar o acesso conquistado, senão quem
   * farma antes do chefe perde o direito de enfrentá-lo.
   */
  it('ligada, a fase seguinte libera do mesmo jeito', () => {
    const sim = noFimDoSetor(true);
    sim.completeEncounter();
    expect(sim.state.universe.bestSector).toBeGreaterThanOrEqual(9);
  });

  it('ligada, a recompensa da incursão é depositada normalmente', () => {
    const sim = noFimDoSetor(true);
    sim.grantCarga('sucata', 500);
    const antes = sim.state.resources.sucata;
    sim.completeEncounter();
    expect(sim.state.resources.sucata).toBeGreaterThan(antes);
    expect(sim.state.run.carga.sucata).toBe(0);
  });
});
