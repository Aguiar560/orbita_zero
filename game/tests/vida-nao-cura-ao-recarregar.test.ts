import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { SAVE_VERSION, createState, migrate } from '@sim/state';
import { WAVES_PER_SECTOR } from '@data/balance/curvas';

/**
 * Recarregar a página não pode curar a nave.
 *
 * ## O defeito, relatado pelo Rafael em 09/09
 *
 * "Estou no setor 2 na onda 2, com 70 de HP; se eu atualizar o navegador o meu
 * HP volta para 100% e inicia a onda 2 novamente."
 *
 * A vida do jogador vivia SÓ na cena. O boot remontava a cena e chamava
 * `refreshPlayer(true)`, que devolve a nave cheia. Era cura de graça, e a mais
 * barata do jogo: um F5, sem custo de tempo, de recurso ou de risco.
 *
 * ## E a regra que entrou no lugar
 *
 * Do mesmo relato: "ao concluir um setor o HP é totalmente recuperado para
 * iniciar o setor seguinte". Antes a vida atravessava os setores e só voltava
 * ao MORRER — ou seja, morrer de propósito era a forma de curar. Agora o
 * descanso é a recompensa de fechar o setor.
 *
 * A regra mora no `sim`, e não na cena, porque o caminho abstrato precisa da
 * mesma: se a cena curasse por conta própria, ficar offline curaria num ritmo
 * diferente de jogar.
 */

/** Leva a incursão até a última onda do setor, sem tocar na vida. */
function naUltimaOnda(sim: Sim): void {
  sim.state.run.wave = WAVES_PER_SECTOR + 1;
  sim.refreshEncounter();
}

describe('a vida entre ondas', () => {
  it('NÃO se recupera ao limpar uma onda comum', () => {
    /**
     * O contrapeso da regra abaixo. Se a onda curasse, o setor inteiro seria
     * uma sequência de descansos e a vida deixaria de ser um recurso.
     */
    const sim = new Sim(createState(1));
    sim.state.run.wave = 2;
    sim.refreshEncounter();
    sim.state.run.vidaFracao = 0.7;

    sim.completeEncounter();

    expect(sim.state.run.wave, 'era para ter avançado de onda').toBe(3);
    expect(sim.state.run.vidaFracao, 'limpar uma onda curou a nave').toBe(0.7);
  });

  it('mas se recupera INTEIRA ao concluir o setor', () => {
    const sim = new Sim(createState(1));
    naUltimaOnda(sim);
    sim.state.run.vidaFracao = 0.7;
    sim.state.run.escudoFracao = 0.1;

    sim.completeEncounter();

    expect(sim.state.run.wave, 'o setor caiu e a onda volta para 1').toBe(1);
    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.escudoFracao).toBe(1);
  });

  it('e morrer também devolve a nave inteira — vida E escudo', () => {
    // A vida já era devolvida; o escudo não, e ficaria preso no valor do
    // instante da morte. Duas frações, dois campos.
    const sim = new Sim(createState(1));
    sim.state.run.vidaFracao = 0;
    sim.state.run.escudoFracao = 0;

    sim.failEncounter();

    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.escudoFracao).toBe(1);
  });
});

describe('a vida ao recarregar a página', () => {
  it('atravessa o save, em vez de voltar cheia', () => {
    /**
     * É o teste do relato. A cena lê estas frações ao abrir
     * (`retomarVidaGuardada`) em vez de chamar `refreshPlayer(true)`, então o
     * que o save guarda é o que o jogador encontra.
     */
    const estado = createState(1);
    estado.run.sector = 2;
    estado.run.wave = 2;
    estado.run.vidaFracao = 0.7;
    estado.run.escudoFracao = 0.25;

    const depoisDoF5 = migrate({ ...estado, version: SAVE_VERSION });

    expect(depoisDoF5).toBeTruthy();
    expect(depoisDoF5!.run.vidaFracao, 'o F5 curou a nave').toBe(0.7);
    expect(depoisDoF5!.run.escudoFracao).toBe(0.25);
  });

  it('e um save antigo, sem as frações, entra com a nave cheia', () => {
    // Compatibilidade: quem tem save de antes desta mudança não pode aparecer
    // com a nave pela metade por causa de um campo ausente.
    const estado = createState(1) as Record<string, unknown>;
    delete (estado.run as Record<string, unknown>).vidaFracao;
    delete (estado.run as Record<string, unknown>).escudoFracao;

    const migrado = migrate({ ...estado, version: SAVE_VERSION });
    expect(migrado!.run.vidaFracao ?? 1).toBe(1);
    expect(migrado!.run.escudoFracao ?? 1).toBe(1);
  });
});
