import { describe, expect, it } from 'vitest';
import { getElement } from '@data/elements';
import { HULLS, HULL_BY_ID } from '@data/hulls';
import {
  HULL_ARCHETYPES,
  HULL_TUNINGS,
  HULL_WEAPONS,
  SPACESHIPS2_HULLS,
  SPACESHIPS2_HULL_SPECS,
  SPACESHIPS2_HULL_SPEC_BY_ID,
} from '@data/hulls-spaceships2';
import { SPACESHIPS2_LEGACY_PLAYER_ART, SPACESHIPS2_PLAYER_ART } from '@data/spaceships2';
 import { DEGRAUS_DE_CASCO, FRACAO_DA_RENDA, ORDEM_DA_ESCADA, POSTO_POR_CASCO, SETOR_INICIAL } from '@data/balance/cascos';
 import { createState } from '@sim/state';
 import { powerScore, resolveStats } from '@sim/stats';

const attack = (hull: (typeof SPACESHIPS2_HULLS)[number]): number => {
  const stats = hull.stats;
  return (stats.dano ?? 0) * (stats.cadencia ?? 0) * Math.max(1, stats.projeteis ?? 1)
    * (1 + (stats.critChance ?? 0) * (stats.critDano ?? 0));
};

const defense = (hull: (typeof SPACESHIPS2_HULLS)[number]): number =>
  (hull.stats.vida ?? 0) + (hull.stats.escudo ?? 0) * 1.1 + (hull.stats.regen ?? 0) * 18;

