import { DANO_STAT, RES_STAT, type ElementId, type Rarity, type SlotId, type StatId } from '@sim/types';
import { rarityInfo } from '@data/balance/raridades';
import { ELEMENTOS_RESISTIVEIS, ELEMENTS } from './elements';

// ── Slots ───────────────────────────────────────────────────────────────────

export interface SlotInfo {
  id: SlotId;
  name: string;
  short: string;
  /** Glifo grande, quando existe na folha; senão cai no ícone de categoria. */
  icon: string;
  hint: string;
}

/** As nove categorias da folha `Itens.png`, na mesma ordem. */
export const SLOTS: readonly SlotInfo[] = [
  { id: 'asas', name: 'Asas / Estrutura', short: 'Asas', icon: 'cat/asas', hint: 'Define manobra e estabilidade do casco.' },
  { id: 'principal', name: 'Arma Principal', short: 'Principal', icon: 'slot/principal', hint: 'A fonte de dano por tiro.' },
  { id: 'secundaria', name: 'Arma Secundária', short: 'Secundária', icon: 'slot/secundaria', hint: 'Cadência e volume de fogo.' },
  { id: 'motor', name: 'Propulsão / Motores', short: 'Motor', icon: 'slot/motor', hint: 'Velocidade de deslocamento e esquiva.' },
  { id: 'reator', name: 'Reator / Energia', short: 'Reator', icon: 'cat/reator', hint: 'Amplifica todo o armamento.' },
  { id: 'controle', name: 'Sistemas de Controle', short: 'Controle', icon: 'cat/controle', hint: 'Precisão e sincronia com o piloto de IA.' },
  { id: 'escudo', name: 'Defesa / Escudos', short: 'Escudo', icon: 'slot/escudo', hint: 'Barreira que regenera entre encontros.' },
  { id: 'blindagem', name: 'Blindagem / Casco', short: 'Blindagem', icon: 'cat/blindagem', hint: 'Casco bruto — o que sobra quando o escudo cai.' },
  { id: 'suporte', name: 'Suportes / Utilitários', short: 'Suporte', icon: 'slot/suporte', hint: 'Sorte, coleta e rendimento.' },
];

export const SLOT_BY_ID = new Map(SLOTS.map((s) => [s.id, s]));
export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.name])) as Record<SlotId, string>;
export const SLOT_ICON = Object.fromEntries(SLOTS.map((s) => [s.id, s.icon])) as Record<SlotId, string>;

// ── Conjuntos ───────────────────────────────────────────────────────────────

export interface SetBonus {
  pieces: number;
  label: string;
  stats: Partial<Record<StatId, number>>;
  kind: 'add' | 'mul';
}

export interface ItemSet {
  id: string;
  name: string;
  color: string;
  /** Slots em que peças deste conjunto podem aparecer. */
  slots: readonly SlotId[];
  bonuses: readonly SetBonus[];
}

/**
 * Os quatro conjuntos da folha. Cada um cobre cinco slots, então vestir o
 * conjunto inteiro é possível mas custa metade dos encaixes do jogador — a
 * escolha entre "quatro peças de conjunto" e "cinco peças ótimas soltas" é o
 * ponto do sistema.
 */
