import type { Pool } from '@core/pool';
import { Rng, clamp } from '@core/math';
import type { Encounter } from '@sim/progression';
import { unitHp } from '@sim/progression';
import type { EnemyDef } from '@data/enemies';
import { VIEW, type Enemy } from './entities';

type Formation = 'linha' | 'cunha' | 'coluna' | 'flancos';

interface SpawnGroup {
  def: EnemyDef;
  count: number;
  formation: Formation;
  /** Segundos após o início do encontro. */
  at: number;
  /** Espaçamento entre unidades do grupo. */
  gap: number;
}

/**
 * Traduz um `Encounter` (números) em uma sequência de spawns (entidades).
 *
 * O escalonamento é derivado de uma semente estável do encontro, então a mesma
 * onda sempre chega igual — o jogador aprende o ritmo do setor em vez de
 * enfrentar ruído puro.
 *
 * O encontro só termina quando o POOL de vida acaba, não quando a tela esvazia.
 * Inimigos que escapam pela base são repostos por `replenish()`; sem isso, uma
 * nave fraca demais para matar qualquer coisa avançaria de setor só esperando
 * a onda passar por ela.
 */
export class WaveDirector {
  private groups: SpawnGroup[] = [];
  private cursor = 0;
  private timer = 0;
  private pending = 0;
  private cycle = 0;
  private encounter: Encounter | null = null;
  private readonly rng = new Rng(1);

  /** Quantos inimigos ainda faltam nascer neste encontro. */
  get remaining(): number {
    return this.pending;
  }

  get isBoss(): boolean {
    return !!this.encounter?.boss;
  }

  /** Quantas vezes a onda já foi reposta — a HUD usa para avisar de estagnação. */
  get cycles(): number {
    return this.cycle;
  }

  begin(encounter: Encounter): void {
    this.encounter = encounter;
    this.cycle = 0;
    this.schedule();
  }

  /**
   * Reprograma a mesma onda. Chamado quando a tela esvaziou mas o pool ainda
   * tem vida — cada repetição chega um pouco mais rápido que a anterior.
   */
  replenish(): void {
    if (!this.encounter) return;
    this.cycle++;
    this.schedule();
  }

  private schedule(): void {
    const encounter = this.encounter;
    if (!encounter) return;

    this.timer = 0;
    this.cursor = 0;
    this.groups = [];
    this.pending = 0;

    if (encounter.boss) {
      this.pending = 1;
      return;
    }

    // Repetições entram mais depressa: a primeira leva apresenta a onda, as
    // seguintes existem só para o jogador continuar cortando o pool.
    const pace = 1 / (1 + this.cycle * 0.6);

    const rng = new Rng(((encounter.sector * 73856093) ^ (encounter.wave * 19349663) ^ (this.cycle * 2654435761)) >>> 0);
    let at = 0.6 * pace;

    for (const entry of encounter.squad) {
      // Grupos grandes chegam em levas de até 8 para não entupir a tela.
      let left = entry.count;
      while (left > 0) {
        const size = Math.min(left, rng.int(4, 8));
        left -= size;
        this.groups.push({
          def: entry.def,
          count: size,
          formation: rng.pick(['linha', 'cunha', 'coluna', 'flancos'] as const),
          at,
          gap: rng.range(0.06, 0.16),
        });
        this.pending += size;
        at += rng.range(1.1, 2.4) * pace;
      }
    }
    this.groups.sort((a, b) => a.at - b.at);
  }

