import { describe, expect, it } from 'vitest';
import { ENCONTROS_MAX, precificarEncontros } from '../server/src/encontros';
import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { buildEncounter, precoDoEncontro } from '@sim/progression';
import { HULLS } from '@data/hulls';

/**
 * O servidor precificando o que o cliente declarou ter enfrentado.
 *
 * O cliente não diz mais "ganhei X de XP": diz "enfrentei a onda 3 do setor 40 e
 * matei 51". O valor sai do próprio jogo — é a diferença entre julgar um número
 * declarado, que as duas primeiras tentativas da Fase 5 tentaram e não deu, e
 * calcular a partir de um FATO.
 */

const casco = HULLS[0]!.id;
const SEMENTE = 8080;

const estado = () => montarEstado({
  saldos: { sucata: 0, nucleo: 0, cristal: 0 },
  xp: 0, nivel: 1, matriz: [], melhorSetor: 100,
  materiais: {}, naves: {}, frota: [casco], itens: [], semente: SEMENTE,
} as DadosDoServidor, {});

describe('a precificação do declarado', () => {
  it('paga o mesmo que `precoDoEncontro` daria, encontro a encontro', () => {
    const e = estado();
    const onda = buildEncounter(e, 40, 2);
    const r = precificarEncontros({ '40:2': onda.unidades }, e, 100);

    expect(r.encontros).toBe(1);
    expect(r.recusados).toBe(0);
    expect(r.xp).toBeCloseTo(precoDoEncontro(e, 40, 2, onda.unidades), 6);
  });

  it('e recusa o setor que o jogador ainda não alcançou', () => {
    /**
     * Sem isto, declarar a onda do setor 300 no primeiro dia pagaria o setor
     * 300 — o teto é o MELHOR JÁ ALCANÇADO, que é do servidor.
     */
    const r = precificarEncontros({ '300:1': 40 }, estado(), 100);
    expect(r.encontros).toBe(0);
    expect(r.recusados).toBe(1);
    expect(r.xp).toBe(0);
  });

  it('e recusa lixo sem derrubar o que é bom no mesmo envio', () => {
    /**
     * A lição de `planejarEquipar`: um comando ruim não melhora com
     * retentativa, e derrubar o lote por causa dele transforma um erro num
     * bloqueio permanente de todo o progresso.
     */
    const e = estado();
    const r = precificarEncontros(
      { 'nao-e-chave': 10, '40:2': 30, '0:0': 5, '40:abc': 7 },
      e, 100,
    );
    expect(r.encontros, 'o encontro bom tinha de ter passado').toBe(1);
    expect(r.recusados).toBe(3);
    expect(r.xp).toBeGreaterThan(0);
  });

  it('e declarar mais abates do que a onda tem não paga mais', () => {
    const e = estado();
    const onda = buildEncounter(e, 40, 2);
    const honesto = precificarEncontros({ '40:2': onda.unidades }, e, 100).xp;
    const inflado = precificarEncontros({ '40:2': onda.unidades * 1000 }, e, 100).xp;
    expect(inflado).toBeCloseTo(honesto, 6);
  });

  it('e um envio absurdo não vira laço sem fim', () => {
    // Um mapa com dez mil chaves chega por defeito ou por ataque, e nos dois
    // casos o Worker tem um orçamento de CPU para respeitar.
    const muitos: Record<string, number> = {};
    for (let i = 0; i < 5_000; i++) muitos[`40:${(i % 6) + 1}`] = 10;
    const r = precificarEncontros(muitos, estado(), 100);
    expect(r.encontros + r.recusados).toBeLessThanOrEqual(ENCONTROS_MAX);
  });
});
