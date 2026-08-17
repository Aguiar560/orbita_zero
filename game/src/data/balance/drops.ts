import type { ElementId, Rarity, SlotId } from '@sim/types';

/**
 * Tabelas de drop (§10) — por REGRA, não por enumeração.
 *
 * A decisão que estrutura o arquivo: as galáxias deste jogo são PROCEDURAIS.
 * `describeGalaxy(index)` calcula nome, cor e fundo a partir do índice, e não
 * existe lista de galáxias em lugar nenhum — são 30 para os 300 setores de hoje
 * e não há teto real. Uma tabela com uma linha por galáxia estaria errada no dia
 * em que alguém acrescentasse a galáxia 31, e errada em silêncio: o conteúdo
 * novo simplesmente não teria drop.
 *
 * Então cada regra declara CONDIÇÕES e EFEITOS, e o motor junta todas as que
 * casam. Conteúdo que nenhuma regra menciona continua funcionando, porque a
 * regra base casa com tudo. Acrescentar galáxia, inimigo ou chefe não exige
 * tocar aqui; só exige tocar aqui quem quiser que o conteúdo novo seja
 * ESPECIAL.
 *
 * É o inverso do que o jogo faz hoje: `rollDrops` ignora quem morreu e onde,
 * então o chefe do setor 300 solta da mesma tabela que o caça do setor 1.
 */

// ── condições ───────────────────────────────────────────────────────────────

export interface CondicaoDeDrop {
  /** Faixa de setor, inclusiva nas duas pontas. */
  setor?: [number, number];
  /** Faixa de galáxia, inclusiva. Galáxia 0 é a primeira. */
  galaxia?: [number, number];
  /** Tipo de encontro. Ausente = qualquer um. */
  kind?: readonly ('onda' | 'elite' | 'chefe')[];
  /** Ids de chefe. Casa só quando o abate foi de um desses. */
  chefes?: readonly string[];
  /** Ids de inimigo. */
  inimigos?: readonly string[];
  /**
   * Marcadores livres do inimigo ou do chefe.
   *
   * O eixo pensado para conteúdo futuro: em vez de listar os quarenta inimigos
   * de uma facção nova, marca-se todos com `'enxame'` e uma regra só os cobre.
   */
  tags?: readonly string[];
  /** Elemento do alvo — permite "quem mata inimigo de gelo acha item de gelo". */
  elementoDoAlvo?: readonly ElementId[];
}

// ── efeitos ─────────────────────────────────────────────────────────────────

export interface EfeitoDeDrop {
  /** Multiplica a QUANTIDADE de itens rolados. Acumula por multiplicação. */
  quantidade?: number;
  /** Soma ao número de itens, depois do multiplicador. Acumula por soma. */
  itensExtras?: number;
  /** Soma ao nível de item. Acumula por soma. */
  ilvlBonus?: number;
  /** Piso de raridade. Vence o MAIOR entre as regras que casaram. */
  pisoDeRaridade?: Rarity;
  /** Multiplica a sorte efetiva desta rolagem. Acumula por multiplicação. */
  sorteMult?: number;
  /**
   * Slots que este alvo favorece, e quanto.
   *
   * Serve ao §10 "drop por inimigo": um encouraçado solta blindagem com mais
   * frequência. Acumula por multiplicação quando duas regras citam o mesmo slot.
   */
  slotFavorecido?: Partial<Record<SlotId, number>>;
  /** Elementos favorecidos na peça. Mesma acumulação. */
  elementoFavorecido?: Partial<Record<ElementId, number>>;
  /**
   * Ids de base EXCLUSIVOS deste alvo (§10).
   *
   * Vazio hoje: o catálogo exclusivo é conteúdo da Fase 5. O campo existe agora
   * porque o motor precisa saber lidar com ele antes de a lista chegar, senão
   * cadastrar o primeiro item exclusivo vira mudança de motor em vez de mudança
   * de dado.
   */
  exclusivos?: readonly string[];
  /** Chance 0..1 de o exclusivo realmente sair, quando há exclusivos. */
  chanceExclusivo?: number;
}

export interface RegraDeDrop {
  id: string;
  /** Comentário de design. Não é usado em conta nenhuma; existe para ser lido. */
  nota?: string;
  quando: CondicaoDeDrop;
  entao: EfeitoDeDrop;
}

// ── o alvo, do ponto de vista do drop ───────────────────────────────────────

export interface AlvoDoDrop {
  setor: number;
  galaxia: number;
  kind: 'onda' | 'elite' | 'chefe';
  chefe?: string | null;
  inimigo?: string | null;
  tags?: readonly string[];
  elemento?: ElementId;
}

// ── as regras ───────────────────────────────────────────────────────────────

/**
 * A margem que o pedido pede está na FORMA, não no número de linhas.
 *
 * Acrescentar dez galáxias, cem inimigos e vinte chefes não exige linha nova
 * aqui: a regra base cobre todos, e as faixas de setor e galáxia são abertas à
 * direita (`Infinity`). As regras abaixo são as poucas que o jogo já pode
 * sustentar; o resto do arquivo é o motor que aceita as futuras.
 */
