import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState, migrate } from '@sim/state';
import {
  MISSOES, MISSAO_POR_ID, quantoConta,
  type FatoDeJogo, type Objetivo,
} from '@data/missoes';
import { CONCESSAO_POR_ID } from '@data/balance/capacidade';
import { aplicarFato, estaCompleta, progressoDe, situacaoDe } from '@sim/missoes';

/**
 * Missões (§27).
 *
 * O §27 pede ARQUITETURA. O que estes testes guardam, então, não é o conteúdo
 * das onze missões de hoje — é o formato: que o casamento entre fato e objetivo
 * não conte o que não devia, e que missão nova seja linha de tabela.
 */

const abate = (over: Partial<Extract<FatoDeJogo, { tipo: 'abate' }>> = {}): FatoDeJogo => ({
  tipo: 'abate', inimigo: 'x', elemento: 'padrao', chefe: false, setor: 1, ...over,
});

describe('o catálogo', () => {
  it('não tem id repetido', () => {
    expect(new Set(MISSOES.map((m) => m.id)).size).toBe(MISSOES.length);
  });

  it('toda missão tem ao menos um objetivo com alvo positivo', () => {
    for (const m of MISSOES) {
      expect(m.objetivos.length, m.id).toBeGreaterThan(0);
      for (const o of m.objetivos) expect(o.alvo, `${m.id}: ${o.texto}`).toBeGreaterThan(0);
    }
  });

  /** Pré-requisito para missão que não existe travaria a cadeia para sempre. */
  it('todo pré-requisito existe', () => {
    for (const m of MISSOES) {
      for (const id of m.requer ?? []) expect(MISSAO_POR_ID.has(id), `${m.id} → ${id}`).toBe(true);
    }
  });

  /** Concessão inexistente seria recompensa que não entrega nada. */
  it('toda concessão prometida existe no registro de carga', () => {
    for (const m of MISSOES) {
      const c = m.recompensa.concessao;
      if (c) expect(CONCESSAO_POR_ID.has(c), `${m.id} → ${c}`).toBe(true);
    }
  });

  /**
   * Entrega que consome material que nenhum objetivo mandou coletar seria uma
   * missão impossível de planejar.
   */
  it('o que a entrega consome é o que ela mandou coletar', () => {
    for (const m of MISSOES) {
      for (const rec of Object.keys(m.consomeNaEntrega ?? {})) {
        const pedido = m.objetivos.some((o) => o.filtro?.recurso === rec);
        expect(pedido, `${m.id} consome ${rec} sem objetivo que o peça`).toBe(true);
      }
    }
  });

  /** Sem cadeia circular: A exigindo B que exige A trava as duas para sempre. */
  it('a cadeia de pré-requisitos não tem ciclo', () => {
    const visitando = new Set<string>();
    const pronto = new Set<string>();
    const desce = (id: string): void => {
      if (pronto.has(id)) return;
      expect(visitando.has(id), `ciclo em ${id}`).toBe(false);
      visitando.add(id);
      for (const p of MISSAO_POR_ID.get(id)?.requer ?? []) desce(p);
      visitando.delete(id);
      pronto.add(id);
    };
    for (const m of MISSOES) desce(m.id);
  });
});

describe('o casamento entre fato e objetivo', () => {
  const objAbate: Objetivo = { fato: 'abate', alvo: 10, texto: '' };

  it('conta um por fato, sem filtro', () => {
    expect(quantoConta(objAbate, abate())).toBe(1);
  });

  it('não conta fato de outro tipo', () => {
    expect(quantoConta(objAbate, { tipo: 'galaxia', galaxia: 3 })).toBe(0);
  });

  it('o filtro de elemento separa', () => {
    const o: Objetivo = { fato: 'abate', alvo: 10, filtro: { elemento: 'fogo' }, texto: '' };
    expect(quantoConta(o, abate({ elemento: 'fogo' }))).toBe(1);
    expect(quantoConta(o, abate({ elemento: 'gelo' }))).toBe(0);
  });

  /**
   * O caso que mais erra na prática: um filtro que pede campo que aquele TIPO de
   * fato nem tem. Sem a guarda, `undefined === undefined` casaria e uma missão
   * de "matar inimigos de fogo" contaria a conclusão de um setor.
   */
  it('filtro que pede campo ausente no fato nunca casa', () => {
    const o: Objetivo = { fato: 'setor', alvo: 1, filtro: { elemento: 'fogo' }, texto: '' };
    expect(quantoConta(o, { tipo: 'setor', setor: 10, galaxia: 0 })).toBe(1);

    // E o inverso: pedir setor mínimo num abate de setor baixo.
    const o2: Objetivo = { fato: 'abate', alvo: 5, filtro: { setorMin: 40 }, texto: '' };
    expect(quantoConta(o2, abate({ setor: 39 }))).toBe(0);
    expect(quantoConta(o2, abate({ setor: 40 }))).toBe(1);
  });

  it('somaQuantidade soma o volume, não um por evento', () => {
    const o: Objetivo = {
      fato: 'recurso', alvo: 500, somaQuantidade: true,
      filtro: { recurso: 'ferrita' }, texto: '',
    };
    expect(quantoConta(o, { tipo: 'recurso', recurso: 'ferrita', quantidade: 120 })).toBe(120);
    expect(quantoConta(o, { tipo: 'recurso', recurso: 'titanio', quantidade: 120 })).toBe(0);
  });

  it('fusão só conta quando subiu, se o filtro pedir', () => {
    const o: Objetivo = { fato: 'fusao', alvo: 5, filtro: { subiu: true }, texto: '' };
    expect(quantoConta(o, { tipo: 'fusao', entrada: 0, saida: 1, subiu: true })).toBe(1);
    expect(quantoConta(o, { tipo: 'fusao', entrada: 0, saida: 0, subiu: false })).toBe(0);
  });
});

