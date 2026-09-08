import { describe, expect, it } from 'vitest';
import { ELEMENTO_DA_GALAXIA } from '@data/elemento-da-galaxia';
import { describeGalaxy, PHASES_PER_GALAXY } from '@data/galaxies';
import { BIOMAS_ATMOSFERICOS } from '@data/biomas-atmosfericos';
import { ELEMENTS, getElement } from '@data/elements';
import { SPACESHIPS2_REGULAR_ENEMIES } from '@data/enemies-spaceships2';
import { buildEncounter, WAVES_PER_SECTOR } from '@sim/progression';
import { createState } from '@sim/state';

/**
 * O rótulo elemental de uma galáxia tem de descrever a galáxia.
 *
 * Três defeitos separados, todos apontados pelo Rafael olhando a tela:
 *
 * 1. **A distribuição.** O cósmico caía na galáxia 5 e só voltava na 25 — vinte
 *    galáxias sem ele. Era consequência de a tabela ter saído só dos nomes.
 * 2. **A cor.** A moldura da galáxia vinha de `COLORS[índice % 4]`, quatro
 *    cores em rodízio. O Trono Oco aparecia ROXO logo acima da linha "Perigo da
 *    região: Gelo".
 * 3. **A dominância.** Estar no elenco não bastava: a galáxia de raio mostrava
 *    31% de raio e 40% de químico.
 *
 * Nenhum dos três tinha teste. Os que existiam olhavam outra coisa.
 */

const state = createState(1);

/** Distância angular entre dois hexadecimais, em graus (0 a 180). */
function distanciaDeMatiz(a: string, b: string): number {
  const matiz = (hex: string): number => {
    const [r, g, bl] = [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255);
    const max = Math.max(r!, g!, bl!);
    const min = Math.min(r!, g!, bl!);
    const d = max - min;
    if (d === 0) return 0;
    if (max === r) return (((g! - bl!) / d + 6) % 6) * 60;
    if (max === g) return ((bl! - r!) / d + 2) * 60;
    return ((r! - g!) / d + 4) * 60;
  };
  const bruto = Math.abs(matiz(a) - matiz(b));
  return Math.min(bruto, 360 - bruto);
}

describe('a cor da galáxia', () => {
  it('é a cor do ELEMENTO dela, e não um rodízio de quatro', () => {
    /**
     * O defeito da captura de tela do Rafael: Galáxia 18, Trono Oco, moldura
     * roxa e "Perigo da região: Gelo" logo abaixo. Roxo é a cor do cósmico.
     *
     * O teste aceita variação de tom — cinco galáxias do mesmo elemento não
     * podem ser o mesmo hexadecimal — mas não aceita troca de família: 40° é
     * mais que o suficiente para um degrau de brilho e menos que a distância
     * entre dois elementos quaisquer.
     */
    for (let i = 0; i < 30; i++) {
      const info = describeGalaxy(i);
      const doElemento = getElement(info.element).color;
      expect(
        distanciaDeMatiz(info.color, doElemento),
        `g${i + 1} ${info.name} é ${info.element} (${doElemento}) mas pinta ${info.color}`,
      ).toBeLessThan(40);
    }
  });

  it('e nenhuma galáxia repete a cor de outra', () => {
    // A primeira tentativa usava `(índice × 7) % 5` para variar o tom, e duas
    // galáxias do mesmo elemento com o mesmo resto ficavam idênticas: sobravam
    // 23 cores em 30.
    const cores = Array.from({ length: 30 }, (_, i) => describeGalaxy(i).color);
    expect(new Set(cores).size).toBe(30);
  });
});

