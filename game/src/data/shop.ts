import type { ResourceId, StatId } from '@sim/types';

export type ShopKind =
  /** Compra repetível que some ao usar (baús). */
  | 'consumivel'
  /** Melhoria permanente com níveis e custo crescente. */
  | 'permanente';

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: ShopKind;
  currency: ResourceId;
  /** Custo do primeiro nível / da primeira unidade. */
  cost: number;
  /** Fator geométrico por compra. 1 = preço fixo. */
  growth: number;
  /** Quantas vezes pode ser comprado. 0 = sem limite. */
  max: number;
  /** Efeito, quando é uma melhoria de atributo. */
  stat?: { id: StatId; kind: 'add' | 'mul'; per: number };
  /** Efeito especial, tratado à mão pela simulação. */
  effect?: 'carga' | 'imã' | 'reparo' | 'bau_bronze' | 'bau_prata' | 'bau_ouro' | 'bau_singularidade' | 'refaz';
  /** Setor recorde mínimo para aparecer na prateleira. */
  requiresSector?: number;
}

/**
 * Loja de utilidades.
 *
 * Serve ao recurso que sobra. Sucata acumula sozinha com a patrulha e núcleos
 * vêm de desmanche, então sem um ralo permanente eles viram números mortos no
 * topo da tela. Cristais são raros e compram o que realmente atalha: baús e
 * capacidade.
 *
 * Nada aqui é exclusivo — tudo pode ser obtido jogando. A loja compra TEMPO,
 * não poder que o jogo não dê de outra forma.
 */
export const SHOP: readonly ShopItem[] = [
  // ── logística ─────────────────────────────────────────────────────────────
  {
    id: 'carga', name: 'Expansão de Carga', kind: 'permanente',
    desc: '+7 espaços no inventário. Uma fileira inteira da grade.',
    icon: 'powerup/icon_bounty', currency: 'nucleo', cost: 400, growth: 1.75, max: 20,
    effect: 'carga',
  },
  {
    id: 'ima', name: 'Bobina de Atração', kind: 'permanente',
    desc: '+18% no alcance do ímã de coleta. Menos cápsulas perdidas pela base.',
    icon: 'powerup/icon_rapid', currency: 'nucleo', cost: 300, growth: 1.6, max: 12,
    effect: 'imã',
  },
  {
    id: 'reparo', name: 'Doca de Campo', kind: 'permanente',
    desc: 'Recupera +8% do casco ao limpar cada onda.',
    icon: 'ui/icon_heart', currency: 'nucleo', cost: 900, growth: 1.9, max: 8,
    effect: 'reparo',
  },

  // ── contratos: sucata vira rendimento ─────────────────────────────────────
  {
    id: 'contrato_sucata', name: 'Contrato de Sucata', kind: 'permanente',
    desc: '+20% de sucata da patrulha, para sempre.',
    icon: 'ui/icon_coin', currency: 'sucata', cost: 5000, growth: 1.55, max: 40,
    stat: { id: 'sucataGanho', kind: 'mul', per: 0.2 },
  },
  {
    id: 'contrato_nucleo', name: 'Contrato de Extração', kind: 'permanente',
    desc: '+15% de núcleos por abate.',
    icon: 'powerup/icon_shield', currency: 'sucata', cost: 12000, growth: 1.6, max: 30,
    stat: { id: 'nucleoGanho', kind: 'mul', per: 0.15 },
    requiresSector: 8,
  },
  {
    id: 'contrato_xp', name: 'Arquivo de Missão', kind: 'permanente',
    desc: '+18% de XP de comando — a matriz abre mais rápido.',
    icon: 'node/exp', currency: 'sucata', cost: 20000, growth: 1.65, max: 25,
    stat: { id: 'xpGanho', kind: 'mul', per: 0.18 },
    requiresSector: 12,
  },
  {
    id: 'licenca_sorte', name: 'Licença de Prospecção', kind: 'permanente',
    desc: '+6% de sorte. Mais drops e de melhor raridade.',
    icon: 'powerup/icon_bounty', currency: 'cristal', cost: 40, growth: 1.5, max: 25,
    stat: { id: 'sorte', kind: 'add', per: 0.06 },
    requiresSector: 15,
  },

  // ── consumíveis ───────────────────────────────────────────────────────────
  {
    id: 'bau_bronze', name: 'Cápsula de Bronze', kind: 'consumivel',
    desc: '1–2 itens do nível do setor atual.',
    icon: 'powerup/icon_bounty', currency: 'nucleo', cost: 250, growth: 1, max: 0,
    effect: 'bau_bronze',
  },
  {
    id: 'bau_prata', name: 'Cápsula de Prata', kind: 'consumivel',
    desc: '2–3 itens, nível +2, piso incomum.',
    icon: 'powerup/icon_bounty', currency: 'cristal', cost: 15, growth: 1, max: 0,
    effect: 'bau_prata',
  },
  {
    id: 'bau_ouro', name: 'Cápsula de Ouro', kind: 'consumivel',
    desc: '3–4 itens, nível +5, piso raro.',
    icon: 'powerup/icon_bounty', currency: 'cristal', cost: 60, growth: 1, max: 0,
    effect: 'bau_ouro',
    requiresSector: 10,
  },
  {
    id: 'bau_singularidade', name: 'Singularidade', kind: 'consumivel',
    desc: '4–6 itens, nível +10, piso épico.',
    icon: 'ui/icon_star', currency: 'cristal', cost: 240, growth: 1, max: 0,
    effect: 'bau_singularidade',
    requiresSector: 25,
  },
  {
    id: 'refaz', name: 'Reconfigurar Matriz', kind: 'consumivel',
    desc: 'Devolve todos os pontos alocados na matriz.',
    icon: 'node/cooldown', currency: 'cristal', cost: 25, growth: 1, max: 0,
    effect: 'refaz',
    requiresSector: 5,
  },
];

export const SHOP_BY_ID = new Map(SHOP.map((s) => [s.id, s]));

/** Custo da próxima compra, dado quantas já foram feitas. */
export function shopCost(item: ShopItem, owned: number): number {
  return Math.ceil(item.cost * Math.pow(item.growth, owned));
}

/** Espaços de inventário concedidos pela loja. */
export const CARGO_PER_LEVEL = 7;
/** Ganho de alcance do ímã por nível, em fração. */
export const MAGNET_PER_LEVEL = 0.18;
/** Cura por onda limpa, em fração do casco. */
export const REPAIR_PER_LEVEL = 0.08;
