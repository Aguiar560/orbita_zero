import { chefeDoPiso } from '@data/abismo-chefes';
import type { Requisito } from '@data/missoes';
import type { ElementId, Rarity } from '@sim/types';

/**
 * O Abismo Estelar — o modo de chefes do fim de jogo (§32–§35).
 *
 * Cem pisos, um chefe por piso. O §32 proíbe o nome "torre" e pede algo do
 * universo do jogo; das opções listadas, "Singularidade" e "Convergência" já
 * estão em uso (o baú de topo e a receita de fusão Lendário→Mítico), e repetir
 * nome entre sistemas confunde mais do que economiza. Sobrou Abismo Estelar.
 *
 * ## O problema que decide o desenho
 *
 * Há dez chefes no jogo e cem pisos. Sem cuidado, o piso 47 é o mesmo chefe do
 * piso 7 com mais vida — que é EXATAMENTE o que o §33 manda evitar.
 *
 * A saída são MODIFICADORES: cada piso combina um chefe com um ou mais efeitos
 * que mudam como a luta funciona, não quanto ela demora. Um chefe que regenera
 * exige dano sustentado; um que reflete exige ler a barra antes de despejar
 * tudo; um que invoca exige limpar antes de focar. É a mesma criatura pedindo
 * uma resposta diferente.
 *
 * ## Por que gerado e não escrito à mão
 *
 * Cem pisos escritos um a um seriam mil linhas que ninguém revisa e que
 * divergem do balanceamento no primeiro ajuste de curva. Aqui o piso é
 * DERIVADO de regras: a profundidade escolhe o chefe, a escala e o conjunto de
 * modificadores elegíveis; um sorteio determinístico por número do piso escolhe
 * quais entram.
 *
 * Determinístico importa: o piso 63 tem de ser o mesmo para todo jogador e em
 * toda sessão, senão não há como conversar sobre ele nem como testá-lo.
 *
 * Os pisos MARCO fogem da regra e são escritos à mão — é onde o modo ganha cara
 * própria em vez de textura procedural.
 */

export const ABISMO_NOME = 'ABISMO ESTELAR';
export const ABISMO_PISOS = 100;

// ── modificadores ───────────────────────────────────────────────────────────

/**
 * O que um modificador faz.
 *
 * Campos declarativos e não uma função: a camada de combate lê estes números, e
 * um efeito escrito como código aqui dentro não poderia ser simulado no Node
 * nem inspecionado por uma tela. É a mesma regra que vale para afixo e para
 * objetivo de missão.
 */
export interface ModificadorDef {
  id: string;
  nome: string;
  descricao: string;
  /** A partir de que piso ele pode aparecer. */
  profundidadeMin: number;
  /**
   * Peso de "quanto complica", 1 a 5.
   *
   * Serve a dois freios: limitar a soma por piso, para o piso 30 não ganhar
   * três efeitos brutais de uma vez, e fazer a recompensa acompanhar o que o
   * jogador de fato enfrentou.
   */
  peso: number;
  /** Multiplicadores sobre o chefe. Ausente = 1. */
  vida?: number;
  dano?: number;
  velocidade?: number;
  cadencia?: number;
  /** Fração da vida regenerada por segundo. */
  regen?: number;
  /** Fração do dano recebido devolvida ao jogador. */
  reflexo?: number;
  /** Resistência plana somada contra TODOS os elementos, 0..1. */
  resistencia?: number;
  /** Invoca lacaios a cada N segundos. */
  invocaCada?: number;
  /** Divide-se em dois ao chegar nesta fração de vida. */
  divideEm?: number;
  /** Segundos de limite; estourar conta como derrota. */
  limiteDeTempo?: number;
  /** O escudo do JOGADOR não regenera enquanto durar a luta. */
  travaEscudo?: boolean;
  /** O chefe assume o elemento do JOGADOR, anulando a vantagem. */
  espelhaElemento?: boolean;
  /** Elemento forçado, no lugar do natural do chefe. */
  elemento?: ElementId;
}

/**
 * O catálogo.
 *
 * Ordenado por profundidade de entrada: os primeiros são ajustes de leitura, os
 * últimos mudam a luta inteira. A escada existe para o jogador aprender um
 * efeito por vez, em vez de encontrar cinco novos no mesmo piso.
 */
