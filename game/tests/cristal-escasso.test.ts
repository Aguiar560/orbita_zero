import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { WAVES_PER_SECTOR } from '@sim/progression';
import { MARCOS_DE_CRISTAL, marcosCumpridos } from '@sim/marcos-de-cristal';
import { VIP_COST_CRYSTALS } from '@sim/vip';
import {
  ALVO_DA_CAMPANHA, PICO_DO_CHEFE, SETOR_FINAL_DA_CAMPANHA, cristalDoChefe,
} from '@data/balance/cristal';
import { CHESTS } from '@data/chests';
import { HULLS } from '@data/hulls';
import { MISSOES } from '@data/missoes';
import { pisoDaProvacao, PROVACAO_PISOS } from '@data/provacao';
import { recusaDoCliente, type Lancamento } from '../server/src/carteira';
import { conferirCompraDeCasco } from '../server/src/fabrica';
import { marcosACreditar, origemDoMarco } from '../server/src/marcos';

/**
 * O cristal é escasso, e só o servidor o cria.
 *
 * ## A regra, decidida em 10/09/2026
 *
 * O cristal é a renda do jogo: vendido por dinheiro, gasto no VIP, nas cápsulas
 * e nos serviços. O jogo dá **~700 na campanha inteira**, a maior parte no mid
 * e no endgame, e **só em marcos** — nada repetível.
 *
 * ## O que havia antes
 *
 * O chefe pagava `floor(bounty × 0,02)` em todo abate: 330.826 no setor 300, e
 * 2,1 milhões numa passada pela campanha. E a rota da carteira aceitava cristal
 * de qualquer cliente — `{moeda: 'cristal', quantia: 1000000}` entrava.
 */

const somaDe = (lista: readonly { cristais: number }[]): number => lista.reduce((s, m) => s + m.cristais, 0);

