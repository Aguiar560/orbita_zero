import { Rng, TAU, hashString } from '@core/math';
import type { StatId, StatModifier } from '@sim/types';

export type NodeKind = 'inicio' | 'pequeno' | 'notavel' | 'chave';

export interface TreeNode {
  id: string;
  kind: NodeKind;
  branch: string;
  /** Posição no espaço da matriz (unidades arbitrárias, centro em 0,0). */
  x: number;
  y: number;
  name: string;
  desc: string;
  icon: string;
  stats: StatModifier[];
}

export interface TreeBranch {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Ângulo do eixo da ramificação, em radianos. */
  angle: number;
}

const add = (stat: StatId, value: number): StatModifier => ({ stat, kind: 'add', value });
const mul = (stat: StatId, value: number): StatModifier => ({ stat, kind: 'mul', value });

interface BranchSpec {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Pacote dos nós pequenos, repetido ao longo da espinha. */
  small: { stats: StatModifier[]; label: string };
  /** Pacote alternativo, usado nos nós laterais. */
  alt: { stats: StatModifier[]; label: string };
  notables: { name: string; desc: string; stats: StatModifier[] }[];
  keystone: { name: string; desc: string; stats: StatModifier[] };
}

/**
 * As oito ramificações da Matriz de Comando.
 *
 * A geometria é radial: cada ramificação sai do centro num ângulo fixo, e dois
 * anéis de ligação cruzam todas elas. Os anéis são o que torna a matriz uma
 * *árvore de caminhos* e não oito listas paralelas — vale a pena atravessar
 * para um notável vizinho, e esse desvio custa pontos.
 */
