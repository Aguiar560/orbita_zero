import type { ElementId, StatMap } from '@sim/types';
import { getElement } from './elements';
import type { Hull, ShotStyle } from './hulls';
import {
  SPACESHIPS2_LEGACY_PLAYER_ART,
  SPACESHIPS2_PLAYER_ART,
  type Spaceship2Art,
} from './spaceships2';

export type HullArchetypeId =
  | 'interceptor'
  | 'assalto'
  | 'artilharia'
  | 'baluarte'
  | 'suporte'
  | 'saturacao'
  | 'duelista';

export type HullTuningId = 'equilibrado' | 'agressivo' | 'blindado' | 'veloz' | 'preciso' | 'sincronico';
export type HullWeaponId = 'rajada' | 'canhao' | 'lanca' | 'bombarda' | 'saturador' | 'agulha';

export interface HullArchetype {
  id: HullArchetypeId;
  name: string;
  description: string;
  stats: StatMap;
}

export interface HullTuning {
  id: HullTuningId;
  name: string;
  description: string;
}

export interface HullWeaponProfile {
  id: HullWeaponId;
  name: string;
  description: string;
  heavy: boolean;
  speed: number;
  scale: number;
  spread: number;
  damageMul: number;
  cadenceMul: number;
  projectilesAdd?: number;
  pierceAdd?: number;
  splashAdd?: number;
}

/**
 * Schema permanente de cadastro de casco.
 *
 * Para uma nave futura entrar no jogo basta: arte no catálogo, uma ficha nesta
 * tabela e o pipeline. Atributos, tiro, escala, Hangar e Laboratório saem da
 * mesma fonte; não existe uma segunda lista manual para esquecer de atualizar.
 */
export interface Spaceships2HullSpec {
  id: string;
  name: string;
  artId: string;
  archetype: HullArchetypeId;
  tuning: HullTuningId;
  element: ElementId;
  weapon: HullWeaponId;
  blurb: string;
}

export const HULL_ARCHETYPES: readonly HullArchetype[] = [
  {
    id: 'interceptor', name: 'Interceptador', description: 'Mobilidade, cadência e resposta rápida; paga em resistência.',
    stats: { dano: 17, cadencia: 5.2, vida: 185, escudo: 130, regen: 7, velocidade: 360, projeteis: 2, critChance: 0.12, critDano: 0.4, iaSkill: 0.08 },
  },
  {
    id: 'assalto', name: 'Assalto', description: 'Pressão frontal consistente, sem depender de uma única mecânica.',
    stats: { dano: 30, cadencia: 3.5, vida: 250, escudo: 155, regen: 9, velocidade: 280, projeteis: 2, critChance: 0.1, critDano: 0.45, explosao: 10 },
  },
  {
    id: 'artilharia', name: 'Artilharia', description: 'Alcance, perfuração e explosão; lenta e vulnerável a aproximação.',
    stats: { dano: 50, cadencia: 2, vida: 225, escudo: 135, regen: 9, velocidade: 220, projeteis: 2, perfuracao: 2, explosao: 28 },
  },
  {
    id: 'baluarte', name: 'Baluarte', description: 'Casco e escudo extremos; perde mobilidade e pressão ofensiva.',
    stats: { dano: 27, cadencia: 2.8, vida: 500, escudo: 440, regen: 24, velocidade: 185, projeteis: 2, explosao: 8 },
  },
  {
    id: 'suporte', name: 'Suporte', description: 'Regeneração, sincronia e sorte para operações longas.',
    stats: { dano: 21, cadencia: 3.6, vida: 285, escudo: 310, regen: 21, velocidade: 250, projeteis: 2, iaSkill: 0.24, sorte: 0.16 },
  },
  {
    id: 'saturacao', name: 'Saturação', description: 'Muitos projéteis e controle de espaço; cada impacto é leve.',
    stats: { dano: 16, cadencia: 4.8, vida: 225, escudo: 150, regen: 9, velocidade: 310, projeteis: 5, explosao: 28, iaSkill: 0.18 },
  },
  {
    id: 'duelista', name: 'Duelista', description: 'Crítico e precisão para eliminar alvos prioritários.',
    stats: { dano: 50, cadencia: 3, vida: 215, escudo: 115, regen: 7, velocidade: 325, projeteis: 1, critChance: 0.3, critDano: 1.15, iaSkill: 0.1 },
  },
];

