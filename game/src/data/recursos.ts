import { galaxyOfSector } from '@data/galaxies';
import type { Rarity } from '@sim/types';

/**
 * Catálogo econômico dos 70 materiais do jogo.
 *
 * A família agora é uma regra de obtenção, não apenas uma categoria visual:
 * - minérios/exóticos: um material-assinatura por galáxia;
 * - orgânicos: contratos e missões;
 * - gases: eventos;
 * - tecnologia: chefes;
 * - essências: Provação.
 */
export type FamiliaDeRecurso =
  | 'minerio'
  | 'exotico'
  | 'gas'
  | 'organico'
  | 'tecnologia'
  | 'essencia';

export type OrigemDeRecurso = 'planeta' | 'chefe' | 'provacao' | 'missao' | 'evento' | 'desmanche';
export type EscopoDeRecurso = 'galaxia' | 'chefe' | 'provacao' | 'missao' | 'evento';
export type EstadoDeRecurso = 'ativo' | 'planejado';
export type EstadoDaArte = 'final' | 'provisoria';

export interface RecursoDef {
  id: string;
  nome: string;
  familia: FamiliaDeRecurso;
  raridade: Rarity;
  indice: number;
  escopo: EscopoDeRecurso;
  /** Galáxia de origem, 0-based, somente para materiais de galáxia. */
  galaxia?: number;
  origens: readonly OrigemDeRecurso[];
  drop: string;
  funcao: string;
  dropEstado: EstadoDeRecurso;
  usoEstado: EstadoDeRecurso;
  /** `final` = arquivo com alfa em Recursos 2.0. */
  arte: EstadoDaArte;
}

interface LinhaDeRecurso {
  familia: FamiliaDeRecurso;
  raridade: Rarity;
  nomes: readonly string[];
  funcoes: readonly string[];
}

