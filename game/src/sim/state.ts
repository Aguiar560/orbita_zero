import { POSTO_POR_CASCO } from '@data/balance/cascos';
import { HULLS } from '@data/hulls';
import { BIOMES } from '@data/biomes';
import { MISSAO_POR_ID } from '@data/missoes';
import type { GameState, NaveProgresso } from './types';
import { WAVES_PER_SECTOR } from './progression';
import { CARGA_INICIAL, CONCESSAO_POR_ID, CONCESSOES } from '@data/balance/capacidade';
import { RECURSO_POR_ID } from '@data/recursos';

export const SAVE_KEY = 'orbita-zero:save';
/**
 * v2 — 9 categorias de slot e a Matriz de Comando.
 * v3 — fim do prestígio: sem Éter, sem nós de ascensão, sem reset de universo.
 * v4 — controles manuais globais e preferências de acessibilidade persistentes.
 * v5 — missões rastreadas na tela principal.
  * v6 — escada de aquisição dos cascos: os 29 Spaceships 2.0 deixam de ser
 *      grátis, e a frota devolve os que o jogador ainda não podia ter.
 * v7 — equipamento POR NAVE: `equipped` sai do topo e vira `naves[id].equipped`.
 *
 * A migração nunca rejeita um save antigo; ela apara o que não existe mais.
 */
export const SAVE_VERSION = 7;

/**
 * Os cascos com que se começa: os que não custam nada e não exigem setor.
 *
 * A REGRA não mudou quando a escada de aquisição chegou, e é por isso que ela
 * está certa. Os 29 Spaceships 2.0 saíram da frota inicial sozinhos, ao ganharem
 * custo e `requiresSector` — nenhuma lista precisou ser mantida à mão, que é
 * exatamente o que uma lista à mão faria alguém esquecer.
 */
const INITIAL_FLEET = HULLS.filter(
  (hull) => !hull.prototype && hull.cost === 0 && hull.requiresSector === 0,
).map((hull) => hull.id);

export function createState(seed = (Math.random() * 0xffffffff) >>> 0): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playtime: 0,

    resources: { sucata: 0, nucleo: 0, cristal: 0 },
    lifetime: { sucata: 0, nucleo: 0, cristal: 0 },

    hull: HULLS[0]!.id,
    fleet: [...INITIAL_FLEET],
    inventory: [],
    cargaLiberada: [],
    armazem: {},

    shop: {},
    command: { nivel: 1, xp: 0, allocated: [], refunds: 3 },
    naves: {},

    run: {
      sector: 1, wave: 1, kind: 'onda', restam: 0, unidades: 0, elapsed: 0, cleared: 0,
      carga: { sucata: 0, nucleo: 0, cristal: 0 },
    },
    bar: { biome: BIOMES[0]!.id, distance: 0, kills: 0, cacheProgress: 0, patrol: 1, patrolXp: 0 },
    universe: { index: 0, seed, modifiers: [], bestSector: 1, bestSectorEver: 1 },

    chests: {},
    codex: [],
    missoes: {},
    eventos: {},
    medalhas: 0,
    confianca: {},
    provacao: {
      pisoMax: 0, vitorias: 0,
      primeiraConclusao: [], marcos: [], mestrados: [],
      registros: {},
      // Começa CHEIO: a primeira coisa que o jogador faz ao abrir o modo não
      // pode ser esperar.
      tentativas: 5, tentativasEm: now,
    },

    stats: { kills: 0, bossKills: 0, deaths: 0, itemsFound: 0, chestsOpened: 0 },

    settings: {
      pilot: 'equilibrado',
      controlMode: 'idle',
      testMode: false,
      speed: 1,
      repetirSetor: false,
      autoEquip: true,
      autoSalvage: 0,
      autoDispose: 'desmontar',
      showDamageNumbers: true,
      barVisible: true,
      reduceEffects: false,
      highContrast: false,
      pinnedMissions: [],
      anatomiaAberta: true,
      muted: false,
    },
  };
}

