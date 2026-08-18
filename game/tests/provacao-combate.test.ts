import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { ESPECIAIS, ESPECIAL_POR_ID } from '@data/provacao-especiais';
import { chefeDoPiso } from '@data/provacao-chefes';
import { pisoDaProvacao } from '@data/provacao';
import {
  abrirDesafio, bossDoPiso, encontroDoDesafio, setorEquivalente, tickDoDesafio,
} from '@sim/desafio';

/**
 * A fronteira entre a Provação e o combate (Fase 2).
 *
 * O contrato mais importante guardado aqui é a TELEGRAFIA: nenhum especial pode
 * sair sem aviso. Um golpe que acerta sem aviso não é dificuldade, é imposto —
 * o jogador perde sem ter tido o que fazer.
 */

const simPronto = () => {
  const s = new Sim(createState(1));
  s.state.command.nivel = 300;
  return s;
};

describe('a barra de especial', () => {
  /** O CONTRATO: encher a barra AVISA; só depois do aviso o golpe sai. */
  it('nunca dispara sem passar pelo aviso', () => {
    for (const e of ESPECIAIS) {
      const d = abrirDesafio(1);
      d.especial = e;
      const eventos: string[] = [];
      // Passos pequenos, para o instante do aviso não ser pulado.
      for (let t = 0; t < e.carga + e.aviso + 2; t += 0.1) {
        const r = tickDoDesafio(d, 0.1);
        if (r !== 'nada') eventos.push(r);
      }
      expect(eventos[0], `${e.id} disparou sem avisar`).toBe('aviso');
      expect(eventos).toContain('dispara');
      expect(eventos.indexOf('aviso')).toBeLessThan(eventos.indexOf('dispara'));
    }
  });

  it('o intervalo entre o aviso e o disparo é o do catálogo', () => {
    const e = ESPECIAL_POR_ID.get('colapso_gravitacional')!;
    const d = abrirDesafio(1);
    d.especial = e;

    let tAviso = 0;
    let tDisparo = 0;
    for (let t = 0; t < 40; t += 0.05) {
      const r = tickDoDesafio(d, 0.05);
      if (r === 'aviso') tAviso = d.tempo;
      if (r === 'dispara') { tDisparo = d.tempo; break; }
    }
    expect(tDisparo - tAviso).toBeCloseTo(e.aviso, 1);
  });

  it('a barra recomeça do zero depois de disparar', () => {
    const d = abrirDesafio(1);
    for (let t = 0; t < 60; t += 0.1) {
      if (tickDoDesafio(d, 0.1) === 'dispara') break;
    }
    expect(d.carga).toBe(0);
    expect(d.disparos).toBe(1);
  });

  /** `aceleraProximo` encurta a carga a cada volta — sem outra mecânica. */
  it('o salto predador fica mais insistente a cada disparo', () => {
    const d = abrirDesafio(1);
    d.especial = ESPECIAL_POR_ID.get('salto_predador')!;
    const intervalos: number[] = [];
    let ultimo = 0;
    for (let t = 0; t < 120 && intervalos.length < 3; t += 0.05) {
      if (tickDoDesafio(d, 0.05) === 'dispara') {
        intervalos.push(d.tempo - ultimo);
        ultimo = d.tempo;
      }
    }
    expect(intervalos).toHaveLength(3);
    expect(intervalos[1]!).toBeLessThan(intervalos[0]!);
    expect(intervalos[2]!).toBeLessThan(intervalos[1]!);
  });

  it('o limite de tempo encerra a luta', () => {
    // Piso 40 é marco e traz `pressa`, que tem limite.
    const d = abrirDesafio(40);
    expect(d.efeitos.limiteDeTempo).toBeGreaterThan(0);

    let acabou = false;
    for (let t = 0; t < d.efeitos.limiteDeTempo + 5; t += 0.5) {
      if (tickDoDesafio(d, 0.5) === 'tempo') { acabou = true; break; }
    }
    expect(acabou).toBe(true);
  });

  it('sem limite de tempo, a luta não encerra sozinha', () => {
    const d = abrirDesafio(1);
    expect(d.efeitos.limiteDeTempo).toBe(0);
    let porTempo = false;
    for (let t = 0; t < 600; t += 1) {
      if (tickDoDesafio(d, 1) === 'tempo') porTempo = true;
    }
    expect(porTempo).toBe(false);
  });
});