/** Ordem histórica da folha: 7 fileiras de 10. */
const LINHAS: readonly LinhaDeRecurso[] = [
  {
    familia: 'minerio', raridade: 0,
    nomes: ['Ferrita', 'Pirita', 'Diamantita', 'Titânio', 'Urânio', 'Platina', 'Irídio', 'Obsidiana', 'Lítio', 'Cobalto'],
    funcoes: [
      'Fusão comum e estruturas básicas.',
      'Revestimentos condutores e circuitos iniciais.',
      'Reforço de armas e ferramentas de precisão.',
      'Fusão rara e cascos resistentes.',
      'Combustível para reatores e munição irradiada.',
      'Contatos de sensores e eletrônica de alta precisão.',
      'Motores e peças resistentes a calor extremo.',
      'Blindagem térmica e placas de absorção.',
      'Células de energia e módulos de escudo.',
      'Ligas magnéticas para torres e propulsores.',
    ],
  },
  {
    familia: 'minerio', raridade: 1,
    nomes: ['Neodímio', 'Cromita', 'Zircônio', 'Ródio', 'Vanádio', 'Níquel', 'Molibdênio', 'Tântalo', 'Tecnécio', 'Manganês'],
    funcoes: [
      'Ímãs de armas, drones e motores avançados.',
      'Proteção anticorrosiva para cascos.',
      'Cerâmica de reator e isolamento térmico.',
      'Catalisadores de energia e sensores raros.',
      'Ligas leves para mobilidade e cadência.',
      'Estruturas estáveis e baterias industriais.',
      'Canos de arma e peças de alta temperatura.',
      'Capacitores e componentes eletrônicos avançados.',
      'Sistemas experimentais e rastreadores radioativos.',
      'Ligas de impacto e reforço estrutural.',
    ],
  },
  {
    familia: 'exotico', raridade: 2,
    nomes: ['Escória Estelar', 'Fragmento de Meteoro', 'Nanofibra', 'Grafeno', 'Cristal Quântico', 'Nanotubo', 'Aço Estelar', 'Liga Celestial', 'Fluxo Dimensional', 'Matéria Escura'],
    funcoes: [
      'Fundição de ligas estelares e componentes incendiários.',
      'Blindagens cinéticas e projéteis de impacto.',
      'Estruturas leves e tecidos técnicos.',
      'Condutores, escudos e dissipadores avançados.',
      'Fusão épica e recalibração de propriedades raras.',
      'Suportes ultraleves para armas e motores.',
      'Fusão lendária e chassis de alto nível.',
      'Construção de componentes de raridade mítica.',
      'Craft dimensional e alteração de espaço de afixos.',
      'Tecnologia de fim de jogo e projetos proibidos.',
    ],
  },
  {
    familia: 'gas', raridade: 2,
    nomes: ['Gás Hélio-3', 'Deutério', 'Xenônio', 'Argônio', 'Neônio', 'Radônio', 'Plasma Estelar', 'Criogás', 'Gás Vulcânico', 'Gás Exótico'],
    funcoes: [
      'Receitas de evento ligadas a propulsão.',
      'Receitas de evento ligadas a energia e fusão.',
      'Receitas de evento ligadas a lasers e íons.',
      'Receitas de evento ligadas a blindagem inerte.',
      'Receitas de evento ligadas a sinalização e velocidade.',
      'Receitas de evento ligadas a dano radioativo.',
      'Receitas sazonais de energia estelar.',
      'Receitas sazonais de gelo e controle.',
      'Receitas sazonais de fogo e explosão.',
      'Coringa raro para receitas especiais de evento.',
    ],
  },
  {
    familia: 'organico', raridade: 3,
    nomes: ['Biogel', 'Esporo Alienígena', 'Tecido Vorg', 'Núcleo Orgânico', 'Essência Xeno', 'Pele Quântica', 'Cristal Vivo', 'Alga Estelar', 'Néctar Estelar', 'Polpa Nebular'],
    funcoes: [
      'Reparo biológico e entrega médica de missão.',
      'Pesquisa de fauna e contratos de contenção.',
      'Armaduras flexíveis e contratos ligados aos Vorg.',
      'Biotecnologia, drones vivos e missões especiais.',
      'Recalibração orgânica e pesquisa xeno.',
      'Proteção adaptativa e craft de escudos.',
      'Componentes autorregenerativos de missão.',
      'Combustível biológico e contratos de coleta.',
      'Catalisador raro para relações e comerciantes.',
      'Componentes nebulosos e projetos orgânicos finais.',
    ],
  },
  {
    familia: 'tecnologia', raridade: 4,
    nomes: ['Núcleo de Energia', 'Micro Reator', 'Célula Quântica', 'Fragmento de Singularidade', 'Matriz Neural', 'Artefato Alien', 'Runa Estelar', 'Lente Gravitacional', 'Protótipo', 'Fragmento Divino'],
    funcoes: [
      'Fusão mítica e construção de sistemas de energia.',
      'Motores, reatores e melhorias de potência.',
      'Escudos e módulos quânticos de alto nível.',
      'Tecnologia de singularidade e craft dimensional.',
      'IA, drones e automação avançada.',
      'Projetos alienígenas e desbloqueios do códex.',
      'Encantamentos tecnológicos e afixos especiais.',
      'Armas gravitacionais e controle de movimento.',
      'Construção de equipamentos exclusivos de chefe.',
      'Fusão divina e ápice do craft de chefe.',
    ],
  },
  {
    familia: 'essencia', raridade: 5,
    nomes: ['Pó Lunar', 'Rolha de Asteroide', 'Areia Estelar', 'Cinzas Cósmicas', 'Crista Meteórica', 'Sangue de Estrela', 'Lágrima Galáctica', 'Átomo Raro', 'Fragmento Temporal', 'Essência Primordial'],
    funcoes: [
      'Primeiro catalisador de craft da Provação.',
      'Estabilização e proteção de uma propriedade.',
      'Recalibração controlada de valores de afixo.',
      'Remoção de propriedade e reciclagem avançada.',
      'Adição de propriedade ofensiva.',
      'Elevação do tier de um afixo.',
      'Adição de propriedade defensiva.',
      'Conversão rara entre prefixo e sufixo.',
      'Repetição ou reversão de uma recalibração.',
      'Fusão divina e craft final da Provação.',
    ],
  },
];

