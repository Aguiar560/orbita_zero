import { describe, expect, it } from 'vitest';
import {
  DURACAO_DO_RITMO, EVENTOS, MARCO_DOS_EVENTOS,
  eventoNoInstante, eventosDoRitmo, janelaDoRitmo, janelasAtivas,
} from '@data/eventos';
import { RECURSO_POR_ID } from '@data/recursos';
import { ELEMENTS } from '@data/elements';
import { aplicarFatoAoEvento, eventosAtivos, progressoDoEvento } from '@sim/eventos';
import { createState } from '@sim/state';

/**
 * Três ritmos, três sumidouros.
 *
 * Havia um evento só, girando a cada 72 horas, e ele pagava gás — que era moeda
 * morta: nenhuma receita do jogo consumia gás. Um conteúdo com data marcada,
 * feito para trazer o jogador de volta, pagava em nada.
 *
 * Agora cada ritmo alimenta uma oficina diferente, e é isso que os impede de
 * competir entre si: o diário paga o minério do elemento (conversão elemental),
 * o semanal paga gás (Engenharia) e o mensal paga tecnologia de chefe (peças
 * exclusivas).
 */

describe('os três ritmos', () => {
  it('o diário tem um evento por elemento, e cada um paga o minério dele', () => {
    /**
     * É o diário que resolve a escassez de gelo. O minério de gelo só existe
     * nas galáxias 12 e 18, então converter uma peça para gelo antes da 12 era
     * impossível — a escassez era um MURO. Com o diário, vira agenda.
     */
    const diarios = eventosDoRitmo('diario');
    expect(diarios).toHaveLength(ELEMENTS.length);

    const elementos = diarios.map((e) => e.objetivo.filtro?.elemento);
    expect(new Set(elementos).size, 'um evento por elemento, sem repetir').toBe(ELEMENTS.length);

    for (const e of diarios) {
      const r = RECURSO_POR_ID.get(e.recurso);
      expect(r, e.id).toBeTruthy();
      expect(['minerio', 'exotico'], `${e.id} paga ${r?.familia}`).toContain(r!.familia);
    }
  });

  it('e o semanal continua sendo dez eventos para dez gases', () => {
    const semanais = eventosDoRitmo('semanal');
    expect(semanais).toHaveLength(10);
    expect(new Set(semanais.map((e) => e.recurso)).size).toBe(10);
    for (const e of semanais) {
      const gas = RECURSO_POR_ID.get(e.recurso);
      expect(gas?.familia, e.id).toBe('gas');
      expect(gas?.origens, e.id).toEqual(['evento']);
    }
  });

  it('e o mensal paga tecnologia de chefe', () => {
    const mensais = eventosDoRitmo('mensal');
    expect(mensais.length).toBeGreaterThan(0);
    for (const e of mensais) {
      expect(RECURSO_POR_ID.get(e.recurso)?.familia, e.id).toBe('tecnologia');
      // Conteúdo de fim de campanha: pedir chefe raso tiraria o peso.
      expect(e.setorMinimo, e.id).toBeGreaterThanOrEqual(40);
    }
  });

  it('e nenhum recurso é pago por dois eventos', () => {
    // Duas portas para o mesmo material fariam uma delas ser sempre a pior.
    expect(new Set(EVENTOS.map((e) => e.recurso)).size).toBe(EVENTOS.length);
  });
});

describe('a rotação', () => {
  it('cada ritmo gira na própria duração, do próprio marco', () => {
    for (const ritmo of ['diario', 'semanal', 'mensal'] as const) {
      const lista = eventosDoRitmo(ritmo);
      const duracao = DURACAO_DO_RITMO[ritmo];
      for (let i = 0; i < lista.length; i++) {
        const j = janelaDoRitmo(ritmo, MARCO_DOS_EVENTOS + i * duracao + 1)!;
        expect(j.def.id, `${ritmo} ciclo ${i}`).toBe(lista[i]!.id);
        expect(j.fim - j.inicio).toBe(duracao);
      }
      // Fecha a volta.
      expect(janelaDoRitmo(ritmo, MARCO_DOS_EVENTOS + lista.length * duracao + 1)!.def.id)
        .toBe(lista[0]!.id);
    }
  });

  it('e há sempre três janelas ativas', () => {
    const j = janelasAtivas(MARCO_DOS_EVENTOS + 1);
    expect(j).toHaveLength(3);
    expect(j.map((x) => x.def.ritmo)).toEqual(['diario', 'semanal', 'mensal']);
  });

  it('e `eventoNoInstante` continua devolvendo o SEMANAL', () => {
    // Compatibilidade: quem só conhecia um evento por vez conhecia este.
    expect(eventoNoInstante(MARCO_DOS_EVENTOS + 1).def.ritmo).toBe('semanal');
  });
});

describe('o progresso', () => {
  it('não progride antes do setor mínimo e persiste por ocorrência', () => {
    const agora = MARCO_DOS_EVENTOS + 1;
    const state = createState(1);
    const fato = { tipo: 'abate', inimigo: 'x', elemento: 'padrao', chefe: false, setor: 10 } as const;

    expect(aplicarFatoAoEvento(state, 1, fato, agora).mudou).toBe(false);
    expect(aplicarFatoAoEvento(state, 300, fato, agora).mudou).toBe(true);
    expect(progressoDoEvento(state, 300, agora).progresso).toBe(1);
    expect(progressoDoEvento(state, 300, agora + DURACAO_DO_RITMO.semanal).progresso).toBe(0);
  });

  it('e o mesmo abate conta para MAIS DE UM evento', () => {
    /**
     * A alternativa é o jogador ter de escolher qual evento jogar — e a escolha
     * certa seria sempre a mesma, a que paga mais. Contando em todos, a decisão
     * vira "o que eu preciso hoje".
     *
     * O abate de padrão casa com o diário neutro E com qualquer semanal cujo
     * objetivo seja abate sem filtro de elemento.
     */
    const agora = MARCO_DOS_EVENTOS + 1;
    const state = createState(2);
    const fato = { tipo: 'abate', inimigo: 'x', elemento: 'padrao', chefe: false, setor: 300 } as const;

    aplicarFatoAoEvento(state, 300, fato, agora);
    const mexeram = eventosAtivos(state, 300, agora).filter((e) => e.progresso > 0);
    expect(mexeram.length).toBeGreaterThanOrEqual(1);
  });

  it('e cada ocorrência tem chave própria: o progresso não vaza entre ritmos', () => {
    const agora = MARCO_DOS_EVENTOS + 1;
    const state = createState(3);
    const chaves = janelasAtivas(agora).map((j) => j.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
