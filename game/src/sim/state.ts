import { POSTO_POR_CASCO } from '@data/balance/cascos';
import { HULLS } from '@data/hulls';
import { PILOTO_PADRAO, PILOTO_POR_ID, pilotoDe } from '@data/pilotos';
import { frotaSa, itemUtilizavel, numeroSao, recursosSaos } from './sanear';
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
export const SAVE_VERSION = 10;

/**
 * Os cascos com que se começa: os que não custam nada e não exigem setor.
 *
 * A REGRA não mudou quando a escada de aquisição chegou, e é por isso que ela
 * está certa. Os 29 Spaceships 2.0 saíram da frota inicial sozinhos, ao ganharem
 * custo e `requiresSector` — nenhuma lista precisou ser mantida à mão, que é
 * exatamente o que uma lista à mão faria alguém esquecer.
 */
const INITIAL_FLEET = HULLS.filter(
  // `!hull.piloto` é o que segura a escolha da primeira tela em pé. Os quatro
  // cascos de personagem também têm custo 0 e setor 0, então sem este filtro
  // eles cairiam TODOS aqui e o jogador começaria com os quatro — escolher
  // deixaria de significar alguma coisa.
  (hull) => !hull.prototype && !hull.piloto && hull.cost === 0 && hull.requiresSector === 0,
).map((hull) => hull.id);

