import { Rng, TAU, clamp, clamp01, damp, hashString, lerp } from '@core/math';
import {
  ALFA_MAX_DE_CORPO, AMEACA, CENARIO_LUMINOSIDADE, CONGELAMENTO, CORPO_CELESTE,
  POEIRA, PROFUNDIDADE, PROJETIL, VEU_DE_CENARIO,
} from '@data/cenario';
import {
  CLIMAS, CLIMA_POR_ID, DETRITOS_MAX, INTERVALO_MAX, INTERVALO_MIN,
  PERFIL_DE_DETRITO, VELOCIDADE_BASE, spriteDeDetrito, tamanhoSorteado,
  type Clima, type ClimaDeDetrito, type FamiliaDeDetrito,
} from '@data/detritos';
import { fmt } from '@core/format';
import { assets } from '@render/Assets';
import { Particles } from '@render/Particles';
import type { Surface } from '@render/Surface';
import { frameAt, getClip } from '@render/Anim';
import { PLANET_KEYS, describeGalaxy, galaxyOfSector, galaxyPhases, phaseOfSector } from '@data/galaxies';
import { SKY_COMETS, SKY_FAMILIES, SKY_NEBULAE } from '@data/orbs';
import { WAVES_PER_SECTOR } from '@sim/progression';
import { rarityInfo } from '@data/rarity';
import { getElement } from '@data/elements';
import { arteElemental } from '@data/arte-elemental';
import { FRACAO_ELEMENTAL_INIMIGA } from '@data/balance/elemental';
import { aplicarCritico, danoTotal, montarPacote, resolverDano } from '@sim/dano';
import { ALL_ENEMIES, type EnemyDef } from '@data/enemies';
import { HULLS, type Hull } from '@data/hulls';
import { DANO_STAT, type ElementId, type Item, type Stats } from '@sim/types';
import type { Sim } from '@sim/index';
import { labEnemyHitbox, labHitbox, labScenario, type LaboratorioMetrics, type LabScenarioId } from '@sim/laboratorio';
import { PilotAI, type PilotOutput } from './PilotAI';
import { WaveDirector } from './WaveDirector';
import {
  PICKUP_CLIP, PICKUP_COLOR, PICKUP_SPRITE, VIEW,
  createBulletPool, createDetritoPool, createEnemyPool, createPickupPool,
  type Bullet, type Detrito, type Enemy, type PickupKind, type Player,
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
   * Grãos de poeira do primeiro plano ambiental.
   *
   * Array simples e não um pool: eles nunca morrem, só voltam ao topo. Um pool
   * serve para o que nasce e some, e isto é uma textura em movimento.
   */
  private readonly poeira = Array.from({ length: POEIRA.quantidade }, () => ({
    x: 0, y: 0, raio: 1, alfa: 0.2, vel: 1, cor: '#dfe7f5',
  }));

  /** Asteroides e lixo: obstáculo de cenário, sem recompensa nenhuma. */
  private readonly detritos = createDetritoPool();
  /** Clima corrente. `esparso` é o repouso; os outros são momentos. */
  private climaAtual: ClimaDeDetrito = 'esparso';
  /** Quanto falta do momento atual. Zero = de volta ao esparso. */
  private climaRestante = 0;
  /** Quanto falta para o PRÓXIMO momento começar. */
  private climaEspera = 0;
  /** Acumulador fracionário de spawn — a taxa não é inteira por quadro. */
  private detritoAcumulado = 0;

  /**
   * Não há mais campos de estrela avulsos.
   *
   * Eram dois `StarScroll` de cruzes brilhantes por cima do fundo. Existiam
   * porque o pano de fundo antigo era uma imagem PARADA e a cena precisava de
   * movimento vindo de algum lugar. Os cenários de `backgrounds` já trazem a
   * própria camada de estrelas, com a densidade e a cor que o artista escolheu
   * para aquele lugar — somar as cruzes por cima virava poluição, e escondia
   * justamente a arte nova.
   */

  /** Tempo acumulado da cena, usado pelos clipes em loop que não têm estado. */
  private elapsed = 0;
  /**
   * Camadas do cenário em exibição, do fundo para a frente.
   *
   * Lista e não uma imagem só: os conjuntos de `backgrounds` vêm em três
   * camadas feitas para serem empilhadas, e a de trás sozinha é quase preta.
   */
  private galaxyLayers: { src: string; velocidade: number; alfa: number }[] = [];
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

  /** Quanto ainda falta congelar, em segundos. */
  private congelamento = 0;
  /** Congelamento disponível. Recarrega com o tempo; ver `CONGELAMENTO`. */
  private reservaDeCongelamento: number = CONGELAMENTO.reserva;
  private flash = 0;
  private banner = '';
  private bannerTime = 0;
  private threat = 0;
  private labRevision = -1;
  private wasLabActive = false;
  private labStats: Stats | null = null;
  private labHull: Hull | null = null;
  private labEnemy: EnemyDef | null = null;
  private readonly keys = new Set<string>();
  /** Zonas telegráficas da Provação; vivem na cena, nunca no save. */
  private readonly dangerZones: { x: number; y: number; radius: number; life: number; warmup: number; damage: number }[] = [];

  readonly player: Player = {
    x: VIEW.w / 2, y: VIEW.h * 0.75, vx: 0, vy: 0,
    hp: 1, hpMax: 1, shield: 0, shieldMax: 0, shieldLock: 0,
    radius: 15, hitbox: { width: 30, height: 30, offsetX: 0, offsetY: 0 },
    fireTimer: 0, invuln: 1.2, bank: 0,
    alive: true, deathTimer: 0, stun: 0, slow: 0, slowFor: 0,
  };

  constructor(
    private readonly surface: Surface,
    private readonly sim: Sim,
  ) {
    this.syncEncounter(true);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Executa o mesmo combate do jogo, sem desenho, para a bateria administrativa. */
  executarConfrontoLaboratorio(hullId: string, scenarioId: LabScenarioId, seed: number): LaboratorioMetrics {
    if (!this.sim.carregarCascoNoLaboratorio(hullId)) throw new Error(`Casco inexistente: ${hullId}`);
    if (!this.sim.carregarCenarioLaboratorio(scenarioId)) throw new Error(`Cenário inválido: ${scenarioId}`);
    this.sim.atualizarLaboratorio({ seed });
    this.sim.laboratorio.active = true;
    this.sim.laboratorio.paused = false;
    this.sim.laboratorio.metrics = {
      elapsed: 0, playerShots: 0, playerHits: 0, playerDamage: 0,
      enemyShots: 0, enemyHits: 0, enemyDamage: 0, kills: 0, deaths: 0, activeEnemies: 0,
    };
    this.resetLaboratorio();
    const frames = Math.round(labScenario(scenarioId).duration * 60);
    for (let frame = 0; frame < frames; frame++) this.updateLaboratorio(1 / 60);
    return { ...this.sim.laboratorio.metrics };
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    const manual = this.sim.laboratorio.active
      ? this.sim.laboratorio.config.control === 'manual'
      : this.sim.state.settings.controlMode === 'manual';
    if (manual && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };

  private get currentStats(): Stats { return this.labStats ?? this.sim.stats; }
  private get currentHull(): Hull { return this.labHull ?? this.sim.hull; }
  private get currentElement(): ElementId { return this.sim.laboratorio.active ? this.sim.laboratorio.config.playerElement : this.sim.element; }
  private get currentDefenseElement(): ElementId { return this.sim.laboratorio.active ? this.sim.laboratorio.config.defenseElement : this.sim.defenseElement; }

  resize(cssW: number, cssH: number): void {
    this.surface.resize(cssW, cssH, VIEW.w, VIEW.h);
  }

  /** Recria o estado da nave a partir dos atributos atuais. */
  refreshPlayer(full = false): void {
    const s = this.currentStats;
    const hpRatio = full ? 1 : clamp01(this.player.hp / Math.max(1, this.player.hpMax));
    const shRatio = full ? 1 : clamp01(this.player.shield / Math.max(1, this.player.shieldMax));
    this.player.hpMax = s.vida;
    this.player.shieldMax = s.escudo;
    this.player.hp = s.vida * hpRatio;
    this.player.shield = s.escudo * shRatio;
    this.syncPlayerHitbox();
  }

  private syncPlayerHitbox(): void {
    const box = this.sim.laboratorio.active
      ? labHitbox(this.sim.laboratorio.config)
      : this.sim.hitboxDoCasco(this.currentHull.id);
    this.player.hitbox = { ...box };
    // A IA ainda trabalha com distância radial; use o maior semieixo para ela
    // nunca acreditar que uma nave larga cabe numa abertura estreita.
    this.player.radius = Math.max(box.width, box.height) / 2;
  }

  private circleHitsPlayer(x: number, y: number, radius: number): boolean {
    return this.circleHitsBox(x, y, radius, this.player.x, this.player.y, this.player.hitbox);
  }

  private circleHitsBox(
    x: number, y: number, radius: number,
    originX: number, originY: number,
    box: { width: number; height: number; offsetX: number; offsetY: number },
  ): boolean {
    const cx = originX + box.offsetX;
    const cy = originY + box.offsetY;
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const nearestX = clamp(x, cx - halfW, cx + halfW);
    const nearestY = clamp(y, cy - halfH, cy + halfH);
    return (x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2;
  }

  private enemyHitsPlayer(e: Enemy): boolean {
    if (!e.hitbox) return this.circleHitsPlayer(e.x, e.y, e.radius * e.scale);
    const a = this.player.hitbox;
    const b = e.hitbox;
    const ax = this.player.x + a.offsetX;
    const ay = this.player.y + a.offsetY;
    const bx = e.x + b.offsetX;
    const by = e.y + b.offsetY;
    return Math.abs(ax - bx) < (a.width + b.width) / 2
      && Math.abs(ay - by) < (a.height + b.height) / 2;
  }

  private bulletHitsEnemy(b: Bullet, e: Enemy): boolean {
    if (e.hitbox) return this.circleHitsBox(b.x, b.y, b.radius, e.x, e.y, e.hitbox);
    const r = e.radius * e.scale + b.radius;
    return Math.hypot(e.x - b.x, e.y - b.y) <= r;
  }

  /** Sincroniza sem reiniciar: os controles respondem no próprio quadro. */
  private syncEnemyHitboxes(): void {
    if (this.sim.laboratorio.active) {
      const box = labEnemyHitbox(this.sim.laboratorio.config);
      this.enemies.each((e) => { e.hitbox = { ...box }; });
      return;
    }
    this.enemies.each((e) => {
      const key = e.boss ? `boss:${e.boss.id}` : `enemy:${e.def.id}`;
      const saved = this.sim.hitboxSalvaDoInimigo(key);
      e.hitbox = saved ? { ...saved } : null;
      e.scale = this.sim.escalaDoInimigo(key) ?? e.def.scale;
    });
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
    this.dangerZones.length = 0;
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
    /**
     * Monta as camadas do cenário. Prefere o conjunto novo e cai no antigo.
     *
     * As velocidades sobem da camada de trás para a da frente — é a diferença
     * entre elas que cria profundidade, não a existência de três imagens. A
     * distante quase não anda; as estrelas atravessam a tela.
     *
     * O conjunto CHAPADO vira uma camada só: são variações completas do mesmo
     * lugar, e sobrepô-las daria um borrão em vez de profundidade.
     */
    const novo = assets.manifest?.fundos?.find((f) => f.id === galaxy.fundoId);
    const alvos = novo
      ? (novo.tipo === 'parallax'
        ? [
          { src: novo.camadas.longe, velocidade: 4, alfa: 1 },
          { src: novo.camadas.nebulosa, velocidade: 11, alfa: 0.85 },
          { src: novo.camadas.estrelas, velocidade: 26, alfa: 0.9 },
        ]
        : [{ src: novo.variacoes[0]!, velocidade: 6, alfa: 1 }])
      : [{ src: galaxy.backdrop, velocidade: 0, alfa: 0.75 }];

    const chave = alvos.map((a) => a.src).join('|');
    if (chave !== this.pendingBackdrop) {
      this.pendingBackdrop = chave;

      // Só troca depois de TODAS carregarem: trocar camada a camada mostrava a
      // nebulosa nova sobre as estrelas velhas por um instante.
      void Promise.all(alvos.map((a) => assets.image(a.src)))
        .then(() => { this.galaxyLayers = alvos; })
        .catch(() => console.warn(`[cena] cenário ${galaxy.fundoId ?? galaxy.backdrop} indisponível`));

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
      // Herói: grande, próximo, mais opaco — e na MARGEM, cortado pela tela.
      //
      // O `fx` ia de 0,12 a 0,82: o centro do planeta caía dentro da pista de
      // jogo em 72% dos setores, e ele cobria 75% dela. Inimigo passando por
      // cima sumia. Agora o centro fica fora da pista, dos dois lados, e o que
      // aparece é um pedaço de um corpo grande — que lê como MAIOR do que o
      // disco inteiro no meio da tela, não menor.
      {
        key: hero,
        fx: rng.chance(0.5)
          ? rng.range(-0.06, CORPO_CELESTE.margem)
          : rng.range(1 - CORPO_CELESTE.margem, 1.06),
        y: rng.range(-460, 520), size: rng.range(250, 420), speed: rng.range(14, 22), alpha: 0.78,
      },
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
    // Teto de presença. O corpo heroico entrava a 0,78 e competia com o
    // gameplay; aplicar o limite aqui, e não em cada linha da tabela, garante
    // que qualquer corpo novo nasça obedecendo — inclusive os que ainda não
    // existem.
    for (const p of props) p.alpha = Math.min(p.alpha, ALFA_MAX_DE_CORPO);
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
  }

  // ── ciclo ─────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.lastDt = dt;
    if (this.sim.laboratorio.active) {
      this.wasLabActive = true;
      if (this.labRevision !== this.sim.laboratorio.revision) this.resetLaboratorio();
      this.updateLaboratorio(dt);
      return;
    }
    if (this.wasLabActive) {
      this.wasLabActive = false;
      this.labStats = null;
      this.labHull = null;
      this.labEnemy = null;
      this.syncEncounter(true);
      this.refreshPlayer(true);
    }
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

    // Congelamento de impacto. Fica DEPOIS da vitória e ANTES de tudo o mais:
    // o mundo inteiro para, inclusive partículas e cenário. Congelar só os
    // inimigos deixaria o fundo rolando, e o olho lê isso como travada e não
    // como efeito.
    //
    // `draw()` é chamado à parte pelo laço, então a tela continua sendo
    // desenhada — é o quadro parado que dá o peso.
    this.reservaDeCongelamento = Math.min(
      CONGELAMENTO.reserva,
      this.reservaDeCongelamento + dt * CONGELAMENTO.porSegundo,
    );
    if (this.congelamento > 0) {
      this.congelamento -= dt;
      return;
    }

    this.elapsed += dt;
    this.advanceSky(dt);
    this.tickDesafio(dt);

    this.shake = damp(this.shake, 0, 0.09, dt);
    this.flash = damp(this.flash, 0, 0.07, dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);

    this.syncEnemyHitboxes();
    this.updatePlayer(dt);
    this.director.update(dt, this.enemies, (def, x, y, hp, damage) => this.spawnEnemy(def, x, y, hp, damage));
    this.updateEnemies(dt);
    this.updateDangerZones(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateDetritos(dt);
    this.updatePoeira(dt);
    this.particles.update(dt);

    this.checkCleared();
  }

  private resetLaboratorio(): void {
    const c = this.sim.laboratorio.config;
    this.rng.reset(c.seed);
    const hull = HULLS.find((h) => h.id === c.playerHullId) ?? HULLS[0]!;
    const shotHull = HULLS.find((h) => h.id === c.playerShotHullId) ?? hull;
    const source = ALL_ENEMIES.find((e) => e.id === c.enemyId) ?? ALL_ENEMIES[0]!;
    const shotEnemy = ALL_ENEMIES.find((e) => e.id === c.enemyShotEnemyId) ?? source;
    this.labHull = {
      ...hull,
      sprite: c.playerSprite,
      scale: c.playerSpriteScale,
      bank: undefined,
      damageStates: undefined,
      engineClip: undefined,
      boostClip: undefined,
      enginePart: undefined,
      weaponClip: undefined,
      shieldClip: undefined,
      shot: { ...shotHull.shot, speed: c.playerBulletSpeed, spread: c.playerSpread },
    };
    this.labEnemy = {
      ...source, sprite: c.enemySprite, scale: c.enemySpriteScale,
      bank: undefined, clip: undefined, engineClip: undefined, weaponClip: undefined, shieldClip: undefined,
      move: c.enemyMove, attack: c.enemyAttack, element: c.enemyElement,
      hp: 1, dano: 1, speed: c.enemySpeed, fireRate: c.enemyFireRate, shots: c.enemyShots,
      bulletSpeed: c.enemyBulletSpeed, bulletSprite: shotEnemy.bulletSprite,
    };
    this.labStats = { ...this.sim.stats,
      dano: c.playerDamage, cadencia: c.playerFireRate, projeteis: c.playerShots,
      perfuracao: c.playerPierce, explosao: c.playerSplash, vida: c.playerHp,
      escudo: c.playerShield, regen: c.playerRegen, velocidade: c.playerSpeed, iaSkill: c.playerAiSkill,
      critChance: c.playerCritChance, critDano: c.playerCritDamage, penetracao: c.playerPenetration,
    };
    for (const id of ['padrao', 'fogo', 'raio', 'quimico', 'cosmico', 'gelo'] as ElementId[]) this.labStats[DANO_STAT[id]] = 0;
    this.bullets.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.detritos.clear();
    this.dangerZones.length = 0;
    this.particles.clear();
    this.ai.reset(c.seed ^ 0x9117);
    this.elapsed = 0;
    this.victory = 0;
    this.cleared = false;
    this.labRevision = this.sim.laboratorio.revision;
    this.player.alive = true;
    this.player.invuln = 1;
    this.player.x = VIEW.w / 2;
    this.player.y = VIEW.h * 0.78;
    this.player.vx = this.player.vy = 0;
    this.refreshPlayer(true);
    this.ensureLabEnemies();
    this.setBanner('LABORATÓRIO DE COMBATE');
  }

  private ensureLabEnemies(): void {
    const c = this.sim.laboratorio.config;
    const def = this.labEnemy;
    if (!def) return;
    let alive = this.enemies.items.filter((e) => e.alive).length;
    while (alive < c.enemyCount) {
      // Enxames não podem nascer empilhados: isso transformava perfuração e
      // explosão em multiplicadores artificiais. Para 1–4 alvos usamos uma
      // formação legível; acima disso, uma dispersão semeada e reproduzível.
      const x = c.enemyCount >= 6
        ? this.rng.range(VIEW.w * .08, VIEW.w * .92)
        : ((alive + 1) / (c.enemyCount + 1)) * VIEW.w;
      const y = -40 - this.rng.range(0, c.enemyCount >= 6 ? 150 : 55);
      const e = this.spawnEnemy(def, x, y, c.enemyHp, c.enemyDamage);
      if (!e) break;
      e.share = 0;
      e.counts = false;
      alive++;
    }
    this.sim.laboratorio.metrics.activeEnemies = alive;
  }

  private updateLaboratorio(dt: number): void {
    const lab = this.sim.laboratorio;
    if (lab.paused && !this.sim.consumirPassoLaboratorio()) return;
    // Os quatro controles da hitbox funcionam ao vivo, sem reiniciar o duelo.
    this.syncPlayerHitbox();
    lab.metrics.elapsed += dt;
    this.elapsed += dt;
    this.advanceSky(dt);
    this.shake = damp(this.shake, 0, 0.09, dt);
    this.flash = damp(this.flash, 0, 0.07, dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    this.syncEnemyHitboxes();
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.particles.update(dt);
    if (lab.config.autoRespawn) this.ensureLabEnemies();
    lab.metrics.activeEnemies = this.enemies.items.filter((e) => e.alive).length;
  }

  // ── jogador ───────────────────────────────────────────────────────────────

  private updatePlayer(dt: number): void {
    const p = this.player;
    const stats = this.currentStats;

    // Relógios dos especiais. Decaem sempre, inclusive na morte, para não
    // sobreviverem a um encontro e contaminarem o seguinte.
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);
    if (p.slowFor > 0) {
      p.slowFor = Math.max(0, p.slowFor - dt);
      if (p.slowFor === 0) p.slow = 0;
    }

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
        if (!this.sim.laboratorio.active) {
          this.sim.failEncounter();
          this.syncEncounter(true);
        }
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

    const lab = this.sim.laboratorio;
    const manual = lab.active ? lab.config.control === 'manual' : this.sim.state.settings.controlMode === 'manual';
    const cmd: PilotOutput = manual
      ? this.manualCommand()
      : this.ai.update(
        dt, p, this.enemies, this.bullets, this.pickups, stats.iaSkill,
        // No Laboratório, `manual` significa que o jogador voa — este ramo só
        // é alcançado quando a IA está no comando, então o valor aqui é um
        // encaixe de tipo, não uma escolha de comportamento. Era
        // `equilibrado`; virou `evasivo` porque foi a postura que sobrou mais
        // perto do meio.
        lab.active ? (lab.config.control === 'manual' ? 'evasivo' : lab.config.control) : this.sim.state.settings.pilot,
      );
    this.threat = damp(this.threat, cmd.threat, 0.12, dt);

    /**
     * Atordoamento ZERA o comando; lentidão só corta a velocidade.
     *
     * A diferença importa: atordoado o jogador não decide nada, e é por isso
     * que os especiais que atordoam têm a telegrafia mais longa do catálogo.
     * Lento ele ainda joga, só pior — a decisão continua sendo dele.
     */
    const speed = stats.velocidade * (1 - (p.slowFor > 0 ? p.slow : 0));
    const accel = speed * 7.5;
    if (p.stun <= 0) {
      p.vx += cmd.dx * accel * dt;
      p.vy += cmd.dy * accel * dt;
    }

    if (cmd.dash && p.stun <= 0) {
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

    const box = p.hitbox;
    p.x = clamp(p.x + p.vx * dt, box.width / 2 - box.offsetX, VIEW.w - box.width / 2 - box.offsetX);
    p.y = clamp(p.y + p.vy * dt, Math.max(70, box.height / 2 - box.offsetY), VIEW.h - box.height / 2 - box.offsetY);
    p.bank = damp(p.bank, clamp(p.vx / Math.max(1, speed), -1, 1), 0.08, dt);

    this.particles.thrust(p.x, p.y + 20, 0, 1, this.currentHull.trail, 0.4);

    p.fireTimer -= dt;
    if (cmd.fire && p.fireTimer <= 0) {
      const rate = stats.cadencia;
      p.fireTimer = 1 / Math.max(0.2, rate);
      this.firePlayer();
    }
  }

  private manualCommand(): PilotOutput {
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const up = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const down = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    return {
      dx, dy, throttle: len > 0 ? 1 : 0,
      // No modo manual o foco é pilotar: a arma continua automática. Espaço
      // permanece como alternativa explícita no Laboratório.
      fire: !this.sim.laboratorio.active || this.sim.laboratorio.config.autoFire || this.keys.has('Space'),
      targetId: 0, dash: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), threat: 0,
    };
  }

  private firePlayer(): void {
    const p = this.player;
    const stats = this.currentStats;
    const style = this.currentHull.shot;
    const count = stats.projeteis;

    // A arte do tiro segue o ELEMENTO quando ele não é o nativo do casco: se o
    // jogador equipou um canhão de gelo numa nave de fogo, o que sai da nave
    // precisa ser azul. Enquanto os dois coincidem vale a arte própria do casco,
    // que é mais caracterizada que o projétil genérico.
    const element = this.currentElement;
    const nativo = this.sim.laboratorio.active || element === this.currentHull.element;
    const info = getElement(element);
    const sprite = nativo ? style.sprite : info.bullet[0];
    const color = nativo ? style.color : info.color;
    const scale = nativo ? style.scale : 0.9;

    // Fogacho na boca da arma, na arte do elemento (§22). É o que faz trocar de
    // arma mudar a CARA do disparo e não só o número — o tiro em si passa rápido
    // demais para ser lido, o clarão do cano fica.
    this.particles.flash(
      arteElemental('fogacho', element, this.sim.laboratorio.active ? 1 : this.sim.encounter.wave),
      p.x, p.y - 22, 0.5, { vida: 0.12, crescimento: 0.9 },
    );

    for (let i = 0; i < count; i++) {
      const b = this.bullets.spawn();
      if (!b) break;
      // Leque simétrico: para 1 projétil o offset é 0, para 2 é ±0.5, etc.
      const offset = count === 1 ? 0 : i - (count - 1) / 2;
      const angle = -Math.PI / 2 + offset * style.spread;
      // Normal e elemental crititam SEPARADO (§4). Com uma rolagem só, o tiro
      // seria inteiro crítico ou inteiro não, e separar os componentes viraria
      // contabilidade sem consequência no combate.
      const basePacket = this.sim.laboratorio.active
        ? {
            normal: stats.dano * (1 - this.sim.laboratorio.config.elementalFraction),
            elementais: element === 'padrao' ? {} : { [element]: stats.dano * this.sim.laboratorio.config.elementalFraction },
          }
        : montarPacote(stats);
      const { pacote, crit } = aplicarCritico(
        basePacket,
        stats,
        () => this.rng.next(),
      );

      b.friendly = true;
      b.x = p.x + offset * 9;
      b.y = p.y - 18;
      b.vx = Math.cos(angle) * style.speed;
      b.vy = Math.sin(angle) * style.speed;
      b.radius = 7;
      b.damage = pacote;
      b.damageTotal = danoTotal(pacote);
      b.crit = crit.critNormal;
      b.critElem = crit.critElemental;
      b.element = element;
      b.sprite = sprite;
      b.color = color;
      b.scale = scale;
      b.pierce = stats.perfuracao;
      b.splash = stats.explosao;
      if (this.sim.laboratorio.active) this.sim.laboratorio.metrics.playerShots++;
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
  /**
   * Escala do reflexo.
   *
   * O dano do jogador é ordens de grandeza maior que o do chefe — devolver 12%
   * dele sem escala mataria a nave num tiro. 0,004 põe o retorno na mesma faixa
   * de um golpe inimigo, que é o que o modificador quer significar.
   */
  private static readonly REFLEXO_ESCALA = 0.004;

  /** Segundos sem levar dano até a regeneração do chefe voltar a contar. */
  private static readonly REGEN_APOS = 2.5;

  private damagePlayer(amount: number, element: ElementId = 'padrao'): void {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    // Alimenta o registro do piso (§27) sem que a Provação precise observar o
    // combate de fora.
    if (this.sim.desafio) this.sim.desafio.danoRecebido += amount;

    /**
     * O tiro inimigo também vira pacote (§3).
     *
     * `FRACAO_ELEMENTAL` é quanto do golpe de um inimigo elemental é elemental;
     * o resto é normal e passa pela resistência sem ser tocado. Sem essa
     * separação, uma nave com 75% de resistência a fogo ficaria praticamente
     * imune a toda uma galáxia — era o que acontecia, porque a resistência
     * multiplicava o golpe inteiro.
     *
     * Inimigo neutro entrega 100% normal, e é por isso que ele continua
     * perigoso para quem investiu tudo em resistência.
     */
    const fracaoElemental = this.sim.laboratorio.active
      ? this.sim.laboratorio.config.enemyElementalFraction
      : FRACAO_ELEMENTAL_INIMIGA;
    const pacote = element === 'padrao'
      ? { normal: amount, elementais: {} }
      : {
        normal: amount * (1 - fracaoElemental),
        elementais: { [element]: amount * fracaoElemental },
      };

    amount = resolverDano(
      pacote,
      this.currentDefenseElement,
      0, // inimigos não têm penetração; é um eixo do jogador por enquanto
      (e) => this.sim.laboratorio.active ? 0 : this.sim.resistance(e),
    ).total;
    if (this.sim.laboratorio.active) {
      this.sim.laboratorio.metrics.enemyHits++;
      this.sim.laboratorio.metrics.enemyDamage += amount;
    }
    // No modo de teste o dano ainda dá feedback visual, mas não mata: o ponto
    // é inspecionar conteúdo, não sobreviver a ele.
    if (this.sim.laboratorio.active ? this.sim.laboratorio.config.immortal : this.sim.testMode) {
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
      if (this.sim.laboratorio.active) this.sim.laboratorio.metrics.deaths++;
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

      if (e.boss) {
        this.updateBoss(e, dt);
        this.updateChallengeMechanics(e);
      } else this.moveEnemy(e, dt);

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
        if (this.enemyHitsPlayer(e)) {
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
      // A cor vem do ELEMENTO, sempre. Era um campo por chefe, e ele derivou:
      // havia chefe cósmico atirando '#66d9ff' e químico atirando '#8dff5c'
      // onde a tabela diz #7ee858. Num jogo em que o anel elemental decide o
      // dano, a cor do tiro é informação de regra, não enfeite.
      const corDoChefe = getElement(boss.element).color;
      this.emitPattern(e, phase.attack, phase.shots, phase.bulletSpeed, boss.bulletSprite, corDoChefe, 1.1);
    }

    if (phase.summon) {
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = phase.summon.every;
        this.summonMinions(phase.summon.enemy, phase.summon.count, e);
      }
    }
  }

  /**
   * Modificadores mecânicos da Provação.
   *
   * Todos têm ciclo, limite ou telegrafia. A Provação pode exigir leitura, mas
   * não pode punir o jogador com uma imunidade contínua ou perigo invisível.
   */
  private updateChallengeMechanics(e: Enemy): void {
    const d = this.sim.desafio;
    if (!d || !e.boss || e.entering) return;
    const ef = d.efeitos;

    e.invulnerable = ef.invulneravelCada > 0 && (e.time % ef.invulneravelCada) < ef.invulneravelPor;
    e.barrierActive = ef.barreiraCada > 0 && (e.time % ef.barreiraCada) < ef.barreiraPor;

    if (!e.challengeClone && ef.clones > 0 && !d.clonesGerados) {
      d.clonesGerados = true;
      for (let i = 0; i < ef.clones; i++) this.spawnChallengeClone(e, i, ef.clones);
      this.setBanner('ECOS DE GUERRA');
    }

    if (!e.challengeClone && ef.zonaCada > 0 && d.tempo >= d.proximaZonaEm) {
      d.proximaZonaEm = d.tempo + ef.zonaCada;
      // O alvo é a posição atual, mas a zona leva 0,75 s para armar. Assim a
      // resposta é sair, não prever o futuro ou morrer sem possibilidade.
      this.dangerZones.push({
        x: clamp(this.player.x + this.rng.range(-34, 34), 70, VIEW.w - 70),
        y: clamp(this.player.y + this.rng.range(-24, 24), 90, VIEW.h - 80),
        radius: ef.zonaRaio,
        life: ef.zonaPor,
        warmup: 0.75,
        damage: this.sim.encounter.damage * ef.zonaDano,
      });
      this.setBanner('CAMPO INSTÁVEL');
    }
  }

  private spawnChallengeClone(original: Enemy, index: number, total: number): void {
    const offset = (index - (total - 1) / 2) * 170;
    const clone = this.spawnEnemy(
      original.def,
      clamp(original.x + offset, 80, VIEW.w - 80),
      original.y,
      Math.max(1, original.maxHp * 0.28),
      original.damage * 0.62,
    );
    if (!clone) return;
    clone.boss = original.boss;
    clone.radius = original.radius * 0.72;
    clone.scale = original.scale * 0.72;
    clone.share = 0;
    clone.counts = false;
    clone.challengeClone = true;
    clone.entering = false;
    clone.anchorX = clamp(original.anchorX + offset, 90, VIEW.w - 90);
    clone.anchorY = original.anchorY + 26;
  }

  private updateDangerZones(dt: number): void {
    for (let i = this.dangerZones.length - 1; i >= 0; i--) {
      const zone = this.dangerZones[i]!;
      zone.life -= dt;
      zone.warmup = Math.max(0, zone.warmup - dt);
      if (zone.life <= 0) {
        this.dangerZones.splice(i, 1);
        continue;
      }
      if (zone.warmup <= 0 && this.player.alive && Math.hypot(this.player.x - zone.x, this.player.y - zone.y) < zone.radius) {
        this.damagePlayer(zone.damage * dt);
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
    this.emitPattern(e, def.attack, def.shots, def.bulletSpeed, def.bulletSprite, getElement(def.element).color, 1);
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
      b.damageTotal = damage;
      b.element = e.boss?.element ?? e.def.element;
      b.sprite = sprite;
      b.color = color;
      b.scale = 0.6 * scale;
      b.homing = homing;
      b.pierce = 0;
      b.splash = 0;
      if (this.sim.laboratorio.active) this.sim.laboratorio.metrics.enemyShots++;
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

  /**
   * Pede congelamento, dentro do orçamento.
   *
   * Não SOMA, pega o maior: seis abates no mesmo quadro são um acontecimento
   * só, e somar seis congelamentos daria um terço de segundo de tela travada
   * por uma explosão em área.
   *
   * Desligado junto com "reduzir efeitos" — é um efeito de tela que mexe com
   * o tempo, exatamente a categoria que a opção existe para desligar.
   */
  private congelar(segundos: number): void {
    if (this.sim.state.settings.reduceEffects) return;
    const cabe = Math.min(segundos, this.reservaDeCongelamento);
    if (cabe <= 0) return;
    this.reservaDeCongelamento -= cabe;
    this.congelamento = Math.max(this.congelamento, cabe);
  }

  private killEnemy(e: Enemy, byPlayer: boolean): void {
    e.alive = false;
    // A animação de destruição própria da nave vale mais que uma explosão
    // genérica: ela desmonta o casco daquele modelo específico.
    const own = e.def.deathClip && getClip(e.def.deathClip) ? e.def.deathClip : null;
    const clip = own ?? (getClip(e.def.blast) ? e.def.blast : 'blast/fire');
    this.particles.burst(clip, e.x, e.y, own ? e.scale : e.scale * (e.boss ? 3.4 : 1.5));

    // Estouro elemental POR CIMA da animação de destruição, não no lugar dela.
    // A animação própria da nave desmonta aquele casco e vale demais para ser
    // trocada; o estouro do atlas do §21 acrescenta a assinatura do elemento
    // que derrubou. Somados, o abate diz duas coisas: o que morreu e do quê.
    this.particles.flash(
      arteElemental('estouro', e.boss?.element ?? e.def.element, e.id),
      e.x, e.y, e.scale * (e.boss ? 2.2 : 0.85),
      { vida: e.boss ? 0.5 : 0.3, crescimento: 0.8 },
    );

    this.particles.debris(e.x, e.y, e.boss ? 26 : 6, '#9aa7bd', e.boss ? 240 : 120);
    this.shake = Math.max(this.shake, e.boss ? 16 : 2.5);
    // Mesma leitura de categoria que o resto do arquivo já usa: a instância não
    // carrega `kind` — quem sabe se é elite é a DEFINIÇÃO.
    this.congelar(
      e.boss ? CONGELAMENTO.chefe
        : e.def.elite ? CONGELAMENTO.elite
          : CONGELAMENTO.comum,
    );

    if (this.sim.laboratorio.active) {
      if (byPlayer) this.sim.laboratorio.metrics.kills++;
      return;
    }

    if (!byPlayer) return;

    // Ecos e fragmentos são pressão adicional, não uma segunda recompensa nem
    // uma forma de avançar o encontro sem derrubar o alvo principal.
    if (e.challengeClone) return;

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
    // Quem morreu vai junto: é o que permite à tabela do §10 favorecer slot e
    // elemento por inimigo. Sem este argumento as regras por alvo existiriam e
    // nunca casariam, que é a pior forma de um sistema estar "pronto".
    const rolls = this.sim.rollDrops(
      e.boss ? 'chefe' : e.def.elite ? 'elite' : 'onda',
      { id: e.def.id, tags: e.def.tags, element: e.boss?.element ?? e.def.element },
    );
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

      // Detrito come projétil dos DOIS lados.
      //
      // É o que o separa de um plano de fundo: um cenário que não interfere é
      // decoração, e a nave passaria por ele sem nunca reparar. Comendo tiro,
      // um asteroide entre o jogador e o alvo é uma decisão — atirar em volta,
      // furar a pedra, ou usá-la de escudo contra quem está atrás dela.
      //
      // Antes da checagem de inimigo, e de propósito: a pedra está no caminho,
      // então é ela que responde primeiro.
      this.detritos.each((d) => {
        if (!b.alive || !d.alive) return;
        const dx = d.x - b.x;
        const dy = d.y - b.y;
        const alcance = d.raio + b.radius;
        if (dx * dx + dy * dy > alcance * alcance) return;

        d.flash = 1;
        // Um golpe é um golpe. O detrito não tem resistência, elemento nem
        // crítico: dar-lhe qualquer um deles o faria participar de um sistema
        // de combate do qual ele não é parte.
        d.vida -= 1;
        if (d.vida <= 0) this.quebrarDetrito(d);

        // Perfuração vale contra pedra também: quem pagou por atravessar
        // fileiras não deve ser parado pelo cenário.
        if (b.pierce > 0) b.pierce--;
        else b.alive = false;
      });
      if (!b.alive) return;

      if (b.friendly) {
        this.enemies.each((e) => {
          if (!b.alive || !e.alive || e.time < 0 || e.id === b.hitId) return;
          if (!this.bulletHitsEnemy(b, e)) return;

          this.hitEnemy(e, b);
          b.hitId = e.id;
          if (b.pierce > 0) b.pierce--;
          else b.alive = false;
        });
      } else if (p.alive && p.invuln <= 0) {
        if (this.circleHitsPlayer(b.x, b.y, b.radius)) {
          b.alive = false;
          this.damagePlayer(b.damageTotal, b.element);
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
    //
    // E entra só sobre os componentes ELEMENTAIS: o normal do pacote atravessa
    // intocado, que é a regra do §3. É a diferença que dá identidade ao dano
    // neutro — ele nunca ganha vantagem, mas também nunca é reduzido.
    const alvo = e.boss?.element ?? e.def.element;
    const { total: dano, melhorMult: mul, dominante } = resolverDano(
      b.damage, alvo, this.currentStats.penetracao,
    );

    const danoEfetivo = this.damageAgainstChallengeMechanics(e, dano, b.x, b.y);

    if (this.sim.laboratorio.active) {
      this.sim.laboratorio.metrics.playerHits++;
      this.sim.laboratorio.metrics.playerDamage += Math.min(Math.max(0, e.hp), danoEfetivo);
    }

    this.applyDamage(e, danoEfetivo);
    e.hitFlash = 0.09;
    const critQualquer = b.crit || b.critElem;
    this.particles.sparks(b.x, b.y, critQualquer ? 8 : 4, critQualquer ? '#ffe08a' : b.color, critQualquer ? 190 : 130);

    // O impacto usa o elemento DOMINANTE do que de fato entrou, não o da arma.
    // É aqui que o modelo de componentes (§3) vira coisa visível: atirar fogo e
    // gelo num alvo que resiste a gelo faz o impacto sair vermelho, porque foi o
    // fogo que passou. Sem isto o pacote seria só contabilidade interna.
    this.particles.flash(
      arteElemental('faisca', dominante, e.id),
      b.x, b.y, critQualquer ? 0.5 : 0.34,
      { vida: 0.16, crescimento: 1.1 },
    );

    if (this.sim.state.settings.showDamageNumbers) {
      // Vantagem sai maior e na cor do elemento que MAIS contribuiu, resistência
      // sai apagada: o jogador aprende o anel olhando os números, sem abrir
      // tabela nenhuma. A cor vem do dominante e não do elemento da arma porque
      // agora um tiro carrega vários componentes ao mesmo tempo.
      const forte = mul > 1.01;
      const fraco = mul < 0.99;
      const cor = critQualquer ? '#ffd35a' : forte ? getElement(dominante).glow : fraco ? '#7e8aa0' : '#e8f2ff';
      const tam = (critQualquer ? 16 : 12) * (forte ? 1.25 : fraco ? 0.85 : 1);
      this.particles.popup(e.x + this.rng.range(-8, 8), e.y - 12, danoEfetivo <= 0 ? 'IMUNE' : fmt(danoEfetivo, 1), danoEfetivo <= 0 ? '#aab7d0' : cor, tam);
    }

    if (b.splash > 0) {
      this.particles.shockwave(b.x, b.y, b.splash, 'rgba(255,170,90,.8)', 0.22);
      this.enemies.each((other) => {
        if (other === e || !other.alive) return;
        if (Math.hypot(other.x - b.x, other.y - b.y) > b.splash) return;
        const respingo = resolverDano(
          b.damage, other.boss?.element ?? other.def.element, this.currentStats.penetracao,
        );
        const splashDamage = this.damageAgainstChallengeMechanics(other, respingo.total * 0.45, b.x, b.y);
        if (this.sim.laboratorio.active) {
          this.sim.laboratorio.metrics.playerHits++;
          this.sim.laboratorio.metrics.playerDamage += Math.min(Math.max(0, other.hp), splashDamage);
        }
        this.applyDamage(other, splashDamage);
        other.hitFlash = 0.07;
        if (other.hp <= 0) this.killEnemy(other, true);
      });
    }

    if (e.hp <= 0) this.killEnemy(e, true);
  }

  /** Regras de alvo da Provação ficam concentradas aqui para valerem para tiro e explosão. */
  private damageAgainstChallengeMechanics(e: Enemy, amount: number, x: number, y: number): number {
    const d = this.sim.desafio;
    if (!d || !e.boss || amount <= 0) return amount;
    if (e.invulnerable) return 0;

    const efeitos = d.efeitos;
    if (efeitos.pontoFraco > 0) {
      const weak = this.weakPointOf(e);
      if (Math.hypot(x - weak.x, y - weak.y) <= efeitos.pontoFracoRaio) return amount * efeitos.pontoFraco;
    }
    return e.barrierActive ? amount * (1 - efeitos.barreiraFrontal) : amount;
  }

  private weakPointOf(e: Enemy): { x: number; y: number } {
    // Uma órbita curta torna o ponto fraco legível e evita uma área parada que
    // pudesse ser atingida sem intenção por qualquer tiro vertical.
    const a = e.time * 1.8 + e.id;
    return { x: e.x + Math.cos(a) * 38 * e.scale, y: e.y + Math.sin(a) * 26 * e.scale };
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

    // Zera a pausa da regeneração e alimenta o registro do piso. Aqui, e não em
    // , porque este é o ponto por onde TODO dano passa — inclusive o
    // de explosão e o de perfuração.
    const d = this.sim.desafio;
    if (d && e.boss) {
      d.semDanoHa = 0;
      d.danoCausado += amount;

      /**
       * REFLEXO: parte do dano volta.
       *
       * Aplicado sobre o dano REAL, e não sobre o dano nominal do chefe: é o
       * que faz o modificador punir a rajada e poupar quem bate devagar — a
       * leitura que a descrição promete ("cuidado com a rajada").
       *
       * O retorno é neutro de propósito. Devolvê-lo no elemento do chefe faria
       * a resistência do jogador anular o modificador inteiro para quem tivesse
       * a peça certa, e um modificador que some com um item não é modificador.
       */
      if (d.efeitos.reflexo > 0) {
        this.damagePlayer(amount * d.efeitos.reflexo * VerticalMode.REFLEXO_ESCALA);
      }

      // FRAGMENTAÇÃO: ao cruzar o limiar, o chefe se parte em dois.
      if (d.efeitos.divideEm > 0 && !d.dividiu && e.hp > 0 && e.hp / e.maxHp <= d.efeitos.divideEm) {
        d.dividiu = true;
        this.fragmentarChefe(e);
      }
    }
  }

  /**
   * Parte o chefe em dois.
   *
   * Os dois pedaços dividem a vida RESTANTE, não recebem vida nova: fragmentar
   * não pode ser uma segunda barra de vida disfarçada. O que muda é o problema —
   * dois alvos ao mesmo tempo, cada um atirando.
   *
   * O clone não conta como unidade (`counts = false`): o encontro acaba quando
   * o original cai, senão matar o clone e perder o original travaria a luta num
   * estado sem saída.
   */
  private fragmentarChefe(original: Enemy): void {
    const metade = original.hp / 2;
    original.hp = metade;
    original.maxHp = metade;

    const clone = this.spawnEnemy(
      original.def,
      clamp(original.x + 180, 80, VIEW.w - 80),
      original.y,
      metade,
      original.damage * 0.75,
    );
    if (!clone) return;
    clone.boss = original.boss;
    clone.radius = original.radius * 0.8;
    clone.scale = original.scale * 0.8;
    clone.share = 0;
    clone.counts = false;
    clone.challengeClone = true;
    clone.entering = false;

    this.setBanner('FRAGMENTAÇÃO');
    this.shake = Math.max(this.shake, 12);
    this.particles.shockwave(original.x, original.y, 260, 'rgba(255,180,90,.9)', 0.5);
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

  /**
   * Move a poeira e a recicla pelo topo.
   *
   * Três faixas de velocidade dentro da própria poeira, e não uma só: mesmo
   * dentro de uma camada, a variação é o que impede a leitura de "folha de
   * papel com pontos" e produz volume.
   */
  private updatePoeira(dt: number): void {
    for (const g of this.poeira) {
      if (g.vel <= 1) {
        // Primeira volta: semeia em posição e faixa aleatórias.
        g.x = this.rng.range(0, VIEW.w);
        g.y = this.rng.range(0, VIEW.h);
        g.raio = this.rng.range(POEIRA.raioMin, POEIRA.raioMax);
        // Grão maior é mais perto: mais rápido e mais opaco. É a mesma
        // relação que o parallax usa entre camadas, aplicada dentro de uma.
        const perto = (g.raio - POEIRA.raioMin) / (POEIRA.raioMax - POEIRA.raioMin);
        g.vel = POEIRA.velocidade * PROFUNDIDADE.ambiente * (0.55 + perto * 0.9);
        g.alfa = POEIRA.alfaMax * (0.35 + perto * 0.65);
        continue;
      }
      g.y += g.vel * dt;
      if (g.y - g.raio > VIEW.h) {
        g.y = -g.raio;
        g.x = this.rng.range(0, VIEW.w);
      }
    }
  }

  // ── detritos: o cenário que atrapalha ───────────────────────────────────

  /**
   * Faz o tempo do clima e move o que está em campo.
   *
   * Não roda no Laboratório: lá a tela existe para COMPARAR fichas, e um
   * asteroide atravessando a medição a invalidaria sem avisar.
   */
  private updateDetritos(dt: number): void {
    if (this.sim.laboratorio.active) { this.detritos.clear(); return; }

    this.girarClima(dt);
    this.semearDetritos(dt);

    const p = this.player;
    this.detritos.each((d) => {
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.giro += d.giroVel * dt;
      d.flash = Math.max(0, d.flash - dt * 4);

      // Sai por baixo e some. Não volta pelo topo: um detrito que reaparece
      // quebra a leitura de que a nave está avançando pelo espaço.
      if (d.y - d.raio > VIEW.h + 40) { d.alive = false; return; }

      // `invuln` e não `invulnerable`: aquele é do Player, em segundos de
      // graça pós-respawn; este é do Enemy. Cobrar encontrão de uma nave que
      // acabou de renascer seria matá-la de novo antes de ela poder reagir.
      if (!d.bateu && p.alive && p.invuln <= 0) {
        const dx = d.x - p.x;
        const dy = d.y - p.y;
        const alcance = d.raio + Math.max(p.hitbox.width, p.hitbox.height) * 0.5;
        if (dx * dx + dy * dy < alcance * alcance) {
          d.bateu = true;
          // Dano NORMAL, sem elemento: uma pedra não tem afinidade, e dar-lhe
          // uma faria o anel elemental responder por algo que não é combate.
          this.damagePlayer(d.impacto);
          this.quebrarDetrito(d, true);
        }
      }
    });
    this.detritos.compact();
  }

  /**
   * Alterna entre o repouso e os momentos.
   *
   * O intervalo é sorteado numa faixa larga (22 a 48s) de propósito: um evento
   * que chega em relógio fixo deixa de ser evento e vira fase.
   */
  private girarClima(dt: number): void {
    if (this.climaRestante > 0) {
      this.climaRestante -= dt;
      if (this.climaRestante <= 0) {
        this.climaAtual = 'esparso';
        this.climaEspera = this.rng.range(INTERVALO_MIN, INTERVALO_MAX);
      }
      return;
    }

    this.climaEspera -= dt;
    if (this.climaEspera > 0) return;

    const momentos = CLIMAS.filter((c) => c.peso > 0);
    const escolhido = this.rng.weighted(momentos, (c) => c.peso);
    this.climaAtual = escolhido.id;
    this.climaRestante = escolhido.duracao;
    this.setBanner(escolhido.nome);
  }

  /** Solta detritos conforme a taxa do clima corrente. */
  private semearDetritos(dt: number): void {
    const clima = CLIMA_POR_ID.get(this.climaAtual) ?? CLIMAS[0]!;
    if (this.detritos.size >= DETRITOS_MAX) return;

    // Acumulador fracionário: a taxa de repouso é 0,35/s, que num quadro de
    // 1/60 dá 0,006 detrito. Arredondar por quadro nunca soltaria nada.
    this.detritoAcumulado += clima.taxa * dt;
    while (this.detritoAcumulado >= 1) {
      this.detritoAcumulado -= 1;
      this.nascerDetrito(clima);
    }
  }

  private nascerDetrito(clima: Clima): void {
    const d = this.detritos.spawn();
    if (!d) return;

    const familia: FamiliaDeDetrito = clima.familia === 'ambas'
      ? (this.rng.chance(0.62) ? 'asteroide' : 'lixo')
      : clima.familia;
    const tamanho = tamanhoSorteado(this.rng, clima.mistura);
    const perfil = PERFIL_DE_DETRITO[tamanho];

    d.raio = perfil.raio;
    d.vida = perfil.vida;
    d.vidaMax = perfil.vida;
    d.sprite = spriteDeDetrito(familia, tamanho, this.rng.int(0, 999));

    // A escala sai do tamanho REAL do sprite, como os corpos celestes já fazem.
    //
    // O desenho dividia por 96 fixo, mas o atlas assa cada grupo num tamanho
    // diferente — 26 o pequeno, 52 o médio, 96 o grande. Só o grande saía no
    // tamanho que o raio prometia: o médio vinha a 54% dele e o pequeno a 27%,
    // uma pedrinha de 6 unidades comendo tiro num raio de 11.
    //
    // Normalizar pelo lado MAIOR (e não pela largura) preserva a proporção de
    // arte que não é quadrada, que é a maioria do lixo espacial.
    const found = assets.atlases.lookup(d.sprite);
    d.escala = found ? (perfil.raio * 2) / Math.max(found.frame.sw, found.frame.sh) : 1;
    d.giro = this.rng.range(0, Math.PI * 2);
    d.giroVel = this.rng.range(-perfil.giro, perfil.giro) * Math.PI * 2;
    d.impacto = this.sim.encounter.damage * perfil.impacto;

    // Nasce acima da tela, na largura inteira. A deriva lateral é pequena: um
    // campo de detritos atravessando na diagonal leria como ataque, e estes
    // não atacam — eles só estão ali.
    d.x = this.rng.range(d.raio, VIEW.w - d.raio);
    d.y = -d.raio - this.rng.range(0, 60);
    d.vx = this.rng.range(-14, 14);
    d.vy = VELOCIDADE_BASE * perfil.velocidade * this.rng.range(0.85, 1.15);
  }

  /**
   * Tira um detrito de campo, com estouro.
   *
   * Não chama `rewardKill`, não mexe em `restam`, não registra fato e não conta
   * abate. Isso não é esquecimento: é a definição do que um detrito é.
   */
  private quebrarDetrito(d: Detrito, colisao = false): void {
    d.alive = false;
    // `debris` e não `burst`: aquele é para clipe animado de explosão, este é
    // estilhaço solto — que é literalmente o que sobra de uma pedra quebrada.
    this.particles.debris(
      d.x, d.y,
      Math.round(6 + d.raio * 0.45),
      colisao ? '#ffd08a' : '#b9a58c',
      40 + d.raio * 2.2,
    );
    // Só o grande sacode a tela. Um cascalho tremendo a câmera daria a um
    // detrito o peso de um chefe.
    if (d.raio >= 30) this.shake = Math.max(this.shake, colisao ? 9 : 5);
  }

  private drawDetritos(s: Surface): void {
    this.detritos.each((d) => {
      s.sprite(d.sprite, d.x, d.y, { scale: d.escala, rotation: d.giro });
      if (d.flash > 0) {
        s.sprite(d.sprite, d.x, d.y, {
          scale: d.escala, rotation: d.giro,
          alpha: d.flash * 0.8, composite: 'lighter',
        });
      }
    });
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

  /**
   * A barra de especial do chefe da Provação.
   *
   * Todo o vocabulário do modo mora em `sim/desafio.ts`; aqui só se traduz o
   * que ele devolve em coisas que a cena sabe fazer — aviso, dano, partícula.
   * É a fronteira que mantém este arquivo sem `if (estáNaProvação)` espalhado.
   */
  private tickDesafio(dt: number): void {
    const d = this.sim.desafio;
    if (!d) return;

    const chefe = this.enemies.items.find((x) => x.alive && !!x.boss && !x.challengeClone) ?? null;

    /**
     * A regeneração PAUSA enquanto o chefe está levando dano.
     *
     * Sem a pausa ela vira um piso de DPS: se o seu dano por segundo for menor
     * que a regeneração, o chefe é literalmente imortal e nenhuma habilidade
     * resolve. Medido no simulador antes da correção: o piso 20 pedia
     * 15 milhões de segundos. O §87 proíbe exatamente isso — "transformar cada
     * piso em DPS check".
     *
     * Com a pausa, o modificador passa a significar o que a descrição dele
     * sempre disse: "exige dano SUSTENTADO". Quem mantém pressão nunca vê a
     * regeneração; quem para para desviar do especial paga o preço.
     */
    if (chefe && d.efeitos.regen > 0) {
      d.semDanoHa += dt;
      if (d.semDanoHa >= VerticalMode.REGEN_APOS) {
        chefe.hp = Math.min(chefe.maxHp, chefe.hp + chefe.maxHp * d.efeitos.regen * dt);
      }
    }
    if (d.efeitos.travaEscudo) this.player.shieldLock = 0.25;

    switch (this.sim.tickDesafio(dt)) {
      case 'aviso': {
        // O AVISO é o que separa dificuldade de imposto: sem ele o jogador
        // perde sem ter tido o que fazer.
        this.setBanner(d.especial.nome.toUpperCase());
        this.flash = Math.max(this.flash, 0.35);
        if (chefe) this.particles.shockwave(chefe.x, chefe.y, 140, d.especial.cor, d.especial.aviso);
        break;
      }
      case 'dispara': {
        this.dispararEspecial(d, chefe);
        break;
      }
      case 'tempo': {
        // Estourar o limite conta como derrota, e não como saída silenciosa.
        this.sim.falharPisoDaProvacao(d.piso, {
          tempo: d.tempo, danoCausado: d.danoCausado, danoRecebido: d.danoRecebido,
        });
        this.damagePlayer(this.player.hp + this.player.shield + 1);
        break;
      }
      default: break;
    }
  }

  /** Aplica o efeito do especial. Cada família bate de um jeito. */
  private dispararEspecial(d: NonNullable<Sim['desafio']>, chefe: Enemy | null): void {
    const ef = d.especial.efeito;
    const base = this.sim.encounter.damage;

    this.shake = Math.max(this.shake, 14);
    this.flash = Math.max(this.flash, 0.6);
    if (chefe) this.particles.shockwave(chefe.x, chefe.y, 320, d.especial.cor, 0.5);

    if (ef.quebraEscudo) this.player.shield = 0;
    if (ef.selaEscudo) this.player.shieldLock = ef.selaEscudo;
    if (ef.atordoa) this.player.stun = Math.max(this.player.stun, ef.atordoa);
    if (ef.lentidao) {
      this.player.slow = ef.lentidao;
      this.player.slowFor = ef.lentidaoDuracao ?? 2;
    }
    if (ef.dano) this.damagePlayer(base * ef.dano, d.chefe.elemento);

    if (chefe) {
      if (ef.cura) chefe.hp = Math.min(chefe.maxHp, chefe.hp + chefe.maxHp * ef.cura);
      if (ef.escudaSe) chefe.hp = Math.min(chefe.maxHp, chefe.hp + chefe.maxHp * ef.escudaSe * 0.5);
      if (ef.invoca) this.summonMinions('drone', ef.invoca, chefe);
    }
  }

  /** Prepara o painel de vitória e começa a contagem. */
  private beginVictory(): void {
    const e = this.sim.encounter;

    /**
     * Vitória na Provação: conclui o piso ANTES de montar o painel.
     *
     * A ordem importa porque `concluirPisoDaProvacao` fecha o desafio, e o
     * painel precisa ler o encontro enquanto ele ainda existe — daí a cópia de
     * `e` acima, feita antes.
     */
    const d = this.sim.desafio;
    if (d) {
      const camadas = this.sim.concluirPisoDaProvacao(d.piso, {
        tempo: d.tempo, danoCausado: d.danoCausado, danoRecebido: d.danoRecebido,
      });
      // O marco merece mais barulho: é o pico que o jogador vai lembrar.
      this.setBanner(camadas.includes('marco') ? 'MARCO CONQUISTADO' : 'PISO CONCLUÍDO');
    }
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

    const jitter = this.shake > 0.1 && this.sim.state.settings.tremorDeTela ? this.shake : 0;
    s.ctx.save();
    if (jitter) s.ctx.translate(this.rng.range(-jitter, jitter), this.rng.range(-jitter, jitter));

    this.drawDangerZones(s);
    // Detritos ficam ATRÁS dos inimigos e à frente do fundo. São cenário com
    // volume: passar por cima do inimigo esconderia o que o jogador precisa
    // acertar, e ficar no fundo os transformaria em textura.
    this.drawDetritos(s);
    this.drawPickups(s);
    this.drawEnemies(s);
    this.drawPlayer(s);
    this.drawBullets(s);
    this.particles.draw(s);
    if (this.sim.laboratorio.active && this.sim.laboratorio.config.showHitboxes) this.drawHitboxes(s);

    s.ctx.restore();

    if (this.flash > 0.01) {
      s.ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.4})`;
      s.ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }

    this.drawHud(s);
  }

  private drawBackground(s: Surface): void {
    /**
     * O cenário da galáxia, em até três camadas com rolagens diferentes.
     *
     * Antes era UMA imagem parada a 75% de alfa. Ficava quase preta — a camada
     * distante dos conjuntos novos é escura de propósito, porque foi desenhada
     * para ter nebulosa e estrelas por cima. Sozinha, ela é o vazio que sobra.
     *
     * As camadas rolam em velocidades crescentes (a distante quase parada, as
     * estrelas rápidas), que é o que cria profundidade: sem a diferença de
     * velocidade seriam três imagens sobrepostas, não um parallax.
     */
    // O véu inteiro é aplicado no DESENHO, e não depois, por cima. Ver
    // `rebaixarCenario` para o que estava errado antes.
    s.ctx.save();
    s.ctx.filter = VEU_DE_CENARIO;

    for (const camada of this.galaxyLayers) {
      const img = assets.peek(camada.src);
      if (!img) continue;

      const scale = Math.max(VIEW.w / img.width, VIEW.h / img.height);
      const w = img.width * scale;
      const hgt = img.height * scale;
      const x = (VIEW.w - w) / 2;
      // Rolagem cíclica: o deslocamento é reduzido à altura da imagem e ela é
      // desenhada duas vezes, uma acima da outra, para não haver costura.
      const y = ((this.elapsed * camada.velocidade) % hgt + hgt) % hgt;

      s.ctx.globalAlpha = camada.alfa;
      s.ctx.drawImage(img, x, y - hgt, w, hgt);
      s.ctx.drawImage(img, x, y, w, hgt);
      s.ctx.globalAlpha = 1;
    }


    // Corpos celestes: os distantes primeiro, para o corpo da fase ficar por
    // cima. `fx` é fração da largura, então mudar de janela não os desloca.
    //
    // Saem do atlas `orbe`, não de imagens soltas: cada corpo tem proporção
    // própria (um anel é largo e baixo, uma cauda de cometa é oblíqua) e forçar
    // tudo num quadrado, como fazia o `drawImage` anterior, achatava a arte.
    // Textura interna achatada. O que engole a silhueta de um inimigo não é o
    // brilho médio do corpo — é a TEXTURA: cratera, faixa de nuvem, mancha. Um
    // planeta escuro cheio de detalhe destrói leitura igual a um claro, e foi
    // por isso que a medição por PICO de luminância deu o cenário como
    // aprovado enquanto ele continuava comendo inimigo.
    //
    // `brightness` acompanha o `contrast` porque este puxa tudo para o cinza
    // médio, e sozinho deixaria o lado ESCURO do planeta mais claro que antes.
    // O filtro do corpo celeste, numa string só: `ctx.filter` substitui e não
    // acumula, então aninhar não existe.
    //
    // A ordem é a da intenção, e cada etapa desfaz um efeito colateral da
    // anterior: recuar (brilho do véu) → achatar a textura (contraste) →
    // compensar o clareamento que o achatamento causa (brilho) → devolver o
    // croma que o achatamento comeu (saturação).
    //
    // Note que o `saturate` do véu NÃO entra aqui: o achatamento já dessatura
    // muito mais do que o véu pretendia, e somar os dois deixava o corpo em 20%
    // de saturação contra os 28 a 45% da régua.
    s.ctx.filter = [
      `brightness(${CENARIO_LUMINOSIDADE})`,
      `contrast(${CORPO_CELESTE.contraste})`,
      `brightness(${CORPO_CELESTE.luminosidade})`,
      `saturate(${CORPO_CELESTE.saturacaoDeVolta})`,
    ].join(' ');
    for (let i = this.skyProps.length - 1; i >= 0; i--) {
      const prop = this.skyProps[i]!;
      const found = assets.atlases.lookup(prop.key);
      if (!found) continue;
      const escala = prop.size / Math.max(found.frame.sw, found.frame.sh);
      s.sprite(prop.key, prop.fx * VIEW.w, prop.y + prop.size / 2, { scale: escala, alpha: prop.alpha });
    }
    s.ctx.restore();

    this.drawPoeira(s);
  }

  /**
   * Havia aqui um `rebaixarCenario` que passava DUAS demãos por cima do
   * cenário pronto: uma de `globalCompositeOperation = 'saturation'` e uma de
   * preto translúcido. As duas saíram, e a de saturação estava simplesmente
   * errada.
   *
   * O modo `saturation` toma a saturação da FONTE e o matiz e a luminosidade
   * do destino. Preenchendo a tela com `hsl(0, 68%, 50%)`, o que ele faz não é
   * conservar 68% da saturação de cada pixel — é FIXAR a saturação de todos em
   * 68%. Medido:
   *
   * | pixel | antes | depois |
   * |---|---|---|
   * | rgb(30,40,90) | 67% | 97% |
   * | rgb(60,120,70) | 50% | 100% |
   * | **rgb(100,96,92)** | **8%** | **100%** |
   *
   * Um cinza quase neutro virava laranja vivo. É de onde vinham as manchas
   * roxas e a borda verde nos planetas: toda variação sutil de matiz dentro da
   * textura era esticada até o máximo.
   *
   * O defeito é antigo — nasceu junto com o véu — e ficou escondido porque a
   * arte crua já era saturada, e forçar 68% num pixel que já tinha 80% quase
   * não aparece. O `contrast` dos corpos celestes é que o revelou: ele
   * dessatura o planeta e produz justamente os pixels quase-cinza que o blend
   * explodia.
   *
   * A saturação agora é `saturate()` no `ctx.filter`, que é um MULTIPLICADOR
   * de verdade, aplicado no desenho de cada camada. E a luminosidade virou
   * `brightness()` na mesma string, o que dispensa a segunda demão: escurecer
   * multiplicando preserva a proporção entre os canais, enquanto pintar preto
   * translúcido por cima empurra tudo na direção de uma cor só.
   */
  /**
   * Poeira estelar: a terceira referência de profundidade.
   *
   * Com duas camadas o olho lê "fundo e frente"; com três ele lê espaço. Estes
   * grãos passam DEPOIS do véu justamente para não serem rebaixados por ele —
   * eles são o primeiro plano ambiental, não cenário distante.
   *
   * Baixa intensidade de propósito: partícula demais vira ruído visual e come
   * exatamente a legibilidade que o véu acabou de comprar.
   */
  private drawPoeira(s: Surface): void {
    if (this.sim.state.settings.reduceEffects) return;
    const ctx = s.ctx;
    ctx.save();
    for (const g of this.poeira) {
      ctx.globalAlpha = g.alfa;
      ctx.fillStyle = g.cor;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.raio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(s: Surface): void {
    const p = this.player;
    if (!p.alive) return;

    const hull = this.currentHull;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
    const alpha = blink ? 0.4 : 1;

    s.glow(p.x, p.y + 22, 26, hull.trail, 0.5);

    // Cascos do pack Void são montados em camadas e trocam de arte conforme o
    // dano — dá para ver a nave se despedaçando sem olhar a barra de vida.
    if (hull.damageStates) {
      const scale = this.sim.escalaDoCasco(hull.id);
      const boosting = Math.hypot(p.vx, p.vy) > this.currentStats.velocidade * 0.75;
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
      s.sprite(sprite, p.x, p.y, { scale: this.sim.escalaDoCasco(hull.id), alpha, rotation: p.bank * 0.13 });
    }

    // Duas travas, e a do Laboratório continua mandando lá dentro: ela existe
    // para COMPARAR fichas sem a bolha atrapalhar a leitura, e não deve depender
    // do que o jogador prefere ver na campanha.
    const mostrarEscudo = this.sim.laboratorio.active
      ? this.sim.laboratorio.config.showPlayerShieldVisual
      : this.sim.state.settings.mostrarEscudo;
    if (p.shield > 1 && mostrarEscudo) {
      // A barreira hexagonal da folha arcade comunica a carga pela opacidade;
      // quando o escudo está baixo ela quase some, sem precisar de outra barra.
      const frac = clamp01(p.shield / Math.max(1, p.shieldMax));
      const pulse = 1 + Math.sin(p.shieldLock > 0 ? 0 : performance.now() / 420) * 0.03;
      // O sprite tem 88px; a bolha deve fechar pouco além do raio de colisão.
      s.sprite('barrier/1', p.x, p.y, {
        scale: ((Math.max(p.hitbox.width, p.hitbox.height) + 26) / 88) * pulse,
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

      if (e.boss && this.sim.desafio) this.drawChallengeMarkers(s, e);

      // Barra de vida só para quem não morre num tiro — poluiria a tela.
      if (!e.boss && e.maxHp > 1 && e.hp < e.maxHp) {
        const w = 34;
        const frac = clamp01(e.hp / e.maxHp);
        s.rect(e.x - w / 2, e.y - e.radius * e.scale - 12, w, 3, 'rgba(0,0,0,.55)');
        s.rect(e.x - w / 2, e.y - e.radius * e.scale - 12, w * frac, 3, frac > 0.5 ? '#5ce08a' : frac > 0.25 ? '#ffb638' : '#ff5d7a');
      }
    });
  }

  private drawDangerZones(s: Surface): void {
    const ctx = s.ctx;
    for (const zone of this.dangerZones) {
      const armed = zone.warmup <= 0;
      const pulse = 1 + Math.sin(this.elapsed * 9) * 0.06;
      ctx.save();
      ctx.globalAlpha = armed ? 0.24 : 0.16 + (1 - zone.warmup / 0.75) * 0.18;
      ctx.fillStyle = armed ? '#ff4f72' : '#ffb638';
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, TAU); ctx.fill();
      ctx.globalAlpha = armed ? 0.9 : 0.75;
      ctx.strokeStyle = armed ? '#ff7790' : '#ffe08a';
      ctx.lineWidth = armed ? 2.5 : 2;
      ctx.setLineDash(armed ? [] : [7, 6]);
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  private drawChallengeMarkers(s: Surface, e: Enemy): void {
    const ctx = s.ctx;
    const radius = Math.max(e.radius * e.scale + 12, 32);
    ctx.save();
    if (e.invulnerable) {
      ctx.strokeStyle = '#d5b7ff';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.barrierActive) {
      // O semicírculo da frente indica a direção protegida sem cercar a nave
      // inteira num brilho igual ao da invulnerabilidade.
      ctx.strokeStyle = '#49d8ff';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(e.x, e.y, radius + 5, Math.PI * .12, Math.PI * .88); ctx.stroke();
    }
    const ef = this.sim.desafio?.efeitos;
    if (ef && ef.pontoFraco > 0) {
      const weak = this.weakPointOf(e);
      s.glow(weak.x, weak.y, ef.pontoFracoRaio * 1.6, '#ffe08a', 0.72);
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.moveTo(weak.x, weak.y - 8); ctx.lineTo(weak.x + 8, weak.y);
      ctx.lineTo(weak.x, weak.y + 8); ctx.lineTo(weak.x - 8, weak.y); ctx.closePath(); ctx.fill();
    }
    if (e.challengeClone) {
      s.text('ECO', e.x, e.y - radius - 10, { size: 9, color: '#c596ff', align: 'center', shadow: 'rgba(0,0,0,.85)' });
    }
    ctx.restore();
  }

  /**
   * Rastro, halo e núcleo — nessa ordem, que é a ordem da profundidade.
   *
   * O desenho anterior era um sprite a 0,92 de alfa, e o comentário explicava
   * que aditivo estouraria em branco. O diagnóstico estava certo; a conclusão,
   * não. Desistir da presença num jogo cuja linguagem É o projétil custou caro:
   * mediana medida de 1,3 marcas em tela.
   *
   * O rastro sai da VELOCIDADE, não de um histórico guardado. Como o projétil
   * anda em linha reta, a posição de dois quadros atrás é `x - vx * t` — e um
   * buffer de posições por projétil seria memória e trabalho para reproduzir
   * uma conta de uma linha.
   *
   * O núcleo subiu para alfa 1. Se a régua do cenário diz que o projétil é o
   * elemento mais legível da tela, ele não pode ser o único desenhado
   * translúcido.
   */
  private drawBullets(s: Surface): void {
    this.bullets.each((b) => {
      const rotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      const escala = b.scale * (b.crit ? 1.25 : 1);

      // Duas gramáticas de forma, e é ELA que diz ameaça — a cor está ocupada
      // dizendo o elemento, e o anel elemental precisa dessa leitura.
      const passos = b.friendly ? PROJETIL.rastroPassos : AMEACA.rastroPassos;

      // Do mais fraco para o mais forte: o rastro fica por baixo do núcleo.
      for (let k = passos; k >= 1; k--) {
        const t = PROJETIL.rastroPasso * k;
        s.sprite(b.sprite, b.x - b.vx * t, b.y - b.vy * t, {
          scale: escala * (1 - k * 0.16),
          rotation,
          alpha: 0.3 / k,
        });
      }

      // O halo é aditivo, mas é um gradiente de alfa baixo e não um sprite
      // cheio: mesmo empilhado numa salva de multishot ele soma devagar.
      s.glow(b.x, b.y, b.radius * PROJETIL.haloRaio * escala, b.color, PROJETIL.haloAlfa);

      // O contorno do tiro inimigo: a MESMA silhueta, escura, deslocada para
      // os quatro lados e desenhada por baixo do núcleo.
      //
      // A versão anterior era um anel radial de raio 3,2 — e virou uma bola
      // preta em volta de cada tiro. O erro foi de método: calibrei o anel
      // medindo a profundidade do vale de luminância, que ficou linda (44%
      // mais escuro no raio previsto), e nunca medi o TAMANHO da coisa. Com
      // raio 8 e escala 0,6, aquele anel tinha 30 unidades de diâmetro:
      // maior que vários inimigos.
      //
      // Um contorno que acompanha a forma não tem esse problema — ele não
      // pode crescer além do sprite, porque É o sprite. E vem DEPOIS do halo
      // de propósito: por baixo dele, o aditivo o clareava de volta, que foi
      // exatamente o defeito da primeira tentativa.
      if (!b.friendly) {
        const p = AMEACA.contornoPasso;
        for (const [dx, dy] of [[-p, 0], [p, 0], [0, -p], [0, p]] as const) {
          s.sprite(b.sprite, b.x + dx, b.y + dy, {
            scale: escala, rotation,
            tint: AMEACA.contornoCor, tintAlpha: 1, alpha: AMEACA.contornoAlfa,
          });
        }
      }

      s.sprite(b.sprite, b.x, b.y, { scale: escala, rotation });
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

  /**
   * A moldura dos dois cantos do HUD.
   *
   * Um retângulo com o canto EXTERNO chanfrado — o de cima-esquerda no módulo
   * da esquerda, o de cima-direita no da direita. É o chanfro que dá a leitura
   * "instrumento" sem custar espaço: uma moldura completa em volta de tudo
   * seria o painel gigante que não se quer.
   *
   * Fundo bem escuro e borda de um pixel. O HUD não precisa brilhar — ele
   * precisa não ser confundido com a cena, e uma superfície mais escura que o
   * espaço já faz isso.
   */
  private moduloHud(s: Surface, x: number, y: number, w: number, h: number, espelhado: boolean): void {
    const ctx = s.ctx;
    const corte = 11;

    ctx.save();
    ctx.beginPath();
    if (espelhado) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - corte, y);
      ctx.lineTo(x + w, y + corte);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    } else {
      ctx.moveTo(x + corte, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + corte);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(5, 11, 20, .72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(107, 155, 190, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Um filete na aresta interna, do lado que aponta para o centro da tela.
    // É o detalhe que faz o módulo parecer encaixado na borda em vez de
    // flutuando sobre ela.
    ctx.strokeStyle = 'rgba(79, 195, 255, .45)';
    ctx.beginPath();
    const fx = espelhado ? x : x + w;
    ctx.moveTo(fx, y + (espelhado ? 0 : corte));
    ctx.lineTo(fx, y + h);
    ctx.stroke();
    ctx.restore();
  }

  private drawHud(s: Surface): void {
    const p = this.player;
    const sim = this.sim;
    const pad = 16;

    // Casco e escudo, dentro de um módulo. Antes eram barras soltas sobre o
    // combate, e é isso que faz um HUD parecer COLADO: sem moldura, o olho não
    // separa o que é instrumento do que é cena, e as duas coisas disputam.
    const barW = 158;
    const moduloW = barW + 20;
    this.moduloHud(s, pad, pad, moduloW, 40, false);

    const bx = pad + 10;
    const by = pad + 11;
    s.rect(bx, by, barW, 7, 'rgba(4,10,20,.9)');
    s.rect(bx, by, barW * clamp01(p.hp / Math.max(1, p.hpMax)), 7, '#ff5d7a');
    s.rect(bx, by + 10, barW, 5, 'rgba(4,10,20,.9)');
    s.rect(bx, by + 10, barW * clamp01(p.shield / Math.max(1, p.shieldMax)), 5, '#4db8ff');
    // O número fica DENTRO do módulo, alinhado à direita: fora dele voltaria a
    // ser texto solto sobre a cena, que é o problema que o módulo resolve.
    s.text(`${fmt(p.hp, 0)} / ${fmt(p.hpMax, 0)}`, pad + moduloW - 10, pad + 33, {
      size: 10.5, color: '#94aec4', align: 'right',
    });

    if (sim.laboratorio.active) {
      const m = sim.laboratorio.metrics;
      s.text('LABORATÓRIO · SEM RECOMPENSAS', VIEW.w - pad, pad + 6, { size: 17, color: '#67f5c8', align: 'right' });
      s.text(`${m.activeEnemies} alvos · ${m.kills} abates · ${(m.playerDamage / Math.max(.01, m.elapsed)).toFixed(1)} DPS`, VIEW.w - pad, pad + 26, { size: 12, color: '#9cb6c9', align: 'right' });
      if (sim.laboratorio.paused) s.text('PAUSADO', VIEW.w / 2, 48, { size: 18, color: '#ffe08a', align: 'center' });
      if (!p.alive) {
        s.ctx.fillStyle = 'rgba(4,6,14,.55)';
        s.ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        s.text('RECONSTRUINDO CASCO…', VIEW.w / 2, VIEW.h / 2, { size: 20, color: '#ff8a9a', align: 'center' });
      }
      return;
    }

    // Setor e onda, canto superior direito.
    const boss = this.enemies.items.find((e) => e.alive && e.boss);

    // O MESMO módulo, espelhado. Dois cantos com a mesma gramática lêem como um
    // instrumento só; dois desenhos diferentes leriam como duas interfaces.
    const dirW = 132;
    this.moduloHud(s, VIEW.w - pad - dirW, pad, dirW, 40, true);

    s.text(`SETOR ${sim.state.run.sector}`, VIEW.w - pad - 10, pad + 17, {
      size: 14, color: '#9fe8ff', align: 'right',
    });
    // Com chefe em tela o nome já aparece na barra dele; repetir aqui só polui.
    if (!boss) {
      s.text(sim.encounterLabel, VIEW.w - pad - 10, pad + 33, {
        size: 10.5, color: '#7f95ad', align: 'right',
      });
    }

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

  private drawHitboxes(s: Surface): void {
    const ctx = s.ctx;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#67f5c8';
    const box = this.player.hitbox;
    const cx = this.player.x + box.offsetX;
    const cy = this.player.y + box.offsetY;
    ctx.strokeRect(cx - box.width / 2, cy - box.height / 2, box.width, box.height);
    ctx.fillStyle = '#67f5c8';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.moveTo(this.player.x - 5, this.player.y); ctx.lineTo(this.player.x + 5, this.player.y);
    ctx.moveTo(this.player.x, this.player.y - 5); ctx.lineTo(this.player.x, this.player.y + 5);
    ctx.stroke();
    ctx.strokeStyle = '#ff6b8b';
    this.enemies.each((e) => {
      if (e.hitbox) {
        const cx = e.x + e.hitbox.offsetX;
        const cy = e.y + e.hitbox.offsetY;
        ctx.strokeRect(cx - e.hitbox.width / 2, cy - e.hitbox.height / 2, e.hitbox.width, e.hitbox.height);
        ctx.fillStyle = '#ff6b8b';
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      } else {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * e.scale, 0, TAU); ctx.stroke();
      }
    });
    ctx.strokeStyle = '#ffe08a';
    this.bullets.each((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.stroke(); });
    ctx.restore();
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
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}

/** Preenchido em `bootVertical()` para evitar ciclo de import com os dados. */
const MINION_CACHE = new Map<string, EnemyDef>();

export function registerMinions(defs: readonly EnemyDef[]): void {
  for (const def of defs) MINION_CACHE.set(def.id, def);
}
