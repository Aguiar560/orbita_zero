import { Rng, clamp } from '@core/math';
import { bus, toast } from '@app/Bus';
import { BIOMES, getBiome, unlockedBiomes } from '@data/biomes';
import { afinidadeDoAlvo, resolverDrop } from '@data/balance/drops';
import { CARGA_MAXIMA, CONCESSAO_POR_ID, capacidadeDeItens, capacidadeDeRecursos } from '@data/balance/capacidade';
import { RECURSO_POR_ID, recursoDoChefe, recursosDoPlaneta } from '@data/recursos';
import { ilvlDaFusao, receitaPara } from '@data/balance/fusao';
import { MISSAO_POR_ID, MISSOES, type FatoDeJogo, type MissaoDef } from '@data/missoes';
import { CONFIANCA_MAX, PERSONAGEM_POR_ID, PERSONAGENS, ROMANOS, contatoDoChefe, type PersonagemDef } from '@data/personagens';
import {
  aplicarFato, confiancaDe, contatoDesbloqueado, fracaoDe, progressoDe, situacaoDe,
  sinalDoContato, type SinalDeContato, type SituacaoDeMissao,
} from './missoes';
import { rarityInfo } from '@data/rarity';

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
const PILHA_MAX = 999_999_999;

import { galaxyOfSector } from '@data/galaxies';
import { CHEST_BY_ID, PATROL_CACHE_KILLS } from '@data/chests';
import { getHull, HULLS } from '@data/hulls';
import {
  RESOURCE_IDS,
  type ElementId, type GameState, type Item, type ResourceId, type Resources,
  type NivelProgresso, type SlotId, type Stats,
} from './types';
import { MAGNET_PER_LEVEL, REPAIR_PER_LEVEL, SHOP_BY_ID, shopCost } from '@data/shop';
import { NIVEL_MAX, curvaXpNave, curvaXpPatrulha, curvaXpPersonagem, nivelExigido } from '@data/balance/curvas';
import { cobrarMorte } from './morte';
import { activeElement, defenseElement, dps, resistance, resolveStats } from './stats';
import { buildEncounter, encounterLabel, WAVES_PER_SECTOR, type Encounter } from './progression';
import { dropChance, openChest, rollItem, salvageValue, scoreItem } from './loot';
import { createState, saveToStorage } from './state';
import {
  allocate, allocatePath, canAllocate, canDeallocate, deallocate,
  pointsAvailable, pointsSpent, respec, xpForLevel,
} from './tree';

/**
 * Fração das cápsulas que a nave REALMENTE alcança, no caminho abstrato.
 *
 * Ao vivo, o item cai como cápsula física e a IA precisa chegar nela antes que
 * escape pela base da tela — com o piloto cru do começo, boa parte se perde. O
 * caminho abstrato não tem cena, então essa perda precisa ser modelada, senão
 * jogar de janela fechada rende mais que jogar.
 *
 * 0,55 e não 1,0; e não é palpite de conveniência: é a ordem de grandeza que
 * põe o offline abaixo do ao vivo em itens, que é a relação que o §2 pede.
 */
const COLETA_ABSTRATA = 0.55;

/** Teto de progresso offline, em segundos (4h). */
const OFFLINE_BASE_CAP = 4 * 3600;
/** O offline rende menos que jogar ativamente — de propósito. */
const OFFLINE_EFFICIENCY = 0.6;

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
export class Sim {
  state: GameState;