export function createState(
  seed = (Math.random() * 0xffffffff) >>> 0,
  // Vazio é "ainda não escolheu" — é o que faz a tela de escolha aparecer no
  // primeiro boot. Não usa `PILOTO_PADRAO` como valor inicial de propósito:
  // com um padrão válido não haveria como distinguir quem escolheu o
  // equilibrado de quem nunca viu a tela.
  piloto = '',
): GameState {
  const now = Date.now();
  // Sem escolha feita não há casco de personagem NENHUM — nem o do padrão. O
  // estado precisa de uma nave válida para o palco desenhar atrás da tela de
  // escolha, e essa nave é a genérica. Entregar a do padrão aqui deixaria a
  // nave de outro personagem no hangar de quem escolhesse qualquer outro.
  const casco = piloto ? pilotoDe(piloto).casco : HULLS[0]!.id;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playtime: 0,

    resources: { sucata: 0, nucleo: 0, cristal: 0 },
    lifetime: { sucata: 0, nucleo: 0, cristal: 0 },

    piloto,
    // A nave do personagem entra ATIVA, não guardada: ela é a melhor coisa que
    // o jogador tem na partida (1,15× o casco genérico), e fazê-lo trocar de
    // casco no primeiro minuto para usar o que acabou de escolher seria um
    // passo administrativo entre a escolha e o jogo.
    hull: casco,
    // `frotaSa` descarta id de casco que não existe no catálogo — save antigo
    // com nave removida, ou save de fora inventando ids.
    fleet: [...new Set([casco, ...INITIAL_FLEET])],
    inventory: [],
    cargaLiberada: [],
    armazem: {},

    shop: {},
    servicos: {},
    command: { nivel: 1, xp: 0, allocated: [], refunds: 3 },
    naves: {},

    run: {
      sector: 1, wave: 1, kind: 'onda', restam: 0, unidades: 0, elapsed: 0, cleared: 0,
      carga: { sucata: 0, nucleo: 0, cristal: 0 },
    },
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
      pilot: 'agressivo',
      controlMode: 'idle',
      testMode: false,
      guiaVisto: false,
      speed: 1,
      repetirSetor: false,
      autoEquip: true,
      autoSalvage: 0,
      autoDispose: 'desmontar',
      showDamageNumbers: true,

      reduceEffects: false,
      mostrarEscudo: true,
      tremorDeTela: true,
      volumeMestre: 0.8,
      volumeMusica: 0.6,
      volumeEfeitos: 0.8,
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

  // O piloto do save vem ANTES de montar o estado fresco: é ele que decide o
  // casco de partida, e um `createState` sem ele daria a nave do padrão para
  // todo mundo na hora de preencher o que falta.
  //
  // AUSENTE e VAZIO são casos diferentes, e confundi-los escolhia pelo jogador.
  // Save sem o campo é de antes da tela existir: quem já jogou não pode ser
  // parado agora para escolher, então recebe o padrão. Campo vazio é save NOVO
  // cuja escolha não foi concluída — fechar a aba com a tela aberta grava isso,
  // porque `pagehide` salva. Promovê-lo ao padrão fazia a tela nunca mais
  // aparecer, e o jogador voltava já sendo alguém que não escolheu ser.
  const piloto = data.piloto === undefined
    ? PILOTO_PADRAO
    : (typeof data.piloto === 'string' && PILOTO_POR_ID.has(data.piloto) ? data.piloto : '');
  const fresh = createState(data.universe?.seed, piloto);
  const state: GameState = {
    ...fresh,
    ...data,
    version: SAVE_VERSION,
    piloto,
    // Recursos passam por `numeroSao`: `Infinity`, `NaN` e negativo entram
    // por save editado e por save de fora, e qualquer um dos três contamina
    // toda conta que os toque depois.
    resources: recursosSaos({ ...fresh.resources, ...data.resources }),
    lifetime: recursosSaos({ ...fresh.lifetime, ...data.lifetime }),
    run: { ...fresh.run, ...data.run },
    universe: { ...fresh.universe, ...data.universe },
    stats: { ...fresh.stats, ...data.stats },
    settings: { ...fresh.settings, ...data.settings },
    shop: { ...data.shop },
    servicos: { ...data.servicos },
    command: { ...fresh.command, ...data.command },
    chests: { ...data.chests },
    // Cada peça é conferida, não só o array. Uma peça com slot inexistente
    // derruba o painel de anatomia; uma com `ilvl` NaN faz o cálculo de
    // atributos virar NaN e a barra de vida parar de desenhar. Ver
    // `sim/sanear.ts` para o que é conferido e o que deliberadamente não é.
    inventory: Array.isArray(data.inventory) ? data.inventory.filter(itemUtilizavel) : [],
    // O casco do piloto entra junto: save de antes da escolha não tem nenhum
    // dos quatro, e sem isto o jogador migrado ficaria com um `piloto` que não
    // corresponde a nave nenhuma na frota.
    fleet: [...new Set([
      ...(frotaSa(data.fleet).length ? frotaSa(data.fleet) : fresh.fleet),
      ...INITIAL_FLEET,
      // Só quando há escolha feita: sem isto, um save inacabado ganharia o
      // casco do padrão na frota e o jogador terminaria a escolha com a nave
      // de outro personagem no hangar.
      ...(piloto ? [pilotoDe(piloto).casco] : []),
    ])],
    codex: Array.isArray(data.codex) ? data.codex : [],
    // Save anterior ao §27 não tem nem um nem outro. Ambos nascem vazios em vez
    // de travar o boot — a regra que não se negocia é "save malformado não
    // impede jogar".
    missoes: (data.missoes && typeof data.missoes === 'object') ? data.missoes as GameState['missoes'] : {},
    eventos: (data.eventos && typeof data.eventos === 'object') ? data.eventos as GameState['eventos'] : {},
    medalhas: numeroSao(data.medalhas),
    contaminado: data.contaminado === true,
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
  // Save com a postura removida cai no EVASIVO, e não no padrão de save novo.
  //
  // São decisões diferentes de propósito. Save novo nasce agressivo porque é
  // o que um jogador espera de um jogo de nave e porque o começo aguenta
  // (medido: 83% de vida no fim do setor 1). Mas quem já jogava com o
  // equilibrado não pediu para mudar de postura, e pode estar com a aba
  // fechada agora — uma migração silenciosa não pode aumentar o risco de
  // alguém que não está olhando. Perder progresso porque o jogo mudou por
  // baixo é pior do que voar conservador até ele reparar e escolher.
  if (!['agressivo', 'evasivo', 'coletor'].includes(state.settings.pilot)) state.settings.pilot = 'evasivo';
  for (const key of ['testMode', 'guiaVisto', 'repetirSetor', 'autoEquip', 'showDamageNumbers', 'reduceEffects', 'highContrast', 'muted', 'mostrarEscudo', 'tremorDeTela'] as const) {
    state.settings[key] = Boolean(state.settings[key]);
  }
  // Volume fora de 0..1 não é só feio: quando o áudio existir, um multiplicador
  // negativo ou acima de 1 vira estouro de amplitude. Sanear na carga é mais
  // barato que descobrir isso com alto-falante.
  for (const key of ['volumeMestre', 'volumeMusica', 'volumeEfeitos'] as const) {
    const v = Number(state.settings[key]);
    state.settings[key] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
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

/**
 * Importa um save de texto.
 *
 * Passa pelo mesmo `migrate` do save local, então herda todo o saneamento —
 * essa é a razão de não haver validação própria aqui: duas peneiras para a
 * mesma coisa divergem, e a de fora seria a que envelhece.
 *
 * O que ele acrescenta é a MARCA. Um save que veio de fora não pode ser
 * apresentado a um servidor como progresso jogado, e quem importa sabe disso
 * — o que não dá para saber é depois, olhando o estado.
 */
export function importSave(text: string): GameState | null {
  try {
    const state = migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
    if (state) state.contaminado = true;
    return state;
  } catch {
    return null;
  }
}
