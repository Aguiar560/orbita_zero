import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState, migrate } from '@sim/state';
import { pisoDaProvacao } from '@data/provacao';
import {
  FRACAO_REPETICAO, TENTATIVAS_MAX, TENTATIVA_INTERVALO,
  camadasAPagar, estadoDoPiso, gastarTentativa, pisoLiberado,
  segundosParaProximaTentativa, tentativasDisponiveis,
} from '@sim/provacao';

/**
 * Progressão do Núcleo de Provação — Fase 1.
 *
 * O que estes testes guardam são as três promessas mais caras de quebrar:
 * a recompensa de primeira conclusão não pode pagar duas vezes (§74), o
 * checkpoint não pode regredir (§8, §75) e save antigo não pode travar (§76).
 */

/** Um Sim com nível alto, para o requisito de nível não mascarar o teste. */
const simPronto = (semente: number) => {
  const s = new Sim(createState(semente));
  s.state.command.nivel = 300;
  return s;
};

describe('o desbloqueio e o checkpoint (§8, §75)', () => {
  it('só o piso 1 abre num save novo', () => {
    const sim = new Sim(createState(1));
    expect(pisoLiberado(sim.state, 1)).toBe(true);
    expect(pisoLiberado(sim.state, 2)).toBe(false);
  });

  it('um save novo consegue iniciar o piso 1', () => {
    const sim = new Sim(createState(101));
    expect(sim.iniciarPisoDaProvacao(1)).toBe(true);
    expect(sim.desafio?.piso).toBe(1);
    expect(sim.provacaoTentativas.tem).toBe(TENTATIVAS_MAX - 1);
  });

  /** O cenário literal do §75. */
  it('vencido o 37, abre o 38 — e não o 39', () => {
    const sim = simPronto(2);
    sim.state.provacao.pisoMax = 37;

    for (let n = 1; n <= 37; n++) {
      expect(pisoLiberado(sim.state, n), `piso ${n} deveria estar aberto`).toBe(true);
    }
    expect(pisoLiberado(sim.state, 38)).toBe(true);
    expect(pisoLiberado(sim.state, 39)).toBe(false);
  });

  it('nunca se recomeça do piso 1', () => {
    const sim = simPronto(3);
    sim.state.provacao.pisoMax = 40;
    // Perder não devolve ninguém ao começo.
    sim.falharPisoDaProvacao(41, { tempo: 30, danoCausado: 10, danoRecebido: 99 });
    expect(sim.state.provacao.pisoMax).toBe(40);
    expect(pisoLiberado(sim.state, 40)).toBe(true);
  });

  it('os cinco estados do §10 aparecem onde devem', () => {
    const sim = simPronto(4);
    sim.state.provacao.pisoMax = 10;
    expect(estadoDoPiso(sim.state, 5)).toBe('vencido');
    expect(estadoDoPiso(sim.state, 11)).toBe('atual');
    expect(estadoDoPiso(sim.state, 12)).toBe('travado');

    sim.state.provacao.mestrados.push(5);
    expect(estadoDoPiso(sim.state, 5)).toBe('mestrado');
  });

  it('o requisito de nível trava mesmo com o checkpoint em dia', () => {
    const sim = new Sim(createState(5));
    sim.state.command.nivel = 1;
    sim.state.provacao.pisoMax = 50;
    // O piso 50 pede nível bem acima de 1.
    expect(pisoLiberado(sim.state, 50)).toBe(false);
  });
});

