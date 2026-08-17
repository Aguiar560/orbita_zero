import { Rng, TAU, clamp, clamp01, damp, hashString, lerp } from '@core/math';
import { fmt } from '@core/format';
import { assets } from '@render/Assets';
import { Particles } from '@render/Particles';
import { StarScroll } from '@render/Parallax';
import type { Surface } from '@render/Surface';
import { frameAt, getClip } from '@render/Anim';
import { PLANET_KEYS, describeGalaxy, galaxyOfSector, galaxyPhases, phaseOfSector } from '@data/galaxies';
import { SKY_COMETS, SKY_FAMILIES, SKY_NEBULAE } from '@data/orbs';
import { WAVES_PER_SECTOR } from '@sim/progression';
import { rarityInfo } from '@data/rarity';
import { getElement, matchup } from '@data/elements';
import { MULT_ELEMENTAL_MAX } from '@data/balance/limites';
import type { EnemyDef } from '@data/enemies';
import type { ElementId, Item } from '@sim/types';
import type { Sim } from '@sim/index';
import { PilotAI } from './PilotAI';
import { WaveDirector } from './WaveDirector';
import {
  PICKUP_CLIP, PICKUP_COLOR, PICKUP_SPRITE, VIEW,
  createBulletPool, createEnemyPool, createPickupPool,
  type Bullet, type Enemy, type PickupKind, type Player,
} from './entities';

/** Segundos parado após a nave cair, antes de reiniciar o encontro. */
const RESPAWN_DELAY = 1.8;
/**
 * Duração do painel de vitória.
 *
 * Cinco segundos: tempo de ler o que foi conquistado sem virar espera. Durante
 * a pausa o combate fica congelado — nada nasce, nada atira —, então a
 * comemoração não é interrompida pela próxima onda já entrando na tela.
 */
const VICTORY_HOLD = 5;

/**
 * Segundos sem levar dano até o escudo voltar a regenerar.
 *
 * Generoso de propósito: com 2.4s um piloto cru levava tiro a cada 6s e mesmo
 * assim regenerava mais do que perdia, então nunca morria. A janela precisa ser
 * maior que o intervalo típico entre acertos para o dano acumular.
 */
const SHIELD_LOCK = 4;

/**
 * Camada vertical — o combate "de verdade".
 *
 * Aqui a nave é pilotada por IA (`PilotAI`) e o jogador atua pelo loadout, pela
 * Matriz e pela política de pilotagem. A cena é a fonte de verdade do combate;
 * ela informa a simulação a cada abate e no fim do encontro.
 *
 * Ela roda mesmo com a aba oculta — o laço troca de relógio, mas a simulação é
 * a mesma. `Sim.abstractTick()` só entra quando a JANELA foi fechada e não há
 * cena para rodar; os dois caminhos partilham o mesmo `Encounter`, então o
 * progresso não muda de ritmo conforme o jogador olha ou não.
 */
export class VerticalMode {
  private readonly ai = new PilotAI();
  private readonly director = new WaveDirector();
  private readonly particles = new Particles();
  private readonly rng = new Rng(0x51ce);

  private readonly bullets = createBulletPool();
  private readonly enemies = createEnemyPool();
  private readonly pickups = createPickupPool();

  /**
   * Camadas de estrela que rolam sobre o fundo da galáxia.
   *
   * Só estrelas: as folhas de nebulosa de 320px não são costuráveis na
   * horizontal e deixavam uma emenda visível no campo largo. A cor do lugar vem
   * do fundo da galáxia; estas camadas existem para dar movimento e paralaxe.
   */
  private readonly skyLayers = [
    new StarScroll('bg/campo_miudas.png', 1.1, 0.7, 2),
    new StarScroll('bg/campo_grandes.png', 1.9, 0.85, 2),
  ];

  /** Tempo acumulado da cena, usado pelos clipes em loop que não têm estado. */
  private elapsed = 0;
  /** Fundo em exibição. Só muda quando a imagem nova termina de carregar. */
  private galaxyBackdrop = '';
  /** Fundo pedido para a galáxia atual, carregando ou já ativo. */
  private pendingBackdrop = '';

  /**
   * Corpos celestes que descem ao fundo.
   *
   * São sorteados por FASE, não por universo: antes o planeta vinha de
   * `describeUniverse`, e como o jogador passa quase o tempo todo no universo 0
   * era sempre o mesmo planeta azul no mesmo lugar. Agora cada uma das dez
   * fases de uma galáxia tem seu próprio céu, e ele muda ao viajar.
   */
  private skyProps: {
    key: string;
    /** Posição horizontal em fração da largura, para sobreviver ao resize. */
    fx: number;
    y: number;
    size: number;
    speed: number;
    alpha: number;
  }[] = [];

  private encounterKey = '';
  private cleared = false;

  /** Segundos restantes do painel de vitória. 0 = não está em vitória. */
  private victory = 0;
  private victoryKind: 'onda' | 'elite' | 'chefe' = 'onda';
  private victoryLabel = '';
  private victoryPhase = 1;
  private victorySector = 1;
  /** A fase inteira acabou, não só mais uma onda dela. */
  private victoryLast = false;
  /** Último `dt`, para a contagem da vitória rodar fora de `update`. */
  private lastDt = 1 / 60;
  private shake = 0;
  private flash = 0;
  private banner = '';
  private bannerTime = 0;
  private threat = 0;

  readonly player: Player = {
    x: VIEW.w / 2, y: VIEW.h * 0.75, vx: 0, vy: 0,
    hp: 1, hpMax: 1, shield: 0, shieldMax: 0, shieldLock: 0,
    radius: 15, fireTimer: 0, invuln: 1.2, bank: 0,
    alive: true, deathTimer: 0,
  };

  constructor(
    private readonly surface: Surface,
    private readonly sim: Sim,
  ) {
    this.syncEncounter(true);
  }

  resize(cssW: number, cssH: number): void {
    this.surface.resize(cssW, cssH, VIEW.w, VIEW.h);
  }

  /** Recria o estado da nave a partir dos atributos atuais. */
  refreshPlayer(full = false): void {
    const s = this.sim.stats;
    const hpRatio = full ? 1 : clamp01(this.player.hp / Math.max(1, this.player.hpMax));
    const shRatio = full ? 1 : clamp01(this.player.shield / Math.max(1, this.player.shieldMax));
    this.player.hpMax = s.vida;
    this.player.shieldMax = s.escudo;
    this.player.hp = s.vida * hpRatio;
    this.player.shield = s.escudo * shRatio;
  }

