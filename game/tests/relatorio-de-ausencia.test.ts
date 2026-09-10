import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { adotarAusencia, drenarProgresso, sincronizarProgresso, esquecerProgresso } from '@app/progresso';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { balancoDaAusencia } from '@sim/balanco-da-ausencia';
import { curvaXpPersonagem } from '@data/balance/curvas';
import { TREE_NODES } from '@data/tree';
import { nivelPorXpAcumulado, xpAcumuladoAte, xpAcumuladoDe } from '@sim/nivel';

/**
 * O relatório de ausência mostra o que SAIU, e não só o que entrou.
 *
 * ## O defeito, medido em 10/09
 *
 * Uma ausência de 37 minutos com a nave parada num setor acima do que ela
 * aguenta: 41 quedas, 7.297 de sucata tirada do cofre, XP do piloto perdido.
 * O relatório mostrou "3,21K abates" e mais nada — ele só desenhava o que era
 * positivo, e o servidor só devolvia o líquido. O jogador leu "não rendeu
 * nada" quando tinha perdido.
 *
 * E havia uma segunda metade: o XP perdido VOLTAVA. O cliente adotava o XP do
 * servidor com `Math.max` e a drenagem seguinte reenviava a diferença. A
 * sucata perdida ficava perdida, o XP não.
 */

/** Um piloto no nível 10 com o cofre e o porão cheios, num setor que o mata. */
function simNaParede(): Sim {
  const sim = new Sim(createState(31));
  sim.state.command.nivel = 10;
  sim.state.command.xp = 0; // faixa vazia: a primeira queda já derruba o nível
  sim.state.command.allocated = TREE_NODES.slice(0, 3).map((n) => n.id);
  sim.state.resources.sucata = 50_000;
  sim.jumpSector(80);
  sim.state.run.carga = { sucata: 3_000, nucleo: 40, cristal: 0 };
  return sim;
}

describe('a simulação conta o que as quedas levaram', () => {
  it('quedas, multa, carga, XP, patente e Matriz', () => {
    const sim = simNaParede();
    const r = sim.applyOffline(600);

    expect(r.quedas, 'o setor 80 tinha de derrubar um piloto nível 10').toBeGreaterThan(0);
    expect(r.perdas!.multa).toBeGreaterThan(0);
    // A carga do porão evapora na primeira queda.
    expect(r.perdas!.carga.sucata).toBeGreaterThanOrEqual(3_000);
    expect(r.perdas!.carga.nucleo).toBeGreaterThanOrEqual(40);
    expect(r.perdas!.xpPiloto).toBeGreaterThan(0);
    // A patente não cai necessariamente: cada queda tira 15% da FAIXA, e os
    // abates entre uma queda e outra a reabastecem — medido, 300 quedas e o
    // nível 10 intacto. O que se confere é que o relatório diz o que o estado
    // diz, e que o XP líquido fecha com o acumulado.
    expect(r.patente).toEqual({ antes: 10, depois: sim.state.command.nivel });
    expect(r.xp).toBeCloseTo(
      xpAcumuladoDe(sim.state.command, curvaXpPersonagem) - xpAcumuladoAte(10, curvaXpPersonagem), 6);
    // A nave que voou aparece na lista, com o nível que ela tem agora.
    const nave = r.naves!.find((n) => n.casco === sim.state.hull);
    expect(nave).toBeDefined();
    expect(nave!.depois).toBe(sim.state.naves[sim.state.hull]!.nivel);
  });

  it('a escuta das quedas é desligada no fim', () => {
    // Se o `off` falhasse, uma segunda simulação somaria nas perdas da
    // primeira — no Worker, as de outro jogador.
    const a = simNaParede();
    const ra = a.applyOffline(300);
    const multaA = ra.perdas!.multa;
    const b = simNaParede();
    b.applyOffline(300);
    expect(ra.perdas!.multa).toBe(multaA);
  });
});

