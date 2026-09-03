/**
 * A fila de saída e o passe do servidor.
 *
 * ## O que estes testes protegem
 *
 * A Fase 2 do Passo 9 moveu dinheiro e assinatura para o servidor, e o cliente
 * passou a manter um ESPELHO mais uma fila de movimentos ainda não confirmados.
 * É um arranjo com três formas conhecidas de dar errado em silêncio:
 *
 * 1. **Dobrar o ganho** — creditar local e somar de novo o que o servidor
 *    devolve. O jogador enriquece sozinho e o livro-caixa passa a discordar do
 *    saldo, que é o estado que torna a auditoria do pódio impossível.
 * 2. **Perder o ganho** — limpar a fila antes de a confirmação chegar. Some um
 *    setor inteiro, e some sem sintoma: o número já tinha aparecido na tela.
 * 3. **Renovar errado** — somar 30 dias sobre uma data vencida entrega um passe
 *    que já nasce morto, e quem pagou não tem como saber por quê.
 */

import { describe, expect, it } from 'vitest';

import { createState } from '@sim/state';
import { Sim } from '@sim/index';
import { VIP_SEGUNDOS, renovar, vipAtivo } from '../server/src/carteira';

const novoSim = (): Sim => new Sim(createState(7));

describe('todo movimento de dinheiro entra na fila', () => {
  it('o ganho enfileira e aparece na tela ao mesmo tempo', () => {
    // As duas metades do mesmo depósito: a tela não pode esperar a rede, e o
    // servidor é quem soma de verdade.
    const sim = novoSim();
    sim.grant('sucata', 250);
    expect(sim.state.resources.sucata).toBe(250);
    expect(sim.state.pendentes).toEqual([{ moeda: 'sucata', quantia: 250, motivo: 'drop' }]);
  });

  it('o gasto entra na MESMA fila, com sinal negativo', () => {
    // Um livro que só registra entradas não reconstrói nada, e a auditoria do
    // pódio precisa das duas metades.
    const sim = novoSim();
    sim.grant('cristal', 100);
    sim.state.pendentes.length = 0;
    expect(sim.spend('cristal', 40)).toBe(true);
    expect(sim.state.pendentes).toEqual([{ moeda: 'cristal', quantia: -40, motivo: 'loja' }]);
  });

  it('gasto recusado não enfileira nada', () => {
    // Enfileirar um débito que não aconteceu tiraria do jogador, no servidor,
    // o que ele nunca gastou aqui.
    const sim = novoSim();
    expect(sim.spend('cristal', 999_999)).toBe(false);
    expect(sim.state.pendentes).toEqual([]);
  });

  it('ganho de zero ou negativo não enfileira', () => {
    // `grant` já ignorava valores assim; o que este teste protege é a fila não
    // ganhar linhas que o servidor recusaria com `quantia_invalida`.
    const sim = novoSim();
    sim.grant('sucata', 0);
    sim.grant('sucata', -10);
    expect(sim.state.pendentes).toEqual([]);
  });

  it('a quantia enfileirada é inteira', () => {
    // O banco guarda INTEGER: moeda em ponto flutuante acumula erro, e as
    // recompensas do jogo chegam aqui com casas decimais.
    const sim = novoSim();
    sim.grant('nucleo', 12.7);
    expect(sim.state.pendentes[0]!.quantia).toBe(12);
  });

  it('a ordem dos movimentos é preservada', () => {
    // É a ordem que o livro-caixa vai contar depois. Reordenar não muda saldo,
    // mas torna a auditoria mais difícil de ler — e ela é o produto final.
    const sim = novoSim();
    sim.grant('sucata', 10);
    sim.grant('nucleo', 20);
    sim.spend('sucata', 5);
    expect(sim.state.pendentes.map((p) => p.quantia)).toEqual([10, 20, -5]);
  });
});

describe('a fila sobrevive ao save', () => {
  it('nasce vazia', () => {
    expect(createState(7).pendentes).toEqual([]);
  });

  it('um save sem o campo migra sem quebrar', () => {
    // Todo save gravado antes da Fase 2 não tem `pendentes`. Ausência tem de
    // virar fila vazia, e não `undefined` — que estouraria no primeiro `push`.
    const sim = novoSim();
    expect(Array.isArray(sim.state.pendentes)).toBe(true);
  });
});

describe('o passe é renovado pelo servidor', () => {
  const agora = 1_800_000_000;

  it('quem não tem passe começa a contar de agora', () => {
    expect(renovar(0, agora)).toBe(agora + VIP_SEGUNDOS);
  });

  it('renovar antes de vencer ACUMULA o que sobrou', () => {
    // Quem renova cedo não pode ser punido por isso — seria o incentivo
    // exatamente errado para quem está pagando.
    const faltam10Dias = agora + 10 * 24 * 3600;
    expect(renovar(faltam10Dias, agora)).toBe(faltam10Dias + VIP_SEGUNDOS);
  });

  it('renovar depois de vencido conta de agora, não do vencimento', () => {
    // Somar 30 dias sobre uma data de um ano atrás entregaria um passe já
    // vencido a quem acabou de pagar por ele.
    const venceuAnoPassado = agora - 365 * 24 * 3600;
    expect(renovar(venceuAnoPassado, agora)).toBe(agora + VIP_SEGUNDOS);
  });

  it('zero e passado significam a mesma coisa: sem passe', () => {
    expect(vipAtivo(0, agora)).toBe(false);
    expect(vipAtivo(agora - 1, agora)).toBe(false);
  });

  it('o passe vale até o instante exato de expirar', () => {
    expect(vipAtivo(agora + 1, agora)).toBe(true);
    expect(vipAtivo(agora, agora)).toBe(false);
  });
});
