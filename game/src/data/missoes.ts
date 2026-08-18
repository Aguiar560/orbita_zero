import type { ElementId, Rarity, ResourceId, SlotId } from '@sim/types';

/**
 * Missões (§27).
 *
 * O §27 pede ARQUITETURA para um sistema futuro, não um punhado de missões. Por
 * isso o que este arquivo entrega é o formato — e um catálogo inicial que serve
 * de prova de que o formato aguenta as quatro categorias pedidas.
 *
 * ## A decisão que organiza tudo: um funil só
 *
 * Missão não observa o jogo em vários lugares. O jogo REPORTA fatos num ponto
 * único (`Sim.registrar`), e cada missão declara — como DADO, não como função —
 * qual fato conta e sob que filtro.
 *
 * A alternativa óbvia era cada tipo de missão pendurar-se onde seu evento
 * acontece: "matar" no abate, "coletar" no drop, "concluir fase" no avanço de
 * setor. Isso funciona para as quatro categorias de hoje e cobra caro na quinta:
 * cada categoria nova exigiria achar e editar o ponto certo do `sim`, e cada
 * ponto do `sim` passaria a saber que missões existem. Com o funil, missão nova
 * é LINHA DE TABELA — que é exatamente o que "preparar arquitetura" quer dizer,
 * e o que permite ao `content-data-agent` trabalhar em volume sem tocar em
 * lógica.
 *
 * O preço é reportar fatos que ninguém consome ainda. É barato: um objeto por
 * evento, descartado na hora se nenhuma missão ativa se importa.
 */

// ── os fatos que o jogo reporta ─────────────────────────────────────────────

/**
 * Tudo que pode acontecer e que uma missão pode querer contar.
 *
 * União discriminada por `tipo`, e não um `{ evento: string; dados: any }`: o
 * compilador precisa saber que `abate` tem `elemento` e `fusao` não, senão o
 * filtro de uma missão poderia pedir campo que aquele fato nunca traz e falhar
 * calado em produção.
 */
export type FatoDeJogo =
  | { tipo: 'abate'; inimigo: string; elemento: ElementId; chefe: boolean; setor: number }
  | { tipo: 'chefe'; chefeId: string; setor: number }
  | { tipo: 'recurso'; recurso: string; quantidade: number }
  | { tipo: 'moeda'; moeda: ResourceId; quantidade: number }
  | { tipo: 'item'; raridade: Rarity; slot: SlotId; elemento: ElementId }
  | { tipo: 'setor'; setor: number; galaxia: number }
  | { tipo: 'galaxia'; galaxia: number }
  | { tipo: 'nivel'; qual: 'nave' | 'patrulha' | 'personagem'; nivel: number }
  | { tipo: 'fusao'; entrada: Rarity; saida: Rarity; subiu: boolean }
  | { tipo: 'bau'; tier: string };

export type TipoDeFato = FatoDeJogo['tipo'];

/**
 * Filtro de um objetivo, em dados.
 *
 * Todo campo é opcional e todos os presentes precisam casar (E, não OU). Um
 * campo que o fato não tem nunca casa — é o que impede "matar 10 inimigos de
 * fogo" de contar a conclusão de um setor.
 */
export interface FiltroDeFato {
  inimigo?: string;
  chefeId?: string;
  elemento?: ElementId;
  chefe?: boolean;
  recurso?: string;
  moeda?: ResourceId;
  slot?: SlotId;
  raridadeMin?: Rarity;
  /** Para `fusao`: só conta quando subiu de raridade. */
  subiu?: boolean;
  /** Setor/galáxia mínimos — permite missão "mate 50 no setor 40 ou além". */
  setorMin?: number;
  galaxiaMin?: number;
  nivelMin?: number;
  qual?: 'nave' | 'patrulha' | 'personagem';
  tier?: string;
}

