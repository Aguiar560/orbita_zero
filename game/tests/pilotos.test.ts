import { describe, expect, it } from 'vitest';
import { HULLS, HULL_BY_ID } from '@data/hulls';
import { PILOTOS, PILOTO_PADRAO, pilotoDe } from '@data/pilotos';
import { SAVE_VERSION, createState, migrate } from '@sim/state';
import { powerScore, resolveStats, dps, effectiveHp } from '@sim/stats';

/**
 * A promessa que estes testes protegem é UMA: escolher personagem é escolher
 * um gosto, não uma vantagem.
 *
 * Ela é frágil do jeito mais silencioso possível — basta alguém ajustar um
 * stat "para deixar mais divertido" e um dos quatro vira a escolha certa. Nada
 * na tela denunciaria isso; o jogador só descobriria depois de horas.
 */

const notaDoCasco = (id: string): number => {
  const st = createState(11);
  st.hull = id;
  return powerScore(resolveStats(st));
};

describe('pilotos', () => {
  it('são quatro, e cada um tem um casco próprio que existe', () => {
    expect(PILOTOS).toHaveLength(4);
    const cascos = PILOTOS.map((p) => p.casco);
    expect(new Set(cascos).size).toBe(4);
    for (const id of cascos) expect(HULL_BY_ID.get(id)).toBeDefined();
  });

  it('todo casco de piloto se declara como tal, e nenhum outro se declara', () => {
    const marcados = HULLS.filter((h) => h.piloto).map((h) => h.id).sort();
    expect(marcados).toEqual(PILOTOS.map((p) => p.casco).sort());
    // a marca aponta de volta para o dono certo
    for (const p of PILOTOS) expect(HULL_BY_ID.get(p.casco)!.piloto).toBe(p.id);
  });

  it('os quatro cascos têm a mesma nota de poder — no máximo 3% de dispersão', () => {
    const notas = PILOTOS.map((p) => notaDoCasco(p.casco));
    const dispersao = Math.max(...notas) / Math.min(...notas) - 1;
    expect(dispersao).toBeLessThan(0.03);
  });

  it('mas têm formas bem diferentes — senão a escolha não significaria nada', () => {
    const perfis = PILOTOS.map((p) => {
      const st = createState(11);
      st.hull = p.casco;
      const s = resolveStats(st);
      return { dps: dps(s), ehp: effectiveHp(s) };
    });
    const espalha = (v: number[]) => Math.max(...v) / Math.min(...v) - 1;
    // pelo menos 20% de diferença entre a ponta e a ponta, nos dois eixos
    expect(espalha(perfis.map((p) => p.dps))).toBeGreaterThan(0.2);
    expect(espalha(perfis.map((p) => p.ehp))).toBeGreaterThan(0.2);
  });

  it('o casco do piloto é melhor que o genérico — senão ninguém o voaria', () => {
    const generico = notaDoCasco('aurora1');
    for (const p of PILOTOS) expect(notaDoCasco(p.casco)).toBeGreaterThan(generico);
  });

  it('nenhum casco de piloto é comprável', () => {
    for (const p of PILOTOS) {
      const casco = HULL_BY_ID.get(p.casco)!;
      // custo 0 e setor 0 são o que os manteria fora da loja de qualquer jeito,
      // mas quem realmente os segura é a marca `piloto` — e é ela que o
      // `buyHull` consulta.
      expect(casco.piloto).toBeTruthy();
    }
  });
});

describe('estado do piloto', () => {
  it('começa com a nave do personagem ATIVA', () => {
    for (const p of PILOTOS) {
      const st = createState(11, p.id);
      expect(st.piloto).toBe(p.id);
      expect(st.hull).toBe(p.casco);
      expect(st.fleet).toContain(p.casco);
    }
  });

  it('não entrega os cascos dos outros três', () => {
    const st = createState(11, 'piloto_darin');
    const outros = PILOTOS.filter((p) => p.id !== 'piloto_darin').map((p) => p.casco);
    for (const casco of outros) expect(st.fleet).not.toContain(casco);
  });

  it('save sem piloto migra para o padrão e ganha a nave dele', () => {
    const antigo = { ...createState(11), version: 7 } as Record<string, unknown>;
    delete antigo.piloto;
    const migrado = migrate(antigo)!;
    expect(migrado.version).toBe(SAVE_VERSION);
    expect(migrado.piloto).toBe(PILOTO_PADRAO);
    expect(migrado.fleet).toContain(pilotoDe(PILOTO_PADRAO).casco);
  });

  it('save COM piloto conserva a escolha em vez de resetá-la', () => {
    const st = createState(11, 'piloto_nharu');
    const migrado = migrate({ ...st, version: 7 })!;
    expect(migrado.piloto).toBe('piloto_nharu');
    expect(migrado.fleet).toContain('sopro_astral');
  });
});

describe('a escolha inacabada', () => {
  /**
   * Fechar a aba com a tela de escolha aberta gravava `piloto: ''`, porque
   * `pagehide` salva. A migração promovia isso ao padrão e a tela nunca mais
   * aparecia — o jogador voltava já sendo alguém que ele não escolheu ser.
   */
  it('não vira escolha feita: campo vazio continua vazio', () => {
    const st = createState(11);
    expect(st.piloto).toBe('');
    const migrado = migrate({ ...st, version: SAVE_VERSION })!;
    expect(migrado.piloto).toBe('');
  });

  it('e não entrega o casco do padrão a quem ainda não escolheu', () => {
    const migrado = migrate({ ...createState(11), version: SAVE_VERSION })!;
    for (const p of PILOTOS) expect(migrado.fleet).not.toContain(p.casco);
  });

  it('id desconhecido também volta para a tela, em vez de virar o padrão', () => {
    const migrado = migrate({ ...createState(11), piloto: 'piloto_que_nao_existe' })!;
    expect(migrado.piloto).toBe('');
  });
});