describe('as tentativas por período', () => {
  /**
   * Começa CHEIO: a primeira coisa que o jogador faz ao abrir o modo não pode
   * ser esperar.
   */
  it('um save novo começa com o estoque cheio', () => {
    expect(tentativasDisponiveis(createState(6))).toBe(TENTATIVAS_MAX);
  });

  it('gastar reduz, e não passa de zero', () => {
    const s = createState(7);
    for (let i = 0; i < TENTATIVAS_MAX; i++) expect(gastarTentativa(s)).toBe(true);
    expect(tentativasDisponiveis(s)).toBe(0);
    expect(gastarTentativa(s)).toBe(false);
  });

  /**
   * A recuperação é DERIVADA DO RELÓGIO, não incrementada por tique. Um contador
   * de tique para de contar quando a aba fecha — e este é um jogo idle, onde a
   * aba fica fechada a maior parte do tempo.
   */
  it('recupera com o tempo, inclusive de aba fechada', () => {
    const s = createState(8);
    const t0 = Date.now();
    for (let i = 0; i < TENTATIVAS_MAX; i++) gastarTentativa(s, t0);
    expect(tentativasDisponiveis(s, t0)).toBe(0);

    const umaDepois = t0 + TENTATIVA_INTERVALO * 1000 + 1000;
    expect(tentativasDisponiveis(s, umaDepois)).toBe(1);

    const muitoDepois = t0 + TENTATIVA_INTERVALO * 1000 * 50;
    expect(tentativasDisponiveis(s, muitoDepois)).toBe(TENTATIVAS_MAX);
  });

  it('a conta regressiva zera quando o estoque está cheio', () => {
    const s = createState(9);
    expect(segundosParaProximaTentativa(s)).toBe(0);
    gastarTentativa(s);
    expect(segundosParaProximaTentativa(s)).toBeGreaterThan(0);
  });

  it('não deixa iniciar sem tentativa', () => {
    const sim = simPronto(10);
    for (let i = 0; i < TENTATIVAS_MAX; i++) expect(sim.iniciarPisoDaProvacao(1)).toBe(true);
    expect(sim.iniciarPisoDaProvacao(1)).toBe(false);
  });

  /** Cobrar na entrada: fechar a aba no meio não pode ser jogar de graça. */
  it('cobra a tentativa ao INICIAR, não ao perder', () => {
    const sim = simPronto(11);
    const antes = tentativasDisponiveis(sim.state);
    sim.iniciarPisoDaProvacao(1);
    expect(tentativasDisponiveis(sim.state)).toBe(antes - 1);

    const depois = tentativasDisponiveis(sim.state);
    sim.falharPisoDaProvacao(1, { tempo: 20, danoCausado: 5, danoRecebido: 90 });
    expect(tentativasDisponiveis(sim.state)).toBe(depois);
  });

  it('piso travado não consome tentativa', () => {
    const sim = simPronto(12);
    const antes = tentativasDisponiveis(sim.state);
    expect(sim.iniciarPisoDaProvacao(30)).toBe(false);
    expect(tentativasDisponiveis(sim.state)).toBe(antes);
  });
});