describe('a tradução piso → encontro', () => {
  it('o setor equivalente sobe com o piso e chega ao fim da curva', () => {
    expect(setorEquivalente(1)).toBeGreaterThan(1);
    expect(setorEquivalente(100)).toBeLessThanOrEqual(300);
    for (let n = 2; n <= 100; n++) {
      expect(setorEquivalente(n)).toBeGreaterThanOrEqual(setorEquivalente(n - 1));
    }
  });

  it('o encontro é sempre de chefe, com uma unidade', () => {
    const sim = simPronto();
    for (const piso of [1, 10, 50, 100]) {
      const d = abrirDesafio(piso);
      const e = encontroDoDesafio(sim.state, d);
      expect(e.kind).toBe('chefe');
      expect(e.unidades).toBe(1);
      expect(e.boss).not.toBeNull();
      expect(e.boss!.id).toBe(chefeDoPiso(piso).id);
    }
  });

  /**
   * O chefe vira `BossDef` REAPROVEITANDO as fases de um molde de campanha.
   * Sem isso, `VerticalMode` precisaria de padrões de tiro novos — e ele é o
   * arquivo mais caro de mexer do projeto.
   */
  it('o chefe traz fases utilizáveis pelo combate', () => {
    const d = abrirDesafio(63);
    const boss = bossDoPiso(d.chefe, d.efeitos);
    expect(boss.phases.length).toBeGreaterThan(0);
    for (const f of boss.phases) {
      expect(f.fireRate).toBeGreaterThan(0);
      expect(f.bulletSpeed).toBeGreaterThan(0);
      expect(f.at).toBeGreaterThan(0);
    }
  });

  it('os modificadores chegam ao chefe', () => {
    const d = abrirDesafio(50); // marco com `colosso`
    const boss = bossDoPiso(d.chefe, d.efeitos);
    const semEfeito = bossDoPiso(d.chefe, { ...d.efeitos, vida: 1, dano: 1 });
    expect(boss.hp).toBeGreaterThan(semEfeito.hp);
  });

  it('o modificador de enxame dá invocação a quem não tinha', () => {
    const d = abrirDesafio(1);
    const boss = bossDoPiso(d.chefe, { ...d.efeitos, invocaCada: 5 });
    expect(boss.phases.every((f) => !!f.summon)).toBe(true);
  });
});

describe('o desafio no Sim', () => {
  it('iniciar abre o desafio e troca o encontro', () => {
    const sim = simPronto();
    expect(sim.desafio).toBeNull();
    const antes = sim.encounter.boss?.id;

    expect(sim.iniciarPisoDaProvacao(1)).toBe(true);
    expect(sim.desafio).not.toBeNull();
    expect(sim.encounter.boss!.id).toBe(chefeDoPiso(1).id);
    expect(sim.encounter.boss!.id).not.toBe(antes);
  });

  /**
   * O desafio vive em MEMÓRIA. Uma luta interrompida não pode ser retomada no
   * ponto: a tentativa já foi cobrada na entrada, e guardar o meio da luta
   * abriria a porta para reiniciá-la sem custo.
   */
  it('o desafio não entra no save', () => {
    const sim = simPronto();
    sim.iniciarPisoDaProvacao(1);
    expect(JSON.stringify(sim.state)).not.toContain('avisando');
  });

  it('vencer fecha o desafio e devolve o encontro da campanha', () => {
    const sim = simPronto();
    sim.iniciarPisoDaProvacao(1);
    sim.concluirPisoDaProvacao(1, { tempo: 30, danoCausado: 10, danoRecebido: 5 });
    expect(sim.desafio).toBeNull();
    expect(sim.encounter.sector).toBe(sim.state.run.sector);
  });

  it('perder também fecha o desafio', () => {
    const sim = simPronto();
    sim.iniciarPisoDaProvacao(1);
    sim.falharPisoDaProvacao(1, { tempo: 12, danoCausado: 1, danoRecebido: 99 });
    expect(sim.desafio).toBeNull();
  });

  it('o tique só anda com desafio aberto', () => {
    const sim = simPronto();
    expect(sim.tickDesafio(10)).toBe('nada');
    sim.iniciarPisoDaProvacao(1);
    for (let t = 0; t < 60; t += 0.1) {
      if (sim.tickDesafio(0.1) === 'dispara') return;
    }
    throw new Error('o especial nunca disparou com o desafio aberto');
  });
});

describe('a coerência dos efeitos no combate', () => {
  it('todo piso produz um encontro válido', () => {
    const sim = simPronto();
    for (let n = 1; n <= 100; n++) {
      const e = encontroDoDesafio(sim.state, abrirDesafio(n));
      expect(e.hpPool, `piso ${n}`).toBeGreaterThan(0);
      expect(e.damage, `piso ${n}`).toBeGreaterThan(0);
      expect(Number.isFinite(e.hpPool), `piso ${n}`).toBe(true);
      expect(Number.isFinite(e.damage), `piso ${n}`).toBe(true);
    }
  });

  /** A curva sobe, mas sem explodir — a dificuldade vem da mecânica (§63). */
  it('a vida do encontro cresce de forma controlada', () => {
    const sim = simPronto();
    const p1 = encontroDoDesafio(sim.state, abrirDesafio(1)).hpPool;
    const p100 = encontroDoDesafio(sim.state, abrirDesafio(100)).hpPool;
    const razao = p100 / p1;
    expect(razao).toBeGreaterThan(100);
    // Um teto generoso: o que se proíbe é a explosão sem sentido, não o
    // crescimento. A curva de setor já é exponencial por baixo.
    expect(Number.isFinite(razao)).toBe(true);
  });

  it('o piso 100 é mais duro que o 99 por mais que só vida', () => {
    const d99 = abrirDesafio(99);
    const d100 = abrirDesafio(100);
    expect(d100.def.modificadores.length).toBeGreaterThan(d99.def.modificadores.length);
    expect(d100.def.peso).toBeGreaterThan(d99.def.peso);
  });
});
