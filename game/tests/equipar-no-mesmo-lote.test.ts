import { describe, expect, it } from 'vitest';
import { planejarEquipar } from '../server/src/inventario';
import { rolarLote } from '../server/src/lote';
import { HULL_BY_ID, HULLS } from '@data/hulls';
import type { Item } from '@sim/types';

/**
 * Equipar uma peça que acabou de cair travava o inventário inteiro.
 *
 * ## A cadeia, relatada pelo Rafael em 08/09
 *
 * "Estava com a Núcleo Vektor com alguns itens equipados, alterei para a Vetor
 * VC-1 e atualizei a página; ao retornar voltei para Núcleo Vektor e ela estava
 * pelada, sem itens."
 *
 * Consultando o D1: os onze itens da conta estavam com `nave` NULO. Nada nunca
 * chegou a ser equipado no servidor.
 *
 * 1. A rota resolvia cada `equipar` com um `SELECT` ao vivo.
 * 2. As coletas do MESMO lote ainda não tinham sido gravadas — elas entram numa
 *    lista de escritas que só roda no fim, para caber num `batch` só.
 * 3. Então equipar uma peça recém-caída não a encontrava, e a rota respondia
 *    409 com `return` — **antes** do `batch`. O lote inteiro se perdia: as
 *    coletas, os descartes e os outros equipamentos.
 * 4. O cliente devolve a fila ao início quando a requisição falha. O mesmo
 *    comando voltava no envio seguinte e derrubava esse também.
 *
 * Uma peça equipada logo depois de cair travava a sincronização PARA SEMPRE. E
 * o jogo equipa automaticamente o que é melhor assim que cai.
 */

const lote = rolarLote(2024, 40, 1, 0);
const casco = HULLS[0]!;
const elementoDoCasco = (nave: string): string | null => HULL_BY_ID.get(nave)?.element ?? null;

/** Uma peça que serve neste casco, para o teste não depender de sorte. */
function pecaQueServe(): Item {
  const candidata = lote.onda.find((i) => !i.element || i.element === casco.element);
  expect(candidata, 'o lote de teste precisa ter uma peça compatível').toBeTruthy();
  return candidata!;
}

describe('equipar uma peça do MESMO lote', () => {
  it('funciona — a peça recém-caída é conhecida antes de chegar ao banco', () => {
    const item = pecaQueServe();
    // `nascidos` é o que a coleta acabou de produzir e ainda não gravou.
    const nascidos = new Map([[item.uid, item]]);

    const plano = planejarEquipar(
      [{ uid: item.uid, nave: casco.id }],
      (uid) => nascidos.get(uid) ?? null,
      elementoDoCasco,
    );

    expect(plano.recusados, 'a peça caiu neste lote e é da pessoa').toEqual([]);
    expect(plano.aplicar).toHaveLength(1);
    expect(plano.aplicar[0]!.nave).toBe(casco.id);
    expect(plano.aplicar[0]!.slot).toBe(item.slot);
  });

  it('e um comando impossível NÃO leva o lote junto', () => {
    /**
     * É a metade que fazia o defeito ser permanente. Um comando que não dá para
     * aplicar não melhora com retentativa — e derrubar o lote por causa dele
     * transformava um comando ruim num bloqueio de tudo, inclusive dos
     * descartes.
     */
    const item = pecaQueServe();
    const nascidos = new Map([[item.uid, item]]);

    const plano = planejarEquipar(
      [
        { uid: 'uid-que-nao-existe', nave: casco.id },
        { uid: item.uid, nave: casco.id },
      ],
      (uid) => nascidos.get(uid) ?? null,
      elementoDoCasco,
    );

    expect(plano.recusados.map((r) => r.uid)).toEqual(['uid-que-nao-existe']);
    expect(plano.recusados[0]!.motivo).toBe('item_nao_e_seu');
    expect(plano.aplicar, 'o comando bom do mesmo lote continua valendo')
      .toHaveLength(1);
  });

  it('e casco inexistente é recusa, não aceitação', () => {
    // A conferência que já existia não pode ter se perdido na extração.
    const item = pecaQueServe();
    const plano = planejarEquipar(
      [{ uid: item.uid, nave: 'casco_que_nao_existe' }],
      () => item,
      elementoDoCasco,
    );
    expect(plano.aplicar).toEqual([]);
    expect(plano.recusados).toHaveLength(1);
  });

  it('e desequipar não precisa de casco nenhum', () => {
    const item = pecaQueServe();
    const plano = planejarEquipar(
      [{ uid: item.uid, nave: null }],
      () => item,
      elementoDoCasco,
    );
    expect(plano.desequipar).toEqual([item.uid]);
    expect(plano.recusados).toEqual([]);
  });

  it('e peça que o casco não aceita é recusada, com o motivo', () => {
    const item = pecaQueServe();
    const plano = planejarEquipar(
      [{ uid: item.uid, nave: casco.id }],
      () => item,
      // Um elemento que a peça não aceita, se ela tiver elemento próprio.
      () => (item.element && item.element !== 'padrao' ? 'padrao' : casco.element),
    );
    // Uma das duas: ou a peça é neutra e passa, ou ela é elemental e é recusada
    // com motivo. O que não pode é passar com o elemento errado.
    if (plano.recusados.length) {
      expect(plano.recusados[0]!.motivo).toBe('nave_nao_aceita');
      expect(plano.aplicar).toEqual([]);
    } else {
      expect(item.element === undefined || item.element === 'padrao').toBe(true);
    }
  });
});