const BRANCH_SPECS: readonly BranchSpec[] = [
  {
    id: 'artilharia',
    name: 'Artilharia',
    color: '#ff6a4d',
    icon: 'node/dano',
    small: { stats: [mul('dano', 0.06)], label: '+6% de dano' },
    alt: { stats: [add('dano', 3)], label: '+3 de dano por tiro' },
    notables: [
      { name: 'Calibre Maior', desc: 'Canos mais grossos, recuo pior, buracos maiores.', stats: [mul('dano', 0.22), add('dano', 6)] },
      { name: 'Ogiva Densa', desc: 'A carga não explode: perfura e depois explode.', stats: [mul('dano', 0.3), add('explosao', 10)] },
    ],
    keystone: {
      name: 'Sobrecarga Terminal',
      desc: 'Cada disparo drena o reator inteiro. Dobra o impacto, mata a cadência.',
      stats: [mul('dano', 1.2), mul('cadencia', -0.4)],
    },
  },
  {
    id: 'cadencia',
    name: 'Cadência',
    color: '#ffb638',
    icon: 'node/cooldown',
    small: { stats: [mul('cadencia', 0.05)], label: '+5% de cadência' },
    alt: { stats: [mul('cadencia', 0.03), mul('velocidade', 0.03)], label: '+3% de cadência e velocidade' },
    notables: [
      { name: 'Refrigeração Ativa', desc: 'O cano nunca esquenta o bastante para parar.', stats: [mul('cadencia', 0.2)] },
      { name: 'Salva Dupla', desc: 'Dois projéteis onde antes havia um.', stats: [add('projeteis', 1), mul('cadencia', 0.08)] },
    ],
    keystone: {
      name: 'Fluxo Contínuo',
      desc: 'A arma não dispara: ela derrama. Muito volume, pouco peso por tiro.',
      stats: [mul('cadencia', 1.0), mul('dano', -0.35)],
    },
  },
  {
    id: 'precisao',
    name: 'Precisão',
    color: '#ffe08a',
    icon: 'node/crit',
    small: { stats: [add('critChance', 0.012)], label: '+1.2% de chance de crítico' },
    alt: { stats: [add('critDano', 0.1)], label: '+10% de dano crítico' },
    notables: [
      { name: 'Ponto Fraco', desc: 'O sistema de mira aprende onde a blindagem falha.', stats: [add('critChance', 0.05), add('critDano', 0.25)] },
      { name: 'Execução', desc: 'Um acerto crítico raramente precisa de um segundo.', stats: [add('critDano', 0.7)] },
    ],
    keystone: {
      name: 'Precisão Absoluta',
      desc: 'Só o ponto exato importa. O tiro comum vira quase decorativo.',
      stats: [add('critChance', 0.35), mul('dano', -0.25)],
    },
  },
  {
    id: 'perfuracao',
    name: 'Perfuração',
    color: '#8dff5c',
    icon: 'node/alcance',
    small: { stats: [add('explosao', 3)], label: '+3 de raio de explosão' },
    alt: { stats: [mul('dano', 0.04), add('explosao', 2)], label: '+4% de dano e +2 de raio' },
    notables: [
      { name: 'Núcleo Penetrante', desc: 'O projétil atravessa o primeiro casco e continua.', stats: [add('perfuracao', 1), mul('dano', 0.1)] },
      { name: 'Estilhaço Amplo', desc: 'O que sobra do impacto ainda mata quem estava perto.', stats: [add('explosao', 16), mul('dano', 0.12)] },
    ],
    keystone: {
      name: 'Lança Contínua',
      desc: 'Um feixe que atravessa a formação inteira — se você tiver tempo de mirar.',
      stats: [add('perfuracao', 4), add('explosao', 14), mul('cadencia', -0.3)],
    },
  },
  {
    id: 'blindagem',
    name: 'Blindagem',
    color: '#c98a52',
    icon: 'node/peso',
    small: { stats: [mul('vida', 0.07)], label: '+7% de casco' },
    alt: { stats: [add('vida', 22)], label: '+22 de casco' },
    notables: [
      { name: 'Placa Reativa', desc: 'A blindagem responde ao impacto endurecendo.', stats: [mul('vida', 0.25), add('vida', 40)] },
      { name: 'Estrutura Redundante', desc: 'Nada de ponto único de falha.', stats: [mul('vida', 0.35)] },
    ],
    keystone: {
      name: 'Casco Monolítico',
      desc: 'Uma peça só, sem juntas. Não há espaço para emissores de escudo.',
      stats: [mul('vida', 1.5), mul('escudo', -0.5)],
    },
  },
  {
    id: 'defletor',
    name: 'Defletor',
    color: '#38a9ff',
    icon: 'node/escudo',
    small: { stats: [mul('escudo', 0.08)], label: '+8% de escudo' },
    alt: { stats: [add('regen', 1.2)], label: '+1.2 de regeneração por segundo' },
    notables: [
      { name: 'Campo Harmônico', desc: 'A barreira volta antes de você notar que caiu.', stats: [mul('escudo', 0.25), add('regen', 3)] },
      { name: 'Camadas Sobrepostas', desc: 'Três emissores desalinhados de propósito.', stats: [mul('escudo', 0.4)] },
    ],
    keystone: {
      name: 'Barreira Perpétua',
      desc: 'Todo o casco vira alimentação do defletor. Enquanto o campo aguenta, você é intocável.',
      stats: [mul('escudo', 0.6), mul('regen', 2.0), mul('vida', -0.4)],
    },
  },
  {
    id: 'vetor',
    name: 'Vetor',
    color: '#7fe4ff',
    icon: 'node/vel',
    small: { stats: [mul('velocidade', 0.05)], label: '+5% de manobra' },
    alt: { stats: [add('iaSkill', 0.015)], label: '+1.5% de sincronia do piloto' },
    notables: [
      { name: 'Reflexo Sintético', desc: 'O piloto decide mais vezes por segundo.', stats: [add('iaSkill', 0.05), mul('velocidade', 0.1)] },
      { name: 'Vetorização Total', desc: 'Mudar de direção deixa de custar tempo.', stats: [mul('velocidade', 0.25)] },
    ],
    keystone: {
      name: 'Reflexos Absolutos',
      desc: 'A nave passa entre os projéteis. Não sobra energia para as armas.',
      stats: [add('iaSkill', 0.3), mul('velocidade', 0.4), mul('dano', -0.25)],
    },
  },
  {
    id: 'prospeccao',
    name: 'Prospecção',
    color: '#c060ff',
    icon: 'node/exp',
    small: { stats: [add('sorte', 0.025)], label: '+2.5% de sorte' },
    alt: { stats: [mul('sucataGanho', 0.1), mul('nucleoGanho', 0.08)], label: '+10% de sucata e +8% de núcleos' },
    notables: [
      { name: 'Sensor Profundo', desc: 'Detecta a liga rara antes de destruir o casco.', stats: [add('sorte', 0.12), mul('nucleoGanho', 0.2)] },
      { name: 'Rede Logística', desc: 'Nada do que você abate se perde no vácuo.', stats: [mul('sucataGanho', 0.45), mul('xpGanho', 0.25)] },
    ],
    keystone: {
      name: 'Fome de Relíquias',
      desc: 'Você deixa de reforçar a nave para caber mais carga. Vale a pena até não valer.',
      stats: [add('sorte', 1.2), mul('sucataGanho', 1.0), mul('nucleoGanho', 1.0), mul('vida', -0.3), mul('dano', -0.3)],
    },
  },
];

// ── Geometria ───────────────────────────────────────────────────────────────

/** Raios da espinha de cada ramificação, do centro para fora. */
const SPINE_RADII = [130, 210, 290, 375, 460, 545, 635, 725, 830];
/** Índices da espinha que recebem notáveis e o final que recebe a chave. */
const NOTABLE_AT = [2, 5];
const KEYSTONE_AT = 8;
/** Raios em que os anéis de ligação cruzam as ramificações. */
const RING_AT = [1, 4, 7];
/** Deslocamentos angulares do cacho que envolve cada notável. */
const CLUSTER_OFFSETS: readonly [number, number][] = [[-0.2, 40], [0.2, 40], [0, 82]];

export const BRANCHES: readonly TreeBranch[] = BRANCH_SPECS.map((spec, i) => ({
  id: spec.id,
  name: spec.name,
  color: spec.color,
  icon: spec.icon,
  angle: (i / BRANCH_SPECS.length) * TAU - Math.PI / 2,
}));

