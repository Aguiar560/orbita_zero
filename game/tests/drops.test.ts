import { describe, expect, it } from 'vitest';
import { REGRAS_DE_DROP, afinidadeDoAlvo, resolverDrop, type AlvoDoDrop } from '@data/balance/drops';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { ELEMENTS } from '@data/elements';
import {
  CARGA_INICIAL, CARGA_MAXIMA, CONCESSOES, RECURSO_INICIAL,
  capacidadeDeItens, colunasDaGrade, linhasDaGrade,
} from '@data/balance/capacidade';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * Tabelas de drop por regra (§10).
 *
 * O que estes testes protegem não é o valor de nenhuma regra — é a PROPRIEDADE
 * que faz o sistema aceitar conteúdo futuro sem cadastro: qualquer alvo casa
 * com pelo menos uma regra, e nenhum efeito depende de o conteúdo estar listado.
 */
const alvo = (p: Partial<AlvoDoDrop> = {}): AlvoDoDrop => ({
  setor: 10, galaxia: 1, kind: 'onda', ...p,
});

describe('nenhum conteúdo fica sem drop', () => {
  /**
   * A garantia central. As galáxias são PROCEDURAIS: não existe lista delas em
   * lugar nenhum, e o índice não tem teto. Se a resolução dependesse de o alvo
   * estar cadastrado, a galáxia 31 nasceria sem drop e ninguém perceberia.
   */
  it('galáxia, setor e chefe nunca vistos ainda resolvem', () => {
    for (const setor of [1, 300, 1000, 9999]) {
      for (const kind of ['onda', 'elite', 'chefe'] as const) {
        const r = resolverDrop(alvo({ setor, galaxia: Math.floor(setor / 10), kind, chefe: 'chefe_que_nao_existe' }));
        expect(r.regras.length, `setor ${setor} ${kind}`).toBeGreaterThan(0);
        expect(r.quantidade).toBeGreaterThan(0);
      }
    }
  });

  it('inimigo com tag desconhecida cai na regra base', () => {
    const r = resolverDrop(alvo({ inimigo: 'inimigo_futuro', tags: ['faccao_que_nao_existe'] }));
    expect(r.regras).toContain('base');
  });

  it('toda regra declara uma nota — a tabela é para ser lida', () => {
    for (const r of REGRAS_DE_DROP) expect(r.nota, r.id).toBeTruthy();
  });
});

describe('a forma de acumular importa', () => {
  /**
   * Dois pisos de raridade não se empilham: o mais alto já contém o outro. Se
   * somassem, um chefe de galáxia tardia daria piso 2 + 3 = 5 (Mítico), o que
   * nenhuma regra pediu.
   */
  it('o piso de raridade pega o maior, não a soma', () => {
    const r = resolverDrop(alvo({ kind: 'chefe', galaxia: 12 }));
    expect(r.regras).toContain('chefe');
    expect(r.regras).toContain('chefe-de-galaxia-tardia');
    expect(r.pisoDeRaridade).toBe(3);
  });

  it('sorte e quantidade multiplicam; nível de item e extras somam', () => {
    const so = resolverDrop(alvo({ kind: 'chefe', galaxia: 1, setor: 10 }));
    const duplo = resolverDrop(alvo({ kind: 'chefe', galaxia: 12, setor: 250 }));
    expect(duplo.sorteMult).toBeCloseTo(so.sorteMult * 1.2 * 1.25, 6);
    expect(duplo.ilvlBonus).toBe(so.ilvlBonus);
  });
});

describe('o alvo influencia o que cai', () => {
  it('o elemento do alvo favorece o elemento da peça', () => {
    const favor = afinidadeDoAlvo(alvo({ elemento: 'gelo' }));
    expect(favor.gelo).toBeGreaterThan(1);

    const rng = new Rng(4242);
    const conta = (fav: Record<string, number> | undefined) => {
      let gelo = 0; let outros = 0;
      for (let i = 0; i < 20_000; i++) {
        const it = rollItem(rng, 200, 3, 0, { elementoFavorecido: fav });
        if (it.element === 'gelo') gelo++;
        else if (it.element !== 'padrao') outros++;
      }
      return gelo / Math.max(1, gelo + outros);
    };
    // Sem viés, gelo é um de cinco elementais.
    expect(conta(undefined)).toBeCloseTo(0.2, 1);
    expect(conta(favor)).toBeGreaterThan(0.35);
  });

  it('alvo neutro não distorce elemento nenhum', () => {
    expect(afinidadeDoAlvo(alvo({ elemento: 'padrao' }))).toEqual({});
    expect(afinidadeDoAlvo(alvo())).toEqual({});
  });

  it('o viés de slot desloca a base sorteada sem excluir as outras', () => {
    const rng = new Rng(77);
    let blindagem = 0; let armas = 0;
    for (let i = 0; i < 20_000; i++) {
      const it = rollItem(rng, 200, 0, 0, { slotFavorecido: { blindagem: 6 } });
      if (it.slot === 'blindagem') blindagem++;
      if (it.slot === 'principal' || it.slot === 'secundaria') armas++;
    }
    expect(blindagem / 20_000).toBeGreaterThan(0.3);
    // E continua caindo arma — viés, não exclusão.
    expect(armas).toBeGreaterThan(0);
  });
});

