import { bossForSector, isBossSector } from '@data/bosses';
import { SETOR_FINAL_DA_CAMPANHA, cristalDoChefe } from '@data/balance/cristal';
import { MISSOES } from '@data/missoes';

/**
 * Os marcos que pagam cristal, e quando cada um foi cumprido.
 *
 * ## Por que existe como lista
 *
 * O cristal é a moeda que o jogo vende, então ele só pode nascer no servidor —
 * o cliente é um console aberto. O servidor não roda o combate, mas sabe duas
 * coisas: o SETOR alcançado (que só sobe) e as missões cuja entrega ELE
 * conferiu. Todo marco é uma dessas duas perguntas, e nada mais.
 *
 * Mora em `sim/` porque cliente e servidor precisam da MESMA lista: o servidor
 * para creditar, o cliente para mostrar o que falta. Duas cópias divergiriam na
 * primeira vez que alguém mexesse no orçamento.
 *
 * ## Por que o id é estável
 *
 * O crédito usa `usuario:id` como origem no livro-caixa, e o índice único
 * `(motivo, origem)` barra a segunda vez. Renomear um id pagaria o marco de
 * novo para todo mundo que já o recebeu.
 */
export interface MarcoDeCristal {
  /** `chefe_<setor>` ou `missao_<id>`. Estável: é a chave do crédito. */
  id: string;
  cristais: number;
  /** O texto do aviso quando o crédito chega. */
  rotulo: string;
  tipo: 'chefe' | 'missao';
  /** Chefe: o setor dele. Cumprido quando o setor alcançado passa dele. */
  setor?: number;
  /** Missão: cumprido quando o servidor registra a entrega. */
  missaoId?: string;
}

function marcosDeChefe(): MarcoDeCristal[] {
  const lista: MarcoDeCristal[] = [];
  for (let setor = 1; setor <= SETOR_FINAL_DA_CAMPANHA; setor++) {
    if (!isBossSector(setor)) continue;
    lista.push({
      id: `chefe_${setor}`,
      cristais: cristalDoChefe(setor),
      rotulo: `Primeira vitória sobre ${bossForSector(setor).name}`,
      tipo: 'chefe',
      setor,
    });
  }
  return lista;
}

function marcosDeMissao(): MarcoDeCristal[] {
  return MISSOES
    .filter((m) => (m.recompensa.moedas?.cristal ?? 0) > 0)
    .map((m) => ({
      id: `missao_${m.id}`,
      cristais: m.recompensa.moedas!.cristal!,
      rotulo: m.nome,
      tipo: 'missao' as const,
      missaoId: m.id,
    }));
}

export const MARCOS_DE_CRISTAL: readonly MarcoDeCristal[] = [...marcosDeChefe(), ...marcosDeMissao()];

/**
 * Os marcos já cumpridos por uma conta.
 *
 * `melhorSetor` é o que o servidor guarda: o PRÓXIMO setor liberado. Vencer o
 * chefe do setor 10 conclui o 10 e libera o 11 — por isso a comparação é `>`.
 */
export function marcosCumpridos(
  melhorSetor: number,
  entregues: ReadonlySet<string>,
): MarcoDeCristal[] {
  return MARCOS_DE_CRISTAL.filter((m) =>
    m.tipo === 'chefe' ? melhorSetor > m.setor! : entregues.has(m.missaoId!));
}