export interface Objetivo {
  /** Que fato este objetivo conta. */
  fato: TipoDeFato;
  /** Quantos, no total. */
  alvo: number;
  filtro?: FiltroDeFato;
  /**
   * O fato soma `quantidade` em vez de 1.
   *
   * Vale para recurso e moeda: "colete 5.000 de sucata" tem de andar 5.000 de
   * uma vez, não um por evento. Para abate seria errado — daí não ser padrão.
   */
  somaQuantidade?: boolean;
  /** Texto curto do objetivo, para a tela. */
  texto: string;
}

// ── recompensas ─────────────────────────────────────────────────────────────

export interface Recompensa {
  moedas?: Partial<Record<ResourceId, number>>;
  /** Materiais do Armazém, por id de recurso. */
  materiais?: Record<string, number>;
  xp?: number;
  /**
   * Medalhas (§27).
   *
   * Contador PRÓPRIO, fora de `resources`: medalha não se gasta em loja nem
   * entra em nenhuma fórmula de poder. É registro de feito, e misturá-la às
   * três moedas faria toda conta de economia ter de aprender a ignorá-la.
   */
  medalhas?: number;
  /** Itens gerados na entrega. */
  itens?: { quantidade: number; raridadeMin?: Rarity; ilvlBonus?: number };
  /** Baús, por tier. */
  baus?: Record<string, number>;
  /**
   * Concessão de carga (§28), por id de `capacidade.ts`.
   *
   * O registro de concessões já previa missão como fonte desde a 3.7 — esta é a
   * ponta que faltava. Idempotente por id: repetir a missão não amplia de novo.
   */
  concessao?: string;
}

// ── as missões ──────────────────────────────────────────────────────────────

export type CategoriaDeMissao = 'eliminacao' | 'coleta' | 'entrega' | 'progressao';

/**
 * Ritmo da missão.
 *
 * `campanha` é permanente e conta desde sempre; `diaria` e `semanal` reciclam.
 * O campo existe agora, mesmo sem rotação implementada, porque ele muda a forma
 * do progresso salvo — descobrir isso depois obrigaria a migrar save.
 */
export type RitmoDeMissao = 'campanha' | 'diaria' | 'semanal';

export interface MissaoDef {
  id: string;
  nome: string;
  descricao: string;
  categoria: CategoriaDeMissao;
  ritmo: RitmoDeMissao;
  /**
   * Objetivos, TODOS necessários.
   *
   * Lista e não objetivo único porque "entregue 200 de ferrita E 50 de titânio"
   * é uma missão, não duas — e modelá-la como duas perderia a recompensa
   * conjunta.
   */
  objetivos: readonly Objetivo[];
  recompensa: Recompensa;
  /** Só aparece a partir deste setor alcançado. */
  requerSetor?: number;
  /** Só aparece quando estas missões já foram entregues. */
  requer?: readonly string[];
  /**
   * A entrega CONSOME o que foi acumulado.
   *
   * É o que separa "entrega" de "coleta": coletar 500 de ferrita conta o que
   * passou pelas mãos do jogador; entregar 500 tira do Armazém na hora do
   * resgate. Sem essa distinção, uma missão de entrega seria só uma de coleta
   * com outro nome.
   */
  consomeNaEntrega?: Record<string, number>;
}

/**
 * Catálogo inicial.
 *
 * Deliberadamente pequeno e ABRANGENTE em vez de grande e repetitivo: cobre as
 * quatro categorias do §27, os dez tipos de fato e todas as formas de
 * recompensa. É o conjunto que prova que o formato aguenta o que o §27 pede — o
 * volume vem depois, por tabela, sem tocar em código.
 */
