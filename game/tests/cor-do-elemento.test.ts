/**
 * A cor do projétil hostil é a do ELEMENTO, sempre.
 *
 * Existia um campo `bulletColor` por inimigo e por chefe, e ele derivou: o
 * químico canônico é `#7ee858` e havia inimigo atirando `#8dff5c`; o padrão é
 * `#dfe7f5` e o asteroide atirava `#c9b28f`, marrom. Dois arquivos GERADOS já
 * escreviam `element.color` e estavam certos — quem errou foi o conteúdo
 * escrito à mão, um valor de cada vez.
 *
 * Num jogo em que o anel elemental decide o dano, a cor do tiro não é enfeite:
 * é a única leitura que o jogador tem, no ar, de qual elemento vem o golpe. Uma
 * cor que mente sobre o elemento ensina o anel errado.
 *
 * O campo foi removido, e este teste existe para a regra não voltar por uma
 * porta nova — um `bulletColor` reintroduzido em qualquer tabela quebra o build
 * antes de chegar ao jogo.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import { ELEMENTS, getElement } from '@data/elements';

const TABELAS = [
  'src/data/enemies.ts',
  'src/data/bosses.ts',
  'src/data/enemies-spaceships2.ts',
  'src/data/fleets.ts',
  'src/modes/vertical/WaveDirector.ts',
];

describe('cor do projétil hostil', () => {
  it('nenhuma tabela declara cor de projétil própria', () => {
    for (const arq of TABELAS) {
      const fonte = readFileSync(join(process.cwd(), arq), 'utf8');
      expect(fonte, `${arq} voltou a declarar bulletColor`).not.toContain('bulletColor');
    }
  });

  it('todo inimigo tem um elemento conhecido, que é de onde a cor sai', () => {
    const conhecidos = new Set(ELEMENTS.map((e) => e.id));
    for (const def of ENEMIES) {
      expect(conhecidos.has(def.element), `${def.id}: elemento ${def.element}`).toBe(true);
      expect(getElement(def.element).color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('todo chefe tem um elemento conhecido', () => {
    const conhecidos = new Set(ELEMENTS.map((e) => e.id));
    for (const boss of BOSSES) {
      expect(conhecidos.has(boss.element), `${boss.id}: elemento ${boss.element}`).toBe(true);
      expect(getElement(boss.element).color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('cada elemento tem uma cor distinta — senão a leitura no ar não existe', () => {
    const cores = ELEMENTS.map((e) => e.color.toLowerCase());
    expect(new Set(cores).size).toBe(cores.length);
  });
});
