import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MINERIOS_POR_ELEMENTO, minerioParaItem } from '@data/balance/minerio-elemental';
import { OPERACOES_DE_MODULACAO, custoDeModulacao } from '@data/balance/modulacao';
import { ELEMENTS } from '@data/elements';
import type { Item } from '@sim/types';

/**
 * O terceiro ingrediente da Engenharia: o minério do elemento da peça.
 *
 * Dos 70 recursos, 49 caíam sem ter onde ser gastos — 27 deles minério de
 * galáxia. Da galáxia 2 até a 24, quase tudo que o jogador minerava era peso
 * morto (medido em 07/09 com `npm run recursos`).
 *
 * Agora toda modulação pede três coisas: núcleos, a essência da operação e o
 * minério do elemento da peça. A essência continua dizendo QUAL ferramenta; o
 * minério diz QUANTO custa usá-la naquela peça.
 */

const peca = (rarity: number, ilvl: number, tier: number, element: string): Item => ({
  uid: 'x', base: 'b', name: 'n', icon: 'i', slot: 'principal', rarity, ilvl, element,
  affixes: [{ id: 'a', label: 'l', kind: 'add', value: 1, tier }],
} as unknown as Item);

const remoldar = OPERACOES_DE_MODULACAO.find((o) => o.id === 'remoldar')!;

describe('o minério que cada elemento pede', () => {
  it('todo elemento do jogo tem pelo menos um minério', () => {
    /**
     * A garantia que permite `minerioParaItem` nunca devolver `null` na
     * prática. Se uma galáxia nova entrar com um elemento sem minério, ou um
     * elemento novo nascer sem galáxia, é aqui que aparece — antes de a
     * Engenharia cobrar um ingrediente inexistente.
     */
    for (const el of ELEMENTS) {
      expect(MINERIOS_POR_ELEMENTO[el.id]?.length ?? 0, `elemento ${el.id}`).toBeGreaterThan(0);
    }
  });

  it('e o nível da peça escolhe a galáxia, não uma lista fixa', () => {
    /**
     * Um elemento tem de dois a oito minérios. Fixar um por elemento deixaria
     * 24 materiais mortos do mesmo jeito, com nome mais bonito.
     */
    const raso = minerioParaItem('fogo', 20);
    const fundo = minerioParaItem('fogo', 250);
    expect(raso).not.toBe(fundo);
    expect(fundo).toBe('aco_estelar');
  });

  it('e uma peça rasa demais cai no minério mais barato do elemento', () => {
    // Gelo só existe nas galáxias 12 e 18. Uma peça de gelo nível 5 não fica
    // sem ingrediente — fica com o mais raso, que ainda é escasso para ela.
    expect(minerioParaItem('gelo', 5)).toBe(MINERIOS_POR_ELEMENTO.gelo![0]!.id);
  });
});

describe('o custo de modular', () => {
  it('cobra os TRÊS: núcleos, essência e minério', () => {
    const c = custoDeModulacao(peca(3, 120, 5, 'gelo'), remoldar, 0);
    expect(c.nucleos).toBeGreaterThan(0);
    expect(c.quantidade).toBeGreaterThan(0);
    expect(c.minerio).toBe('cromita');
    expect(c.quantidadeDeMinerio).toBeGreaterThan(0);
  });

  it('e um afixo T10 custa mais que um T1 — em núcleos E em minério', () => {
    /**
     * Pedido do Rafael, e um buraco real: a fórmula antiga olhava raridade e
     * nível e ignorava o tier. Remoldar a MELHOR linha de uma peça custava o
     * mesmo que remoldar a pior, e quem já chegou ao topo pagava o preço de
     * quem está começando.
     */
    const t1 = custoDeModulacao(peca(6, 250, 1, 'fogo'), remoldar, 0);
    const t10 = custoDeModulacao(peca(6, 250, 10, 'fogo'), remoldar, 0);

    expect(t10.nucleos).toBeGreaterThan(t1.nucleos);
    expect(t10.quantidadeDeMinerio).toBeGreaterThan(t1.quantidadeDeMinerio);
    // 12% por degrau: a T10 sai ~2,08× a T1, e não dez vezes.
    expect(t10.nucleos / t1.nucleos).toBeGreaterThan(1.9);
    expect(t10.nucleos / t1.nucleos).toBeLessThan(2.3);
  });

  it('e o protocolo mais poderoso custa mais minério que o mais simples', () => {
    // "Quanto mais poderoso o craft, mais recursos" — o peso da operação entra
    // por `custoEssencia`, que já é a medida de quão forte cada uma é.
    const aperfeicoar = OPERACOES_DE_MODULACAO.find((o) => o.id === 'primordial')!;
    const alvo = peca(6, 250, 10, 'fogo');
    expect(custoDeModulacao(alvo, aperfeicoar, 0).quantidadeDeMinerio)
      .toBeGreaterThan(custoDeModulacao(alvo, remoldar, 0).quantidadeDeMinerio);
  });

  it('e o minério escala menos que os núcleos, de propósito', () => {
    /**
     * O minério vem do chão da galáxia — 6 a 12 por setor. Se escalasse como os
     * núcleos, uma peça divina T10 pediria centenas de unidades e a ferramenta
     * viraria proibição em vez de decisão. O teto é ~3 setores de farm.
     */
    const c = custoDeModulacao(peca(6, 250, 10, 'fogo'), remoldar, 0);
    expect(c.quantidadeDeMinerio).toBeLessThan(50);
  });

  it('e a recalibração duplicada saiu do jogo', () => {
    /**
     * `recalibrateItemAffix` fazia exatamente o que o protocolo "Remoldar linha"
     * faz, por outra porta e com outra moeda — e nenhuma tela a chamava. Duas
     * implementações da mesma regra são o começo de duas regras diferentes.
     *
     * `recalibrateAffix` em `sim/loot.ts` CONTINUA: é ele que o Remoldar usa.
     */
    const sim = readFileSync(join(process.cwd(), 'src', 'sim', 'index.ts'), 'utf8');
    expect(sim).not.toContain('recalibrateItemAffix(');
    expect(sim).not.toContain('recalibrationPrice(');
    expect(existsSync(join(process.cwd(), 'src', 'data', 'balance', 'recalibracao.ts'))).toBe(false);
  });
});