  private statsCache: Stats | null = null;
  private encounterCache: Encounter | null = null;
  private readonly rng = new Rng();
  private saveTimer = 0;

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
    this.refreshEncounter();
  }

  // ── leitura ───────────────────────────────────────────────────────────────

  get stats(): Stats {
    return (this.statsCache ??= resolveStats(this.state));
  }

  get encounter(): Encounter {
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

  /** Rendimento de sucata por segundo da faixa horizontal. */
  get patrolScrapRate(): number {
    const biome = getBiome(this.state.bar.biome);
    const patrol = 1 + (this.state.bar.patrol - 1) * 0.28;
    return 2.4 * biome.bounty * patrol * (1 + this.stats.sucataGanho);
  }

  /** Abates por segundo da faixa horizontal. */
  get patrolKillRate(): number {
    return 0.9 + this.state.bar.patrol * 0.06;
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

  /** Quantos passos fixos o laço deve rodar por quadro. */
  get timeScale(): number {
    return this.testMode ? Math.max(1, Math.min(8, Math.round(this.state.settings.speed))) : 1;
  }

  /** Salta direto para um setor. Só existe para o modo de teste. */
  jumpSector(sector: number): void {
    this.state.run.sector = Math.max(1, Math.floor(sector));
    this.state.run.wave = 1;
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

  grant(resource: ResourceId, amount: number): void {
    if (!(amount > 0)) return;
    this.state.resources[resource] += amount;
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
    for (const m of prontas) toast(`Missão concluída: ${m.nome}`, 'epic');
    if (prontas.length) this.touch();
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

    progressoDe(this.state, def).entregue = true;
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

  /** No modo de teste tudo é pagável, sem alterar o saldo mostrado. */
  can(resource: ResourceId, amount: number): boolean {
    return this.testMode || this.state.resources[resource] >= amount;
  }

  spend(resource: ResourceId, amount: number): boolean {
    if (this.testMode) return true;
    if (!this.can(resource, amount)) return false;
    this.state.resources[resource] -= amount;
    bus.emit('resources:changed');
    return true;
  }

  // ── camada horizontal (patrulha) ──────────────────────────────────────────

  /**
   * Avança a patrulha. `dt` em segundos; `intensity` permite que o modo ao vivo
   * reporte um ritmo diferente do abstrato (a faixa visível mata mais rápido).
   */
  patrolTick(dt: number, intensity = 1): void {
    const bar = this.state.bar;
    const scrap = this.patrolScrapRate * dt * intensity;
    this.grant('sucata', scrap);

    bar.distance += 120 * dt * intensity;
    const kills = this.patrolKillRate * dt * intensity;
    bar.kills += kills;
    this.state.stats.kills += kills;

    bar.patrolXp += kills * 4 * (1 + this.stats.xpGanho);
    // A patrulha também alimenta a patente, mas devagar: a matriz é recompensa
    // de campanha, e a faixa não deve virar o caminho ótimo para pontos.
    this.grantXp(kills * 0.35 * (1 + this.state.universe.index * 0.5));
    const need = this.patrolXpNeeded();
    if (bar.patrolXp >= need) {
      bar.patrolXp -= need;
      bar.patrol++;
      toast(`Patrulha nível ${bar.patrol}`, 'good', 'ui/icon_star');
    }

    bar.cacheProgress += kills / PATROL_CACHE_KILLS;
    while (bar.cacheProgress >= 1) {
      bar.cacheProgress -= 1;
      this.grantChest('bronze', 1, 'patrulha');
    }

    // Bioma segue a distância acumulada: sempre o melhor liberado.
    // No modo de teste todos os biomas ficam visíveis, sem mexer na distância.
    const best = (this.testMode ? BIOMES : unlockedBiomes(bar.distance)).at(-1);
    if (best && best.id !== bar.biome) {
      bar.biome = best.id;
      toast(`Novo setor de patrulha: ${best.name}`, 'epic', 'powerup/icon_bounty');
    }
  }

  patrolXpNeeded(): number {
    return curvaXpPatrulha(this.state.bar.patrol);
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

  /** Recompensa de um abate individual dentro do encontro. */
  rewardKill(fraction: number): void {
    const e = this.encounter;
    const s = this.stats;
    this.grantCarga('nucleo', e.bounty * fraction * 0.34 * (1 + s.nucleoGanho));
    this.grantCarga('sucata', e.bounty * fraction * 1.6 * (1 + s.sucataGanho));
    // XP por abate não usa `fraction`: a fatia de um inimigo numa onda de 20 é
    // pequena demais para render patente, e a patente deve premiar tempo de
    // combate, não o tamanho do alvo.
    this.grantXp(2 + e.bounty * 0.25);
    this.state.stats.kills++;
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
   * `abstract` indica que não houve cena — nesse caso o loot é entregue direto,
   * já que não existiram cápsulas para a nave coletar. Sem isso, jogar com a
   * aba fechada nunca renderia equipamento.
   */
  completeEncounter(abstract = false): void {
    const e = this.encounter;
    const s = this.stats;
    const run = this.state.run;

    this.grantCarga('sucata', e.bounty * 4 * (1 + s.sucataGanho));
    this.grantCarga('nucleo', e.bounty * 0.8 * (1 + s.nucleoGanho));
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

    if (abstract) {
      // Compensa as cápsulas que a simulação abstrata não materializa: uma
      // amostra do que a onda teria soltado, com a mesma tabela.
      for (const item of this.rollDrops(e.kind === 'chefe' ? 'chefe' : e.kind === 'elite' ? 'elite' : 'onda')) {
        this.acquire(item);
      }

      /**
       * Uma rolagem por inimigo REAL, e não por vida do encontro.
       *
       * Era `hpPool / bounty`, resquício de quando o progresso era medido em
       * dano: dava até 40 rolagens numa onda de doze inimigos. Somado a não
       * modelar cápsula perdida, o caminho abstrato entregava 1.822 itens em
       * duas horas contra 44 do jogo ao vivo — 41×. Fechar o jogo era
       * estritamente melhor que jogá-lo, o oposto do pretendido.
       */
      const coletados = Math.round(e.unidades * COLETA_ABSTRATA);
      for (let i = 0; i < coletados; i++) {
        for (const item of this.rollDrops('onda')) this.acquire(item);
      }
    }

    bus.emit('wave:cleared', { wave: run.wave, ofWaves: WAVES_PER_SECTOR + 1 });

    if (run.wave > WAVES_PER_SECTOR) {
      // O setor caiu: só agora a carga da incursão vira saldo.
      this.bankCarga();
      // Cada planeta solta os SEUS três recursos (§10). Entram ao fechar o
      // setor, no mesmo momento em que a carga é depositada: recurso de planeta
      // é o pagamento por ter limpado o lugar, não por ter matado um inimigo.
      for (const r of recursosDoPlaneta(run.sector)) {
        this.guardarMaterial(r.id, 3 + Math.floor(this.stats.sorte * 2));
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
    // Renasce inteiro: morrer já custa XP, nível, ponto de Matriz e carga, e a
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
    // Converte dano por segundo em ABATES por segundo, para o caminho abstrato
    // medir a mesma coisa que a cena mede. Sem isso os dois divergiriam: um
    // contaria dano e o outro naves destruídas.
    run.restam = Math.max(0, run.restam - (dps(this.stats) / Math.max(1, this.unitHpMedio)) * dt);
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
    const ganho = amount * (1 + this.stats.xpGanho);

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
  get naveAtiva(): NivelProgresso {
    const naves = this.state.naves;
    return (naves[this.state.hull] ??= { nivel: 1, xp: 0 });
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

    for (let i = 0; i < total; i++) out.push(rollItem(this.rng, ilvl, luck, this.state.universe.index, opts));
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
    return this.testMode ? CARGA_MAXIMA : capacidadeDeRecursos(this.state.cargaLiberada);
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

  /**
   * Funde itens (§26). Devolve o item gerado, ou `null` se a receita nem podia
   * rodar — que é recusa, não fracasso.
   *
   * SEMPRE sai um item: ou da raridade superior, ou da mesma que entrou. O peso
   * da decisão está na razão dez para um, não num desfecho vazio. A versão
   * anterior tinha perda seca, e no topo ela era o resultado provável: 93% das
   * vezes dez Lendários viravam nada, o que fazia do último degrau uma parede.
   */
  fundirItens(uids: readonly string[]): { item: Item; receita: string } | null {
    if (this.faltaParaFundir(uids).length) return null;

    const itens = uids.map((u) => this.state.inventory.find((i) => i.uid === u)!);
    const receita = receitaPara(itens[0]!.rarity)!;

    // Cobra ANTES de sortear: o custo é da tentativa, não do sucesso.
    this.spend('nucleo', receita.nucleos);
    for (const [id, n] of Object.entries(receita.custo)) this.gastarMaterial(id, n);
    this.state.inventory = this.state.inventory.filter((i) => !uids.includes(i.uid));

    const saida = this.rng.weighted(receita.resultados, (r) => r.peso).raridade;
    const item = rollItem(
      this.rng,
      ilvlDaFusao(itens.map((i) => i.ilvl)),
      this.stats.sorte,
      this.state.universe.index,
      // `exata` e não `floor`: a receita JÁ sorteou a raridade, e usá-la como
      // piso deixava o sorteio natural subir por cima dela.
      { exata: saida },
    );
    this.acquire(item);
    this.registrar({
      tipo: 'fusao', entrada: receita.entrada, saida,
      subiu: saida > receita.entrada,
    });
    toast(`${receita.nome}: ${rarityInfo(item.rarity).name}!`);
    this.touch();
    return { item, receita: receita.id };
  }

  /** Entrada única de itens novos: aplica auto-desmanche e auto-equipar. */
  acquire(item: Item): void {
    this.state.stats.itemsFound++;
    // Antes de qualquer automacao: o item foi OBTIDO mesmo que o auto-desmanche
    // o desfaca no passo seguinte, e a missao de coleta conta o que caiu.
    this.registrar({ tipo: 'item', raridade: item.rarity, slot: item.slot, elemento: item.element ?? 'padrao' });

    if (this.state.settings.autoEquip && scoreItem(this.state, item) > 0) {
      const previous = this.state.equipped[item.slot];
      this.state.equipped[item.slot] = item;
      this.touch();
      if (previous) this.stash(previous);
      bus.emit('loot:dropped', { item });
      return;
    }

    if (item.rarity < this.state.settings.autoSalvage) {
      this.grant('nucleo', salvageValue(item));
      return;
    }

    this.stash(item);
    bus.emit('loot:dropped', { item });
  }

  private stash(item: Item): void {
    if (this.state.inventory.length >= this.cargoSlots) {
      // Bagagem cheia: desmancha o pior item não-favorito para abrir espaço.
      const worst = this.state.inventory
        .filter((i) => !i.favorite)
        .sort((a, b) => a.rarity - b.rarity || a.ilvl - b.ilvl)[0];
      if (!worst || worst.rarity > item.rarity) {
        this.grant('nucleo', salvageValue(item));
        return;
      }
      this.salvage(worst.uid);
    }
    this.state.inventory.push(item);
  }

  equip(uid: string): void {
    const idx = this.state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return;
    const item = this.state.inventory[idx]!;
    const previous = this.state.equipped[item.slot];
    this.state.inventory.splice(idx, 1);
    this.state.equipped[item.slot] = item;
    if (previous) this.state.inventory.push(previous);
    this.touch();
  }

  unequip(slot: SlotId): void {
    const item = this.state.equipped[slot];
    if (!item) return;
    delete this.state.equipped[slot];
    this.stash(item);
    this.touch();
  }

  salvage(uid: string): void {
    const idx = this.state.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return;
    const [item] = this.state.inventory.splice(idx, 1);
    if (item) {
      this.grant('nucleo', salvageValue(item));
      this.materialDeDesmanche(item);
    }
  }

  /**
   * Desmanchar rende MATERIAL, não só moeda (§29).
   *
   * É o que liga o inventário apertado ao craft: uma peça que não serve deixa
   * de ser lixo e vira insumo. Sem isto, o Armazém só encheria com o que cai
   * pronto, e desmanchar continuaria sendo apenas "converter em núcleo".
   */
  private materialDeDesmanche(item: Item): void {
    // A quantidade acompanha nível e raridade — desmanchar um Divino de nível
    // alto tem de valer mais que dez Comuns de nível baixo.
    const base = Math.max(1, Math.round(item.ilvl * 0.4 * (1 + item.rarity * 0.5)));
    this.guardarMaterial('ferrita', base);
    if (item.rarity >= 2) this.guardarMaterial('titanio', Math.max(1, Math.round(base * 0.25)));
    if (item.rarity >= 4) this.guardarMaterial('iridio', Math.max(1, Math.round(base * 0.08)));
  }

  /** Desmancha tudo abaixo de uma raridade, exceto favoritos. Devolve o total. */
  salvageBelow(rarity: number): number {
    const keep: Item[] = [];
    let gained = 0;
    for (const item of this.state.inventory) {
      if (item.favorite || item.rarity >= rarity) keep.push(item);
      else gained += salvageValue(item);
    }
    this.state.inventory = keep;
    this.grant('nucleo', gained);
    return gained;
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
    const items = openChest(this.rng, tier, this.encounter.ilvl, this.stats.sorte, this.state.universe.index);

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

  shopOwned(id: string): number {
    return this.state.shop[id] ?? 0;
  }

  /** Espaços de carga: base do save + o que a loja adicionou. */
  get cargoSlots(): number {
    // A capacidade vem das CONCESSÕES obtidas (§28), não de um número no save.
    // O jogador começa com 15 — grade 5 × 3 — e cresce até 70 por loja, chefe e
    // universo; missões e conquistas entram quando existirem, sem tocar aqui.
    return this.testMode ? CARGA_MAXIMA : capacidadeDeItens(this.state.cargaLiberada);
  }

  /** Multiplicador do raio do ímã de coleta. */
  get magnetRange(): number {
    return 1 + this.shopOwned('ima') * MAGNET_PER_LEVEL;
  }

  /** Fração do casco recuperada ao limpar uma onda. */
  get repairPerWave(): number {
    return this.shopOwned('reparo') * REPAIR_PER_LEVEL;
  }

  buyShopItem(id: string): boolean {
    const def = SHOP_BY_ID.get(id);
    if (!def) return false;

    const owned = this.shopOwned(id);
    if (def.max > 0 && owned >= def.max) return false;
    if (this.alcanceLiberado < (def.requiresSector ?? 0)) return false;
    // Requisito de NÍVEL além do de setor (§17). Ver `nivelExigido`: quem
    // chegou jogando passa com folga; quem pulou, não.
    if (this.nivelLiberado < nivelExigido(def.requiresSector ?? 0)) return false;
    if (!this.spend(def.currency, shopCost(def, def.kind === 'consumivel' ? 0 : owned))) return false;

    // Consumíveis não acumulam nível: entregam o efeito e pronto.
    if (def.kind === 'permanente') this.state.shop[id] = owned + 1;

    switch (def.effect) {
      case 'bau_bronze': this.grantChest('bronze', 1, 'loja'); break;
      case 'bau_prata': this.grantChest('prata', 1, 'loja'); break;
      case 'bau_ouro': this.grantChest('ouro', 1, 'loja'); break;
      case 'bau_singularidade': this.grantChest('singularidade', 1, 'loja'); break;
      case 'refaz': respec(this.state); break;
      default: break;
    }

    this.touch();
    return true;
  }

  // ── frota ─────────────────────────────────────────────────────────────────

  buyHull(id: string): boolean {
    const hull = HULLS.find((h) => h.id === id);
    if (!hull || this.frotaDisponivel.includes(id)) return false;
    if (this.alcanceLiberado < hull.requiresSector) return false;
    if (this.nivelLiberado < nivelExigido(hull.requiresSector)) return false;
    if (!this.spend('cristal', hull.cost)) return false;
    this.state.fleet.push(id);
    this.touch();
    toast(`${hull.name} adicionada ao hangar`, 'epic', hull.sprite);
    return true;
  }

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
      this.patrolTick(STEP * eff);
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