  /** Detecta troca de encontro (pelo caminho ao vivo ou pelo abstrato). */
  private syncEncounter(force = false): void {
    const e = this.sim.encounter;
    const key = `${this.sim.state.universe.index}:${e.sector}:${e.wave}`;
    if (!force && key === this.encounterKey) return;

    this.encounterKey = key;
    this.cleared = false;
    this.director.begin(e);
    this.bullets.clear();
    this.enemies.clear();
    this.ai.reset();

    if (e.kind === 'chefe' && e.boss) {
      this.setBanner(e.boss.name.toUpperCase());
    } else if (e.kind === 'elite') {
      this.setBanner('GUARDA DE ELITE');
    } else {
      // O perfil da onda vira aviso porque senão a variedade não é percebida:
      // um enxame de trinta naves fracas e uma vanguarda de duas que atiram o
      // triplo gastam o mesmo orçamento de vida, e sem o nome o jogador só vê
      // "a onda de sempre com números diferentes".
      this.setBanner(e.perfil.toUpperCase());
    }

    // Cada galáxia tem seu próprio pano de fundo E seu próprio par de campos de
    // estrela: atravessar dez fases e ver o céu mudar é o que dá a sensação de
    // ter viajado. Antes as estrelas eram as mesmas do setor 1 ao 200.
    const galaxy = describeGalaxy(galaxyOfSector(e.sector));
    if (galaxy.backdrop !== this.pendingBackdrop) {
      this.pendingBackdrop = galaxy.backdrop;

      // Só troca depois de carregar: assumir na hora deixava a tela preta por
      // um instante a cada mudança de galáxia, enquanto a imagem vinha.
      void assets.image(galaxy.backdrop)
        .then(() => { this.galaxyBackdrop = galaxy.backdrop; })
        .catch(() => console.warn(`[cena] fundo ${galaxy.backdrop} indisponível`));

      this.skyLayers.forEach((layer, i) => {
        const next = `bg/campo_${galaxy.starfields[i] ?? 'grandes'}.png`;
        void assets.image(next)
          .then(() => { layer.src = next; layer.tint = galaxy.starTint; })
          .catch(() => console.warn(`[cena] campo ${next} indisponível`));
      });
    }

    this.buildSkyProps(e.sector);
  }

  /**
   * Monta os corpos celestes desta fase.
   *
   * A semente é o setor, então o céu é estável: sair e voltar à mesma fase
   * mostra o mesmo arranjo, e cada fase da galáxia tem o seu.
   */
  private buildSkyProps(sector: number): void {
    const rng = new Rng(hashString(`ceu:${sector}`));

    // O corpo principal da fase é o mesmo que o mapa de galáxias mostra — o
    // jogador reconhece para onde viajou sem ler o número do setor.
    const phase = galaxyPhases(galaxyOfSector(sector))[phaseOfSector(sector) - 1];
    const hero = phase?.icon ?? `planeta/${PLANET_KEYS[0]}`;

    // Vizinhança: luas, anões, estações, anéis e anomalias. Sortear de famílias
    // DIFERENTES é o que faz duas fases seguidas não se parecerem — com um só
    // catálogo de planetas, o céu virava "outra esfera no mesmo lugar".
    const vizinhos = [...SKY_FAMILIES];
    rng.shuffle(vizinhos);

    // As alturas iniciais já ENTRAM na tela. Antes todas nasciam acima do topo e,
    // com 14–22 px/s, o primeiro corpo levava meio minuto para aparecer — o
    // jogador trocava de fase e via um céu vazio, que é justamente a queixa que
    // motivou trocar os planetas.
    const props: typeof this.skyProps = [
      // Herói: grande, próximo, mais opaco.
      { key: hero, fx: rng.range(0.12, 0.82), y: rng.range(-460, 520), size: rng.range(250, 420), speed: rng.range(14, 22), alpha: 0.78 },
      // Distantes: pequenos, lentos e apagados, só para dar profundidade.
      { key: rng.pick(vizinhos[0]!), fx: rng.range(0.05, 0.95), y: rng.range(-1500, 780), size: rng.range(96, 168), speed: rng.range(5, 9), alpha: 0.42 },
      { key: rng.pick(vizinhos[1]!), fx: rng.range(0.05, 0.95), y: rng.range(-2600, 900), size: rng.range(64, 116), speed: rng.range(3, 6), alpha: 0.3 },
    ];

    // Uma nebulosa ao fundo em parte das fases: enorme, quase transparente e
    // lentíssima. Não se lê como objeto, se lê como cor no vazio.
    if (rng.chance(0.55)) {
      props.push({
        key: rng.pick(SKY_NEBULAE),
        fx: rng.range(0.15, 0.85), y: rng.range(-2600, -600),
        size: rng.range(560, 900), speed: rng.range(2, 4), alpha: 0.22,
      });
    }

    // Cometa: rápido, minúsculo, atravessa a tela e some. Dá vida ao fundo sem
    // competir com os inimigos.
    if (rng.chance(0.4)) {
      props.push({
        key: rng.pick(SKY_COMETS),
        fx: rng.range(0.08, 0.92), y: rng.range(-2400, -700),
        size: rng.range(90, 150), speed: rng.range(52, 88), alpha: 0.6,
      });
    }

    // A ordem de desenho é do fim para o começo, então o que precisa ficar
    // atrás de tudo vai para o fim da lista.
    this.skyProps = props.sort((a, b) => b.size * (1 - b.alpha) - a.size * (1 - a.alpha));
  }

  private setBanner(text: string): void {
    this.banner = text;
    this.bannerTime = 2.4;
  }

  /** Rola os corpos celestes e as camadas de estrela. */
  private advanceSky(dt: number): void {
    for (const prop of this.skyProps) {
      prop.y += prop.speed * dt;
      // Reentra por cima com folga proporcional ao tamanho, para o corpo não
      // "piscar" reaparecendo colado na borda.
      if (prop.y > VIEW.h + prop.size) {
        prop.y = -prop.size - this.rng.range(200, 1400);
        prop.fx = this.rng.range(0.05, 0.95);
      }
    }
    for (const layer of this.skyLayers) layer.update(dt, 60);
  }

  // ── ciclo ─────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.lastDt = dt;
    this.syncEncounter();
    if (this.player.hpMax <= 0) this.refreshPlayer(true);

    // Durante a vitória o combate congela: só o cenário, as partículas e a
    // contagem seguem. Impede que a onda seguinte comece a nascer por trás do
    // painel de conquista.
    if (this.victory > 0) {
      this.elapsed += dt;
      this.advanceSky(dt);
      this.shake = damp(this.shake, 0, 0.09, dt);
      this.particles.update(dt);
      this.checkCleared();
      return;
    }

    this.elapsed += dt;
    this.advanceSky(dt);

    this.shake = damp(this.shake, 0, 0.09, dt);
    this.flash = damp(this.flash, 0, 0.07, dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);

    this.updatePlayer(dt);
    this.director.update(dt, this.enemies, (def, x, y, hp, damage) => this.spawnEnemy(def, x, y, hp, damage));
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.particles.update(dt);

