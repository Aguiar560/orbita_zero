import type { ElementId } from '@sim/types';
import { getElement } from './elements';
import type { AttackPattern } from './enemies';

export interface BossPhase {
  /** Fração de vida em que a fase começa (1 = início). */
  at: number;
  attack: AttackPattern;
  /** Salvas por segundo. */
  fireRate: number;
  shots: number;
  bulletSpeed: number;
  /** Velocidade de estrafe horizontal. */
  strafe: number;
  /** Invoca lacaios deste tipo, se definido. */
  summon?: { enemy: string; every: number; count: number };
  /** Aviso mostrado na entrada da fase. */
  telegraph?: string;
}

export interface BossDef {
  id: string;
  name: string;
  /** Tipo de dano que causa e contra o qual resiste. */
  element: ElementId;
  title: string;
  sprite: string;
  scale: number;
  radius: number;
  /** Multiplicador de vida sobre a curva do setor. */
  hp: number;
  dano: number;
  reward: number;
  bulletSprite: string;
  blast: string;
  phases: readonly BossPhase[];
  /** Baús garantidos na primeira derrota. */
  firstKill: { tier: string; count: number }[];
}

const BOSSES_BASE: readonly BossDef[] = [
  {
    id: 'nucleo_ferrugem', element: 'fogo',
    name: 'Núcleo Ferrugem',
    title: 'Reator abandonado que nunca parou de bombear',
    sprite: 'chefe/nucleo_ferrugem',
    scale: 1.35, radius: 58, hp: 1.00, dano: 1.6, reward: 30,
    bulletSprite: 'shot/pyro_light',blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'direto', fireRate: 1.2, shots: 3, bulletSpeed: 210, strafe: 40 },
      { at: 0.6, attack: 'leque', fireRate: 1.0, shots: 7, bulletSpeed: 230, strafe: 70, telegraph: 'Sobrecarga do núcleo' },
      { at: 0.25, attack: 'espiral', fireRate: 2.4, shots: 5, bulletSpeed: 250, strafe: 95, summon: { enemy: 'enxame', every: 4, count: 3 }, telegraph: 'Fusão descontrolada' },
    ],
    firstKill: [{ tier: 'prata', count: 1 }],
  },
  {
    id: 'anel_kessler', element: 'cosmico',
    name: 'Anel de Kessler',
    title: 'Estação em cascata de colisões há mil anos',
    sprite: 'chefe/anel_kessler',
    scale: 1.4, radius: 62, hp: 1.03, dano: 1.5, reward: 36,
    bulletSprite: 'shot/void_light',blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'espiral', fireRate: 1.6, shots: 4, bulletSpeed: 190, strafe: 55 },
      { at: 0.55, attack: 'espiral', fireRate: 2.6, shots: 6, bulletSpeed: 205, strafe: 85, summon: { enemy: 'asteroide', every: 3.5, count: 2 }, telegraph: 'Cascata de destroços' },
      { at: 0.2, attack: 'leque', fireRate: 1.4, shots: 11, bulletSpeed: 235, strafe: 110, telegraph: 'Colapso orbital' },
    ],
    firstKill: [{ tier: 'prata', count: 2 }],
  },
  {
    id: 'tita_rochoso', element: 'padrao',
    name: 'Titã Rochoso',
    title: 'Um asteroide que acordou com fome',
    sprite: 'chefe/tita_rochoso',
    scale: 1.5, radius: 66, hp: 1.09, dano: 1.9, reward: 44,
    bulletSprite: 'shot/pyro_heavy',blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 0.9, shots: 2, bulletSpeed: 240, strafe: 35 },
      { at: 0.65, attack: 'leque', fireRate: 0.8, shots: 9, bulletSpeed: 215, strafe: 60, summon: { enemy: 'asteroide', every: 3, count: 3 }, telegraph: 'Chuva de fragmentos' },
      { at: 0.3, attack: 'espiral', fireRate: 3.0, shots: 4, bulletSpeed: 260, strafe: 90, telegraph: 'Fúria mineral' },
    ],
    firstKill: [{ tier: 'ouro', count: 1 }],
  },
  {
    id: 'sentinela_vazia', element: 'raio',
    name: 'Sentinela Vazia',
    title: 'Guardiã sem tripulação, sem ordens e sem trégua',
    sprite: 'chefe/sentinela_vazia',
    scale: 1.6, radius: 56, hp: 1.15, dano: 2.0, reward: 54,
    bulletSprite: 'shot/void_heavy',blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 1.6, shots: 3, bulletSpeed: 265, strafe: 90 },
      { at: 0.6, attack: 'teleguiado', fireRate: 0.9, shots: 3, bulletSpeed: 190, strafe: 120, telegraph: 'Travamento de alvo' },
      { at: 0.25, attack: 'espiral', fireRate: 3.4, shots: 7, bulletSpeed: 245, strafe: 150, summon: { enemy: 'ferrao', every: 5, count: 2 }, telegraph: 'Protocolo terminal' },
    ],
    firstKill: [{ tier: 'ouro', count: 1 }],
  },
  {
    id: 'colmeia_verdante', element: 'quimico',
    name: 'Colmeia Verdante',
    title: 'Não é uma nave. É um ninho.',
    sprite: 'chefe/colmeia_verdante',
    scale: 1.7, radius: 60, hp: 1.22, dano: 1.8, reward: 66,
    bulletSprite: 'shot/bio_orb',blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'leque', fireRate: 1.0, shots: 6, bulletSpeed: 195, strafe: 70, summon: { enemy: 'enxame', every: 3, count: 4 } },
      { at: 0.6, attack: 'teleguiado', fireRate: 1.2, shots: 4, bulletSpeed: 175, strafe: 100, summon: { enemy: 'enxame', every: 2.2, count: 5 }, telegraph: 'Eclosão' },
      { at: 0.25, attack: 'espiral', fireRate: 3.2, shots: 9, bulletSpeed: 215, strafe: 130, telegraph: 'Frenesi da colmeia' },
    ],
    firstKill: [{ tier: 'ouro', count: 2 }],
  },
  {
    id: 'destroco_vivo', element: 'gelo',
    name: 'Destroço Vivo',
    title: 'Uma frota inteira fundida num só casco',
    sprite: 'chefe/destroco_vivo',
    scale: 1.3, radius: 78, hp: 1.30, dano: 2.2, reward: 80,
    bulletSprite: 'shot/void_light',blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'direto', fireRate: 2.2, shots: 5, bulletSpeed: 225, strafe: 130 },
      { at: 0.55, attack: 'leque', fireRate: 1.3, shots: 13, bulletSpeed: 200, strafe: 160, telegraph: 'Descarga em cortina' },
      { at: 0.2, attack: 'espiral', fireRate: 4.0, shots: 6, bulletSpeed: 250, strafe: 190, summon: { enemy: 'mina', every: 3, count: 3 }, telegraph: 'Desmonte total' },
    ],
    firstKill: [{ tier: 'ouro', count: 2 }, { tier: 'singularidade', count: 1 }],
  },
  {
    id: 'mina_prima', element: 'fogo',
    name: 'Mina Prima',
    title: 'A primeira que colocaram aqui. Ainda armada.',
    sprite: 'chefe/mina_prima',
    scale: 1.8, radius: 62, hp: 1.40, dano: 2.6, reward: 96,
    bulletSprite: 'shot/pyro_light',blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'espiral', fireRate: 2.6, shots: 8, bulletSpeed: 185, strafe: 45 },
      { at: 0.6, attack: 'espiral', fireRate: 3.4, shots: 12, bulletSpeed: 205, strafe: 70, summon: { enemy: 'mina', every: 3, count: 2 }, telegraph: 'Campo minado' },
      { at: 0.25, attack: 'leque', fireRate: 2.0, shots: 17, bulletSpeed: 240, strafe: 100, telegraph: 'Detonação iminente' },
    ],
    firstKill: [{ tier: 'singularidade', count: 1 }],
  },
  {
    id: 'obelisco', element: 'cosmico',
    name: 'Obelisco Partido',
    title: 'Um marco de fronteira de uma civilização que já era',
    sprite: 'chefe/obelisco',
    scale: 1.5, radius: 58, hp: 1.53, dano: 2.4, reward: 118,
    bulletSprite: 'beam/void',blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 2.4, shots: 3, bulletSpeed: 300, strafe: 100 },
      { at: 0.6, attack: 'espiral', fireRate: 3.0, shots: 10, bulletSpeed: 220, strafe: 140, telegraph: 'Ressonância' },
      { at: 0.25, attack: 'teleguiado', fireRate: 2.2, shots: 6, bulletSpeed: 210, strafe: 170, summon: { enemy: 'espectro', every: 6, count: 1 }, telegraph: 'Eco final' },
    ],
    firstKill: [{ tier: 'singularidade', count: 1 }],
  },
  {
    id: 'devorador', element: 'quimico',
    name: 'Cometa Devorador',
    title: 'Puxa tudo para dentro e nunca devolve',
    sprite: 'chefe/devorador',
    scale: 1.6, radius: 70, hp: 1.70, dano: 3.0, reward: 145,
    bulletSprite: 'shot/ion_light',blast: 'blast/void',
    phases: [
      { at: 1.0, attack: 'leque', fireRate: 1.6, shots: 9, bulletSpeed: 260, strafe: 175 },
      { at: 0.6, attack: 'espiral', fireRate: 4.2, shots: 8, bulletSpeed: 235, strafe: 210, telegraph: 'Maré gravitacional' },
      { at: 0.22, attack: 'espiral', fireRate: 5.5, shots: 13, bulletSpeed: 255, strafe: 240, summon: { enemy: 'cometa', every: 2.5, count: 2 }, telegraph: 'Horizonte de eventos' },
    ],
    firstKill: [{ tier: 'singularidade', count: 2 }],
  },
  {
    id: 'arquiteto', element: 'gelo',
    name: 'O Arquiteto',
    title: 'Desenhou este universo. Não gosta de visitas.',
    sprite: 'chefe/arquiteto',
    scale: 1.9, radius: 64, hp: 2.00, dano: 3.4, reward: 200,
    bulletSprite: 'beam/chain',blast: 'blast/fire',
    phases: [
      { at: 1.0, attack: 'mirado', fireRate: 3.0, shots: 4, bulletSpeed: 320, strafe: 190 },
      { at: 0.7, attack: 'leque', fireRate: 2.0, shots: 15, bulletSpeed: 250, strafe: 220, summon: { enemy: 'serafim', every: 7, count: 1 }, telegraph: 'Reescrita parcial' },
      { at: 0.4, attack: 'espiral', fireRate: 5.0, shots: 11, bulletSpeed: 240, strafe: 250, telegraph: 'Geometria hostil' },
      { at: 0.15, attack: 'teleguiado', fireRate: 3.2, shots: 8, bulletSpeed: 230, strafe: 280, summon: { enemy: 'espectro', every: 5, count: 2 }, telegraph: 'Colapso autoral' },
    ],
    firstKill: [{ tier: 'singularidade', count: 3 }],
  },
];

