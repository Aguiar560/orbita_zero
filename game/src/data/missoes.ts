import type { ElementId, Rarity, ResourceId, SlotId } from '@sim/types';
import { CRISTAL_DAS_MISSOES_FIXAS } from './balance/cristal';
import { expandirTodas } from './missoes-cadeias';
import { SEMENTES } from './missoes-sementes';

/**
 * O cristal de uma missão escrita à mão sai da tabela de `balance/cristal.ts`,
 * e não de um número no bloco dela: a moeda paga tem um orçamento só, e ele
 * precisa caber inteiro numa tela para alguém conferir.
 */
const cristalFixo = (id: string): number => CRISTAL_DAS_MISSOES_FIXAS[id] ?? 0;

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
  | { tipo: 'nivel'; qual: 'nave' | 'personagem'; nivel: number }
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
  qual?: 'nave' | 'personagem';
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

// ── requisitos (§17) ────────────────────────────────────────────────────────

/**
 * O que precisa ser verdade para a missão aparecer.
 *
 * União discriminada, como os fatos, e pelo mesmo motivo: `trustLevel` precisa
 * de `personagem` e `galaxyCompleted` não, e o compilador tem de saber a
 * diferença. Um `{ type: string; value: any }` compilaria com requisito mal
 * escrito e ele simplesmente nunca liberaria a missão — em silêncio.
 */
export type Requisito =
  | { tipo: 'nivelPersonagem'; valor: number }
  | { tipo: 'nivelNave'; valor: number }
  | { tipo: 'setorAlcancado'; valor: number }
  | { tipo: 'galaxiaConcluida'; galaxia: number }
  | { tipo: 'chefeDerrotado'; chefeId: string }
  | { tipo: 'missaoConcluida'; missaoId: string }
  | { tipo: 'confianca'; personagem: string; valor: number }
  | { tipo: 'recurso'; recurso: string; valor: number }
  // O Núcleo (§34) usa a MESMA união de requisitos das missões, em vez de um
  // sistema paralelo com as mesmas variantes. Todo requisito novo que as
  // missões ganharem, o Núcleo herda de graça.
  | { tipo: 'provacaoPiso'; valor: number };

// ── as missões ──────────────────────────────────────────────────────────────

export type CategoriaDeMissao = 'eliminacao' | 'coleta' | 'entrega' | 'progressao';

/** Classificação visual (§4). */
export type TipoDeMissao = 'principal' | 'aliado' | 'galaxia' | 'especial';

/**
 * A identidade de cada tipo: cor, ícone e explicação.
 *
 * Tabela e não `switch` espalhado pela tela. E o ÍCONE não é enfeite: o §39
 * proíbe depender só de cor, então cada tipo carrega um glifo próprio para quem
 * não distingue roxo de vermelho continuar lendo a interface.
 */
