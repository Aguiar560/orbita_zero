import { Rng, hashString } from '@core/math';
import { ELEMENT_IDS, type ElementId } from '@sim/types';
import { bossForSector } from './bosses';
import { FLEET_INFO } from './fleets';

/** Fases por galáxia. A décima é sempre o chefe. */
export const PHASES_PER_GALAXY = 10;

export interface GalaxyInfo {
  /** 0-based. */
  index: number;
  name: string;
  /** Fundo 512×512 do pack "Large 1024x1024". */
  backdrop: string;
  /**
   * Id do cenário novo em `manifest.fundos`, quando existe.
   *
   * Fica ao lado de `backdrop` em vez de substituí-lo: são 19 conjuntos para
   * 30 galáxias e mais as profundas, então o backdrop antigo continua sendo o
   * caminho de quem não recebeu cenário novo. Trocar tudo de uma vez deixaria
   * as galáxias profundas sem fundo.
   */
  fundoId: string | null;
  /** Retrato do comandante que domina a galáxia. */
  portrait: string;
  /** Frota dominante, para o texto de ambientação. */
  fleet: string;
  /** Elemento predominante da região — o aviso de qual resistência vestir. */
  element: ElementId;
  color: string;
  /** Sprite da galáxia no mapa estelar. */
  sprite: string;
  /** Chaves dos dois campos de estrela desta galáxia. */
  starfields: [string, string];
  /** Tinta aplicada às estrelas, para reforçar a identidade do lugar. */
  starTint: string;
  /** Setor global da primeira e da última fase. */
  firstSector: number;
  lastSector: number;
}

const NAMES = [
  'Berço de Vega', 'Corte de Ferro', 'Mar de Cinzas', 'Pálio Verde', 'Fenda de Rhodes',
  'Coroa Quebrada', 'Longa Noite', 'Alto Silêncio', 'Véu de Âmbar', 'Última Página',
  'Forja Fria', 'Jardim de Óxido', 'Anel de Tétis', 'Garganta Azul', 'Espinha do Vazio',
  'Nona Aurora', 'Campo de Lázaro', 'Trono Oco', 'Maré de Prata', 'Fim da Linha',
];

/** Famílias de fundo disponíveis, alternadas para dar identidade a cada galáxia. */
const BACKDROP_FAMILIES = ['blue_nebula', 'purple_nebula', 'green_nebula', 'starfield'] as const;

const COLORS = ['#4db8ff', '#c060ff', '#5ce08a', '#ffb638'];

/**
 * Uma galáxia é uma janela de dez setores sobre a progressão que já existe.
 *
 * Nada é salvo por galáxia: tudo deriva do índice, então o mapa é só uma forma
 * de LER `run.sector` — e continua funcionando indefinidamente, mesmo depois
 * que os nomes escritos à mão acabam.
 */
/** Campos de estrela gerados pelo pipeline, na ordem em que ele os cria. */
const STARFIELDS = [
  'grandes', 'miudas', 'shmup1', 'shmup2', 'grandes_giro', 'miudas_espelho', 'azuis',
] as const;

/** Tintas de estrela, uma por identidade de galáxia. */
const STAR_TINTS = ['#ffffff', '#bcd6ff', '#ffe2bc', '#d6c0ff', '#bfffe4', '#ffc9d8'];

/**
 * Os 19 cenários da pasta `backgrounds`, na ordem em que o pipeline os emite.
 *
 * Lista à mão e não leitura do manifesto porque `data/` é tabela pura e não
 * conhece `render/` — a regra de camada do projeto. Um teste confere que os
 * ids daqui existem no manifesto gerado, que é o que impede a lista de
 * envelhecer em silêncio.
 */
const FUNDOS: readonly string[] = [
  '01_crimson', '02_abyss', '03_emerald', '04_violet', '05_amber', '06_cyan',
  '07_crimson', '08_abyss', '09_emerald', '10_violet', '11_amber', '12_cyan',
  '13_aqua', '14_blue', '15_red', '16_stellar', '17_toxic', '18_vapor', '19_void',
];