export const ITEM_SETS: readonly ItemSet[] = [
  {
    id: 'vanguarda',
    name: 'Vanguarda',
    color: '#7ed957',
    slots: ['asas', 'motor', 'principal', 'controle', 'blindagem'],
    bonuses: [
      { pieces: 2, label: '+18% de velocidade de manobra', stats: { velocidade: 0.18 }, kind: 'mul' },
      { pieces: 4, label: '+25% de dano', stats: { dano: 0.25 }, kind: 'mul' },
    ],
  },
  {
    id: 'sobrevivente',
    name: 'Sobrevivente',
    color: '#38a9ff',
    slots: ['escudo', 'blindagem', 'reator', 'controle', 'suporte'],
    bonuses: [
      { pieces: 2, label: '+30% de escudo', stats: { escudo: 0.3 }, kind: 'mul' },
      { pieces: 4, label: '+6 de regeneração de escudo por segundo', stats: { regen: 6 }, kind: 'add' },
    ],
  },
  {
    id: 'aniquilador',
    name: 'Aniquilador',
    color: '#c060ff',
    slots: ['principal', 'secundaria', 'reator', 'asas', 'suporte'],
    bonuses: [
      { pieces: 2, label: '+22% de dano', stats: { dano: 0.22 }, kind: 'mul' },
      { pieces: 4, label: '+18% de chance de crítico e +60% de dano crítico', stats: { critChance: 0.18, critDano: 0.6 }, kind: 'add' },
    ],
  },
  {
    id: 'ancestral',
    name: 'Tecno Ancestral',
    color: '#ff9a1f',
    slots: ['reator', 'controle', 'secundaria', 'motor', 'suporte'],
    bonuses: [
      { pieces: 2, label: '+25% de cadência', stats: { cadencia: 0.25 }, kind: 'mul' },
      { pieces: 4, label: '+2 projéteis e +1 de perfuração', stats: { projeteis: 2, perfuracao: 1 }, kind: 'add' },
    ],
  },
];

export const SET_BY_ID = new Map(ITEM_SETS.map((s) => [s.id, s]));

/** Ícone do conjunto para um slot — cada conjunto tem cinco, um por slot coberto. */
export function setIcon(setId: string, slot: SlotId): string {
  const set = SET_BY_ID.get(setId);
  if (!set) return 'gem/0';
  const i = Math.max(0, set.slots.indexOf(slot));
  return `set/${setId}_${i}`;
}

// ── Bases ───────────────────────────────────────────────────────────────────

export interface ItemBase {
  id: string;
  name: string;
  slot: SlotId;
  /** 0..7 — acompanha a coluna na folha; molduras maiores são níveis maiores. */
  tier: number;
  icon: string;
  /** Nível de item mínimo para esta base aparecer. */
  minIlvl: number;
  /** Atributo implícito, sempre presente e escalado por nível de item. */
  implicit: { stat: StatId; kind: 'add' | 'mul'; per: number };
}

/** Nomes por slot, do modelo mais rudimentar ao mais exótico. */
const NAMES: Record<SlotId, readonly string[]> = {
  asas: ['Empenagem Bruta', 'Aerofólio Curto', 'Asa Delta', 'Envergadura Dupla', 'Perfil Furtivo', 'Asa Fantasma', 'Vórtice', 'Envergadura Zênite'],
  principal: ['Canhão Simples', 'Repetidor Leve', 'Canhão de Íons', 'Metralha Pesada', 'Lança de Plasma', 'Rajada Espectral', 'Aniquilador', 'Cano de Singularidade'],
  secundaria: ['Torreta Auxiliar', 'Lançador Duplo', 'Canhão Ácido', 'Bateria Gêmea', 'Estilhaçador', 'Repetidor de Vazio', 'Corrente Tesla', 'Enxame Autônomo'],
  motor: ['Turbina Padrão', 'Injetor Frio', 'Impulsor Iônico', 'Vetor Duplo', 'Fluxo Azul', 'Combustão Rubra', 'Salto de Fase', 'Motor de Curvatura'],
  reator: ['Célula Básica', 'Núcleo Estável', 'Reator Verde', 'Fusão Compacta', 'Núcleo Azul', 'Câmara Âmbar', 'Núcleo Instável', 'Coração de Estrela'],
  controle: ['Piloto Auxiliar', 'Giroscópio', 'Matriz Tática', 'Rede Neural', 'Preditor Balístico', 'Consciência Fria', 'Sincronia Total', 'Oráculo'],
  escudo: ['Defletor Simples', 'Barreira Compacta', 'Campo Harmônico', 'Bolha Hexagonal', 'Escudo em Camadas', 'Barreira de Fase', 'Domo Espectral', 'Muralha Solar'],
  blindagem: ['Chapa Ablativa', 'Casco Reforçado', 'Placa Composta', 'Blindagem Reativa', 'Carapaça Densa', 'Liga Escura', 'Casco Adaptativo', 'Casco de Relíquia'],
  suporte: ['Kit de Reparo', 'Guincho Magnético', 'Sonda Prospectora', 'Módulo Logístico', 'Sensor Profundo', 'Coletor Automático', 'Extrator de Relíquias', 'Convergente'],
};

