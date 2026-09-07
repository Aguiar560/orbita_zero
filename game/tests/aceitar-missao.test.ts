import { describe, expect, it } from 'vitest';
import { MISSAO_POR_ID, MISSOES } from '@data/missoes';
import { PERSONAGENS } from '@data/personagens';
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
  it('registra o excesso que hoje existe por contato', () => {
    /**
     * LINHA DE BASE, e ela está QUEBRADA de propósito — no sentido do
     * `CLAUDE.md`: fixa por escrito o quanto o balanceamento está torto hoje,
     * para a correção ser visível quando vier.
     *
     * Kael Voss tem 7 missões que somam 8 de confiança para um teto de 5. Com
     * as vagas, o jogador não consegue mais fazer as sete de enfiada — mas o
     * excesso continua lá, e some quando as ~15 missões por contato entrarem e
     * a confiança por missão for redistribuída.
     *
     * Quando isso acontecer, este teste falha. Falhar aqui é sucesso: troque o
     * número pela faixa saudável em vez de apagar o teste.
     */
    const soma = new Map<string, number>();
    for (const m of MISSOES) {
      if (!m.giverId) continue;
      soma.set(m.giverId, (soma.get(m.giverId) ?? 0) + (m.confianca ?? 0));
    }

    const excedem = [...soma].filter(([, n]) => n > CONFIANCA_MAX);
    expect(excedem.length, `contatos que estouram o teto: ${JSON.stringify(excedem)}`).toBe(3);
    expect(soma.get('char_kael_voss')).toBe(8);
  });

  it('e a maioria dos contatos ainda não tem missão nenhuma', () => {
    // 29 de 33 em 07/09. É o buraco que as ~15 missões por contato preenchem.
    const comMissao = new Set(MISSOES.map((m) => m.giverId).filter(Boolean));
    expect(PERSONAGENS.length - comMissao.size).toBe(29);
  });
});
