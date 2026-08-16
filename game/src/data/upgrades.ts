import type { ResourceId, StatId } from '@sim/types';

export type UpgradeCategory = 'armamento' | 'casco' | 'pilotagem' | 'logistica';

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  desc: string;
  icon: string;
  stat: StatId;
  kind: 'add' | 'mul';
  /** Ganho por nível. */
  per: number;
  maxLevel: number;
  currency: ResourceId;
  /** Custo do primeiro nível. */
  cost: number;
  /** Fator geométrico do custo por nível. */
  growth: number;
  /** Setor recorde mínimo para o nó aparecer. */
  requiresSector?: number;
}

export const UPGRADE_CATEGORIES: { id: UpgradeCategory; name: string; hint: string }[] = [
  { id: 'armamento', name: 'Armamento', hint: 'Tudo que faz o inimigo virar poeira mais rápido.' },
  { id: 'casco', name: 'Casco', hint: 'Sobreviver é pré-requisito para progredir.' },
  { id: 'pilotagem', name: 'Pilotagem', hint: 'Melhora o piloto de IA que conduz a camada vertical.' },
  { id: 'logistica', name: 'Logística', hint: 'Rendimento da patrulha e qualidade do que você recolhe.' },
];

export const UPGRADES: readonly UpgradeDef[] = [
  // ── armamento ─────────────────────────────────────────────────────────────
  { id: 'calibre', name: 'Calibre Pesado', category: 'armamento', desc: '+8% de dano por nível.', icon: 'powerup/icon_damage', stat: 'dano', kind: 'mul', per: 0.08, maxLevel: 400, currency: 'sucata', cost: 25, growth: 1.14 },
  { id: 'refrigeracao', name: 'Refrigeração', category: 'armamento', desc: '+4% de cadência por nível.', icon: 'powerup/icon_rapid', stat: 'cadencia', kind: 'mul', per: 0.04, maxLevel: 200, currency: 'sucata', cost: 60, growth: 1.17 },
  { id: 'mira_critica', name: 'Mira Crítica', category: 'armamento', desc: '+0.8% de chance de crítico por nível.', icon: 'ui/icon_star', stat: 'critChance', kind: 'add', per: 0.008, maxLevel: 60, currency: 'nucleo', cost: 12, growth: 1.22, requiresSector: 6 },
  { id: 'carga_oca', name: 'Carga Oca', category: 'armamento', desc: '+12% de dano crítico por nível.', icon: 'ui/icon_star', stat: 'critDano', kind: 'add', per: 0.12, maxLevel: 100, currency: 'nucleo', cost: 18, growth: 1.2, requiresSector: 6 },
  { id: 'ogiva', name: 'Ogiva Fragmentária', category: 'armamento', desc: '+2 de raio de explosão por nível.', icon: 'fx/blast_fire_2', stat: 'explosao', kind: 'add', per: 2, maxLevel: 40, currency: 'nucleo', cost: 40, growth: 1.28, requiresSector: 15 },
  { id: 'salva', name: 'Salva Extra', category: 'armamento', desc: '+1 projétil por nível. Caro por um bom motivo.', icon: 'shot/ion_heavy', stat: 'projeteis', kind: 'add', per: 1, maxLevel: 8, currency: 'cristal', cost: 40, growth: 2.4, requiresSector: 18 },
  { id: 'penetrador', name: 'Penetrador', category: 'armamento', desc: '+1 de perfuração por nível.', icon: 'beam/lance', stat: 'perfuracao', kind: 'add', per: 1, maxLevel: 10, currency: 'cristal', cost: 30, growth: 2.1, requiresSector: 22 },

  // ── casco ─────────────────────────────────────────────────────────────────
  { id: 'blindagem', name: 'Blindagem', category: 'casco', desc: '+9% de casco por nível.', icon: 'ui/icon_heart', stat: 'vida', kind: 'mul', per: 0.09, maxLevel: 400, currency: 'sucata', cost: 20, growth: 1.13 },
  { id: 'barreira', name: 'Barreira', category: 'casco', desc: '+10% de escudo por nível.', icon: 'powerup/icon_shield', stat: 'escudo', kind: 'mul', per: 0.1, maxLevel: 300, currency: 'sucata', cost: 45, growth: 1.15 },
  { id: 'recarga', name: 'Recarga do Defletor', category: 'casco', desc: '+0.9 de regeneração de escudo por segundo.', icon: 'powerup/icon_shield', stat: 'regen', kind: 'add', per: 0.9, maxLevel: 120, currency: 'nucleo', cost: 15, growth: 1.19, requiresSector: 4 },

  // ── pilotagem ─────────────────────────────────────────────────────────────
  { id: 'reflexos', name: 'Reflexos Sintéticos', category: 'pilotagem', desc: '+2% de sincronia do piloto. Reação e desvio melhores.', icon: 'drone/idle_0', stat: 'iaSkill', kind: 'add', per: 0.02, maxLevel: 40, currency: 'nucleo', cost: 25, growth: 1.24 },
  { id: 'vetorizacao', name: 'Vetorização', category: 'pilotagem', desc: '+5% de velocidade de manobra por nível.', icon: 'powerup/icon_rapid', stat: 'velocidade', kind: 'mul', per: 0.05, maxLevel: 80, currency: 'sucata', cost: 90, growth: 1.18 },
  { id: 'preditor', name: 'Preditor Balístico', category: 'pilotagem', desc: '+3% de sincronia. O piloto lidera o alvo com mais precisão.', icon: 'ui/icon_star', stat: 'iaSkill', kind: 'add', per: 0.03, maxLevel: 25, currency: 'cristal', cost: 25, growth: 1.9, requiresSector: 20 },

  // ── logística ─────────────────────────────────────────────────────────────
  { id: 'guincho', name: 'Guincho de Sucata', category: 'logistica', desc: '+12% de sucata da patrulha por nível.', icon: 'ui/icon_coin', stat: 'sucataGanho', kind: 'mul', per: 0.12, maxLevel: 300, currency: 'sucata', cost: 30, growth: 1.15 },
  { id: 'extrator', name: 'Extrator de Núcleos', category: 'logistica', desc: '+9% de núcleos por abate na vertical.', icon: 'ui/icon_coin', stat: 'nucleoGanho', kind: 'mul', per: 0.09, maxLevel: 200, currency: 'nucleo', cost: 20, growth: 1.18, requiresSector: 5 },
  { id: 'sensor', name: 'Sensor de Relíquias', category: 'logistica', desc: '+3% de sorte por nível: mais drops e melhores.', icon: 'powerup/icon_bounty', stat: 'sorte', kind: 'add', per: 0.03, maxLevel: 60, currency: 'nucleo', cost: 35, growth: 1.23, requiresSector: 10 },
  { id: 'arquivo', name: 'Arquivo de Combate', category: 'logistica', desc: '+10% de XP de patrulha por nível.', icon: 'ui/icon_star', stat: 'xpGanho', kind: 'mul', per: 0.1, maxLevel: 150, currency: 'sucata', cost: 70, growth: 1.16 },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

/** Custo do próximo nível (`level` = níveis já comprados). */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.ceil(def.cost * Math.pow(def.growth, level));
}

/** Custo total de comprar `count` níveis a partir de `level`. */
export function upgradeBulkCost(def: UpgradeDef, level: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += upgradeCost(def, level + i);
  return total;
}