interface BossExpansionSpec {
  id: string;
  name: string;
  title: string;
  element: ElementId;
  sprite: string;
  summon: string;
}

/**
 * Chefes das galáxias 11–30.
 *
 * O id descreve a identidade do encontro, nunca o arquivo de arte. Os números
 * derivam da posição na campanha; a tabela curta abaixo guarda somente o que
 * precisa de autoria — nome, fantasia, elemento, nave e lacaio temático.
 */
const BOSS_EXPANSION: readonly BossExpansionSpec[] = [
  { id: 'marechal_nival', name: 'Marechal Nival', title: 'A forja congelou; o comandante continuou marchando', element: 'gelo', sprite: 'chefe/marechal_nival', summon: 'corsario_gelo' },
  { id: 'catedral_corrosao', name: 'Catedral da Corrosão', title: 'Cada torre é um reator que reza em ácido', element: 'quimico', sprite: 'chefe/catedral_corrosao', summon: 'tecelao' },
  { id: 'leviata_tetis', name: 'Leviatã de Tétis', title: 'A lua oceânica construiu sua própria marinha', element: 'gelo', sprite: 'chefe/leviata_tetis', summon: 'enxame' },
  { id: 'sereia_ions', name: 'Sereia de Íons', title: 'Seu chamado atravessa casco, rádio e memória', element: 'raio', sprite: 'chefe/sereia_ions', summon: 'corsario_raio' },
  { id: 'vertebrador', name: 'O Vertebrador', title: 'Coleciona quilhas para alongar a espinha do Vazio', element: 'cosmico', sprite: 'chefe/vertebrador', summon: 'espectro' },
  { id: 'heliarca_nove', name: 'Heliarca Nove', title: 'O último sol artificial exige obediência absoluta', element: 'fogo', sprite: 'chefe/heliarca_nove', summon: 'ferrao' },
  { id: 'lazaro_refeito', name: 'Lázaro Refeito', title: 'Cada derrota deixa uma peça melhor no lugar', element: 'quimico', sprite: 'chefe/lazaro_refeito', summon: 'serafim' },
  { id: 'regente_sem_rosto', name: 'Regente Sem Rosto', title: 'O trono pilota a nave; o ocupante é decorativo', element: 'cosmico', sprite: 'chefe/regente_sem_rosto', summon: 'lanceiro' },
  { id: 'almirante_argenteo', name: 'Almirante Argênteo', title: 'Uma frota líquida obedecendo a uma única vontade', element: 'padrao', sprite: 'chefe/almirante_argenteo', summon: 'baluarte' },
  { id: 'terminal_zero', name: 'Terminal Zero', title: 'Toda rota termina em sua bateria de execução', element: 'raio', sprite: 'chefe/terminal_zero', summon: 'sentinela' },
  { id: 'fundidor_asterion', name: 'Fundidor Asterion', title: 'Transforma estrelas menores em munição de cerco', element: 'fogo', sprite: 'chefe/fundidor_asterion', summon: 'corsario_fogo' },
  { id: 'escaravelho_khepri', name: 'Escaravelho Khepri', title: 'Empurra um cemitério inteiro rumo ao próximo amanhecer', element: 'padrao', sprite: 'chefe/escaravelho_khepri', summon: 'asteroide' },
  { id: 'tecela_nyx', name: 'Tecelã de Nyx', title: 'Costura destroços até que aprendam a caçar', element: 'quimico', sprite: 'chefe/tecela_nyx', summon: 'tecelao' },
  { id: 'gume_negro', name: 'Gume Negro', title: 'Uma lâmina de carbono com motores e rancor', element: 'raio', sprite: 'chefe/gume_negro', summon: 'corsario_lamina' },
  { id: 'refracao_eos', name: 'Refração de Eos', title: 'Cada futuro possível dispara ao mesmo tempo', element: 'cosmico', sprite: 'chefe/refracao_eos', summon: 'espectro' },
  { id: 'icaro_coletivo', name: 'Ícaro Coletivo', title: 'Mil operários, uma mente e nenhuma rota de fuga', element: 'quimico', sprite: 'chefe/icaro_coletivo', summon: 'enxame' },
  { id: 'martelo_antares', name: 'Martelo de Antares', title: 'Temperado dentro de uma tempestade solar viva', element: 'fogo', sprite: 'chefe/martelo_antares', summon: 'ferrao' },
  { id: 'soberano_caelum', name: 'Soberano Caelum', title: 'Sua coroa altera a massa de tudo que alcança', element: 'gelo', sprite: 'chefe/soberano_caelum', summon: 'corsario_gelo' },
  { id: 'janus_bifronte', name: 'Janus Bifronte', title: 'Ataca da direção que ainda não existe', element: 'cosmico', sprite: 'chefe/janus_bifronte', summon: 'lanceiro' },
  { id: 'umbra_terminal', name: 'Umbra Terminal', title: 'Depois dela, até a luz deixa de registrar progresso', element: 'cosmico', sprite: 'chefe/umbra_terminal', summon: 'espectro' },
];