/** Atributo implícito característico de cada slot. */
const IMPLICITS: Record<SlotId, { stat: StatId; kind: 'add' | 'mul'; per: number }> = {
  asas: { stat: 'velocidade', kind: 'add', per: 3.4 },
  principal: { stat: 'dano', kind: 'add', per: 2.6 },
  secundaria: { stat: 'cadencia', kind: 'mul', per: 0.016 },
  motor: { stat: 'velocidade', kind: 'mul', per: 0.014 },
  reator: { stat: 'dano', kind: 'mul', per: 0.02 },
  controle: { stat: 'critChance', kind: 'add', per: 0.004 },
  escudo: { stat: 'escudo', kind: 'add', per: 9.5 },
  blindagem: { stat: 'vida', kind: 'add', per: 12 },
  suporte: { stat: 'sorte', kind: 'add', per: 0.01 },
};

/**
 * 72 bases: 9 slots × 8 níveis de acabamento.
 *
 * O `tier` decide o ícone e o `minIlvl`, então avançar de setor troca
 * visivelmente o que cai — a evolução aparece no inventário, não só nos números.
 */
export const ITEM_BASES: readonly ItemBase[] = SLOTS.flatMap((slot) =>
  NAMES[slot.id].map((name, tier) => ({
    id: `${slot.id}_${tier}`,
    name,
    slot: slot.id,
    tier,
    icon: `item/${slot.id}_${tier}`,
    minIlvl: tier === 0 ? 1 : tier * 7,
    implicit: { ...IMPLICITS[slot.id], per: IMPLICITS[slot.id].per * (1 + tier * 0.22) },
  })),
);

export const BASE_BY_ID = new Map(ITEM_BASES.map((b) => [b.id, b]));

/** Bases disponíveis num nível de item, restritas às três faixas mais altas. */
export function basesForIlvl(ilvl: number, slot?: SlotId): ItemBase[] {
  const pool = ITEM_BASES.filter((b) => b.minIlvl <= ilvl && (!slot || b.slot === slot));
  if (pool.length === 0) return ITEM_BASES.filter((b) => b.tier === 0 && (!slot || b.slot === slot));
  const top = Math.max(...pool.map((b) => b.tier));
  return pool.filter((b) => b.tier >= top - 2);
}

// ── Afixos ──────────────────────────────────────────────────────────────────

/**
 * A que eixo do jogo um afixo pertence (§7).
 *
 * Serve para dar IDENTIDADE aos slots. Sem isso, todo slot rola do mesmo bolo:
 * medido, uma blindagem tinha a mesma chance de sair cheia de dano que uma arma
 * principal, e um reator saía cheio de escudo. O jogador via nove peças que
 * eram a mesma peça com nomes diferentes.
 */
export type FamiliaDeAfixo = 'ofensiva' | 'defensiva' | 'utilidade';

/**
 * Quanto cada slot puxa cada família, multiplicando o peso do afixo.
 *
 * VIÉS, não exclusão. Uma blindagem ainda pode rolar dano — só é raro, e por
 * isso vale alguma coisa quando acontece. Exclusão dura tornaria cada slot
 * previsível e mataria o item surpreendente, que é metade da graça de um ARPG.
 *
 * Os números seguem os `hint` que os slots já declaram em `SLOTS`: "a fonte de
 * dano por tiro" puxa ofensiva, "o que sobra quando o escudo cai" puxa
 * defensiva, "sorte, coleta e rendimento" puxa utilidade.
 *
 * O multiplicador de `suporte` é o dobro dos outros, e não é favoritismo: a
 * família `utilidade` tem CINCO afixos contra onze de cada uma das outras duas.
 * Com 3,0 o suporte ainda saía com metade das linhas fora do tema, porque estava
 * competindo em número. O peso compensa o tamanho do bolo, não o valor da linha.
 */
