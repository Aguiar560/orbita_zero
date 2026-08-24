import { describe, expect, it } from 'vitest';
import { DURACAO_EVENTO_MS, EVENTOS, MARCO_DOS_EVENTOS, eventoNoInstante } from '@data/eventos';
import { RECURSO_POR_ID } from '@data/recursos';
import { aplicarFatoAoEvento, progressoDoEvento } from '@sim/eventos';
import { createState } from '@sim/state';

describe('eventos e gases', () => {
  it('mapeia dez eventos exclusivos para dez gases sem repetição', () => {
    expect(EVENTOS).toHaveLength(10);
    expect(new Set(EVENTOS.map((e) => e.gas)).size).toBe(10);
    for (const e of EVENTOS) {
      const gas = RECURSO_POR_ID.get(e.gas);
      expect(gas?.familia, e.id).toBe('gas');
      expect(gas?.dropEstado, e.id).toBe('ativo');
      expect(gas?.origens, e.id).toEqual(['evento']);
    }
  });

  it('faz uma volta determinística de 72 horas por evento', () => {
    for (let i = 0; i < EVENTOS.length; i++) {
      const janela = eventoNoInstante(MARCO_DOS_EVENTOS + i * DURACAO_EVENTO_MS + 1);
      expect(janela.def.id).toBe(EVENTOS[i]!.id);
      expect(janela.fim - janela.inicio).toBe(DURACAO_EVENTO_MS);
    }
    expect(eventoNoInstante(MARCO_DOS_EVENTOS + EVENTOS.length * DURACAO_EVENTO_MS + 1).def.id).toBe(EVENTOS[0]!.id);
  });

  it('não progride antes do setor mínimo e persiste por ocorrência', () => {
    const agora = MARCO_DOS_EVENTOS + 1;
    const state = createState(1);
    const fato = { tipo: 'abate', inimigo: 'x', elemento: 'padrao', chefe: false, setor: 10 } as const;
    expect(aplicarFatoAoEvento(state, 1, fato, agora).mudou).toBe(false);
    expect(aplicarFatoAoEvento(state, 300, fato, agora).mudou).toBe(true);
    expect(progressoDoEvento(state, 300, agora).progresso).toBe(1);
    expect(progressoDoEvento(state, 300, agora + DURACAO_EVENTO_MS).progresso).toBe(0);
  });
});
