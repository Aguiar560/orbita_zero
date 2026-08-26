import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sim } from '@sim/index';
import { LAB_SCENARIOS, normalizeLabConfig } from '@sim/laboratorio';
import { HULL_ARCHETYPES, SPACESHIPS2_HULL_SPECS } from '@data/hulls-spaceships2';
import { ALL_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import { HULLS } from '@data/hulls';
import {
  BOSS_HITBOX_CALIBRATIONS, BOSS_SCALE_CALIBRATIONS,
  ENEMY_HITBOX_CALIBRATIONS, ENEMY_SCALE_CALIBRATIONS,
  PLAYER_HITBOX_CALIBRATIONS, PLAYER_SCALE_CALIBRATIONS,
} from '@data/hitbox-calibrations';
import { writeHitboxCalibration } from '@app/LabCalibrationAdmin';
import { bus } from '@app/Bus';

afterEach(() => vi.unstubAllGlobals());

describe('laboratório de combate', () => {
  it('normaliza limites perigosos vindos dos campos da interface', () => {
    const c = normalizeLabConfig({
      enemyCount: 999, speed: -3, elementalFraction: 8,
      playerShots: 0, playerFireRate: Number.NaN, enemyHp: -1,
      playerHitboxWidth: 999, playerHitboxHeight: -4,
      playerHitboxOffsetX: 500, playerHitboxOffsetY: -500,
      enemyHitboxWidth: -2, enemyHitboxHeight: 999,
      enemyHitboxOffsetX: -999, enemyHitboxOffsetY: 999,
    });
    expect(c.enemyCount).toBe(30);
    expect(c.speed).toBe(1);
    expect(c.elementalFraction).toBe(1);
    expect(c.playerShots).toBe(1);
    expect(c.playerFireRate).toBe(4);
    expect(c.enemyHp).toBe(1);
    expect(c.showPlayerShieldVisual).toBe(true);
    expect(c.playerSpriteScale).toBe(1.5);
    expect(c.enemySpriteScale).toBe(0.55);
    expect(c.playerHitboxWidth).toBe(220);
    expect(c.playerHitboxHeight).toBe(6);
    expect(c.playerHitboxOffsetX).toBe(100);
    expect(c.playerHitboxOffsetY).toBe(-120);
    expect(c.enemyHitboxWidth).toBe(6);
    expect(c.enemyHitboxHeight).toBe(260);
    expect(c.enemyHitboxOffsetX).toBe(-100);
    expect(c.enemyHitboxOffsetY).toBe(120);
  });

  it('não toca no GameState ao configurar, iniciar, pausar e encerrar', () => {
    const sim = new Sim();
    const before = JSON.stringify(sim.state);
    sim.atualizarLaboratorio({ playerDamage: 9999, enemyCount: 12, enemyAttack: 'espiral' });
    sim.iniciarLaboratorio();
    sim.alternarPausaLaboratorio();
    sim.avancarLaboratorio();
    sim.reiniciarLaboratorio();
    sim.pararLaboratorio();
    expect(JSON.stringify(sim.state)).toBe(before);
  });

  it('controla velocidade, pausa e avanço de um único passo', () => {
    const sim = new Sim();
    sim.atualizarLaboratorio({ speed: 4 });
    sim.iniciarLaboratorio();
    expect(sim.timeScale).toBe(4);
    sim.alternarPausaLaboratorio();
    expect(sim.timeScale).toBe(0);
    sim.avancarLaboratorio();
    expect(sim.timeScale).toBe(1);
    expect(sim.consumirPassoLaboratorio()).toBe(true);
    expect(sim.timeScale).toBe(0);
  });

  it('carrega fichas reais para os sete confrontos padronizados', () => {
    const sim = new Sim();
    for (const archetype of HULL_ARCHETYPES) {
      const spec = SPACESHIPS2_HULL_SPECS.find((entry) => entry.archetype === archetype.id)!;
      expect(sim.carregarCascoNoLaboratorio(spec.id, true), archetype.id).toBe(true);
      expect(sim.laboratorio.config.playerHullId).toBe(spec.id);
      // A ficha padronizada roda sob a postura mais neutra que existe, porque
      // ela compara CASCOS — a postura tem de ser a mesma para todos. Era
      // 'equilibrado'; virou 'evasivo' quando o meio-termo saiu do jogo.
      expect(sim.laboratorio.config.control).toBe('evasivo');
      expect(sim.laboratorio.config.enemyCount).toBe(3);
      expect(sim.laboratorio.config.enemyHp).toBe(600);
      expect(sim.laboratorio.config.speed).toBe(8);
      expect(sim.laboratorio.config.showHitboxes).toBe(true);
    }
  });

  it('oferece Elite, Enxame e Cerco com três sementes reproduzíveis', () => {
    expect(LAB_SCENARIOS.map((entry) => entry.id)).toEqual(['elite', 'enxame', 'cerco']);
    for (const scenario of LAB_SCENARIOS) {
      expect(scenario.seeds).toHaveLength(3);
      expect(new Set(scenario.seeds).size).toBe(3);
    }
    expect(LAB_SCENARIOS.find((entry) => entry.id === 'enxame')?.config.enemyCount).toBe(8);
    expect(LAB_SCENARIOS.find((entry) => entry.id === 'cerco')?.duration).toBe(120);

    const sim = new Sim();
    expect(sim.carregarCenarioLaboratorio('enxame')).toBe(true);
    expect(sim.laboratorio.config.scenario).toBe('enxame');
    expect(sim.laboratorio.config.enemyCount).toBe(8);
    expect(sim.laboratorio.config.enemyHitboxKey).toBe('enemy:dardo');
  });

  it('tem hitbox e escala canônicas revisadas para todas as fichas implementadas', () => {
    expect(Object.keys(PLAYER_HITBOX_CALIBRATIONS)).toHaveLength(HULLS.length);
    expect(Object.keys(PLAYER_SCALE_CALIBRATIONS)).toHaveLength(HULLS.length);
    expect(Object.keys(ENEMY_HITBOX_CALIBRATIONS)).toHaveLength(ALL_ENEMIES.length);
    expect(Object.keys(ENEMY_SCALE_CALIBRATIONS)).toHaveLength(ALL_ENEMIES.length);
    expect(Object.keys(BOSS_HITBOX_CALIBRATIONS)).toHaveLength(BOSSES.length);
    expect(Object.keys(BOSS_SCALE_CALIBRATIONS)).toHaveLength(BOSSES.length);

    const sim = new Sim();
    expect(sim.laboratorio.config.playerHitboxWidth).toBe(sim.hitboxDoCasco(sim.laboratorio.config.playerHullId).width);
    expect(sim.laboratorio.config.enemyHitboxWidth).toBe(sim.hitboxSalvaDoInimigo(sim.laboratorio.config.enemyHitboxKey)?.width);
  });

  it('mantém calibração fora do save e não confunde edição ao vivo com padrão canônico', () => {
    const sim = new Sim();
    expect('hullHitboxes' in sim.state).toBe(false);
    expect('enemyHitboxes' in sim.state).toBe(false);
    sim.carregarCascoNoLaboratorio('bastiao_8');
    const canonical = sim.hitboxDoCasco('bastiao_8');
    sim.atualizarLaboratorio({
      playerHitboxWidth: 74,
      playerHitboxHeight: 48,
      playerHitboxOffsetX: 3,
      playerHitboxOffsetY: -7,
    });
    expect(sim.laboratorio.config.playerHitboxWidth).toBe(74);
    expect(sim.hitboxDoCasco('bastiao_8')).toEqual(canonical);
    expect(sim.cascoTemHitboxCalibrada('bastiao_8')).toBe(true);
  });

  it('acumula cliques rápidos e liga a visualização automaticamente', () => {
    const sim = new Sim();
    sim.atualizarLaboratorio({ playerHitboxWidth: 30, showHitboxes: false });
    sim.ajustarHitboxLaboratorio('player', 'width', 2);
    sim.ajustarHitboxLaboratorio('player', 'width', 2);
    sim.ajustarHitboxLaboratorio('player', 'width', 2);
    expect(sim.laboratorio.config.playerHitboxWidth).toBe(36);
    expect(sim.laboratorio.config.hitboxTarget).toBe('player');
    expect(sim.laboratorio.config.showHitboxes).toBe(true);
  });

  it('mantém a edição inimiga isolada até o backend administrativo gravar o código', () => {
    const sim = new Sim();
    sim.atualizarLaboratorio({
      enemyHitboxKey: 'enemy:lanceiro',
      enemyHitboxWidth: 42,
      enemyHitboxHeight: 56,
      enemyHitboxOffsetX: -3,
      enemyHitboxOffsetY: 8,
    });
    expect(sim.laboratorio.config.enemyHitboxWidth).toBe(42);
    // O que este teste prova é o ISOLAMENTO: a edição vive na sessão e não
    // encosta na calibração salva. Os números exatos eram incidentais, e
    // fixá-los fazia o teste cair a cada reescala de arte — como na unificação
    // de escala visual, que remapeou todas as caixas junto com os sprites.
    // Ler da tabela mantém a asserção sobre o que importa.
    expect(sim.hitboxSalvaDoInimigo('enemy:lanceiro')).toEqual(
      // A chave da tabela não traz o prefixo 'enemy:' — ele é do Laboratório,
      // que usa um espaço de nomes próprio para distinguir inimigo de chefe.
      ENEMY_HITBOX_CALIBRATIONS.lanceiro,
    );
  });

  it('informa sucesso e falha ao gravar uma calibração administrativa', async () => {
    const notices: { text: string; kind?: string }[] = [];
    const off = bus.on('toast', (notice) => notices.push(notice));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, path: 'src/data/hitbox-calibrations.json' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'arquivo bloqueado' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(writeHitboxCalibration('save', 'player', 'bastiao_8', {
      width: 74, height: 48, offsetX: 3, offsetY: -7,
    })).resolves.toBe(true);
    await expect(writeHitboxCalibration('save', 'player', 'bastiao_8', {
      width: 74, height: 48, offsetX: 3, offsetY: -7,
    })).resolves.toBe(false);
    expect(notices.at(-2)?.text).toContain('gravadas com sucesso');
    expect(notices.at(-1)?.text).toContain('arquivo bloqueado');
    off();
  });
});
