import type { ResourceId } from '@sim/types';

export type ShopCategory = 'logistica' | 'sistemas' | 'cambio';
export type ShopKind = 'permanente' | 'servico' | 'cambio';

export type ShopEffect =
  | 'carga'
  | 'refaz_matriz'
  | 'tentativa_provacao'
  | 'sucata_para_nucleo'
  | 'elemento_item'
  | 'elemento_nave';

/**
 * Serviços que precisam de um ALVO antes de cobrar.
 *
 * O resto do catálogo é um botão só: paga e acontece. Estes dois não podem
 * ser — "trocar o elemento" sem dizer de quê e para quê cobraria por uma
 * decisão que o jogador ainda não tomou. O painel vê este campo e abre um
 * seletor em vez de comprar direto.
 */
export type ShopAlvo = 'item' | 'nave';

export interface ShopQuota {
  /** Operações liberadas desde o começo. */
  base: number;
  /** A cada N níveis de comando uma nova operação entra no estoque. */
  everyLevels: number;
  /** Teto absoluto de operações desta linha. */
  cap: number;
}

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  detail: string;
  /** Arte exclusiva do serviço; não reutiliza sprites de recursos ou equipamentos. */
  art: string;
  category: ShopCategory;
  kind: ShopKind;
  currency: ResourceId;
  /** Custo da primeira compra. */
  cost: number;
  /** Escala geométrica apenas para contratos permanentes. */
  growth: number;
  /** Níveis máximos do contrato permanente. Zero = não se aplica. */
  max: number;
  effect: ShopEffect;
  /** Recurso entregue por uma operação de câmbio. */
  output?: Partial<Record<ResourceId, number>>;
  /** Estoque que cresce com o nível, evitando conversão infinita. */
  quota?: ShopQuota;
  requiresSector?: number;
  /** Serviço que exige escolher um alvo antes de cobrar. */
  alvo?: ShopAlvo;
}

/**
 * Central de Serviços.
 *
 * A loja antiga vendia Sorte, XP, cura e multiplicadores de renda permanentes.
 * Isso a transformava numa quarta fonte de progressão ao lado de item, craft e
 * Matriz. O catálogo novo não possui `stat`: ele movimenta logística, devolve
 * tempo ou converte recursos com perda.
 *
 * Cápsulas também saíram daqui. Elas pertencem à Câmara de Aquisição, que já
 * mostra probabilidades e identidade de cada uma; duplicar a compra em outra
 * tela esconderia informação justamente no momento da decisão.
 */
export const SHOP: readonly ShopItem[] = [
  {
    id: 'carga', name: 'Módulo de Carga', category: 'logistica', kind: 'permanente',
    desc: '+5 espaços de equipamento e +5 tipos de material.',
    detail: 'Instala um compartimento físico permanente. Existem quatro módulos, cada um registrado separadamente no manifesto da nave.',
    art: 'loja_servico_carga.webp', currency: 'nucleo', cost: 400, growth: 1.85, max: 4,
    effect: 'carga',
  },
  {
    id: 'elemento_item', name: 'Recalibrador de Munição', category: 'sistemas', kind: 'servico',
    desc: 'Converte uma peça do inventário para outro elemento.',
    detail: 'A peça mantém nível, raridade e afixos — só a assinatura elemental muda. É o que impede um achado raro de elemento errado de virar peso morto: nave só monta neutro ou do próprio elemento.',
    art: 'loja_servico_matriz.webp', currency: 'cristal', cost: 6, growth: 1, max: 0,
    effect: 'elemento_item', alvo: 'item',
  },
  {
    id: 'elemento_nave', name: 'Reator de Assinatura', category: 'sistemas', kind: 'servico',
    desc: 'Troca o elemento de uma nave da frota.',
    detail: 'Não desmonta o conjunto: as peças que deixarem de servir continuam instaladas até você decidir o que fazer com elas. Custa cinco vezes mais que recalibrar uma peça — mudar a identidade da nave é decisão, não ajuste.',
    art: 'loja_servico_matriz.webp', currency: 'cristal', cost: 30, growth: 1, max: 0,
    effect: 'elemento_nave', alvo: 'nave', requiresSector: 8,
  },
  {
    id: 'refaz_matriz', name: 'Chave de Reconfiguração', category: 'sistemas', kind: 'servico',
    desc: 'Devolve todos os pontos alocados na Matriz.',
    detail: 'Não concede pontos nem atributos. Apenas permite redistribuir o poder que o nível de comando já conquistou.',
    art: 'loja_servico_matriz.webp', currency: 'cristal', cost: 25, growth: 1, max: 0,
    effect: 'refaz_matriz', requiresSector: 5,
  },
  {
    id: 'tentativa_provacao', name: 'Carga de Provação', category: 'sistemas', kind: 'servico',
    desc: 'Recupera imediatamente 1 tentativa, sem ultrapassar o teto.',
    detail: 'Compra tempo de recarga. Respeita o teto atual da conta e não concede nenhuma vitória.',
    art: 'loja_servico_tentativa.webp', currency: 'cristal', cost: 12, growth: 1, max: 0,
    effect: 'tentativa_provacao',
  },
  {
    id: 'compactar_sucata', name: 'Compactação Industrial', category: 'cambio', kind: 'cambio',
    desc: 'Converte 6.000 de sucata em 200 núcleos.',
    detail: 'A oficina reaproveita volume bruto com forte perda. O estoque de operações cresce junto do nível de comando.',
    art: 'loja_servico_compactacao.webp', currency: 'sucata', cost: 6000, growth: 1, max: 0,
    output: { nucleo: 200 }, effect: 'sucata_para_nucleo', requiresSector: 3,
    quota: { base: 4, everyLevels: 5, cap: 50 },
  },
];

export const SHOP_BY_ID = new Map(SHOP.map((s) => [s.id, s]));

export function shopCost(item: ShopItem, owned: number): number {
  return item.kind === 'permanente'
    ? Math.ceil(item.cost * Math.pow(item.growth, owned))
    : item.cost;
}

/** Zero significa que a linha não possui limite por quantidade. */
export function shopLimit(item: ShopItem, commandLevel: number): number {
  if (item.kind === 'permanente') return item.max;
  if (!item.quota) return 0;
  const extras = Math.floor(Math.max(0, commandLevel - 1) / item.quota.everyLevels);
  return Math.min(item.quota.cap, item.quota.base + extras);
}

/** Cada módulo corresponde a uma concessão idempotente do registro de carga. */
export const SHOP_CARGO_IDS = [
  'loja_carga_1', 'loja_carga_2', 'loja_carga_3', 'loja_carga_4',
] as const;