/**
 * O bug que apareceu ao ligar as regras: a tabela de neutralidade tinha CINCO
 * entradas para SETE raridades, então Mítico e Divino caíam no `?? 0.5` e eram
 * mais neutros que o Lendário (0,12). A raridade máxima era a menos elemental
 * do jogo — o oposto do pretendido pelo §9.
 */
describe('raridade alta é mais elemental, não menos', () => {
  it('a chance de sair neutro cai monotonicamente com a raridade', () => {
    const rng = new Rng(31415);
    const neutro: number[] = [];
    for (let r = 0; r <= 6; r++) {
      let n = 0; let total = 0;
      for (let i = 0; i < 8000; i++) {
        const it = rollItem(rng, 200, 0, 0, { floor: r as 0 });
        if (it.rarity !== r) continue;
        total++;
        if (it.element === 'padrao') n++;
      }
      neutro.push(total ? n / total : 0);
    }
    for (let r = 1; r < neutro.length; r++) {
      expect(neutro[r]!, `raridade ${r} contra ${r - 1}`).toBeLessThanOrEqual(neutro[r - 1]! + 0.02);
    }
    expect(ELEMENTS.length).toBe(6);
  });
});

/**
 * Capacidade de carga (§28).
 *
 * O inventário NASCE apertado e cresce por conquista. Com 70 espaços desde o
 * primeiro minuto, "guardar ou desmanchar" nunca é uma decisão.
 */
describe('a carga começa pequena e cresce por conquista', () => {
  it('começa em 15 — grade 5 × 3', () => {
    expect(capacidadeDeItens([])).toBe(CARGA_INICIAL);
    expect(CARGA_INICIAL).toBe(5 * 3);
    expect(colunasDaGrade(CARGA_INICIAL)).toBe(5);
  });

  it('as concessões existentes chegam ao teto de 70 — grade 7 × 10', () => {
    const todas = CONCESSOES.map((c) => c.id);
    expect(capacidadeDeItens(todas)).toBe(CARGA_MAXIMA);
    expect(CARGA_MAXIMA).toBe(7 * 10);
    expect(colunasDaGrade(CARGA_MAXIMA)).toBe(7);
  });

  /**
   * O teto vale mesmo se alguém cadastrar concessão demais — e é por isso que
   * ele é aplicado na função e não confiado à soma da tabela.
   */
  it('nenhuma soma de concessões passa do teto', () => {
    const dobradas = [...CONCESSOES, ...CONCESSOES].map((c) => c.id);
    expect(capacidadeDeItens(dobradas)).toBeLessThanOrEqual(CARGA_MAXIMA);
  });

  it('a grade cresce em ALTURA antes de alargar', () => {
    // Uma grade que muda de largura a cada compra apaga a memória visual de
    // onde cada item fica, que é metade do valor de um inventário em grade.
    expect(colunasDaGrade(20)).toBe(5);
    expect(colunasDaGrade(35)).toBe(5);
    expect(colunasDaGrade(40)).toBe(7);
    expect(linhasDaGrade(15)).toBe(3);
    expect(linhasDaGrade(70)).toBe(10);
  });

  it('conceder duas vezes a mesma fonte não dá espaço duas vezes', () => {
    const sim = new Sim(createState(5));
    const base = sim.cargoSlots;
    expect(sim.concederCarga('loja_carga_1')).toBe(true);
    const depois = sim.cargoSlots;
    expect(depois).toBeGreaterThan(base);
    expect(sim.concederCarga('loja_carga_1')).toBe(false);
    expect(sim.cargoSlots).toBe(depois);
  });

  it('id desconhecido é recusado, não guardado', () => {
    const sim = new Sim(createState(6));
    expect(sim.concederCarga('fonte_que_nao_existe')).toBe(false);
    expect(sim.state.cargaLiberada).not.toContain('fonte_que_nao_existe');
  });

  it('o depósito de recursos é separado e cresce junto (§29)', () => {
    const sim = new Sim(createState(7));
    expect(sim.resourceSlots).toBe(RECURSO_INICIAL);
    sim.concederCarga('universo_2');
    expect(sim.resourceSlots).toBeGreaterThan(RECURSO_INICIAL);
  });
});
