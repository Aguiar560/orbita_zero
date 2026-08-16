import { DANO_STAT, RES_STAT, type ElementId, type SlotId, type StatId } from '@sim/types';
import { ELEMENTS } from './elements';

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

export interface AffixDef {
  id: string;
  label: string;
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
const ELEMENTAL_AFFIXES: readonly AffixDef[] = ELEMENTS.flatMap((e) => [
  {
    id: `pot_${e.id}`,
    label: `Dano de ${e.name.toLowerCase()}`,
    stat: DANO_STAT[e.id],
    kind: 'mul' as const,
    min: 0.07, max: 0.26,
    slots: ['principal', 'secundaria', 'reator'] as const,
    weight: 70,
    minIlvl: 3,
    element: e.id,
  },
  {
    id: `res_${e.id}`,
    label: `Resistência a ${e.name.toLowerCase()}`,
    stat: RES_STAT[e.id],
    kind: 'add' as const,
    min: 0.04, max: 0.13,
    slots: ['escudo', 'blindagem', 'controle', 'suporte'] as const,
    weight: 65,
    minIlvl: 3,
    element: e.id,
  },
]);

/**
 * `add` escala com o nível de item (é um valor bruto); `mul` não escala,
 * porque uma porcentagem já é relativa — senão +10% viraria +1000% no fim.
 */
export const AFFIXES: readonly AffixDef[] = [
  { id: 'dano_f',      label: 'Dano',                stat: 'dano',        kind: 'add', min: 1.4, max: 3.2, weight: 100 },
  { id: 'dano_p',      label: 'Dano',                stat: 'dano',        kind: 'mul', min: 0.04, max: 0.14, weight: 80 },
  { id: 'cadencia_p',  label: 'Cadência',            stat: 'cadencia',    kind: 'mul', min: 0.03, max: 0.12, weight: 75 },
  { id: 'crit_c',      label: 'Chance de crítico',   stat: 'critChance',  kind: 'add', min: 0.012, max: 0.045, weight: 60, minIlvl: 4 },
  { id: 'crit_d',      label: 'Dano crítico',        stat: 'critDano',    kind: 'add', min: 0.06, max: 0.24, weight: 55, minIlvl: 4 },
  { id: 'vida_f',      label: 'Casco',               stat: 'vida',        kind: 'add', min: 9, max: 22, weight: 95 },
  { id: 'vida_p',      label: 'Casco',               stat: 'vida',        kind: 'mul', min: 0.04, max: 0.13, weight: 70 },
  { id: 'escudo_f',    label: 'Escudo',              stat: 'escudo',      kind: 'add', min: 7, max: 19, weight: 90 },
  { id: 'escudo_p',    label: 'Escudo',              stat: 'escudo',      kind: 'mul', min: 0.05, max: 0.16, weight: 65 },
  { id: 'regen_f',     label: 'Regeneração',         stat: 'regen',       kind: 'add', min: 0.4, max: 1.6, weight: 60 },
  { id: 'veloc_p',     label: 'Velocidade',          stat: 'velocidade',  kind: 'mul', min: 0.03, max: 0.11, weight: 60, slots: ['motor', 'asas', 'blindagem'] },
  { id: 'proj_f',      label: 'Projéteis',           stat: 'projeteis',   kind: 'add', min: 1, max: 1, weight: 9, slots: ['principal', 'secundaria'], minIlvl: 12 },
  { id: 'perf_f',      label: 'Perfuração',          stat: 'perfuracao',  kind: 'add', min: 1, max: 1, weight: 14, slots: ['principal', 'secundaria'], minIlvl: 8 },
  { id: 'expl_f',      label: 'Raio de explosão',    stat: 'explosao',    kind: 'add', min: 3, max: 11, weight: 35, slots: ['principal', 'secundaria', 'reator'], minIlvl: 6 },
  { id: 'sorte_f',     label: 'Sorte',               stat: 'sorte',       kind: 'add', min: 0.02, max: 0.09, weight: 45 },
  { id: 'sucata_p',    label: 'Ganho de sucata',     stat: 'sucataGanho', kind: 'mul', min: 0.06, max: 0.22, weight: 55 },
  { id: 'nucleo_p',    label: 'Ganho de núcleos',    stat: 'nucleoGanho', kind: 'mul', min: 0.05, max: 0.18, weight: 50 },
  { id: 'xp_p',        label: 'Ganho de XP',         stat: 'xpGanho',     kind: 'mul', min: 0.05, max: 0.2, weight: 40 },
  { id: 'ia_f',        label: 'Sincronia do piloto', stat: 'iaSkill',     kind: 'add', min: 0.015, max: 0.06, weight: 22, slots: ['controle', 'motor', 'reator'], minIlvl: 10 },
  ...ELEMENTAL_AFFIXES,
];

/** Elemento de um afixo, quando ele é elemental. */
export const affixElement = (id: string): ElementId | undefined =>
  AFFIX_BY_ID.get(id)?.element;

export const AFFIX_BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));
