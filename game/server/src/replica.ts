import { TAXA_DE_ENTRADA, WAVES_PER_SECTOR } from '@data/balance/curvas';
import { unidadesMinimasDaOnda, xpDaOnda } from '@sim/progression';

/**
 * O teto de ganho por RÉPLICA: o servidor não estima, ele executa o jogo.
 *
 * ## Por que uma terceira tentativa
 *
 * As duas do `PLANO` (Fase 5, passo 4) falharam pela mesma razão, e ela não é
 * de implementação: as duas **estimavam** quanto o jogador deveria ganhar. A
 * estimativa é instável porque o ganho é dominado por passar ou não do chefe —
 * medido, a folga da fórmula variava de 0,3× a 9,9× em quinze setores, e no
 * setor 1 o teto ficava TRÊS VEZES abaixo do ganho honesto.
 *
 * Aqui não há número para calibrar. O servidor pergunta ao próprio jogo quanto
 * a onda paga (`xpDaOnda`, a mesma conta de `completeEncounter`) e quanto tempo
 * ela leva no MÍNIMO para entrar em campo.
 *
 * ## O piso de tempo, e por que ele é estável
 *
 * `TAXA_DE_ENTRADA` (3,43 inimigos/s) sai de `LEVA_MIN/MAX` e
 * `LEVA_INTERVALO_MIN/MAX` — as MESMAS constantes que o `WaveDirector` da cena
 * usa para agendar as levas. Não é constante do modelo abstrato: é do
 * agendamento real. Não se mata quem ainda não entrou.
 *
 * **Medido em 09/09**, a folga contra o jogador honesto mais rápido
 * CONCEBÍVEL — o que limpa cada onda exatamente no piso, coisa que ninguém
 * consegue:
 *
 * | setor | honesto (150 s) | teto | folga |
 * |---|---|---|---|
 * | 1 | 9 | 12 | 1,33× |
 * | 40 | 195.357 | 272.335 | 1,39× |
 * | 300 | 602.963.665 | 803.881.080 | 1,33× |
 *
 * Dispersão de 1,25× a 1,41× em toda a faixa, contra 0,3× a 9,9× da tentativa
 * anterior. É a diferença entre grandeza estável e instável.
 *
 * Contra ondas REAIS a folga é maior: 3,9× no setor 1 e **522×** no 300. O teto
 * é frouxo no fim da campanha porque lá a onda de chefe paga 12× e o piso de
 * tempo dela é o de uma onda comum — o chefe é UMA unidade. Antes de recusar,
 * ele precisa de piso próprio; enquanto MEDE, frouxo é o lado seguro de errar.
 *
 * ## Ainda MEDE, não impede
 *
 * Pelo mesmo motivo de `teto.ts`, e a disciplina é do projeto: um teto que
 * nunca disparou em produção pode ser ligado com confiança; um calibrado em
 * laboratório é o que recusa o jogador novo na segunda-feira. A diferença é
 * que este é comparável — os dois tetos passam a registrar lado a lado, e a
 * decisão de ligar a recusa vai sair de qual deles acerta.
 */

/**
 * Folga sobre o piso de tempo.
 *
 * Ela é o que garante que o teto fique ACIMA do jogador honesto mais rápido:
 * medido, a folga resultante vai de 1,25× a 1,41× na faixa de 1 a 300. Sem
 * margem nenhuma o teto encostaria no honesto, e bastaria um arredondamento
 * para recusá-lo — que é como a tentativa 2 falhou.
 */
export const FOLGA_DO_PISO = 0.75;

/** Quanto tempo, no mínimo, uma onda deste setor leva para entrar em campo. */
export function pisoDeTempoDaOnda(setor: number): number {
  return unidadesMinimasDaOnda(setor) / TAXA_DE_ENTRADA;
}

export interface TetoPorReplica {
  /** O maior XP que a janela permite. */
  xp: number;
  /** Quantas ondas cabem na janela, no ritmo mais rápido possível. */
  ondas: number;
}

/**
 * O máximo que N segundos rendem neste setor, replicando o jogo onda a onda.
 *
 * Percorre as ondas na ordem em que o jogador as enfrenta — cinco comuns e a
 * final, que é elite (5×) ou chefe (12×) —, gastando o piso de tempo de cada
 * uma até a janela acabar. É a mesma sequência que a cena impõe, e por isso o
 * número que sai não é um palpite sobre o jogador: é o que o jogo entrega.
 */
export function tetoPorReplica(setor: number, segundos: number): TetoPorReplica {
  const s = Math.max(1, Math.floor(setor));
  let restante = Math.max(0, segundos) / FOLGA_DO_PISO;
  const piso = pisoDeTempoDaOnda(s);

  let xp = 0;
  let ondas = 0;
  // Teto de sanidade: uma janela absurda (relógio adulterado, conta parada por
  // meses) não pode virar um laço de milhões de voltas.
  const MAX_ONDAS = 20_000;
  while (restante >= piso && ondas < MAX_ONDAS) {
    // A onda cicla 1..WAVES_PER_SECTOR e depois a final (WAVES_PER_SECTOR+1).
    const onda = (ondas % (WAVES_PER_SECTOR + 1)) + 1;
    xp += xpDaOnda(s, onda);
    restante -= piso;
    ondas++;
  }
  return { xp, ondas };
}

/** Registra quando o XP declarado passa do que a janela permitia. */
export function excedeuPorReplica(
  xpDeclarado: number,
  setor: number,
  segundos: number,
): { quantia: number; teto: number; folga: number; setor: number; segundos: number } | null {
  if (!(xpDeclarado > 0)) return null;
  const { xp: teto } = tetoPorReplica(setor, segundos);
  if (teto <= 0 || xpDeclarado <= teto) return null;
  return {
    quantia: xpDeclarado,
    teto,
    folga: xpDeclarado / teto,
    setor: Math.max(1, Math.floor(setor)),
    segundos: Math.max(0, segundos),
  };
}
