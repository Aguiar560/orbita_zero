import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RARITIES } from '@data/rarity';
import { SLOT_IDS } from '@sim/types';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';

/**
 * O catálogo de `novos itens.png` — 10 categorias × 7 raridades × 2 variantes (§23).
 *
 * A folha indexa por RARIDADE, não por tier de base. É a diferença que faz o
 * inventário ser lido de relance: um Divino tem moldura dourada e desenho
 * próprio, e não o mesmo cano cinza do Comum com uma borda de outra cor.
 */
const atlas = JSON.parse(
  readFileSync(new URL('../public/assets/atlas/itens-novos.json', import.meta.url), 'utf8'),
) as Record<string, unknown> & { frames?: Record<string, unknown> };

const IDS = new Set(Object.keys(atlas.frames ?? atlas));

/** A ordem em que a folha desenha as raridades, da esquerda para a direita. */
const RARIDADES_DA_FOLHA = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino'];

/** As dez categorias: os nove slots do jogo, mais os Upgrades Gerais do §11. */
const CATEGORIAS = [...SLOT_IDS, 'upgrade'];

describe('o catálogo novo está completo', () => {
  it('o atlas foi gerado', () => {
    expect(IDS.size, 'rode `npm run assets`').toBeGreaterThan(100);
  });

  it('tem exatamente 140 ícones: 10 × 7 × 2', () => {
    expect(CATEGORIAS).toHaveLength(10);
    expect(RARIDADES_DA_FOLHA).toHaveLength(7);
    expect(IDS.size).toBe(10 * 7 * 2);
  });

  it.each(CATEGORIAS)('%s tem as sete raridades nas duas variantes', (cat) => {
    const faltando: string[] = [];
    for (const r of RARIDADES_DA_FOLHA) {
      for (const v of [0, 1]) {
        const id = `novo/${cat}_${r}_${v}`;
        if (!IDS.has(id)) faltando.push(id);
      }
    }
    expect(faltando).toEqual([]);
  });
});

/**
 * O acoplamento silencioso que este bloco existe para pegar.
 *
 * A folha desenha as raridades numa ordem fixa e o pipeline roda em Node puro,
 * sem importar `src/` — então ele repete a lista à mão. Se alguém reordenar
 * `RARITIES` ou inserir uma raridade no meio, o recorte continua funcionando e
 * passa a atribuir o ícone de Divino ao Mítico. Nada quebra, nada avisa.
 */
describe('a folha e a tabela de raridades não podem divergir', () => {
  /**
   * Compara contra `slug`, não contra `name` normalizado.
   *
   * A primeira versão deste teste tirava acento de `name` para casar com a
   * folha, e isso deixava o vínculo dependente do texto de EXIBIÇÃO — renomear
   * "Divino" para "Divindade" trocaria o ícone de toda a raridade máxima e o
   * teste ainda passaria, porque ele normalizaria o nome novo. `slug` existe
   * para ser o id estável que a arte referencia.
   */
  it('a folha tem uma coluna por raridade do jogo, na mesma ordem', () => {
    expect(RARIDADES_DA_FOLHA).toEqual(RARITIES.map((r) => r.slug));
  });

  it('todo item gerado aponta para um ícone que existe', () => {
    const rng = new Rng(31337);
    const faltando = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const item = rollItem(rng, 1 + (i % 270), 3, 0);
      if (!IDS.has(item.icon)) faltando.add(item.icon);
    }
    expect([...faltando]).toEqual([]);
  });

  it('as nove primeiras categorias são exatamente os slots do jogo', () => {
    expect(CATEGORIAS.slice(0, 9)).toEqual([...SLOT_IDS]);
  });
});
