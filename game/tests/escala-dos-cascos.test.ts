/**
 * Nenhum casco pode aparecer gigante — nem minúsculo.
 *
 * ## O defeito de 04/09
 *
 * O **Baluarte Glacial** renderizava a 155×180px numa frota cuja mediana é
 * 59px de altura. Três vezes o normal, e só se descobriu porque o Rafael olhou
 * a tela e estranhou.
 *
 * A causa foi calibração COPIADA. A entrada dele em `hitbox-calibrations.json`
 * era byte a byte igual à do `falcao_b` — mesma hitbox, mesmos offsets, mesma
 * escala `0.96`. O falcão tem sprite de **48×50**; o Baluarte, de **161×188**.
 * A mesma escala num sprite três vezes maior dá uma nave três vezes maior.
 *
 * Pior que o visual: a hitbox dele já estava no tamanho da família (25,8×21,6).
 * A nave parecia enorme e levava tiro numa área pequena no meio — o jogador via
 * projétil atravessar a fuselagem sem acertar.
 *
 * ## Por que a régua é o TAMANHO RENDERIZADO, e não a escala
 *
 * A escala sozinha não diz nada: `0.96` está certo para um sprite de 50px e
 * errado para um de 188px. Comparar escalas colocaria os quatro `void_*` (1.6)
 * no topo da lista de suspeitos, e eles estão certos — o sprite deles tem 26px.
 *
 * O que o jogador vê é `sprite × escala`. É isso que se compara, contra a
 * MEDIANA da própria frota: um número absoluto envelheceria no dia em que a
 * arte mudasse de resolução.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { HULLS } from '@data/hulls';
import { PLAYER_SCALE_CALIBRATIONS } from '@data/hitbox-calibrations';

/** Quadro do atlas: `[x, y, w, h, ...]`. Só a largura e a altura importam. */
type Quadro = readonly number[];

/** Todos os quadros de todos os atlas, por id de sprite. */
function quadros(): Map<string, Quadro> {
  const raiz = new URL('../public/assets/', import.meta.url);
  const manifesto = JSON.parse(
    readFileSync(new URL('manifest.json', raiz), 'utf8'),
  ) as { atlases: { data: string }[] };

  const mapa = new Map<string, Quadro>();
  for (const atlas of manifesto.atlases) {
    let dados: { frames: Record<string, Quadro> };
    try {
      dados = JSON.parse(readFileSync(new URL(atlas.data, raiz), 'utf8')) as typeof dados;
    } catch {
      continue; // Atlas ausente no checkout não deve derrubar a suíte.
    }
    for (const [id, q] of Object.entries(dados.frames ?? {})) mapa.set(id, q);
  }
  return mapa;
}

/** A mesma conta de `Sim.escalaDoCasco`, sem instanciar o jogo. */
const escalaDe = (h: typeof HULLS[number]): number =>
  PLAYER_SCALE_CALIBRATIONS[h.id] ?? (h.damageStates ? 1.5 : (h.scale ?? 0.62));

interface Medida { id: string; nome: string; larg: number; alt: number; escala: number }

function medir(): Medida[] {
  const mapa = quadros();
  const out: Medida[] = [];
  for (const h of HULLS) {
    const q = mapa.get(h.sprite);
    if (!q) continue; // Sprite fora deste checkout de assets.
    const escala = escalaDe(h);
    out.push({ id: h.id, nome: h.name, escala, larg: q[2]! * escala, alt: q[3]! * escala });
  }
  return out;
}

const mediana = (ns: number[]): number => {
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

describe('a frota tem escala coerente', () => {
  it('mede os cascos a partir do atlas', () => {
    // Guarda o próprio teste: se o caminho dos atlas mudar, ele passaria vazio
    // e não protegeria nada.
    expect(medir().length).toBeGreaterThan(20);
  });

  it('nenhum casco passa de 1,6× a altura mediana da frota', () => {
    /**
     * 1,6× e não 1,2×: a família `jogador/` é legitimamente maior que o resto
     * (82 a 91px contra 59), e apertar a faixa reprovaria uma decisão de arte.
     * O Baluarte quebrado dava 3,05× — bem fora de qualquer leitura razoável.
     */
    const m = medir();
    const med = mediana(m.map((x) => x.alt));
    const grandes = m.filter((x) => x.alt > med * 1.6)
      .map((x) => `${x.nome} ${x.larg.toFixed(0)}x${x.alt.toFixed(0)} (escala ${x.escala})`);
    expect(grandes, `mediana ${med.toFixed(0)}px · grandes demais: ${grandes.join(' · ')}`).toEqual([]);
  });

  it('nem fica abaixo de 0,5×', () => {
    // O outro lado do mesmo erro: escala pequena demais num sprite pequeno
    // some com a nave, e ninguém repara olhando só o número.
    const m = medir();
    const med = mediana(m.map((x) => x.alt));
    const pequenos = m.filter((x) => x.alt < med * 0.5)
      .map((x) => `${x.nome} ${x.larg.toFixed(0)}x${x.alt.toFixed(0)}`);
    expect(pequenos, `mediana ${med.toFixed(0)}px · pequenos demais: ${pequenos.join(' · ')}`).toEqual([]);
  });
});

describe('calibração copiada', () => {
  /**
   * A assinatura do defeito, e o que o torna fácil de repetir: copiar a entrada
   * de outra nave é o caminho mais rápido para calibrar uma nova, e funciona
   * até os sprites terem tamanhos diferentes.
   */
  it('a mesma escala não serve a sprites de tamanhos muito diferentes', () => {
    const m = medir();
    const porEscala = new Map<string, Medida[]>();
    for (const x of m) {
      const k = x.escala.toFixed(4);
      const lista = porEscala.get(k) ?? [];
      lista.push(x);
      porEscala.set(k, lista);
    }

    const suspeitos: string[] = [];
    for (const [escala, grupo] of porEscala) {
      if (grupo.length < 2) continue;
      const alturas = grupo.map((g) => g.alt);
      const menor = Math.min(...alturas);
      const maior = Math.max(...alturas);
      // Mesma escala produzindo tamanhos finais muito distintos significa que
      // os sprites-fonte são distintos — e que a escala foi herdada, não medida.
      if (maior / menor > 1.8) {
        suspeitos.push(`escala ${escala}: ${grupo.map((g) => `${g.nome} ${g.alt.toFixed(0)}px`).join(', ')}`);
      }
    }
    expect(suspeitos, suspeitos.join(' | ')).toEqual([]);
  });
});