/**
 * Normaliza um save carregado.
 *
 * Preenche campos ausentes em vez de rejeitar o save: um jogador de idle perde
 * dias de progresso se uma atualização invalidar o arquivo, então o padrão é
 * sempre migrar. Só um save de versão FUTURA (arquivo mais novo que o código) é
 * recusado, porque aí não há como saber o que fazer.
 */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<GameState>;
  if (typeof data.version !== 'number' || data.version > SAVE_VERSION) return null;

  const fresh = createState(data.universe?.seed);
  const state: GameState = {
    ...fresh,
    ...data,
    version: SAVE_VERSION,
    resources: { ...fresh.resources, ...data.resources },
    lifetime: { ...fresh.lifetime, ...data.lifetime },
    run: { ...fresh.run, ...data.run },
    bar: { ...fresh.bar, ...data.bar },
    universe: { ...fresh.universe, ...data.universe },
    stats: { ...fresh.stats, ...data.stats },
    settings: { ...fresh.settings, ...data.settings },
    shop: { ...data.shop },
    command: { ...fresh.command, ...data.command },
    chests: { ...data.chests },
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    fleet: [...new Set([
      ...(Array.isArray(data.fleet) && data.fleet.length ? data.fleet : fresh.fleet),
      ...INITIAL_FLEET,
    ])],
    codex: Array.isArray(data.codex) ? data.codex : [],
    // Save anterior ao §27 não tem nem um nem outro. Ambos nascem vazios em vez
    // de travar o boot — a regra que não se negocia é "save malformado não
    // impede jogar".
    missoes: (data.missoes && typeof data.missoes === 'object') ? data.missoes as GameState['missoes'] : {},
    eventos: (data.eventos && typeof data.eventos === 'object') ? data.eventos as GameState['eventos'] : {},
    medalhas: Number.isFinite(data.medalhas) ? Number(data.medalhas) : 0,
    confianca: (data.confianca && typeof data.confianca === 'object') ? data.confianca as Record<string, number> : {},
    // Save anterior ao modo, ou de uma versão com menos campos: o espalhamento
    // preenche o que falta com o padrão seguro do §56, sem descartar o que há.
    provacao: {
      ...fresh.provacao,
      ...(data.provacao ?? {}),
      primeiraConclusao: Array.isArray(data.provacao?.primeiraConclusao) ? data.provacao.primeiraConclusao : [],
      marcos: Array.isArray(data.provacao?.marcos) ? data.provacao.marcos : [],
      mestrados: Array.isArray(data.provacao?.mestrados) ? data.provacao.mestrados : [],
      registros: (data.provacao?.registros && typeof data.provacao.registros === 'object')
        ? data.provacao.registros : {},
    },
  };

  if ((data.version ?? 0) < 2) {
    // Os slots de v1 não existem mais. Descartar é melhor que tentar traduzir:
    // um item mapeado errado ficaria com implícito e afixos de outra categoria.
    for (const nave of Object.values(state.naves)) nave.equipped = {};
    state.inventory = [];
    state.command = { nivel: 1, xp: 0, allocated: [], refunds: 3 };
  }

  if ((data.version ?? 0) < 3) {
    // O prestígio saiu. Quem estava num universo avançado volta ao único que
    // existe, mas mantém o recorde de setor — foi ele que o jogador conquistou.
    state.universe.index = 0;
    state.universe.modifiers = [];
    // Éter e os nós de Legado deixaram de existir; o campo some do save sozinho
    // porque `createState` não o declara mais.
  }

  // v4 não converte progresso: acrescenta apenas preferências seguras. Saves
  // anteriores entram no modo idle, que preserva exatamente o comportamento
  // que já tinham antes de WASD/setas existirem.
  if ((data.version ?? 0) < 4) state.settings.controlMode = 'idle';
  // Acompanhar missão é preferência de interface, sem qualquer efeito no
  // progresso; saves anteriores começam sem atalho para não poluir a tela.
  if ((data.version ?? 0) < 5) state.settings.pinnedMissions = [];

  // Save anterior à 3.7 guardava a capacidade como número solto. Converte para
  // concessões, dando as da loja primeiro: quem já tinha 70 espaços continua com
  // 70, e quem tinha menos recebe o equivalente mais próximo, sem perder nada.
  const antigo = (data as { inventorySize?: number }).inventorySize;
  if (typeof antigo === 'number' && !data.cargaLiberada) {
    state.cargaLiberada = [];
    let falta = antigo - CARGA_INICIAL;
    for (const c of CONCESSOES) {
      if (falta <= 0) break;
      state.cargaLiberada.push(c.id);
      falta -= c.itens ?? 0;
    }
  }
  state.cargaLiberada = (state.cargaLiberada ?? []).filter((id) => CONCESSAO_POR_ID.has(id));

  // Material que saiu do catálogo é descartado, não mantido como chave órfã: o
  // painel não saberia desenhá-lo e a capacidade contaria um tipo fantasma.
  state.armazem = Object.fromEntries(
    Object.entries(state.armazem ?? {}).filter(([id, n]) => RECURSO_POR_ID.has(id) && n > 0),
  );
  delete (state as unknown as Record<string, unknown>).inventorySize;
  // Hitboxes são dados administrativos versionados, nunca progresso do jogador.
  // Saves do protótipo podem carregar estas duas chaves antigas via `...data`.
  delete (state as unknown as Record<string, unknown>).hullHitboxes;
  delete (state as unknown as Record<string, unknown>).enemyHitboxes;

  // O sistema de Melhorias saiu (§31). Saves gravados antes disso ainda trazem
  // a chave, e o espalhamento de `...data` acima a repassaria adiante — ela
  // seria regravada para sempre, confundindo quem for inspecionar um save.
  delete (state as unknown as Record<string, unknown>).upgrades;

  // ── v7: o equipamento passa a ser de cada nave ───────────────────────────
  //
  // Antes havia um `equipped` só, no topo: trocar de casco levava o conjunto
  // junto, e a frota era troca de silhueta, não de configuração. O que estava
  // equipado no save antigo pertencia à nave em uso, então é para ela que vai —
  // qualquer outro destino inventaria uma decisão que o jogador não tomou.
  //
  // Roda antes dos consertos de integridade porque eles já esperam `naves`
  // normalizado.
  const naves = (state.naves ?? {}) as Record<string, Partial<NaveProgresso>>;
  const antigoEquipado = (data as { equipped?: NaveProgresso['equipped'] }).equipped;
  for (const [id, nave] of Object.entries(naves)) {
    if (!nave || typeof nave !== 'object') { delete naves[id]; continue; }
    nave.nivel = Math.max(1, Math.floor(Number(nave.nivel) || 1));
    nave.xp = Math.max(0, Number(nave.xp) || 0);
    nave.equipped ??= {};
  }
  if (antigoEquipado && typeof antigoEquipado === 'object') {
    const ativa = (naves[state.hull] ??= { nivel: 1, xp: 0, equipped: {} });
    // Só preenche slot vazio: se o save já for v7 e trouxer os dois campos, o
    // que está NA NAVE é o mais recente e não pode ser sobrescrito pelo resto.
    for (const [slot, item] of Object.entries(antigoEquipado)) {
      const chave = slot as keyof NaveProgresso['equipped'];
      if (item && !ativa.equipped![chave]) ativa.equipped![chave] = item;
    }
  }
  delete (state as unknown as Record<string, unknown>).equipped;
  state.naves = naves as GameState['naves'];

  // Consertos de integridade — um save adulterado não deve travar o boot.
  const hullIds = new Set(HULLS.map((hull) => hull.id));
  state.fleet = [...new Set(state.fleet.filter((id) => hullIds.has(id)))];

  // Devolve os cascos que o estado provisório dava de graça.
  //
  // Enquanto os Spaceships 2.0 eram arte em teste, os 29 entravam na frota de
  // TODO save, com custo 0 e `requiresSector` 0. Com a escada de aquisição eles
  // passam a ser comprados, e um save antigo continuaria carregando 29 naves
  // que ninguém pagou — algumas de faixa que o jogador ainda não alcançou.
  //
  // A regra remove só o que NÃO PODERIA ter sido adquirido: casco da escada
  // acima do maior setor já alcançado. Quem realmente chegou lá mantém a nave,
  // e ninguém perde compra legítima.
  const alcance = Math.max(state.universe.bestSector ?? 1, state.run.sector ?? 1);
  state.fleet = state.fleet.filter((id) => {
    const posto = POSTO_POR_CASCO.get(id);
    return !posto || posto.setor <= alcance;
  });

  for (const id of INITIAL_FLEET) if (!state.fleet.includes(id)) state.fleet.push(id);
  if (!state.fleet.includes(state.hull)) state.hull = state.fleet[0] ?? HULLS[0]!.id;
  state.command.nivel = Math.max(1, Math.floor(state.command.nivel));
  state.command.allocated = state.command.allocated.filter((id) => typeof id === 'string');
  state.run.sector = Math.max(1, Math.floor(state.run.sector));
  state.run.wave = Math.min(WAVES_PER_SECTOR + 1, Math.max(1, Math.floor(state.run.wave)));
  state.universe.bestSector = Math.max(state.universe.bestSector, state.run.sector);
  state.universe.bestSectorEver = Math.max(state.universe.bestSectorEver, state.universe.bestSector);
  if (state.settings.autoDispose !== 'desmontar' && state.settings.autoDispose !== 'vender') {
    state.settings.autoDispose = 'desmontar';
  }
  if (state.settings.controlMode !== 'manual' && state.settings.controlMode !== 'idle') state.settings.controlMode = 'idle';
  state.settings.pinnedMissions = [...new Set(
    (Array.isArray(state.settings.pinnedMissions) ? state.settings.pinnedMissions : [])
      .filter((id): id is string => typeof id === 'string' && MISSAO_POR_ID.has(id)),
  )].slice(0, 4);
  if (!['agressivo', 'equilibrado', 'evasivo', 'coletor'].includes(state.settings.pilot)) state.settings.pilot = 'equilibrado';
  for (const key of ['testMode', 'repetirSetor', 'autoEquip', 'showDamageNumbers', 'barVisible', 'reduceEffects', 'highContrast', 'muted'] as const) {
    state.settings[key] = Boolean(state.settings[key]);
  }
  for (const resource of ['sucata', 'nucleo', 'cristal'] as const) {
    state.resources[resource] = Math.max(0, Number.isFinite(state.resources[resource]) ? state.resources[resource] : 0);
    state.lifetime[resource] = Math.max(0, Number.isFinite(state.lifetime[resource]) ? state.lifetime[resource] : 0);
  }

  return state;
}

