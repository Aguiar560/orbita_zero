/**
 * Duas naves não podem dividir a mesma chave de atlas quando uma delas tem
 * arte autoral.
 *
 * ## A cicatriz
 *
 * O pipeline instala arte de `art-source/naves/<id>.png` SOBRESCREVENDO a chave
 * de atlas daquela nave. Enquanto a arte vinha toda de pack isso era só feio —
 * duas naves com a mesma cara. Com arte autoral virou defeito: `arquiteto.png`
 * escrevia em `ship/ignis_d`, que o chefe pegava emprestado do casco Ignis Mk
 * IV, e o casco do JOGADOR passou a voar com a cara do chefe. Havia mais
 * quatro assim, todos nas naves iniciais.
 *
 * Nada quebra e nada avisa: a nave só fica com a arte errada, e o único jeito
 * de descobrir é reparar nela em jogo. Daí o teste.
 */

import { describe, expect, it } from 'vitest';

import { HULLS } from '@data/hulls';
import { BOSSES } from '@data/bosses';
import { ENEMIES } from '@data/enemies';

interface Nave { readonly id: string; readonly sprite: string; readonly papel: string }

const naves: Nave[] = [
  ...HULLS.map((h) => ({ id: h.id, sprite: h.sprite, papel: 'casco' })),
  ...BOSSES.map((b) => ({ id: b.id, sprite: b.sprite, papel: 'chefe' })),
  ...ENEMIES.map((e) => ({ id: e.id, sprite: e.sprite, papel: 'inimigo' })),
];

/** Quem tem chave própria — o padrão de quem recebeu arte autoral. */
const temChavePropria = (n: Nave): boolean =>
  n.sprite === `chefe/${n.id}` || n.sprite === `jogador/${n.id}` || n.sprite === `inimigo/${n.id}`;

describe('chaves de sprite', () => {
  it('nave com chave própria não divide essa chave com ninguém', () => {
    const porChave = new Map<string, Nave[]>();
    for (const n of naves) {
      if (!porChave.has(n.sprite)) porChave.set(n.sprite, []);
      porChave.get(n.sprite)!.push(n);
    }

    const conflitos: string[] = [];
    for (const n of naves.filter(temChavePropria)) {
      const outros = porChave.get(n.sprite)!.filter((o) => o.id !== n.id);
      if (outros.length) {
        conflitos.push(`${n.sprite}: ${n.id} e ${outros.map((o) => `${o.id} (${o.papel})`).join(', ')}`);
      }
    }
    expect(conflitos, conflitos.join(' · ')).toEqual([]);
  });

  it('os cem chefes da Provação têm chave própria', () => {
    // Eram os que mais pegavam emprestado: seis chaves de cenário para cem
    // pisos.
    for (const b of BOSSES) {
      expect(b.sprite, `chefe ${b.id}`).toMatch(/^chefe\//);
    }
  });

  it('as naves iniciais não dividem arte com cascos de progressão', () => {
    // Foi o caso mais confuso: trocar a arte da Lança Rubra trocava também a do
    // Prisma de Fogo, uma nave de outro tier que o jogador conquista depois.
    const iniciais = ['nucleo_vektor', 'lanca_rubra', 'baluarte_glacial', 'sopro_astral'];
    for (const id of iniciais) {
      const nave = HULLS.find((h) => h.id === id);
      expect(nave, `casco inicial sumiu: ${id}`).toBeDefined();
      const irmaos = HULLS.filter((h) => h.sprite === nave!.sprite && h.id !== id);
      expect(irmaos.map((h) => h.id), `${id} divide arte`).toEqual([]);
    }
  });
});
