import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { bus } from '@app/Bus';
import { sintetizar } from '@app/inventario';
import { RECEITAS } from '@data/balance/fusao';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';

/**
 * "Cliquei em FABRICAR e não aconteceu nada."
 *
 * ## As duas formas de a tela ficar muda
 *
 * 1. **O botão era `disabled`.** Um botão `disabled` não recebe clique nenhum
 *    — o navegador engole o evento antes de qualquer código rodar. Quem clica
 *    não ouve nada, e "não faz nada" vira a descrição literal do que acontece.
 *    O anel do Rafael tinha 8 peças e a receita pede 10; a única pista era uma
 *    linha de dica pequena ao lado do botão.
 * 2. **A recusa do servidor virava `null`.** `sintetizar` devolvia `null` em
 *    toda falha — 429, 409, rede fora — e o painel transformava `null` em
 *    nada. É o mesmo formato dos dois outros defeitos do dia: o custo não foi
 *    o erro, foi as horas até alguém entender qual era.
 *
 * O teste cobre as duas. A primeira pelo FONTE, porque não há DOM na suíte e o
 * que importa é o atributo escolhido, que é decisão e não comportamento.
 */

let calar = () => {};
const painel = readFileSync(new URL('../src/ui/panels/FabricacaoPanel.ts', import.meta.url), 'utf8');

const ouvirToast = (): string[] => {
  const ditos: string[] = [];
  calar = bus.on('toast', (t) => { ditos.push(t.text); });
  return ditos;
};

describe('o botão FABRICAR', () => {
  it('nunca é `disabled` — senão o clique não chega para poder explicar', () => {
    const inicio = painel.indexOf("text: 'FABRICAR'");
    expect(inicio, 'o botão sumiu ou mudou de texto').toBeGreaterThan(0);
    const bloco = painel.slice(inicio - 400, inicio + 900);

    expect(bloco, 'um `disabled` volta a engolir o clique').not.toMatch(/(^|[^-])\bdisabled:/);
    expect(bloco, 'sem `aria-disabled` o leitor de tela perde a informação')
      .toContain("'aria-disabled'");
  });

  it('e quando não dá, o clique vira a explicação', () => {
    const inicio = painel.indexOf("text: 'FABRICAR'");
    const bloco = painel.slice(inicio, inicio + 1800);
    // A ordem importa: o `toast` tem de vir ANTES de qualquer `return` mudo.
    expect(bloco).toMatch(/if \(!pode\) \{ toast\(/);
  });
});

describe('a recusa do servidor chega ao jogador', () => {
  beforeEach(() => { vi.unstubAllGlobals(); calar(); });

  it('o limite de ritmo vira uma frase, e não silêncio', async () => {
    /**
     * O 429 é o caso REAL mais provável: nove rotas de escrita dividem o mesmo
     * balde de fichas, e a fusão é uma ação deliberada que cai no meio da
     * sincronização de fundo. Sem isto, ela some sem deixar rastro.
     */
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({ erro: 'rapido_demais' }),
    } as unknown as Response)));

    const ditos = ouvirToast();
    const r = await sintetizar(new Sim(createState(3)), ['a', 'b']);

    expect(r).toBeNull();
    expect(ditos).toHaveLength(1);
    expect(ditos[0]).toMatch(/segundos/i);
  });

  it('e uma recusa desconhecida também fala, dizendo que nada se perdeu', async () => {
    // A fusão é destrutiva. O silêncio deixa a dúvida no pior lugar possível:
    // "as dez peças foram embora sem me dar nada?".
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, json: async () => ({ erro: 'coisa_nova' }),
    } as unknown as Response)));

    const ditos = ouvirToast();
    await sintetizar(new Sim(createState(3)), ['a']);

    expect(ditos[0]).toContain('Nenhuma peça foi perdida');
  });

  it('e rede fora também, em vez de um clique morto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const ditos = ouvirToast();
    await sintetizar(new Sim(createState(3)), ['a']);

    expect(ditos).toHaveLength(1);
  });

  it('e o sucesso NÃO fala — aviso que aparece sempre deixa de ser aviso', async () => {
    const item = { uid: 'novo', baseId: 'reator_4', slot: 'reator', rarity: 1, ilvl: 30, affixes: [] };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ item, receita: 'comum', itens: [] }),
    } as unknown as Response)));

    const ditos = ouvirToast();
    const r = await sintetizar(new Sim(createState(3)), ['a']);

    expect(r?.item.uid).toBe('novo');
    expect(ditos).toHaveLength(0);
  });
});

describe('o aviso é VISÍVEL onde a ação acontece', () => {
  /**
   * O defeito mais caro do dia, e o mais simples.
   *
   * `.toasts` estava em `z-index: 40` e `.camada` em `60`. Toda tela sobreposta
   * — Fabricação, Loja, Baús, Provação, Modulação — desenhava o aviso ATRÁS de
   * si. Exatamente nas telas onde o jogador toma uma ação que pode ser
   * recusada, a recusa era invisível.
   *
   * Foi isso que fez a correção anterior parecer não ter funcionado: o clique
   * chegava, o aviso era emitido, e ninguém nunca o viu. Um aviso invisível é
   * pior que nenhum — dá a quem escreveu a impressão de que avisou.
   */
  const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

  const camadaDe = (seletor: string): number => {
    const i = css.indexOf(`\n${seletor} {`);
    expect(i, `${seletor} sumiu do CSS`).toBeGreaterThan(0);
    const bloco = css.slice(i, css.indexOf('}', i));
    const m = /z-index:\s*(\d+)/.exec(bloco);
    expect(m, `${seletor} ficou sem z-index`).not.toBeNull();
    return Number(m![1]);
  };

  it('o toast fica acima de toda tela sobreposta', () => {
    expect(camadaDe('.toasts')).toBeGreaterThan(camadaDe('.camada'));
  });

  it('e acima do tooltip do cockpit, que era o teto anterior', () => {
    expect(camadaDe('.toasts')).toBeGreaterThan(camadaDe('.game-tooltip'));
  });

  it('e continua sem roubar clique', () => {
    // Subir de camada sem isto transformaria a faixa dos avisos numa parede
    // invisível sobre o canto inferior da tela.
    const i = css.indexOf('\n.toasts {');
    expect(css.slice(i, css.indexOf('}', i))).toContain('pointer-events: none');
  });
});

describe('a receita', () => {
  it('pede dez peças no primeiro degrau — é o número que a dica precisa dizer', () => {
    // Fixa o que o Rafael encontrou: oito peças na mochila e um anel de dez.
    // Se o degrau mudar, a mensagem da tela muda junto e este teste avisa.
    expect(RECEITAS[0]!.quantidade).toBe(10);
    expect(RECEITAS.every((r) => r.quantidade > 0)).toBe(true);
  });
});
