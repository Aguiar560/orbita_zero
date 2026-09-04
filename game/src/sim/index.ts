import { Rng, clamp } from '@core/math';
import { bus, toast } from '@app/Bus';
import { afinidadeDoAlvo, resolverDrop } from '@data/balance/drops';
import { CARGA_MAXIMA, CONCESSAO_POR_ID, capacidadeDeItens, capacidadeDeRecursos } from '@data/balance/capacidade';
import { RENDA_POR_ABATE, quantidadeDeMaterialGalactico } from '@data/balance/economia-recursos';
import { RECURSO_POR_ID, recursoDoChefe, recursosDoPlaneta } from '@data/recursos';
import { receitaPara } from '@data/balance/fusao';
import {
  retornoDeDesmanche, valorDeVenda, type RetornoDeDesmanche,
} from '@data/balance/descarte';
import { MISSAO_POR_ID, MISSOES, type FatoDeJogo, type MissaoDef } from '@data/missoes';
import { CONFIANCA_MAX, PERSONAGEM_POR_ID, PERSONAGENS, ROMANOS, contatoDoChefe, type PersonagemDef } from '@data/personagens';
import { PILOTO_POR_ID, pilotoDe } from '@data/pilotos';
import { elementoDaNave, podeEquipar } from './elemento-da-nave';
import { combustivelDe, custoParaEncher, passarTempo, podeDecolar, proximaComCombustivel } from './combustivel';
import { PROVACAO_PISOS, pisoDaProvacao } from '@data/provacao';
import {
  abrirDesafio, encontroDoDesafio, tickDoDesafio, type DesafioAtivo,
} from './desafio';

/** O que as telas de vitória e derrota mostram (§30–§33). */
export interface ResultadoDaProvacao {
  venceu: boolean;
  piso: number;
  chefe: string;
  camadas: CamadaDeRecompensa[];
  tempo: number;
  danoCausado: number;
  danoRecebido: number;
  recorde: boolean;
  recordeAnterior: number;
  ganhos: {
    sucata: number; nucleos: number; itens: number; medalhas: number;
    materiais: Record<string, number>;
  };
  /** Piso liberado por esta vitória. Zero quando não liberou nada novo. */
  proximoPiso: number;
  /** Fração de vida que sobrou ao chefe, na derrota. */
  vidaRestanteDoChefe: number;
  dica?: string;
}
import { chefeDoPiso } from '@data/provacao-chefes';
import {
  FRACAO_REPETICAO, camadasAPagar, estadoDoPiso, gastarTentativa, pisoLiberado,
  registrar as registrarTentativa, segundosParaProximaTentativa, tentativasDisponiveis,
  type CamadaDeRecompensa, type EstadoDoPiso,
} from './provacao';
import {
  controleManualDisponivel,
  limiteTentativasDaProvacao, vipAtivo,
} from './vip';
import {
  aplicarFato, confiancaDe, contatoDesbloqueado, fracaoDe, progressoDe, situacaoDe,
  sinalDoContato, type SinalDeContato, type SituacaoDeMissao,
} from './missoes';
import { aplicarFatoAoEvento, progressoDoEvento, type ProgressoDeEvento } from './eventos';

/**
 * Sufixo do id de essência por elemento.
 *
 * Tabela e não interpolação direta porque "químico" vira `essencia_quimica` e
 * "cósmico" vira `essencia_cosmica` — o gênero muda a palavra, e um
 * `essencia_${elemento}` daria ids que não existem no catálogo.
 */
/**
 * Teto de uma pilha.
 *
 * Único para todos os recursos: o Armazém limita quantos TIPOS se acompanha
 * (§28), não a quantidade de cada um, então este número existe só para o
 * contador não virar notação científica na tela.
 */
/**
 * Quedas no mesmo setor até o jogo OFERECER o recuo.
 *
 * Uma é azar: a rolagem do encontro varia. Três seguidas são falta de poder,
 * e aí vale avisar — mas quem decide é o jogador.
 */
const FALHAS_PARA_OFERECER_RECUO = 3;

const PILHA_MAX = 999_999_999;

