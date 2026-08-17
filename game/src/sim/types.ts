// ── Recursos ────────────────────────────────────────────────────────────────

/**
 * `sucata`  — moeda de farm, corre sozinha com a patrulha. Paga melhorias comuns.
 * `nucleo`  — sai de abates. Paga melhorias avançadas e desmanche.
 * `cristal` — sai de chefes e baús. Paga frota, loja e baús.
 *
 * Não existe moeda de prestígio: o jogo não reinicia. Toda progressão é
 * acumulativa e a dificuldade vem da curva de setor, que é infinita.
 */
export type ResourceId = 'sucata' | 'nucleo' | 'cristal';

export const RESOURCE_IDS: readonly ResourceId[] = ['sucata', 'nucleo', 'cristal'];

export type Resources = Record<ResourceId, number>;

// ── Elementos ───────────────────────────────────────────────────────────────

/**
 * Os seis tipos de dano.
 *
 * Cinco formam um anel de vantagem (cada um castiga o seguinte) e `padrao` fica
 * de fora dele: nunca ganha bônus e nunca sofre penalidade. É a escolha segura
 * contra a escolha arriscada — quem carrega elemento leva 1.5× contra a frota
 * certa e 0.7× contra a errada, e quem carrega neutro leva 1.0× sempre.
 *
 * A cor de cada um é a cor do projétil: o jogador precisa LER o elemento na
 * tela, sem abrir menu.
 */
export const ELEMENT_IDS = ['padrao', 'fogo', 'raio', 'quimico', 'cosmico', 'gelo'] as const;

export type ElementId = (typeof ELEMENT_IDS)[number];

// ── Atributos ───────────────────────────────────────────────────────────────

export type StatId =
  | 'dano'          // dano por projétil
  | 'cadencia'      // disparos por segundo
  | 'projeteis'     // projéteis por disparo
  | 'perfuracao'    // inimigos atravessados por projétil
  | 'critChance'    // 0..1 — crítico do componente NORMAL
  | 'critDano'      // multiplicador extra no crítico normal
  | 'critElemChance' // 0..1 — crítico do componente ELEMENTAL, rolado à parte (§4)
  | 'critElemDano'  // multiplicador extra no crítico elemental
  | 'penetracao'    // 0..1 — anula resistência e desvantagem, nunca cria vantagem
  | 'explosao'      // raio de dano em área, em px
  | 'vida'          // casco
  | 'escudo'        // barreira que regenera
  | 'regen'         // escudo por segundo
  | 'velocidade'    // px/s de deslocamento da nave
  | 'iaSkill'       // competência do piloto de IA, 0..1
  | 'sorte'         // chance e qualidade de drop
  | 'sucataGanho'
  | 'nucleoGanho'
  | 'xpGanho'
  // Potência elemental: multiplicador aplicado só quando o dano SAI naquele
  // elemento. Vale a pena investir no elemento da arma que se usa.
  | 'danoPadrao' | 'danoFogo' | 'danoRaio' | 'danoQuimico' | 'danoCosmico' | 'danoGelo'
  // Resistência elemental: fração descontada do dano RECEBIDO daquele elemento.
  // Não existe resistência a dano normal: ele vai direto no escudo, no casco e
  // na vida. É essa imunidade a mitigação que dá identidade ao dano neutro —
  // ele nunca ganha vantagem, mas também nunca é reduzido.
  | 'resFogo' | 'resRaio' | 'resQuimico' | 'resCosmico' | 'resGelo';

/** Atributo de potência de cada elemento. */
export const DANO_STAT: Record<ElementId, StatId> = {
  padrao: 'danoPadrao', fogo: 'danoFogo', raio: 'danoRaio',
  quimico: 'danoQuimico', cosmico: 'danoCosmico', gelo: 'danoGelo',
};

/** Elementos que aceitam resistência — `padrao` fica de fora de propósito. */
export type ElementoResistivel = Exclude<ElementId, 'padrao'>;

export const RESISTIVEIS: readonly ElementoResistivel[] = ELEMENT_IDS.filter(
  (e): e is ElementoResistivel => e !== 'padrao',
);

/** Atributo de resistência a cada elemento. */
export const RES_STAT: Record<ElementoResistivel, StatId> = {
  fogo: 'resFogo', raio: 'resRaio',
  quimico: 'resQuimico', cosmico: 'resCosmico', gelo: 'resGelo',
};

export const STAT_IDS: readonly StatId[] = [
  'dano', 'cadencia', 'projeteis', 'perfuracao', 'critChance', 'critDano',
  'critElemChance', 'critElemDano', 'penetracao', 'explosao',
  'vida', 'escudo', 'regen', 'velocidade', 'iaSkill', 'sorte', 'sucataGanho', 'nucleoGanho', 'xpGanho',
  ...ELEMENT_IDS.map((e) => DANO_STAT[e]),
  ...RESISTIVEIS.map((e) => RES_STAT[e]),
];

export type StatMap = Partial<Record<StatId, number>>;