export const AFINIDADE: Record<SlotId, Record<FamiliaDeAfixo, number>> = {
  asas:       { ofensiva: 0.6, defensiva: 1.2, utilidade: 1.0 },
  principal:  { ofensiva: 2.5, defensiva: 0.35, utilidade: 0.7 },
  secundaria: { ofensiva: 2.2, defensiva: 0.4, utilidade: 0.8 },
  motor:      { ofensiva: 0.5, defensiva: 1.3, utilidade: 1.2 },
  reator:     { ofensiva: 1.8, defensiva: 0.7, utilidade: 1.0 },
  controle:   { ofensiva: 1.2, defensiva: 0.8, utilidade: 1.6 },
  escudo:     { ofensiva: 0.3, defensiva: 2.5, utilidade: 0.7 },
  blindagem:  { ofensiva: 0.3, defensiva: 2.5, utilidade: 0.7 },
  suporte:    { ofensiva: 0.35, defensiva: 0.4, utilidade: 6.0 },
};

/** Peso efetivo de um afixo NAQUELE slot. */
export function pesoNoSlot(def: AffixDef, slot: SlotId): number {
  return def.weight * (AFINIDADE[slot]?.[def.familia] ?? 1);
}

export interface AffixDef {
  id: string;
  label: string;
  /** Eixo do jogo a que pertence — decide a afinidade com cada slot. */
  familia: FamiliaDeAfixo;
  /**
   * Correção de VALOR da linha, medida (§7).
   *
   * Duas linhas do mesmo tier num item da mesma raridade deveriam valer
   * aproximadamente o mesmo, e não valiam: medido em nave montada, o melhor
   * afixo do núcleo rendia 2,7× a mediana e o pior 0,7×. A faixa `min`/`max`
   * de cada afixo é escrita em UNIDADES DO ATRIBUTO — "+3 de dano" e "+0,2 de
   * regeneração" não são comparáveis a olho, e o desequilíbrio se acumulou sem
   * ninguém notar.
   *
   * `calibre` multiplica o valor rolado para fechar essa diferença. Sai de
   * `npm run simular -- calibrar`, que mede o ganho marginal de cada afixo e
   * devolve o inverso normalizado — não é escolha de design, é a correção que a
   * medição pede.
   *
   * Ausente = 1, ou seja, sem correção.
   */
  calibre?: number;
  /**
   * Raridade mínima do item para este afixo poder sair (§8).
   *
   * Diferente de `minIlvl`, que é sobre PROGRESSO: o jogador chega lá só de
   * jogar. Isto é sobre SORTE — nem o jogador do setor 300 vê a linha se o item
   * não saiu raro o bastante. É o único mecanismo que torna um afixo realmente
   * excepcional, porque peso baixo sozinho só o adia.
   */
  raridadeMin?: Rarity;
  /**
   * Grupo de EXCLUSÃO MÚTUA.
   *
   * Dois afixos do mesmo grupo nunca saem no mesmo item. Existe para os
   * projéteis: sem isto, um Divino podia rolar `+1`, `+2` e `+3` na mesma peça
   * e entregar seis projéteis numa linha só — a "multiplicação quebrada" que o
   * §8 manda evitar. Empilhar entre PEÇAS continua valendo; o que o grupo
   * impede é o acúmulo dentro de uma.
   */
  grupo?: string;
  stat: StatId;
  kind: 'add' | 'mul';
  /** Faixa de rolagem por nível de item. */
  min: number;
  max: number;
  /** Slots em que este afixo pode aparecer. Vazio = qualquer um. */
  slots?: readonly SlotId[];
  weight: number;
  minIlvl?: number;
  /**
   * Restringe o afixo a peças daquele elemento.
   *
   * Sem isso, um canhão de fogo poderia rolar "+18% de dano de gelo" — um afixo
   * que nunca faria nada, porque a arma dispara fogo. Amarrar o afixo ao
   * elemento da peça faz cada item ler como uma coisa só.
   */
  element?: ElementId;
}