describe('o balanço separa ganho de perda', () => {
  it('bruto menos perda dá o líquido, moeda a moeda', () => {
    const sim = simNaParede();
    const antes = sim.state.resources.sucata;
    const r = sim.applyOffline(600);
    const b = balancoDaAusencia(r);

    expect(b.houvePerda).toBe(true);
    expect(b.perdas.multa).toBe(r.perdas!.multa);
    // A conta fecha: o que entrou menos a multa é o que o saldo mostra.
    expect(b.ganhos.moedas.sucata - b.perdas.multa).toBe(b.liquido.moedas.sucata);
    expect(Math.trunc(sim.state.resources.sucata - antes)).toBe(b.liquido.moedas.sucata);
  });

  it('o XP bruto é o líquido somado ao perdido', () => {
    const r = {
      seconds: 600, capped: false, gained: { sucata: 0, nucleo: 0, cristal: 0 },
      sectorsCleared: 0, kills: 900, chests: 0, xp: -400, quedas: 3,
      perdas: { multa: 0, carga: { sucata: 0, nucleo: 0, cristal: 0 }, xpPiloto: 1_000, matriz: [] },
    };
    const b = balancoDaAusencia(r);
    expect(b.ganhos.xp).toBe(600);
    expect(b.perdas.xp).toBe(1_000);
    expect(b.liquido.xp).toBe(-400);
  });

  it('patente e nível de nave que caem contam como perda', () => {
    const base = {
      seconds: 600, capped: false, gained: { sucata: 0, nucleo: 0, cristal: 0 },
      sectorsCleared: 0, kills: 0, chests: 0,
    };
    const patente = balancoDaAusencia({ ...base, patente: { antes: 10, depois: 8 } });
    expect(patente.patente).toEqual({ antes: 10, depois: 8 });
    expect(patente.houvePerda).toBe(true);

    const nave = balancoDaAusencia({ ...base, naves: [{ casco: 'x', antes: 40, depois: 39, xp: -500 }] });
    expect(nave.houvePerda).toBe(true);
    // Patente igual não vira linha: "10 → 10" é ruído.
    expect(balancoDaAusencia({ ...base, patente: { antes: 10, depois: 10 } }).patente).toBeNull();
  });

  it('sem queda não há perda, e o resultado não se repete', () => {
    const sim = new Sim(createState(32));
    sim.jumpSector(2);
    const b = balancoDaAusencia(sim.applyOffline(300));
    expect(b.quedas).toBe(0);
    expect(b.houvePerda).toBe(false);
    expect(b.ganhos.xp).toBeGreaterThan(0);
  });
});

describe('o XP que a ausência tirou não volta na drenagem', () => {
  let servidorXp = 0;
  let enviados: { xp?: number }[] = [];

  beforeEach(() => {
    vi.unstubAllGlobals();
    esquecerProgresso();
    enviados = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init?.body) {
        const corpo = JSON.parse(String(init.body)) as { xp?: number };
        enviados.push(corpo);
        servidorXp += corpo.xp ?? 0;
      }
      return {
        ok: true,
        json: async () => ({
          xp: servidorXp, nivel: nivelPorXpAcumulado(servidorXp, curvaXpPersonagem).nivel,
          melhorSetor: 1, matriz: [], naves: {}, materiais: {}, cascoEmCampo: '',
        }),
      } as unknown as Response;
    });
  });

  it('a patente rebaixada pelo servidor fica rebaixada', async () => {
    servidorXp = xpAcumuladoAte(20, curvaXpPersonagem);
    const sim = new Sim(createState(33));
    await sincronizarProgresso(sim);
    expect(sim.state.command.nivel).toBe(20);

    // A ausência, no servidor, derrubou o piloto para o nível 18.
    servidorXp = xpAcumuladoAte(18, curvaXpPersonagem);
    await adotarAusencia(sim);
    expect(sim.state.command.nivel).toBe(18);

    // E a drenagem seguinte não devolve nada: era aqui que o XP voltava.
    await drenarProgresso(sim);
    expect(enviados.at(-1)?.xp ?? 0).toBeCloseTo(0, 6);
    expect(servidorXp).toBeCloseTo(xpAcumuladoAte(18, curvaXpPersonagem), 6);
  });

  it('mas o que o cliente ainda não tinha enviado continua valendo', async () => {
    // XP ganho antes da ausência e ainda não drenado não passou pela simulação
    // do servidor. Perder isso seria punir o jogador por ter fechado a aba
    // antes da drenagem.
    servidorXp = xpAcumuladoAte(20, curvaXpPersonagem);
    const sim = new Sim(createState(34));
    await sincronizarProgresso(sim);
    const pendente = 1_234;
    sim.state.command.xp += pendente;

    servidorXp = xpAcumuladoAte(18, curvaXpPersonagem);
    await adotarAusencia(sim);
    expect(xpAcumuladoDe(sim.state.command, curvaXpPersonagem))
      .toBeCloseTo(xpAcumuladoAte(18, curvaXpPersonagem) + pendente, 6);

    await drenarProgresso(sim);
    expect(enviados.at(-1)?.xp).toBeCloseTo(pendente, 6);
  });
});
