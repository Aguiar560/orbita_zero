/**
 * O roteiro do passeio guiado.
 *
 * O que estes testes seguram não é o texto — é o roteiro não apontar para o
 * nada. Um passo com alvo errado não quebra o jogo: ele é PULADO em silêncio, e
 * o jogador simplesmente nunca fica sabendo daquela parte da tela. É o tipo de
 * defeito que ninguém reporta porque ninguém vê.
 */

import { describe, expect, it } from 'vitest';

import { passosDoOnboarding } from '@data/onboarding';
import type { PassoDoTour } from '@ui/Tour';

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
  '.tabs', '.rail-left', '.rail-control', '.perfil-botao', '.gear',
]);

/**
 * O roteiro deixou de ser constante.
 *
 * A partir do nível 15 o controle manual virou benefício VIP, e o guia é
 * reabrível por Ajustes — ou seja, ele NÃO é lido só no nível 1. O passo dos
 * modos passou a ter duas redações, e as regras de estrutura precisam valer
 * para as duas: é fácil corrigir uma variante e esquecer a outra, e a esquecida
 * é justamente a que ninguém abre durante o desenvolvimento.
 */
const VARIANTES: [string, readonly PassoDoTour[]][] = [
  ['manual liberado', passosDoOnboarding(true)],
  ['manual só com VIP', passosDoOnboarding(false)],
];

describe.each(VARIANTES)('roteiro do onboarding (%s)', (_nome, PASSOS_DO_ONBOARDING) => {
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

describe.each(VARIANTES)('partes recolhidas da interface (%s)', (_nome, PASSOS_DO_ONBOARDING) => {
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

describe.each(VARIANTES)('o guia não mente sobre os dois modos (%s)', (_nome, PASSOS_DO_ONBOARDING) => {
  /**
   * O jogo TEM pilotagem manual — `settings.controlMode` alterna entre `idle` e
   * `manual`, e há dois botões no trilho da esquerda.
   *
   * O roteiro dizia "Você não pilota", o que é falso e caro: quem acredita joga
   * o jogo inteiro assistindo, sem descobrir metade dele. Estes testes existem
   * porque a frase errada não quebra nada — ela só ensina a coisa errada.
   */
  it('nenhum passo nega a pilotagem', () => {
    const negacoes = [/você não pilota/i, /não dá para pilotar/i, /100% idle/i, /totalmente idle/i];
    for (const p of PASSOS_DO_ONBOARDING) {
      for (const frase of negacoes) {
        expect(frase.test(p.texto), `${p.titulo}: "${p.texto}"`).toBe(false);
      }
    }
  });

  it('existe um passo sobre os botões de modo', () => {
    const passo = PASSOS_DO_ONBOARDING.find((p) => p.alvo === '.rail-control');
    expect(passo, 'o passo dos modos sumiu do roteiro').toBeDefined();
    // Os dois nomes que estão nos botões, para o jogador ligar texto e tela.
    expect(passo?.texto).toMatch(/IDLE/);
    expect(passo?.texto).toMatch(/PILOTAR/);
  });

  it('o trilho vem antes dos botões que moram dentro dele', () => {
    // Explicar o botão antes do painel que o contém faz o jogador procurar
    // depois onde aquilo ficava.
    const ondeEsta = (alvo: string) => PASSOS_DO_ONBOARDING.findIndex((p) => p.alvo === alvo);
    expect(ondeEsta('.rail-left')).toBeLessThan(ondeEsta('.rail-control'));
  });
});

describe('o passo dos modos acompanha o que a tela permite', () => {
  /**
   * O texto fixo prometia "PILOTAR passa a nave para você" a todo mundo. Depois
   * do passe VIP isso passou a ser mentira para uma parte real dos jogadores:
   * no nível 15 sem VIP o botão existe, aparece e está DESLIGADO. Prometer o
   * que a tela nega é pior do que não explicar — o jogador clica, não acontece
   * nada, e conclui que o jogo está quebrado.
   */
  const dosModos = (manual: boolean) =>
    passosDoOnboarding(manual).find((p) => p.alvo === '.rail-control')!;

  it('bloqueado, o guia diz por que o botão não responde', () => {
    expect(dosModos(false).texto).toMatch(/VIP/);
    expect(dosModos(false).texto).toMatch(/15/);
  });

  it('liberado, o guia não vende nada', () => {
    // Quem chega no nível 1 tem o modo manual em mãos. Enfiar o passe VIP no
    // primeiro minuto de jogo troca uma explicação por um anúncio.
    expect(dosModos(true).texto).not.toMatch(/VIP/);
  });

  it('as duas redações nomeiam os dois botões', () => {
    for (const manual of [true, false]) {
      expect(dosModos(manual).texto).toMatch(/IDLE/);
      expect(dosModos(manual).texto).toMatch(/PILOTAR/);
    }
  });
});

describe('o caminho para rever o guia', () => {
  /**
   * O botão existe desde o começo, e mesmo assim veio a pergunta "como eu vejo
   * o tutorial de novo?". Duas causas, e as duas são de projeto:
   *
   * 1. Ele estava na aba **Dados**, ao lado de exportar e apagar save. Ninguém
   *    procura tutorial na gaveta do backup.
   * 2. Ao clicar, Ajustes NÃO fechava — o guia abria atrás do modal e apontava
   *    para coisas escondidas. O botão emitia `panel:close`, que fecha CAMADAS,
   *    e Ajustes é MODAL: o evento passava reto, sem erro nenhum.
   */
  it('o botão vive na primeira aba de Ajustes', async () => {
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync('src/ui/panels/SettingsPanel.ts', 'utf8'));

    const jogo = fonte.indexOf('private jogo(');
    const video = fonte.indexOf('private video(');
    const abrirGuia = fonte.indexOf('Rever o guia do jogo');

    expect(abrirGuia, 'o botão sumiu').toBeGreaterThan(0);
    expect(abrirGuia > jogo && abrirGuia < video,
      'o botão saiu da primeira aba').toBe(true);
  });

  it('o botão fecha o MODAL, não a camada', async () => {
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync('src/ui/panels/SettingsPanel.ts', 'utf8'));
    const i = fonte.indexOf('Rever o guia do jogo');
    const trecho = fonte.slice(i, i + 700);

    expect(trecho).toContain("bus.emit('ajustes:fechar')");
    expect(trecho).toContain("bus.emit('guia:abrir')");
    // `panel:close` aqui é o defeito antigo voltando: ele não alcança um modal.
    expect(trecho).not.toContain("bus.emit('panel:close')");
  });

  it('o modal de Ajustes escuta o pedido de fechar', async () => {
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync('src/ui/Shell.ts', 'utf8'));
    expect(fonte, 'sem o ouvinte, o botão não fecha nada')
      .toContain("bus.on('ajustes:fechar'");
  });
});
