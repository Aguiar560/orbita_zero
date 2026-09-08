import { describe, expect, it } from 'vitest';
import { MISSAO_POR_ID, MISSOES } from '@data/missoes';
import { PERSONAGENS } from '@data/personagens';
import { confiancaDaMissao } from '@data/balance/confianca';
import { MISSOES_POR_CADEIA } from '@data/missoes-cadeias';
import { CONFIANCA_MAX } from '@data/personagens';
import { createState } from '@sim/state';
import { aplicarFato, missaoAceita, progressoDe, situacaoDe } from '@sim/missoes';
import { limiteDeMissoes } from '@sim/vip';
import type { FatoDeJogo } from '@sim/types';

/**
 * Só a missão ACEITA progride.
 *
 * Antes, toda missão liberada avançava ao mesmo tempo — o "rastrear" era um
 * pino decorativo que só decidia o que aparecia no HUD. O efeito era a escada
 * de confiança perder o sentido: **Kael Voss soma 8 de confiança para um teto
 * de 5**, então a barra enchia na quarta missão e as três últimas não valiam
 * nada. Medido em 07/09.
 *
 * Com quatro vagas (cinco no VIP), escolher QUAL caminho seguir volta a ser
 * decisão — que é o que a barra existe para medir.
 */

const abate = (): FatoDeJogo => ({
  tipo: 'abate', inimigo: 'x', elemento: 'padrao', chefe: false, setor: 1,
});

describe('aceitar a missão', () => {
  it('missão não aceita NÃO progride', () => {
    const state = createState(1);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;

    for (let i = 0; i < 250; i++) aplicarFato(state, abate(), 300);

    expect(missaoAceita(state, def.id)).toBe(false);
    expect(progressoDe(state, def).passos[0] ?? 0).toBe(0);
  });

  it('e a mesma missão progride depois de aceita', () => {
    const state = createState(1);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;
    state.settings.pinnedMissions.push(def.id);

    for (let i = 0; i < 250; i++) aplicarFato(state, abate(), 300);

    expect(progressoDe(state, def).passos[0]).toBe(def.objetivos[0]!.alvo);
  });

  it('e a liberada mas não aceita aparece como `disponivel`', () => {
    /**
     * A situação nova existe para a tela poder oferecer o aceite. Sem ela, a
     * missão por aceitar seria indistinguível da que já está em andamento.
     */
    const state = createState(1);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;
    expect(situacaoDe(state, def, 300)).toBe('disponivel');

    state.settings.pinnedMissions.push(def.id);
    expect(situacaoDe(state, def, 300)).toBe('ativa');
  });

  it('e abandonar NÃO zera o que já foi feito', () => {
    /**
     * A vaga é o recurso escasso, não o trabalho já feito. Retomar uma missão
     * e encontrar tudo zerado seria uma punição que ninguém avisou.
     */
    const state = createState(1);
    const def = MISSAO_POR_ID.get('elim_primeiros')!;
    state.settings.pinnedMissions.push(def.id);
    for (let i = 0; i < 3; i++) aplicarFato(state, abate(), 300);
    const feito = progressoDe(state, def).passos[0] ?? 0;
    expect(feito).toBeGreaterThan(0);

    state.settings.pinnedMissions = [];
    expect(progressoDe(state, def).passos[0]).toBe(feito);
  });

  it('e as vagas são quatro, ou cinco no VIP', () => {
    const state = createState(1);
    expect(limiteDeMissoes(state)).toBe(4);
    state.vip.expiresAt = Date.now() + 60_000;
    expect(limiteDeMissoes(state)).toBe(5);
  });
});

describe('a escada de confiança, medida', () => {
  it('o excesso que esta linha de base registrava ACABOU', () => {
    /**
     * Esta era a LINHA DE BASE do estrago, no sentido do `CLAUDE.md`: fixava
     * por escrito que três contatos estouravam o teto — Kael Voss somando 8
     * para um máximo de 5 —, para a correção ser visível quando viesse.
     *
     * Veio no mesmo dia. A confiança deixou de ser escrita à mão e passou a ser
     * derivada da posição na cadeia, normalizada para fechar exato no teto.
     *
     * O teste fica, invertido: agora ele guarda o conserto em vez de registrar
     * o defeito. A cobrança detalhada mora em `confianca-da-cadeia.test.ts`.
     */
    const soma = new Map<string, number>();
    for (const m of MISSOES) {
      if (!m.giverId) continue;
      soma.set(m.giverId, (soma.get(m.giverId) ?? 0) + confiancaDaMissao(m));
    }

    const excedem = [...soma].filter(([, n]) => n > CONFIANCA_MAX + 1e-9);
    expect(excedem, `contatos que estouram o teto: ${JSON.stringify(excedem)}`).toEqual([]);
    expect(soma.get('char_kael_voss')).toBeCloseTo(CONFIANCA_MAX, 6);
  });

  it('e todo contato COM missão tem a cadeia inteira', () => {
    /**
     * A linha de base anterior contava os contatos vazios — 29 de 33 em 07/09 —
     * e por isso mudava a cada cadeia escrita. Um número que muda a cada commit
     * não guarda nada: ele só obriga a editar o teste.
     *
     * O que vale guardar é o invariante: contato com missão tem cadeia
     * COMPLETA. Meia cadeia é pior que nenhuma — o jogador investe confiança
     * num contato que não tem como chegar ao fim.
     */
    const incompletos = PERSONAGENS
      .map((p) => [p.nome, MISSOES.filter((m) => m.giverId === p.id).length] as const)
      .filter(([, n]) => n > 0 && n < MISSOES_POR_CADEIA);

    expect(incompletos, `cadeias pela metade: ${JSON.stringify(incompletos)}`).toEqual([]);
  });
});