/**
 * Trava de gravação após um apagamento pedido pelo jogador.
 *
 * Sem ela, apagar o progresso não funcionava: `clearStorage()` removia a chave,
 * mas o `location.reload()` seguinte disparava `beforeunload`, que salvava o
 * estado ainda em memória de volta — com todos os itens. A trava vale para
 * TODOS os caminhos de gravação (autosave, saída da aba, descarregamento), que
 * é mais seguro do que tentar desarmar cada um deles.
 */
let wiped = false;

export function saveToStorage(state: GameState): void {
  if (wiped) return;
  state.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[save] falha ao gravar:', err);
  }
}

export function loadFromStorage(): { state: GameState; offlineSeconds: number } | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const state = migrate(JSON.parse(raw));
    if (!state) return null;
    const offlineSeconds = Math.max(0, (Date.now() - (state.savedAt || Date.now())) / 1000);
    return { state, offlineSeconds };
  } catch (err) {
    console.error('[save] save corrompido, começando do zero:', err);
    return null;
  }
}

/**
 * Apaga o save e impede qualquer gravação até a página recarregar.
 *
 * A trava é essencial: o próprio `location.reload()` que vem depois desta
 * chamada dispara os manipuladores de saída, e um deles salvaria tudo de volta.
 */
export function clearStorage(): void {
  wiped = true;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignora */
  }
}

/** Apenas para importar um save: reabilita a gravação. */
export function allowSaving(): void {
  wiped = false;
}

/** Exporta o save como texto base64, para backup manual. */
export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text: string): GameState | null {
  try {
    return migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
  } catch {
    return null;
  }
}