describe('catálogo de cascos Spaceships 2.0', () => {
  it('transforma cada uma das 29 artes de jogador em exatamente um casco', () => {
    const art = [...SPACESHIPS2_PLAYER_ART, ...SPACESHIPS2_LEGACY_PLAYER_ART];
    expect(art).toHaveLength(29);
    expect(SPACESHIPS2_HULL_SPECS).toHaveLength(29);
    expect(SPACESHIPS2_HULLS).toHaveLength(29);
    expect(HULLS).toHaveLength(53);
    expect(new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.artId)))
      .toEqual(new Set(art.map((entry) => entry.id)));
  });

  it('usa ids, nomes, sprites e fichas únicas e mantém o Bastião 8 compatível', () => {
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.id)).size).toBe(29);
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.name)).size).toBe(29);
    expect(new Set(SPACESHIPS2_HULLS.map((hull) => hull.sprite)).size).toBe(29);
    expect(new Set(HULLS.map((hull) => hull.id)).size).toBe(HULLS.length);
    for (const hull of SPACESHIPS2_HULLS) {
      expect(hull.id).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(HULL_BY_ID.get(hull.id)).toBe(hull);
      expect(SPACESHIPS2_HULL_SPEC_BY_ID.get(hull.id)?.name).toBe(hull.name);
    }
    expect(HULL_BY_ID.get('bastiao_8')?.sprite).toBe('s2/player/p_11');
  });

  /**
   * A escada de aquisição, e o defeito que ela veio corrigir.
   *
   * Este teste travava `tier 4`, `cost 0` e `requiresSector 0` — o estado de
   * arte em teste. Ele estava certo em travar o que era deliberado, mas o que
   * era deliberado tornava o começo do jogo irrelevante: 29 cascos grátis no
   * setor 1, o melhor deles com nota 918 contra 85 do inicial.
   */
  it('todo casco tem posto na escada, com setor e custo crescentes', () => {
    let setorAnterior = 0;
    let custoAnterior = 0;
    for (const id of ORDEM_DA_ESCADA) {
      const hull = HULL_BY_ID.get(id)!;
      const posto = POSTO_POR_CASCO.get(id)!;
      expect(hull.requiresSector, id).toBe(posto.setor);
      expect(hull.tier, id).toBe(posto.degrau.tier);
      // Nada de graça e nada no começo: é o defeito que a escada corrigiu.
      expect(hull.requiresSector, id).toBeGreaterThanOrEqual(SETOR_INICIAL);
      expect(hull.cost, id).toBeGreaterThan(0);
      // A escada sobe: o próximo casco nunca vem antes nem mais barato.
      expect(hull.requiresSector, id).toBeGreaterThanOrEqual(setorAnterior);
      expect(hull.cost, id).toBeGreaterThanOrEqual(custoAnterior);
      setorAnterior = hull.requiresSector;
      custoAnterior = hull.cost;
    }
    expect(setorAnterior).toBeLessThanOrEqual(300);
  });

  it('cada linha da escada supera o melhor legado disponível no seu setor', () => {
    const nota = (id: string) => {
      const st = createState(11);
      st.hull = id;
      return powerScore(resolveStats(st));
    };
    const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
    for (const degrau of DEGRAUS_DE_CASCO) {
      const hulls = degrau.cascos.map((id) => HULL_BY_ID.get(id)!);
      const setorDaLinha = Math.min(...hulls.map((h) => h.requiresSector));
      const legado = HULLS
        .filter((h) => !POSTO_POR_CASCO.has(h.id) && !h.prototype && h.requiresSector <= setorDaLinha)
        .map((h) => nota(h.id));
      // A MEDIANA, e não todo casco. `powerScore` é produto de dps por vida, o
      // que penaliza canhão de vidro por desenho: exigir que um duelista bata a
      // nota de um casco equilibrado obrigaria a superajustar exatamente os
      // arquétipos cuja graça é serem frágeis. O que a escada promete é que a
      // LINHA seja um passo à frente, não que toda peça dela seja.
      expect(mediana(hulls.map((h) => nota(h.id))), `${degrau.id} no setor ${setorDaLinha}`)
        .toBeGreaterThan(Math.max(...legado));
    }
  });

  it('o custo pesa na renda de núcleos, e não é decoração', () => {
    // A primeira versão cobrava por ponto de nota, e medido dava 0,03% da renda
    // acumulada no casco mais caro: o único portão real era o setor. Agora o
    // custo é fração da renda da janela, e este teste guarda a faixa.
    for (const id of ORDEM_DA_ESCADA) {
      const posto = POSTO_POR_CASCO.get(id)!;
      const janela = posto.custo / FRACAO_DA_RENDA;
      expect(posto.custo, id).toBeGreaterThan(0);
      expect(posto.custo / janela, id).toBeCloseTo(FRACAO_DA_RENDA, 2);
    }
    // E sobe: nenhum casco tardio é mais barato que um anterior.
    const custos = ORDEM_DA_ESCADA.map((id) => POSTO_POR_CASCO.get(id)!.custo);
    for (let i = 1; i < custos.length; i++) expect(custos[i]!).toBeGreaterThanOrEqual(custos[i - 1]!);
  });

  it('a escada sobe de linha em linha', () => {
    const nota = (id: string) => {
      const st = createState(11);
      st.hull = id;
      return powerScore(resolveStats(st));
    };
    const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
    const medianas = DEGRAUS_DE_CASCO.map((d) => mediana(d.cascos.map(nota)));
    for (let i = 1; i < medianas.length; i++) {
      expect(medianas[i]!, DEGRAUS_DE_CASCO[i]!.id).toBeGreaterThan(medianas[i - 1]!);
    }
  });

  it('liga elemento, projétil, cor e rastro na mesma identidade visual', () => {
    for (const hull of SPACESHIPS2_HULLS) {
      const element = getElement(hull.element);
      expect(element.bullet).toContain(hull.shot.sprite);
      expect(hull.shot.color).toBe(element.color);
      expect(hull.trail).toBe(element.glow);
      expect(hull.shot.speed).toBeGreaterThanOrEqual(600);
      expect(hull.shot.speed).toBeLessThanOrEqual(1200);
    }
  });

  it('usa todos os arquétipos, ajustes e armamentos cadastrados', () => {
    const archetypes = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.archetype));
    const tunings = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.tuning));
    const weapons = new Set(SPACESHIPS2_HULL_SPECS.map((spec) => spec.weapon));
    for (const entry of HULL_ARCHETYPES) expect(archetypes.has(entry.id), entry.id).toBe(true);
    for (const entry of HULL_TUNINGS) expect(tunings.has(entry.id), entry.id).toBe(true);
    for (const entry of HULL_WEAPONS) expect(weapons.has(entry.id), entry.id).toBe(true);
  });

  it('dá custo mecânico próprio a cada família de tiro', () => {
    for (const weapon of HULL_WEAPONS) {
      expect(weapon.damageMul, `${weapon.id}: dano`).toBeGreaterThan(0);
      expect(weapon.cadenceMul, `${weapon.id}: cadência`).toBeGreaterThan(0);
      expect(weapon.spread, `${weapon.id}: dispersão`).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(HULL_WEAPONS.map((weapon) => `${weapon.damageMul}:${weapon.cadenceMul}`)).size)
      .toBe(HULL_WEAPONS.length);
  });

  /**
   * Dentro de uma LINHA a escolha é de estilo; ao longo da escada é de progresso.
   *
   * A versão anterior exigia que os 29 inteiros coubessem numa faixa só
   * (ataque < 2,45×), o que era a leitura correta de "alternativas táticas, não
   * uma escada de poder" — enquanto não havia escada. Agora há, e a faixa única
   * passou a valer DENTRO da linha, não entre linhas.
   *
   * A velocidade continua sem escada em nenhum eixo: ela é identidade de
   * arquétipo, não recompensa de progressão. Se um casco tardio fosse mais
   * rápido só por ser tardio, o interceptador deixaria de ser interceptador.
   */
  it('dentro de uma linha o que separa os cascos é arquétipo, não escada', () => {
    for (const degrau of DEGRAUS_DE_CASCO) {
      const hulls = degrau.cascos.map((id) => HULL_BY_ID.get(id)!);
      // A dispersão DENTRO da linha é a dos arquétipos, e ela é larga de
      // propósito: um baluarte tem 500 de casco e 440 de escudo contra 215 e
      // 115 de um duelista. O que o teste protege é que essa dispersão não
      // CRESÇA com a escada — a faixa é a mesma em todas as cinco linhas.
      const ataques = hulls.map(attack);
      const defesas = hulls.map(defense);
      expect(Math.max(...ataques) / Math.min(...ataques), `${degrau.id}: ataque`).toBeLessThan(3.2);
      expect(Math.max(...defesas) / Math.min(...defesas), `${degrau.id}: defesa`).toBeLessThan(7.5);
    }
    // A velocidade não escala em eixo nenhum: ela é identidade de arquétipo, e
    // não recompensa de progressão. Um casco tardio mais rápido só por ser
    // tardio faria o interceptador deixar de ser interceptador.
    const speeds = SPACESHIPS2_HULLS.map((hull) => hull.stats.velocidade ?? 0);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(2.5);
  });
});