function build(): { nodes: TreeNode[]; edges: [string, string][] } {
  const nodes: TreeNode[] = [];
  const edges: [string, string][] = [];

  nodes.push({
    id: 'inicio',
    kind: 'inicio',
    branch: 'centro',
    x: 0,
    y: 0,
    name: 'Núcleo de Comando',
    desc: 'Onde toda a matriz começa. Já vem alocado.',
    icon: 'node/energia',
    stats: [],
  });

  BRANCH_SPECS.forEach((spec, bi) => {
    const angle = BRANCHES[bi]!.angle;
    // Jitter determinístico por ramificação: tira a rigidez do desenho radial
    // sem introduzir aleatoriedade entre sessões.
    const rng = new Rng(hashString(spec.id));
    const spine: string[] = [];

    SPINE_RADII.forEach((radius, si) => {
      const wobble = (rng.next() - 0.5) * 0.06;
      const a = angle + wobble;
      const id = `${spec.id}_${si}`;
      const isNotable = NOTABLE_AT.includes(si);
      const isKeystone = si === KEYSTONE_AT;

      const notable = isNotable ? spec.notables[NOTABLE_AT.indexOf(si)] : undefined;

      nodes.push({
        id,
        kind: isKeystone ? 'chave' : isNotable ? 'notavel' : 'pequeno',
        branch: spec.id,
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        name: isKeystone ? spec.keystone.name : (notable?.name ?? spec.name),
        desc: isKeystone ? spec.keystone.desc : (notable?.desc ?? spec.small.label),
        icon: spec.icon,
        stats: isKeystone ? spec.keystone.stats : (notable?.stats ?? spec.small.stats),
      });
      spine.push(id);

      if (si > 0) edges.push([spine[si - 1]!, id]);
      else edges.push(['inicio', id]);

      // Cacho em torno de cada notável: dá volume à matriz e obriga a escolher
      // entre aprofundar na ramificação ou varrer o que está ao redor.
      if (isNotable) {
        const cluster: string[] = [];
        CLUSTER_OFFSETS.forEach(([spread, push], k) => {
          const sideId = `${spec.id}_${si}c${k}`;
          const sa = a + spread;
          nodes.push({
            id: sideId,
            kind: 'pequeno',
            branch: spec.id,
            x: Math.cos(sa) * (radius + push),
            y: Math.sin(sa) * (radius + push),
            name: spec.name,
            desc: spec.alt.label,
            icon: spec.icon,
            stats: spec.alt.stats,
          });
          cluster.push(sideId);
          edges.push([id, sideId]);
        });
        // Fecha o cacho: os dois laterais também ligam no da ponta, então há
        // duas rotas para atravessá-lo e nenhuma delas é obrigatória.
        edges.push([cluster[0]!, cluster[2]!]);
        edges.push([cluster[1]!, cluster[2]!]);
      }
    });

    // Anéis: ligam esta ramificação à seguinte, fechando o círculo. São eles
    // que transformam oito listas paralelas numa matriz de rotas.
    const next = BRANCH_SPECS[(bi + 1) % BRANCH_SPECS.length]!;
    for (const ri of RING_AT) {
      const radius = SPINE_RADII[ri]! + 34;
      const a0 = BRANCHES[bi]!.angle;
      const a1 = a0 + TAU / BRANCH_SPECS.length;
      const link: string[] = [`${spec.id}_${ri}`];
      const steps = ri >= 7 ? 4 : 3;

      for (let k = 1; k < steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        const id = `anel${ri}_${spec.id}_${k}`;
        nodes.push({
          id,
          kind: 'pequeno',
          branch: ri === RING_AT[0] ? spec.id : next.id,
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius,
          name: 'Conduíte',
          desc: k === 1 ? spec.small.label : next.small.label,
          icon: k === 1 ? spec.icon : next.icon,
          stats: k === 1 ? spec.small.stats : next.small.stats,
        });
        link.push(id);
      }
      link.push(`${next.id}_${ri}`);
      for (let k = 0; k < link.length - 1; k++) edges.push([link[k]!, link[k + 1]!]);
    }
  });

  return { nodes, edges };
}

const built = build();

export const TREE_NODES: readonly TreeNode[] = built.nodes;
export const TREE_EDGES: readonly [string, string][] = built.edges;
export const NODE_BY_ID = new Map(TREE_NODES.map((n) => [n.id, n]));

/** Lista de adjacência, montada uma vez no carregamento. */
export const TREE_ADJACENCY: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const node of TREE_NODES) map.set(node.id, []);
  for (const [a, b] of TREE_EDGES) {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  }
  return map;
})();

/** Extensão da matriz, para enquadrar a câmera do painel. */
export const TREE_BOUNDS = (() => {
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const n of TREE_NODES) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const pad = 90;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
})();

export const BRANCH_BY_ID = new Map(BRANCHES.map((b) => [b.id, b]));

export const NODE_RADIUS: Record<NodeKind, number> = {
  inicio: 34,
  pequeno: 16,
  notavel: 26,
  chave: 34,
};
