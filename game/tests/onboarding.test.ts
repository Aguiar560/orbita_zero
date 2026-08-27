/**
 * O roteiro do passeio guiado.
 *
 * O que estes testes seguram não é o texto — é o roteiro não apontar para o
 * nada. Um passo com alvo errado não quebra o jogo: ele é PULADO em silêncio, e
 * o jogador simplesmente nunca fica sabendo daquela parte da tela. É o tipo de
 * defeito que ninguém reporta porque ninguém vê.
 */

import { describe, expect, it } from 'vitest';

import { PASSOS_DO_ONBOARDING } from '@data/onboarding';

/**
 * Os seletores que a interface principal expõe.
 *
 * Repetidos aqui à mão de propósito: o teste tem de falhar quando alguém
 * renomear uma classe do Shell, e uma lista derivada do próprio código
 * acompanharia a renomeação sem reclamar — que é justamente o que não se quer.
 *
 * Conferidos no jogo em 2026-08-27.
 */
const ALVOS_DA_TELA_PRINCIPAL = new Set([
  '.stage-wrap', '.anatomia', '.panel-host', '.resources',
  '.tabs', '.rail-left', '.perfil-botao', '.gear',
]);

describe('roteiro do onboarding', () => {
  it('todo alvo existe na tela principal', () => {
    // Um passo apontando para dentro de um painel de camada nunca funcionaria:
    // o guia roda sobre a tela principal, e o overlay estaria fechado.
    const orfaos = PASSOS_DO_ONBOARDING
      .filter((p) => p.alvo && !ALVOS_DA_TELA_PRINCIPAL.has(p.alvo))
      .map((p) => `${p.titulo}: ${p.alvo}`);
    expect(orfaos, orfaos.join(' · ')).toEqual([]);
  });

  it('o primeiro passo não tem alvo', () => {
    // Abrir com um recorte já apontando para algo assusta antes de explicar. O
    // primeiro passo diz o que é o guia e como sair dele.
    expect(PASSOS_DO_ONBOARDING[0]?.alvo).toBeUndefined();
  });

  it('nenhum alvo se repete', () => {
    // Dois passos no mesmo lugar leem como se o guia tivesse travado.
    const comAlvo = PASSOS_DO_ONBOARDING.map((p) => p.alvo).filter(Boolean);
    expect(new Set(comAlvo).size).toBe(comAlvo.length);
  });

  it('é curto o bastante para não ser pulado inteiro', () => {
    // Passeio longo é pulado, e aí se perdem também os passos que importavam.
    expect(PASSOS_DO_ONBOARDING.length).toBeLessThanOrEqual(10);
    expect(PASSOS_DO_ONBOARDING.length).toBeGreaterThanOrEqual(5);
  });

  it('o zoom é sutil', () => {
    // `transform: scale` não reflui, mas exagerar faz o alvo estourar o
    // container e cobrir o vizinho. Medido no jogo: acima de ~1.2 o painel da
    // direita passa por cima da Anatomia.
    for (const p of PASSOS_DO_ONBOARDING) {
      if (p.escala === undefined) continue;
      expect(p.escala, p.titulo).toBeGreaterThanOrEqual(1);
      expect(p.escala, p.titulo).toBeLessThanOrEqual(1.2);
    }
  });

  it('todo passo tem título e texto', () => {
    for (const p of PASSOS_DO_ONBOARDING) {
      expect(p.titulo.length, p.titulo).toBeGreaterThan(3);
      // Texto curto demais não explica; longo demais não é lido num balão.
      expect(p.texto.length, p.titulo).toBeGreaterThan(30);
      expect(p.texto.length, p.titulo).toBeLessThan(320);
    }
  });
});

describe('partes recolhidas da interface', () => {
  it('o passo da Anatomia exige que ela esteja aberta', () => {
    // A coluna recolhe, e recolhida ela é um talo: o recorte ficaria do tamanho
    // de nada e o balão explicaria algo que o jogador não vê. Foi exatamente o
    // que aconteceu — o passo 3 apareceu com o balão no centro e sem destaque
    // nenhum para quem jogava com a Anatomia fechada.
    const passo = PASSOS_DO_ONBOARDING.find((p) => p.alvo === '.anatomia');
    expect(passo, 'o passo da Anatomia sumiu do roteiro').toBeDefined();
    expect(passo?.exige).toBe('anatomia');
  });

  it('só quem recolhe declara exigência', () => {
    // Uma exigência a mais não quebra nada, mas mente sobre a tela: quem lê o
    // roteiro passa a achar que aquela parte também some, e escreve código para
    // um caso que não existe.
    const RECOLHEM = new Set(['.anatomia']);
    for (const p of PASSOS_DO_ONBOARDING) {
      if (!p.exige) continue;
      expect(RECOLHEM.has(p.alvo ?? ''), `${p.titulo} exige sem precisar`).toBe(true);
    }
  });
});