export function describeGalaxy(index: number): GalaxyInfo {
  const rng = new Rng(hashString(`galaxia:${index}`));
  const family = BACKDROP_FAMILIES[index % BACKDROP_FAMILIES.length]!;
  const variant = String(rng.int(1, 8)).padStart(2, '0');
  const fleet = FLEET_INFO[Math.min(FLEET_INFO.length - 1, Math.floor(index / 2))]!;

  // Duas texturas distintas por galáxia: uma de fundo, outra por cima.
  const pool = [...STARFIELDS];
  rng.shuffle(pool);

  // Nove espirais disponíveis na folha de ícones: cinco na primeira fileira,
  // quatro na segunda.
  const spiral = index % 9;
  const sprite = spiral < 5 ? `galaxia/a_${spiral}` : `galaxia/b_${spiral - 5}`;

  return {
    sprite,
    starfields: [pool[0]!, pool[1]!],
    starTint: STAR_TINTS[rng.int(0, STAR_TINTS.length - 1)]!,
    index,
    name: index < NAMES.length ? NAMES[index]! : `Setor Profundo ${index + 1}`,
    backdrop: `galaxia/${family}_${variant}.png`,
    fundoId: FUNDOS[index % FUNDOS.length] ?? null,
    // 210 retratos disponíveis; o índice determina qual, de forma estável.
    portrait: `retrato/${index % 21}_${rng.int(0, 9)}`,
    fleet: fleet.name,
    // Enquanto as frotas escritas à mão cobrem a região, o elemento é o delas —
    // a cor da nave e a cor do tiro têm que combinar. Passado esse trecho, os
    // seis elementos entram em rodízio para nenhuma metade do bestiário ficar
    // fora de circulação nos setores profundos.
    element: index < FLEET_INFO.length * 2 ? fleet.element : ELEMENT_IDS[index % ELEMENT_IDS.length]!,
    color: COLORS[index % COLORS.length]!,
    firstSector: index * PHASES_PER_GALAXY + 1,
    lastSector: (index + 1) * PHASES_PER_GALAXY,
  };
}

export interface PhaseInfo {
  /** 1..10 dentro da galáxia. */
  phase: number;
  sector: number;
  isBoss: boolean;
  /** Nome do chefe, quando `isBoss`. */
  bossName?: string;
  /** Id completo do corpo celeste no atlas `orbe` — mapa e céu usam o mesmo. */
  icon: string;
}

/**
 * Os catorze planetas da folha `planetas.png`, no atlas `orbe`.
 *
 * Substituíram os dez do PlanetPack, que eram ícones de 32px ampliados para 128
 * — no fundo da camada vertical ficavam borrados e todos com a mesma silhueta.
 * Estes vêm em ~200px, com halo próprio e biomas distinguíveis a olho.
 */
export const PLANET_KEYS = [
  'terrano', 'vulcano', 'gasoso', 'glacial', 'desertico', 'florestal', 'tecnologico',
  'infernal', 'oceanico', 'corrompido', 'cristalino', 'densa', 'vortex', 'luminoso',
] as const;

/**
 * Corpos que só um chefe merece.
 *
 * O planeta da fase é o mesmo sprite no mapa e no céu do combate, então a fase
 * de chefe precisa ser reconhecível de longe no mapa — um buraco negro faz isso
 * melhor que o décimo planeta redondo da fileira.
 */
const BOSS_ICONS = ['buraco/azul', 'buraco/laranja', 'buraco/roxo'] as const;

export function galaxyPhases(index: number): PhaseInfo[] {
  const rng = new Rng(hashString(`fases:${index}`));
  const out: PhaseInfo[] = [];

  // Sorteio SEM reposição: com catorze planetas para nove fases dá para garantir
  // que nenhuma galáxia repita um mundo. Antes o sorteio era independente por
  // fase e era comum ver o mesmo planeta três vezes na mesma fileira.
  const pool = [...PLANET_KEYS];
  rng.shuffle(pool);

  for (let phase = 1; phase <= PHASES_PER_GALAXY; phase++) {
    const sector = index * PHASES_PER_GALAXY + phase;
    const isBoss = phase === PHASES_PER_GALAXY;
    out.push({
      phase,
      sector,
      isBoss,
      ...(isBoss ? { bossName: bossForSector(sector).name } : {}),
      icon: isBoss
        ? BOSS_ICONS[index % BOSS_ICONS.length]!
        : `planeta/${pool[(phase - 1) % pool.length]!}`,
    });
  }
  return out;
}

/** Índice da galáxia que contém um setor. */
export const galaxyOfSector = (sector: number): number => Math.floor((sector - 1) / PHASES_PER_GALAXY);

/** Fase (1..10) de um setor dentro da sua galáxia. */
export const phaseOfSector = (sector: number): number => ((sector - 1) % PHASES_PER_GALAXY) + 1;