describe('a recompensa em três camadas (§21–23)', () => {
  it('a primeira vez paga "primeira", a segunda paga "repeticao"', () => {
    const sim = simPronto(13);
    expect(camadasAPagar(sim.state, 1)).toEqual(['primeira']);
    sim.state.provacao.primeiraConclusao.push(1);
    expect(camadasAPagar(sim.state, 1)).toEqual(['repeticao']);
  });

  it('o marco paga uma camada a mais, e só uma vez', () => {
    const sim = simPronto(14);
    expect(camadasAPagar(sim.state, 10)).toEqual(['primeira', 'marco']);
    sim.state.provacao.primeiraConclusao.push(10);
    sim.state.provacao.marcos.push(10);
    expect(camadasAPagar(sim.state, 10)).toEqual(['repeticao']);
  });

  /**
   * TESTE CRÍTICO do §74.
   *
   * Recarregar, morrer, fechar o modal ou salvar e carregar não pode pagar a
   * recompensa de primeira conclusão outra vez. A garantia é a ordem — marca
   * antes de entregar — e a pergunta feita contra o SAVE.
   */
  it('a primeira conclusão NUNCA paga duas vezes', () => {
    const sim = simPronto(15);
    const def = pisoDaProvacao(1);

    const primeira = sim.concluirPisoDaProvacao(1, { tempo: 40, danoCausado: 100, danoRecebido: 10 });
    expect(primeira).toContain('primeira');
    const sucataApos1 = sim.state.resources.sucata;

    // Repetir o mesmo piso paga só a fração.
    const segunda = sim.concluirPisoDaProvacao(1, { tempo: 35, danoCausado: 120, danoRecebido: 5 });
    expect(segunda).toEqual(['repeticao']);
    const ganhoDaRepeticao = sim.state.resources.sucata - sucataApos1;
    expect(ganhoDaRepeticao).toBeLessThan(def.recompensa.sucata);
    expect(ganhoDaRepeticao).toBeCloseTo(Math.round(def.recompensa.sucata * FRACAO_REPETICAO), 0);

    // E sobrevive a salvar/carregar.
    const migrado = migrate(JSON.parse(JSON.stringify(sim.state)))!;
    expect(camadasAPagar(migrado, 1)).toEqual(['repeticao']);
  });

  it('o marco sobrevive a salvar e carregar', () => {
    const sim = simPronto(16);
    sim.state.provacao.pisoMax = 9;
    sim.concluirPisoDaProvacao(10, { tempo: 60, danoCausado: 500, danoRecebido: 50 });
    const migrado = migrate(JSON.parse(JSON.stringify(sim.state)))!;
    expect(migrado.provacao.marcos).toContain(10);
    expect(camadasAPagar(migrado, 10)).toEqual(['repeticao']);
  });

  /** Repetir um piso não pode ser a melhor fonte de equipamento do jogo. */
  it('a repetição não dá item nem medalha', () => {
    const sim = simPronto(17);
    sim.state.provacao.pisoMax = 9;
    sim.concluirPisoDaProvacao(10, { tempo: 60, danoCausado: 1, danoRecebido: 1 });

    const itensApos1 = sim.state.stats.itemsFound;
    const medalhasApos1 = sim.state.medalhas;
    sim.concluirPisoDaProvacao(10, { tempo: 60, danoCausado: 1, danoRecebido: 1 });

    expect(sim.state.stats.itemsFound).toBe(itensApos1);
    expect(sim.state.medalhas).toBe(medalhasApos1);
  });
});

describe('os registros (§27)', () => {
  it('guarda o MELHOR tempo, não o último', () => {
    const sim = simPronto(18);
    sim.concluirPisoDaProvacao(1, { tempo: 50, danoCausado: 10, danoRecebido: 1 });
    sim.concluirPisoDaProvacao(1, { tempo: 30, danoCausado: 20, danoRecebido: 2 });
    sim.concluirPisoDaProvacao(1, { tempo: 90, danoCausado: 5, danoRecebido: 9 });
    expect(sim.state.provacao.registros[1]!.melhorTempo).toBe(30);
  });

  it('conta as tentativas, inclusive as perdidas', () => {
    const sim = simPronto(19);
    sim.falharPisoDaProvacao(1, { tempo: 10, danoCausado: 1, danoRecebido: 9 });
    sim.falharPisoDaProvacao(1, { tempo: 12, danoCausado: 2, danoRecebido: 9 });
    sim.concluirPisoDaProvacao(1, { tempo: 40, danoCausado: 9, danoRecebido: 1 });
    expect(sim.state.provacao.registros[1]!.tentativas).toBe(3);
  });

  it('a derrota não cria primeira vitória', () => {
    const sim = simPronto(20);
    sim.falharPisoDaProvacao(1, { tempo: 10, danoCausado: 1, danoRecebido: 9 });
    expect(sim.state.provacao.registros[1]!.primeiraEm).toBe(0);
    expect(sim.state.provacao.pisoMax).toBe(0);
  });
});

