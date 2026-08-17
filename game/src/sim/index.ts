import { Rng, clamp } from '@core/math';
import { bus, toast } from '@app/Bus';
import { getBiome, unlockedBiomes } from '@data/biomes';
import { CHEST_BY_ID, PATROL_CACHE_KILLS } from '@data/chests';
import { getHull, HULLS } from '@data/hulls';
import { RESOURCE_IDS, type ElementId, type GameState, type Item, type ResourceId, type SlotId, type Stats } from './types';
import { CARGO_PER_LEVEL, MAGNET_PER_LEVEL, REPAIR_PER_LEVEL, SHOP_BY_ID, shopCost } from '@data/shop';
import { curvaXpPatrulha } from '@data/balance/curvas';
import { activeElement, defenseElement, dps, resistance, resolveStats } from './stats';
import { buildEncounter, encounterLabel, WAVES_PER_SECTOR, type Encounter } from './progression';
import { dropChance, openChest, rollItem, salvageValue, scoreItem } from './loot';
import { createState, saveToStorage } from './state';
import {
  allocate, allocatePath, canAllocate, canDeallocate, deallocate,
  pointsAvailable, pointsSpent, respec, xpForLevel,
} from './tree';

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
    if (on) {
      // Desbloqueia o hangar inteiro para o conteúdo ficar inspecionável.
      for (const hull of HULLS) if (!this.state.fleet.includes(hull.id)) this.state.fleet.push(hull.id);
    } else {
      this.state.settings.speed = 1;
    }
    this.touch();
  }

  // ── recursos ──────────────────────────────────────────────────────────────

  grant(resource: ResourceId, amount: number): void {
    if (!(amount > 0)) return;
    this.state.resources[resource] += amount;
    this.state.lifetime[resource] += amount;
    bus.emit('resources:changed');
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
    const best = unlockedBiomes(bar.distance).at(-1);
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
    this.grant('nucleo', e.bounty * fraction * 0.34 * (1 + s.nucleoGanho));
    this.grant('sucata', e.bounty * fraction * 1.6 * (1 + s.sucataGanho));
    // XP por abate não usa `fraction`: a fatia de um inimigo numa onda de 20 é
    // pequena demais para render patente, e a patente deve premiar tempo de
    // combate, não o tamanho do alvo.
    this.grantXp(2 + e.bounty * 0.25);
    this.state.stats.kills++;
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

    this.grant('sucata', e.bounty * 4 * (1 + s.sucataGanho));
    this.grant('nucleo', e.bounty * 0.8 * (1 + s.nucleoGanho));
    this.grantXp(e.bounty * (e.kind === 'chefe' ? 12 : e.kind === 'elite' ? 5 : 2));

    if (e.kind === 'chefe' && e.boss) {
      this.grant('cristal', Math.max(1, Math.floor(e.bounty * 0.02)));
      this.state.stats.bossKills++;
      const first = !this.state.codex.includes(e.boss.id);
      if (first) {
        this.state.codex.push(e.boss.id);
        for (const g of e.boss.firstKill) this.grantChest(g.tier, g.count, `${e.boss.name} (primeira vitória)`);
      } else {
        this.grantChest('prata', 1, e.boss.name);
      }
      bus.emit('boss:defeated', { id: e.boss.id, name: e.boss.name, sector: e.sector });
    }

    if (abstract) {
      // Compensa as cápsulas que a simulação abstrata não materializa: uma
      // amostra do que a onda teria soltado, com a mesma tabela.
      for (const item of this.rollDrops(e.kind === 'chefe' ? 'chefe' : e.kind === 'elite' ? 'elite' : 'onda')) {
        this.acquire(item);
      }
      const kills = Math.max(3, Math.round(e.hpPool / Math.max(1, e.bounty)));
      for (let i = 0; i < Math.min(kills, 40); i++) {
        for (const item of this.rollDrops('onda')) this.acquire(item);
      }
    }

    bus.emit('wave:cleared', { wave: run.wave, ofWaves: WAVES_PER_SECTOR + 1 });

    if (run.wave > WAVES_PER_SECTOR) {
      run.sector++;
      run.wave = 1;
      run.cleared++;
      this.state.universe.bestSector = Math.max(this.state.universe.bestSector, run.sector);
      this.state.universe.bestSectorEver = Math.max(this.state.universe.bestSectorEver, this.state.universe.bestSector);
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
  failEncounter(): void {
    const run = this.state.run;
    this.state.stats.deaths++;
    bus.emit('sector:failed', { sector: run.sector });
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

    if (run.restam <= 0) {
      this.completeEncounter(true);
      return;
    }
    if (run.elapsed > this.survivalWindow) this.failEncounter();
  }

  // ── patente de comando e matriz de passivas ───────────────────────────────

  /**
   * Concede XP de comando. Cada patente vale um ponto na matriz — é o único
   * eixo de poder que o jogador distribui à mão, então precisa vir de jogar e
   * não de gastar recurso.
   */
  grantXp(amount: number): void {
    if (!(amount > 0)) return;
    const cmd = this.state.command;
    cmd.xp += amount * (1 + this.stats.xpGanho);

    let leveled = 0;
    // O laço tem teto: um relatório offline generoso não deve subir 400 níveis
    // de uma vez e enfileirar 400 toasts.
    while (cmd.xp >= xpForLevel(cmd.level) && leveled < 200) {
      cmd.xp -= xpForLevel(cmd.level);
      cmd.level++;
      leveled++;
    }
    if (leveled > 0) {
      toast(`Patente ${cmd.level} · +${leveled} ponto${leveled > 1 ? 's' : ''} de matriz`, 'epic', 'node/exp');
      this.touch();
    }
  }

  get xpProgress(): number {
    return clamp(this.state.command.xp / xpForLevel(this.state.command.level), 0, 1);
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
  rollDrops(kind: 'onda' | 'elite' | 'chefe'): Item[] {
    const e = this.encounter;
    const luck = this.stats.sorte;
    const out: Item[] = [];

    if (kind === 'chefe') {
      const bonus = 2 + Math.floor(luck * 2);
      for (let i = 0; i < bonus; i++) out.push(rollItem(this.rng, e.ilvl + 4, luck, this.state.universe.index));
      return out;
    }
    if (this.rng.chance(dropChance(kind, luck))) {
      out.push(rollItem(this.rng, kind === 'elite' ? e.ilvl + 2 : e.ilvl, luck, this.state.universe.index));
    }
    return out;
  }

  /** Entrada única de itens novos: aplica auto-desmanche e auto-equipar. */
  acquire(item: Item): void {
    this.state.stats.itemsFound++;

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
    if (item) this.grant('nucleo', salvageValue(item));
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
    return this.state.inventorySize + this.shopOwned('carga') * CARGO_PER_LEVEL;
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
    if (this.state.universe.bestSectorEver < (def.requiresSector ?? 0)) return false;
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
    if (!hull || this.state.fleet.includes(id)) return false;
    if (this.state.universe.bestSectorEver < hull.requiresSector) return false;
    if (!this.spend('cristal', hull.cost)) return false;
    this.state.fleet.push(id);
    this.touch();
    toast(`${hull.name} adicionada ao hangar`, 'epic', hull.sprite);
    return true;
  }

  selectHull(id: string): boolean {
    if (!this.state.fleet.includes(id)) return false;
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