describe('o progresso', () => {
  it('não passa do alvo', () => {
    const state = createState(1);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;
    for (let i = 0; i < 250; i++) aplicarFato(state, abate(), 300);
    expect(progressoDe(state, def).passos[0]).toBe(def.objetivos[0]!.alvo);
  });

  /**
   * Missão oculta NÃO acumula.
   *
   * Sem isto, uma missão liberada no setor 25 nasceria completa com o que o
   * jogador fez antes de ela existir — o §27 estaria premiando o passado.
   */
  it('missão ainda travada não acumula', () => {
    const state = createState(2);
    const def = MISSOES.find((m) => m.requerSetor === 10)!;
    for (let i = 0; i < 200; i++) aplicarFato(state, abate({ elemento: 'fogo' }), 1);
    expect(progressoDe(state, def).passos[0]).toBe(0);

    // Com o alcance suficiente, passa a contar.
    aplicarFato(state, abate({ elemento: 'fogo' }), 10);
    expect(progressoDe(state, def).passos[0]).toBe(1);
  });

  it('avisa a conclusão UMA vez', () => {
    const state = createState(3);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;
    let avisos = 0;
    for (let i = 0; i < 150; i++) {
      if (aplicarFato(state, abate(), 300).some((m) => m.id === def.id)) avisos++;
    }
    expect(avisos).toBe(1);
    expect(estaCompleta(state, def)).toBe(true);
  });
});

describe('o resgate', () => {
  it('paga, concede carga e não paga duas vezes', () => {
    const sim = new Sim(createState(4));
    const def = MISSAO_POR_ID.get('coleta_ferrita')!;
    const espacosAntes = sim.cargoSlots;

    // Completa pela porta da frente: guardar ferrita dispara o fato sozinho.
    sim.guardarMaterial('ferrita', 500);
    expect(situacaoDe(sim.state, def, sim.alcanceLiberado)).toBe('pronta');

    const sucataAntes = sim.state.resources.sucata;
    expect(sim.resgatarMissao(def.id)).toBe(true);
    expect(sim.state.resources.sucata).toBe(sucataAntes + 5_000);
    expect(sim.cargoSlots).toBeGreaterThan(espacosAntes);

    // Segunda vez não paga.
    const depois = sim.state.resources.sucata;
    expect(sim.resgatarMissao(def.id)).toBe(false);
    expect(sim.state.resources.sucata).toBe(depois);
  });

  it('não resgata missão incompleta', () => {
    const sim = new Sim(createState(5));
    expect(sim.resgatarMissao('elim_primeiros')).toBe(false);
  });

  /**
   * O contrato mais delicado do resgate: a checagem vem ANTES do pagamento.
   *
   * Sem isso, uma entrega sem material deixaria o jogador sem o material E sem a
   * recompensa — o pior desfecho possível para um clique.
   */
  it('entrega sem material não cobra nada', () => {
    const sim = new Sim(createState(6));
    const def = MISSOES.find((m) => m.consomeNaEntrega)!;
    const rec = Object.keys(def.consomeNaEntrega!)[0]!;
    const pede = def.consomeNaEntrega![rec]!;

    // Completa o objetivo e depois GASTA o material noutra coisa.
    sim.guardarMaterial(rec, pede);
    sim.gastarMaterial(rec, pede);
    expect(sim.materialDisponivel(rec)).toBe(0);

    const medalhasAntes = sim.state.medalhas;
    const cristalAntes = sim.state.resources.cristal;
    expect(sim.resgatarMissao(def.id)).toBe(false);
    expect(sim.state.medalhas).toBe(medalhasAntes);
    expect(sim.state.resources.cristal).toBe(cristalAntes);
    expect(progressoDe(sim.state, def).entregue).toBe(false);
  });
});

describe('o save', () => {
  it('save anterior ao §27 não trava o boot', () => {
    const antigo = createState(7) as Record<string, unknown>;
    delete antigo.missoes;
    delete antigo.medalhas;

    const migrado = migrate(JSON.parse(JSON.stringify(antigo)));
    expect(migrado).not.toBeNull();
    expect(migrado!.missoes).toEqual({});
    expect(migrado!.medalhas).toBe(0);
  });

  /**
   * Objetivo acrescentado a uma missão já em andamento preserva o que casa por
   * índice, em vez de zerar o que o jogador já fez.
   */
  it('progresso salvo com menos passos que a missão é completado, não zerado', () => {
    const state = createState(8);
    const def = MISSOES.find((m) => m.objetivos.length >= 1)!;
    state.missoes[def.id] = { passos: [7], entregue: false };

    const p = progressoDe(state, def);
    expect(p.passos[0]).toBe(7);
    expect(p.passos.length).toBe(def.objetivos.length);
  });
});
