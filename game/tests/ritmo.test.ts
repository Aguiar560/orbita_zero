/**
 * O ritmo de gravação, e o defeito que ele conserta.
 *
 * A regra anterior era um intervalo fixo de 120s. Ela protegia a cota da camada
 * gratuita e perdia até dois minutos de jogo em toda troca de máquina, porque a
 * gravação de FIM DE SESSÃO cai exatamente nessa janela.
 */

import { describe, expect, it } from 'vitest';

import { FICHAS_MAX, INTERVALO_DE_REFIL, podeGravar, repor } from '../server/src/ritmo';

const balde = (fichas: number, haSegundos: number, agora: number) =>
  ({ fichas, em: agora - haSegundos });

describe('ritmo de gravação', () => {
  const agora = 1_800_000_000;

  it('conta nova começa com o balde cheio', () => {
    // Sem isto, a primeira gravação de quem acabou de criar conta esperaria
    // dois minutos — e o jogador não teria como saber por quê.
    expect(repor(null, agora)).toBe(FICHAS_MAX);
    expect(podeGravar(null, agora)).toEqual({ pode: true, fichasRestantes: FICHAS_MAX - 1 });
  });

  it('a gravação de fim de sessão passa — era o defeito', () => {
    // O caso exato do relato: entra, joga 90s, fecha a aba. Com o intervalo
    // fixo isso era 429 e os 90 segundos sumiam ao abrir em outra máquina.
    const aposEntrar = balde(FICHAS_MAX - 1, 90, agora);
    const v = podeGravar(aposEntrar, agora);
    expect(v.pode, 'fechar a aba 90s depois de entrar tem de gravar').toBe(true);
  });

  it('duas gravações seguidas passam, três esgotam', () => {
    // A rajada é o ponto do balde. O que ela NÃO pode é ser infinita.
    let b: { fichas: number; em: number } | null = null;
    let fichas = FICHAS_MAX;
    for (let i = 0; i < FICHAS_MAX; i++) {
      const v = podeGravar(b, agora);
      expect(v.pode, `gravação ${i + 1}`).toBe(true);
      if (v.pode) { fichas = v.fichasRestantes; b = { fichas, em: agora }; }
    }
    expect(podeGravar(b, agora).pode, 'a quarta seguida é recusada').toBe(false);
  });

  it('recusar diz quanto falta esperar', () => {
    // Sem o número o cliente só sabe "não", e volta a tentar em laço — que é o
    // que consome a cota de todo mundo.
    const v = podeGravar(balde(0, 0, agora), agora);
    expect(v.pode).toBe(false);
    if (!v.pode) {
      expect(v.esperar).toBeGreaterThan(0);
      expect(v.esperar).toBeLessThanOrEqual(INTERVALO_DE_REFIL);
    }
  });

  it('o balde não passa da capacidade', () => {
    // Ficar uma semana offline não pode virar crédito para gravar mil vezes.
    expect(repor(balde(0, 7 * 24 * 3600, agora), agora)).toBe(FICHAS_MAX);
  });

  it('a taxa média continua sendo uma gravação por intervalo', () => {
    // É o que faz a conta da camada gratuita fechar. O balde muda a RAJADA
    // permitida, não o custo médio.
    let b = { fichas: 0, em: agora };
    let gravacoes = 0;
    // uma hora, tentando a cada 10s
    for (let t = 0; t <= 3600; t += 10) {
      const v = podeGravar(b, agora + t);
      if (v.pode) { gravacoes++; b = { fichas: v.fichasRestantes, em: agora + t }; }
    }
    const esperado = 3600 / INTERVALO_DE_REFIL;
    expect(gravacoes, `~${esperado} por hora`).toBeLessThanOrEqual(esperado + FICHAS_MAX);
  });
});
