import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Rarity } from '@sim/types';
import { derivarColeta, vagasNaMochila } from '../server/src/inventario';
import { rolarDoCursor, TIPOS, type TipoDeDrop } from '../server/src/lote';

/**
 * O caminho inteiro do descarte automático, dos dois lados.
 *
 * Relato de 12/09/2026: "o setor foi concluído e recebi dois itens no
 * inventário mesmo com o descarte automático abaixo de raro". Uma peça Comum
 * em vinte escapava — e o livro das recusas mostrava `acima_do_teto` dezenas de
 * vezes com a carga em 2/70, que é o sintoma de o servidor não reconhecer os
 * descartes que o cliente manda.
 *
 * O teste roda o pipeline de verdade, sem servidor falso: o pote sai de
 * `rolarDoCursor` (o MESMO código do Worker), o cliente coleta e descarta, e
 * então o servidor deriva do cursor e aplica os comandos. Se os `uid` dos dois
 * lados divergirem, a asserção final pega.
 */

const CORTE = 2 as Rarity; // abaixo de Raro

function simComPote(semente: number, setor = 3) {
  const estado = createState(semente);
  const sim = new Sim(estado);
  sim.jumpSector(setor);
  estado.vip.expiresAt = Date.now() + 86_400_000;
  estado.settings.autoEquip = false;
  estado.settings.autoSalvage = CORTE;
  estado.comandosDeItem.length = 0;

  // O pote do servidor, entregue ao cliente como a rota `/lote` entrega.
  const cursorZero = { onda: 0, elite: 0, chefe: 0 } as Record<TipoDeDrop, number>;
  const pote = rolarDoCursor(semente, setor, 0, 0, cursorZero);
  sim.receberLote(pote);
  return { sim, estado, pote, cursorZero };
}

describe('o que o cliente descarta, o servidor não guarda', () => {
  it('todo item coletado ou é descartado ou está na carga — nunca some do radar', () => {
    const { sim, estado } = simComPote(4242);

    for (let onda = 0; onda < 300; onda++) {
      for (const item of sim.rollDrops('onda', undefined, 0)) sim.acquire(item);
    }

    const coletados = estado.comandosDeItem.filter((c) => c.tipo === 'coletar').length;
    const descartados = estado.comandosDeItem.filter((c) => c.tipo === 'descartar');
    expect(coletados, 'o pote não rendeu nada — o teste mediria o vazio').toBeGreaterThan(0);

    // A conta que fecha: tudo que saiu do pote virou carga ou virou descarte.
    expect(descartados.length + estado.inventory.length).toBe(coletados);
  });

  it('e o servidor, aplicando os mesmos comandos, guarda só o que ficou', () => {
    const { sim, estado, cursorZero } = simComPote(777);

    for (let onda = 0; onda < 300; onda++) {
      for (const item of sim.rollDrops('onda', undefined, 0)) sim.acquire(item);
    }

    // ── o lado do servidor, com o código do servidor ──────────────────────
    const pedido: Partial<Record<TipoDeDrop, number>> = {};
    for (const tipo of TIPOS) {
      const n = estado.comandosDeItem.filter((c) => c.tipo === 'coletar' && c.pote === tipo).length;
      if (n) pedido[tipo] = n;
    }
    const descartar = estado.comandosDeItem
      .filter((c): c is { tipo: 'descartar'; uid: string } => c.tipo === 'descartar')
      .map((c) => c.uid);

    const rolado = rolarDoCursor(777, sim.state.run.sector, 0, 0, cursorZero);
    const coleta = derivarColeta(rolado, cursorZero, pedido);
    const descartados = new Set(descartar);

    // O servidor grava o que nasceu e NÃO morreu no mesmo lote.
    const gravados = coleta.itens.filter((item) => !descartados.has(item.uid));

    expect(gravados.map((i) => i.uid).sort())
      .toEqual(estado.inventory.map((i) => i.uid).sort());
    // E nenhuma peça abaixo do corte sobrevive no servidor.
    expect(gravados.filter((i) => i.rarity < CORTE), 'peça abaixo do corte foi gravada')
      .toHaveLength(0);
  });

  it('e o teto da mochila não é gasto pelo que foi descartado', () => {
    /**
     * Era o sintoma no livro das recusas: `acima_do_teto` dezenas de vezes com
     * a carga quase vazia. Se o descarte não for reconhecido, cada peça
     * consumida pela automação ainda ocupa uma vaga na conta do servidor — e a
     * partir da septuagésima ele começa a recusar coleta de quem tem duas
     * peças guardadas.
     */
    const mochila = ['a', 'b'];
    const descartar = Array.from({ length: 60 }, (_, i) => `x${i}`);

    expect(vagasNaMochila(mochila, descartar, 70), 'o descarte gastou vaga').toBe(68);
  });
});
