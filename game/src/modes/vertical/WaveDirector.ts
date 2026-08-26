import type { Pool } from '@core/pool';
import { Rng, clamp } from '@core/math';
import type { Encounter } from '@sim/progression';
import { unitHp } from '@sim/progression';
import { LEVA_INTERVALO_MAX, LEVA_INTERVALO_MIN, LEVA_MAX, LEVA_MIN } from '@data/balance/curvas';
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
  /**
   * Vida com que o grupo nasce, quando não é a padrão do encontro.
   *
   * Usado por quem escapou pela base: ele volta ferido, com a vida que tinha ao
   * sair. Voltar curado apagaria o trabalho do jogador e travava a onda — um
   * casco que o jogador não conseguia derrubar numa passagem também não
   * conseguiria na seguinte, e o encontro nunca terminava.
   */
  hp?: number;
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
   * Reprograma a mesma onda. Chamado quando a tela esvaziou mas ainda falta
   * abater — cada repetição chega um pouco mais rápido que a anterior.
   */
  replenish(): void {
    if (!this.encounter) return;
    this.cycle++;
    this.schedule();
  }

  /**
   * Devolve à fila um inimigo que escapou pela base, com a vida que lhe restava.
   *
   * O encontro só termina por abate, então quem passa reto tem de voltar —
   * senão bastaria esperar todo mundo descer para a onda acabar sozinha. Mas
   * voltar CURADO é o outro extremo, e trava o jogo: medido, um piloto de nave
   * nua ficou cinco minutos na onda de elite do setor 3 com zero abates e 35
   * escapes, porque nunca conseguia derrubar um casco cheio numa única
   * passagem. Guardar a vida faz o dano acumular entre as voltas.
   */
  requeue(def: EnemyDef, hp: number): void {
    if (!this.encounter) return;
    this.groups.push({
      def, count: 1, gap: 0, formation: 'linha',
      at: this.timer + 1.2,
      hp: Math.max(1, hp),
    });
    this.pending += 1;
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

    // Primeiro as LEVAS de cada tipo, ainda sem hora.
    //
    // Grupos grandes chegam em levas de até 8 para não entupir a tela.
    const filas: { def: EnemyDef; count: number }[][] = [];
    for (const entry of encounter.squad) {
      const fila: { def: EnemyDef; count: number }[] = [];
      let left = entry.count;
      while (left > 0) {
        const size = Math.min(left, rng.int(LEVA_MIN, LEVA_MAX));
        left -= size;
        fila.push({ def: entry.def, count: size });
      }
      if (fila.length) filas.push(fila);
    }
    if (!filas.length) return;

    // Agora a hora, em RODÍZIO entre os tipos.
    //
    // Antes o `at` era cumulativo e nunca reiniciava entre as entradas do
    // esquadrão: o tipo A tomava as horas 0,6 · 2,4 · 4,1, e o tipo B
    // começava de onde A parou. A onda era um bloco inteiro de A e DEPOIS um
    // bloco inteiro de B — e o `sort` no fim não corrigia nada, porque já
    // estavam em ordem.
    //
    // O efeito era o `tipos` do perfil de onda ser respeitado na composição e
    // destruído no agendamento. Medido em 600 ondas: 2,23 tipos escolhidos, e
    // 1,14 convivendo em tela na média da onda. O jogador via UM inimigo.
    //
    // O rodízio não muda quantas levas existem, nem o intervalo entre elas,
    // nem quando a onda acaba — muda só QUAL tipo ocupa cada vaga. Contagem,
    // pressão e XP saem idênticas de propósito: isto é apresentação.
    let restam = filas.reduce((soma, f) => soma + f.length, 0);
    let volta = 0;
    while (restam > 0) {
      const fila = filas[volta % filas.length]!;
      volta++;
      const leva = fila.shift();
      if (!leva) continue;
      restam--;
      this.groups.push({
        def: leva.def,
        count: leva.count,
        formation: rng.pick(['linha', 'cunha', 'coluna', 'flancos'] as const),
        at,
        gap: rng.range(0.06, 0.16),
      });
      this.pending += leva.count;
      at += rng.range(LEVA_INTERVALO_MIN, LEVA_INTERVALO_MAX) * pace;
    }
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
      const nasceram = this.spawnGroup(group, enc, spawn);
      born += nasceram;
      // O pool tem teto, e `spawn` devolve null quando enche. Antes o cursor
      // avancava mesmo assim e o restante do grupo sumia do cronograma — com
      // `pending` ja descontado so do que nasceu, a onda ficava devendo
      // inimigos que nunca viriam. Com ondas de ate 240 num pool de 200 isso
      // deixou de ser hipotetico. Agora o grupo encolhe e espera a proxima
      // volta, quando alguem ja tera morrido.
      if (nasceram < group.count) {
        group.count -= nasceram;
        break;
      }
      this.cursor++;
    }

    // Rede de segurança: se a tela esvaziou mas ainda há grupos agendados,
    // adianta o próximo. Evita esperas mortas quando o jogador limpa tudo cedo.
    if (born === 0 && pool.size === 0 && this.cursor < this.groups.length) {
      const group = this.groups[this.cursor]!;
      const nasceram = this.spawnGroup(group, enc, spawn);
      born += nasceram;
      if (nasceram < group.count) group.count -= nasceram;
      else this.cursor++;
    }
    return born;
  }

  private spawnGroup(
    group: SpawnGroup,
    enc: Encounter,
    spawn: (def: EnemyDef, x: number, y: number, hp: number, damage: number) => Enemy | null,
  ): number {
    const hp = group.hp ?? unitHp(enc, group.def);
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
