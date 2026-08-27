/**
 * O portão de admin: modo de teste e Laboratório.
 *
 * Com testers, "modo de teste" ao lado de volume e contraste vira armadilha: a
 * seção não avisa que muda o jogo inteiro, e o primeiro relato seria de alguém
 * descrevendo recursos infinitos e nave indestrutível sem saber que foi ele
 * quem ligou.
 *
 * A parte que os testes seguram é a SAÍDA: esconder o interruptor sem desligar
 * o modo prenderia no modo quem já entrou nele.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = { valor: null as null | { usuarioId: string; email: string } };

vi.mock('@app/conta', () => ({
  sessaoGuardada: () => sessao.valor,
}));
vi.mock('@data/servidor', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ADMINS: ['admin-1', 'admin-2'],
}));

const { ehAdmin, desligarModoDeTesteSeNaoForAdmin } = await import('@app/admin');

const settings = (testMode: boolean, speed = 4) => ({ testMode, speed });

beforeEach(() => { sessao.valor = null; });

describe('portão de admin', () => {
  it('sem conta não é admin', () => {
    // O jogo roda inteiro sem conta, e quem joga assim é jogador comum.
    expect(ehAdmin()).toBe(false);
  });

  it('conta comum não é admin', () => {
    sessao.valor = { usuarioId: 'tester-9', email: 'tester@exemplo.com' };
    expect(ehAdmin()).toBe(false);
  });

  it('conta da lista é admin', () => {
    sessao.valor = { usuarioId: 'admin-2', email: 'eu@exemplo.com' };
    expect(ehAdmin()).toBe(true);
  });

  describe('saída do modo de teste', () => {
    it('desliga para quem não é admin', () => {
      // O caso real: um save que já circula com `testMode: true`. Sem isto o
      // jogador ficaria com recursos infinitos e sem o interruptor para sair.
      sessao.valor = { usuarioId: 'tester-9', email: 't@e.com' };
      const s = settings(true);
      expect(desligarModoDeTesteSeNaoForAdmin(s), 'mudou algo').toBe(true);
      expect(s.testMode).toBe(false);
      // A velocidade acelerada é parte do modo e sai junto.
      expect(s.speed).toBe(1);
    });

    it('não mexe no jogo de quem é admin', () => {
      sessao.valor = { usuarioId: 'admin-1', email: 'eu@e.com' };
      const s = settings(true);
      expect(desligarModoDeTesteSeNaoForAdmin(s)).toBe(false);
      expect(s.testMode).toBe(true);
      expect(s.speed, 'a velocidade do admin é dele').toBe(4);
    });

    it('não mexe em quem já estava fora do modo', () => {
      // Sem esta guarda, abrir o jogo zeraria a velocidade de todo mundo a cada
      // entrada — um efeito colateral sem relação nenhuma com o modo de teste.
      sessao.valor = { usuarioId: 'tester-9', email: 't@e.com' };
      const s = settings(false, 3);
      expect(desligarModoDeTesteSeNaoForAdmin(s), 'nada a fazer').toBe(false);
      expect(s.speed).toBe(3);
    });

    it('sair da conta tira o acesso', () => {
      sessao.valor = { usuarioId: 'admin-1', email: 'eu@e.com' };
      expect(ehAdmin()).toBe(true);
      sessao.valor = null;
      expect(ehAdmin(), 'sem sessão, sem ferramenta').toBe(false);
      const s = settings(true);
      expect(desligarModoDeTesteSeNaoForAdmin(s)).toBe(true);
    });
  });
});
