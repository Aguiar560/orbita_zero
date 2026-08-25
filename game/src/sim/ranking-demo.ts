import { Rng } from '@core/math';
import { PILOTOS } from '@data/pilotos';
import { temporadaEm } from '@data/temporadas';
import type { GameState } from './types';
import { marcaDoJogador, type PlacarId } from './ranking';

/**
 * Jogadores FICTÍCIOS para avaliar o layout do placar.
 *
 * ## Isto é andaime, não conteúdo
 *
 * O placar mundial precisa de um back-end que ainda não existe. Enquanto ele não
 * chega, uma lista vazia não deixa julgar espaçamento, truncamento de nome,
 * alinhamento de número nem o destaque da própria linha — coisas que só
 * aparecem com a lista cheia.
 *
 * O risco de dado falso num placar é o jogador se comparar com gente que não
 * existe e decidir o que jogar com base nisso. Por isso três travas:
 *
 * 1. `DEMO_ATIVA` desliga tudo numa linha. É o interruptor a virar no dia em que
 *    o servidor entrar — e antes de qualquer build pública.
 * 2. A tela **diz**, num selo que não dá para não ver, que a lista é fictícia.
 * 3. Os nomes são inventados no registro de indicativo de voo, sem parecer conta
 *    de pessoa real.
 *
 * ## Por que é determinístico
 *
 * A semente sai do placar, do casco filtrado e do NÚMERO DA TEMPORADA. O painel
 * é reconstruído a ~5 Hz; com números aleatórios a cada quadro a lista tremeria
 * e não daria para avaliar nada. Amarrar à temporada é de graça e faz a lista
 * mudar quando a temporada vira, que é o comportamento que o placar de verdade
 * vai ter.
 */

/** Vire para `false` antes de qualquer build pública, e ao ligar o servidor. */
export const DEMO_ATIVA = true;

/** Quantas linhas do topo a lista mostra. */
export const DEMO_TOPO = 12;

const PRIMEIROS = [
  'Corvo', 'Vespa', 'Lynx', 'Órion', 'Nyx', 'Kestrel', 'Vulcano', 'Zênite',
  'Halcyon', 'Draco', 'Sirius', 'Perseu', 'Mira', 'Tycho', 'Rígel', 'Vega',
  'Antares', 'Cygnus', 'Deneb', 'Altair', 'Fênix', 'Lupus', 'Ares', 'Íkaro',
];
const SEGUNDOS = [
  'Sete', 'Nove', 'Zero', 'Prime', 'Alfa', 'Ômega', 'Delta', 'Sigma',
  'Kappa', 'Rho', 'Tau', 'Íris', 'Eco', 'Vetor', 'Quasar', 'Pulsar',
];

export interface LinhaDePlacar {
  posicao: number;
  nome: string;
  /** Cor de acento, emprestada da paleta dos personagens. */
  cor: string;
  valor: number;
  /** Esta linha é a do jogador. */
  euMesmo: boolean;
  /** Detalhe da direita — a nave, no placar de naves. */
  detalhe?: string;
}

/**
 * Teto plausível de cada placar, para os números de exemplo não saírem do que
 * o jogo comporta. Um "andar 4.100" na Provação, que tem 100, denunciaria o
 * andaime mais rápido que qualquer selo.
 */
const TETO: Record<PlacarId, number> = {
  provacao: 100,
  galaxia: 300,
  personagem: 300,
  naves: 60,
  missoes: 140,
};

/**
 * Nome inédito na lista.
 *
 * Sortear e aceitar deixava repetido — medido, "Lupus Sigma" saiu em 1º e em
 * 10º na primeira lista gerada. Num placar isso não lê como coincidência, lê
 * como bug: parece a mesma conta contada duas vezes.
 *
 * As 24 × 16 combinações dão folga de sobra para doze linhas, mas o laço tem
 * teto mesmo assim — sorteio sem limite é a forma mais fácil de travar uma
 * tela, e nenhum nome vale um congelamento.
 */
function nomeDe(rng: Rng, usados: Set<string>): string {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const nome = `${rng.pick(PRIMEIROS)} ${rng.pick(SEGUNDOS)}`;
    if (!usados.has(nome)) { usados.add(nome); return nome; }
  }
  return `${rng.pick(PRIMEIROS)} ${rng.int(10, 99)}`;
}

/**
 * O topo da tabela mais a linha do jogador, na posição real dele.
 *
 * Mostrar só o topo esconderia justamente o que interessa avaliar: como a
 * própria linha se destaca quando ela não está entre os primeiros. É assim que
 * um placar de verdade se comporta, e é o layout que precisa ser julgado.
 */
export function placarDeDemonstracao(
  state: GameState,
  placar: PlacarId,
  casco: string | undefined,
  agora: number,
): { topo: LinhaDePlacar[]; eu: LinhaDePlacar; total: number } {
  const temporada = temporadaEm(agora).numero;
  const semente = hash(`${placar}|${casco ?? ''}|${temporada}`);
  const rng = new Rng(semente);

  const teto = TETO[placar];
  const minha = marcaDoJogador(state, placar, casco);

  // Os valores caem de forma acelerada a partir do topo: num placar mundial os
  // primeiros lugares ficam colados e a diferença abre depressa depois deles.
  const linhas: { nome: string; cor: string; valor: number }[] = [];
  const usados = new Set<string>();
  let valor = teto;
  for (let i = 0; i < DEMO_TOPO; i++) {
    linhas.push({
      nome: nomeDe(rng, usados),
      cor: PILOTOS[rng.int(0, PILOTOS.length - 1)]?.cor ?? '#4FC3FF',
      valor: Math.max(1, Math.round(valor)),
    });
    valor -= rng.range(teto * 0.008, teto * 0.035);
  }

  const topo: LinhaDePlacar[] = linhas.map((l, i) => ({
    posicao: i + 1,
    nome: l.nome,
    cor: l.cor,
    valor: l.valor,
    euMesmo: false,
  }));

  // A posição do jogador sai da distância entre a marca dele e o teto — é uma
  // conta de fachada, mas monótona: marca maior sempre dá posição melhor, que é
  // o que a tela precisa demonstrar sem mentir sobre a direção.
  const fracao = Math.min(1, Math.max(0, minha.valor / Math.max(1, teto)));
  const total = 800 + (semente % 2200);
  const posicao = minha.valor <= 0
    ? total
    : Math.max(DEMO_TOPO + 1, Math.round(total - fracao * (total - DEMO_TOPO - 1)));

  const eu: LinhaDePlacar = {
    posicao,
    nome: 'VOCÊ',
    cor: '#8ee6ff',
    valor: minha.valor,
    euMesmo: true,
    detalhe: minha.detalhe,
  };

  return { topo, eu, total };
}

/** Hash estável de uma string para semente de RNG (FNV-1a de 32 bits). */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
