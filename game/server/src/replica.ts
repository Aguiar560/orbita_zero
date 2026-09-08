import { TAXA_DE_ENTRADA, WAVES_PER_SECTOR } from '@data/balance/curvas';
import { unidadesMinimasDaOnda, vidasDeOndaComum, xpDaOnda } from '@sim/progression';

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
 * ## O chefe precisou de piso próprio
 *
 * Ele é UMA unidade: entra na hora, e o que segura é o dano. Com o piso de
 * entrada de uma onda comum, e pagando 12×, o teto ficava **522× acima** do
 * jogo real no setor 300. A razão de VIDA resolve sem voltar a estimar o
 * jogador — seja qual for o dano, dez vezes a vida leva dez vezes o tempo.
 *
 * | contra ondas reais | antes | depois |
 * |---|---|---|
 * | setor 1 | 3,9× | 3,0× |
 * | setor 40 | 6,8× | 2,0× |
 * | setor 300 | **522×** | **1,3×** |
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

/**
 * Quanto tempo, no mínimo, esta onda leva.
 *
 * Para a onda COMUM é o tempo de ENTRAR em campo: não se mata quem não chegou.
 *
 * Para a onda de CHEFE não serve — ele é UMA unidade e entra na hora; o que
 * segura é o DANO. Sem tratamento próprio ele ganhava o piso de uma onda
 * comum e paga 12×, e o teto ficava 522× acima do jogo real no setor 300
 * (medido em 09/09).
 *
 * O dano do jogador é a grandeza instável que esta fase evita. Mas a RAZÃO
 * entre as vidas não depende dele: seja qual for o dano, um encontro com dez
 * vezes a vida leva dez vezes o tempo. Ver `vidasDeOndaComum`.
 */
export function pisoDeTempoDaOnda(setor: number, onda = 1): number {
  const entrada = unidadesMinimasDaOnda(setor) / TAXA_DE_ENTRADA;
  return entrada * vidasDeOndaComum(setor, onda);
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

  let xp = 0;
  let ondas = 0;
  // Teto de sanidade: uma janela absurda (relógio adulterado, conta parada por
  // meses) não pode virar um laço de milhões de voltas.
  const MAX_ONDAS = 20_000;
  for (;;) {
    // A onda cicla 1..WAVES_PER_SECTOR e depois a final (WAVES_PER_SECTOR+1).
    const onda = (ondas % (WAVES_PER_SECTOR + 1)) + 1;
    // O piso é POR ONDA: a final custa muito mais tempo que uma comum, porque
    // tem muito mais vida. Calcular um piso só para o setor dava ao chefe o
    // tempo de uma onda comum, e ele paga 12×.
    const piso = pisoDeTempoDaOnda(s, onda);
    if (restante < piso || ondas >= MAX_ONDAS) break;
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
