import type { ResourceId } from '@sim/types';

export type ShopCategory = 'logistica' | 'sistemas' | 'cambio';
export type ShopKind = 'permanente' | 'servico' | 'cambio';

export type ShopEffect =
  | 'carga'
  | 'refaz_matriz'
  | 'tentativa_provacao'
  | 'sucata_para_nucleo'
  | 'nucleo_para_cristal';

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
    id: 'refaz_matriz', name: 'Chave de Reconfiguração', category: 'sistemas', kind: 'servico',
    desc: 'Devolve todos os pontos alocados na Matriz.',
    detail: 'Não concede pontos nem atributos. Apenas permite redistribuir o poder que o nível de comando já conquistou.',
    art: 'loja_servico_matriz.webp', currency: 'cristal', cost: 25, growth: 1, max: 0,
    effect: 'refaz_matriz', requiresSector: 5,
  },
  {
    id: 'tentativa_provacao', name: 'Carga de Provação', category: 'sistemas', kind: 'servico',
    desc: 'Recupera imediatamente 1 tentativa, sem ultrapassar o teto.',
    detail: 'Compra tempo de recarga. O limite continua sendo cinco tentativas e nenhuma vitória é concedida pela loja.',
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
  {
    id: 'refinar_nucleo', name: 'Refino de Cristal', category: 'cambio', kind: 'cambio',
    desc: 'Converte 1.200 núcleos em 5 cristais.',
    detail: 'Uma conversão rara e limitada. Ela reduz excesso de núcleo sem transformar a patrulha numa fábrica infinita de cristais.',
    art: 'loja_servico_refino.webp', currency: 'nucleo', cost: 1200, growth: 1, max: 0,
    output: { cristal: 5 }, effect: 'nucleo_para_cristal', requiresSector: 10,
    quota: { base: 1, everyLevels: 15, cap: 20 },
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
