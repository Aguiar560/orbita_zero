/**
 * O teto físico de ganho declarado — que MEDE, e não impede.
 *
 * ## Por que só medir
 *
 * Nesta fase o cliente ainda calcula o combate e declara o resultado. A
 * pergunta que falta responder é "esse ganho era possível?", e duas tentativas
 * de respondê-la com uma fórmula já foram medidas e falharam (registradas no
 * `PLANO`, Fase 5, passo 4):
 *
 * 1. Substituir o ganho ao vivo pelo modelo abstrato. Os dois discordam em
 *    SINAL: no setor 3, a cena ao vivo dá −21 de sucata e +955 de XP onde
 *    `applyOffline` dá +209 e +98. Substituir não é proteger, é trocar a
 *    economia.
 * 2. Recusar acima de `TAXA_DE_ENTRADA × sectorBounty × 12`. **No setor 1 esse
 *    teto fica três vezes ABAIXO do ganho honesto** — ele recusaria todo
 *    jogador novo, em silêncio, no primeiro minuto. A folga varia de 0,3× a
 *    9,9× em quinze setores.
 *
 * A saída do plano é literal: *medir antes de impedir*. O servidor registra
 * quando o ganho declarado passaria do teto, sem clipar nada, e a decisão de
 * ligar a recusa vem de dados de jogadores reais. Um teto que nunca disparou em
 * produção pode ser ligado com confiança; um teto calibrado em laboratório é o
 * que recusa o jogador novo na segunda-feira.
 *
 * ## Por que a margem é ABSURDA de propósito
 *
 * `MARGEM` multiplica o teto por dez. Isso parece esvaziar a medida, e é o
 * contrário: a folga honesta medida chega a 9,9× em setores altos, então
 * qualquer margem menor registraria jogo normal e o registro viraria ruído
 * caro. Com dez, o que aparecer na tabela é o que nenhuma variação de
 * equipamento, sorte ou build explica.
 *
 * ## Por que isto não custa cota
 *
 * Só o EXCEDENTE é gravado. Quem joga normal não gera uma linha sequer, e o
 * custo em D1 continua sendo o do jogo — que acabou de ser cortado pela metade
 * com a coleta líquida. Um trapaceiro paga as próprias linhas.
 */

import { TAXA_DE_ENTRADA } from '@data/balance/curvas';
import { sectorBounty } from '@sim/progression';

/**
 * Quantas vezes o teto físico é multiplicado antes de registrar.
 *
 * Ver o cabeçalho: a folga honesta medida vai a 9,9×, então abaixo disto o
 * registro pegaria jogo legítimo.
 */
export const MARGEM = 10;

/**
 * O maior ganho fisicamente possível numa janela, antes da margem.
 *
 * `TAXA_DE_ENTRADA` é o teto de projeto de inimigos por segundo — não se mata
 * quem não entrou na tela, e isso não depende de build nem de sorte. O resto é
 * quanto cada abate pode render no setor.
 *
 * O 12 é o mesmo fator da tentativa 2, mantido de propósito: é a fórmula que a
 * medição derrubou, e é exatamente ela que os dados precisam avaliar. Trocá-la
 * por um palpite novo faria a medição responder sobre outra coisa.
 */
export function tetoFisico(setor: number, segundos: number): number {
  const s = Math.max(1, Math.floor(setor));
  const janela = Math.max(1, segundos);
  return TAXA_DE_ENTRADA * sectorBounty(s) * 12 * janela;
}

/** O teto com a margem — é este que dispara o registro. */
export function tetoDeRegistro(setor: number, segundos: number): number {
  return tetoFisico(setor, segundos) * MARGEM;
}

export interface Excedente {
  /** Quanto foi declarado na janela. */
  quantia: number;
  /** O teto que ele passou, já com a margem. */
  teto: number;
  /** Quantas vezes o teto físico, sem a margem. É o número que se lê. */
  folga: number;
  setor: number;
  segundos: number;
}

/**
 * O ganho declarado passou do teto de registro?
 *
 * Devolve `null` quando não passou — o caso normal, e o que evita gravar.
 *
 * Só ganho conta. Gasto e perda são negativos e nunca são suspeitos: ninguém
 * trapaceia para ficar mais pobre, e tratá-los pelo módulo faria uma morte cara
 * virar excedente.
 */
export function excedeu(
  quantia: number, setor: number, segundos: number,
): Excedente | null {
  if (!Number.isFinite(quantia) || quantia <= 0) return null;
  if (!Number.isFinite(segundos) || segundos < 0) return null;

  const teto = tetoDeRegistro(setor, segundos);
  if (!(quantia > teto)) return null;

  return {
    quantia,
    teto,
    folga: quantia / Math.max(1, tetoFisico(setor, segundos)),
    setor,
    segundos,
  };
}
