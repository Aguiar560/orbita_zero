import { HULLS } from '@data/hulls';
import { BIOMES } from '@data/biomes';
import type { GameState } from './types';
import { WAVES_PER_SECTOR } from './progression';
import { CARGA_INICIAL, CONCESSAO_POR_ID, CONCESSOES } from '@data/balance/capacidade';
import { RECURSO_POR_ID } from '@data/recursos';

export const SAVE_KEY = 'orbita-zero:save';
/**
 * v2 — 9 categorias de slot e a Matriz de Comando.
 * v3 — fim do prestígio: sem Éter, sem nós de ascensão, sem reset de universo.
 *
 * A migração nunca rejeita um save antigo; ela apara o que não existe mais.
 */
export const SAVE_VERSION = 3;

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
    fleet: [HULLS[0]!.id],

    equipped: {},
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
    medalhas: 0,

    stats: { kills: 0, bossKills: 0, deaths: 0, itemsFound: 0, chestsOpened: 0 },

    settings: {
      pilot: 'equilibrado',
      testMode: false,
      speed: 1,
      repetirSetor: false,
      autoEquip: true,
      autoSalvage: 0,
      showDamageNumbers: true,
      barVisible: true,
      reduceEffects: false,
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
    equipped: { ...data.equipped },
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    fleet: Array.isArray(data.fleet) && data.fleet.length ? data.fleet : fresh.fleet,
    codex: Array.isArray(data.codex) ? data.codex : [],
    // Save anterior ao §27 não tem nem um nem outro. Ambos nascem vazios em vez
    // de travar o boot — a regra que não se negocia é "save malformado não
    // impede jogar".
    missoes: (data.missoes && typeof data.missoes === 'object') ? data.missoes as GameState['missoes'] : {},
    medalhas: Number.isFinite(data.medalhas) ? Number(data.medalhas) : 0,
  };

  if ((data.version ?? 0) < 2) {
    // Os slots de v1 não existem mais. Descartar é melhor que tentar traduzir:
    // um item mapeado errado ficaria com implícito e afixos de outra categoria.
    state.equipped = {};
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

  // O sistema de Melhorias saiu (§31). Saves gravados antes disso ainda trazem
  // a chave, e o espalhamento de `...data` acima a repassaria adiante — ela
  // seria regravada para sempre, confundindo quem for inspecionar um save.
  delete (state as unknown as Record<string, unknown>).upgrades;

  // Consertos de integridade — um save adulterado não deve travar o boot.
  if (!state.fleet.includes(state.hull)) state.hull = state.fleet[0] ?? HULLS[0]!.id;
  state.command.nivel = Math.max(1, Math.floor(state.command.nivel));
  state.command.allocated = state.command.allocated.filter((id) => typeof id === 'string');
  state.run.sector = Math.max(1, Math.floor(state.run.sector));
  state.run.wave = Math.min(WAVES_PER_SECTOR + 1, Math.max(1, Math.floor(state.run.wave)));
  state.universe.bestSector = Math.max(state.universe.bestSector, state.run.sector);
  state.universe.bestSectorEver = Math.max(state.universe.bestSectorEver, state.universe.bestSector);

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