    this.checkCleared();
  }

  // ── jogador ───────────────────────────────────────────────────────────────

  private updatePlayer(dt: number): void {
    const p = this.player;
    const stats = this.sim.stats;

    // Espelha os vitais na simulação para a interface ler sem tocar na cena.
    const vitals = this.sim.vitals;
    vitals.hp = p.hp;
    vitals.hpMax = p.hpMax;
    vitals.shield = p.shield;
    vitals.shieldMax = p.shieldMax;
    vitals.alive = p.alive;

    if (!p.alive) {
      p.deathTimer -= dt;
      if (p.deathTimer <= 0) {
        this.sim.failEncounter();
        this.syncEncounter(true);
        p.alive = true;
        p.invuln = 2;
        p.x = VIEW.w / 2;
        p.y = VIEW.h * 0.78;
        p.vx = 0;
        p.vy = 0;
        this.refreshPlayer(true);
      }
      return;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldLock = Math.max(0, p.shieldLock - dt);

    if (p.shieldLock <= 0 && p.shield < p.shieldMax) {
      p.shield = Math.min(p.shieldMax, p.shield + stats.regen * dt);
    }

    const cmd = this.ai.update(dt, p, this.enemies, this.bullets, this.pickups, stats.iaSkill, this.sim.state.settings.pilot);
    this.threat = damp(this.threat, cmd.threat, 0.12, dt);

    const speed = stats.velocidade;
    const accel = speed * 7.5;
    p.vx += cmd.dx * accel * dt;
    p.vy += cmd.dy * accel * dt;

    if (cmd.dash) {
      const len = Math.hypot(cmd.dx, cmd.dy) || 1;
      p.vx += (cmd.dx / len) * speed * 2.1;
      p.vy += (cmd.dy / len) * speed * 2.1;
      p.invuln = Math.max(p.invuln, 0.22);
      this.particles.shockwave(p.x, p.y, 42, 'rgba(160,230,255,.9)', 0.3);
    }

    // Atrito: sem isso a nave orbita o alvo em vez de assentar nele.
    const drag = Math.max(0, 1 - 5.5 * dt);
    p.vx *= drag;
    p.vy *= drag;
    const v = Math.hypot(p.vx, p.vy);
    const cap = speed * (cmd.dash ? 2.6 : 1);
    if (v > cap) {
      p.vx = (p.vx / v) * cap;
      p.vy = (p.vy / v) * cap;
    }

    p.x = clamp(p.x + p.vx * dt, 26, VIEW.w - 26);
    p.y = clamp(p.y + p.vy * dt, 70, VIEW.h - 40);
    p.bank = damp(p.bank, clamp(p.vx / Math.max(1, speed), -1, 1), 0.08, dt);

    this.particles.thrust(p.x, p.y + 20, 0, 1, this.sim.hull.trail, 0.4);

    p.fireTimer -= dt;
    if (cmd.fire && p.fireTimer <= 0) {
      const rate = stats.cadencia;
      p.fireTimer = 1 / Math.max(0.2, rate);
      this.firePlayer();
    }
  }

  private firePlayer(): void {
    const p = this.player;
    const stats = this.sim.stats;
    const style = this.sim.hull.shot;
    const count = stats.projeteis;

    // A arte do tiro segue o ELEMENTO quando ele não é o nativo do casco: se o
    // jogador equipou um canhão de gelo numa nave de fogo, o que sai da nave
    // precisa ser azul. Enquanto os dois coincidem vale a arte própria do casco,
    // que é mais caracterizada que o projétil genérico.
    const element = this.sim.element;
    const nativo = element === this.sim.hull.element;
    const info = getElement(element);
    const sprite = nativo ? style.sprite : info.bullet[0];
    const color = nativo ? style.color : info.color;
    const scale = nativo ? style.scale : 0.9;

    for (let i = 0; i < count; i++) {
      const b = this.bullets.spawn();
      if (!b) break;
      // Leque simétrico: para 1 projétil o offset é 0, para 2 é ±0.5, etc.
      const offset = count === 1 ? 0 : i - (count - 1) / 2;
      const angle = -Math.PI / 2 + offset * style.spread;
      const crit = this.rng.chance(stats.critChance);

      b.friendly = true;
      b.x = p.x + offset * 9;
      b.y = p.y - 18;
      b.vx = Math.cos(angle) * style.speed;
      b.vy = Math.sin(angle) * style.speed;
      b.radius = 7;
      b.damage = stats.dano * (crit ? 1 + stats.critDano : 1);
      b.crit = crit;
      b.element = element;
      b.sprite = sprite;
      b.color = color;
      b.scale = scale;
      b.pierce = stats.perfuracao;
      b.splash = stats.explosao;
    }

    this.particles.sparks(p.x, p.y - 20, 3, color, 90, 0.9, -Math.PI / 2);
  }

  /**
   * Dano recebido, já passado pelo anel e pela resistência.
   *
   * O confronto usa o elemento do ESCUDO equipado, não o da arma: defender é
   * uma decisão separada de atacar, e é o que faz o jogador trocar de escudo ao
   * mudar de galáxia em vez de carregar sempre o de maior número.
   */
  private damagePlayer(amount: number, element: ElementId = 'padrao'): void {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;

    const mitigacao = Math.min(
      MULT_ELEMENTAL_MAX,
      matchup(element, this.sim.defenseElement) * (1 - this.sim.resistance(element)),
    );
    amount *= mitigacao;
    // No modo de teste o dano ainda dá feedback visual, mas não mata: o ponto
    // é inspecionar conteúdo, não sobreviver a ele.
    if (this.sim.testMode) {
      this.particles.sparks(p.x, p.y, 6, '#ff6a5a', 150);
      return;
    }

    p.shieldLock = SHIELD_LOCK;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      amount -= absorbed;
      this.particles.shockwave(p.x, p.y, 30, 'rgba(90,190,255,.8)', 0.25);
    }
    if (amount <= 0) return;

    p.hp -= amount;
    this.shake = 6;
    this.flash = 0.35;
    this.particles.sparks(p.x, p.y, 10, '#ff6a5a', 190);

    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      p.deathTimer = RESPAWN_DELAY;
      this.particles.burst('blast/fire', p.x, p.y, 2.2);
      this.particles.debris(p.x, p.y, 16, '#8fa2bb', 190);
      this.shake = 14;
      this.setBanner('CASCO PERDIDO');
    }
  }

  // ── inimigos ──────────────────────────────────────────────────────────────

  private spawnEnemy(def: EnemyDef, x: number, y: number, hp: number, damage: number): Enemy | null {
    const e = this.enemies.spawn();
    if (!e) return null;
    e.def = def;
    e.x = x;
    e.y = y;
    e.hp = hp;
    e.maxHp = hp;
    e.radius = def.radius;
    e.scale = def.scale;
    // `damage` chega como o dano-base do setor; o arquétipo o modula.
    e.damage = damage * (def.dano || 1);
    e.anchorX = clamp(x, 60, VIEW.w - 60);
    e.anchorY = this.rng.range(VIEW.h * 0.12, VIEW.h * 0.42);
    e.fireTimer = this.rng.range(0.4, 1.6);
    e.wobble = this.rng.range(0, TAU);
    e.entering = true;
    return e;
  }

  private updateEnemies(dt: number): void {
    const p = this.player;

    this.enemies.each((e) => {
      // `time` negativo é atraso de entrada escalonado dentro de um grupo.
      e.time += dt;
      if (e.time < 0) return;
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.boss) this.updateBoss(e, dt);
      else this.moveEnemy(e, dt);

      // Mantidos dentro da área jogável: um inimigo pela metade fora da tela é
      // impossível de acertar e faz a IA perseguir a parede.
      e.x = clamp(e.x, 28, VIEW.w - 28);
      if (e.y > VIEW.h + 90) {
        // Escapou. Não conta como abate e VOLTA PARA A FILA: deixar passar não
        // pode ser um jeito de limpar a onda, que é exatamente o buraco que o
        // antigo modelo de poço existia para tapar.
        e.alive = false;
        if (e.counts) this.director.requeue(e.def, e.hp);
        return;
      }

      if (!e.boss) this.enemyAttack(e, dt);

      // Colisão com a nave.
      if (p.alive && p.invuln <= 0) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < e.radius * e.scale + p.radius) {
          // Colisão dói mais que um tiro, mas o inimigo se despedaça junto.
          this.damagePlayer(e.damage * 2.6, e.boss?.element ?? e.def.element);
          if (!e.boss) this.killEnemy(e, false);
        }
      }
    });
    this.enemies.compact();
  }

  private moveEnemy(e: Enemy, dt: number): void {
    const p = this.player;
    const def = e.def;

    // Padrões sem ponto de âncora consideram a entrada concluída assim que
    // aparecem na tela. Sem isso ficariam presos em `entering` para sempre e
    // nunca atirariam — o inimigo desceria em silêncio.
    if (def.move === 'mergulho' || def.move === 'senoide' || def.move === 'deriva') {
      e.entering = e.y < 30;
    }

    switch (def.move) {
      case 'mergulho':
        e.vy = lerp(e.vy, def.speed * 1.35, dt * 1.2);
        e.vx = damp(e.vx, Math.sin(e.time * 1.3 + e.wobble) * 40, 0.4, dt);
        break;

      case 'senoide':
        e.vy = def.speed * 0.72;
        e.vx = Math.cos(e.time * 2.1 + e.wobble) * def.speed * 0.9;
        break;

      case 'pairar':
        if (e.entering) {
          e.vy = def.speed * 1.5;
          if (e.y >= e.anchorY) e.entering = false;
        } else {
          e.vy = damp(e.vy, Math.sin(e.time * 0.8 + e.wobble) * 18, 0.3, dt);
          e.vx = Math.cos(e.time * 0.9 + e.wobble) * def.speed * 0.8;
        }
        break;

      case 'deriva':
        e.vy = def.speed;
        e.vx = Math.sin(e.wobble) * def.speed * 0.4;
        e.spin += dt * 1.4;
        break;

      case 'investida': {
        if (e.entering) {
          e.vy = def.speed * 0.9;
          if (e.y >= e.anchorY) {
            e.entering = false;
            // Trava o vetor de investida no momento da decisão: reajustar em
            // tempo real transformaria a manobra num perseguidor imbatível.
            const dx = p.x - e.x;
            const dy = Math.max(60, p.y - e.y);
            const len = Math.hypot(dx, dy) || 1;
            e.vx = (dx / len) * def.speed * 1.8;
            e.vy = (dy / len) * def.speed * 1.8;
          }
        }
        break;
      }

      case 'orbita': {
        if (e.entering) {
          e.vy = def.speed * 1.4;
          if (e.y >= e.anchorY) {
            e.entering = false;
            e.vy = 0;
          }
        } else {
          const r = 120;
          const a = e.time * 0.8 + e.wobble;
          const tx = e.anchorX + Math.cos(a) * r;
          const ty = e.anchorY + Math.sin(a) * r * 0.45;
          e.vx = (tx - e.x) * 3;
          e.vy = (ty - e.y) * 3;
        }
        break;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.facing = damp(e.facing, clamp(e.vx / Math.max(1, def.speed), -1, 1), 0.1, dt);
  }

  private updateBoss(e: Enemy, dt: number): void {
    const boss = e.boss!;
    const frac = clamp01(e.hp / e.maxHp);

    // Fases entram por limiar de vida; `phases` está em ordem decrescente de `at`.
    let phaseIndex = 0;
    for (let i = 0; i < boss.phases.length; i++) {
      if (frac <= boss.phases[i]!.at) phaseIndex = i;
    }
    if (phaseIndex !== e.phase) {
      e.phase = phaseIndex;
      const telegraph = boss.phases[phaseIndex]!.telegraph;
      if (telegraph) this.setBanner(telegraph.toUpperCase());
      this.particles.shockwave(e.x, e.y, 200, 'rgba(255,120,90,.9)', 0.6);
      this.shake = 8;
    }

    const phase = boss.phases[e.phase]!;

    if (e.entering) {
      e.y = damp(e.y, e.anchorY, 0.5, dt);
      if (Math.abs(e.y - e.anchorY) < 6) e.entering = false;
      return;
    }

    e.x = e.anchorX + Math.sin(e.time * 0.6) * (phase.strafe * 1.4);
    e.x = clamp(e.x, 90, VIEW.w - 90);
    e.y = e.anchorY + Math.sin(e.time * 0.9) * 22;

    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = 1 / Math.max(0.1, phase.fireRate);
      this.emitPattern(e, phase.attack, phase.shots, phase.bulletSpeed, boss.bulletSprite, boss.bulletColor, 1.1);
    }

    if (phase.summon) {
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = phase.summon.every;
        this.summonMinions(phase.summon.enemy, phase.summon.count, e);
      }
    }
  }

  private summonMinions(enemyId: string, count: number, source: Enemy): void {
    // Import tardio evita ciclo entre dados e cena.
    const def = MINION_CACHE.get(enemyId);
    if (!def) return;
    const hp = source.maxHp * 0.035;
    for (let i = 0; i < count; i++) {
      const x = clamp(source.x + this.rng.range(-160, 160), 60, VIEW.w - 60);
      const e = this.spawnEnemy(def, x, -50 - i * 40, hp, source.damage * 0.6);
      if (e) {
        e.share = 0;
        e.counts = false; // pressão, não progresso
      }
    }
  }

  private enemyAttack(e: Enemy, dt: number): void {
    const def = e.def;
    if (def.attack === 'nenhum' || e.entering) return;

    if (def.attack === 'explosivo') {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < 96 && this.player.alive) {
        this.particles.burst('blast/void', e.x, e.y, 1.5);
        this.damagePlayer(e.damage * 4, def.element);
        this.shake = 7;
        this.killEnemy(e, false);
      }
      return;
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    // A pressão do perfil da onda entra aqui: é o eixo "quantos tiros", que
    // deixa a tela mais perigosa sem inflar nenhum número da ficha.
    e.fireTimer = 1 / Math.max(0.05, def.fireRate * e.pressao);
    this.emitPattern(e, def.attack, def.shots, def.bulletSpeed, def.bulletSprite, def.bulletColor, 1);
  }

  private emitPattern(
    e: Enemy,
    pattern: string,
    shots: number,
    speed: number,
    sprite: string,
    color: string,
    scale: number,
  ): void {
    const p = this.player;
    const v = speed;
    const damage = e.damage;

    const emit = (angle: number, homing = 0): void => {
      const b = this.bullets.spawn();
      if (!b) return;
      b.friendly = false;
      b.x = e.x;
      b.y = e.y + e.radius * e.scale * 0.5;
      b.vx = Math.cos(angle) * v;
      b.vy = Math.sin(angle) * v;
      b.radius = 8 * scale;
      b.damage = damage;
      b.element = e.boss?.element ?? e.def.element;
      b.sprite = sprite;
      b.color = color;
      b.scale = 0.6 * scale;
      b.homing = homing;
      b.pierce = 0;
      b.splash = 0;
    };

    const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);

    switch (pattern) {
      case 'direto':
        for (let i = 0; i < shots; i++) {
          emit(Math.PI / 2 + (i - (shots - 1) / 2) * 0.16);
        }
        break;

      case 'mirado':
        for (let i = 0; i < shots; i++) {
          emit(toPlayer + (i - (shots - 1) / 2) * 0.12);
        }
        break;

      case 'leque': {
        const arc = Math.min(TAU * 0.6, 0.22 * shots);
        for (let i = 0; i < shots; i++) {
          const t = shots === 1 ? 0.5 : i / (shots - 1);
          emit(Math.PI / 2 - arc / 2 + arc * t);
        }
        break;
      }

      case 'espiral':
        e.spin += 0.42;
        for (let i = 0; i < shots; i++) {
          emit(e.spin + (TAU / shots) * i);
        }
        break;

      case 'teleguiado':
        for (let i = 0; i < shots; i++) {
          emit(toPlayer + (i - (shots - 1) / 2) * 0.5, 2.2);
        }
        break;
    }
  }

  private killEnemy(e: Enemy, byPlayer: boolean): void {
    e.alive = false;
    // A animação de destruição própria da nave vale mais que uma explosão
    // genérica: ela desmonta o casco daquele modelo específico.
    const own = e.def.deathClip && getClip(e.def.deathClip) ? e.def.deathClip : null;
    const clip = own ?? (getClip(e.def.blast) ? e.def.blast : 'blast/fire');
    this.particles.burst(clip, e.x, e.y, own ? e.scale : e.scale * (e.boss ? 3.4 : 1.5));
    this.particles.debris(e.x, e.y, e.boss ? 26 : 6, '#9aa7bd', e.boss ? 240 : 120);
    this.shake = Math.max(this.shake, e.boss ? 16 : 2.5);

    if (!byPlayer) return;

    // É AQUI que o encontro anda. `counts` é falso nos lacaios invocados por
    // chefe: eles pressionam, mas matá-los não pode substituir matar o chefe.
    if (e.counts) this.sim.creditKill();
    this.sim.rewardKill(e.boss ? 1 : Math.max(e.share, 0.02));

    // Cápsula de moeda: uma fração dos abates deixa recompensa para a IA
    // coletar. Não é melhoria — os power-ups de reparo, escudo e dano saíram
    // com o §30, e o que restou aqui é economia, não poder.
    if (e.boss || this.rng.chance(0.07 + this.sim.stats.sorte * 0.05)) {
      this.spawnPickup(e.x, e.y, 'recompensa');
    }

    // Loot físico: o item é rolado agora e vira uma cápsula na tela. Só entra
    // no inventário se a IA alcançar a cápsula.
    const rolls = this.sim.rollDrops(e.boss ? 'chefe' : e.def.elite ? 'elite' : 'onda');
    for (const item of rolls) this.spawnLoot(e.x, e.y, item);
  }

  private spawnLoot(x: number, y: number, item: Item): void {
    const p = this.pickups.spawn();
    if (!p) return;
    p.kind = 'item';
    p.item = item;
    p.icon = item.icon;
    p.color = rarityInfo(item.rarity).color;
    p.x = x;
    p.y = y;
    p.vy = 40;
    p.vx = this.rng.range(-40, 40);
  }

  // ── projéteis ─────────────────────────────────────────────────────────────

  private updateBullets(dt: number): void {
    const p = this.player;

    this.bullets.each((b) => {
      b.life += dt;

      if (b.homing > 0 && p.alive) {
        const desired = Math.atan2(p.y - b.y, p.x - b.x);
        const current = Math.atan2(b.vy, b.vx);
        let diff = desired - current;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const speed = Math.hypot(b.vx, b.vy);
        const next = current + clamp(diff, -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(next) * speed;
        b.vy = Math.sin(next) * speed;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -60 || b.x > VIEW.w + 60 || b.y < -80 || b.y > VIEW.h + 80 || b.life > 8) {
        b.alive = false;
        return;
      }

      if (b.friendly) {
        this.enemies.each((e) => {
          if (!b.alive || !e.alive || e.time < 0 || e.id === b.hitId) return;
          const r = e.radius * e.scale + b.radius;
          if (Math.hypot(e.x - b.x, e.y - b.y) > r) return;

          this.hitEnemy(e, b);
          b.hitId = e.id;
          if (b.pierce > 0) b.pierce--;
          else b.alive = false;
        });
      } else if (p.alive && p.invuln <= 0) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius) {
          b.alive = false;
          this.damagePlayer(b.damage, b.element);
          this.particles.sparks(b.x, b.y, 6, b.color, 130);
        }
      }
    });
    this.bullets.compact();
  }

  private hitEnemy(e: Enemy, b: Bullet): void {
    // O confronto entra AQUI, e não no dano do projétil, porque depende de quem
    // levou o tiro: a mesma salva pode ser vantagem contra um caça e resistida
    // contra o elite ao lado.
    const mul = Math.min(
      MULT_ELEMENTAL_MAX,
      matchup(b.element, e.boss?.element ?? e.def.element),
    );
    const dano = b.damage * mul;

    this.applyDamage(e, dano);
    e.hitFlash = 0.09;
    this.particles.sparks(b.x, b.y, b.crit ? 8 : 4, b.crit ? '#ffe08a' : b.color, b.crit ? 190 : 130);

    if (this.sim.state.settings.showDamageNumbers) {
      // Vantagem sai maior e na cor do elemento, resistência sai apagada: o
      // jogador aprende o anel olhando os números, sem abrir tabela nenhuma.
      const forte = mul > 1.01;
      const fraco = mul < 0.99;
      const cor = b.crit ? '#ffd35a' : forte ? getElement(b.element).glow : fraco ? '#7e8aa0' : '#e8f2ff';
      const tam = (b.crit ? 16 : 12) * (forte ? 1.25 : fraco ? 0.85 : 1);
      this.particles.popup(e.x + this.rng.range(-8, 8), e.y - 12, fmt(dano, 1), cor, tam);
    }

    if (b.splash > 0) {
      this.particles.shockwave(b.x, b.y, b.splash, 'rgba(255,170,90,.8)', 0.22);
      this.enemies.each((other) => {
        if (other === e || !other.alive) return;
        if (Math.hypot(other.x - b.x, other.y - b.y) > b.splash) return;
        const outroMul = matchup(b.element, other.boss?.element ?? other.def.element);
        this.applyDamage(other, b.damage * outroMul * 0.45);
        other.hitFlash = 0.07;
        if (other.hp <= 0) this.killEnemy(other, true);
      });
    }

    if (e.hp <= 0) this.killEnemy(e, true);
  }

  /**
   * Aplica dano. O encontro NÃO anda por aqui — anda por abate.
   *
   * Creditar por dano fazia a onda terminar com naves ainda vivas na tela, o
   * que fica estranho e some com a sensação de ter limpado alguma coisa. Quem
   * credita agora é `killEnemy`, e o caminho abstrato converte dano por segundo
   * em abates por segundo para os dois medirem a mesma coisa.
   */
  private applyDamage(e: Enemy, amount: number): void {
    e.hp -= amount;
  }

  // ── coletáveis ────────────────────────────────────────────────────────────

  private spawnPickup(x: number, y: number, kind: PickupKind): void {
    const p = this.pickups.spawn();
    if (!p) return;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vy = 70;
    p.vx = this.rng.range(-30, 30);
  }

  private updatePickups(dt: number): void {
    const p = this.player;

    this.pickups.each((item) => {
      item.time += dt;
      // Ímã: a partir de certa distância o item vem sozinho, o que evita que a
      // IA abandone o combate para buscar drops longe.
      const dx = p.x - item.x;
      const dy = p.y - item.y;
      const d = Math.hypot(dx, dy);
      if (d < 130) item.magnet = true;

      // Cápsulas de item têm ímã maior: perder equipamento por centímetros
      // seria frustrante de assistir, já que o jogador não pilota.
      if (item.kind === 'item' && d < 230) item.magnet = true;

      if (item.magnet && p.alive) {
        const pull = 520;
        item.vx = damp(item.vx, (dx / (d || 1)) * pull, 0.12, dt);
        item.vy = damp(item.vy, (dy / (d || 1)) * pull, 0.12, dt);
      } else {
        item.vy = damp(item.vy, 90, 0.4, dt);
      }

      item.x += item.vx * dt;
      item.y += item.vy * dt;

      if (item.y > VIEW.h + 60) {
        item.alive = false;
        return;
      }
      if (p.alive && d < p.radius + 22) {
        item.alive = false;
        if (item.kind === 'item' && item.item) {
          this.sim.acquire(item.item);
          this.particles.shockwave(p.x, p.y, 44, item.color, 0.35);
          this.particles.sparks(p.x, p.y, 10, item.color, 170);
        } else {
          this.collect(item.kind);
        }
      }
    });
    this.pickups.compact();
  }

  private collect(kind: PickupKind): void {
    const p = this.player;
    const stats = this.sim.stats;

    if (kind === 'recompensa') {
      // Cápsula coletada em combate: vai para a carga da incursão, e some se a
      // nave cair antes de o setor fechar.
      this.sim.grantCarga('nucleo', this.sim.encounter.bounty * 0.25 * (1 + stats.nucleoGanho));
      this.sim.grantCarga('sucata', this.sim.encounter.bounty * 1.2 * (1 + stats.sucataGanho));
    }
    this.particles.shockwave(p.x, p.y, 36, PICKUP_COLOR[kind], 0.3);
  }

  // ── fim de encontro ───────────────────────────────────────────────────────

  /**
   * O encontro termina quando o POOL de vida zera — a mesma condição que o
   * caminho abstrato usa. Esvaziar a tela não basta: se os inimigos escaparam
   * pela base, o director repõe a onda até o pool ser realmente cortado.
   *
   * Ao limpar, entra a pausa de vitória: o avanço só acontece depois dela, para
   * a conquista ter um instante próprio em vez de a próxima onda já estar
   * descendo antes de o jogador perceber que venceu.
   */
  private checkCleared(): void {
    if (this.victory > 0) {
      this.victory -= this.lastDt;
      if (this.victory <= 0) {
        this.sim.completeEncounter();
        this.syncEncounter(true);
      }
      return;
    }
    if (this.cleared) return;

    if (this.sim.state.run.restam > 0) {
      // Ainda falta abater e a tela esvaziou: repõe a onda. Acontece quando os
      // inimigos escaparam mais rápido do que o jogador conseguiu derrubá-los.
      if (this.player.alive && this.director.remaining === 0 && this.enemies.size === 0) {
        this.director.replenish();
      }
      return;
    }
    if (!this.player.alive) return;

    this.cleared = true;
    this.bullets.each((b) => {
      if (!b.friendly) b.alive = false;
    });
    this.enemies.clear();
    this.beginVictory();
  }

  /** Prepara o painel de vitória e começa a contagem. */
  private beginVictory(): void {
    const e = this.sim.encounter;
    this.victory = VICTORY_HOLD;
    this.victoryKind = e.kind;
    this.victoryLabel = e.kind === 'chefe' ? (e.boss?.name ?? 'Chefe') : e.kind === 'elite' ? 'Guarda de Elite' : `Onda ${e.wave}`;
    this.victoryPhase = phaseOfSector(e.sector);
    this.victorySector = e.sector;
    this.victoryLast = e.wave > WAVES_PER_SECTOR;

    // Fogos proporcionais ao feito: um chefe merece mais que uma onda comum.
    const bursts = e.kind === 'chefe' ? 26 : e.kind === 'elite' ? 14 : 7;
    for (let i = 0; i < bursts; i++) {
      this.particles.burst(
        this.rng.pick(['arc/boom_fogo', 'arc/boom_plasma', 'arc/boom_vazio', 'arc/boom_rubro']),
        this.rng.range(VIEW.w * 0.15, VIEW.w * 0.85),
        this.rng.range(VIEW.h * 0.15, VIEW.h * 0.7),
        this.rng.range(0.9, 2.2),
      );
    }
    this.shake = e.kind === 'chefe' ? 10 : 4;
  }

  // ── desenho ───────────────────────────────────────────────────────────────

  draw(): void {
    const s = this.surface;
    s.begin(true);
    s.fill('#03040c');

    this.drawBackground(s);

    const jitter = this.shake > 0.1 ? this.shake : 0;
    s.ctx.save();
    if (jitter) s.ctx.translate(this.rng.range(-jitter, jitter), this.rng.range(-jitter, jitter));

    this.drawPickups(s);
    this.drawEnemies(s);
    this.drawPlayer(s);
    this.drawBullets(s);
    this.particles.draw(s);

    s.ctx.restore();

    if (this.flash > 0.01) {
      s.ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.4})`;
      s.ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }

    this.drawHud(s);
  }

  private drawBackground(s: Surface): void {
    // Pano de fundo da galáxia: cobre a tela inteira, bem escurecido, só para
    // dar a cor do lugar. As camadas de estrela por cima é que dão movimento.
    const sky = assets.peek(this.galaxyBackdrop);
    if (sky) {
      const scale = Math.max(VIEW.w / sky.width, VIEW.h / sky.height);
      const w = sky.width * scale;
      const hgt = sky.height * scale;
      s.ctx.globalAlpha = 0.75;
      s.ctx.drawImage(sky, (VIEW.w - w) / 2, (VIEW.h - hgt) / 2, w, hgt);
      s.ctx.globalAlpha = 1;
    }

    // A antiga coluna de nebulosa tinha 295px de largura e era esticada para a
    // tela toda — num campo de ~1180px isso virava um borrão com emenda visível.
    // O fundo de galáxia cobre esse papel melhor, e as camadas de estrela dão o
    // movimento.
    for (const layer of this.skyLayers) layer.draw(s);

    // Corpos celestes: os distantes primeiro, para o corpo da fase ficar por
    // cima. `fx` é fração da largura, então mudar de janela não os desloca.
    //
    // Saem do atlas `orbe`, não de imagens soltas: cada corpo tem proporção
    // própria (um anel é largo e baixo, uma cauda de cometa é oblíqua) e forçar
    // tudo num quadrado, como fazia o `drawImage` anterior, achatava a arte.
    for (let i = this.skyProps.length - 1; i >= 0; i--) {
      const prop = this.skyProps[i]!;
      const found = assets.atlases.lookup(prop.key);
      if (!found) continue;
      const escala = prop.size / Math.max(found.frame.sw, found.frame.sh);
      s.sprite(prop.key, prop.fx * VIEW.w, prop.y + prop.size / 2, { scale: escala, alpha: prop.alpha });
    }
  }

  private drawPlayer(s: Surface): void {
    const p = this.player;
    if (!p.alive) return;

    const hull = this.sim.hull;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
    const alpha = blink ? 0.4 : 1;

    s.glow(p.x, p.y + 22, 26, hull.trail, 0.5);

    // Cascos do pack Void são montados em camadas e trocam de arte conforme o
    // dano — dá para ver a nave se despedaçando sem olhar a barra de vida.
    if (hull.damageStates) {
      const scale = 1.5;
      const boosting = Math.hypot(p.vx, p.vy) > this.sim.stats.velocidade * 0.75;
      const engine = getClip(boosting && hull.boostClip ? hull.boostClip : hull.engineClip ?? '');

      if (hull.enginePart) s.sprite(hull.enginePart, p.x, p.y, { scale, alpha });
      if (engine) s.sprite(frameAt(engine, this.elapsed), p.x, p.y, { scale, alpha });

      const wear = clamp01(1 - p.hp / Math.max(1, p.hpMax));
      const state = hull.damageStates[Math.min(3, Math.floor(wear * 4))]!;
      s.sprite(state, p.x, p.y, { scale, alpha });

      const weapon = getClip(hull.weaponClip ?? '');
      if (weapon) s.sprite(frameAt(weapon, p.fireTimer < 0.2 ? this.elapsed : 0), p.x, p.y, { scale, alpha });
    } else {
      let sprite = hull.sprite;
      if (hull.bank) {
        const idx = clamp(Math.round(p.bank * 2) + 2, 0, 4);
        sprite = hull.bank[idx]!;
      }
      s.sprite(sprite, p.x, p.y, { scale: 0.62, alpha, rotation: p.bank * 0.13 });
    }

    if (p.shield > 1) {
      // A barreira hexagonal da folha arcade comunica a carga pela opacidade;
      // quando o escudo está baixo ela quase some, sem precisar de outra barra.
      const frac = clamp01(p.shield / Math.max(1, p.shieldMax));
      const pulse = 1 + Math.sin(p.shieldLock > 0 ? 0 : performance.now() / 420) * 0.03;
      // O sprite tem 88px; a bolha deve fechar pouco além do raio de colisão.
      s.sprite('barrier/1', p.x, p.y, {
        scale: ((p.radius + 13) * 2 / 88) * pulse,
        alpha: 0.3 + frac * 0.45,
        composite: 'lighter',
      });
    }
  }

  private drawEnemies(s: Surface): void {
    this.enemies.each((e) => {
      if (e.time < 0) return;

      let sprite = e.boss ? e.boss.sprite : e.def.sprite;
      if (!e.boss && e.def.bank) {
        const idx = clamp(Math.round(e.facing * 2) + 2, 0, 4);
        sprite = e.def.bank[idx]!;
      } else if (!e.boss && e.def.clip) {
        const clip = getClip(e.def.clip);
        if (clip) sprite = frameAt(clip, e.time);
      }

      const opts: Parameters<Surface['sprite']>[3] = {
        scale: e.scale,
        rotation: e.def.move === 'deriva' ? e.spin : 0,
        ...(e.hitFlash > 0 ? { tint: '#ffffff', tintAlpha: 0.8 } : {}),
      };

      // As naves do pack Void vêm em camadas separadas: escape atrás do casco,
      // arma e escudo por cima. Montar aqui em vez de achatar no pipeline
      // permite piscar só o casco no dano e pulsar só o escudo.
      const def = e.def;
      if (def.engineClip) {
        const clip = getClip(def.engineClip);
        if (clip) s.sprite(frameAt(clip, e.time), e.x, e.y, { scale: e.scale });
      }

      s.sprite(sprite, e.x, e.y, opts);

      if (def.weaponClip) {
        const clip = getClip(def.weaponClip);
        // A arma anima só quando o inimigo está prestes a disparar.
        if (clip) {
          const firing = e.fireTimer < 0.35;
          s.sprite(frameAt(clip, firing ? e.time : 0), e.x, e.y, { scale: e.scale });
        }
      }
      if (def.shieldClip) {
        const clip = getClip(def.shieldClip);
        if (clip) s.sprite(frameAt(clip, e.time), e.x, e.y, { scale: e.scale, alpha: 0.75, composite: 'lighter' });
      }

      // Barra de vida só para quem não morre num tiro — poluiria a tela.
      if (!e.boss && e.maxHp > 1 && e.hp < e.maxHp) {
        const w = 34;
        const frac = clamp01(e.hp / e.maxHp);
        s.rect(e.x - w / 2, e.y - e.radius * e.scale - 12, w, 3, 'rgba(0,0,0,.55)');
        s.rect(e.x - w / 2, e.y - e.radius * e.scale - 12, w * frac, 3, frac > 0.5 ? '#5ce08a' : frac > 0.25 ? '#ffb638' : '#ff5d7a');
      }
    });
  }

  private drawBullets(s: Surface): void {
    this.bullets.each((b) => {
      const rotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      // Sem mistura aditiva: com cadência e multishot altos são dezenas de
      // sprites sobrepostos, e em `lighter` eles somam até estourar em branco —
      // era o que apagava o cenário inteiro atrás da nave.
      s.sprite(b.sprite, b.x, b.y, {
        scale: b.scale * (b.crit ? 1.25 : 1),
        rotation,
        alpha: 0.92,
      });
    });
  }

  private drawPickups(s: Surface): void {
    this.pickups.each((item) => {
      const bob = Math.sin(item.time * 6) * 2;

      if (item.kind === 'item') {
        // Cápsula de loot: halo pulsante na cor da raridade + o ícone real da
        // peça, para dar para reconhecer o que caiu antes mesmo de coletar.
        const pulse = 0.55 + Math.sin(item.time * 5) * 0.2;
        s.glow(item.x, item.y, 30, item.color, pulse);
        s.ctx.strokeStyle = item.color;
        s.ctx.lineWidth = 1.5;
        s.ctx.globalAlpha = 0.8;
        s.ctx.strokeRect(item.x - 13, item.y - 13 + bob, 26, 26);
        s.ctx.globalAlpha = 1;
        s.sprite(item.icon, item.x, item.y + bob, { scale: 0.5 });
        return;
      }

      s.glow(item.x, item.y, 22, PICKUP_COLOR[item.kind], 0.55);
      const clip = getClip(PICKUP_CLIP[item.kind]);
      if (clip) {
        s.sprite(frameAt(clip, item.time), item.x, item.y + bob, { scale: 1.1 });
      } else {
        s.sprite(PICKUP_SPRITE[item.kind], item.x, item.y + bob, { scale: 0.5, composite: 'lighter' });
      }
    });
  }

  private drawHud(s: Surface): void {
    const p = this.player;
    const sim = this.sim;
    const pad = 16;

    // Barra de casco e escudo, canto superior esquerdo.
    const barW = 190;
    s.rect(pad, pad, barW, 9, 'rgba(6,12,24,.75)');
    s.rect(pad, pad, barW * clamp01(p.hp / Math.max(1, p.hpMax)), 9, '#ff5d7a');
    s.rect(pad, pad + 12, barW, 6, 'rgba(6,12,24,.75)');
    s.rect(pad, pad + 12, barW * clamp01(p.shield / Math.max(1, p.shieldMax)), 6, '#4db8ff');
    s.text(`${fmt(p.hp, 0)} / ${fmt(p.hpMax, 0)}`, pad, pad + 30, { size: 12, color: '#c8d8ee' });

    // Setor e onda, canto superior direito.
    const boss = this.enemies.items.find((e) => e.alive && e.boss);

    s.text(`SETOR ${sim.state.run.sector}`, VIEW.w - pad, pad + 6, { size: 17, color: '#9fe8ff', align: 'right' });
    // Com chefe em tela o nome já aparece na barra dele; repetir aqui só polui.
    if (!boss) s.text(sim.encounterLabel, VIEW.w - pad, pad + 26, { size: 12, color: '#8ba0bd', align: 'right' });

    // Chefe: barra larga no topo.
    if (boss) {
      const w = VIEW.w - pad * 2;
      const frac = clamp01(boss.hp / boss.maxHp);
      s.rect(pad, 62, w, 13, 'rgba(6,12,24,.85)');
      s.rect(pad, 62, w * frac, 13, '#ff7a4d');
      s.text(boss.boss!.name, VIEW.w / 2, 68.5, { size: 12, color: '#fff', align: 'center', shadow: 'rgba(0,0,0,.9)' });
    }

    // Progresso do pool do encontro: é ele que decide quando a onda acaba.
    const pw = VIEW.w - pad * 2;
    s.rect(pad, VIEW.h - 34, pw, 5, 'rgba(255,255,255,.10)');
    s.rect(pad, VIEW.h - 34, pw * clamp01(sim.sectorProgress), 5, '#5ce08a');

    // Indicador de ameaça percebida pela IA — mostra que o piloto está "pensando".
    const tw = 60;
    s.rect(pad, VIEW.h - 22, tw, 4, 'rgba(255,255,255,.12)');
    s.rect(pad, VIEW.h - 22, tw * clamp01(this.threat), 4, this.threat > 0.7 ? '#ff5d7a' : '#ffb638');
    s.text('AMEAÇA', pad + tw + 8, VIEW.h - 20, { size: 9, color: '#6f83a0' });

    // Aviso de parede: a onda já se repetiu e o pool mal andou.
    if (this.director.cycles >= 2 && sim.sectorProgress < 0.5) {
      s.text('PROGRESSO TRAVADO · REFORCE A NAVE', VIEW.w / 2, VIEW.h - 52, {
        size: 13, color: '#ff8a9a', align: 'center', shadow: 'rgba(0,0,0,.85)',
      });
    }

    if (this.bannerTime > 0) {
      const a = clamp01(this.bannerTime / 0.6);
      s.ctx.globalAlpha = a;
      s.text(this.banner, VIEW.w / 2, VIEW.h * 0.34, { size: 30, color: '#ffe08a', align: 'center', shadow: 'rgba(0,0,0,.9)' });
      s.ctx.globalAlpha = 1;
    }

    if (!p.alive) {
      s.ctx.fillStyle = 'rgba(4,6,14,.55)';
      s.ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      s.text('RECONSTRUINDO CASCO…', VIEW.w / 2, VIEW.h / 2, { size: 20, color: '#ff8a9a', align: 'center' });
    }

    if (this.victory > 0) this.drawVictory(s);
  }

  /** Painel de conquista, com contagem para a próxima fase. */
  private drawVictory(s: Surface): void {
    const cx = VIEW.w / 2;
    const cy = VIEW.h * 0.42;
    // Aparece rápido e some rápido, ficando estável no meio da pausa.
    const t = clamp01(Math.min(VICTORY_HOLD - this.victory, this.victory) / 0.45);

    s.ctx.globalAlpha = t;
    s.ctx.fillStyle = 'rgba(4,7,16,.72)';
    s.ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    const cor = this.victoryKind === 'chefe' ? '#ffb638' : this.victoryKind === 'elite' ? '#c060ff' : '#7ed957';
    const titulo = this.victoryKind === 'chefe' ? 'CHEFE DERROTADO' : this.victoryLast ? 'FASE CONCLUÍDA' : 'ONDA LIMPA';

    // Moldura
    const w = Math.min(560, VIEW.w * 0.8);
    const hgt = 210;
    s.ctx.fillStyle = 'rgba(8,13,26,.94)';
    s.ctx.fillRect(cx - w / 2, cy - hgt / 2, w, hgt);
    s.ctx.strokeStyle = cor;
    s.ctx.lineWidth = 2;
    s.ctx.strokeRect(cx - w / 2, cy - hgt / 2, w, hgt);

    s.text(titulo, cx, cy - 62, { size: 30, color: cor, align: 'center', shadow: 'rgba(0,0,0,.9)' });
    s.text(this.victoryLabel, cx, cy - 26, { size: 16, color: '#dfe8f6', align: 'center' });
    s.text(
      `Setor ${this.victorySector} · fase ${this.victoryPhase}`,
      cx, cy + 2, { size: 13, color: '#8ba0bd', align: 'center' },
    );

    const proxima = this.victoryLast ? 'Próxima fase' : 'Próxima onda';
    // A margem evita o clássico erro de borda: `victory` acumula `dt` em ponto
    // flutuante e cai em 4.0000001, que `ceil` arredondaria de volta para 5.
    const restam = Math.max(1, Math.ceil(this.victory - 0.01));
    s.text(`${proxima} em ${restam}s`, cx, cy + 44, { size: 14, color: '#9fe8ff', align: 'center' });

    // Barra de contagem, para a espera ser legível em vez de arbitrária.
    const bw = w - 60;
    s.rect(cx - bw / 2, cy + 66, bw, 5, 'rgba(255,255,255,.12)');
    s.rect(cx - bw / 2, cy + 66, bw * (1 - this.victory / VICTORY_HOLD), 5, cor);

    s.ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.bullets.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.particles.clear();
  }
}

/** Preenchido em `bootVertical()` para evitar ciclo de import com os dados. */
const MINION_CACHE = new Map<string, EnemyDef>();

export function registerMinions(defs: readonly EnemyDef[]): void {
  for (const def of defs) MINION_CACHE.set(def.id, def);
}