describe('a distribuição dos elementos', () => {
  it('as seis primeiras galáxias combinam com a superfície que o jogador vê', () => {
    /**
     * Pedido do Rafael: "essas primeiras galáxias ainda têm que ter a ver com o
     * background". Elas são as únicas com superfícies atmosféricas longas, e
     * cada uma é inequívoca — não há leitura em que o bioma vulcânico não seja
     * fogo.
     */
    const esperado: Record<string, string> = {
      oceanico: 'raio', vulcanico: 'fogo', glacial: 'gelo',
      deserto: 'padrao', toxica: 'quimico', cristalina: 'cosmico',
    };
    for (const bioma of BIOMAS_ATMOSFERICOS) {
      expect(
        describeGalaxy(bioma.galaxia).element,
        `g${bioma.galaxia + 1} tem bioma ${bioma.id}`,
      ).toBe(esperado[bioma.id]);
    }
  });

  it('e nenhum elemento some por mais de nove galáxias', () => {
    /**
     * O número não é arbitrário: 9 é o melhor alcançável sem reescrever mais de
     * uma identidade profunda. Ver `elemento-da-galaxia.ts`. Antes era 20.
     *
     * O vão conta a ENTRADA (quantas galáxias até a primeira aparição) e a
     * SAÍDA (quantas depois da última), porque um elemento que só aparece no
     * fim é tão ausente quanto um que some no meio.
     */
    for (const el of ELEMENTS) {
      const pos: number[] = [];
      ELEMENTO_DA_GALAXIA.forEach((e, i) => { if (e === el.id) pos.push(i); });
      expect(pos.length, `${el.id} não tem galáxia nenhuma`).toBeGreaterThanOrEqual(4);

      let maior = pos[0]! + 1;
      for (let i = 1; i < pos.length; i++) maior = Math.max(maior, pos[i]! - pos[i - 1]!);
      maior = Math.max(maior, 30 - pos[pos.length - 1]!);
      expect(maior, `${el.id} some por ${maior} galáxias (${pos.map((p) => p + 1).join(', ')})`)
        .toBeLessThanOrEqual(9);
    }
  });
});

describe('a dominância do elemento na onda', () => {
  /** Quanto do elemento da galáxia morre nela, em porcentagem. */
  function presenca(g: number): number {
    const conta = new Map<string, number>();
    let total = 0;
    for (let s = g * PHASES_PER_GALAXY + 1; s <= (g + 1) * PHASES_PER_GALAXY; s++) {
      for (let w = 1; w <= WAVES_PER_SECTOR; w++) {
        for (const { def, count } of buildEncounter(state, s, w).squad) {
          conta.set(def.element, (conta.get(def.element) ?? 0) + count);
          total += count;
        }
      }
    }
    return ((conta.get(describeGalaxy(g).element) ?? 0) / total) * 100;
  }

  it('a galáxia de fogo é MAJORITARIAMENTE de fogo — onde há arte para isso', () => {
    /**
     * Pedido do Rafael, nas palavras dele: "não ter 100% inimigos de fogo, pode
     * ter outros também, mas majoritariamente de fogo".
     *
     * O piso vale só para os elementos com pelo menos DOIS regulares no
     * catálogo. O gelo tem UM (medido em 07/09), e nenhuma regra de código faz
     * um único desenho virar maioria sem repetir a mesma silhueta a onda
     * inteira. É lacuna de arte, e o teste diz isso em vez de escondê-la
     * baixando o piso para todo mundo.
     */
    const regularesDo = (el: string): number =>
      SPACESHIPS2_REGULAR_ENEMIES.filter((e) => e.element === el).length;

    for (let g = 0; g < 30; g++) {
      const info = describeGalaxy(g);
      if (regularesDo(info.element) < 2) continue;
      const p = presenca(g);
      expect(p, `g${g + 1} ${info.name} é ${info.element} e só ${p.toFixed(0)}% dela é`)
        .toBeGreaterThanOrEqual(40);
    }
  });

  it('e nunca 100%: o jogador não pode desligar o combate com uma resistência só', () => {
    for (let g = 0; g < 30; g++) {
      expect(presenca(g), `g${g + 1} virou monocultura`).toBeLessThanOrEqual(92);
    }
  });
});
