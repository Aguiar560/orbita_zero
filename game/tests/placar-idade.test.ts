/**
 * O orçamento de progresso pela IDADE DA CONTA.
 *
 * Era o buraco documentado na conferência de marcas: a primeira marca não tinha
 * histórico contra o que ser comparada, então uma conta de dez minutos
 * declarava o andar 100 e liderava o placar.
 *
 * Agora o histórico existe, e é o relógio do próprio servidor. É a única
 * afirmação sobre plausibilidade que dá para fazer sem entender o formato do
 * save nem conhecer as curvas do jogo — e por isso não acopla o servidor a
 * mudanças de balanceamento.
 *
 * ## Os dois erros possíveis, e qual dói mais
 *
 * Recusar jogador legítimo dói mais que deixar passar um inflado: o legítimo
 * não tem como saber o que aconteceu, e o placar é opcional. Metade destes
 * testes existe para o lado do falso positivo.
 */

import { describe, expect, it } from 'vitest';

import { conferir } from '../server/src/placar';

const HORA = 3600;
const AGORA = 1_800_000_000;

/** Uma conta com N horas de vida no relógio do servidor. */
const contaCom = (horas: number): number => AGORA - horas * HORA;

const anterior = (valor: number, haHoras = 1) =>
  ({ valor, desempate: 0, atualizado_em: AGORA - haHoras * HORA });

describe('orçamento por idade da conta', () => {
  it('conta de dez minutos não declara o topo', () => {
    // O caso que isto existe para impedir: cria conta, manda andar 100, lidera.
    const v = conferir({ placar: 'provacao', valor: 100 }, null, AGORA, contaCom(1 / 6));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe('conta_nova_demais');
  });

  it('vale para toda marca, não só a primeira', () => {
    // Sem isto, bastaria firmar uma marca pequena e pular depois. A checagem de
    // ritmo mede o SALTO entre duas marcas; esta mede o total contra o tempo em
    // que a conta existe.
    const v = conferir({ placar: 'provacao', valor: 95 }, anterior(90), AGORA, contaCom(2));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toBe('conta_nova_demais');
  });

  describe('o lado do falso positivo', () => {
    it('quem jogou sem conta e só depois criou uma passa', () => {
      // O jogo funciona sem conta — o save mora no navegador. Alguém joga uma
      // semana e só então sincroniza: a marca é legítima e alta, com a conta
      // recém-nascida. Recusar puniria justamente quem jogou de verdade.
      const v = conferir({ placar: 'provacao', valor: 18 }, null, AGORA, contaCom(0.05));
      expect(v.ok, 'uma primeira semana forte cabe na entrada franqueada').toBe(true);
    });

    it('conta antiga não é limitada por isto', () => {
      // Um mês de conta comporta o topo. A partir daí quem manda é o ritmo.
      const v = conferir({ placar: 'provacao', valor: 100 }, anterior(99, 2), AGORA, contaCom(24 * 30));
      expect(v.ok).toBe(true);
    });

    it('progresso normal de quem joga todo dia passa', () => {
      // Três andares por dia, conta de duas semanas: bem dentro.
      const v = conferir({ placar: 'provacao', valor: 42 }, anterior(41, 3), AGORA, contaCom(24 * 14));
      expect(v.ok).toBe(true);
    });

    it('a entrada franqueada não chega ao topo de nenhum placar', () => {
      // É a afirmação que dá sentido ao número: generoso para a primeira
      // semana, e nunca suficiente para liderar.
      for (const [placar, topo] of [['provacao', 100], ['galaxia', 300], ['personagem', 300]] as const) {
        const v = conferir({ placar, valor: topo }, null, AGORA, contaCom(0));
        expect(v.ok, `${placar} no topo com conta recém-criada`).toBe(false);
      }
    });
  });

  it('a idade não substitui as outras checagens', () => {
    const velha = contaCom(24 * 365);
    // Fora de faixa continua fora.
    expect(conferir({ placar: 'provacao', valor: 101 }, null, AGORA, velha).ok).toBe(false);
    // Marca menor continua não rebaixando.
    expect(conferir({ placar: 'provacao', valor: 10 }, anterior(40), AGORA, velha).ok).toBe(false);
    // Salto rápido demais continua recusado.
    expect(conferir({ placar: 'provacao', valor: 90 }, anterior(1, 1), AGORA, velha).ok).toBe(false);
  });
});