export const HULL_TUNINGS: readonly HullTuning[] = [
  { id: 'equilibrado', name: 'Equilibrado', description: 'Mantém o orçamento original do arquétipo.' },
  { id: 'agressivo', name: 'Agressivo', description: 'Mais dano e cadência por menos casco e escudo.' },
  { id: 'blindado', name: 'Blindado', description: 'Mais vida, escudo e regeneração por menos velocidade.' },
  { id: 'veloz', name: 'Veloz', description: 'Mais velocidade e cadência por menos resistência.' },
  { id: 'preciso', name: 'Preciso', description: 'Mais crítico e perfuração, com tiro mais concentrado.' },
  { id: 'sincronico', name: 'Sincrônico', description: 'Melhora IA, sorte e regeneração, cedendo dano bruto.' },
];

export const HULL_WEAPONS: readonly HullWeaponProfile[] = [
  { id: 'rajada', name: 'Emissor de Rajada', description: 'Projétil leve, rápido e estável.', heavy: false, speed: 900, scale: 0.72, spread: 0.06, damageMul: .9, cadenceMul: 1.06 },
  { id: 'canhao', name: 'Canhão Vetorial', description: 'Projétil pesado de velocidade média.', heavy: true, speed: 720, scale: 0.96, spread: 0.05, damageMul: 1.12, cadenceMul: .92, pierceAdd: 1 },
  { id: 'lanca', name: 'Lança Perfurante', description: 'Disparo muito veloz e concentrado.', heavy: true, speed: 1020, scale: 0.82, spread: 0.025, damageMul: .98, cadenceMul: .94, pierceAdd: 1 },
  { id: 'bombarda', name: 'Bombarda de Cerco', description: 'Ogiva lenta para leques e explosões amplas.', heavy: true, speed: 620, scale: 1.1, spread: 0.11, damageMul: 1.2, cadenceMul: .86, splashAdd: 22 },
  { id: 'saturador', name: 'Saturador', description: 'Munição pequena para cobrir uma área larga.', heavy: false, speed: 800, scale: 0.64, spread: 0.1, damageMul: .55, cadenceMul: 1.08, projectilesAdd: 2 },
  { id: 'agulha', name: 'Agulha de Fase', description: 'Projétil mínimo, extremamente rápido e preciso.', heavy: false, speed: 1120, scale: 0.62, spread: 0.02, damageMul: 1.08, cadenceMul: .96 },
];