export const TIPO_DE_MISSAO: Record<TipoDeMissao, {
  nome: string; cor: string; glifo: string; explicacao: string;
}> = {
  principal: {
    nome: 'PRINCIPAL', cor: '#4FC3FF', glifo: '◎',
    explicacao: 'Missões que avançam a história principal.',
  },
  aliado: {
    nome: 'DE ALIADO', cor: '#B45CFF', glifo: '⧉',
    explicacao: 'Missões fornecidas por aliados.',
  },
  galaxia: {
    nome: 'DA GALÁXIA', cor: '#FF4B4B', glifo: '✦',
    explicacao: 'Missões ligadas à galáxia.',
  },
  especial: {
    nome: 'ESPECIAL', cor: '#FFB638', glifo: '◆',
    explicacao: 'Contratos únicos com recompensas exclusivas.',
  },
};

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
  /**
   * Requisitos, TODOS necessários (§17).
   *
   * Lista declarativa em vez dos campos soltos `requerSetor` e `requer` que
   * existiam antes: cada requisito novo virava um campo novo na interface E um
   * `if` novo em quem resolvia. Como lista, a UI só INTERPRETA — que é o que o
   * §42 exige, nenhum componente decidindo sozinho se a missão liberou.
   */
  requisitos?: readonly Requisito[];

  // ── quem dá, de onde vem, quanto vale (§4, §26) ───────────────────────────

  /** Personagem que oferece a missão, por id de `personagens.ts`. */
  giverId?: string;
  /**
   * Classificação VISUAL (§4).
   *
   * Separada de `categoria`: categoria diz o que se FAZ (eliminar, coletar),
   * tipo diz o que a missão SIGNIFICA na progressão (história, aliado, região,
   * contrato único). Uma missão de eliminação pode ser principal ou de galáxia,
   * e juntar as duas num campo só perderia essa liberdade.
   */
  tipo?: TipoDeMissao;
  /** Galáxia a que a missão pertence, para filtro e para a cor. */
  galaxiaId?: number;
  /**
   * Recompensa ÚNICA e nomeada, exibida em destaque (§4.4).
   *
   * Separada de `recompensa.itens` porque não é "mais um item": é a peça que dá
   * razão ao contrato especial existir, e a tela precisa mostrá-la grande, com
   * nome próprio e o dono a que ela pertence.
   */
  recompensaExclusiva?: {
    nome: string;
    /** "ITEM EXCLUSIVO DE VARKH-7" — de quem é a assinatura. */
    de?: string;
    /** Slot do item, para a tela desenhar o icone real da peca. */
    slot?: SlotId;
    icone?: string;
    raridadeMin?: Rarity;
  };
  /**
   * ► A CONFIANÇA SAIU DAQUI.
   *
   * Ela era escrita à mão, quase sempre `1`, e o resultado estourava o teto:
   * Kael Voss tinha 7 missões somando 8 para um máximo de 5. A barra enchia na
   * quarta missão e as três últimas não valiam nada — fazer a cadeia inteira
   * pagava o mesmo que largar no meio.
   *
   * Agora ela é DERIVADA da posição na cadeia, e a cadeia inteira fecha exato
   * no teto. Ver `balance/confianca.ts`. Cadastrar quinze missões novas não
   * exige recalcular nada: o valor de cada uma cai sozinho do tamanho da cadeia.
   */
  /** Missões que esta entrega libera. Informativo — o requisito manda. */
  proximas?: readonly string[];
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
    giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'Batismo de Fogo',
    descricao: 'A frota inimiga não se apresenta. Apresente-se você.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'abate', alvo: 100, texto: 'Abater 100 inimigos' }],
    recompensa: { moedas: { sucata: 2_000 }, xp: 400 },
  },
  {
    id: 'elim_chefes',
    giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'Caçador de Comandantes',
    descricao: 'Cada frota tem uma cabeça. Corte três.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'chefe', alvo: 3, texto: 'Derrotar 3 chefes' }],
    recompensa: { moedas: { cristal: cristalFixo('elim_chefes') }, medalhas: 1, baus: { ouro: 1 } },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_04_manifesto' }, { tipo: 'missaoConcluida', missaoId: 'elim_primeiros' }],
  },
  {
    id: 'elim_fogo',
    giverId: 'char_nucleo_ferrugem', tipo: 'galaxia',
    nome: 'Contrafogo',
    descricao: 'Frotas de fogo queimam o escudo antes do casco. Apague 60.',
    categoria: 'eliminacao', ritmo: 'semanal',
    objetivos: [{
      fato: 'abate', alvo: 60,
      filtro: { elemento: 'fogo' },
      texto: 'Abater 60 inimigos de fogo',
    }],
    recompensa: { moedas: { nucleo: 1_500 }, materiais: { tecido_vorg: 40 } },
    requisitos: [{ tipo: 'setorAlcancado', valor: 10 }],
  },

  // ── coleta ────────────────────────────────────────────────────────────────
  {
    id: 'coleta_ferrita',
    giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'Linha de Suprimento',
    descricao: 'Ferrita é o que segura a fabricação de pé.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{
      fato: 'recurso', alvo: 500, somaQuantidade: true,
      filtro: { recurso: 'ferrita' },
      texto: 'Coletar 500 de Ferrita',
    }],
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'prog_setor_10' }],
    recompensa: { moedas: { sucata: 5_000 }, concessao: 'missao_carga_1' },
  },
  {
    id: 'coleta_sucata',
    giverId: 'char_lira_nexus', tipo: 'aliado',
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
    giverId: 'char_lira_nexus', tipo: 'aliado',
    nome: 'Olho para o Raro',
    descricao: 'Dez peças raras. Não é sorte, é volume.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{
      fato: 'item', alvo: 10,
      filtro: { raridadeMin: 2 },
      texto: 'Obter 10 itens Raros ou melhores',
    }],
    recompensa: { itens: { quantidade: 1, raridadeMin: 3 }, medalhas: 1 },
    requisitos: [{ tipo: 'setorAlcancado', valor: 15 }],
  },

  // ── entrega ───────────────────────────────────────────────────────────────
  {
    id: 'entrega_titanio',
    giverId: 'char_zyrak', tipo: 'aliado',
    nome: 'Encomenda da Doca',
    descricao: 'A doca reforma o porão em troca de titânio. Bom negócio.',
    categoria: 'entrega', ritmo: 'campanha',
    objetivos: [{
      fato: 'recurso', alvo: 120, somaQuantidade: true,
      filtro: { recurso: 'titanio' },
      texto: 'Entregar 120 de Titânio',
    }],
    consomeNaEntrega: { titanio: 120 },
    recompensa: { concessao: 'missao_carga_2', moedas: { cristal: cristalFixo('entrega_titanio') } },
    requisitos: [{ tipo: 'setorAlcancado', valor: 20 }],
  },

  // ── progressão ────────────────────────────────────────────────────────────
  {
    id: 'prog_setor_10',
    giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'Fronteira Interior',
    descricao: 'Dez setores atrás de você.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'setor', alvo: 1,
      filtro: { setorMin: 10 },
      texto: 'Concluir o setor 10',
    }],
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'elim_primeiros' }],
    recompensa: { baus: { prata: 2 }, xp: 800 },
  },
  {
    id: 'prog_galaxia_2',
    giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'Salto Interestelar',
    descricao: 'A segunda galáxia não perdoa quem chegou cedo.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'galaxia', alvo: 1,
      filtro: { galaxiaMin: 1 },
      texto: 'Alcançar a galáxia 2',
    }],
    recompensa: { medalhas: 2, baus: { ouro: 1 }, concessao: 'missao_carga_3' },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'elim_chefes' }, { tipo: 'missaoConcluida', missaoId: 'prog_setor_10' }],
  },
  {
    id: 'prog_nivel_25',
    giverId: 'char_zyrak', tipo: 'aliado',
    nome: 'Patente de Comando',
    descricao: 'Nível 25 de comando. A frota começa a ouvir.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'nivel', alvo: 1,
      filtro: { qual: 'personagem', nivelMin: 25 },
      texto: 'Chegar ao nível 25 de comando',
    }],
    recompensa: { moedas: { cristal: cristalFixo('prog_nivel_25') }, medalhas: 1 },
  },
  {
    id: 'prog_fusao',
    giverId: 'char_lira_nexus', tipo: 'aliado',
    nome: 'Mão de Artífice',
    descricao: 'Cinco sínteses que subiram de raridade. As que não subiram não contam.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{
      fato: 'fusao', alvo: 5,
      filtro: { subiu: true },
      texto: 'Concluir 5 fusões que subam de raridade',
    }],
    recompensa: { materiais: { pele_quantica: 30 }, medalhas: 1 },
    requisitos: [{ tipo: 'setorAlcancado', valor: 25 }],
  },

  // ── três cadeias orgânicas ───────────────────────────────────────────────
  // Cada cadeia introduz dois ou três materiais e termina consumindo parte do
  // que entregou. Assim missão é fonte E sumidouro, não uma torneira sem uso.
  {
    id: 'org_bioma_1', giverId: 'char_lira_nexus', tipo: 'aliado',
    nome: 'Medicina do Vácuo I — Cultura',
    descricao: 'Lira precisa de peças raras para calibrar uma incubadora de reparo vivo.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{ fato: 'item', alvo: 20, filtro: { raridadeMin: 2 }, texto: 'Obter 20 itens Raros ou melhores' }],
    recompensa: { materiais: { biogel: 60 }, xp: 1_800 },
    proximas: ['org_bioma_2'], requisitos: [{ tipo: 'setorAlcancado', valor: 30 }],
  },
  {
    id: 'org_bioma_2', giverId: 'char_lira_nexus', tipo: 'aliado',
    nome: 'Medicina do Vácuo II — Contenção',
    descricao: 'A cultura reagiu. Esporos de frotas químicas estabilizam a matriz.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'abate', alvo: 120, filtro: { elemento: 'quimico' }, texto: 'Abater 120 inimigos químicos' }],
    recompensa: { materiais: { esporo_alienigena: 50 }, xp: 2_200 },
    proximas: ['org_bioma_3'], requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_bioma_1' }],
  },
  {
    id: 'org_bioma_3', giverId: 'char_lira_nexus', tipo: 'especial',
    nome: 'Medicina do Vácuo III — Primeiro Pulso',
    descricao: 'Alimente o protótipo com a cultura estabilizada e desperte um núcleo vivo.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [
      { fato: 'recurso', alvo: 30, somaQuantidade: true, filtro: { recurso: 'biogel' }, texto: 'Separar 30 de Biogel' },
      { fato: 'recurso', alvo: 25, somaQuantidade: true, filtro: { recurso: 'esporo_alienigena' }, texto: 'Separar 25 Esporos Alienígenas' },
      { fato: 'chefe', alvo: 3, texto: 'Derrotar 3 chefes com a incubadora ativa' },
    ],
    consomeNaEntrega: { biogel: 30, esporo_alienigena: 25 },
    recompensa: { materiais: { nucleo_organico: 25 }, medalhas: 1 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_bioma_2' }],
  },
  {
    id: 'org_jardim_1', giverId: 'char_zyrak', tipo: 'galaxia', galaxiaId: 5,
    nome: 'Jardins sem Sol I — Semente',
    descricao: 'Zyrak detectou fotossíntese onde nenhuma estrela deveria alcançar.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [{ fato: 'setor', alvo: 1, filtro: { setorMin: 60 }, texto: 'Concluir um setor 60 ou superior' }],
    recompensa: { materiais: { alga_estelar: 55 }, xp: 2_800 },
    proximas: ['org_jardim_2'], requisitos: [{ tipo: 'setorAlcancado', valor: 55 }],
  },
  {
    id: 'org_jardim_2', giverId: 'char_zyrak', tipo: 'galaxia', galaxiaId: 5,
    nome: 'Jardins sem Sol II — Floração',
    descricao: 'Cápsulas antigas guardam micronutrientes que fazem a alga florescer.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [{ fato: 'bau', alvo: 12, texto: 'Abrir 12 baús' }],
    recompensa: { materiais: { nectar_estelar: 35 }, baus: { ouro: 1 } },
    proximas: ['org_jardim_3'], requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_jardim_1' }],
  },
  {
    id: 'org_jardim_3', giverId: 'char_zyrak', tipo: 'especial', galaxiaId: 5,
    nome: 'Jardins sem Sol III — Fruto Nebular',
    descricao: 'Comprima a colheita numa fusão estável e preserve o primeiro fruto.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [
      { fato: 'recurso', alvo: 30, somaQuantidade: true, filtro: { recurso: 'alga_estelar' }, texto: 'Separar 30 Algas Estelares' },
      { fato: 'recurso', alvo: 20, somaQuantidade: true, filtro: { recurso: 'nectar_estelar' }, texto: 'Separar 20 Néctares Estelares' },
      { fato: 'fusao', alvo: 3, filtro: { subiu: true }, texto: 'Concluir 3 fusões que subam de raridade' },
    ],
    consomeNaEntrega: { alga_estelar: 30, nectar_estelar: 20 },
    recompensa: { materiais: { polpa_nebular: 18 }, medalhas: 2 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_jardim_2' }],
  },
  {
    id: 'org_xeno_1', giverId: 'char_kael_voss', tipo: 'principal',
    nome: 'O Outro Lado I — Assinatura',
    descricao: 'Kael quer uma amostra da matéria que atravessa escudos cósmicos sem perder forma.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [{ fato: 'abate', alvo: 180, filtro: { elemento: 'cosmico', setorMin: 80 }, texto: 'Abater 180 inimigos cósmicos no setor 80+' }],
    recompensa: { materiais: { essencia_xeno: 40 }, xp: 4_000 },
    proximas: ['org_xeno_2'], requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_11_silencio' }, { tipo: 'setorAlcancado', valor: 80 }],
  },
  {
    id: 'org_xeno_2', giverId: 'char_kael_voss', tipo: 'especial',
    nome: 'O Outro Lado II — Mineral Vivo',
    descricao: 'Submeta a essência a cinco assinaturas de comandante e force-a a cristalizar.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [
      { fato: 'recurso', alvo: 25, somaQuantidade: true, filtro: { recurso: 'essencia_xeno' }, texto: 'Separar 25 Essências Xeno' },
      { fato: 'chefe', alvo: 5, texto: 'Derrotar 5 chefes' },
    ],
    consomeNaEntrega: { essencia_xeno: 25 },
    recompensa: { materiais: { cristal_vivo: 20 }, medalhas: 2, baus: { singularidade: 1 } },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_xeno_1' }, { tipo: 'missaoConcluida', missaoId: 'org_xeno_1' }],
  },

  // ── contrato especial e cadeia bloqueada (§4.4, §16) ──────────────────────
  //
  // Estes dois provam o que o formato precisa aguentar: um contrato com
  // recompensa exclusiva NOMEADA e uma missão travada por CONFIANÇA, que é o
  // requisito que só existe porque o personagem é entidade de primeira classe.
  {
    id: 'esp_coracao_ferrugem',
    nome: 'Coração da Ferrugem',
    descricao: 'Destrua o Protótipo NF-07 sem perder o escudo.',
    categoria: 'eliminacao', ritmo: 'campanha',
    giverId: 'char_nucleo_ferrugem', tipo: 'especial', galaxiaId: 0,
    objetivos: [{
      fato: 'chefe', alvo: 1,
      filtro: { chefeId: 'nucleo_ferrugem' },
      texto: 'Derrotar o Núcleo Ferrugem outra vez',
    }],
    requisitos: [
      { tipo: 'chefeDerrotado', chefeId: 'nucleo_ferrugem' },
      { tipo: 'confianca', personagem: 'char_nucleo_ferrugem', valor: 1 },
    ],
    recompensaExclusiva: {
      nome: 'REATOR DO NÚCLEO FERRUGEM',
      de: 'NÚCLEO FERRUGEM',
      // ► O PISO DE MÍTICO SAIU DAQUI.
      //
      // Ele foi escrito quando este contrato era solto. Com a cadeia montada,
      // ele caiu na POSIÇÃO 2 de dezoito — e o Núcleo Ferrugem é contato de
      // TIER 1. Um Mítico garantido na segunda missão da primeira galáxia
      // atropela de uma vez a escada de raridade dos contatos, a fusão (301
      // Míticos por Divino) e a Provação, cujo teto é justamente o Mítico.
      //
      // Sem o campo, quem decide é `raridadeExclusivaDoTier`: Épico para o
      // tier 1. E o dia em que este contato mudar de tier, a peça acompanha.
      // O SLOT mostra o item que vai sair, nao um simbolo generico: e a peca
      // que da razao ao contrato existir. O sprite vem de `iconeDeItem`, a
      // mesma funcao que nomeia o icone de qualquer item do jogo — inventar um
      // nome aqui daria slot vazio, que foi o erro do `cat/alvo`.
      slot: 'reator',
    },
    recompensa: {
      itens: { quantidade: 1, raridadeMin: 5, ilvlBonus: 20 },
      moedas: { sucata: 40_000 },
      materiais: { nucleo_de_energia: 20 },
      medalhas: 3,
    },
  },
  {
    id: 'esp_segredos_enterrados',
    nome: 'Segredos Enterrados',
    descricao: 'Há registros do que o Núcleo era antes de acordar. Ele ainda não confia o bastante para mostrá-los.',
    categoria: 'progressao', ritmo: 'campanha',
    giverId: 'char_nucleo_ferrugem', tipo: 'especial', galaxiaId: 0,
    objetivos: [{ fato: 'abate', alvo: 300, filtro: { elemento: 'fogo' }, texto: 'Abater 300 inimigos de fogo' }],
    requisitos: [{ tipo: 'confianca', personagem: 'char_nucleo_ferrugem', valor: 4 }],
    recompensa: { medalhas: 5, baus: { singularidade: 1 } },
  },

  // ══ A CADEIA DE KAEL VOSS ═══════════════════════════════════════════════
  //
  // Quinze missões ligadas, da primeira salva até a peça que leva o nome dele.
  // O arco é o da própria partida: um piloto que ninguém conhece vira a razão
  // de a frota conseguir sair — e descobre, no caminho, por que ela precisava
  // sair com tanta pressa.
  //
  // A ORDEM aqui é a ordem da cadeia: `balance/confianca.ts` deriva dela
  // quanta confiança cada missão entrega, e as quinze somam exatamente o teto.
  // Mover um bloco de lugar muda o valor das quinze — de propósito, porque a
  // posição É o peso.
  {
    id: 'kael_04_manifesto',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 0,
    nome: 'Manifesto de Carga',
    descricao: 'Kael precisa saber o que a doca consegue mover em uma volta. Encha o porão e volte inteiro.',
    categoria: 'coleta', ritmo: 'campanha',
    objetivos: [
      { fato: 'item', alvo: 12, texto: 'Recolher 12 peças em campo' },
      { fato: 'setor', alvo: 3, texto: 'Concluir 3 setores' },
    ],
    recompensa: { moedas: { sucata: 3_200 }, materiais: { ferrita: 40 }, xp: 600 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'coleta_ferrita' }],
  },
  {
    id: 'kael_07_arqueiro',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 1,
    nome: 'Arqueiro de Popa',
    descricao: 'A escolta da frota atira para trás enquanto foge. Kael quer saber se você aguenta o contrário.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [
      { fato: 'abate', alvo: 250, filtro: { setorMin: 11 }, texto: 'Abater 250 inimigos no setor 11 ou além' },
    ],
    recompensa: { moedas: { sucata: 5_000, nucleo: 900 }, xp: 1_100, baus: { prata: 1 } },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'prog_galaxia_2' }],
  },
  {
    id: 'kael_08_lastro',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 1,
    nome: 'Lastro de Pirita',
    descricao: 'A doca de partida corrói por dentro. Pirita segura a corrosão por mais uma temporada.',
    categoria: 'entrega', ritmo: 'campanha',
    objetivos: [
      { fato: 'recurso', alvo: 180, filtro: { recurso: 'pirita' }, somaQuantidade: true, texto: 'Reunir 180 de pirita' },
    ],
    consomeNaEntrega: { pirita: 180 },
    recompensa: { moedas: { cristal: cristalFixo('kael_08_lastro') }, materiais: { ferrita: 90 }, xp: 1_400 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_07_arqueiro' }],
  },
  {
    id: 'kael_09_cabecas',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 2,
    nome: 'Três Cabeças',
    descricao: 'Quem manda nas rotas de saída não usa uniforme. Kael marcou os três que usam.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [
      { fato: 'chefe', alvo: 6, filtro: { setorMin: 11 }, texto: 'Derrotar 6 chefes no setor 11 ou além' },
    ],
    recompensa: { moedas: { cristal: cristalFixo('kael_09_cabecas') }, medalhas: 1, baus: { ouro: 1 }, xp: 2_000 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_08_lastro' }],
  },
  {
    id: 'kael_10_bancada',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 2,
    nome: 'Bancada Improvisada',
    descricao: 'Sem oficina, a frota conserta o que tem com o que sobra. Mostre que dá para melhorar uma peça no caminho.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [
      { fato: 'fusao', alvo: 3, filtro: { subiu: true }, texto: 'Subir 3 peças de raridade na Fabricação' },
    ],
    recompensa: { moedas: { nucleo: 2_500 }, materiais: { diamantita: 60 }, xp: 2_600, concessao: 'chefe_g1' },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_09_cabecas' }],
  },
  {
    id: 'kael_11_silencio',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 3,
    nome: 'O Silêncio de Titânio',
    descricao: 'As docas da quarta galáxia pararam de responder há dois ciclos. Kael não diz o que espera encontrar.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [
      { fato: 'galaxia', alvo: 1, filtro: { galaxiaMin: 3 }, texto: 'Concluir a galáxia 4' },
      { fato: 'recurso', alvo: 220, filtro: { recurso: 'titanio' }, somaQuantidade: true, texto: 'Reunir 220 de titânio' },
    ],
    recompensa: { moedas: { sucata: 22_000, cristal: cristalFixo('kael_11_silencio') }, xp: 4_000, baus: { ouro: 2 } },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_10_bancada' }],
  },
  {
    id: 'kael_13_conta',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 8,
    nome: 'A Conta da Partida',
    descricao: 'Kael abre o registro: a frota não fugia de uma guerra. Fugia de uma dívida — e ela cobra juros em cada setor.',
    categoria: 'eliminacao', ritmo: 'campanha',
    objetivos: [
      { fato: 'abate', alvo: 900, filtro: { setorMin: 81 }, texto: 'Abater 900 inimigos no setor 81 ou além' },
      { fato: 'chefe', alvo: 10, filtro: { setorMin: 81 }, texto: 'Derrotar 10 chefes no setor 81 ou além' },
    ],
    recompensa: { moedas: { cristal: cristalFixo('kael_13_conta') }, medalhas: 2, xp: 12_000, baus: { ouro: 3 } },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'org_xeno_2' }],
  },
  {
    id: 'kael_14_ultima_doca',
    giverId: 'char_kael_voss', tipo: 'principal', galaxiaId: 9,
    nome: 'A Última Doca',
    descricao: 'A frota de partida vai parar de partir. Kael quer que a última saída seja a que ninguém consiga fechar atrás.',
    categoria: 'progressao', ritmo: 'campanha',
    objetivos: [
      { fato: 'galaxia', alvo: 1, filtro: { galaxiaMin: 9 }, texto: 'Concluir a galáxia 10' },
      { fato: 'item', alvo: 6, filtro: { raridadeMin: 3 }, texto: 'Recolher 6 peças Épicas ou melhores' },
    ],
    recompensa: { moedas: { sucata: 80_000, cristal: cristalFixo('kael_14_ultima_doca') }, materiais: { obsidiana: 120 }, xp: 20_000 },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_13_conta' }],
  },
  {
    id: 'kael_15_assinatura',
    giverId: 'char_kael_voss', tipo: 'especial', galaxiaId: 9,
    nome: 'Assinatura de Voss',
    descricao: 'Kael desmonta o próprio painel de coordenação e entrega as peças. "A frota já sabe o caminho. Você vai precisar mais que eu."',
    categoria: 'entrega', ritmo: 'campanha',
    objetivos: [
      { fato: 'chefe', alvo: 15, filtro: { setorMin: 91 }, texto: 'Derrotar 15 chefes no setor 91 ou além' },
    ],
    recompensa: { moedas: { cristal: cristalFixo('kael_15_assinatura') }, medalhas: 3, xp: 30_000, baus: { singularidade: 1 } },
    recompensaExclusiva: {
      nome: 'PAINEL DE VOSS',
      de: 'KAEL VOSS',
      // O SLOT é o suporte: a peça é um painel de coordenação, não uma arma.
      // Um contato que passou quinze missões organizando a frota não entrega um
      // canhão no fim — entrega o instrumento com que ele fazia o trabalho.
      slot: 'suporte',
      // Sem `raridadeMin`: o TIER do contato decide. Kael é tier 1, então sai
      // Épico — e o dia em que ele mudar de tier, a peça acompanha sozinha.
    },
    requisitos: [{ tipo: 'missaoConcluida', missaoId: 'kael_14_ultima_doca' }],
  },
  // ── as cadeias geradas ────────────────────────────────────────────────────
  //
  // A prosa de cada uma esta em `missoes-sementes.ts`; a mecanica sai da
  // posicao e da galaxia, em `missoes-cadeias.ts`. A cadeia do Kael Voss fica
  // ACIMA, escrita a mao: ela e o molde contra o qual o gerado e comparado.
  ...expandirTodas(SEMENTES),
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