export const MODIFICADORES: readonly ModificadorDef[] = [
  {
    id: 'veloz', nome: 'Acelerado', profundidadeMin: 3, peso: 1,
    descricao: 'Move-se e atira mais rápido.',
    velocidade: 1.35, cadencia: 1.25,
  },
  {
    id: 'blindado', nome: 'Blindado', profundidadeMin: 5, peso: 2,
    descricao: 'Resiste a todos os elementos.',
    resistencia: 0.25, vida: 1.2,
  },
  {
    id: 'regenerador', nome: 'Regenerador', profundidadeMin: 8, peso: 3,
    descricao: 'Recupera vida continuamente — exige dano sustentado.',
    regen: 0.012,
  },
  {
    id: 'enxame', nome: 'Enxame', profundidadeMin: 12, peso: 3,
    descricao: 'Invoca lacaios sem parar. Limpe antes de focar.',
    invocaCada: 6,
  },
  {
    id: 'refletor', nome: 'Refletor', profundidadeMin: 18, peso: 3,
    descricao: 'Devolve parte do dano recebido. Cuidado com a rajada.',
    reflexo: 0.12,
  },
  {
    id: 'fragmentador', nome: 'Fragmentador', profundidadeMin: 25, peso: 4,
    descricao: 'Divide-se em dois pela metade da vida.',
    divideEm: 0.5, vida: 0.8,
  },
  {
    id: 'pressa', nome: 'Contagem Regressiva', profundidadeMin: 30, peso: 3,
    descricao: 'Há um limite de tempo. Estourar conta como derrota.',
    limiteDeTempo: 90,
  },
  {
    id: 'sufocante', nome: 'Sufocante', profundidadeMin: 40, peso: 4,
    descricao: 'Seu escudo não regenera durante a luta.',
    travaEscudo: true,
  },
  {
    id: 'colosso', nome: 'Colosso', profundidadeMin: 50, peso: 4,
    descricao: 'Muito mais vida e dano, mas lento.',
    vida: 2.2, dano: 1.5, velocidade: 0.7,
  },
  {
    id: 'furia', nome: 'Fúria', profundidadeMin: 60, peso: 5,
    descricao: 'Regenera, invoca e acelera. O pacote completo.',
    regen: 0.008, invocaCada: 8, cadencia: 1.3, velocidade: 1.2,
  },
  {
    id: 'espelho', nome: 'Espelho', profundidadeMin: 70, peso: 5,
    descricao: 'Assume o SEU elemento — a vantagem elemental some.',
    espelhaElemento: true, resistencia: 0.15,
  },
];

export const MODIFICADOR_POR_ID = new Map(MODIFICADORES.map((m) => [m.id, m]));

/**
 * Teto de peso somado por piso, pela profundidade.
 *
 * É o freio que impede o sorteio de empilhar três efeitos brutais num piso
 * baixo. Sobe devagar: o piso 100 aguenta 10 de peso, que são dois a três
 * modificadores pesados, não onze.
 */
export function tetoDePeso(piso: number): number {
  if (piso < 3) return 0;
  return Math.min(10, 1 + Math.floor(piso / 8));
}

/**
 * Os MARCOS furam o teto de propósito.
 *
 * O teto governa os pisos GERADOS, para o sorteio não empilhar três efeitos
 * brutais num piso baixo. O marco é escrito à mão justamente para quebrar o
 * padrão: é um pico que o jogador lembra, e um pico dentro da média não seria
 * pico. O piso 100 soma 14 de peso contra um teto de 10, e é assim que tem de
 * ser.
 *
 * Existe como função, e não como comentário solto, porque o teste precisa
 * perguntar isso em vez de repetir a regra por conta própria.
 */
export function ignoraTetoDePeso(piso: number): boolean {
  return piso % 10 === 0;
}

// ── os pisos ────────────────────────────────────────────────────────────────

export interface RecompensaDePiso {
  sucata: number;
  nucleos: number;
  cristais: number;
  medalhas: number;
  itens: { quantidade: number; raridadeMin: Rarity };
  materiais: Record<string, number>;
  /** Chance de o item EXCLUSIVO do piso cair, 0..1. */
  chanceExclusivo: number;
}

export interface PisoDef {
  piso: number;
  chefeId: string;
  /** Multiplicador de vida e dano do chefe, acima do valor de catálogo. */
  escala: number;
  modificadores: string[];
  /** Peso somado dos modificadores — alimenta a recompensa. */
  peso: number;
  requisitos: readonly Requisito[];
  /** É um piso MARCO: escrito à mão, com identidade própria. */
  marco: boolean;
  recompensa: RecompensaDePiso;
}

/**
 * Sorteio determinístico por piso.
 *
 * Hash estável em vez do `Rng` do jogo: o piso 63 precisa ser o mesmo para todo
 * jogador e em toda sessão. Puxar do gerador compartilhado tornaria o conteúdo
 * dependente da ordem em que o jogador fez outras coisas.
 */