const EXPANSION_ATTACKS: readonly AttackPattern[] = ['mirado', 'leque', 'espiral', 'teleguiado'];

const NOVOS_CHEFES: readonly BossDef[] = BOSS_EXPANSION.map((spec, index) => {
  const element = getElement(spec.element);
  const rank = index + BOSSES_BASE.length;
  const attackA = EXPANSION_ATTACKS[index % EXPANSION_ATTACKS.length]!;
  const attackB = EXPANSION_ATTACKS[(index + 1) % EXPANSION_ATTACKS.length]!;
  const attackC = EXPANSION_ATTACKS[(index + 2) % EXPANSION_ATTACKS.length]!;
  return {
    ...spec,
    scale: 0.64 + (index % 3) * 0.03,
    radius: 54 + (index % 5) * 3,
    hp: 2.12 + index * 0.13,
    dano: 3.5 + index * 0.15,
    reward: 230 + index * 28,
    bulletSprite: element.bullet[0],
    blast: element.blast,
    phases: [
      { at: 1, attack: attackA, fireRate: 2.2 + index * 0.035, shots: 3 + index % 4, bulletSpeed: 250 + index * 3, strafe: 100 + index * 4 },
      { at: 0.62, attack: attackB, fireRate: 2.7 + index * 0.04, shots: 6 + index % 6, bulletSpeed: 265 + index * 3, strafe: 130 + index * 4, summon: { enemy: spec.summon, every: Math.max(3.2, 6 - index * 0.08), count: 1 + index % 3 }, telegraph: `Protocolo ${rank + 1}: ruptura` },
      { at: 0.24, attack: attackC, fireRate: 3.5 + index * 0.045, shots: 9 + index % 7, bulletSpeed: 280 + index * 3, strafe: 165 + index * 4, telegraph: `Protocolo ${rank + 1}: aniquilação` },
    ],
    firstKill: index < 5
      ? [{ tier: 'ouro', count: 2 }]
      : index < 15
        ? [{ tier: 'singularidade', count: 1 }]
        : [{ tier: 'singularidade', count: 2 }],
  };
});

