/**
 * O modo de teste abre a Provação inteira — sem escrever nada.
 *
 * As duas metades importam igualmente. Abrir os cem pisos é o pedido; não
 * escrever é a regra do modo, e há cicatriz atrás dela: uma versão antiga
 * empurrava cascos para `fleet` e não os tirava, então quem ligasse o modo para
 * dar uma olhada ficava com o hangar inteiro no save de verdade.
 *
 * Um atalho que gravasse `pisoMax = 100` faria exatamente isso com a Provação.
 */

import { describe, expect, it } from 'vitest';

import { PROVACAO_PISOS } from '@data/provacao';
import { createState } from '@sim/state';
import { Sim } from '@sim/index';
import { TENTATIVAS_MAX, gastarTentativa, pisoLiberado, tentativasDisponiveis } from '@sim/provacao';

describe('modo de teste na Provação', () => {
  it('abre todos os pisos', () => {
    const st = createState(7);
    expect(pisoLiberado(st, 1), 'o primeiro é sempre acessível').toBe(true);
    expect(pisoLiberado(st, 50), 'sem o modo, o piso 50 está travado').toBe(false);

    st.settings.testMode = true;
    for (const piso of [1, 2, 50, PROVACAO_PISOS]) {
      expect(pisoLiberado(st, piso), `piso ${piso}`).toBe(true);
    }
  });

  it('continua recusando piso que não existe', () => {
    // O modo de teste solta as travas de PROGRESSO, não as de sanidade. Um piso
    // 0 ou 101 é entrada inválida, e responder `true` a ela empurraria o erro
    // para dentro do jogo em vez de pará-lo aqui.
    const st = createState(7);
    st.settings.testMode = true;
    expect(pisoLiberado(st, 0)).toBe(false);
    expect(pisoLiberado(st, PROVACAO_PISOS + 1)).toBe(false);
  });

  it('não cobra tentativa, e o contador mostra o teto', () => {
    const st = createState(7);
    st.settings.testMode = true;
    st.provacao.tentativas = 0;
    st.provacao.tentativasEm = Date.now();

    expect(tentativasDisponiveis(st), 'a tela lê daqui').toBe(TENTATIVAS_MAX);
    for (let i = 0; i < 10; i++) expect(gastarTentativa(st), `entrada ${i}`).toBe(true);
    expect(st.provacao.tentativas, 'nada foi gasto').toBe(0);
  });

  it('sem o modo, a tentativa continua sendo cobrada', () => {
    const st = createState(7);
    st.provacao.tentativas = 1;
    st.provacao.tentativasEm = Date.now();

    expect(gastarTentativa(st)).toBe(true);
    expect(st.provacao.tentativas).toBe(0);
    expect(gastarTentativa(st), 'sem estoque, recusa').toBe(false);
  });

  it('ligar e desligar devolve o save intacto', () => {
    // A afirmação que a cicatriz pede: o modo é uma LENTE, não uma escrita.
    const sim = new Sim(createState(7));
    const antes = JSON.parse(JSON.stringify(sim.state));

    sim.setTestMode(true);
    expect(pisoLiberado(sim.state, PROVACAO_PISOS)).toBe(true);
    sim.iniciarPisoDaProvacao(PROVACAO_PISOS);
    sim.falharPisoDaProvacao(PROVACAO_PISOS, { tempo: 1, danoCausado: 0, danoRecebido: 1 });
    sim.setTestMode(false);

    // `registrarTentativa` guarda o histórico da corrida, que é registro
    // legítimo — o que não pode ter mudado é o PROGRESSO.
    expect(sim.state.provacao.pisoMax, 'entrar no piso 100 não pode liberar o 100')
      .toBe(antes.provacao.pisoMax);
    expect(sim.state.provacao.tentativas, 'nenhuma tentativa gasta')
      .toBe(antes.provacao.tentativas);
    expect(sim.state.provacao.primeiraConclusao).toEqual(antes.provacao.primeiraConclusao);
    expect(pisoLiberado(sim.state, PROVACAO_PISOS), 'travado de novo ao desligar')
      .toBe(false);
  });
});
