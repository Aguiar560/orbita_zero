import { Rng, hashString } from '@core/math';
import { ELEMENTO_DA_GALAXIA } from './elemento-da-galaxia';
import { ELEMENT_IDS, type ElementId } from '@sim/types';
import { bossForSector } from './bosses';
import { FLEET_INFO } from './fleets';
import { getElement } from './elements';

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
  /** Frase curta que define a fantasia da região. */
  identity: string;
  /** Perigo ambiental dominante, mostrado antes da viagem. */
  hazard: string;
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
  'Caldeira de Asterion', 'Cemitério de Khepri', 'Tear de Nyx', 'Lâmina de Carbono', 'Prisma de Eos',
  'Colmeia de Ícaro', 'Forja de Antares', 'Coroa de Caelum', 'Dobra de Janus', 'Umbra Terminal',
];

/**
 * Identidade autoral das galáxias 21–30, alinhada ao material-assinatura.
 *
 * Não há mais `color` aqui. Ela era escrita à mão e contradizia o elemento em
 * metade das entradas — a Coroa de Caelum era cósmica e dourada, a Dobra de
 * Janus era cósmica e azul. Hoje a cor SAI do elemento, em `corDaGalaxia`.
 */
const PROFUNDAS: readonly { identity: string; hazard: string; element: ElementId }[] = [
  { identity: 'Rios de escória circulam uma estrela desmontada.', hazard: 'Marés térmicas interrompem escudos.', element: 'fogo' },
  { identity: 'Milhões de meteoros formam túmulos em movimento.', hazard: 'Impactos cinéticos cruzam as rotas.', element: 'padrao' },
  { identity: 'Nanofibras antigas costuram destroços em casulos.', hazard: 'Redes móveis reduzem a evasão.', element: 'quimico' },
  { identity: 'Folhas de grafeno cortam a luz como navalhas.', hazard: 'Descargas percorrem superfícies condutoras.', element: 'raio' },
  { identity: 'Prismas quânticos repetem cada nave em futuros rivais.', hazard: 'Ecos dimensionais duplicam projéteis.', element: 'cosmico' },
  { identity: 'Enxames de nanotubos constroem luas artificiais.', hazard: 'Estruturas se regeneram durante o combate.', element: 'quimico' },
  { identity: 'Antares tempera aço dentro de tempestades solares.', hazard: 'Calor crescente pune combates longos.', element: 'fogo' },
  // A 28 era cósmica. Virou de gelo porque nenhuma das dez profundas era, e o
  // gelo sumia da campanha inteira depois da galáxia 19. O texto seguiu o
  // elemento e manteve o vínculo com a Liga Celestial, que é o minério dela.
  { identity: 'A liga celestial só cristaliza no frio absoluto desta coroa.', hazard: 'O casco enrijece e a manobra fica lenta.', element: 'gelo' },
  { identity: 'Todas as rotas se dobram e retornam por outro ângulo.', hazard: 'Saltos reposicionam frotas sem aviso.', element: 'cosmico' },
  { identity: 'A luz termina; apenas a matéria escura registra passagem.', hazard: 'Sensores falham e o dano recebido oscila.', element: 'cosmico' },
];

/** Famílias de fundo disponíveis, alternadas para dar identidade a cada galáxia. */
const BACKDROP_FAMILIES = ['blue_nebula', 'purple_nebula', 'green_nebula', 'starfield'] as const;

/**
 * A cor de destaque de uma galáxia SAI DO ELEMENTO dela.
 *
 * Antes era `COLORS[index % 4]` — quatro cores em rodízio, sem relação nenhuma
 * com o que a galáxia é. O Trono Oco aparecia com moldura ROXA logo acima da
 * linha "Perigo da região: Gelo", que é exatamente o oposto do que a cor
 * deveria dizer. A tela inteira usa este valor: o nome, a moldura do herói, o
 * setor selecionado e a barra de progresso.
 *
 * O tom varia um pouco por galáxia porque cinco galáxias do mesmo elemento
 * pintadas com o mesmo hexadecimal ficariam indistinguíveis. A variação mexe em
 * luminosidade e matiz, nunca no suficiente para trocar de família: um gelo
 * continua lendo como gelo.
 */
const CANAL = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;

function corDaGalaxia(elemento: ElementId, index: number): string {
  const base = getElement(elemento).color;
  const [r, g, b] = [CANAL(base, 0), CANAL(base, 1), CANAL(base, 2)];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  /**
   * O degrau vem da POSIÇÃO da galáxia entre as do mesmo elemento.
   *
   * A primeira tentativa foi `(index * 7) % 5`, e ela colidia: sobravam 23
   * cores distintas em 30 galáxias, porque duas galáxias do mesmo elemento com
   * o mesmo resto caíam no mesmo tom. Contando a posição, cada galáxia de um
   * elemento pega um degrau próprio e a escada fica espalhada por igual.
   */
  const irmas = ELEMENTO_DA_GALAXIA.filter((e) => e === elemento).length;
  const posicao = ELEMENTO_DA_GALAXIA.slice(0, index).filter((e) => e === elemento).length;
  const degrau = irmas <= 1 ? 0 : (posicao / (irmas - 1)) * 4 - 2;
  const l2 = Math.min(0.74, Math.max(0.40, l + degrau * 0.045));
  const h2 = (h + degrau * 0.011 + 1) % 1;

  const c = (1 - Math.abs(2 * l2 - 1)) * sat;
  const x = c * (1 - Math.abs(((h2 * 6) % 2) - 1));
  const m = l2 - c / 2;
  const seg = Math.floor(h2 * 6) % 6;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg]!;
  return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

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
  // As 32 combinações família×variação formam uma sequência sem colisão.
  // Sorteio permitia que duas galáxias profundas recebessem o mesmo arquivo.
  const variant = String(Math.floor(index / BACKDROP_FAMILIES.length) % 8 + 1).padStart(2, '0');
  const fleet = FLEET_INFO[Math.min(FLEET_INFO.length - 1, Math.floor(index / 2))]!;
  const profunda = index >= 20 && index < 30 ? PROFUNDAS[index - 20] : null;

  /**
   * O elemento vem de uma TABELA, e não mais da frota nem de um rodízio.
   *
   * Antes as galáxias 1–6 herdavam o elemento da frota e as seguintes entravam
   * num rodízio por índice. Nenhum dos dois olhava para os INIMIGOS que a
   * galáxia realmente monta: a galáxia 1 se declarava de fogo e tinha zero
   * inimigos de fogo. Ver `elemento-da-galaxia.ts`.
   */
  const elemento = ELEMENTO_DA_GALAXIA[index]
    ?? profunda?.element ?? ELEMENT_IDS[index % ELEMENT_IDS.length]!;

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
    // Cada cenário autoral entra no máximo uma vez. As galáxias 1–6 recebem as
    // superfícies atmosféricas longas e, por isso, os seis primeiros ids desta
    // lista ficam encobertos. As galáxias 7–19 usam os ids seguintes e as onze
    // finais caem no backdrop determinístico, sem reiniciar a lista.
    fundoId: FUNDOS[index] ?? null,
    // 210 retratos disponíveis; o índice determina qual, de forma estável.
    portrait: `retrato/${index % 21}_${rng.int(0, 9)}`,
    fleet: fleet.name,
    identity: profunda?.identity ?? 'Uma fronteira disputada entre frotas, planetas e rotas de coleta.',
    hazard: profunda?.hazard ?? 'A ameaça dominante acompanha o elemento da frota.',
    element: elemento,
    color: corDaGalaxia(elemento, index),
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