export const SPACESHIPS2_HULL_SPECS: readonly Spaceships2HullSpec[] = [
  { id: 'bastiao_8', name: 'Bastião 8', artId: 'spaceships2_player_p_11', archetype: 'baluarte', tuning: 'preciso', element: 'cosmico', weapon: 'canhao', blurb: 'Fortaleza de quatro núcleos; absorve a linha inimiga e responde com fogo concentrado.' },
  { id: 'centuriao_atlas', name: 'Centurião Atlas', artId: 'spaceships2_player_p_22', archetype: 'interceptor', tuning: 'equilibrado', element: 'fogo', weapon: 'rajada', blurb: 'Caça de escolta com motores externos e resposta imediata.' },
  { id: 'ariete_vesper', name: 'Aríete Vesper', artId: 'spaceships2_player_p_24', archetype: 'assalto', tuning: 'blindado', element: 'padrao', weapon: 'canhao', blurb: 'Plataforma de assalto de quatro motores, feita para atravessar bloqueios.' },
  { id: 'lamina_kheiron', name: 'Lâmina Kheiron', artId: 'spaceships2_player_p_62', archetype: 'duelista', tuning: 'agressivo', element: 'raio', weapon: 'agulha', blurb: 'Perfil estreito e reator exposto para duelos de alta velocidade.' },
  { id: 'peregrina_sol', name: 'Peregrina do Sol', artId: 'spaceships2_player_n_9', archetype: 'artilharia', tuning: 'sincronico', element: 'fogo', weapon: 'lanca', blurb: 'Casco longitudinal que transforma alinhamento perfeito em alcance.' },
  { id: 'lince_polar', name: 'Lince Polar', artId: 'spaceships2_player_n_11', archetype: 'suporte', tuning: 'veloz', element: 'gelo', weapon: 'rajada', blurb: 'Unidade compacta de reconhecimento e assistência criogênica.' },
  { id: 'cerbero_azul', name: 'Cérbero Azul', artId: 'spaceships2_player_n_15', archetype: 'interceptor', tuning: 'preciso', element: 'raio', weapon: 'agulha', blurb: 'Três vetores de impulso mantêm a mira estável durante a evasão.' },
  { id: 'vipera_helix', name: 'Víbora Helix', artId: 'spaceships2_player_n_21', archetype: 'artilharia', tuning: 'blindado', element: 'padrao', weapon: 'bombarda', blurb: 'Quatro casulos laterais alimentam uma bombarda de longo curso.' },
  { id: 'draco_viridiano', name: 'Draco Viridiano', artId: 'spaceships2_player_d_6', archetype: 'duelista', tuning: 'veloz', element: 'quimico', weapon: 'agulha', blurb: 'Casco biometálico que caça pelo ponto fraco, nunca pelo volume.' },
  { id: 'oraculo_safira', name: 'Oráculo Safira', artId: 'spaceships2_player_d_12', archetype: 'suporte', tuning: 'preciso', element: 'gelo', weapon: 'lanca', blurb: 'Anéis sensoriais calculam a trajetória antes de o alvo manobrar.' },
  { id: 'talon_ignifero', name: 'Talon Ignífero', artId: 'spaceships2_player_d_16', archetype: 'assalto', tuning: 'agressivo', element: 'fogo', weapon: 'rajada', blurb: 'Asas cortantes e câmaras térmicas para pressão frontal contínua.' },
  { id: 'arraia_boreal', name: 'Arraia Boreal', artId: 'spaceships2_player_d_17', archetype: 'interceptor', tuning: 'blindado', element: 'gelo', weapon: 'agulha', blurb: 'Interceptador largo com placas criogênicas capazes de aceitar impacto.' },
  { id: 'martelo_helios', name: 'Martelo Hélios', artId: 'spaceships2_player_d_19', archetype: 'artilharia', tuning: 'agressivo', element: 'fogo', weapon: 'bombarda', blurb: 'Motores e depósitos orbitam uma câmara de cerco incandescente.' },
  { id: 'asa_carmim', name: 'Asa Carmim', artId: 'spaceships2_player_d_23', archetype: 'saturacao', tuning: 'veloz', element: 'padrao', weapon: 'saturador', blurb: 'Duas lâminas laterais abrem espaço para uma cortina de projéteis.' },
  { id: 'condor_magma', name: 'Condor Magma', artId: 'spaceships2_player_d_32', archetype: 'artilharia', tuning: 'equilibrado', element: 'fogo', weapon: 'bombarda', blurb: 'Arsenal industrial compacto, estável mesmo em salvas completas.' },
  { id: 'navegante_nox', name: 'Navegante Nox', artId: 'spaceships2_player_d_35', archetype: 'suporte', tuning: 'sincronico', element: 'cosmico', weapon: 'canhao', blurb: 'Sensores do Vazio e três motores mantêm a frota em sincronia.' },
  { id: 'quimera_verde', name: 'Quimera Verde', artId: 'spaceships2_player_d_39', archetype: 'assalto', tuning: 'sincronico', element: 'quimico', weapon: 'saturador', blurb: 'Blindagem viva converte resíduos de combate em estabilidade.' },
  { id: 'seta_quantica', name: 'Seta Quântica', artId: 'spaceships2_player_d_49', archetype: 'interceptor', tuning: 'agressivo', element: 'raio', weapon: 'lanca', blurb: 'O anel traseiro comprime o disparo e lança o casco junto dele.' },
  { id: 'rapina_ambar', name: 'Rapina Âmbar', artId: 'spaceships2_player_d_50', archetype: 'duelista', tuning: 'equilibrado', element: 'fogo', weapon: 'agulha', blurb: 'Caça de precisão sem massa sobrando entre piloto e alvo.' },
  { id: 'leviata_ferro', name: 'Leviatã de Ferro', artId: 'spaceships2_player_d_52', archetype: 'baluarte', tuning: 'agressivo', element: 'padrao', weapon: 'bombarda', blurb: 'Uma muralha de motores e paióis que avança disparando.' },
  { id: 'tridente_violeta', name: 'Tridente Violeta', artId: 'spaceships2_player_d_55', archetype: 'suporte', tuning: 'agressivo', element: 'cosmico', weapon: 'rajada', blurb: 'Três emissores compartilham alvo, energia e solução de tiro.' },
  { id: 'aurora_negra', name: 'Aurora Negra', artId: 'spaceships2_player_d_60', archetype: 'assalto', tuning: 'veloz', element: 'cosmico', weapon: 'canhao', blurb: 'Assinatura baixa, aceleração alta e descarga de curta distância.' },
  { id: 'eclipse_rubro', name: 'Eclipse Rubro', artId: 'spaceships2_player_d_64', archetype: 'duelista', tuning: 'sincronico', element: 'cosmico', weapon: 'agulha', blurb: 'Caçador furtivo que entrega o disparo à IA no instante ideal.' },
  { id: 'nemesis_alada', name: 'Nêmesis Alada', artId: 'spaceships2_player_legacy_p_16', archetype: 'artilharia', tuning: 'preciso', element: 'cosmico', weapon: 'lanca', blurb: 'Canhões dorsais gêmeos transformam a fuselagem inteira numa mira.' },
  { id: 'arca_turquesa', name: 'Arca Turquesa', artId: 'spaceships2_player_legacy_p_60', archetype: 'baluarte', tuning: 'sincronico', element: 'quimico', weapon: 'canhao', blurb: 'Nave-colônia compacta: sobrevive, repara e mantém a missão viva.' },
  { id: 'vanguarda_dez', name: 'Vanguarda Dez', artId: 'spaceships2_player_legacy_n_10', archetype: 'suporte', tuning: 'equilibrado', element: 'raio', weapon: 'lanca', blurb: 'Casco modular de patrulha com sensores distribuídos no eixo central.' },
  { id: 'fornalha_dezenove', name: 'Fornalha Dezenove', artId: 'spaceships2_player_legacy_n_19', archetype: 'artilharia', tuning: 'blindado', element: 'fogo', weapon: 'bombarda', blurb: 'Reator industrial acoplado diretamente ao tubo de lançamento.' },
  { id: 'custodio_vinte_tres', name: 'Custódio Vinte e Três', artId: 'spaceships2_player_legacy_n_23', archetype: 'baluarte', tuning: 'equilibrado', element: 'padrao', weapon: 'canhao', blurb: 'Fragata de carga convertida em escudo móvel para a frota.' },
  { id: 'horizonte_trinta', name: 'Horizonte Trinta', artId: 'spaceships2_player_legacy_n_30', archetype: 'assalto', tuning: 'preciso', element: 'quimico', weapon: 'rajada', blurb: 'Protótipo de fronteira equilibrado entre pressão e leitura tática.' },
];