function idDe(nome: string): string {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Arquivos aprovados da pasta Recursos 2.0 (com alfa verdadeiro). */
export const RECURSOS_COM_ARTE_FINAL = new Set([
  'aco_estelar', 'alga_estelar', 'areia_estelar', 'argonio', 'artefato_alien', 'atomo_raro',
  'biogel', 'celula_quantica', 'cinzas_cosmicas', 'cobalto', 'criogas', 'crista_meteorica',
  'cristal_quantico', 'cristal_vivo', 'cromita', 'deuterio', 'diamantita', 'escoria_estelar',
  'esporo_alienigena', 'essencia_primordial', 'essencia_xeno',
  'ferrita', 'fluxo_dimensional', 'fragmento_de_meteoro', 'fragmento_de_singularidade',
  'fragmento_divino', 'fragmento_temporal', 'gas_exotico', 'gas_helio_3', 'gas_vulcanico',
  'grafeno', 'iridio', 'lagrima_galactica', 'lente_gravitacional', 'liga_celestial', 'litio',
  'manganes', 'materia_escura', 'matriz_neural', 'micro_reator', 'molibdenio', 'nanofibra',
  'nanotubo', 'nectar_estelar', 'neodimio', 'neonio', 'niquel', 'nucleo_de_energia',
  'nucleo_organico', 'obsidiana', 'pele_quantica', 'pirita', 'plasma_estelar', 'platina',
  'po_lunar', 'polpa_nebular', 'prototipo', 'radonio', 'rodio', 'rolha_de_asteroide',
  'runa_estelar', 'sangue_de_estrela', 'tantalo', 'tecido_vorg', 'tecnecio', 'titanio',
  'uranio', 'vanadio', 'xenonio', 'zirconio',
]);

const USOS_ATIVOS = new Set([
  'ferrita', 'titanio', 'cristal_quantico', 'aco_estelar',
  'nucleo_de_energia', 'fragmento_divino', 'essencia_primordial',
]);

/** Materiais galácticos que também podem ser recuperados de equipamento. */
const MATERIAIS_DE_DESMANCHE = new Set([
  'ferrita', 'titanio', 'cristal_quantico', 'aco_estelar',
  'liga_celestial', 'fluxo_dimensional', 'materia_escura',
]);

function origemDaFamilia(familia: FamiliaDeRecurso): OrigemDeRecurso {
  switch (familia) {
    case 'minerio':
    case 'exotico': return 'planeta';
    case 'gas': return 'evento';
    case 'organico': return 'missao';
    case 'tecnologia': return 'chefe';
    case 'essencia': return 'provacao';
  }
}

function escopoDaFamilia(familia: FamiliaDeRecurso): EscopoDeRecurso {
  switch (familia) {
    case 'minerio':
    case 'exotico': return 'galaxia';
    case 'gas': return 'evento';
    case 'organico': return 'missao';
    case 'tecnologia': return 'chefe';
    case 'essencia': return 'provacao';
  }
}

const DROP_ATIVO_MISSAO = new Set([
  'biogel', 'esporo_alienigena', 'tecido_vorg', 'nucleo_organico', 'essencia_xeno',
  'pele_quantica', 'cristal_vivo', 'alga_estelar', 'nectar_estelar', 'polpa_nebular',
]);

export const RECURSOS: readonly RecursoDef[] = LINHAS.flatMap((linha, l) =>
  linha.nomes.map((nome, c) => {
    const indice = l * 10 + c;
    const id = idDe(nome);
    const origem = origemDaFamilia(linha.familia);
    const galaxia = indice < 30 ? indice : undefined;
    const origens: OrigemDeRecurso[] = [origem];
    if (MATERIAIS_DE_DESMANCHE.has(id)) origens.push('desmanche');

    const drop = galaxia !== undefined
      ? `Recurso assinatura da Galáxia ${galaxia + 1}; recebido ao concluir seus setores${MATERIAIS_DE_DESMANCHE.has(id) ? ' e ao desmontar itens compatíveis' : ''}.`
      : origem === 'chefe'
        ? 'Drop pessoal de chefe; cada chefe mantém sempre o mesmo material.'
        : origem === 'provacao'
          ? 'Recompensa exclusiva de faixas de piso da Provação.'
          : origem === 'missao'
            ? 'Recompensa exclusiva de contratos e missões temáticas.'
            : 'Recompensa exclusiva de eventos e suas atividades.';

    const dropEstado: EstadoDeRecurso = origem === 'missao' && !DROP_ATIVO_MISSAO.has(id)
        ? 'planejado'
        : 'ativo';

    return {
      id,
      nome,
      familia: linha.familia,
      raridade: linha.raridade,
      indice,
      escopo: escopoDaFamilia(linha.familia),
      ...(galaxia !== undefined ? { galaxia } : {}),
      origens,
      drop,
      funcao: linha.funcoes[c]!,
      dropEstado,
      usoEstado: USOS_ATIVOS.has(id) ? 'ativo' : 'planejado',
      arte: RECURSOS_COM_ARTE_FINAL.has(id) ? 'final' : 'provisoria',
    } satisfies RecursoDef;
  }),
);

export const RECURSO_POR_ID = new Map(RECURSOS.map((r) => [r.id, r]));
export const iconeDeRecurso = (r: RecursoDef): string => `recurso/${r.id}`;

export const FAMILIA_LABEL: Record<FamiliaDeRecurso, string> = {
  minerio: 'Minérios e metais',
  exotico: 'Ligas e exóticos',
  gas: 'Gases e plasmas',
  organico: 'Orgânicos',
  tecnologia: 'Tecnologia e artefatos',
  essencia: 'Pós e essências',
};

export const ESCOPO_LABEL: Record<EscopoDeRecurso, string> = {
  galaxia: 'Galáxia',
  missao: 'Missão',
  evento: 'Evento',
  chefe: 'Chefe',
  provacao: 'Provação',
};

export const FAMILIAS_ORDENADAS: readonly FamiliaDeRecurso[] = [
  'minerio', 'exotico', 'gas', 'organico', 'tecnologia', 'essencia',
];

/** Material único que dá identidade econômica a uma galáxia planejada. */
export function recursoDaGalaxia(indice: number): RecursoDef | null {
  if (indice < 0) return null;
  // O projeto prevê 30 galáxias. Regiões infinitas posteriores reiniciam o
  // ciclo econômico sem inventar ids que não existam no catálogo/save.
  const normalizado = indice % 30;
  return RECURSOS.find((r) => r.galaxia === normalizado) ?? null;
}

/**
 * Os setores não sorteiam mais entre todo o catálogo: todos os dez setores de
 * uma galáxia entregam seu material-assinatura. Assim o mapa vira uma
 * ferramenta de farm legível. `quantos` fica por compatibilidade.
 */
export function recursosDoPlaneta(setor: number, quantos = 3): RecursoDef[] {
  if (setor < 1 || quantos < 1) return [];
  const recurso = recursoDaGalaxia(galaxyOfSector(setor));
  return recurso ? [recurso].slice(0, quantos) : [];
}

/** Recurso exclusivo e determinístico de um chefe. */
export function recursoDoChefe(bossId: string): RecursoDef | null {
  const pool = RECURSOS.filter((r) => r.escopo === 'chefe');
  if (!pool.length) return null;
  let h = 2166136261;
  for (let i = 0; i < bossId.length; i++) {
    h ^= bossId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return pool[h % pool.length]!;
}

export const recursosDeMissao = (): readonly RecursoDef[] => RECURSOS.filter((r) => r.escopo === 'missao');
export const recursosDeEvento = (): readonly RecursoDef[] => RECURSOS.filter((r) => r.escopo === 'evento');
export const recursosDaProvacao = (): readonly RecursoDef[] => RECURSOS.filter((r) => r.escopo === 'provacao');