/**
 * Afixos elementais: potência e resistência, um par por elemento.
 *
 * São doze e todos com a mesma forma, então nascem da tabela de elementos em
 * vez de escritos à mão — assim nome, cor e atributo nunca saem de sincronia
 * com `elements.ts`.
 */
const ELEMENTAL_AFFIXES: readonly AffixDef[] = [
  // Potência: existe para os seis, inclusive o normal — "+% de dano normal" é
  // afixo legítimo, e é o que dá o que investir a quem escolheu o dano neutro.
  ...ELEMENTS.map((e) => ({
    id: `pot_${e.id}`,
    familia: 'ofensiva' as const,
    calibre: 0.417,
    label: e.id === 'padrao' ? 'Dano normal' : `Dano de ${e.name.toLowerCase()}`,
    stat: DANO_STAT[e.id],
    // `add`, não `mul`. Estes atributos são consumidos como `1 + x` — em
    // `resolveStats`, `out.dano *= 1 + out[DANO_STAT[ativo]]` —, então já SÃO a
    // fração. Como `mul`, a conta virava `(0 + 0) × (1 + 0,26) = 0`: nada
    // alimenta o lado `add` de `danoFogo`, nem casco, nem conjunto, nem matriz.
    // Os seis afixos de potência elemental eram inertes, rolavam, apareciam na
    // ficha e não faziam nada. Medido com `simular -- afixos`: ganho idêntico ao
    // de não equipar afixo nenhum.
    kind: 'add' as const,
    /**
     * Faixa estreita porque este afixo é dono de um CANAL VAZIO.
     *
     * O dano tem três canais de multiplicação — `add dano`, `mul dano` e a
     * potência elemental —, e o valor de uma linha depende de quão cheio já
     * está o canal que ela alimenta. `mul dano` acumula com casco, conjuntos e
     * matriz num somatório grande, então +63% ali muda pouco. A potência
     * elemental não recebe de mais ninguém: cada ponto colocado nela quase
     * dobra o dano sozinho.
     *
     * Medido em `simular -- afixos 270 10` contra uma nave montada: com a faixa
     * original de 0,07–0,26 estes seis afixos valiam 4,84× a mediana e eram os
     * mais fortes do jogo. Com 0,02–0,08 valem 1,67× — o mesmo que `dano_f`.
     */
    min: 0.06, max: 0.20,
    slots: ['principal', 'secundaria', 'reator'] as const,
    weight: 70,
    minIlvl: 3,
    element: e.id,
  })),
  // Resistência: só para os cinco elementais. Dano normal vai direto no escudo,
  // no casco e na vida — um afixo de "resistência a normal" prometeria uma
  // redução que a fórmula de dano nunca aplicaria.
  ...ELEMENTOS_RESISTIVEIS.map((e) => ({
    id: `res_${e.id}`,
    familia: 'defensiva' as const,
    label: `Resistência a ${e.name.toLowerCase()}`,
    stat: RES_STAT[e.id],
    kind: 'add' as const,
    min: 0.04, max: 0.13,
    slots: ['escudo', 'blindagem', 'controle', 'suporte'] as const,
    weight: 65,
    minIlvl: 3,
    element: e.id,
  })),
];

/**
 * `add` escala com o nível de item (é um valor bruto); `mul` não escala,
 * porque uma porcentagem já é relativa — senão +10% viraria +1000% no fim.
 */
