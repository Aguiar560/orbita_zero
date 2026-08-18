import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState, migrate } from '@sim/state';
import { BOSSES } from '@data/bosses';
import { MISSOES, MISSAO_POR_ID, TIPO_DE_MISSAO } from '@data/missoes';
import {
  CONFIANCA_MAX, PERSONAGENS, PERSONAGEM_POR_ID, contatoDoChefe,
} from '@data/personagens';
import {
  confiancaDe, contatoDesbloqueado, requisitoSatisfeito, requisitosPendentes,
  sinalDoContato, textoDoRequisito,
} from '@sim/missoes';

/**
 * Contatos, confiança e requisitos declarativos.
 *
 * O que estes testes guardam é a ARQUITETURA que a tela pediu: que o requisito
 * seja resolvido num lugar só, que o chefe derrotado vire aliado sem estado
 * novo, e que a confiança seja do relacionamento e não da missão.
 */

describe('o elenco', () => {
  it('não tem id repetido e todo id é estável', () => {
    expect(new Set(PERSONAGENS.map((p) => p.id)).size).toBe(PERSONAGENS.length);
    // `char_` como prefixo é o que o §45 pede: id que não muda quando o nome
    // visual muda.
    for (const p of PERSONAGENS) expect(p.id.startsWith('char_'), p.id).toBe(true);
  });

  it('todo contato tem retrato, facção e cor', () => {
    for (const p of PERSONAGENS) {
      expect(p.retrato, p.id).toBeTruthy();
      expect(p.faccao, p.id).toBeTruthy();
      expect(p.cor, p.id).toMatch(/^#|^rgb/);
    }
  });

  /**
   * O ex-chefe existe DERIVADO do catálogo de chefes, não copiado.
   *
   * Se alguém renomear um chefe, o contato acompanha. Uma cópia divergiria em
   * silêncio e o jogador veria dois nomes para a mesma criatura.
   */
  it('todo contato de ex-chefe aponta para um chefe real', () => {
    const ids = new Set(BOSSES.map((b) => b.id));
    for (const p of PERSONAGENS) {
      if (p.deChefe) expect(ids.has(p.deChefe), `${p.id} → ${p.deChefe}`).toBe(true);
    }
  });

  it('o chefe conhece o contato que nasce dele', () => {
    const c = contatoDoChefe(BOSSES[0]!.id);
    expect(c).toBeDefined();
    expect(c!.deChefe).toBe(BOSSES[0]!.id);
    expect(c!.status).toBe('ex_chefe');
  });

  /** Missão sem dono não apareceria em tela nenhuma — some do jogo. */
  it('toda missão tem um contato existente como dono', () => {
    for (const m of MISSOES) {
      expect(m.giverId, `${m.id} sem giverId`).toBeTruthy();
      expect(PERSONAGEM_POR_ID.has(m.giverId!), `${m.id} → ${m.giverId}`).toBe(true);
    }
  });

  it('todo tipo de missão tem cor e glifo próprios', () => {
    // O §39 proíbe depender só de cor: cada tipo precisa de um glifo distinto.
    const glifos = Object.values(TIPO_DE_MISSAO).map((t) => t.glifo);
    expect(new Set(glifos).size).toBe(glifos.length);
    for (const m of MISSOES) {
      if (m.tipo) expect(TIPO_DE_MISSAO[m.tipo], m.id).toBeDefined();
    }
  });
});

describe('a conversão de chefe em aliado', () => {
  /**
   * O contato nasce do CÓDEX, que já registra quem caiu. Nenhum estado novo — e
   * é por isso que um save antigo, com chefes já derrotados, ganha os contatos
   * sem migração nenhuma.
   */
  it('o ex-chefe aparece assim que o códex registra a vitória', () => {
    const sim = new Sim(createState(1));
    const c = contatoDoChefe(BOSSES[0]!.id)!;

    expect(contatoDesbloqueado(sim.state, c)).toBe(false);
    sim.state.codex.push(BOSSES[0]!.id);
    expect(contatoDesbloqueado(sim.state, c)).toBe(true);
  });

  it('save antigo com chefe derrotado já traz o contato', () => {
    const antigo = createState(2) as Record<string, unknown>;
    (antigo.codex as string[]).push(BOSSES[0]!.id);
    delete antigo.confianca;

    const migrado = migrate(JSON.parse(JSON.stringify(antigo)))!;
    const c = contatoDoChefe(BOSSES[0]!.id)!;
    expect(contatoDesbloqueado(migrado, c)).toBe(true);
    expect(migrado.confianca).toEqual({});
  });

  it('contato bloqueado aparece na lista, mas por último', () => {
    const sim = new Sim(createState(3));
    const lista = sim.contatos;
    // Some seria pior que silhueta: ver que há alguém a descobrir é metade da
    // razão de a coluna existir (§8).
    expect(lista.length).toBe(PERSONAGENS.length);
    const primeiroTravado = lista.findIndex((c) => !c.desbloqueado);
    const ultimoLivre = lista.map((c) => c.desbloqueado).lastIndexOf(true);
    expect(primeiroTravado).toBeGreaterThan(ultimoLivre - 1);
  });
});

describe('os requisitos declarativos (§17)', () => {
  it('cada tipo resolve contra o estado certo', () => {
    const sim = new Sim(createState(4));
    const s = sim.state;

    s.command.nivel = 30;
    expect(requisitoSatisfeito(s, { tipo: 'nivelPersonagem', valor: 25 }, 1)).toBe(true);
    expect(requisitoSatisfeito(s, { tipo: 'nivelPersonagem', valor: 31 }, 1)).toBe(false);

    expect(requisitoSatisfeito(s, { tipo: 'setorAlcancado', valor: 10 }, 12)).toBe(true);
    expect(requisitoSatisfeito(s, { tipo: 'setorAlcancado', valor: 10 }, 9)).toBe(false);

    // Galáxia CONCLUÍDA é ter PASSADO do último setor dela, não estar nela.
    expect(requisitoSatisfeito(s, { tipo: 'galaxiaConcluida', galaxia: 0 }, 10)).toBe(false);
    expect(requisitoSatisfeito(s, { tipo: 'galaxiaConcluida', galaxia: 0 }, 11)).toBe(true);

    s.codex.push('nucleo_ferrugem');
    expect(requisitoSatisfeito(s, { tipo: 'chefeDerrotado', chefeId: 'nucleo_ferrugem' }, 1)).toBe(true);
    expect(requisitoSatisfeito(s, { tipo: 'chefeDerrotado', chefeId: 'nao_existe' }, 1)).toBe(false);

    s.confianca.char_kael_voss = 3;
    expect(requisitoSatisfeito(s, { tipo: 'confianca', personagem: 'char_kael_voss', valor: 3 }, 1)).toBe(true);
    expect(requisitoSatisfeito(s, { tipo: 'confianca', personagem: 'char_kael_voss', valor: 4 }, 1)).toBe(false);
  });

  /** Card bloqueado precisa dizer o que falta — nunca parecer erro (§16). */
  it('todo requisito produz texto legível', () => {
    for (const m of MISSOES) {
      for (const r of m.requisitos ?? []) {
        const t = textoDoRequisito(r);
        expect(t, `${m.id}: ${r.tipo}`).toBeTruthy();
        expect(t).not.toContain('undefined');
      }
    }
  });

  it('mostra só os requisitos que ainda faltam', () => {
    const sim = new Sim(createState(5));
    const def = MISSAO_POR_ID.get('esp_coracao_ferrugem')!;
    expect(requisitosPendentes(sim.state, def, 1).length).toBe(2);

    sim.state.codex.push('nucleo_ferrugem');
    const faltam = requisitosPendentes(sim.state, def, 1);
    expect(faltam.length).toBe(1);
    expect(faltam[0]!.tipo).toBe('confianca');
  });
});

describe('a confiança', () => {
  it('sobe ao entregar e fica no teto', () => {
    const sim = new Sim(createState(6));
    const def = MISSAO_POR_ID.get('coleta_ferrita')!;
    expect(confiancaDe(sim.state, def.giverId!)).toBe(0);

    sim.guardarMaterial('ferrita', 500);
    sim.resgatarMissao(def.id);
    expect(confiancaDe(sim.state, def.giverId!)).toBe(def.confianca ?? 0);

    sim.state.confianca[def.giverId!] = 99;
    expect(confiancaDe(sim.state, def.giverId!)).toBe(CONFIANCA_MAX);
  });

  /**
   * A confiança é do RELACIONAMENTO, não da missão: some do catálogo uma missão
   * já entregue e o grau que ela ajudou a construir tem de permanecer.
   */
  it('sobrevive à missão que a gerou', () => {
    const sim = new Sim(createState(7));
    sim.state.confianca.char_zyrak = 3;
    delete sim.state.missoes.entrega_titanio;
    expect(confiancaDe(sim.state, 'char_zyrak')).toBe(3);
  });
});

describe('o sinal do contato (§8)', () => {
  it('pronta ganha de nova — entregar é o que dá para fazer agora', () => {
    const sim = new Sim(createState(8));
    const p = PERSONAGEM_POR_ID.get('char_kael_voss')!;

    // Nada feito ainda: há missões no zero, então "nova".
    expect(sinalDoContato(sim.state, p, sim.alcanceLiberado)).toBe('nova');

    // Completa uma: passa a "pronta", mesmo com outras ainda no zero.
    sim.guardarMaterial('ferrita', 500);
    expect(sinalDoContato(sim.state, p, sim.alcanceLiberado)).toBe('pronta');
  });

  it('contato travado sinaliza bloqueio', () => {
    const sim = new Sim(createState(9));
    const travado = PERSONAGENS.find((x) => x.requerChefe)!;
    expect(sinalDoContato(sim.state, travado, sim.alcanceLiberado)).toBe('bloqueado');
  });
});

describe('entregar tudo (§20)', () => {
  /**
   * O contrato ESPECIAL fica de fora do lote.
   *
   * Ele tem recompensa exclusiva e assinatura de um personagem; varrê-lo junto
   * com as rotineiras faria o jogador perder a única parte da missão feita para
   * ser vista.
   */
  it('não varre o contrato especial junto', () => {
    const sim = new Sim(createState(10));
    sim.setTestMode(true);
    sim.state.codex.push('nucleo_ferrugem');
    sim.state.confianca.char_nucleo_ferrugem = 1;

    // Deixa duas prontas: uma comum e o especial.
    sim.guardarMaterial('ferrita', 500);
    sim.registrar({ tipo: 'chefe', chefeId: 'nucleo_ferrugem', setor: 10 });

    const especial = MISSAO_POR_ID.get('esp_coracao_ferrugem')!;
    const antes = sim.missoes.filter((m) => m.situacao === 'pronta').length;
    expect(antes).toBeGreaterThanOrEqual(2);

    const n = sim.entregarTudo();
    expect(n).toBeGreaterThan(0);
    // O especial continua pronto, esperando entrega individual.
    expect(sim.state.missoes[especial.id]?.entregue).toBeFalsy();
    expect(sim.entregaveisEmLote).toBe(0);
  });
});
