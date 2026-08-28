/**
 * Os limites de ritmo das rotas que faltavam.
 *
 * O balde protegia só o `/save`. `/marcas`, `/apelido` e `/placar` ficavam
 * abertos — e `/marcas` é a rota mais cara do servidor: uma chamada podia virar
 * oitenta leituras e oitenta escritas. Um cliente em laço, com defeito ou não,
 * queimava a cota diária de escrita do D1, que é COMPARTILHADA por todos os
 * jogadores.
 *
 * Precisa de conta para chamar, mas basta uma.
 */

import { describe, expect, it } from 'vitest';

import { BALDES, podeLer, podeUsar } from '../server/src/ritmo';

const agora = 1_800_000_000;
const balde = (fichas: number, haSegundos: number) => ({ fichas, em: agora - haSegundos });

describe('baldes por assunto', () => {
  it('conta nova começa cheia em todos', () => {
    // Quem acabou de criar conta precisa poder escolher um apelido e subir a
    // primeira marca sem esperar.
    for (const nome of Object.keys(BALDES) as (keyof typeof BALDES)[]) {
      expect(podeUsar(nome, null, agora).pode, nome).toBe(true);
    }
  });

  it('marcas: cabe o ritmo real, não cabe o laço', () => {
    // O cliente sobe marcas junto com o save, a cada 150s.
    const depoisDeUmCiclo = balde(BALDES.marcas.capacidade - 1, 150);
    expect(podeUsar('marcas', depoisDeUmCiclo, agora).pode, 'o ritmo normal passa').toBe(true);

    // O laço não: esgotado o balde, recusa.
    let b: { fichas: number; em: number } | null = null;
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      const v = podeUsar('marcas', b, agora);
      if (!v.pode) break;
      ok++;
      b = { fichas: v.fichasRestantes, em: agora };
    }
    expect(ok, 'a rajada tem teto').toBe(BALDES.marcas.capacidade);
  });

  it('apelido é mais apertado que marcas', () => {
    // Trocar de nome é raro; varrer nomes livres um por um, não deve ser fácil.
    expect(BALDES.apelido.refil).toBeGreaterThan(BALDES.marcas.refil);
    expect(BALDES.apelido.capacidade).toBeLessThanOrEqual(BALDES.marcas.capacidade);
  });

  it('recusar diz quanto falta', () => {
    // Sem o número o cliente só sabe "não" e volta a tentar em laço — que é o
    // que consome a cota de todos.
    const v = podeUsar('marcas', balde(0, 0), agora);
    expect(v.pode).toBe(false);
    if (!v.pode) {
      expect(v.esperar).toBeGreaterThan(0);
      expect(v.esperar).toBeLessThanOrEqual(BALDES.marcas.refil);
    }
  });

  it('ficar offline não vira crédito infinito', () => {
    const semana = 7 * 24 * 3600;
    let b: { fichas: number; em: number } | null = balde(0, semana);
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      const v = podeUsar('marcas', b, agora);
      if (!v.pode) break;
      ok++;
      b = { fichas: v.fichasRestantes, em: agora };
    }
    expect(ok).toBe(BALDES.marcas.capacidade);
  });
});

describe('limite de leitura do placar', () => {
  it('cabe o ritmo do painel e corta o laço', () => {
    // O painel busca a cada 20s com a tela aberta: três por minuto. O limite é
    // dez vezes isso, então uso normal nunca encosta nele.
    const u = `jogador-${Math.random()}`;
    let ok = 0;
    for (let i = 0; i < 200; i++) if (podeLer(u, agora)) ok++;
    expect(ok, 'a rajada tem teto').toBeLessThan(200);
    expect(ok, 'e o teto é generoso para uso real').toBeGreaterThanOrEqual(20);
  });

  it('um jogador não gasta a cota do outro', () => {
    // O balde é POR usuário. Sem isso, o primeiro a abrir o placar fecharia a
    // porta para todo mundo naquele isolado.
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    while (podeLer(a, agora)) { /* esgota o de A */ }
    expect(podeLer(b, agora), 'B não pode pagar pelo laço de A').toBe(true);
  });

  it('o tempo devolve fichas', () => {
    const u = `t-${Math.random()}`;
    while (podeLer(u, agora)) { /* esgota */ }
    expect(podeLer(u, agora)).toBe(false);
    expect(podeLer(u, agora + 60), 'um minuto depois, volta').toBe(true);
  });
});