export const MISSOES: readonly MissaoDef[] = [
  // ── eliminação ────────────────────────────────────────────────────────────
  {
    id: 'elim_primeiros',
    nome: 'Batismo de Fogo',
    descricao: 'A frota inimiga não se apresenta. Apresente-se você.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'abate', alvo: 100, texto: 'Abater 100 inimigos' }],
    recompensa: { moedas: { sucata: 2_000 }, xp: 400 },
  },
  {
    id: 'elim_chefes',
    nome: 'Caçador de Comandantes',
    descricao: 'Cada frota tem uma cabeça. Corte três.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'chefe', alvo: 3, texto: 'Derrotar 3 chefes' }],
    recompensa: { moedas: { cristal: 40 }, medalhas: 1, baus: { ouro: 1 } },
    requer: ['elim_primeiros'],
  },
  {
    id: 'elim_fogo',
    nome: 'Contrafogo',
    descricao: 'Frotas de fogo queimam o escudo antes do casco. Apague 60.',
    categoria: 'eliminacao', ritmo: 'semanal',
    objetivos: [{
      fato: 'abate', alvo: 60,
      filtro: { elemento: 'fogo' },
      texto: 'Abater 60 inimigos de fogo',
    }],
    recompensa: { moedas: { nucleo: 1_500 }, materiais: { titanio: 40 } },
    requerSetor: 10,
  },

  // ── coleta ────────────────────────────────────────────────────────────────
  {
    id: 'coleta_ferrita',
    nome: 'Linha de Suprimento',
    descricao: 'Ferrita é o que segura a fabricação de pé.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{
      fato: 'recurso', alvo: 500, somaQuantidade: true,
      filtro: { recurso: 'ferrita' },
      texto: 'Coletar 500 de Ferrita',
    }],
    recompensa: { moedas: { sucata: 5_000 }, concessao: 'missao_carga_1' },
  },
  {
    id: 'coleta_sucata',
    nome: 'Ferro-Velho Orbital',
    descricao: 'Nada se perde no vácuo — tudo se recolhe.',
    categoria: 'coleta', ritmo: 'diaria',
    objetivos: [{
      fato: 'moeda', alvo: 25_000, somaQuantidade: true,
      filtro: { moeda: 'sucata' },
      texto: 'Recolher 25.000 de sucata',
    }],
    recompensa: { xp: 1_200 },
  },
  {
    id: 'coleta_raro',
    nome: 'Olho para o Raro',
    descricao: 'Dez peças raras. Não é sorte, é volume.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{
      fato: 'item', alvo: 10,
      filtro: { raridadeMin: 2 },
      texto: 'Obter 10 itens Raros ou melhores',
    }],
    recompensa: { itens: { quantidade: 1, raridadeMin: 3 }, medalhas: 1 },
    requerSetor: 15,
  },

  // ── entrega ───────────────────────────────────────────────────────────────
  {
    id: 'entrega_titanio',
    nome: 'Encomenda da Doca',
    descricao: 'A doca reforma o porão em troca de titânio. Bom negócio.',
    categoria: 'entrega', ritmo: 'campanha',
    objetivos: [{
      fato: 'recurso', alvo: 120, somaQuantidade: true,
      filtro: { recurso: 'titanio' },
      texto: 'Entregar 120 de Titânio',
    }],
    consomeNaEntrega: { titanio: 120 },
    recompensa: { concessao: 'missao_carga_2', moedas: { cristal: 25 } },
    requerSetor: 20,
  },

  // ── progressão ────────────────────────────────────────────────────────────
  {
    id: 'prog_setor_10',
    nome: 'Fronteira Interior',
    descricao: 'Dez setores atrás de você.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'setor', alvo: 1,
      filtro: { setorMin: 10 },
      texto: 'Concluir o setor 10',
    }],
    recompensa: { baus: { prata: 2 }, xp: 800 },
  },
  {
    id: 'prog_galaxia_2',
    nome: 'Salto Interestelar',
    descricao: 'A segunda galáxia não perdoa quem chegou cedo.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'galaxia', alvo: 1,
      filtro: { galaxiaMin: 1 },
      texto: 'Alcançar a galáxia 2',
    }],
    recompensa: { medalhas: 2, baus: { ouro: 1 }, concessao: 'missao_carga_3' },
    requer: ['prog_setor_10'],
  },
  {
    id: 'prog_nivel_25',
    nome: 'Patente de Comando',
    descricao: 'Nível 25 de comando. A frota começa a ouvir.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'nivel', alvo: 1,
      filtro: { qual: 'personagem', nivelMin: 25 },
      texto: 'Chegar ao nível 25 de comando',
    }],
    recompensa: { moedas: { cristal: 30 }, medalhas: 1 },
  },
  {
    id: 'prog_fusao',
    nome: 'Mão de Artífice',
    descricao: 'Cinco sínteses que subiram de raridade. As que não subiram não contam.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'fusao', alvo: 5,
      filtro: { subiu: true },
      texto: 'Concluir 5 fusões que subam de raridade',
    }],
    recompensa: { materiais: { cristal_quantico: 30 }, medalhas: 1 },
    requerSetor: 25,
  },
];