describe('o save (§56, §76)', () => {
  it('save SEM o campo carrega com os padrões seguros', () => {
    const antigo = createState(21) as Record<string, unknown>;
    delete antigo.provacao;

    const migrado = migrate(JSON.parse(JSON.stringify(antigo)));
    expect(migrado).not.toBeNull();
    expect(migrado!.provacao.pisoMax).toBe(0);
    expect(migrado!.provacao.primeiraConclusao).toEqual([]);
    expect(migrado!.provacao.marcos).toEqual([]);
    expect(migrado!.provacao.registros).toEqual({});
  });

  /** Save da versão anterior, que só tinha três campos. */
  it('save com o campo INCOMPLETO ganha o que falta sem perder o que tem', () => {
    const antigo = createState(22) as unknown as Record<string, unknown>;
    antigo.provacao = { pisoMax: 12, tentativas: 2, vitorias: 7 };

    const m = migrate(JSON.parse(JSON.stringify(antigo)))!;
    expect(m.provacao.pisoMax).toBe(12);
    expect(m.provacao.vitorias).toBe(7);
    expect(m.provacao.primeiraConclusao).toEqual([]);
    expect(m.provacao.mestrados).toEqual([]);
  });

  it('save adulterado nos campos de lista não trava o boot', () => {
    const antigo = createState(23) as unknown as Record<string, unknown>;
    antigo.provacao = { pisoMax: 3, primeiraConclusao: 'nada', marcos: 42, registros: 7 };
    const m = migrate(JSON.parse(JSON.stringify(antigo)))!;
    expect(m.provacao.primeiraConclusao).toEqual([]);
    expect(m.provacao.marcos).toEqual([]);
    expect(m.provacao.registros).toEqual({});
  });
});

describe('a tela de resultado (§30–§33)', () => {
  /**
   * Repetir um piso NÃO libera nada.
   *
   * A primeira versão lia `pisoMax` depois de atualizá-lo, e por isso toda
   * repetição anunciava "liberado o piso seguinte" — uma mentira que o jogador
   * descobriria abrindo a tela e não achando o piso.
   */
  it('só anuncia liberação quando o piso era novo', () => {
    const sim = simPronto(30);
    sim.state.provacao.pisoMax = 9;

    sim.concluirPisoDaProvacao(10, { tempo: 60, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.proximoPiso).toBe(11);

    sim.concluirPisoDaProvacao(10, { tempo: 55, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.proximoPiso).toBe(0);
  });

  it('as camadas chegam ao resultado', () => {
    const sim = simPronto(31);
    sim.state.provacao.pisoMax = 9;
    sim.concluirPisoDaProvacao(10, { tempo: 60, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.camadas).toEqual(['primeira', 'marco']);
    expect(sim.resultadoProvacao!.venceu).toBe(true);
  });

  /**
   * Recorde é NOVO só quando havia um anterior para bater. A primeira vitória
   * já é comemorada por si; anunciá-la também como recorde diluiria as duas.
   */
  it('a primeira vitória não conta como recorde', () => {
    const sim = simPronto(32);
    sim.concluirPisoDaProvacao(1, { tempo: 40, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.recorde).toBe(false);

    sim.concluirPisoDaProvacao(1, { tempo: 25, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.recorde).toBe(true);
    expect(sim.resultadoProvacao!.recordeAnterior).toBe(40);

    sim.concluirPisoDaProvacao(1, { tempo: 90, danoCausado: 10, danoRecebido: 1 });
    expect(sim.resultadoProvacao!.recorde).toBe(false);
  });

  it('a derrota traz o quanto faltou', () => {
    const sim = simPronto(33);
    sim.falharPisoDaProvacao(1, { tempo: 30, danoCausado: 5, danoRecebido: 99 }, 0.42);
    const r = sim.resultadoProvacao!;
    expect(r.venceu).toBe(false);
    expect(r.vidaRestanteDoChefe).toBe(0.42);
    expect(r.ganhos.itens).toBe(0);
  });

  /** A dica aponta o PROBLEMA, não a solução — o §16 quer experimentação. */
  it('a dica nunca entrega a resposta', () => {
    const sim = simPronto(34);
    for (let piso = 1; piso <= 100; piso += 7) {
      sim.falharPisoDaProvacao(piso, { tempo: 10, danoCausado: 1, danoRecebido: 9 });
      const d = sim.resultadoProvacao!.dica ?? '';
      // Nunca manda usar um elemento específico.
      expect(d.toLowerCase(), `piso ${piso}`).not.toMatch(/use |equipe |troque para/);
    }
  });
});