const ART = new Map<string, Spaceship2Art>([
  ...SPACESHIPS2_PLAYER_ART,
  ...SPACESHIPS2_LEGACY_PLAYER_ART,
].map((art) => [art.id, art]));

const ARCHETYPE = new Map(HULL_ARCHETYPES.map((profile) => [profile.id, profile]));
const WEAPON = new Map(HULL_WEAPONS.map((profile) => [profile.id, profile]));

const scaled = (value: number | undefined, multiplier: number): number | undefined =>
  value === undefined ? undefined : Math.round(value * multiplier * 1000) / 1000;
const rounded = (value: number): number => Math.round(value * 1000) / 1000;

function tuneStats(base: StatMap, tuning: HullTuningId): StatMap {
  const stats = { ...base };
  const mul = (key: keyof StatMap, multiplier: number) => {
    const value = scaled(stats[key], multiplier);
    if (value !== undefined) stats[key] = value;
  };
  switch (tuning) {
    case 'agressivo':
      mul('dano', 1.15); mul('cadencia', 1.08); mul('vida', 0.9); mul('escudo', 0.85);
      break;
    case 'blindado':
      mul('vida', 1.22); mul('escudo', 1.25); mul('regen', 1.18); mul('velocidade', 0.88); mul('dano', 0.92);
      break;
    case 'veloz':
      mul('velocidade', 1.18); mul('cadencia', 1.05); mul('vida', 0.9); mul('escudo', 0.9);
      break;
    case 'preciso':
      mul('dano', 1.05); stats.critChance = rounded((stats.critChance ?? 0) + 0.12);
      stats.critDano = rounded((stats.critDano ?? 0) + 0.45); stats.perfuracao = (stats.perfuracao ?? 0) + 1;
      break;
    case 'sincronico':
      mul('dano', 0.95); mul('regen', 1.12); stats.iaSkill = rounded((stats.iaSkill ?? 0) + 0.18);
      stats.sorte = rounded((stats.sorte ?? 0) + 0.12);
      break;
    case 'equilibrado':
      break;
  }
  return stats;
}