export const MISSAO_POR_ID = new Map(MISSOES.map((m) => [m.id, m]));

export const CATEGORIA_LABEL: Record<CategoriaDeMissao, string> = {
  eliminacao: 'Eliminação',
  coleta: 'Coleta',
  entrega: 'Entrega',
  progressao: 'Progressão',
};

export const RITMO_LABEL: Record<RitmoDeMissao, string> = {
  campanha: 'Campanha',
  diaria: 'Diária',
  semanal: 'Semanal',
};

// ── casamento entre fato e objetivo ─────────────────────────────────────────

/**
 * Quanto este fato adianta este objetivo. Zero quando não casa.
 *
 * Função pura e sem estado, o que a torna testável isoladamente — é aqui que
 * mora toda a chance de uma missão contar o que não devia.
 */
export function quantoConta(obj: Objetivo, fato: FatoDeJogo): number {
  if (obj.fato !== fato.tipo) return 0;

  const f = obj.filtro;
  if (f) {
    // `campo in fato` antes de comparar: um filtro que pede algo que este tipo
    // de fato nem tem NUNCA casa, em vez de comparar contra `undefined` e casar
    // por acidente.
    const casa = (chave: keyof FiltroDeFato, valorDoFato: unknown): boolean =>
      f[chave] === undefined || f[chave] === valorDoFato;

    if (fato.tipo === 'abate') {
      if (!casa('inimigo', fato.inimigo)) return 0;
      if (!casa('elemento', fato.elemento)) return 0;
      if (!casa('chefe', fato.chefe)) return 0;
      if (f.setorMin !== undefined && fato.setor < f.setorMin) return 0;
    }
    if (fato.tipo === 'chefe') {
      if (!casa('chefeId', fato.chefeId)) return 0;
      if (f.setorMin !== undefined && fato.setor < f.setorMin) return 0;
    }
    if (fato.tipo === 'recurso' && !casa('recurso', fato.recurso)) return 0;
    if (fato.tipo === 'moeda' && !casa('moeda', fato.moeda)) return 0;
    if (fato.tipo === 'item') {
      if (!casa('slot', fato.slot)) return 0;
      if (!casa('elemento', fato.elemento)) return 0;
      if (f.raridadeMin !== undefined && fato.raridade < f.raridadeMin) return 0;
    }
    if (fato.tipo === 'setor') {
      if (f.setorMin !== undefined && fato.setor < f.setorMin) return 0;
      if (f.galaxiaMin !== undefined && fato.galaxia < f.galaxiaMin) return 0;
    }
    if (fato.tipo === 'galaxia' && f.galaxiaMin !== undefined && fato.galaxia < f.galaxiaMin) return 0;
    if (fato.tipo === 'nivel') {
      if (!casa('qual', fato.qual)) return 0;
      if (f.nivelMin !== undefined && fato.nivel < f.nivelMin) return 0;
    }
    if (fato.tipo === 'fusao') {
      if (!casa('subiu', fato.subiu)) return 0;
      if (f.raridadeMin !== undefined && fato.saida < f.raridadeMin) return 0;
    }
    if (fato.tipo === 'bau' && !casa('tier', fato.tier)) return 0;
  }

  if (!obj.somaQuantidade) return 1;
  return 'quantidade' in fato ? fato.quantidade : 1;
}