  /** Faz nascer o que estiver na hora. Devolve quantos nasceram. */
  update(dt: number, pool: Pool<Enemy>, spawn: (def: EnemyDef, x: number, y: number, hp: number, damage: number) => Enemy | null): number {
    const enc = this.encounter;
    if (!enc) return 0;
    this.timer += dt;

    if (enc.boss) {
      if (this.cursor === 0 && this.timer > 1.1) {
        this.cursor = 1;
        this.pending = 0;
        const boss = spawn(bossAsEnemy(enc.boss.id), VIEW.w / 2, -120, enc.hpPool, enc.damage);
        if (boss) {
          boss.boss = enc.boss;
          boss.radius = enc.boss.radius;
          boss.scale = enc.boss.scale;
          boss.anchorX = VIEW.w / 2;
          boss.anchorY = VIEW.h * 0.22;
          boss.share = 1;
        }
        return 1;
      }
      return 0;
    }

    let born = 0;
    while (this.cursor < this.groups.length && this.groups[this.cursor]!.at <= this.timer) {
      const group = this.groups[this.cursor]!;
      this.cursor++;
      born += this.spawnGroup(group, enc, spawn);
    }

    // Rede de segurança: se a tela esvaziou mas ainda há grupos agendados,
    // adianta o próximo. Evita esperas mortas quando o jogador limpa tudo cedo.
    if (born === 0 && pool.size === 0 && this.cursor < this.groups.length) {
      const group = this.groups[this.cursor]!;
      this.cursor++;
      born += this.spawnGroup(group, enc, spawn);
    }
    return born;
  }

  private spawnGroup(
    group: SpawnGroup,
    enc: Encounter,
    spawn: (def: EnemyDef, x: number, y: number, hp: number, damage: number) => Enemy | null,
  ): number {
    const hp = unitHp(enc, group.def);
    const damage = enc.damage;
    let born = 0;

    for (let i = 0; i < group.count; i++) {
      const { x, y } = this.placement(group, i);
      const e = spawn(group.def, x, y, hp, damage);
      if (!e) break;
      e.share = 1 / Math.max(1, totalUnits(enc));
      e.pressao = enc.pressao;
      // Deslocamento vertical do índice vira atraso de entrada, sem timer extra.
      e.time = -i * group.gap;
      born++;
      this.pending = Math.max(0, this.pending - 1);
    }
    return born;
  }

  private placement(group: SpawnGroup, i: number): { x: number; y: number } {
    const n = group.count;
    const margin = 70;
    const span = VIEW.w - margin * 2;

    switch (group.formation) {
      case 'linha': {
        const step = span / Math.max(1, n - 1 || 1);
        return { x: margin + (n === 1 ? span / 2 : step * i), y: -60 };
      }
      case 'cunha': {
        const mid = (n - 1) / 2;
        const off = i - mid;
        return {
          x: clamp(VIEW.w / 2 + off * 62, margin, VIEW.w - margin),
          y: -60 - Math.abs(off) * 44,
        };
      }
      case 'coluna': {
        const lane = this.rng.range(margin, VIEW.w - margin);
        return { x: lane, y: -60 - i * 58 };
      }
      default: {
        // flancos: metade de cada lado, entrando na diagonal.
        const left = i % 2 === 0;
        return { x: left ? margin * 0.5 : VIEW.w - margin * 0.5, y: -60 - Math.floor(i / 2) * 52 };
      }
    }
  }

  reset(): void {
    this.groups = [];
    this.cursor = 0;
    this.timer = 0;
    this.pending = 0;
    this.cycle = 0;
    this.encounter = null;
  }
}

function totalUnits(enc: Encounter): number {
  return enc.squad.reduce((s, e) => s + e.count, 0);
}

/**
 * Chefes reaproveitam a estrutura de `EnemyDef` para movimento e desenho; os
 * padrões de ataque vêm de `BossDef.phases`, resolvidos no `VerticalMode`.
 */
function bossAsEnemy(id: string): EnemyDef {
  return {
    id: `boss:${id}`,
    name: id,
    sprite: '',
    // O elemento real do chefe vem de `BossDef`; este é só o valor de fachada
    // do molde, e o combate sempre consulta `e.boss?.element` primeiro.
    element: 'padrao',
    radius: 60,
    scale: 1,
    hp: 1,
    dano: 1,
    reward: 1,
    speed: 60,
    move: 'pairar',
    attack: 'direto',
    fireRate: 1,
    shots: 1,
    bulletSprite: 'shot/void_light',
    bulletSpeed: 220,
    bulletColor: '#c07dff',
    sectors: [1, 0],
    weight: 0,
    blast: 'blast/fire',
  };
}
