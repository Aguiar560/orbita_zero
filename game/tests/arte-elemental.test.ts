import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTAGENS, arteElemental, type CategoriaElemental } from '@data/arte-elemental';
import { ELEMENT_IDS } from '@sim/types';

/**
 * A ponte entre a tabela de arte e o atlas de verdade (§22).
 *
 * `CONTAGENS` é fato MEDIDO — quantos sprites cada célula da folha rendeu —, e
 * o recorte ainda vai mudar: o resíduo conhecido está anotado em
 * `tools/lib/elemental.mjs`. Sem este teste, mexer no recorte faria o jogo pedir
 * `tiro/gelo_3` num atlas que passou a ter só três de gelo, e o efeito
 * simplesmente não desenharia — sem erro, sem aviso, só um tiro invisível.
 */
const atlas = JSON.parse(
  readFileSync(new URL('../public/assets/atlas/elemental.json', import.meta.url), 'utf8'),
) as Record<string, unknown> & { frames?: Record<string, unknown> };

const IDS = new Set(Object.keys(atlas.frames ?? atlas));
const CATEGORIAS = Object.keys(CONTAGENS) as CategoriaElemental[];

describe('a tabela de arte bate com o atlas gerado', () => {
  it('o atlas foi gerado', () => {
    expect(IDS.size, 'rode `npm run assets`').toBeGreaterThan(50);
  });

  it.each(CATEGORIAS)('todo id declarado em %s existe', (cat) => {
    const faltando: string[] = [];
    for (const el of ELEMENT_IDS) {
      for (let i = 0; i < CONTAGENS[cat][el]; i++) {
        const id = `${cat}/${el}_${i}`;
        if (!IDS.has(id)) faltando.push(id);
      }
    }
    expect(faltando).toEqual([]);
  });

  /**
   * O outro lado da conta: sprite que existe no atlas e que a tabela não
   * declara nunca é sorteado. Não quebra nada, mas é arte paga e não usada, que
   * é o tipo de coisa que passa despercebida por meses.
   */
  it.each(CATEGORIAS)('nenhum sprite de %s fica órfão', (cat) => {
    const declarados = new Set<string>();
    for (const el of ELEMENT_IDS) {
      for (let i = 0; i < CONTAGENS[cat][el]; i++) declarados.add(`${cat}/${el}_${i}`);
    }
    const orfaos = [...IDS].filter((id) => id.startsWith(`${cat}/`) && !declarados.has(id));
    expect(orfaos).toEqual([]);
  });

  it('todo elemento tem pelo menos um sprite em cada categoria', () => {
    for (const cat of CATEGORIAS) {
      for (const el of ELEMENT_IDS) {
        expect(CONTAGENS[cat][el], `${cat}/${el}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('a escolha de variante', () => {
  it('nunca sai da faixa, para qualquer inteiro', () => {
    // A variante vem de id de inimigo e número de onda, que crescem sem limite.
    for (const v of [0, 1, 7, 999, -1, -37]) {
      for (const cat of CATEGORIAS) {
        for (const el of ELEMENT_IDS) {
          expect(IDS.has(arteElemental(cat, el, v)), `${cat}/${el} v=${v}`).toBe(true);
        }
      }
    }
  });

  it('varia de verdade quando a célula tem mais de um sprite', () => {
    // `tiroini/padrao` tem seis: variantes diferentes têm de dar ids diferentes,
    // senão a tabela seria um enfeite e a tela ficaria repetitiva.
    const vistos = new Set([0, 1, 2, 3, 4, 5].map((v) => arteElemental('tiroini', 'padrao', v)));
    expect(vistos.size).toBe(CONTAGENS.tiroini.padrao);
  });
});