export const REGRAS_DE_DROP: readonly RegraDeDrop[] = [
  {
    id: 'base',
    nota: 'Casa com tudo. É o que garante que conteúdo novo tenha drop sem cadastro.',
    quando: {},
    entao: { quantidade: 1 },
  },
  {
    id: 'elite',
    nota: 'Elite paga o tempo extra que custa: nível de item acima e uma peça a mais.',
    quando: { kind: ['elite'] },
    entao: { ilvlBonus: 2, itensExtras: 1 },
  },
  {
    id: 'chefe',
    nota: 'O marco da galáxia. O piso de raridade é o que faz derrubar um chefe '
      + 'nunca ser decepcionante, por pior que a rolagem saia.',
    quando: { kind: ['chefe'] },
    entao: { ilvlBonus: 4, itensExtras: 2, pisoDeRaridade: 2, sorteMult: 1.3 },
  },
  {
    id: 'chefe-de-galaxia-tardia',
    nota: 'A partir da galáxia 10 o chefe passa a garantir Épico. Sem isto, o '
      + 'piso de Raro vira irrelevante quando o jogador já derruba chefe em série.',
    quando: { kind: ['chefe'], galaxia: [10, Infinity] },
    entao: { pisoDeRaridade: 3, sorteMult: 1.2 },
  },
  {
    id: 'fim-de-jogo',
    nota: 'Do setor 200 em diante o jogo é sobre caçar tier alto, não quantidade.',
    quando: { setor: [200, Infinity] },
    entao: { sorteMult: 1.25 },
  },
  {
    id: 'afinidade-elemental',
    nota: 'Quem morre entrega o próprio elemento (§10). Dá um jeito DIRIGIDO de '
      + 'caçar peça de um elemento: vá matar quem é daquele elemento.',
    quando: { elementoDoAlvo: ['fogo', 'gelo', 'cosmico', 'raio', 'quimico'] },
    // O efeito é montado no motor, não escrito aqui: qual elemento favorecer
    // depende de QUEM morreu, e uma regra estática teria de virar cinco regras
    // quase idênticas. Ver `afinidadeDoAlvo`.
    entao: {},
  },
];

// ── resolução ───────────────────────────────────────────────────────────────

/** O efeito somado de todas as regras que casam com um alvo. */
export interface DropResolvido {
  quantidade: number;
  itensExtras: number;
  ilvlBonus: number;
  pisoDeRaridade: Rarity;
  sorteMult: number;
  slotFavorecido: Partial<Record<SlotId, number>>;
  elementoFavorecido: Partial<Record<ElementId, number>>;
  exclusivos: string[];
  chanceExclusivo: number;
  /** Ids das regras que casaram — para depuração e para o painel de códex. */
  regras: string[];
}

function casaFaixa(faixa: [number, number] | undefined, valor: number): boolean {
  if (!faixa) return true;
  return valor >= faixa[0] && valor <= faixa[1];
}

function casa(c: CondicaoDeDrop, alvo: AlvoDoDrop): boolean {
  if (!casaFaixa(c.setor, alvo.setor)) return false;
  if (!casaFaixa(c.galaxia, alvo.galaxia)) return false;
  if (c.kind && !c.kind.includes(alvo.kind)) return false;
  if (c.chefes && !(alvo.chefe && c.chefes.includes(alvo.chefe))) return false;
  if (c.inimigos && !(alvo.inimigo && c.inimigos.includes(alvo.inimigo))) return false;
  if (c.tags && !c.tags.some((t) => alvo.tags?.includes(t))) return false;
  if (c.elementoDoAlvo && !(alvo.elemento && c.elementoDoAlvo.includes(alvo.elemento))) return false;
  return true;
}

/**
 * Junta as regras que casam.
 *
 * A forma de acumular é escolhida por campo e importa: quantidade e sorte
 * MULTIPLICAM, porque são fatores; nível de item e itens extras SOMAM, porque
 * são parcelas; o piso de raridade pega o MAIOR, porque dois pisos não se
 * empilham — o mais alto já contém o outro.
 */
export function resolverDrop(alvo: AlvoDoDrop, regras = REGRAS_DE_DROP): DropResolvido {
  const out: DropResolvido = {
    quantidade: 1, itensExtras: 0, ilvlBonus: 0, pisoDeRaridade: 0 as Rarity,
    sorteMult: 1, slotFavorecido: {}, elementoFavorecido: {},
    exclusivos: [], chanceExclusivo: 0, regras: [],
  };

  for (const r of regras) {
    if (!casa(r.quando, alvo)) continue;
    out.regras.push(r.id);
    const e = r.entao;

    if (e.quantidade !== undefined) out.quantidade *= e.quantidade;
    if (e.itensExtras !== undefined) out.itensExtras += e.itensExtras;
    if (e.ilvlBonus !== undefined) out.ilvlBonus += e.ilvlBonus;
    if (e.sorteMult !== undefined) out.sorteMult *= e.sorteMult;
    if (e.pisoDeRaridade !== undefined && e.pisoDeRaridade > out.pisoDeRaridade) {
      out.pisoDeRaridade = e.pisoDeRaridade;
    }
    for (const [slot, v] of Object.entries(e.slotFavorecido ?? {})) {
      const k = slot as SlotId;
      out.slotFavorecido[k] = (out.slotFavorecido[k] ?? 1) * (v ?? 1);
    }
    for (const [el, v] of Object.entries(e.elementoFavorecido ?? {})) {
      const k = el as ElementId;
      out.elementoFavorecido[k] = (out.elementoFavorecido[k] ?? 1) * (v ?? 1);
    }
    if (e.exclusivos?.length) {
      out.exclusivos.push(...e.exclusivos);
      out.chanceExclusivo = Math.max(out.chanceExclusivo, e.chanceExclusivo ?? 0.05);
    }
  }

  return out;
}

/**
 * O favorecimento elemental que depende do alvo.
 *
 * Fica em função e não em regra porque uma regra é estática: para dizer "solta
 * do próprio elemento" com dados puros seriam cinco regras quase idênticas, e
 * seis quando entrasse um elemento novo. Aqui um elemento novo não custa nada.
 */
export function afinidadeDoAlvo(alvo: AlvoDoDrop, forca = 3): Partial<Record<ElementId, number>> {
  if (!alvo.elemento || alvo.elemento === 'padrao') return {};
  return { [alvo.elemento]: forca };
}