describe('o orçamento da campanha', () => {
  it('soma perto de 700, e menos de dois VIPs', () => {
    // Inclui as duas cadeias que terminam depois do 300 (62 cristais): o teto
    // de 780 é o alvo mais essa sobra, com folga de arredondamento.
    const total = somaDe(MARCOS_DE_CRISTAL);
    expect(total).toBeGreaterThanOrEqual(ALVO_DA_CAMPANHA);
    expect(total).toBeLessThanOrEqual(780);
    expect(total, 'o jogo grátis não pode pagar dois passes').toBeLessThan(VIP_COST_CRYSTALS * 2 - 200);
  });

  it('o fim paga muito mais que o começo', () => {
    const chefes = MARCOS_DE_CRISTAL.filter((m) => m.tipo === 'chefe');
    const inicio = somaDe(chefes.filter((m) => m.setor! <= 100));
    const fim = somaDe(chefes.filter((m) => m.setor! > 200));
    expect(fim).toBeGreaterThan(inicio * 8);
    expect(cristalDoChefe(SETOR_FINAL_DA_CAMPANHA)).toBe(PICO_DO_CHEFE);
  });

  it('um marco por chefe da campanha, e nenhum depois dela', () => {
    const chefes = MARCOS_DE_CRISTAL.filter((m) => m.tipo === 'chefe');
    expect(chefes).toHaveLength(SETOR_FINAL_DA_CAMPANHA / 10);
    expect(cristalDoChefe(310)).toBe(0);
    expect(cristalDoChefe(15)).toBe(0);
  });

  it('os ids são únicos — o id é a chave do crédito no livro', () => {
    const ids = MARCOS_DE_CRISTAL.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('nada repetível paga cristal no cliente', () => {
  it('o abate de chefe não põe cristal na carga nem no saldo', () => {
    const sim = new Sim(createState(41));
    sim.jumpSector(100);
    for (let i = 0; i < 5; i++) {
      sim.state.run.wave = WAVES_PER_SECTOR + 1;
      sim.refreshEncounter();
      expect(sim.encounter.kind).toBe('chefe');
      sim.completeEncounter(true);
    }
    expect(sim.state.run.carga.cristal).toBe(0);
    expect(sim.state.resources.cristal).toBe(0);
  });

  it('nenhum baú tem cristal dentro', () => {
    for (const c of CHESTS) expect((c.resources as Record<string, number>).cristal ?? 0).toBe(0);
    const sim = new Sim(createState(42));
    for (const c of CHESTS) sim.grantChest(c.id, 1);
    for (const c of CHESTS) sim.openChestFromStock(c.id);
    expect(sim.state.resources.cristal).toBe(0);
  });

  it('nenhum piso da Provação paga cristal', () => {
    for (let p = 1; p <= PROVACAO_PISOS; p++) {
      expect('cristais' in pisoDaProvacao(p).recompensa).toBe(false);
    }
  });

  it('a ausência num setor de chefe não rende cristal', () => {
    const sim = new Sim(createState(43));
    sim.jumpSector(10);
    const r = sim.applyOffline(3600);
    expect(r.gained.cristal).toBe(0);
    expect(sim.state.run.carga.cristal).toBe(0);
  });

  it('entregar missão com cristal não credita cristal no cliente', () => {
    // Quem paga é o servidor, ao conferir a entrega. Creditar aqui também
    // pagaria duas vezes — e a carteira descartaria o lançamento de todo modo.
    const def = MISSOES.find((m) => m.id === 'elim_chefes')!;
    expect(def.recompensa.moedas?.cristal).toBeGreaterThan(0);
    const sim = new Sim(createState(44));
    // Os requisitos dela são missões anteriores: entregues aqui, à mão.
    for (const r of def.requisitos ?? []) {
      if (r.tipo === 'missaoConcluida') sim.state.missoes[r.missaoId] = { passos: [], entregue: true, iniciada: true };
    }
    sim.state.missoes[def.id] = { passos: def.objetivos.map((o) => o.alvo), entregue: false, iniciada: true };
    sim.state.settings.pinnedMissions = [def.id]; // aceita
    // A missão vive depois do setor 10 (o contato da cadeia libera lá).
    sim.state.universe.bestSectorEver = 20;
    expect(sim.resgatarMissao(def.id), 'a entrega tinha de acontecer — senão o teste passa no vazio').toBe(true);
    expect(sim.state.resources.cristal).toBe(0);
    expect(sim.state.pendentes.filter((m) => m.moeda === 'cristal')).toEqual([]);
  });
});

describe('os marcos cumpridos', () => {
  it('o chefe conta quando o setor alcançado passa dele', () => {
    const vazio = new Set<string>();
    // O servidor guarda o PRÓXIMO setor liberado: 10 ainda não venceu o chefe do 10.
    expect(marcosCumpridos(10, vazio).map((m) => m.id)).not.toContain('chefe_10');
    expect(marcosCumpridos(11, vazio).map((m) => m.id)).toContain('chefe_10');
    expect(marcosCumpridos(11, vazio).map((m) => m.id)).not.toContain('chefe_20');
  });

  it('a missão conta quando a entrega foi registrada', () => {
    const marco = MARCOS_DE_CRISTAL.find((m) => m.tipo === 'missao')!;
    expect(marcosCumpridos(1, new Set()).map((m) => m.id)).not.toContain(marco.id);
    expect(marcosCumpridos(1, new Set([marco.missaoId!])).map((m) => m.id)).toContain(marco.id);
  });
});

describe('o servidor', () => {
  const l = (moeda: Lancamento['moeda'], quantia: number, motivo: Lancamento['motivo'] = 'drop'): Lancamento =>
    ({ usuario: 'u', moeda, quantia, motivo, em: 0 });

  it('descarta ganho de cristal vindo do cliente — com qualquer motivo', () => {
    expect(recusaDoCliente(l('cristal', 1_000_000))).toBe('cristal_so_do_servidor');
    expect(recusaDoCliente(l('cristal', 5, 'missao'))).toBe('cristal_so_do_servidor');
  });

  it('mas deixa o cliente GASTAR cristal, e ganhar as outras moedas', () => {
    expect(recusaDoCliente(l('cristal', -25, 'loja'))).toBeNull();
    expect(recusaDoCliente(l('sucata', 5000))).toBeNull();
    expect(recusaDoCliente(l('nucleo', 300, 'missao'))).toBeNull();
  });

  it('marco, compra e estorno só nascem no servidor', () => {
    for (const motivo of ['marco', 'compra', 'estorno'] as const) {
      expect(recusaDoCliente(l('sucata', 1, motivo))).toBe('motivo_so_do_servidor');
    }
  });

  it('não credita de novo o marco que o livro já tem', () => {
    const cumpridos = marcosACreditar('u1', 31, new Set(), new Set());
    expect(cumpridos.map((m) => m.id)).toEqual(['chefe_10', 'chefe_20', 'chefe_30']);
    const ja = new Set([origemDoMarco('u1', 'chefe_10'), origemDoMarco('u1', 'chefe_20')]);
    expect(marcosACreditar('u1', 31, new Set(), ja).map((m) => m.id)).toEqual(['chefe_30']);
    // A origem é por usuário: o marco de um não barra o de outro.
    expect(marcosACreditar('u2', 31, new Set(), ja)).toHaveLength(3);
  });
});

describe('o casco custa núcleos', () => {
  const compraveis = HULLS.filter((h) => !h.prototype && !h.piloto && h.cost > 0);

  it('o cliente confere núcleos, não cristal', () => {
    const s = createState(45);
    const nave = compraveis.find((h) => h.requiresSector <= 10)!;
    s.universe.bestSectorEver = 300;
    s.command.nivel = 300;
    s.resources.cristal = 1e9;
    s.resources.nucleo = 0;
    const sim = new Sim(s);
    expect(sim.podeComprarCasco(nave.id), 'cristal não compra nave').toBe(false);
    s.resources.nucleo = nave.cost;
    expect(sim.podeComprarCasco(nave.id)).toBe(true);
  });

  it('o preço cresce com o setor em cada linha', () => {
    // Os originais saem da fração da renda acumulada; a escada, da janela. Em
    // cada uma das duas o preço só sobe com o setor.
    const originais = compraveis.filter((h) => h.tier <= 3).sort((a, b) => a.requiresSector - b.requiresSector);
    for (let i = 1; i < originais.length; i++) {
      expect(originais[i]!.cost).toBeGreaterThanOrEqual(originais[i - 1]!.cost);
    }
  });

  it('o servidor cobra o preço da tabela', () => {
    const nave = compraveis[0]!;
    expect(conferirCompraDeCasco(nave.id, false)).toEqual({ custo: nave.cost });
  });
});