/** Atributos resolvidos: `(base + add) × (1 + mul)`. */
export type Stats = Record<StatId, number>;

export interface StatModifier {
  stat: StatId;
  /** `add` soma no valor bruto; `mul` soma no multiplicador (0.15 = +15%). */
  kind: 'add' | 'mul';
  value: number;
}

// ── Itens ───────────────────────────────────────────────────────────────────

/** As nove categorias da folha `Itens.png`. */
export type SlotId =
  | 'asas' | 'principal' | 'secundaria' | 'motor' | 'reator'
  | 'controle' | 'escudo' | 'blindagem' | 'suporte'
  /**
   * A décima categoria (§11).
   *
   * É um SLOT como os outros, não um sistema paralelo de melhoria: a nave
   * evolui por item, craft e Matriz, e um "menu de upgrades" já foi removido
   * uma vez (§31). O que a folha `novos itens.png` desenha aqui são itens com
   * as sete raridades, como qualquer outra categoria — então é assim que
   * entram.
   */
  | 'upgrade';

export const SLOT_IDS: readonly SlotId[] = [
  'asas', 'principal', 'secundaria', 'motor', 'reator', 'controle', 'escudo', 'blindagem', 'suporte',
  'upgrade',
];

/**
 * 0 comum · 1 incomum · 2 raro · 3 épico · 4 lendário · 5 mítico · 6 divino
 *
 * Os índices 0 a 4 mantêm o significado que sempre tiveram, então um item de
 * save antigo continua com a raridade certa: Mítico e Divino entraram por cima,
 * não no meio.
 */
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Affix {
  id: string;
  stat: StatId;
  kind: 'add' | 'mul';
  value: number;
  /** Nível de rolagem 0..1 DENTRO do tier — mostrado como qualidade. */
  quality: number;
  /**
   * Tier da linha, 1 a 10 (§6). É quem manda na magnitude.
   *
   * Opcional só por causa de saves antigos, cujos afixos não têm o campo; a
   * migração assume T1 para não inflar item nenhum retroativamente.
   */
  tier?: number;
}

export interface Item {
  uid: string;
  baseId: string;
  slot: SlotId;
  rarity: Rarity;
  /** Nível de item — escala os afixos e o poder implícito. */
  ilvl: number;
  affixes: Affix[];
  /**
   * Elemento da peça.
   *
   * Na arma principal ele DEFINE o elemento do tiro; no escudo, o elemento da
   * defesa; nas demais peças é só temperinho de afixos. Peças antigas do save
   * não têm o campo e caem em `padrao`.
   */
  element?: ElementId;
  /** Sprite do atlas usado como ícone. */
  icon: string;
  /** Universo em que caiu — relíquias de universos antigos ficam marcadas. */
  origin: number;
  /** Conjunto a que a peça pertence, se houver. */
  set?: string;
  favorite?: boolean;
}

// ── Progressão ──────────────────────────────────────────────────────────────

/**
 * Nível e XP acumulado DENTRO da faixa do nível atual.
 *
 * Guardar o acumulado da faixa, e não o total de sempre, é o que torna a
 * punição por morte exprimível: a perda é uma fração do que se juntou desde o
 * último nível, e não do esforço de uma vida inteira.
 */
export interface NivelProgresso {
  nivel: number;
  xp: number;
}

export type EncounterKind = 'onda' | 'elite' | 'chefe';

export interface RunState {
  /** Setor atual dentro do universo. */
  sector: number;
  /** Onda atual dentro do setor, 1-based. */
  wave: number;
  kind: EncounterKind;
  /**
   * Inimigos que ainda falta ABATER no encontro, e quantos ele tem no total.
   *
   * Antes o encontro era um poço de vida que drenava a cada golpe, e a onda
   * acabava quando o poço zerava — com naves ainda vivas na tela. O avanço
   * agora vem de destruir, que é o que o jogador vê acontecer.
   *
   * Quem escapa pela base não conta e volta para a fila do diretor: sem isso,
   * deixar os inimigos passarem limparia a onda de graça, que foi o defeito que
   * o modelo de poço existia para tapar.
   */
  restam: number;
  unidades: number;
  /**
   * Recursos ganhos nesta incursão, ainda NÃO depositados.
   *
   * Sucata, núcleos e cristais de combate ficam retidos até o setor inteiro
   * cair. Morrer no meio perde tudo o que está aqui — é o que dá peso à morte
   * sem tocar no que o jogador já tinha guardado. Renda de patrulha não passa
   * por aqui: ela é a camada ociosa, não faz parte da incursão.
   */
  carga: Resources;
  /** Tempo gasto no encontro atual, para detectar bloqueio de progresso. */
  elapsed: number;
  /** Setores em que o jogador já derrotou o chefe neste universo. */
  cleared: number;
}

export interface BarState {
  /** Bioma atual da faixa horizontal. */
  biome: string;
  /** Distância percorrida, alimenta marcos e trocas de bioma. */
  distance: number;
  /** Abates acumulados na faixa. */
  kills: number;
  /** Progresso 0..1 até o próximo baú de patrulha. */
  cacheProgress: number;
  /** Nível de patrulha — escala inimigos e recompensa da faixa. */
  patrol: number;
  patrolXp: number;
}