function hash(piso: number, sal: number): number {
  let h = (piso * 2654435761 + sal * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Nível de comando exigido no piso.
 *
 * Linear e não exponencial: o §34 quer o requisito como PORTA, não como segunda
 * curva de progressão. Cem pisos cobrindo do nível 40 ao 297 mantêm o Abismo à
 * frente da campanha sem virar um segundo jogo para nivelar.
 */
export function nivelExigidoNoPiso(piso: number): number {
  return Math.min(300, 40 + Math.round((piso - 1) * 2.6));
}

/**
 * Escala de vida e dano do chefe no piso.
 *
 * Geométrica suave: cem pisos multiplicam por ~170, não por dez mil. O salto
 * grande vem dos MODIFICADORES, que é onde o §33 quer a dificuldade — inflar a
 * barra de vida é exatamente o que ele proíbe.
 */
export function escalaDoPiso(piso: number): number {
  return Math.pow(1.053, piso - 1);
}

/**
 * Pisos MARCO — de dez em dez.
 *
 * Fogem do sorteio e trazem combinação escrita à mão. É onde o modo ganha cara
 * própria; sem eles, cem pisos gerados viram textura sem memória.
 */
const MARCOS: Record<number, string[]> = {
  10: ['blindado'],
  20: ['regenerador', 'enxame'],
  30: ['refletor', 'veloz'],
  40: ['fragmentador', 'pressa'],
  50: ['colosso'],
  60: ['sufocante', 'regenerador'],
  70: ['furia'],
  80: ['espelho', 'refletor'],
  90: ['furia', 'sufocante'],
  100: ['espelho', 'colosso', 'furia'],
};

/** Escolhe os modificadores do piso, respeitando profundidade e teto de peso. */
function modificadoresDoPiso(piso: number): { ids: string[]; peso: number } {
  const marco = MARCOS[piso];
  if (marco) {
    return { ids: marco, peso: marco.reduce((s, id) => s + (MODIFICADOR_POR_ID.get(id)?.peso ?? 0), 0) };
  }

  const teto = tetoDePeso(piso);
  if (teto <= 0) return { ids: [], peso: 0 };

  const elegiveis = MODIFICADORES.filter((m) => m.profundidadeMin <= piso);
  const ids: string[] = [];
  let peso = 0;

  // Até três tentativas: mais que isso empilha efeito demais mesmo dentro do
  // teto, e a luta deixa de ser legível.
  for (let t = 0; t < 3 && elegiveis.length; t++) {
    const cand = elegiveis[hash(piso, t) % elegiveis.length]!;
    if (ids.includes(cand.id)) continue;
    if (peso + cand.peso > teto) continue;
    ids.push(cand.id);
    peso += cand.peso;
  }
  return { ids, peso };
}

/** Piso de raridade do drop, em degraus. */
function pisoDeRaridade(piso: number): Rarity {
  if (piso >= 90) return 5;
  if (piso >= 70) return 4;
  if (piso >= 45) return 3;
  if (piso >= 25) return 2;
  if (piso >= 10) return 1;
  return 0;
}

/** Materiais de crafting, na família que a profundidade libera. */
function materiaisDoPiso(piso: number): Record<string, number> {
  const n = Math.max(1, Math.round(piso * 0.4));
  if (piso >= 80) {
    return { essencia_primordial: Math.max(1, Math.round(n * 0.2)), fragmento_divino: Math.max(1, Math.round(n * 0.3)) };
  }
  if (piso >= 60) return { nucleo_de_energia: Math.max(1, Math.round(n * 0.5)), aco_estelar: n };
  if (piso >= 35) return { aco_estelar: Math.max(1, Math.round(n * 0.6)), cristal_quantico: n };
  if (piso >= 15) return { cristal_quantico: Math.max(1, Math.round(n * 0.5)), titanio: n };
  return { titanio: Math.max(1, Math.round(n * 0.6)), ferrita: n * 2 };
}

/**
 * Recompensa do piso.
 *
 * O §35 pede explicitamente que NÃO suba tudo linearmente, e cada linha aqui
 * tem curva própria: sucata acompanha a escala, cristal só a cada cinco pisos,
 * medalha só nos marcos, e o piso de raridade sobe em degraus. É isso que faz o
 * piso 50 valer por ser o piso 50, e não por ser cinquenta vezes o piso 1.
 *
 * O peso dos MODIFICADORES entra na conta: dois pisos da mesma profundidade
 * pagam diferente se um deles for mais complicado de matar.
 */
export function recompensaDoPiso(piso: number, peso: number): RecompensaDePiso {
  const escala = escalaDoPiso(piso);
  const bonusDeDificuldade = 1 + peso * 0.09;
  const marco = piso % 10 === 0;

  return {
    sucata: Math.round(1_500 * escala * bonusDeDificuldade),
    nucleos: Math.round(120 * escala * bonusDeDificuldade),
    // Cristal em degrau, não contínuo: recebê-lo tem de ser um evento.
    cristais: piso % 5 === 0 ? Math.round(8 + piso * 0.6) : 0,
    // Medalha SÓ em marco — é registro de feito, não moeda de rotina.
    medalhas: marco ? 1 + Math.floor(piso / 30) : 0,
    itens: { quantidade: marco ? 3 : 1, raridadeMin: pisoDeRaridade(piso) },
    materiais: materiaisDoPiso(piso),
    // O exclusivo tem tabela PRÓPRIA (§35): só nos pisos profundos, e subindo
    // devagar — senão deixa de ser exclusivo lá pelo piso 40.
    chanceExclusivo: piso < 20 ? 0 : Math.min(0.35, (piso - 20) * 0.004),
  };
}

/**
 * Requisitos de acesso (§34).
 *
 * Reaproveita o `Requisito` das missões — mesma união discriminada, mesmo
 * resolvedor em `sim/missoes.ts`. O §34 pede que sejam CONFIGURÁVEIS, e um
 * segundo sistema de requisito com as mesmas variantes seria a duplicação que o
 * §50 manda evitar; de quebra, todo requisito novo que as missões ganharem o
 * Abismo herda de graça.
 */
export function requisitosDoPiso(piso: number): readonly Requisito[] {
  const req: Requisito[] = [{ tipo: 'nivelPersonagem', valor: nivelExigidoNoPiso(piso) }];
  // O piso anterior é porta obrigatória — é o que faz do Abismo uma escada, e
  // não uma lista de desafios avulsos.
  if (piso > 1) req.push({ tipo: 'abismoPiso', valor: piso - 1 });
  return req;
}

/**
 * O piso, montado.
 *
 * Sem cache: a função é pura e barata, e um cache aqui só criaria a chance de a
 * tela mostrar um piso diferente do que a simulação usou.
 */
export function pisoDoAbismo(piso: number): PisoDef {
  const p = Math.max(1, Math.min(ABISMO_PISOS, Math.floor(piso)));
  const { ids, peso } = modificadoresDoPiso(p);

  return {
    piso: p,
    // Elenco PRÓPRIO: cem criaturas distintas, uma por piso. Antes eram os dez
    // chefes de galáxia em rodízio, e a variedade vinha só do modificador — o
    // que fazia o piso 47 ser o piso 7 com outro traje. Agora a mecânica
    // diferente cai sobre uma criatura diferente.
    chefeId: chefeDoPiso(p).id,
    escala: escalaDoPiso(p),
    modificadores: ids,
    peso,
    marco: p % 10 === 0,
    requisitos: requisitosDoPiso(p),
    recompensa: recompensaDoPiso(p, peso),
  };
}

/** Efeitos somados dos modificadores de um piso, prontos para o combate. */
export function efeitosDoPiso(piso: PisoDef): {
  vida: number; dano: number; velocidade: number; cadencia: number;
  regen: number; reflexo: number; resistencia: number;
  invocaCada: number; divideEm: number; limiteDeTempo: number;
  travaEscudo: boolean; espelhaElemento: boolean;
} {
  const e = {
    vida: 1, dano: 1, velocidade: 1, cadencia: 1,
    regen: 0, reflexo: 0, resistencia: 0,
    invocaCada: 0, divideEm: 0, limiteDeTempo: 0,
    travaEscudo: false, espelhaElemento: false,
  };
  for (const id of piso.modificadores) {
    const m = MODIFICADOR_POR_ID.get(id);
    if (!m) continue;
    // Multiplicadores COMPÕEM, parcelas SOMAM — a mesma regra da tabela de drop
    // (§10). Somar multiplicador daria 2,2 + 1,2 = 3,4 onde o certo é 2,64.
    e.vida *= m.vida ?? 1;
    e.dano *= m.dano ?? 1;
    e.velocidade *= m.velocidade ?? 1;
    e.cadencia *= m.cadencia ?? 1;
    e.regen += m.regen ?? 0;
    e.reflexo += m.reflexo ?? 0;
    e.resistencia += m.resistencia ?? 0;
    // Do menor intervalo de invocação vale o mais agressivo.
    if (m.invocaCada) e.invocaCada = e.invocaCada ? Math.min(e.invocaCada, m.invocaCada) : m.invocaCada;
    if (m.divideEm) e.divideEm = Math.max(e.divideEm, m.divideEm);
    if (m.limiteDeTempo) e.limiteDeTempo = e.limiteDeTempo ? Math.min(e.limiteDeTempo, m.limiteDeTempo) : m.limiteDeTempo;
    e.travaEscudo ||= !!m.travaEscudo;
    e.espelhaElemento ||= !!m.espelhaElemento;
  }
  // Teto de sanidade, como toda fórmula do projeto: resistência somada de três
  // modificadores não pode chegar a 1 e tornar o chefe imortal.
  e.resistencia = Math.min(0.75, e.resistencia);
  e.reflexo = Math.min(0.4, e.reflexo);
  return e;
}
