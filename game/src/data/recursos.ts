import type { Rarity } from '@sim/types';

/**
 * Os 70 recursos de `Recursos.png` (§10, §29).
 *
 * A ORDEM É A DA FOLHA: leitura da esquerda para a direita, linha a linha. O
 * ícone é casado por ÍNDICE (`recurso/0` … `recurso/69`), não por nome — assim
 * renomear "Ferrita" para outra coisa não exige reexportar arte, e um teste
 * confere que a contagem do catálogo bate com a do atlas.
 *
 * Cada fileira da folha é uma FAMÍLIA, e é ela que decide de onde o recurso
 * vem. Isso não é organização: é o que permite dizer "planeta vulcânico solta
 * minério e gás" sem listar recurso por recurso, e continuar valendo quando a
 * folha ganhar uma fileira nova.
 */

export type FamiliaDeRecurso =
  /** Fileiras 1–2: minérios e metais. O chão do craft, sai de mineração. */
  | 'minerio'
  /** Fileira 3: ligas e estruturas exóticas. Craft intermediário. */
  | 'exotico'
  /** Fileira 4: gases e plasmas. Saem de nebulosas e estrelas. */
  | 'gas'
  /** Fileira 5: orgânicos. Saem de mundos vivos e de inimigos biológicos. */
  | 'organico'
  /** Fileira 6: tecnologia e artefatos. Quase tudo vem de chefe ou de missão. */
  | 'tecnologia'
  /** Fileira 7: pós e essências. O topo — chefe tardio, torre, evento. */
  | 'essencia';

/**
 * De onde um recurso pode vir.
 *
 * `torre` e `missao` não têm sistema ainda — são da Fase 5. Estão declarados
 * agora porque o pedido é explícito em já deixar guardado: quando a torre
 * existir, ligá-la é ler esta lista, não reclassificar setenta recursos.
 */
export type OrigemDeRecurso = 'planeta' | 'chefe' | 'torre' | 'missao' | 'evento' | 'desmanche';

export interface RecursoDef {
  /** Id estável, não-visual. Nunca reaproveitar um id retirado. */
  id: string;
  nome: string;
  familia: FamiliaDeRecurso;
  raridade: Rarity;
  /** Índice na folha — é ele que resolve o sprite `recurso/<indice>`. */
  indice: number;
  /** Todas as origens possíveis. Vazio seria um recurso inalcançável. */
  origens: readonly OrigemDeRecurso[];
}

/** Ordem de leitura da folha. Mexer aqui exige mexer no recorte. */
const LINHAS: { familia: FamiliaDeRecurso; raridade: Rarity; origens: OrigemDeRecurso[]; nomes: string[] }[] = [
  {
    familia: 'minerio', raridade: 0, origens: ['planeta', 'desmanche'],
    nomes: ['Ferrita', 'Pirita', 'Diamantita', 'Titânio', 'Urânio', 'Platina', 'Irídio', 'Obsidiana', 'Lítio', 'Cobalto'],
  },
  {
    familia: 'minerio', raridade: 1, origens: ['planeta', 'desmanche'],
    nomes: ['Neodímio', 'Cromita', 'Zircônio', 'Ródio', 'Vanádio', 'Níquel', 'Molibdênio', 'Tântalo', 'Tecnécio', 'Manganês'],
  },
  {
    familia: 'exotico', raridade: 2, origens: ['planeta', 'chefe'],
    nomes: ['Escória Estelar', 'Fragmento de Meteoro', 'Nanofibra', 'Grafeno', 'Cristal Quântico', 'Nanotubo', 'Aço Estelar', 'Liga Celestial', 'Fluxo Dimensional', 'Matéria Escura'],
  },
  {
    familia: 'gas', raridade: 2, origens: ['planeta', 'evento'],
    nomes: ['Gás Hélio-3', 'Deutério', 'Xenônio', 'Argônio', 'Neônio', 'Radônio', 'Plasma Estelar', 'Criogás', 'Gás Vulcânico', 'Gás Exótico'],
  },
  {
    familia: 'organico', raridade: 3, origens: ['planeta', 'missao'],
    nomes: ['Biogel', 'Esporo Alienígena', 'Tecido Vorg', 'Núcleo Orgânico', 'Essência Xeno', 'Pele Quântica', 'Cristal Vivo', 'Alga Estelar', 'Néctar Estelar', 'Polpa Nebular'],
  },
  {
    familia: 'tecnologia', raridade: 4, origens: ['chefe', 'missao', 'torre'],
    nomes: ['Núcleo de Energia', 'Micro Reator', 'Célula Quântica', 'Fragmento de Singularidade', 'Matriz Neural', 'Artefato Alien', 'Runa Estelar', 'Lente Gravitacional', 'Protótipo', 'Fragmento Divino'],
  },
  {
    familia: 'essencia', raridade: 5, origens: ['chefe', 'torre', 'evento'],
    nomes: ['Pó Lunar', 'Rolha de Asteroide', 'Areia Estelar', 'Cinzas Cósmicas', 'Crista Meteórica', 'Sangue de Estrela', 'Lágrima Galáctica', 'Átomo Raro', 'Fragmento Temporal', 'Essência Primordial'],
  },
];