/** Trinta chefes: exatamente um para cada galáxia escrita da campanha. */
/**
 * Tres chefes ganharam chave de sprite PROPRIA em 2026-08-27.
 *
 * Eles dividiam sprite com inimigos comuns — `sentinela_vazia` com `baluarte`,
 * `colmeia_verdante` com `serafim`, `mina_prima` com `sentinela`. Enquanto a
 * arte vinha de um pack compartilhado isso passava como reaproveitamento; ao
 * instalar arte AUTORAL por id, virou defeito: as duas artes disputavam a mesma
 * chave e o chefe acabava com a silhueta de um inimigo de onda.
 *
 * Chave propria custa uma entrada a mais no atlas e resolve — um chefe que
 * parece inimigo comum e o oposto do que um chefe precisa comunicar.
 */
export const BOSSES: readonly BossDef[] = [...BOSSES_BASE, ...NOVOS_CHEFES];

export const BOSS_BY_ID = new Map(BOSSES.map((b) => [b.id, b]));

/** Chefes aparecem a cada 10 setores e ciclam a lista, ficando mais fortes. */
export const BOSS_INTERVAL = 10;

export function bossForSector(sector: number): BossDef {
  const idx = Math.max(0, Math.floor(sector / BOSS_INTERVAL) - 1);
  return BOSSES[idx % BOSSES.length]!;
}

export const isBossSector = (sector: number): boolean => sector > 0 && sector % BOSS_INTERVAL === 0;