function buildShot(elementId: ElementId, weaponId: HullWeaponId): ShotStyle {
  const element = getElement(elementId);
  const weapon = WEAPON.get(weaponId)!;
  return {
    sprite: element.bullet[weapon.heavy ? 0 : 1],
    speed: weapon.speed,
    color: element.color,
    scale: weapon.scale,
    spread: weapon.spread,
  };
}

function applyWeaponStats(base: StatMap, weaponId: HullWeaponId): StatMap {
  const weapon = WEAPON.get(weaponId)!;
  return {
    ...base,
    dano: rounded((base.dano ?? 0) * weapon.damageMul),
    cadencia: rounded((base.cadencia ?? 0) * weapon.cadenceMul),
    projeteis: Math.max(1, Math.round((base.projeteis ?? 1) + (weapon.projectilesAdd ?? 0))),
    perfuracao: Math.max(0, Math.round((base.perfuracao ?? 0) + (weapon.pierceAdd ?? 0))),
    explosao: Math.max(0, rounded((base.explosao ?? 0) + (weapon.splashAdd ?? 0))),
  };
}

export const SPACESHIPS2_HULLS: readonly Hull[] = SPACESHIPS2_HULL_SPECS.map((spec, index) => {
  const art = ART.get(spec.artId)!;
  const archetype = ARCHETYPE.get(spec.archetype)!;
  const element = getElement(spec.element);
  const exhaust = (index % 6) + 1;
  return {
    id: spec.id,
    name: spec.name,
    // Mesmo orçamento-base: são alternativas táticas, não uma escada de poder.
    tier: 4,
    element: spec.element,
    blurb: spec.blurb,
    sprite: art.sprite,
    scale: art.scale,
    barSprite: art.sprite,
    barExhaust: `hull/ship${exhaust}_exhaust_idle_`,
    trail: element.glow,
    shot: buildShot(spec.element, spec.weapon),
    stats: applyWeaponStats(tuneStats(archetype.stats, spec.tuning), spec.weapon),
    // O desbloqueio autoral será desenhado depois. Até lá, os cascos entram na
    // frota inicial sem custo para poderem participar da campanha real.
    cost: 0,
    requiresSector: 0,
  };
});

export const SPACESHIPS2_HULL_SPEC_BY_ID = new Map(SPACESHIPS2_HULL_SPECS.map((spec) => [spec.id, spec]));