export const AFFIXES: readonly AffixDef[] = [
  { id: 'dano_f',      label: 'Dano',                familia: 'ofensiva', calibre: 0.472, stat: 'dano',        kind: 'add', min: 1.4, max: 3.2, weight: 100 },
  { id: 'dano_p',      label: 'Dano',                familia: 'ofensiva', calibre: 1.173, stat: 'dano',        kind: 'mul', min: 0.04, max: 0.14, weight: 80 },
  { id: 'cadencia_p',  label: 'Cadência',            familia: 'ofensiva', stat: 'cadencia',    kind: 'mul', min: 0.03, max: 0.12, weight: 75 },
  { id: 'crit_c',      label: 'Chance de crítico',   familia: 'ofensiva', stat: 'critChance',  kind: 'add', min: 0.012, max: 0.045, weight: 60, minIlvl: 4 },
  { id: 'crit_d',      label: 'Dano crítico',        familia: 'ofensiva', calibre: 0.576, stat: 'critDano',    kind: 'add', min: 0.06, max: 0.24, weight: 55, minIlvl: 4 },
  // Crítico ELEMENTAL, separado do normal (§4). Faixas iguais às do normal de
  // propósito: quem escolhe um dos dois está escolhendo em qual componente
  // investiu, não pegando o número maior.
  { id: 'crite_c',     label: 'Crítico elemental',   familia: 'ofensiva', stat: 'critElemChance', kind: 'add', min: 0.04, max: 0.15, weight: 40, minIlvl: 10 },
  { id: 'crite_d',     label: 'Dano crít. elemental', familia: 'ofensiva', stat: 'critElemDano', kind: 'add', min: 0.20, max: 0.80, weight: 38, minIlvl: 10 },
  /**
   * Penetração: anula resistência e desvantagem, nunca cria vantagem.
   *
   * Peso baixo e nível alto porque é o afixo que RESOLVE o anel — quem tem
   * muita penetração deixa de precisar escolher elemento. Ele existe como
   * alternativa a essa escolha, não como atalho para ignorá-la, e o teto de
   * `PENETRACAO_MAX` garante que o pior confronto chegue a 0,94 e não a 1,0.
   */
  { id: 'pen_f',       label: 'Penetração',          familia: 'ofensiva', stat: 'penetracao',  kind: 'add', min: 0.02, max: 0.07, weight: 30, minIlvl: 20 },
  { id: 'vida_f',      label: 'Casco',               familia: 'defensiva', calibre: 0.716, stat: 'vida',        kind: 'add', min: 9, max: 22, weight: 95 },
  { id: 'vida_p',      label: 'Casco',               familia: 'defensiva', calibre: 0.735, stat: 'vida',        kind: 'mul', min: 0.04, max: 0.13, weight: 70 },
  { id: 'escudo_f',    label: 'Escudo',              familia: 'defensiva', calibre: 0.744, stat: 'escudo',      kind: 'add', min: 7, max: 19, weight: 90 },
  { id: 'escudo_p',    label: 'Escudo',              familia: 'defensiva', calibre: 0.852, stat: 'escudo',      kind: 'mul', min: 0.05, max: 0.16, weight: 65 },
  { id: 'regen_f',     label: 'Regeneração',         familia: 'defensiva', calibre: 0.654, stat: 'regen',       kind: 'add', min: 0.4, max: 1.6, weight: 60 },
  { id: 'veloc_p',     label: 'Velocidade',          familia: 'defensiva', calibre: 1.276, stat: 'velocidade',  kind: 'mul', min: 0.03, max: 0.11, weight: 60, slots: ['motor', 'asas', 'blindagem'] },
  /**
   * Projéteis, em três degraus (§8).
   *
   * "Não tratar +1 projétil como equivalente a um pequeno aumento percentual de
   * dano" — e de fato não é: medido, `proj_f` valia 5,3× a mediana dos outros
   * afixos, o maior número do jogo depois da perfuração. Um multiplicador
   * direto no dano por segundo não cabe na mesma faixa de peso que "+8% de
   * escudo".
   *
   * A raridade mínima é o freio que peso baixo sozinho não dá: sem ela, o
   * jogador do setor 300 acabaria vendo `+3` só por rolar muito. Com ela, `+3`
   * exige um Divino — que sai uma vez em 36 mil — E a rolagem dentro dele.
   */
  { id: 'proj_1', label: '+1 projétil',  familia: 'ofensiva', stat: 'projeteis', kind: 'add', min: 1, max: 1, weight: 9,   slots: ['principal', 'secundaria'], minIlvl: 12, grupo: 'projeteis' },
  { id: 'proj_2', label: '+2 projéteis', familia: 'ofensiva', stat: 'projeteis', kind: 'add', min: 2, max: 2, weight: 2.5, slots: ['principal', 'secundaria'], minIlvl: 45, raridadeMin: 4, grupo: 'projeteis' },
  { id: 'proj_3', label: '+3 projéteis', familia: 'ofensiva', stat: 'projeteis', kind: 'add', min: 3, max: 3, weight: 0.6, slots: ['principal', 'secundaria'], minIlvl: 110, raridadeMin: 6, grupo: 'projeteis' },
  { id: 'perf_f',      label: 'Perfuração',          familia: 'ofensiva', stat: 'perfuracao',  kind: 'add', min: 1, max: 1, weight: 14, slots: ['principal', 'secundaria'], minIlvl: 8 },
  { id: 'expl_f',      label: 'Raio de explosão',    familia: 'ofensiva', stat: 'explosao',    kind: 'add', min: 3, max: 11, weight: 35, slots: ['principal', 'secundaria', 'reator'], minIlvl: 6 },
  { id: 'sorte_f',     label: 'Sorte',               familia: 'utilidade', stat: 'sorte',       kind: 'add', min: 0.02, max: 0.09, weight: 45 },
  { id: 'sucata_p',    label: 'Ganho de sucata',     familia: 'utilidade', calibre: 1.8, stat: 'sucataGanho', kind: 'add', min: 0.06, max: 0.22, weight: 55 },
  { id: 'nucleo_p',    label: 'Ganho de núcleos',    familia: 'utilidade', calibre: 2.026, stat: 'nucleoGanho', kind: 'add', min: 0.05, max: 0.18, weight: 50 },
  { id: 'xp_p',        label: 'Ganho de XP',         familia: 'utilidade', calibre: 1.927, stat: 'xpGanho',     kind: 'add', min: 0.05, max: 0.2, weight: 40 },
  { id: 'ia_f',        label: 'Sincronia do piloto', familia: 'utilidade', calibre: 0.667, stat: 'iaSkill',     kind: 'add', min: 0.015, max: 0.06, weight: 22, slots: ['controle', 'motor', 'reator'], minIlvl: 10 },
  ...ELEMENTAL_AFFIXES,
];

/** Elemento de um afixo, quando ele é elemental. */
export const affixElement = (id: string): ElementId | undefined =>
  AFFIX_BY_ID.get(id)?.element;

export const AFFIX_BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

/**
 * Ícone de um item, do catálogo novo (§23).
 *
 * A folha `novos itens.png` indexa por RARIDADE, não pelo nível de acabamento
 * da base — e essa é a mudança que faz o inventário ser legível de relance. Com
 * a folha antiga, um Comum e um Divino do mesmo cano tinham o mesmo desenho e
 * só a borda mudava; agora o Divino tem moldura dourada e silhueta própria.
 *
 * A variante (são duas por célula) sai do TIER DA BASE, não de sorteio: o mesmo
 * cano precisa ter sempre a mesma cara, senão desmanchar e recuperar um item
 * mudaria o desenho dele. Bases de tier par e ímpar alternam, o que dá variedade
 * dentro de uma raridade sem custar estabilidade.
 */
export function iconeDeItem(slot: SlotId, rarity: Rarity, tierDaBase: number): string {
  return `novo/${slot}_${rarityInfo(rarity).slug}_${tierDaBase % 2}`;
}