/** Id a partir do nome: minúsculas, sem acento, com sublinhado. */
function idDe(nome: string): string {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export const RECURSOS: readonly RecursoDef[] = LINHAS.flatMap((linha, l) =>
  linha.nomes.map((nome, c) => ({
    id: idDe(nome),
    nome,
    familia: linha.familia,
    raridade: linha.raridade,
    indice: l * 10 + c,
    origens: linha.origens,
  })),
);

export const RECURSO_POR_ID = new Map(RECURSOS.map((r) => [r.id, r]));

/**
 * Sprite do recurso no atlas.
 *
 * Por ID e não por índice. Era `recurso/${indice}` enquanto a arte vinha de uma
 * folha em grade, onde a posição ERA a identidade. Agora cada recurso é um
 * arquivo com o próprio nome, e casar por nome é mais robusto: acrescentar um
 * recurso no meio da lista deixaria de deslocar o ícone de todos os seguintes.
 */
export const iconeDeRecurso = (r: RecursoDef): string => `recurso/${r.id}`;

/** Rótulo de cada família, para agrupar o Armazém. */
export const FAMILIA_LABEL: Record<FamiliaDeRecurso, string> = {
  minerio: 'Minérios e metais',
  exotico: 'Ligas e exóticos',
  gas: 'Gases e plasmas',
  organico: 'Orgânicos',
  tecnologia: 'Tecnologia e artefatos',
  essencia: 'Pós e essências',
};

export const FAMILIAS_ORDENADAS: readonly FamiliaDeRecurso[] = [
  'minerio', 'exotico', 'gas', 'organico', 'tecnologia', 'essencia',
];

// ── quem solta o quê ────────────────────────────────────────────────────────

/**
 * Os três recursos de um planeta, derivados do SETOR.
 *
 * Derivados e não tabelados pelo mesmo motivo das regras de drop: as galáxias
 * são procedurais e não há lista de planetas: uma tabela estaria errada na
 * primeira fase nova, em silêncio. A escolha é determinística — o mesmo setor
 * dá sempre os mesmos três —, o que é o que torna farmar um recurso possível:
 * o jogador aprende onde ele cai e volta lá.
 *
 * A profundidade do setor abre famílias melhores: os primeiros setores só dão
 * minério, e exóticos, gases e orgânicos entram conforme o jogo avança.
 */
export function recursosDoPlaneta(setor: number, quantos = 3): RecursoDef[] {
  const disponiveis = RECURSOS.filter(
    (r) => r.origens.includes('planeta') && setor >= limiarDeFamilia(r.familia),
  );
  if (!disponiveis.length) return [];

  // Hash simples e estável do setor. Não usa `Rng` de propósito: isto é
  // consultado pela UI a cada quadro, e não pode consumir estado de sorteio.
  const out: RecursoDef[] = [];
  for (let i = 0; i < quantos; i++) {
    const h = (setor * 2654435761 + i * 40503) >>> 0;
    const pick = disponiveis[h % disponiveis.length]!;
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}

/** A partir de que setor cada família começa a aparecer em planeta. */
function limiarDeFamilia(f: FamiliaDeRecurso): number {
  switch (f) {
    case 'minerio': return 1;
    case 'exotico': return 25;
    case 'gas': return 45;
    case 'organico': return 80;
    default: return Infinity;
  }
}

/**
 * O recurso ESPECÍFICO de um chefe.
 *
 * Um por chefe, e sempre o mesmo: é o que transforma um chefe em destino de
 * farm em vez de obstáculo. Sai da lista de tecnologia e essências, que são
 * justamente as famílias sem origem em planeta.
 */
export function recursoDoChefe(bossId: string): RecursoDef | null {
  const pool = RECURSOS.filter((r) => r.origens.includes('chefe') && r.familia !== 'exotico');
  if (!pool.length) return null;
  let h = 2166136261;
  for (let i = 0; i < bossId.length; i++) {
    h ^= bossId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return pool[h % pool.length]!;
}