/**
 * Estado da campanha.
 *
 * `index` sobrou do sistema de prestígio que foi removido e fica travado em 0;
 * continua no save só para não invalidar arquivos antigos, e ainda alimenta a
 * semente de geração. `bestSector` e `bestSectorEver` são iguais hoje, pela
 * mesma razão.
 */
export interface UniverseState {
  index: number;
  /** Semente para geração estável de setores, galáxias e céus. */
  seed: number;
  modifiers: string[];
  bestSector: number;
  bestSectorEver: number;
}

export interface ChestGrant {
  tier: string;
  count: number;
}

export interface Settings {
  /** Política do piloto de IA. */
  pilot: 'agressivo' | 'equilibrado' | 'evasivo' | 'coletor';
  /**
   * Modo de teste: recursos e pontos infinitos, tudo desbloqueado, nave
   * indestrutível e controle de velocidade. Serve para inspecionar conteúdo
   * sem esperar a curva de progressão.
   */
  testMode: boolean;
  /** Multiplicador de velocidade do jogo (1..8), só com o modo de teste. */
  speed: number;
  /**
   * Ficar no setor atual em vez de avançar ao vencê-lo.
   *
   * Farmar é parte do desenho: o chefe é dimensionado para quem já voltou atrás
   * de item e de nível (`CHEFE_EXIGENCIA`). Sem esta trava, farmar exigiria
   * voltar ao mapa e reclicar a fase a cada volta — o jogo é ocioso, então
   * repetir de propósito precisa ser tão automático quanto avançar.
   *
   * Não afeta o que a vitória rende: recompensa, XP, drops e a liberação do
   * setor seguinte acontecem igual. O que ela segura é só o ponteiro da
   * incursão.
   */
  repetirSetor: boolean;
  /** Auto-equipar quando o item novo for melhor pela pontuação. */
  autoEquip: boolean;
  /** Auto-descartar itens abaixo desta raridade. */
  autoSalvage: Rarity;
  showDamageNumbers: boolean;
  barVisible: boolean;
  reduceEffects: boolean;
  muted: boolean;
}

// ── Estado global ───────────────────────────────────────────────────────────

export interface GameState {
  version: number;
  createdAt: number;
  savedAt: number;
  /** Tempo total jogado, em segundos. */
  playtime: number;

  resources: Resources;
  /** Totais acumulados de todos os tempos, para estatísticas e conquistas. */
  lifetime: Resources;

  hull: string;
  /** Cascos desbloqueados. */
  fleet: string[];

  /**
   * Nível e XP de CADA nave, por id de casco.
   *
   * Não há transferência entre naves (§17): trocar de casco recomeça a
   * progressão daquele casco. É o que dá sentido a manter uma frota em vez de
   * uma nave só — e o que faz o §18 funcionar, porque a nave certa para um
   * conteúdo pode ser a que ainda não está desenvolvida.
   */
  naves: Record<string, NivelProgresso>;

  equipped: Partial<Record<SlotId, Item>>;
  inventory: Item[];
  /**
   * @deprecated Substituído por `cargaLiberada` na 3.7. Fica só para saves
   * antigos não perderem a capacidade que já tinham; a migração o converte.
   */
  inventorySize?: number;
  /**
   * Ids das concessões de carga já obtidas (§28).
   *
   * Lista de ids e não um número porque a MESMA fonte não pode conceder duas
   * vezes: com um contador, recomprar na loja ou rematar um chefe daria espaço
   * de novo. O id também é o que permite ao painel dizer de onde veio cada
   * espaço.
   */
  cargaLiberada: string[];
  /**
   * O Armazém: material → quantidade (§29).
   *
   * Só os tipos que o jogador REALMENTE tem aparecem aqui — um material zerado
   * é removido em vez de guardado como 0, senão o save cresceria com o catálogo
   * e a contagem de tipos guardados (que é o que a capacidade limita) contaria
   * material que ninguém tem.
   */
  armazem: Record<string, number>;

  /** id do item de loja → quantas vezes foi comprado. */
  shop: Record<string, number>;

  /**
   * O personagem: nível global, XP da faixa atual e a Matriz.
   *
   * O nível dele é a principal referência do §17 e o que abre a Matriz. Vive
   * aqui, e não num campo separado, porque patente e nível de personagem sempre
   * foram a mesma coisa — separá-los criaria dois eixos idênticos.
   */
  command: NivelProgresso & {
    /** Nós da matriz já alocados. */
    allocated: string[];
    /** Refazes gratuitos restantes. */
    refunds: number;
  };

  run: RunState;
  bar: BarState;
  universe: UniverseState;

  chests: Record<string, number>;
  /** Chefes já derrotados alguma vez — alimenta o códex. */
  codex: string[];

  stats: {
    kills: number;
    bossKills: number;
    deaths: number;
    itemsFound: number;
    chestsOpened: number;
  };

  settings: Settings;
}
