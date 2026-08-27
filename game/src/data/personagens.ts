import { BOSSES } from '@data/bosses';
import { describeGalaxy } from '@data/galaxies';

/**
 * Personagens — a rede de contatos das Missões (§27).
 *
 * A tela de missões gira em torno de QUEM dá a missão, não de uma lista de
 * contratos. Por isso o personagem é entidade de primeira classe, com retrato,
 * facção, galáxia e uma escada de confiança própria.
 *
 * ## Duas origens, um formato
 *
 * Há contatos ESCRITOS À MÃO (o aliado inicial e companhia) e contatos
 * DERIVADOS de chefe derrotado. Os dois saem por `PERSONAGENS` com a mesma
 * forma: quem consome não precisa saber de onde vieram, e a tela não ganha um
 * caminho especial para o ex-chefe.
 *
 * O chefe convertido é o coração da ideia: ele já existe no jogo como inimigo
 * (`data/bosses.ts`) e o códex já registra quem foi derrotado. Converter é ler
 * esse registro — nenhum estado novo, nenhuma duplicação do catálogo de chefes.
 *
 * ## Retratos
 *
 * O atlas `characters` reúne os retratos curados do pack Characters. Ele é
 * carregado sob demanda pela Central de Missões, tal como os retratos do mapa.
 */

export type StatusDeContato = 'aliado' | 'neutro' | 'ex_chefe' | 'bloqueado';

export interface PersonagemDef {
  id: string;
  nome: string;
  /** Linha abaixo do nome no card. */
  faccao: string;
  /** Título longo, mostrado na ficha. */
  titulo: string;
  /** Sprite do retrato. */
  retrato: string;
  /** Índice da galáxia a que pertence, ou `null` para os sem região. */
  galaxia: number | null;
  status: StatusDeContato;
  /** Cor de acento do personagem, usada na borda do card e na ficha. */
  cor: string;
  /**
   * Chefe de origem, quando o contato NASCE de uma vitória.
   *
   * É o que faz o card mostrar "ANTIGO GUARDIÃO" em vez de tratá-lo como um
   * aliado qualquer: o jogador precisa reconhecer quem ele derrotou.
   */
  deChefe?: string;
  /** Só aparece depois que este chefe cair. `undefined` = visível desde o começo. */
  requerChefe?: string;
  /** Texto da silhueta, quando ainda bloqueado. */
  dicaDeDesbloqueio?: string;
}

/** Quantos degraus tem a escada de confiança. */
export const CONFIANCA_MAX = 5;

/** Algarismos romanos dos degraus — a tela mostra I..V, não 1..5. */
export const ROMANOS = ['I', 'II', 'III', 'IV', 'V'] as const;

/**
 * O que cada degrau de confiança abre.
 *
 * Tabela, e não regra no componente: o §12 pede que estes valores venham de
 * configuração. A tela só lê o texto.
 */
export const RECOMPENSA_DE_CONFIANCA: readonly { nivel: number; texto: string }[] = [
  { nivel: 1, texto: 'Novas missões deste contato' },
  { nivel: 2, texto: 'Recursos da região dele' },
  { nivel: 3, texto: 'Nova cadeia de missões' },
  { nivel: 4, texto: 'Contrato especial' },
  { nivel: 5, texto: 'Item exclusivo' },
];

/** Contatos escritos à mão. */
const FIXOS: readonly PersonagemDef[] = [
  {
    id: 'char_kael_voss',
    nome: 'KAEL VOSS',
    faccao: 'ÓRBITA ZERO',
    titulo: 'COORDENADOR DA FROTA DE PARTIDA',
    retrato: 'character/player/man',
    galaxia: 0,
    status: 'aliado',
    cor: '#4FC3FF',
  },
  {
    id: 'char_zyrak',
    nome: 'ZYRAK',
    faccao: 'EXPEDIÇÃO ASTRA',
    titulo: 'BATEDOR DAS ROTAS EXTERNAS',
    retrato: 'character/player/man_2',
    galaxia: 1,
    status: 'aliado',
    cor: '#B45CFF',
    requerChefe: BOSSES[0]?.id,
    dicaDeDesbloqueio: 'DERROTE O PRIMEIRO GUARDIÃO',
  },
  {
    id: 'char_lira_nexus',
    nome: 'LIRA NEXUS',
    faccao: 'COMERCIANTES NEXUS',
    titulo: 'INTERMEDIÁRIA DE CARGA RARA',
    retrato: 'character/player/woman',
    galaxia: 2,
    status: 'neutro',
    cor: '#50E36B',
    requerChefe: BOSSES[1]?.id,
    dicaDeDesbloqueio: 'DERROTE O GUARDIÃO DA GALÁXIA 2',
  },
];

/**
 * Chefes que viram aliados ao cair.
 *
 * Derivado de `BOSSES`, não copiado: o nome, o elemento e o id continuam com
 * uma dona só. Acrescentar um chefe ao jogo acrescenta um contato de graça.
 *
 * Todo chefe encerra uma galáxia. Quando ele cai, vira o contato daquela região
 * e leva consigo o retrato de inimigo que o jogador acabou de enfrentar.
 */
const RETRATOS_DE_INIMIGO = Array.from({ length: 18 }, (_, index) => `character/enemy/enemy_${index + 1}`);

/** Mesmo retrato no mapa da galáxia e no contato que ela libera nas Missões. */
export const retratoInimigoDaGalaxia = (galaxia: number): string =>
  RETRATOS_DE_INIMIGO[galaxia % RETRATOS_DE_INIMIGO.length]!;

const CONVERTIDOS: readonly PersonagemDef[] = BOSSES.map((b, i) => ({
  id: `char_${b.id}`,
  nome: b.name.toUpperCase(),
  faccao: describeGalaxy(i).name.toUpperCase(),
  titulo: `ANTIGO GUARDIÃO DE ${describeGalaxy(i).name.toUpperCase()}`,
  // O pack traz 18 retratos de inimigos. A campanha tem 30 galáxias: depois
  // do primeiro ciclo, a identidade continua estável por galáxia enquanto as
  // próximas artes autorais não chegam.
  retrato: retratoInimigoDaGalaxia(i),
  galaxia: i,
  status: 'ex_chefe' as const,
  cor: describeGalaxy(i).color,
  deChefe: b.id,
  requerChefe: b.id,
  dicaDeDesbloqueio: `DERROTE ${b.name.toUpperCase()}`,
}));

export const PERSONAGENS: readonly PersonagemDef[] = [...FIXOS, ...CONVERTIDOS];

export const PERSONAGEM_POR_ID = new Map(PERSONAGENS.map((p) => [p.id, p]));

/** O contato que nasce deste chefe, se houver. */
export const contatoDoChefe = (bossId: string): PersonagemDef | undefined =>
  PERSONAGENS.find((p) => p.deChefe === bossId);

export const STATUS_LABEL: Record<StatusDeContato, string> = {
  aliado: 'ALIADO',
  neutro: 'NEUTRO',
  // O rótulo é ALIADO porque é o que ele é AGORA; que já foi chefe aparece no
  // título e no selo próprio. Mostrar "EX-CHEFE" aqui responderia a pergunta
  // errada — o jogador quer saber de que lado ele está hoje.
  ex_chefe: 'ALIADO',
  bloqueado: 'DESCONHECIDO',
};