import { galaxyOfSector } from '@data/galaxies';
import { CHEST_BY_ID } from '@data/chests';
import { getHull, HULLS, normalizeHullHitbox, type HullHitbox } from '@data/hulls';
import { ALL_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';
import {
  PLAYER_HITBOX_CALIBRATIONS, PLAYER_SCALE_CALIBRATIONS,
  calibratedEnemyHitbox, calibratedEnemyScale,
} from '@data/hitbox-calibrations';
import {
  RESOURCE_IDS,
  type ElementId, type GameState, type Item, type ResourceId, type Resources,
  type NaveProgresso, type NivelProgresso, type SlotId, type Stats,
  type MovimentoPendente,
} from './types';
import {
  SHOP_BY_ID, SHOP_CARGO_IDS, shopCost, shopLimit,
} from '@data/shop';
import { recalibrationCost } from '@data/balance/recalibracao';
import {
  OPERACAO_DE_MODULACAO_POR_ID, custoDeModulacao,
  type CustoDeModulacao, type OperacaoDeModulacaoId,
} from '@data/balance/modulacao';
import { aplicarModulacao, type ResultadoDeModulacao } from './modulacao';
import {
  EFICIENCIA_DA_CENA, NIVEL_MAX, TAXA_DE_ENTRADA,
  curvaXpNave, curvaXpPersonagem, nivelExigido,
} from '@data/balance/curvas';

/**
 * Multiplicador global de XP.
 *
 * Existe porque a renda de XP das primeiras galáxias era baixa demais para o
 * nível acompanhar o setor: com ela em 1,0, o setor 10 dava nível 7 contra o
 * alvo de 10, e o setor 30 dava 21 contra 30.
 *
 * O valor sai de busca numérica CONJUNTA com a curva de XP do personagem. Mexer
 * só num dos dois não fecha: ajustar a renda sozinha estourava o meio da
 * campanha, e ajustar a curva sozinha não movia o começo. Ver o comentário de
 * `PERSONAGEM_XP_BASE` em `data/balance/curvas.ts` — os dois números são um
 * resultado só e não devem ser mexidos em separado.
 *
 * Fica aqui, num ponto único, e não espalhado pelas fontes de XP: assim missão,
 * baú e Provação herdam o ajuste sem saber que ele existe.
 */
export const XP_GANHO_GLOBAL = 24;
import { cobrarMorte } from './morte';
import { activeElement, defenseElement, dps, resistance, resolveStats } from './stats';
import { buildEncounter, encounterLabel, WAVES_PER_SECTOR, type Encounter } from './progression';
import { dropChance, openChest, recalibrateAffix, rollItem, scoreItem } from './loot';
import { createState, saveToStorage } from './state';
import {
  allocate, allocatePath, canAllocate, canDeallocate, deallocate,
  pointsAvailable, pointsSpent, respec, xpForLevel,
} from './tree';
import {
  createLaboratorio, emptyLabMetrics, labScenario, normalizeLabConfig,
  type LaboratorioConfig, type LabScenarioId,
} from './laboratorio';


/** Teto de progresso offline, em segundos (4h). */
const OFFLINE_BASE_CAP = 4 * 3600;
/**
 * A ausência rende o MESMO que jogar. Decidido em 04/09.
 *
 * Era 0,6, com o comentário "o offline rende menos que jogar ativamente — de
 * propósito". A regra passou a ser outra: offline e online não devem diferir
 * em ganho; o que difere é que a ausência não AVANÇA de setor — a nave fica
 * onde o jogador a deixou, e parar num setor que ela não vence tem de custar.
 *
 * Fica como constante, e não some do código, porque o dia em que alguém
 * quiser desestimular a aba fechada este é o lugar — e porque o histórico de
 * ter sido 0,6 explica saves antigos que renderam menos.
 */
const OFFLINE_EFFICIENCY = 1;

export interface OfflineReport {
  seconds: number;
  capped: boolean;
  gained: Record<ResourceId, number>;
  sectorsCleared: number;
  kills: number;
  chests: number;
}

/**
 * Fachada da simulação: dona do `GameState` e única porta de escrita.
 *
 * Os modos de jogo e a UI nunca mutam `state` diretamente — passam por aqui,
 * o que mantém a invalidação de cache de atributos e a emissão de eventos em
 * um lugar só.
 */
/** Os três tipos de encontro que soltam item. Espelha `server/src/lote.ts`. */
export type TipoDeDrop = 'onda' | 'elite' | 'chefe';

export class Sim {
  state: GameState;

  /** Sandbox efêmero: nunca entra no GameState nem no save. */
  readonly laboratorio = createLaboratorio();

  private statsCache: Stats | null = null;
  private encounterCache: Encounter | null = null;
  private readonly rng = new Rng();
  private saveTimer = 0;

  /**
   * Desafio da Provação em andamento, ou `null`.
   *
   * Vive em MEMÓRIA e não no save: uma luta interrompida por fechar a aba não
   * deve poder ser retomada no ponto — a tentativa já foi cobrada na entrada, e
   * guardar o meio da luta abriria a porta para reiniciá-la sem custo.
   */
  desafio: DesafioAtivo | null = null;

  /**
   * O pote de itens que o servidor rolou para este setor.
   *
   * NÃO é salvo, de propósito: o servidor devolve o mesmo lote para o mesmo
   * setor, então guardar seria manter uma segunda cópia que pode divergir.
   * Recarregar a aba busca de novo e recebe idêntico.
   */
  private pote: Record<TipoDeDrop, Item[]> | null = null;

  /**
   * Drops ganhos com o pote vazio ou ausente.
   *
   * Existe para a resposta a "rede fora" não ser "volta a rolar localmente" —
   * que seria o buraco de novo, porque bastaria bloquear a requisição. O
   * jogador não perde o item: ele o recebe quando o lote chega.
   */
  private devendo: TipoDeDrop[] = [];

  /**
   * O resultado da última luta da Provação, para as telas do §30–§33.
   *
   * Em memória e não no save: é uma tela que se lê uma vez e se fecha. Guardá-lo
   * faria o painel de vitória reaparecer no boot seguinte, comemorando algo que
   * o jogador já viu.
   */
  resultadoProvacao: ResultadoDaProvacao | null = null;

  /**
   * Sinais vitais ao vivo da nave, escritos pela camada vertical a cada quadro.
   *
   * Ficam aqui para que a interface leia o estado do combate sem depender do
   * modo — o painel não precisa saber se a cena está ativa ou se o progresso
   * está sendo simulado de forma abstrata.
   */
  readonly vitals = { hp: 0, hpMax: 1, shield: 0, shieldMax: 1, alive: true };

  constructor(state?: GameState) {
    this.state = state ?? createState();
    // A primeira abertura do Laboratório precisa refletir a mesma fonte que os
    // cartões marcam como revisada. Sem esta sincronização, a UI dizia
    // “calibrada” mas começava nos antigos 30×30 até a nave ser reselecionada.
    const lab = this.laboratorio.config;
    const playerBox = this.hitboxDoCasco(lab.playerHullId);
    const enemyBox = this.hitboxSalvaDoInimigo(lab.enemyHitboxKey)
      ?? this.hitboxPadraoDoInimigo(lab.enemyHitboxKey);
    this.laboratorio.config = normalizeLabConfig({
      playerSpriteScale: this.escalaDoCasco(lab.playerHullId),
      playerHitboxWidth: playerBox.width,
      playerHitboxHeight: playerBox.height,
      playerHitboxOffsetX: playerBox.offsetX,
      playerHitboxOffsetY: playerBox.offsetY,
      enemySpriteScale: this.escalaDoInimigo(lab.enemyHitboxKey) ?? lab.enemySpriteScale,
      enemyHitboxWidth: enemyBox.width,
      enemyHitboxHeight: enemyBox.height,
      enemyHitboxOffsetX: enemyBox.offsetX,
      enemyHitboxOffsetY: enemyBox.offsetY,
    }, lab);
    this.refreshEncounter();
  }

  // ── leitura ───────────────────────────────────────────────────────────────

  get stats(): Stats {
    return (this.statsCache ??= resolveStats(this.state));
  }

  get encounter(): Encounter {
    // Com desafio ativo, o encontro é o DELE. É assim que `VerticalMode`
    // continua lendo o mesmo lugar de sempre e não precisa saber que a Provação
    // existe — a substituição acontece aqui, num ponto só.
    if (this.desafio) return (this.encounterCache ??= encontroDoDesafio(this.state, this.desafio));
    return (this.encounterCache ??= buildEncounter(this.state, this.state.run.sector, this.state.run.wave));
  }

  /** Elemento dos tiros do jogador — arma principal, ou o casco na falta dela. */
  get element(): ElementId {
    return activeElement(this.state);
  }

  /** Elemento da defesa — escudo equipado, ou neutro. */
  get defenseElement(): ElementId {
    return defenseElement(this.state);
  }

  /** Resistência efetiva contra um elemento, com o teto já aplicado. */
  resistance(element: ElementId): number {
    return resistance(this.stats, element);
  }

  /**
   * Elemento que MAIS aparece no encontro atual, ponderado por quantidade.
   *
   * É a informação que decide qual escudo vestir. Sai da composição real da
   * onda, e não de uma tabela por galáxia, porque uma onda de elite pode trazer
   * um elemento que não é o da frota dominante — e nesse caso o aviso tem que
   * mudar junto.
   */
  get threatElement(): ElementId {
    const enc = this.encounter;
    if (enc.boss) return enc.boss.element;

    const peso = new Map<ElementId, number>();
    for (const { def, count } of enc.squad) {
      peso.set(def.element, (peso.get(def.element) ?? 0) + count);
    }
    let melhor: ElementId = 'padrao';
    let max = 0;
    for (const [el, n] of peso) {
      if (n > max) { max = n; melhor = el; }
    }
    return melhor;
  }

  get encounterLabel(): string {
    return encounterLabel(this.encounter);
  }

  /**
   * Dano por segundo que os inimigos aplicam, em média.
   *
   * Modelado como `dano por golpe × golpes acertados por segundo`, e não como
   * uma curva independente: `encounter.damage` é exatamente o valor que os
   * projéteis usam na camada ao vivo, então o caminho abstrato e o combate real
   * derivam da mesma fonte. A taxa de acerto cai com a sincronia do piloto —
   * é assim que investir em pilotagem aparece no progresso offline.
   */
  get incomingDps(): number {
    // A curva acompanha o piloto ao vivo: com sincronia quase zero ele leva
    // quase todo tiro; treinado, esquiva da maior parte.
    const hitsPerSecond = 1.5 * (1 - this.stats.iaSkill * 0.82);
    return this.encounter.damage * Math.max(0.06, hitsPerSecond);
  }

  /** Segundos que a nave aguenta no encontro atual antes de cair. */
  get survivalWindow(): number {
    const s = this.stats;
    // A regeneração de escudo é abatida do dano recebido antes da divisão:
    // num confronto longo ela é o que separa sobreviver de derreter.
    const net = Math.max(0.5, this.incomingDps - s.regen);
    return (s.vida + s.escudo) / net;
  }

  /** Segundos estimados para limpar o encontro atual. */
  get clearTime(): number {
    return this.encounter.hpPool / Math.max(0.001, dps(this.stats));
  }

  /** O jogador está travado neste setor? Alimenta o aviso da HUD. */
  get isStalled(): boolean {
    return this.clearTime > this.survivalWindow;
  }

  get offlineCap(): number {
    return OFFLINE_BASE_CAP;
  }

  // ── invalidação ───────────────────────────────────────────────────────────

  /** Chame após qualquer mudança que afete atributos. */
  touch(): void {
    this.statsCache = null;
    bus.emit('state:changed');
  }

  /** Público para o modo de teste e para os testes automatizados. */
  refreshEncounter(): void {
    this.encounterCache = null;
    const e = this.encounter;
    this.state.run.kind = e.kind;
    this.state.run.unidades = e.unidades;
    this.state.run.restam = e.unidades;
    this.state.run.elapsed = 0;
  }

  // ── modo de teste ─────────────────────────────────────────────────────────

  get testMode(): boolean {
    return this.state.settings.testMode;
  }

  get vipAtivo(): boolean {
    return vipAtivo(this.state);
  }

  get vipDiasRestantes(): number {
    if (!this.vipAtivo) return 0;
    return Math.max(1, Math.ceil((this.state.vip.expiresAt - Date.now()) / 86_400_000));
  }

  get controleManualDisponivel(): boolean {
    return controleManualDisponivel(this.state);
  }

  /** Quantos passos fixos o laço deve rodar por quadro. */
  get timeScale(): number {
    if (this.laboratorio.active) return this.laboratorio.paused ? (this.laboratorio.step > 0 ? 1 : 0) : this.laboratorio.config.speed;
    return this.testMode ? Math.max(1, Math.min(8, Math.round(this.state.settings.speed))) : 1;
  }

  atualizarLaboratorio(patch: Partial<LaboratorioConfig>): void {
    this.laboratorio.config = normalizeLabConfig(patch, this.laboratorio.config);
    bus.emit('laboratorio:changed');
  }

  /** Hitbox efetiva: calibração administrativa vence a ficha padrão do casco. */
  hitboxDoCasco(id: string): HullHitbox {
    const hull = getHull(id);
    return normalizeHullHitbox(PLAYER_HITBOX_CALIBRATIONS[id] ?? hull.hitbox);
  }

  hitboxSalvaDoInimigo(key: string): HullHitbox | undefined {
    const saved = calibratedEnemyHitbox(key);
    return saved ? normalizeHullHitbox(saved) : undefined;
  }

  escalaDoCasco(id: string): number {
    const hull = getHull(id);
    return PLAYER_SCALE_CALIBRATIONS[id] ?? (hull.damageStates ? 1.5 : (hull.scale ?? .62));
  }

  escalaDoInimigo(key: string): number | undefined {
    return calibratedEnemyScale(key);
  }

  cascoTemHitboxCalibrada(id: string): boolean {
    return PLAYER_HITBOX_CALIBRATIONS[id] !== undefined;
  }

  inimigoTemHitboxCalibrada(key: string): boolean {
    return calibratedEnemyHitbox(key) !== undefined;
  }

  hitboxPadraoDoInimigo(key: string): HullHitbox {
    const [kind, id] = key.split(':');
    const target = kind === 'boss'
      ? BOSSES.find((entry) => entry.id === id)
      : ALL_ENEMIES.find((entry) => entry.id === id);
    const scale = this.escalaDoInimigo(key) ?? target?.scale ?? 1;
    const diameter = target ? target.radius * scale * 2 : 30;
    return normalizeHullHitbox({ width: diameter, height: diameter, offsetX: 0, offsetY: 0 });
  }

  /** Ajuste rápido sempre lê o valor atual e liga a visualização. */
  ajustarHitboxLaboratorio(
    target: 'player' | 'enemy',
    axis: 'width' | 'height' | 'offsetX' | 'offsetY',
    delta: number,
  ): void {
    const fields = target === 'player'
      ? {
          width: 'playerHitboxWidth', height: 'playerHitboxHeight',
          offsetX: 'playerHitboxOffsetX', offsetY: 'playerHitboxOffsetY',
        } as const
      : {
          width: 'enemyHitboxWidth', height: 'enemyHitboxHeight',
          offsetX: 'enemyHitboxOffsetX', offsetY: 'enemyHitboxOffsetY',
        } as const;
    const field = fields[axis];
    this.atualizarLaboratorio({
      [field]: this.laboratorio.config[field] + delta,
      hitboxTarget: target,
      showHitboxes: true,
    });
  }

  /**
   * Carrega arte, atributos, tiro e hitbox de um casco real no sandbox.
   * O cenário padronizado permite comparar cascos sem equipamento ou progressão.
   */
  carregarCascoNoLaboratorio(id: string, confrontoPadronizado = false): boolean {
    const hull = HULLS.find((entry) => entry.id === id);
    if (!hull) return false;
    const clean = createState(1);
    clean.hull = hull.id;
    clean.fleet = [hull.id];
    const stats = resolveStats(clean);
    const box = this.hitboxDoCasco(id);
    this.atualizarLaboratorio({
      playerHullId: hull.id,
      playerShotHullId: hull.id,
      playerSprite: hull.sprite,
      playerSpriteScale: this.escalaDoCasco(id),
      playerHitboxWidth: box.width,
      playerHitboxHeight: box.height,
      playerHitboxOffsetX: box.offsetX,
      playerHitboxOffsetY: box.offsetY,
      playerElement: hull.element,
      defenseElement: hull.element,
      playerDamage: stats.dano,
      playerFireRate: stats.cadencia,
      playerShots: stats.projeteis,
      playerBulletSpeed: hull.shot.speed,
      playerSpread: hull.shot.spread,
      playerPierce: stats.perfuracao,
      playerSplash: stats.explosao,
      playerCritChance: stats.critChance,
      playerCritDamage: stats.critDano,
      playerHp: stats.vida,
      playerShield: stats.escudo,
      playerRegen: stats.regen,
      playerSpeed: stats.velocidade,
      playerAiSkill: stats.iaSkill,
      showHitboxes: true,
      ...(confrontoPadronizado ? {
        control: 'evasivo' as const,
        autoFire: true,
        immortal: false,
        autoRespawn: true,
        enemyId: 'lanceiro',
        enemyShotEnemyId: 'lanceiro',
        enemySprite: 'enemy/wraith_a',
        enemySpriteScale: this.escalaDoInimigo('enemy:lanceiro') ?? 0.55,
        enemyHitboxKey: 'enemy:lanceiro',
        enemyHitboxWidth: this.hitboxSalvaDoInimigo('enemy:lanceiro')?.width ?? 20.9,
        enemyHitboxHeight: this.hitboxSalvaDoInimigo('enemy:lanceiro')?.height ?? 20.9,
        enemyHitboxOffsetX: this.hitboxSalvaDoInimigo('enemy:lanceiro')?.offsetX ?? 0,
        enemyHitboxOffsetY: this.hitboxSalvaDoInimigo('enemy:lanceiro')?.offsetY ?? 0,
        enemyCount: 3,
        enemyMove: 'pairar' as const,
        enemyAttack: 'mirado' as const,
        enemyElement: 'padrao' as const,
        enemyElementalFraction: 0,
        enemyHp: 600,
        enemyDamage: 30,
        enemySpeed: 90,
        enemyFireRate: 1,
        enemyShots: 1,
        enemyBulletSpeed: 280,
        speed: 8,
      } : {}),
    });
    return true;
  }

  /** Aplica um protocolo reproduzível sem copiar fichas de inimigo na UI. */
  carregarCenarioLaboratorio(id: LabScenarioId): boolean {
    const scenario = labScenario(id);
    const enemy = ALL_ENEMIES.find((entry) => entry.id === scenario.enemyId);
    if (!enemy) return false;
    const key = `enemy:${enemy.id}`;
    const box = this.hitboxSalvaDoInimigo(key) ?? this.hitboxPadraoDoInimigo(key);
    this.atualizarLaboratorio({
      scenario: id,
      enemyId: enemy.id,
      enemyShotEnemyId: enemy.id,
      enemySprite: enemy.sprite,
      enemySpriteScale: this.escalaDoInimigo(key) ?? enemy.scale,
      enemyHitboxKey: key,
      enemyHitboxWidth: box.width,
      enemyHitboxHeight: box.height,
      enemyHitboxOffsetX: box.offsetX,
      enemyHitboxOffsetY: box.offsetY,
      // A ficha do Laboratório roda sob a postura mais neutra que sobrou: ela
      // existe para COMPARAR cascos, e a postura tem de ser a mesma para todos.
      control: 'evasivo', autoFire: true, immortal: false, speed: 8,
      ...scenario.config,
    });
    return true;
  }

  iniciarLaboratorio(): void {
    this.laboratorio.active = true;
    this.laboratorio.paused = false;
    this.reiniciarLaboratorio();
  }

  reiniciarLaboratorio(): void {
    this.laboratorio.metrics = emptyLabMetrics();
    // Pausado, libera exatamente um passo para a cena reconstruir já; sem isso
    // o botão pareceria não fazer nada até o usuário apertar Continuar.
    this.laboratorio.step = this.laboratorio.paused ? 1 : 0;
    this.laboratorio.revision++;
    bus.emit('laboratorio:changed');
  }

  pararLaboratorio(): void {
    this.laboratorio.active = false;
    this.laboratorio.paused = false;
    this.laboratorio.step = 0;
    this.laboratorio.revision++;
    bus.emit('laboratorio:changed');
  }

  alternarPausaLaboratorio(): void {
    if (!this.laboratorio.active) return;
    this.laboratorio.paused = !this.laboratorio.paused;
    bus.emit('laboratorio:changed');
  }

  avancarLaboratorio(): void {
    if (!this.laboratorio.active) return;
    this.laboratorio.paused = true;
    this.laboratorio.step++;
    bus.emit('laboratorio:changed');
  }

  consumirPassoLaboratorio(): boolean {
    if (this.laboratorio.step <= 0) return false;
    this.laboratorio.step--;
    return true;
  }

  /** Salta direto para um setor. Só existe para o modo de teste. */
  /**
   * Recua um setor, por pedido do jogador.
   *
   * Existe separado de `jumpSector` para o pedido ficar legível na origem, e
   * porque o acesso NÃO volta: `bestSector` continua onde estava, então a fase
   * de origem segue aberta no mapa. Recuar move o ponteiro, não desfaz
   * conquista.
   */
  recuarUmSetor(): boolean {
    if (this.state.run.sector <= 1) return false;
    // `jumpSector` zera as quedas.
    this.jumpSector(this.state.run.sector - 1);
    return true;
  }

  jumpSector(sector: number): void {
    this.state.run.sector = Math.max(1, Math.floor(sector));
    this.state.run.wave = 1;
    // As quedas são DESTE setor, então trocar de setor zera a conta.
    //
    // Sem esta linha o contador atravessava a mudança, e a primeira morte no
    // lugar novo já disparava o aviso de parede — que diz "três quedas
    // seguidas aqui" sobre um lugar onde o jogador caiu uma vez. O teste pegou.
    this.state.run.falhasNoSetor = 0;
    this.state.universe.bestSector = Math.max(this.state.universe.bestSector, this.state.run.sector);
    this.state.universe.bestSectorEver = Math.max(this.state.universe.bestSectorEver, this.state.universe.bestSector);
    this.refreshEncounter();
    this.touch();
  }

  setTestMode(on: boolean): void {
    this.state.settings.testMode = on;
    // Nada de escrever no save aqui. O hangar, os setores, a loja e a
    // capacidade são liberados por LEITURA (ver `alcanceLiberado` e vizinhos),
    // e é isso que faz desligar o modo devolver o save intacto. A versão
    // anterior empurrava os cascos em `state.fleet` e não os tirava.
    if (!on) this.state.settings.speed = 1;
    this.touch();
  }

  // ── recursos ──────────────────────────────────────────────────────────────

  /**
   * Deposita no banco.
   *
   * O número sobe na tela na hora E entra na fila de saída. São as duas
   * metades do mesmo depósito: a tela não pode esperar a rede, e o servidor
   * é quem soma de verdade. Quando ele confirma, o saldo dele substitui este
   * — já incluindo o que a fila levou, então não há dobra.
   */
  grant(resource: ResourceId, amount: number, motivo: MovimentoPendente['motivo'] = 'drop'): void {
    if (!(amount > 0)) return;
    this.state.resources[resource] += amount;
    this.state.pendentes.push({ moeda: resource, quantia: Math.trunc(amount), motivo });
    this.state.lifetime[resource] += amount;
    this.registrar({ tipo: 'moeda', moeda: resource, quantidade: amount });
    bus.emit('resources:changed');
  }

  /**
   * Ganho de COMBATE: entra na carga da incursão, não no banco.
   *
   * Só é depositado quando o setor inteiro cai; morrer no meio perde tudo.
   * A separação existe para a morte ter peso sem confiscar o que o jogador já
   * havia guardado — o risco é o da incursão em curso, e ele cresce conforme
   * ela avança, o que é exatamente a tensão que se quer.
   */
  grantCarga(resource: ResourceId, amount: number): void {
    if (!(amount > 0)) return;
    this.state.run.carga[resource] += amount;
    bus.emit('resources:changed');
  }

  /** Deposita a carga no banco. Chamado só ao concluir o setor. */
  private bankCarga(): void {
    const carga = this.state.run.carga;
    for (const id of RESOURCE_IDS) {
      if (carga[id] > 0) this.grant(id, carga[id]);
      carga[id] = 0;
    }
  }

  /** Descarta a carga. Chamado na morte. */
  private dropCarga(): Resources {
    const perdido = { ...this.state.run.carga };
    for (const id of RESOURCE_IDS) this.state.run.carga[id] = 0;
    return perdido;
  }

  // ── o que o modo de teste libera ──────────────────────────────────────────
  //
  // Todos estes acessores são de LEITURA e não gravam nada. É a regra que faz o
  // modo de teste ser reversível: desligá-lo tem de devolver o save exatamente
  // como estava. A versão anterior empurrava os cascos em `state.fleet` ao
  // ligar e nunca os tirava — quem ligasse para "só dar uma olhada" ficava com
  // o hangar inteiro no save de verdade, sem volta.
  //
  // Por isso as travas passaram a CONSULTAR estes acessores em vez de ler o
  // progresso cru: liberar é uma resposta diferente à mesma pergunta, não uma
  // escrita no estado.

  /**
   * Até que setor o jogador pode ir — a régua de TODA trava de conteúdo.
   *
   * Loja, cascos, códex e o mapa de galáxias liam `universe.bestSectorEver`
   * cada um por conta própria. Agora leem isto, o que também significa que a
   * próxima trava a nascer herda o modo de teste de graça.
   */
  get alcanceLiberado(): number {
    return this.testMode ? NIVEL_MAX : this.state.universe.bestSectorEver;
  }

  /** Nível de comando para efeito de requisito. */
  get nivelLiberado(): number {
    return this.testMode ? NIVEL_MAX : this.state.command.nivel;
  }

  /**
   * Cascos disponíveis para uso.
   *
   * No modo de teste, todos — sem escrever em `state.fleet`, que é o que torna
   * o modo reversível.
   */
  get frotaDisponivel(): readonly string[] {
    return this.testMode ? HULLS.map((h) => h.id) : this.state.fleet;
  }

  // ── missões (§27) ─────────────────────────────────────────────────────────

  /**
   * O funil ÚNICO por onde o jogo reporta o que aconteceu.
   *
   * Missão não observa o jogo em vários lugares: o jogo reporta aqui e cada
   * missão declara, como dado, qual fato conta. A alternativa — cada categoria
   * pendurada onde seu evento acontece — funciona para as quatro de hoje e cobra
   * caro na quinta: cada ponto do `sim` passaria a saber que missões existem.
   * Assim, missão nova é linha de tabela.
   *
   * Barato o bastante para chamar em todo abate: quando nenhuma missão ativa se
   * importa, o objeto é descartado no mesmo quadro.
   */
  registrar(fato: FatoDeJogo): void {
    const prontas = aplicarFato(this.state, fato, this.alcanceLiberado);
    const evento = aplicarFatoAoEvento(this.state, this.alcanceLiberado, fato);
    for (const m of prontas) toast(`Missão concluída: ${m.nome}`, 'epic');
    if (evento.completou) toast('Objetivo do evento concluído — recompensa disponível', 'epic', 'recurso/gas_exotico');
    if (prontas.length || evento.mudou) this.touch();
  }

  /** Evento rotativo atual e progresso desta ocorrência. */
  get eventoAtivo(): ProgressoDeEvento {
    return progressoDoEvento(this.state, this.alcanceLiberado);
  }

  resgatarEvento(): boolean {
    const atual = this.eventoAtivo;
    if (!atual.liberado || atual.resgatado || atual.progresso < atual.alvo) return false;
    const { def, chave } = atual.janela;
    if ((this.state.armazem[def.gas] ?? 0) <= 0 && this.materiaisGuardados >= this.resourceSlots) return false;
    const guardado = this.guardarMaterial(def.gas, def.quantidade);
    if (guardado < def.quantidade) return false;
    this.state.eventos[chave] = { progresso: atual.alvo, resgatado: true };
    toast(`${def.nome}: +${def.quantidade} ${RECURSO_POR_ID.get(def.gas)?.nome ?? def.gas}`, 'epic', `recurso/${def.gas}`);
    this.touch();
    return true;
  }

  /**
   * Resgata a recompensa de uma missão pronta.
   *
   * Devolve `false` sem cobrar nada quando falta o que a entrega consome — a
   * checagem vem ANTES de qualquer pagamento, senão uma entrega parcial deixaria
   * o jogador sem o material e sem a recompensa.
   */
  resgatarMissao(id: string): boolean {
    const def = MISSAO_POR_ID.get(id);
    if (!def) return false;
    if (situacaoDe(this.state, def, this.alcanceLiberado) !== 'pronta') return false;

    if (def.consomeNaEntrega) {
      for (const [rec, n] of Object.entries(def.consomeNaEntrega)) {
        if (this.materialDisponivel(rec) < n) return false;
      }
      for (const [rec, n] of Object.entries(def.consomeNaEntrega)) this.gastarMaterial(rec, n);
    }

    // A missão é entregue antes de emitir os fatos das recompensas. Isso faz a
    // próxima etapa da cadeia já estar ativa quando recebe o material que a
    // etapa anterior produz — sem retroatividade global e sem perder o fato.
    progressoDe(this.state, def).entregue = true;
    // Entregue não ocupa mais uma das quatro vagas do HUD. Além de manter o
    // estado atual correto, a leitura centralizada em `missoesRastreadas`
    // também repara saves antigos que ainda tragam ids concluídos.
    this.state.settings.pinnedMissions = this.state.settings.pinnedMissions.filter((id) => id !== def.id);

    const r = def.recompensa;
    for (const [moeda, n] of Object.entries(r.moedas ?? {})) this.grant(moeda as ResourceId, n);
    for (const [rec, n] of Object.entries(r.materiais ?? {})) this.guardarMaterial(rec, n);
    if (r.xp) this.grantXp(r.xp);
    if (r.medalhas) this.state.medalhas += r.medalhas;
    for (const [tier, n] of Object.entries(r.baus ?? {})) this.grantChest(tier, n, def.nome);
    if (r.itens) {
      for (let i = 0; i < r.itens.quantidade; i++) {
        this.acquire(rollItem(
          this.rng,
          this.encounter.ilvl + (r.itens.ilvlBonus ?? 0),
          this.stats.sorte,
          this.state.universe.index,
          r.itens.raridadeMin !== undefined ? { floor: r.itens.raridadeMin } : {},
        ));
      }
    }
    // Concessão é idempotente por id: repetir a missão não amplia de novo.
    if (r.concessao) this.concederCarga(r.concessao);

    // A confiança sobe DEPOIS do pagamento e antes do `touch`: subi-la primeiro
    // deixaria o estado inconsistente se a entrega fosse recusada acima.
    if (def.confianca && def.giverId) {
      const atual = this.state.confianca[def.giverId] ?? 0;
      const novo = Math.min(CONFIANCA_MAX, atual + def.confianca);
      this.state.confianca[def.giverId] = novo;
      if (novo > atual) {
        const p = PERSONAGEM_POR_ID.get(def.giverId);
        toast(`Confiança ${ROMANOS[novo - 1] ?? novo} com ${p?.nome ?? def.giverId}`, 'epic');
      }
    }

    toast(`${def.nome} — recompensa recebida`, 'epic');
    this.touch();
    return true;
  }

  /**
   * Entrega todas as prontas de uma vez (§20).
   *
   * Pula o contrato ESPECIAL: ele tem recompensa exclusiva e assinatura de um
   * personagem, e varrê-lo junto com as rotineiras faria o jogador perder a
   * única parte da missão que existe para ser vista. O §20 pede exatamente essa
   * exceção — entrega automática não vale para o que tem peso narrativo.
   *
   * Devolve quantas entregou.
   */
  entregarTudo(): number {
    let n = 0;
    for (const { def, situacao } of this.missoes) {
      if (situacao !== 'pronta') continue;
      if (def.tipo === 'especial') continue;
      if (this.resgatarMissao(def.id)) n++;
    }
    return n;
  }

  /** Quantas o "entregar tudo" pegaria agora. Desabilita o botão quando zero. */
  get entregaveisEmLote(): number {
    return this.missoes.filter((m) => m.situacao === 'pronta' && m.def.tipo !== 'especial').length;
  }

  /** Contatos da rede, com o estado que a tela precisa (§7, §8). */
  get contatos(): {
    def: PersonagemDef; desbloqueado: boolean; sinal: SinalDeContato;
    confianca: number; missoes: number;
  }[] {
    const alcance = this.alcanceLiberado;
    return PERSONAGENS.map((def) => ({
      def,
      desbloqueado: contatoDesbloqueado(this.state, def),
      sinal: sinalDoContato(this.state, def, alcance),
      confianca: confiancaDe(this.state, def.id),
      missoes: MISSOES.filter((m) => m.giverId === def.id).length,
    }))
      // Bloqueado desce, mas NÃO some: a silhueta é metade da razão de a tela
      // existir — ver que há alguém a descobrir ali (§8).
      .sort((a, b) => Number(b.desbloqueado) - Number(a.desbloqueado));
  }

  /** Missões visíveis, na ordem em que a tela deve mostrá-las. */
  get missoes(): { def: MissaoDef; situacao: SituacaoDeMissao; fracao: number }[] {
    const alcance = this.alcanceLiberado;
    return MISSOES
      .map((def) => ({
        def,
        situacao: situacaoDe(this.state, def, alcance),
        fracao: fracaoDe(this.state, def),
      }))
      // Prontas primeiro — é a única linha em que o jogador tem o que fazer.
      .filter((m) => m.situacao !== 'oculta')
      .sort((a, b) => ordemDaSituacao(a.situacao) - ordemDaSituacao(b.situacao) || b.fracao - a.fracao);
  }

  /** Quantas missões esperam resgate. Alimenta o selo da aba. */
  get missoesProntas(): number {
    return this.missoes.filter((m) => m.situacao === 'pronta').length;
  }


  // ── Núcleo de Provação (§32–35) ───────────────────────────────────────────

  /** Tentativas em estoque agora, e quanto falta para a próxima. */
  get provacaoTentativas(): { tem: number; max: number; segundosParaProxima: number } {
    return {
      tem: tentativasDisponiveis(this.state),
      max: limiteTentativasDaProvacao(this.state),
      segundosParaProxima: segundosParaProximaTentativa(this.state),
    };
  }

  /** Estado de um piso, para a tela desenhar. */
  estadoDoPisoDaProvacao(piso: number): EstadoDoPiso {
    return estadoDoPiso(this.state, piso);
  }

  /**
   * Começa uma tentativa. Devolve `false` quando o piso está travado ou não há
   * tentativa em estoque.
   *
   * Cobra a tentativa AQUI, na entrada, e não na derrota: cobrar ao perder faria
   * do fechamento da aba uma forma de jogar de graça, e premiaria justamente o
   * jogador que desiste no meio.
   */
  iniciarPisoDaProvacao(piso: number): boolean {
    if (!pisoLiberado(this.state, piso)) return false;
    if (!gastarTentativa(this.state)) return false;

    this.desafio = abrirDesafio(piso);
    // `refreshEncounter` e não só `encounterCache = null`.
    //
    // Limpar o cache faz o encontro ser RECALCULADO na próxima leitura, mas
    // não escreve `run.restam` — e é `restam` que decide quando o encontro
    // acabou. Sem esta linha o piso herdava o contador da onda anterior:
    // medido, `unidades: 1` do chefe contra `restam: 50` da onda comum, e o
    // jogador tinha de derrubar o chefe cinquenta vezes.
    this.refreshEncounter();
    bus.emit('provacao:iniciado', { piso });
    this.touch();
    return true;
  }

  /**
   * Conclui um piso e paga o que ele deve.
   *
   * O §74 chama de TESTE CRÍTICO que recarregar, morrer ou fechar o modal não
   * pague a primeira conclusão outra vez. A garantia é a ordem: a marcação é
   * gravada ANTES de qualquer entrega, e a pergunta "já paguei?" é feita contra
   * o save, nunca contra algo em memória.
   *
   * Devolve as camadas pagas, para a tela do §31 saber o que celebrar.
   */
  concluirPisoDaProvacao(
    piso: number,
    r: { tempo: number; danoCausado: number; danoRecebido: number },
  ): CamadaDeRecompensa[] {
    const def = pisoDaProvacao(piso);
    const p = this.state.provacao;
    const camadas = camadasAPagar(this.state, piso);
    // O recorde anterior é lido ANTES de registrar, senão a comparação seria
    // sempre contra o próprio tempo desta corrida.
    const recordeAntes = p.registros[piso]?.melhorTempo ?? Infinity;
    // O maior piso ANTES desta vitória: sem isso, repetir um piso anunciaria
    // "liberado o seguinte" toda vez, porque `pisoMax` já teria sido atualizado
    // quando a tela fosse montada.
    const pisoMaxAntes = p.pisoMax;
    const nucleosAntes = this.state.resources.nucleo;
    const sucataAntes = this.state.resources.sucata;
    const itensAntes = this.state.stats.itemsFound;

    // MARCA PRIMEIRO. Se algo estourar na entrega, o jogador perde a recompensa
    // — e não ganha o direito de recebê-la duas vezes.
    if (camadas.includes('primeira')) p.primeiraConclusao.push(piso);
    if (camadas.includes('marco')) p.marcos.push(piso);

    p.vitorias++;
    p.pisoMax = Math.max(p.pisoMax, piso);
    registrarTentativa(this.state, piso, {
      venceu: true, tempo: r.tempo,
      nave: this.state.hull, nivelDaNave: this.naveAtiva.nivel,
      danoCausado: r.danoCausado, danoRecebido: r.danoRecebido,
    });

    // A repetição paga uma fração; a primeira e o marco pagam inteiro.
    const fator = camadas.includes('primeira') ? 1 : FRACAO_REPETICAO;
    const rec = def.recompensa;
    this.grant('sucata', Math.round(rec.sucata * fator));
    this.grant('nucleo', Math.round(rec.nucleos * fator));
    if (rec.cristais) this.grant('cristal', Math.round(rec.cristais * fator));
    for (const [id, n] of Object.entries(rec.materiais)) {
      this.guardarMaterial(id, Math.max(1, Math.round(n * fator)));
    }

    // Item e medalha SÓ na primeira conclusão e no marco: repetir um piso não
    // pode ser a melhor fonte de equipamento do jogo (§22, §67).
    if (camadas.includes('primeira') || camadas.includes('marco')) {
      if (rec.medalhas) this.state.medalhas += rec.medalhas;
      for (let i = 0; i < rec.itens.quantidade; i++) {
        this.acquire(rollItem(
          this.rng, this.encounter.ilvl, this.stats.sorte,
          this.state.universe.index, { floor: rec.itens.raridadeMin },
        ));
      }
    }

    const chefe = chefeDoPiso(piso);
    this.resultadoProvacao = {
      venceu: true,
      piso,
      chefe: chefe.nome,
      camadas,
      tempo: r.tempo,
      danoCausado: r.danoCausado,
      danoRecebido: r.danoRecebido,
      // Recorde é NOVO só quando havia um anterior para bater. A primeira
      // vitória já é comemorada por si; anunciá-la também como recorde diluiria
      // as duas coisas.
      recorde: Number.isFinite(recordeAntes) && r.tempo < recordeAntes,
      recordeAnterior: Number.isFinite(recordeAntes) ? recordeAntes : 0,
      ganhos: {
        sucata: this.state.resources.sucata - sucataAntes,
        nucleos: this.state.resources.nucleo - nucleosAntes,
        itens: this.state.stats.itemsFound - itensAntes,
        medalhas: camadas.includes('primeira') || camadas.includes('marco') ? (def.recompensa.medalhas ?? 0) : 0,
        materiais: def.recompensa.materiais,
      },
      // Só anuncia liberação quando o piso era NOVO. Repetir não libera nada.
      proximoPiso: piso > pisoMaxAntes ? Math.min(PROVACAO_PISOS, piso + 1) : 0,
      vidaRestanteDoChefe: 0,
    };

    this.desafio = null;
    // Mesmo motivo da entrada, e o defeito aqui era espelhado: voltar ao
    // jogo normal com `restam` do chefe (1) fecharia a onda seguinte no
    // primeiro abate.
    this.refreshEncounter();

    bus.emit('provacao:vencido', { piso, chefeId: chefe.id, camadas });
    if (camadas.includes('marco')) bus.emit('provacao:marco', { piso });

    // O funil de fatos leva isso às missões sem que elas precisem de gancho
    // próprio (§60).
    this.registrar({ tipo: 'chefe', chefeId: chefe.id, setor: piso });

    this.touch();
    return camadas;
  }

  /** Registra uma derrota — alimenta o painel do §30 e a telemetria do §77. */
  falharPisoDaProvacao(
    piso: number,
    r: { tempo: number; danoCausado: number; danoRecebido: number },
    vidaRestante = 0,
  ): void {
    const chefe = chefeDoPiso(piso);
    this.resultadoProvacao = {
      venceu: false,
      piso,
      chefe: chefe.nome,
      camadas: [],
      tempo: r.tempo,
      danoCausado: r.danoCausado,
      danoRecebido: r.danoRecebido,
      recorde: false,
      recordeAnterior: 0,
      ganhos: { sucata: 0, nucleos: 0, itens: 0, medalhas: 0, materiais: {} },
      proximoPiso: 0,
      vidaRestanteDoChefe: vidaRestante,
      // A dica sai da RESISTÊNCIA real do chefe contra o elemento em uso. O §30
      // pede que não seja explícita demais: ela aponta o problema, não a
      // solução.
      dica: this.dicaDaDerrota(piso),
    };

    registrarTentativa(this.state, piso, {
      venceu: false, tempo: r.tempo,
      nave: this.state.hull, nivelDaNave: this.naveAtiva.nivel,
      danoCausado: r.danoCausado, danoRecebido: r.danoRecebido,
    });
    this.desafio = null;
    this.refreshEncounter();
    bus.emit('provacao:falhou', { piso });
    this.touch();
  }

  /**
   * A recomendação da derrota (§30).
   *
   * Aponta o PROBLEMA, não a solução: "o chefe resiste ao seu elemento" ensina
   * a olhar a ficha; "use gelo" resolveria por ele e mataria a experimentação
   * que o §16 quer provocar. Devolve string vazia quando não há nada honesto a
   * dizer — dica genérica é pior que silêncio.
   */
  private dicaDaDerrota(piso: number): string {
    const chefe = chefeDoPiso(piso);
    const meu = this.element;
    const res = (chefe.resistencias as Record<string, number>)[meu] ?? 0;
    if (res >= 0.35) return `${chefe.nome} resiste fortemente ao seu elemento.`;

    const def = pisoDaProvacao(piso);
    if (def.modificadores.includes('regenerador') || def.modificadores.includes('furia')) {
      return 'Ele recupera vida — dano constante vale mais que rajada.';
    }
    if (def.modificadores.includes('refletor')) return 'Parte do seu dano está voltando.';
    if (def.modificadores.includes('sufocante')) return 'Seu escudo não regenera nesta câmara.';
    return '';
  }

  /**
   * Avança o relógio do desafio. Chamado pela cena a cada quadro.
   *
   * Devolve o que o combate deve fazer: nada, começar a telegrafia, disparar o
   * especial, ou encerrar por tempo.
   */
  tickDesafio(dt: number): 'nada' | 'aviso' | 'dispara' | 'tempo' {
    if (!this.desafio) return 'nada';
    return tickDoDesafio(this.desafio, dt);
  }

  /** Os pisos que a tela mostra, do 1 ao maior liberado mais alguns à frente. */
  get pisosDaProvacao(): { piso: number; estado: EstadoDoPiso }[] {
    const ate = Math.min(PROVACAO_PISOS, this.state.provacao.pisoMax + 6);
    return Array.from({ length: ate }, (_, i) => ({
      piso: i + 1,
      estado: estadoDoPiso(this.state, i + 1),
    }));
  }

  /** No modo de teste tudo é pagável, sem alterar o saldo mostrado. */
  can(resource: ResourceId, amount: number): boolean {
    return this.testMode || this.state.resources[resource] >= amount;
  }

  /**
   * Gasta do banco.
   *
   * O gasto entra na MESMA fila do ganho, com quantia negativa. É o que
   * mantém o livro-caixa completo: um saldo que só registra entradas não
   * reconstrói nada, e a auditoria do pódio precisa das duas metades.
   *
   * A recusa aqui é otimista — usa o espelho local. O servidor recusa de
   * novo, e de verdade, se o saldo não cobrir; nesse caso a sincronização
   * seguinte traz o saldo dele por cima e o gasto local desaparece.
   */
  spend(resource: ResourceId, amount: number, motivo: MovimentoPendente['motivo'] = 'loja'): boolean {
    if (this.testMode) return true;
    if (!this.can(resource, amount)) return false;
    this.state.resources[resource] -= amount;
    this.state.pendentes.push({ moeda: resource, quantia: -Math.trunc(amount), motivo });
    bus.emit('resources:changed');
    return true;
  }

  // ── camada vertical (combate) ─────────────────────────────────────────────

  /**
   * Credita um abate ao encontro.
   *
   * Só o ABATE anda com o encontro. Dano em inimigo que escapa não conta, e a
   * onda não pode acabar com nave viva na tela — era o que acontecia quando o
   * progresso vinha do dano acumulado.
   */
  creditKill(quantidade = 1): void {
    this.state.run.restam = Math.max(0, this.state.run.restam - quantidade);
  }

  /** Vida média de um inimigo do encontro. Alimenta a estimativa abstrata. */
  get unitHpMedio(): number {
    const e = this.encounter;
    return e.hpPool / Math.max(1, e.unidades);
  }

  /**
   * Paga por `abates` inimigos derrubados, cada um valendo `fracao` do
   * encontro.
   *
   * Existe separada de `rewardKill` porque o caminho ABSTRATO derruba um
   * número fracionário de inimigos por passo — não um por vez. Antes ele
   * descontava `run.restam` na mão e não pagava nada: quem jogava com a aba
   * fechada, repetindo o mesmo setor, não ganhava XP nem recurso pelos abates.
   * Só o bônus de concluir o encontro, que não vem quando o setor não cai.
   *
   * Duplicar a fórmula no caminho abstrato era a alternativa, e é a que
   * garante que os dois divirjam na primeira vez que alguém mexer num dos
   * dois. Uma função, dois chamadores.
   *
   * ## Ela paga, e NÃO registra o fato do abate
   *
   * Isto é regra de jogo, não esquecimento: **missão não conta com a aba
   * fechada.** Quem registra o fato é `rewardKill`, chamada só pela cena.
   *
   * Acrescentar `registrar({ tipo: 'abate' })` aqui pareceria conserto — o
   * ganho é igual nos dois modos desde 04/09, então por que a missão não
   * seria? — e mudaria o jogo: missão de "derrube N inimigos" passaria a se
   * cumprir sozinha durante a noite. `tests/offline-online.test.ts` guarda
   * essa fronteira.
   */
  premiarAbates(abates: number, fracao: number): void {
    if (!(abates > 0)) return;
    const e = this.encounter;
    const s = this.stats;
    const parte = fracao * abates;
    this.grantCarga('nucleo', e.bounty * parte * RENDA_POR_ABATE.nucleo * (1 + s.nucleoGanho));
    this.grantCarga('sucata', e.bounty * parte * RENDA_POR_ABATE.sucata * (1 + s.sucataGanho));
    // XP por abate divide um ORÇAMENTO DA ONDA, em vez de pagar por cabeça.
    //
    // Continua sem usar `fraction` — a fatia de um inimigo numa onda de 200 é
    // pequena demais para render patente, e a patente premia tempo de combate,
    // não o tamanho do alvo. Mas fixa por cabeça ela também não pode ser: a
    // onda passou a ter dez vezes mais inimigos, e isso multiplicaria a
    // progressão por dez sem ninguém ter pedido.
    //
    // O total da onda é `abatesDeReferencia × (2 + bounty × 0,25)` — exatamente
    // o que ela pagava antes do adensamento, em qualquer setor e qualquer
    // perfil.
    this.grantXp((2 + e.bounty * 0.25) * (e.abatesDeReferencia / Math.max(1, e.unidades)) * abates);
    this.state.stats.kills += abates;
  }

  /**
   * Recompensa de um abate individual — o caminho DA CENA.
   *
   * Além de pagar, ela registra o fato do abate, e é a única que registra: é
   * o que faz missão progredir só com o jogo aberto. Ver `premiarAbates`.
   */
  rewardKill(fraction: number): void {
    const e = this.encounter;
    this.premiarAbates(1, fraction);
    // O fato do abate. O elemento sai do ENCONTRO e não do alvo individual
    // porque `rewardKill` recebe só a fração; levar a def do inimigo até aqui é
    // trabalho para quando existir missão de inimigo específico. O campo
    // `inimigo` já está no fato para essa hora não exigir mudar o formato.
    this.registrar({
      tipo: 'abate', inimigo: '', elemento: this.threatElement,
      chefe: e.kind === 'chefe', setor: e.sector,
    });
    // O loot deste abate é rolado pela cena (`rollDrops`) e vira uma cápsula
    // física — nada é entregue aqui, senão o item cairia duas vezes.
  }

  /**
   * Encontro limpo: paga, avança onda/setor e prepara o próximo.
   *
   * `abstract` indica que não houve cena.
   *
   * ⚠️ Este comentário dizia que nesse caso "o loot é entregue direto, já que
   * não existiram cápsulas para a nave coletar". Isso deixou de ser verdade e
   * ficou contradizendo o bloco lá embaixo, que diz **OFFLINE NÃO SOLTA ITEM**
   * — a regra atual, e a explicação de por que ela existe está lá.
   */
  completeEncounter(abstract = false): void {
    const e = this.encounter;
    const run = this.state.run;

    // A sucata e o núcleo NÃO caem aqui.
    //
    // Havia um bolo de fim de onda — `bounty × 4` e `bounty × 0,8` — pago por
    // limpar, independente de quantos inimigos morreram. Recurso agora sai só
    // do abate, e o abate é a única porta: ver `RENDA_POR_ABATE`.
    //
    // O bolo não sumiu, mudou de lugar. A soma continua a mesma; o que muda é
    // que ela chega em pedaços, cada pedaço com uma carcaça atrás.
    this.grantXp(e.bounty * (e.kind === 'chefe' ? 12 : e.kind === 'elite' ? 5 : 2));

    if (e.kind === 'chefe' && e.boss) {
      this.grantCarga('cristal', Math.max(1, Math.floor(e.bounty * 0.02)));
      this.state.stats.bossKills++;
      // Chefe de galáxia amplia a carga (§28). É idempotente por id, então
      // rematar o mesmo chefe — coisa comum, com a trava de fase — não concede
      // de novo.
      const g = galaxyOfSector(e.sector) + 1;
      if (g === 1 || g === 5 || g === 10) this.concederCarga(`chefe_g${g}`);
      // Cada chefe solta o SEU recurso, sempre o mesmo: é o que o transforma em
      // destino de farm em vez de obstáculo.
      const rec = e.boss && recursoDoChefe(e.boss.id);
      if (rec) this.guardarMaterial(rec.id, 1 + Math.floor(this.stats.sorte));
      const first = !this.state.codex.includes(e.boss.id);
      if (first) {
        this.state.codex.push(e.boss.id);
        // Chefe derrotado vira CONTATO (§29). O códex já é o registro de quem
        // caiu, então a conversão não guarda estado novo — só avisa, porque um
        // aliado que aparece calado na lista ninguém descobre.
        const contato = contatoDoChefe(e.boss.id);
        if (contato) toast(`Novo contato: ${contato.nome} — agora ALIADO`, 'epic');
        for (const g of e.boss.firstKill) this.grantChest(g.tier, g.count, `${e.boss.name} (primeira vitória)`);
      } else {
        this.grantChest('prata', 1, e.boss.name);
      }
      bus.emit('boss:defeated', { id: e.boss.id, name: e.boss.name, sector: e.sector });
      this.registrar({ tipo: 'chefe', chefeId: e.boss.id, setor: e.sector });
    }

    /**
     * OFFLINE NÃO SOLTA ITEM. Nenhum.
     *
     * O caminho abstrato tentava compensar as cápsulas que a cena não
     * materializa, e a conta nunca fechou: chegou a entregar 1.822 itens em
     * duas horas contra 44 do jogo ao vivo — 41×. Depois de calibrado, ainda
     * eram 368 contra 44. Fechar a aba continuava sendo a forma mais rápida de
     * conseguir equipamento, que é o oposto do pretendido.
     *
     * A saída não é calibrar melhor: é reconhecer que o item é a RECOMPENSA DE
     * ESTAR LÁ. Ele cai numa cápsula que a nave precisa coletar, e coletar é
     * uma coisa que só acontece com o jogo aberto. O que a ausência rende é
     * progresso — XP e recursos da fase onde a nave ficou —, e progresso é o
     * que um jogo ocioso deve pagar por tempo.
     *
     * A fase também não avança sozinha (ver mais abaixo): o jogador volta para
     * o setor onde deixou, com mais nível para enfrentá-lo.
     *
     * Recursos CONTINUAM entrando. Sem eles a ausência não pagaria nem o
     * reabastecimento da nave que gastou o combustível ficando lá — o jogador
     * voltaria de seis horas offline sem poder voar.
     */
    void abstract;

    bus.emit('wave:cleared', { wave: run.wave, ofWaves: WAVES_PER_SECTOR + 1 });

    if (run.wave > WAVES_PER_SECTOR) {
      // O setor caiu: só agora a carga da incursão vira saldo.
      this.bankCarga();
      // Cada galáxia tem um material-assinatura (§10). Ele entra ao fechar o
      // setor, no mesmo momento em que a carga é depositada: recurso de planeta
      // é o pagamento por ter limpado o lugar, não por ter matado um inimigo.
      for (const r of recursosDoPlaneta(run.sector)) {
        this.guardarMaterial(r.id, quantidadeDeMaterialGalactico(run.sector, this.stats.sorte));
      }
      run.wave = 1;
      run.cleared++;

      // O setor seguinte libera de qualquer forma: quem venceu conquistou o
      // acesso, mesmo que escolha ficar. É `bestSector` que abre a fase no mapa,
      // não a posição da incursão.
      const proximo = run.sector + 1;
      this.state.universe.bestSector = Math.max(this.state.universe.bestSector, proximo);
      this.state.universe.bestSectorEver = Math.max(this.state.universe.bestSectorEver, this.state.universe.bestSector);

      /**
       * Fora do jogo, a fase NUNCA avança.
       *
       * O modo ocioso é o jogador delegando o combate à IA numa fase que ele
       * escolheu e sabe que a nave aguenta. Avançar sozinho tiraria dele
       * justamente a decisão que a trava de fase existe para dar — e o levaria
       * para um setor que ele não escolheu, possivelmente um que a nave não
       * vence, onde ficaria morrendo sem ninguém ver.
       *
       * A liberação do setor seguinte acontece do mesmo jeito (`bestSector`
       * acima): o acesso é conquistado, só o ponteiro é que fica parado. Quando
       * o jogador voltar, ele escolhe se avança.
       */
      if (!abstract && !this.state.settings.repetirSetor) run.sector = proximo;
      run.falhasNoSetor = 0;

      // O setor CONCLUIDO, nao o proximo: a missao pede 'concluir o setor 10',
      // e com a trava de repetir a fase run.sector nem chega a mudar.
      this.registrar({ tipo: 'setor', setor: e.sector, galaxia: galaxyOfSector(e.sector) });
      this.registrar({ tipo: 'galaxia', galaxia: galaxyOfSector(this.state.universe.bestSectorEver) });
      bus.emit('sector:advanced', { universe: this.state.universe.index, sector: run.sector });
    } else {
      run.wave++;
    }

    this.refreshEncounter();
    this.touch();
  }

  /**
   * A nave caiu. Reinicia o encontro atual e nada mais.
   *
   * A penalidade é o TEMPO perdido, não progresso desfeito. Antes a morte
   * recuava uma onda, o que fazia sentido quando uma onda durava um instante;
   * com as ondas dimensionadas por tempo-alvo, virou trava: medido, um piloto
   * cru passava quarenta minutos oscilando entre a onda 1 e a 6 do setor 4,
   * porque avançava e recuava no mesmo ritmo.
   *
   * Um idle não pode ter esse tipo de empate. O jogador que está pouco abaixo
   * do necessário precisa continuar subindo devagar — e é a IA melhorando e o
   * equipamento caindo que rompem o impasse.
   */
  /**
   * A nave caiu. Morrer é caro.
   *
   * O setor recomeça da onda 1, a carga da incursão evapora, o personagem e a
   * nave perdem uma fatia do XP da faixa atual — podendo cair de nível, o que
   * devolve o último ponto da Matriz — e parte da sucata em banco vai junto.
   *
   * O item não se perde. O jogador arriscou a incursão, não o inventário.
   */
  failEncounter(): void {
    const run = this.state.run;
    this.state.stats.deaths++;

    const perdido = this.dropCarga();
    const resumo = cobrarMorte(this.state);

    // Refaz o setor inteiro. Sem isso a morte não custaria TEMPO, que é a
    // moeda que mais importa num idle.
    run.wave = 1;
    run.falhasNoSetor = (run.falhasNoSetor ?? 0) + 1;

    /**
     * Bateu na parede três vezes? OFERECE recuar. Não recua.
     *
     * ## Por que oferecer e não fazer
     *
     * A primeira versão recuava sozinha, e estava errada pelo mesmo motivo que
     * `completeEncounter` não avança sozinho: mover a fase por conta própria
     * tira do jogador a decisão que a trava de fase existe para dar. O
     * argumento já estava escrito ali, para o avanço — eu o apliquei numa
     * direção só.
     *
     * ## Por que a oferta existe
     *
     * Porque sem ela ninguém fica sabendo. Medido com `simular -- ganho 5 25 10
     * 3600`, uma hora por setor: no 25, a nave morre **225 vezes** sem concluir
     * um setor sequer e sem ganhar XP nenhum. Num idle isso acontece com a aba
     * fechada, então o jogador só descobre no dia seguinte.
     *
     * A oferta diz o que está acontecendo e o que dá para fazer. A escolha de
     * insistir continua sendo legítima — o jogador pode estar a um item de
     * passar.
     *
     * ## Uma vez por visita ao setor
     *
     * Quem recusou já sabe. Reoferecer a cada três quedas viraria uma janela
     * piscando durante a noite inteira — e a segunda oferta não traz informação
     * nova nenhuma. O aviso volta quando o jogador troca de setor e bate de
     * novo, que é quando a situação de fato mudou.
     */
    if (run.falhasNoSetor >= FALHAS_PARA_OFERECER_RECUO
      && run.sector > 1
      && run.paredeAvisadaEm !== run.sector) {
      run.paredeAvisadaEm = run.sector;
      bus.emit('sector:parede', { setor: run.sector, quedas: run.falhasNoSetor });
    }    // Renasce inteiro: morrer já custa XP, nível, ponto de Matriz e carga, e a
    // cena devolve a nave cheia. Manter a vida gasta puniria duas vezes.
    run.vidaFracao = 1;

    bus.emit('sector:failed', { sector: run.sector, perdido, resumo });
    this.refreshEncounter();
    this.touch();
  }

  /**
   * Passo abstrato da camada vertical — usado quando a cena não está sendo
   * desenhada (outro painel aberto, aba em segundo plano, progresso offline).
   */
  abstractTick(dt: number): void {
    const run = this.state.run;
    // Combustível corre no MESMO ponto do tempo ao vivo e do offline. Se
    // fossem dois caminhos, aba aberta e fechada renderiam tanques diferentes
    // — e o jogador descobriria qual dos dois compensa.
    if (this.gastarCombustivel(dt)) return;
    // Converte dano por segundo em ABATES por segundo, para o caminho abstrato
    // medir a mesma coisa que a cena mede. Sem isso os dois divergiriam: um
    // contaria dano e o outro naves destruídas.
    //
    // E o abate tem DOIS tetos, não um. O dano é o teto óbvio. O outro é a
    // ENTRADA: não se mata quem ainda não chegou, e a cena solta a onda em
    // levas. Enquanto a vida por inimigo era alta o dano mandava sempre e o
    // segundo teto não existia na prática — com a onda adensada ele passou a
    // mandar no começo do jogo, onde o inimigo tem 0,2 de vida e o que se
    // espera é ele aparecer.
    //
    // Sem este teto aqui, ficar offline limparia o setor 1 em 0,4s contra os
    // 70s do jogo ao vivo — e a aba fechada viraria o jeito rápido de subir.
    const porDano = dps(this.stats) / Math.max(0.01, this.unitHpMedio);
    // `EFICIENCIA_DA_CENA` aproxima o abstrato do que a cena realmente faz.
    //
    // Sem ela o caminho abstrato mata no teto de entrada o tempo todo e rende
    // 2,2× o que o jogador com a aba aberta rende — medido em 04/09, seis
    // setores. Isso inverteria o incentivo: fechar a aba passaria a ser o jeito
    // rápido de progredir, que é a preocupação registrada na decisão nº 6.
    const ritmo = Math.min(porDano, TAXA_DE_ENTRADA) * EFICIENCIA_DA_CENA;
    const mortos = Math.min(ritmo * dt, run.restam);
    run.restam = Math.max(0, run.restam - mortos);

    /**
     * O abate PAGA aqui também, e não só ao concluir o encontro.
     *
     * Antes esta linha não existia: o caminho abstrato descontava `restam` e
     * seguia. Quem jogava com a aba fechada só recebia o bônus de conclusão —
     * e quem estava repetindo um setor sem conseguir fechá-lo não recebia
     * NADA, enquanto o mesmo jogador com a aba aberta subia de nível devagar,
     * matando. Duas contas diferentes para a mesma coisa.
     *
     * A fração é `1 / unidades`: no caminho abstrato não existe inimigo
     * individual, então cada unidade de `restam` vale a mesma parte do
     * encontro. Ao vivo a cena passa o `share` real de cada um, e a soma dá o
     * mesmo total — é a média que o abstrato usa por não ter os indivíduos.
     */
    this.premiarAbates(mortos, 1 / Math.max(1, this.encounter.unidades));
    run.elapsed += dt;

    /**
     * A nave PERDE VIDA aos poucos, em vez de morrer num corte binário.
     *
     * Era `if (elapsed > survivalWindow) failEncounter()`. Um corte assim é
     * determinístico e sem memória: um encontro que passasse do limiar por um
     * segundo matava tão certo quanto um que passasse por um minuto, e vencer
     * apertado — que ao vivo acontece o tempo todo — era impossível.
     *
     * Medido: o caminho abstrato acumulava 3.088 mortes ao fechar a galáxia 1,
     * contra 24 do jogo ao vivo. Não era um jogador lento, era um modelo que
     * matava sempre que a conta fechava do lado errado.
     *
     * Aqui a vida cai por dano recebido líquido de regeneração, e é o zero que
     * mata. O efeito prático é que a nave aguenta encontros próximos do limite
     * e só cai quando o dano acumulado a alcança — que é o que a cena faz.
     */
    const s = this.stats;
    const efetiva = Math.max(1, s.vida + s.escudo);
    const liquido = Math.max(0, this.incomingDps - s.regen);
    run.vidaFracao = Math.min(1, (run.vidaFracao ?? 1) - (liquido / efetiva) * dt);

    if (run.restam <= 0) {
      this.completeEncounter(true);
      // O escudo volta entre encontros — é o que `SHIELD_LOCK` faz na cena
      // depois de alguns segundos sem levar dano. Sem isto, a vida só descia e
      // uma sequência de ondas apertadas matava por acúmulo que ao vivo não
      // existe: lá o jogador chega na onda seguinte com o escudo cheio.
      const fatiaDeEscudo = s.escudo / efetiva;
      run.vidaFracao = Math.min(1, (run.vidaFracao ?? 1) + fatiaDeEscudo);
      return;
    }

    if ((run.vidaFracao ?? 1) <= 0) this.failEncounter();
  }


  // ── patente de comando e matriz de passivas ───────────────────────────────

  /**
   * Concede XP de comando. Cada patente vale um ponto na matriz — é o único
   * eixo de poder que o jogador distribui à mão, então precisa vir de jogar e
   * não de gastar recurso.
   */
  grantXp(amount: number): void {
    if (!(amount > 0)) return;
    const ganho = amount * XP_GANHO_GLOBAL * (1 + this.stats.xpGanho);

    const cmd = this.state.command;
    const subiu = this.avancarNivel(cmd, ganho, curvaXpPersonagem);
    if (subiu > 0) {
      toast(`Patente ${cmd.nivel} · +${subiu} ponto${subiu > 1 ? 's' : ''} de matriz`, 'epic', 'node/exp');
    }

    // A nave ATIVA sobe junto, na curva dela. Quem não está voando não ganha
    // nada: é isso que faz desenvolver uma segunda nave custar tempo próprio,
    // e sem esse custo o §18 não teria como existir.
    const nave = this.naveAtiva;
    const subiuNave = this.avancarNivel(nave, ganho, curvaXpNave);
    if (subiuNave > 0) {
      toast(`${this.hull.name} nível ${nave.nivel}`, 'good', 'node/exp');
    }

    if (subiu > 0) this.registrar({ tipo: 'nivel', qual: 'personagem', nivel: cmd.nivel });
    if (subiuNave > 0) this.registrar({ tipo: 'nivel', qual: 'nave', nivel: nave.nivel });
    if (subiu > 0 || subiuNave > 0) this.touch();
  }

  /** Progresso de nível da nave em uso, criado sob demanda. */
  get naveAtiva(): NaveProgresso {
    const naves = this.state.naves;
    return (naves[this.state.hull] ??= { nivel: 1, xp: 0, equipped: {} });
  }

  /**
   * Soma XP e sobe os níveis que couberem. Devolve quantos subiu.
   *
   * O teto de 200 níveis por chamada existe porque um relatório offline
   * generoso não pode subir quatrocentos níveis de uma vez e enfileirar
   * quatrocentos avisos.
   */
  private avancarNivel(
    p: NivelProgresso,
    ganho: number,
    faixaDe: (nivel: number) => number,
  ): number {
    p.xp += ganho;
    let subiu = 0;
    while (p.nivel < NIVEL_MAX && p.xp >= faixaDe(p.nivel) && subiu < 200) {
      p.xp -= faixaDe(p.nivel);
      p.nivel++;
      subiu++;
    }
    // No teto, o XP para de acumular em vez de crescer para sempre.
    if (p.nivel >= NIVEL_MAX) p.xp = 0;
    return subiu;
  }

  get xpProgress(): number {
    return clamp(this.state.command.xp / xpForLevel(this.state.command.nivel), 0, 1);
  }

  get matrixPoints(): number {
    return pointsAvailable(this.state);
  }

  get matrixSpent(): number {
    return pointsSpent(this.state);
  }

  canAllocate(id: string): boolean {
    return canAllocate(this.state, id);
  }

  allocateNode(id: string): boolean {
    if (!allocate(this.state, id)) return false;
    this.touch();
    return true;
  }

  /** Aloca a rota inteira até um nó distante. Devolve quantos pontos custou. */
  allocateRoute(id: string): number {
    const spent = allocatePath(this.state, id);
    if (spent > 0) this.touch();
    return spent;
  }

  canDeallocate(id: string): boolean {
    return canDeallocate(this.state, id);
  }

  deallocateNode(id: string): boolean {
    if (!deallocate(this.state, id)) return false;
    this.touch();
    return true;
  }

  /** Refaz a matriz inteira. Consome um refaz gratuito ou 25 cristais. */
  respecMatrix(): boolean {
    if (this.state.command.refunds > 0) this.state.command.refunds--;
    else if (!this.spend('cristal', 25)) return false;
    respec(this.state);
    this.touch();
    return true;
  }

  // ── itens ─────────────────────────────────────────────────────────────────

  dropItem(ilvl: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      const item = rollItem(this.rng, ilvl, this.stats.sorte, this.state.universe.index);
      this.acquire(item);
    }
  }

  /**
   * Rola o loot de um abate SEM entregá-lo.
   *
   * A cena usa isto para materializar cápsulas na tela; o item só entra no
   * inventário quando a nave alcança a cápsula. Separar a rolagem da entrega é
   * o que permite que um drop seja perdido de verdade.
   */
  get temLote(): boolean {
    return this.pote !== null;
  }

  /** O pote secou e há drop devendo: é hora de pedir a próxima página. */
  get poteSecou(): boolean {
    return this.devendo.length > 0;
  }

  /** Recebe o pote do servidor e paga o que estava devendo. */
  receberLote(lote: Record<TipoDeDrop, Item[]>): void {
    this.pote = { onda: [...lote.onda], elite: [...lote.elite], chefe: [...lote.chefe] };
    if (!this.devendo.length) return;

    // A dívida é paga na ORDEM em que foi contraída: o chefe que matou antes
    // do lote chegar recebe o item de chefe, e não o que sobrar.
    const pendentes = this.devendo.splice(0, this.devendo.length);
    for (const kind of pendentes) {
      const item = this.tirarDoPote(kind);
      if (item) this.acquire(item);
    }
  }

  /**
   * Tira um item do pote, ou registra a dívida.
   *
   * Devolve `null` quando não há o que entregar — e quem chama NÃO deve rolar
   * localmente nesse caso. É a regra inteira da Fase 3 em uma linha: o cliente
   * consome, nunca gera.
   */
  private tirarDoPote(kind: TipoDeDrop): Item | null {
    const item = this.pote?.[kind].shift();
    if (item) {
      // O comando diz o TIPO, nunca o item: o servidor deriva qual é pela
      // semente e pelo cursor. É o que impede inventar uma peça.
      this.state.comandosDeItem.push({ tipo: 'coletar', pote: kind });
      return item;
    }
    // Teto na dívida: um cliente offline por horas acumularia milhares de
    // promessas, e pagá-las de uma vez despejaria um inventário inteiro num
    // quadro. Cem cobre qualquer ausência plausível entre dois setores.
    if (this.devendo.length < 100) this.devendo.push(kind);
    return null;
  }

  rollDrops(kind: 'onda' | 'elite' | 'chefe', alvoDef?: { id?: string; tags?: readonly string[]; element?: ElementId }): Item[] {
    const e = this.encounter;
    const out: Item[] = [];

    /**
     * O drop passa pela tabela de regras (§10).
     *
     * Antes esta função ignorava quem morreu e onde: o chefe do setor 300
     * soltava da mesma tabela que o caça do setor 1, com um `if` para chefe e
     * outro para elite. As regras vivem em `data/balance/drops.ts` e casam por
     * padrão, então conteúdo futuro — galáxia, inimigo, chefe — já cai numa
     * regra sem precisar de cadastro.
     */
    const regra = resolverDrop({
      setor: e.sector,
      galaxia: galaxyOfSector(e.sector),
      kind,
      chefe: e.boss?.id ?? null,
      inimigo: alvoDef?.id ?? null,
      tags: alvoDef?.tags,
      elemento: alvoDef?.element ?? e.boss?.element,
    });

    const luck = this.stats.sorte * regra.sorteMult;
    const ilvl = e.ilvl + regra.ilvlBonus;
    const opts = {
      floor: regra.pisoDeRaridade,
      slotFavorecido: regra.slotFavorecido,
      elementoFavorecido: {
        ...regra.elementoFavorecido,
        ...afinidadeDoAlvo({
          setor: e.sector, galaxia: galaxyOfSector(e.sector), kind,
          elemento: alvoDef?.element ?? e.boss?.element,
        }),
      },
    };

    // Chefe e elite entregam sempre; a onda comum passa pela chance de drop.
    // `itensExtras` é o que a regra concedeu além do normal.
    const garantidos = regra.itensExtras > 0
      ? regra.itensExtras + Math.floor(luck * 2) * (kind === 'chefe' ? 1 : 0)
      : 0;
    const sorteados = this.rng.chance(dropChance(kind, luck)) ? 1 : 0;
    const total = Math.max(0, Math.round((garantidos + sorteados) * regra.quantidade));

    // O item NÃO é rolado aqui: vem do pote que o servidor mandou.
    //
    // `ilvl`, `luck` e `opts` continuam sendo calculados acima porque a regra
    // de drop ainda decide QUANTOS itens caem — é só o CONTEÚDO que mudou de
    // dono. O servidor aplica os mesmos `pisoDeRaridade`, `ilvlBonus` e
    // `slotFavorecido` ao montar cada pote, derivando-os do setor.
    void ilvl; void opts;
    for (let i = 0; i < total; i++) {
      const item = this.tirarDoPote(kind);
      if (item) out.push(item);
    }
    return out;
  }

  /** Tipos de material distintos guardados hoje. */
  get materiaisGuardados(): number {
    return Object.keys(this.state.armazem).length;
  }

  /**
   * Guarda material (§29).
   *
   * O Armazém limita quantos TIPOS se acompanha, não a quantidade de cada um: a
   * decisão interessante é "que materiais eu mantenho", não "quantos cabem".
   * Material que já está guardado sempre aceita mais; só abrir um tipo NOVO
   * consome espaço, e é isso que dá peso a ampliar o depósito.
   *
   * Devolve quanto de fato entrou — zero quando o armazém está cheio e o tipo
   * é novo, para quem chamou poder avisar em vez de perder o material calado.
   */
  guardarMaterial(id: string, quantidade: number): number {
    const def = RECURSO_POR_ID.get(id);
    if (!def || !(quantidade > 0)) return 0;

    const atual = this.state.armazem[id] ?? 0;
    if (atual === 0 && this.materiaisGuardados >= this.resourceSlots) return 0;

    const cabe = Math.max(0, Math.min(quantidade, PILHA_MAX - atual));
    if (cabe <= 0) return 0;
    this.state.armazem[id] = atual + cabe;
    this.registrar({ tipo: 'recurso', recurso: id, quantidade: cabe });
    this.touch();
    return cabe;
  }

  /**
   * Quanto se tem de um material.
   *
   * Existe para ser o ÚNICO ponto que responde a pergunta. O modo de teste já
   * dava recursos infinitos pelos quatro do banco (`canAfford`/`spend`) e pelos
   * pontos de matriz, mas o Armazém veio depois e ficou de fora — a fusão
   * travava por falta de Ferrita com o modo de teste ligado. Espalhar um
   * `if (testMode)` pelos três lugares que consultam o estoque seria pedir para
   * o quarto lugar nascer errado, então a exceção mora aqui.
   */
  materialDisponivel(id: string): number {
    if (this.testMode) return Infinity;
    return this.state.armazem[id] ?? 0;
  }

  /** Consome material. Zera a chave em vez de deixá-la em 0. */
  gastarMaterial(id: string, quantidade: number): boolean {
    // No modo de teste o estoque é infinito, então não há o que descontar.
    if (this.testMode) return true;
    const atual = this.state.armazem[id] ?? 0;
    if (atual < quantidade) return false;
    const resto = atual - quantidade;
    if (resto > 0) this.state.armazem[id] = resto;
    else delete this.state.armazem[id];
    this.touch();
    return true;
  }

  /** Capacidade do depósito de RECURSOS (§29), separada da de itens. */
  get resourceSlots(): number {
    // Modo de teste: depósito cheio, para o conteúdo caber sem farmar concessão.
    return this.testMode ? CARGA_MAXIMA : capacidadeDeRecursos(this.concessoesDeCarga);
  }

  /**
   * Concede espaço de carga. Idempotente por id.
   *
   * Porta única de propósito: a mesma fonte não pode conceder duas vezes, e com
   * um contador em vez de ids recomprar na loja ou rematar um chefe daria
   * espaço de novo. Devolve `true` só quando a concessão é nova, para quem
   * chamou saber se deve avisar o jogador.
   */
  concederCarga(id: string): boolean {
    if (!CONCESSAO_POR_ID.has(id)) return false;
    if (this.state.cargaLiberada.includes(id)) return false;
    this.state.cargaLiberada.push(id);
    const c = CONCESSAO_POR_ID.get(id)!;
    toast(`Carga ampliada: ${c.nota} (+${c.itens ?? 0} espaços)`);
    this.touch();
    return true;
  }

  // ── fusão de itens (§26) ──────────────────────────────────────────────────

  /** O que falta para uma fusão poder acontecer. Vazio = pode. */
  faltaParaFundir(uids: readonly string[]): string[] {
    const itens = uids
      .map((u) => this.state.inventory.find((i) => i.uid === u))
      .filter((i): i is Item => !!i);
    const faltas: string[] = [];

    if (itens.length !== uids.length) faltas.push('item já não está no inventário');
    if (!itens.length) return faltas;

    const raridade = itens[0]!.rarity;
    if (itens.some((i) => i.rarity !== raridade)) faltas.push('todos precisam ser da mesma raridade');

    const receita = receitaPara(raridade);
    if (!receita) { faltas.push('não há receita para esta raridade'); return faltas; }

    if (itens.length !== receita.quantidade) {
      faltas.push(`a receita pede ${receita.quantidade} itens`);
    }
    // Favorito NUNCA entra: fundir é destrutivo, e a marca de favorito existe
    // justamente para proteger uma peça de sumir por engano.
    if (itens.some((i) => i.favorite)) faltas.push('há favoritos na seleção');

    // `canAfford`, e não a comparação direta: é ele que conhece o modo de teste.
    if (!this.can('nucleo', receita.nucleos)) faltas.push('núcleos insuficientes');
    for (const [id, n] of Object.entries(receita.custo)) {
      if (this.materialDisponivel(id) < n) faltas.push(`falta ${RECURSO_POR_ID.get(id)?.nome ?? id}`);
    }
    return faltas;
  }

  // `fundirItens()` foi REMOVIDO na Fase 3c do Passo 9.
  //
  // Ele consumia dez peças e produzia uma com `rollItem` LOCAL — a última
  // porta por onde um item nascia no cliente. Bastava fundir lixo até o
  // resultado agradar, e a peça saía legítima pelos olhos de todo o resto do
  // sistema, inclusive do inventário que a 3b tinha acabado de blindar.
  //
  // Quem funde agora é `POST /sintetizar`. `faltaParaFundir` continua aqui:
  // ela só DIZ o que falta, e é o que o painel usa para desabilitar o botão
  // antes de gastar uma requisição.

  /** Entrada única de itens novos: aplica auto-desmanche e auto-equipar. */
  acquire(item: Item): void {
    this.state.stats.itemsFound++;

    /**
     * A primeira peça de ESCUDO abre a dica sobre a bolha.
     *
     * Aqui e não em `stash`: o item pode ser auto-equipado ou auto-desmontado
     * antes de chegar lá, e nos dois casos ele CAIU — a dica é sobre o jogador
     * ter passado a se importar com escudo, não sobre a peça ter sobrado.
     *
     * O casco já vem com escudo de fábrica, então a bolha não é novidade na
     * tela. O que é novidade é o jogador começar a ESCOLHER escudo — e é aí
     * que saber desligar o visual passa a valer.
     */
    if (item.slot === 'escudo' && !this.state.settings.dicaDeEscudoVista) {
      this.state.settings.dicaDeEscudoVista = true;
      bus.emit('dica:escudo');
    }
    // Antes de qualquer automacao: o item foi OBTIDO mesmo que o auto-desmanche
    // o desfaca no passo seguinte, e a missao de coleta conta o que caiu.
    this.registrar({ tipo: 'item', raridade: item.rarity, slot: item.slot, elemento: item.element ?? 'padrao' });

    // O auto-equipar passa pela MESMA regra. Sem isto, a automação montaria
    // o que a mão não consegue montar — e o jogador descobriria a restrição
    // pela contradição entre as duas.
    if (this.vipAtivo && this.state.settings.autoEquip && podeEquipar(this.state, item) && scoreItem(this.state, item) > 0) {
      // Auto-equipar mira a nave EM CAMPO: o item acabou de cair na incursão
      // dela, e mandá-lo para uma nave guardada seria decidir pelo jogador.
      const previous = this.equipamentoDe()[item.slot];
      this.equipamentoDe()[item.slot] = item;
      this.touch();
      if (previous) this.stash(previous);
      bus.emit('loot:dropped', { item });
      return;
    }

    if (item.rarity < this.state.settings.autoSalvage) {
      this.descartarAutomaticamente(item);
      return;
    }

    this.stash(item);
    bus.emit('loot:dropped', { item });
  }

  private stash(item: Item): void {
    if (this.state.inventory.length >= this.cargoSlots) {
      // Bagagem cheia: aplica o destino automático ao pior não-favorito.
      const worst = this.state.inventory
        .filter((i) => !i.favorite)
        .sort((a, b) => a.rarity - b.rarity || a.ilvl - b.ilvl)[0];
      if (!worst || worst.rarity > item.rarity) {
        this.descartarAutomaticamente(item);
        return;
      }
      if (this.vipAtivo && this.state.settings.autoDispose === 'vender') this.sell(worst.uid);
      else if (!this.salvage(worst.uid)) this.sell(worst.uid);
    }
    this.state.inventory.push(item);
  }

  /**
   * O equipamento de um casco. Criado na hora se a nave é nova.
   *
   * Aceita um id porque a coluna de anatomia monta o conjunto de naves que
   * NÃO estão em campo — sem isso, equipar a segunda nave exigiria trocá-la
   * para o campo primeiro, e a rotação por combustível ficaria insuportável.
   */
  private equipamentoDe(hullId = this.state.hull): Partial<Record<SlotId, Item>> {
    const nave = (this.state.naves[hullId] ??= { nivel: 1, xp: 0, equipped: {} });
    nave.equipped ??= {};
    return nave.equipped;
  }


  /**
   * Monta a peça. Devolve `false` se a nave não a aceita.
   *
   * A recusa é do MODELO e não da tela: a anatomia, o inventário e o
   * auto-equipar são três caminhos diferentes até aqui, e uma regra que
   * morasse em cada um deles seria a mesma regra escrita três vezes — com
   * duas chances de divergir.
   */
  equip(uid: string, hullId = this.state.hull): boolean {
    const idx = this.state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return false;
    const item = this.state.inventory[idx]!;
    if (!podeEquipar(this.state, item, hullId)) return false;
    const previous = this.equipamentoDe(hullId)[item.slot];
    this.state.inventory.splice(idx, 1);
    this.equipamentoDe(hullId)[item.slot] = item;
    if (previous) this.state.inventory.push(previous);
    this.state.comandosDeItem.push({ tipo: 'equipar', uid, nave: hullId });
    this.touch();
    return true;
  }

  unequip(slot: SlotId, hullId = this.state.hull): void {
    const item = this.equipamentoDe(hullId)[slot];
    if (!item) return;
    delete this.equipamentoDe(hullId)[slot];
    this.stash(item);
    this.state.comandosDeItem.push({ tipo: 'equipar', uid: item.uid, nave: null });
    this.touch();
  }

  /** Vende uma peça por Sucata. Nunca gera material ou outra moeda. */
  sell(uid: string): number {
    const idx = this.state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return 0;
    const item = this.state.inventory[idx]!;
    if (item.favorite) return 0;
    const valor = valorDeVenda(item);
    this.state.inventory.splice(idx, 1);
    this.state.comandosDeItem.push({ tipo: 'descartar', uid });
    this.grant('sucata', valor);
    return valor;
  }

  /**
   * Desmontar rende somente materiais (§29).
   *
   * Venda e desmontagem precisam competir. Se uma peça desse Sucata e material
   * ao mesmo tempo, a venda seria uma ação falsa e o jogador nunca teria uma
   * decisão econômica. Favoritos exigem desmarcação antes de qualquer descarte.
   */
  salvage(uid: string): RetornoDeDesmanche | null {
    const idx = this.state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return null;
    const item = this.state.inventory[idx]!;
    if (item.favorite) return null;
    const retorno = retornoDeDesmanche(item);
    if (!this.cabemMateriais(retorno.materiais)) return null;
    this.state.inventory.splice(idx, 1);
    this.state.comandosDeItem.push({ tipo: 'descartar', uid });
    this.guardarRetorno(retorno);
    return retorno;
  }

  /** Vende em lote abaixo da raridade, sempre preservando favoritos. */
  sellBelow(rarity: number): { itens: number; sucata: number } {
    const ids = this.state.inventory
      .filter((item) => !item.favorite && item.rarity < rarity)
      .map((item) => item.uid);
    let sucata = 0;
    let itens = 0;
    for (const uid of ids) {
      const valor = this.sell(uid);
      if (valor > 0) { sucata += valor; itens++; }
    }
    return { itens, sucata };
  }

  /** Desmonta em lote abaixo da raridade, preservando favoritos e sem perdas. */
  salvageBelow(rarity: number): { itens: number; materiais: Record<string, number> } {
    const ids = this.state.inventory
      .filter((item) => !item.favorite && item.rarity < rarity)
      .map((item) => item.uid);
    const materiais: Record<string, number> = {};
    let itens = 0;
    for (const uid of ids) {
      const retorno = this.salvage(uid);
      if (!retorno) continue;
      itens++;
      for (const [id, n] of Object.entries(retorno.materiais)) materiais[id] = (materiais[id] ?? 0) + n;
    }
    return { itens, materiais };
  }

  private cabemMateriais(materiais: Readonly<Record<string, number>>): boolean {
    const novos = Object.keys(materiais).filter((id) => (this.state.armazem[id] ?? 0) <= 0).length;
    return this.materiaisGuardados + novos <= this.resourceSlots;
  }

  private guardarRetorno(retorno: RetornoDeDesmanche): void {
    for (const [id, n] of Object.entries(retorno.materiais)) this.guardarMaterial(id, n);
  }

  /** Item ainda fora do inventário: se o Armazém lotou, vende em vez de perder. */
  private descartarAutomaticamente(item: Item): void {
    if (this.vipAtivo && this.state.settings.autoDispose === 'vender') {
      this.grant('sucata', valorDeVenda(item));
      return;
    }
    const retorno = retornoDeDesmanche(item);
    if (this.cabemMateriais(retorno.materiais)) this.guardarRetorno(retorno);
    else this.grant('sucata', valorDeVenda(item));
  }

  toggleFavorite(uid: string): void {
    const item = this.state.inventory.find((i) => i.uid === uid);
    if (item) item.favorite = !item.favorite;
  }

  // ── baús ──────────────────────────────────────────────────────────────────

  grantChest(tier: string, count = 1, source = ''): void {
    this.state.chests[tier] = (this.state.chests[tier] ?? 0) + count;
    bus.emit('chest:granted', { tier, source });
  }

  openChestFromStock(tier: string): Item[] | null {
    if ((this.state.chests[tier] ?? 0) <= 0) return null;
    this.state.chests[tier]!--;

    const def = CHEST_BY_ID.get(tier);
    const items = openChest(this.rng, tier, this.encounter.ilvl, this.state.universe.index);

    if (def) {
      // Os recursos do baú escalam com o setor: um baú de bronze aos 60 não
      // pode valer o mesmo que aos 3.
      const scale = 1 + this.encounter.bounty * 0.05;
      for (const id of RESOURCE_IDS) {
        const amount = def.resources[id];
        if (amount) this.grant(id, id === 'cristal' ? amount : amount * scale);
      }
    }

    for (const item of items) this.acquire(item);
    this.state.stats.chestsOpened++;
    this.registrar({ tipo: 'bau', tier });
    bus.emit('chest:opened', { tier, items });
    this.touch();
    return items;
  }

  buyChest(tier: string): boolean {
    const def = CHEST_BY_ID.get(tier);
    if (!def || def.buy <= 0 || !this.spend('cristal', def.buy)) return false;
    this.grantChest(tier, 1, 'loja');
    return true;
  }

  // ── loja ──────────────────────────────────────────────────────────────────

  // `buyVip()` foi REMOVIDO, e a ausência é deliberada.
  //
  // Ele debitava 500 cristais e carimbava `vip.expiresAt` aqui, no cliente.
  // Desde a Fase 2 do Passo 9 quem faz isso é o servidor (`POST /vip`), e
  // manter a versão local seria manter um caminho que dá passe de graça a
  // quem o chamar pelo console — cosmético até a próxima sincronização, mas
  // cosmético é exatamente como um relato de bug começa.
  //
  // A compra vive em `app/carteira.ts`, que é a camada que pode falar com a
  // rede. `sim/` não conhece rede, e é por isso que ela não mora aqui.

  shopOwned(id: string): number {
    return this.state.shop[id] ?? 0;
  }

  /**
   * Concilia compras antigas de carga com o registro novo de concessões.
   *
   * A loja anterior incrementava `shop.carga`, mas nunca chamava
   * `concederCarga`. Derivar os ids aqui recupera esses espaços sem migração de
   * save e o Set impede contar duas vezes nas compras feitas já corrigidas.
   */
  private get concessoesDeCarga(): string[] {
    const ids = new Set(this.state.cargaLiberada);
    for (const id of SHOP_CARGO_IDS.slice(0, Math.min(SHOP_CARGO_IDS.length, this.shopOwned('carga')))) {
      ids.add(id);
    }
    return [...ids];
  }

  /** Espaços de carga: base do save + o que a loja adicionou. */
  get cargoSlots(): number {
    // A capacidade vem das CONCESSÕES obtidas (§28), não de um número no save.
    // O jogador começa com 15 — grade 5 × 3 — e cresce até 70 por loja, chefe e
    // universo; missões e conquistas entram quando existirem, sem tocar aqui.
    return this.testMode ? CARGA_MAXIMA : capacidadeDeItens(this.concessoesDeCarga);
  }

  /** Limite atual de compras; zero significa serviço sem cota. */
  shopPurchaseLimit(id: string): number {
    const def = SHOP_BY_ID.get(id);
    return def ? shopLimit(def, this.state.command.nivel) : 0;
  }

  canBuyShopItem(id: string): boolean {
    const def = SHOP_BY_ID.get(id);
    if (!def) return false;

    const owned = this.shopOwned(id);
    const limit = shopLimit(def, this.state.command.nivel);
    if (limit > 0 && owned >= limit) return false;
    if (this.alcanceLiberado < (def.requiresSector ?? 0)) return false;
    if (this.nivelLiberado < nivelExigido(def.requiresSector ?? 0)) return false;
    if (def.effect === 'tentativa_provacao'
      && tentativasDisponiveis(this.state) >= limiteTentativasDaProvacao(this.state)) return false;
    if (def.effect === 'refaz_matriz' && this.matrixSpent <= 0) return false;
    return this.can(def.currency, shopCost(def, owned));
  }

  buyShopItem(id: string): boolean {
    const def = SHOP_BY_ID.get(id);
    if (!def || !this.canBuyShopItem(id)) return false;

    const owned = this.shopOwned(id);
    if (!this.spend(def.currency, shopCost(def, owned))) return false;

    // O histórico também conta serviços: é ele que fecha a cota dos câmbios e
    // deixa a interface mostrar quantas operações já foram usadas.
    this.state.shop[id] = owned + 1;

    for (const [resource, amount] of Object.entries(def.output ?? {})) {
      this.grant(resource as ResourceId, amount ?? 0);
    }

    switch (def.effect) {
      case 'carga': {
        const concessao = SHOP_CARGO_IDS[owned];
        if (concessao) this.concederCarga(concessao);
        break;
      }
      case 'elemento_item':
      case 'elemento_nave':
        // Serviço com alvo não age na compra: vira CARGA no Armazém. Comprar e
        // usar deixaram de ser o mesmo instante justamente para o jogador
        // escolher o alvo com a peça à vista, e não de memória.
        this.state.servicos[id] = (this.state.servicos[id] ?? 0) + 1;
        break;
      case 'refaz_matriz': respec(this.state); break;
      case 'tentativa_provacao': {
        const p = this.state.provacao;
        const limite = limiteTentativasDaProvacao(this.state);
        p.tentativas = Math.min(limite, tentativasDisponiveis(this.state) + 1);
        if (p.tentativas >= limite) p.tentativasEm = Date.now();
        break;
      }
      default: break;
    }

    this.touch();
    return true;
  }

  /** Preço em núcleos para recalibrar uma linha do item. */
  recalibrationPrice(uid: string): number | null {
    const item = this.state.inventory.find((i) => i.uid === uid);
    return item ? recalibrationCost(item) : null;
  }

  /**
   * Substitui uma linha por outra naturalmente possível naquele item.
   * Raridade, nível, elemento, conjunto e tier da linha ficam intactos.
   */
  recalibrateItemAffix(uid: string, index: number): Item['affixes'][number] | null {
    const item = this.state.inventory.find((i) => i.uid === uid);
    if (!item || !item.affixes[index]) return null;
    const cost = recalibrationCost(item);
    if (!this.can('nucleo', cost)) return null;
    const rolled = recalibrateAffix(this.rng, item, index);
    if (!rolled || !this.spend('nucleo', cost)) return null;
    item.affixes[index] = rolled;
    toast(`Afixo recalibrado · T${rolled.tier ?? 1}`, 'epic', item.icon);
    this.touch();
    return rolled;
  }

  /** Receita concreta exibida pela Bancada de Modulação. */
  modulationCost(uid: string, operacaoId: OperacaoDeModulacaoId): CustoDeModulacao | null {
    const item = this.state.inventory.find((i) => i.uid === uid);
    const operacao = OPERACAO_DE_MODULACAO_POR_ID.get(operacaoId);
    return item && operacao ? custoDeModulacao(item, operacao) : null;
  }

  /**
   * Executa uma das dez operações, de forma atômica: nenhuma essência é
   * cobrada quando o item não aceita a transformação.
   */
  modulateItem(
    uid: string,
    operacaoId: OperacaoDeModulacaoId,
    index = -1,
  ): ResultadoDeModulacao | null {
    const item = this.state.inventory.find((i) => i.uid === uid);
    const operacao = OPERACAO_DE_MODULACAO_POR_ID.get(operacaoId);
    if (!item || !operacao) return null;

    const custo = custoDeModulacao(item, operacao);
    if (!this.can('nucleo', custo.nucleos)) return null;
    if (this.materialDisponivel(custo.essencia) < custo.quantidade) return null;

    const resultado = aplicarModulacao(this.rng, item, operacaoId, index);
    if (!resultado) return null;

    // As duas verificações acima tornam estes descontos infalíveis no mesmo
    // turno. Se isso mudar no futuro, a mutação deverá ganhar rollback.
    this.spend('nucleo', custo.nucleos);
    this.gastarMaterial(custo.essencia, custo.quantidade);
    toast(`${operacao.nome} concluída`, 'epic', item.icon);
    this.touch();
    return resultado;
  }

  // ── frota ─────────────────────────────────────────────────────────────────

  /**
   * Passa o tempo do combustível. Devolve `true` se a nave secou agora.
   *
   * Ao secar, troca sozinho para a melhor nave que ainda tem tanque. Deixar o
   * jogador parado numa nave que não decola seria transformar o sistema numa
   * punição por estar ausente — a rotação é o objetivo, ficar de castigo não.
   *
   * Sem nenhuma nave disponível, a frota fica em terra e a incursão para: aí
   * não há o que fazer senão reabastecer.
   */
  gastarCombustivel(dt: number): boolean {
    if (this.testMode) return false;

    // O tanque corre SEMPRE — inclusive com a frota em terra, porque é assim
    // que as naves paradas voltam a encher. Parar o relógio ao secar deixaria
    // o jogador sem saída nenhuma.
    const secou = passarTempo(this.state, dt);

    if (secou) {
      const proxima = proximaComCombustivel(this.state);
      if (proxima) {
        this.selectHull(proxima);
        // Evento e não FATO: fato alimenta missão, e "trocou de nave por falta
        // de combustível" não é conquista de ninguém. A tela usa para avisar.
        bus.emit('combustivel:seco', { trocouPara: proxima });
      }
      this.touch();
    }

    // Sem nenhuma nave capaz de decolar, a incursão PARA. Sem isto, a frota em
    // terra continuaria rendendo — e o combustível seria uma barra decorativa
    // que não muda nada.
    return !podeDecolar(this.state);
  }

  /** A frota inteira está em terra? */
  get frotaEmTerra(): boolean {
    return !this.state.fleet.some((id) => podeDecolar(this.state, id));
  }

  /** Tanque da nave, de 0 a 1. */
  combustivelDe(hullId = this.state.hull): number {
    return combustivelDe(this.state, hullId);
  }

  /** Núcleos para encher esta nave agora. */
  custoParaEncher(hullId = this.state.hull): number {
    return custoParaEncher(this.state, hullId);
  }

  /**
   * Reabastece pagando. A recarga do hangar é grátis e lenta; isto é comprar
   * TEMPO, e por isso o preço cresce com o poder do casco.
   */
  reabastecer(hullId = this.state.hull): boolean {
    const custo = custoParaEncher(this.state, hullId);
    if (custo <= 0) return false;
    if (!this.spend('nucleo', custo)) return false;
    const nave = (this.state.naves[hullId] ??= { nivel: 1, xp: 0, equipped: {} });
    nave.combustivel = 1;
    this.touch();
    return true;
  }

  /** Quantas cargas deste serviço estão guardadas. */
  cargasDe(servico: string): number {
    return this.state.servicos[servico] ?? 0;
  }

  /**
   * Consome uma carga. Devolve `false` se não havia.
   *
   * Separado das funções de troca porque elas também são chamadas por teste e
   * por caminho administrativo, onde não há carga envolvida — e porque debitar
   * antes de saber se a troca deu certo perderia a carga num alvo inválido.
   */
  private gastarCarga(servico: string): boolean {
    const n = this.state.servicos[servico] ?? 0;
    if (n <= 0) return false;
    if (n === 1) delete this.state.servicos[servico];
    else this.state.servicos[servico] = n - 1;
    return true;
  }

  /** Aplica uma carga guardada a uma peça. */
  usarCargaNoItem(servico: string, uid: string, alvo: ElementId): boolean {
    if (this.cargasDe(servico) <= 0) return false;
    const item = this.state.inventory.find((i) => i.uid === uid);
    if (!item || (item.element ?? "padrao") === alvo) return false;
    if (!this.gastarCarga(servico)) return false;
    item.element = alvo;
    this.touch();
    return true;
  }

  /** Aplica uma carga guardada a uma nave. */
  usarCargaNaNave(servico: string, hullId: string, alvo: ElementId): boolean {
    if (this.cargasDe(servico) <= 0) return false;
    if (!this.state.fleet.includes(hullId)) return false;
    if (elementoDaNave(this.state, hullId) === alvo) return false;
    if (!this.gastarCarga(servico)) return false;
    const nave = (this.state.naves[hullId] ??= { nivel: 1, xp: 0, equipped: {} });
    nave.elemento = alvo;
    this.touch();
    return true;
  }

  /**
   * Troca o elemento de uma PEÇA. É o que impede a regra elemental de
   * transformar drop raro em lixo.
   *
   * Cobra em cristal e não em sucata de propósito: a conversão precisa doer o
   * suficiente para o jogador preferir a peça que já veio certa, senão o
   * elemento do drop deixaria de significar qualquer coisa.
   */
  trocarElementoDoItem(uid: string, alvo: ElementId, custo: number): boolean {
    const item = this.state.inventory.find((i) => i.uid === uid);
    if (!item) return false;
    if ((item.element ?? "padrao") === alvo) return false;
    if (!this.spend("cristal", custo)) return false;
    item.element = alvo;
    // Os afixos ficam. Eles foram rolados sob o elemento antigo, mas
    // re-rolá-los transformaria a conversão numa segunda loteria — e o
    // jogador pagaria para PIORAR a peça metade das vezes.
    this.touch();
    return true;
  }

  /**
   * Troca o elemento de uma NAVE.
   *
   * Não desequipa nada. As peças que deixaram de servir continuam montadas até
   * o jogador resolver o que fazer com elas — desmontar o conjunto sem avisar
   * seria a pior forma de descobrir a regra. `pecasIncompativeis` é quem a tela
   * consulta para mostrar o estrago antes de cobrar.
   */
  trocarElementoDaNave(hullId: string, alvo: ElementId, custo: number): boolean {
    if (!this.state.fleet.includes(hullId)) return false;
    if (elementoDaNave(this.state, hullId) === alvo) return false;
    if (!this.spend("cristal", custo)) return false;
    const nave = (this.state.naves[hullId] ??= { nivel: 1, xp: 0, equipped: {} });
    nave.elemento = alvo;
    this.touch();
    return true;
  }

  /** O elemento em que a nave está agora. */
  elementoDe(hullId = this.state.hull): ElementId {
    return elementoDaNave(this.state, hullId);
  }

  /**
   * Registra a escolha da primeira tela.
   *
   * Troca o casco ativo junto porque a nave do personagem É a escolha — deixar
   * o jogador escolher Sora e continuar voando o casco genérico seria escolher
   * no vazio. Não mexe em mais nada: o piloto não dá atributo, e o resto do
   * save nasceu válido sem ele.
   *
   * Idempotente e recusa id desconhecido, porque ela é chamada de uma tela e
   * telas erram.
   */
  escolherPiloto(id: string): boolean {
    if (this.state.piloto || !PILOTO_POR_ID.has(id)) return false;
    const casco = pilotoDe(id).casco;
    this.state.piloto = id;
    this.state.hull = casco;
    if (!this.state.fleet.includes(casco)) this.state.fleet.push(casco);
    this.state.naves[casco] ??= { nivel: 1, xp: 0, equipped: {} };
    this.touch();
    return true;
  }

  /**
   * O casco pode ser comprado? NÃO compra — só responde.
   *
   * Comprava, até a Fase 3c do Passo 9: debitava o cristal e empurrava o id em
   * `state.fleet`. Casco é PODER — cada um tem atributos-base próprios, e os
   * melhores custam caro —, então escrever o id no save entregava de graça o
   * que a loja cobra. Quem compra agora é `app/inventario.ts`, contra o
   * servidor, e o preço sai do livro-caixa.
   *
   * A verificação fica AQUI mesmo assim, e não é redundante: setor alcançado e
   * nível são o ritmo da progressão, e o servidor não pode conferi-los porque
   * é o cliente que os declara (ver Fase 5). O que o servidor confere é o que
   * ele sabe — que o casco existe, não é protótipo, não é de piloto, ainda não
   * é seu, e que há cristal. Os dois conjuntos são diferentes de propósito.
   */
  podeComprarCasco(id: string): boolean {
    const hull = HULLS.find((h) => h.id === id);
    if (!hull || hull.prototype || this.frotaDisponivel.includes(id)) return false;
    // Casco de personagem nunca é comprável — nem o seu, que você já tem, nem
    // o dos outros três. Comprar o dos outros esvaziaria a escolha da primeira
    // tela por dentro: bastaria juntar cristal para ter os quatro.
    if (hull.piloto) return false;
    if (this.alcanceLiberado < hull.requiresSector) return false;
    if (this.nivelLiberado < nivelExigido(hull.requiresSector)) return false;
    return this.can('cristal', hull.cost);
  }

  /**
   * Leva um casco para o campo. `false` = não está disponível.
   *
   * Era DUAS funções. `trocarCasco` validava contra `state.fleet` e
   * `selectHull` contra `frotaDisponivel` — a mesma pergunta com respostas
   * diferentes, e cada tela escolhia uma sem saber que existia outra.
   *
   * O custo apareceu quando a Anatomia passou a listar `frotaDisponivel`: ela
   * oferecia as 53 naves do modo de teste e chamava `trocarCasco`, que recusa
   * tudo fora de `state.fleet`. O botão de levar a campo não fazia nada, em
   * silêncio, para 51 delas.
   *
   * O guarda certo é `frotaDisponivel`, que é o único que enxerga o modo de
   * teste. Para a troca por falta de combustível não muda nada: a nave que
   * `proximaComCombustivel` devolve vem da frota comprada, que está contida
   * nele.
   */
  selectHull(id: string): boolean {
    if (!this.frotaDisponivel.includes(id)) return false;
    this.state.hull = id;
    this.touch();
    return true;
  }

  // ── offline ───────────────────────────────────────────────────────────────

  /**
   * Aplica o tempo em que o jogo esteve fechado.
   *
   * Roda a simulação abstrata em passos grandes (não em 1/60), com eficiência
   * reduzida. O laço é limitado por número de passos além do tempo, para que um
   * save de meses não congele o boot.
   */
  applyOffline(seconds: number): OfflineReport {
    const cap = this.offlineCap;
    const capped = seconds > cap;
    const total = Math.min(seconds, cap);

    const before = { ...this.state.resources };
    const beforeSector = this.state.run.sector;
    const beforeKills = this.state.stats.kills;
    const beforeChests = Object.values(this.state.chests).reduce((s, n) => s + n, 0);

    const STEP = 2;
    const steps = Math.min(Math.floor(total / STEP), 12000);
    const eff = OFFLINE_EFFICIENCY;

    for (let i = 0; i < steps; i++) {
      this.abstractTick(STEP * eff);
    }

    const gained = {} as Record<ResourceId, number>;
    for (const id of RESOURCE_IDS) gained[id] = this.state.resources[id] - before[id];
    const afterChests = Object.values(this.state.chests).reduce((s, n) => s + n, 0);

    this.touch();
    return {
      seconds: total,
      capped,
      gained,
      sectorsCleared: this.state.run.sector - beforeSector,
      kills: Math.floor(this.state.stats.kills - beforeKills),
      chests: afterChests - beforeChests,
    };
  }

  // ── persistência ──────────────────────────────────────────────────────────

  /** Chame todo quadro; grava no máximo a cada 10s. */
  tickSave(dt: number): void {
    this.state.playtime += dt;
    this.saveTimer += dt;
    if (this.saveTimer >= 10) {
      this.saveTimer = 0;
      this.save();
    }
  }

  save(): void {
    saveToStorage(this.state);
    bus.emit('save:written', { at: this.state.savedAt });
  }

  // ── utilidades para a UI ──────────────────────────────────────────────────

  get hull() {
    return getHull(this.state.hull);
  }

  get sectorProgress(): number {
    return clamp(1 - this.state.run.restam / Math.max(1, this.state.run.unidades), 0, 1);
  }
}

/**
 * Ordem de exibição das missões.
 *
 * Pronta primeiro: é a única situação em que o jogador tem algo a fazer, e
 * enterrá-la no meio de vinte ativas transformaria a recompensa em algo que se
 * esquece de resgatar.
 */
function ordemDaSituacao(s: SituacaoDeMissao): number {
  return s === 'pronta' ? 0 : s === 'ativa' ? 1 : 2;
}
