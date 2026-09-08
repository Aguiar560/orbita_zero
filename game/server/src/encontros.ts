import { precoDoEncontro } from '@sim/progression';
import type { GameState } from '@sim/types';

/**
 * O preço do que o cliente DECLAROU ter enfrentado.
 *
 * ## O que isto substitui
 *
 * A declaração de XP. Até aqui o cliente dizia "ganhei X" e o servidor
 * acreditava — era o buraco que sobrava depois da Fase 4. Agora ele diz
 * "enfrentei a onda 3 do setor 40 e matei 51", e quem calcula é o servidor,
 * com `precoDoEncontro` e a semente que ele guarda desde a migração 0013.
 *
 * ## Por que só isto fecha a porta
 *
 * As duas primeiras tentativas do passo 4 tentaram julgar o VALOR declarado, e
 * as duas falharam por precisar de uma expectativa de ganho estável, que não
 * existe. O declarado aqui não é valor: é FATO — onde, e quantos. O valor sai
 * do próprio jogo, chamando a mesma função que pagou.
 *
 * ## O que ainda é declarado, e por quê
 *
 * O XP de missão. Ele não vem de encontro nenhum, e o servidor não sabe
 * precificá-lo enquanto as missões não tiverem tabela própria. Somar os dois é
 * honesto quanto ao que cada metade garante: a de combate é calculada, a de
 * missão ainda é acreditada.
 */

/** Quantos encontros um envio pode declarar. */
export const ENCONTROS_MAX = 400;

export interface PrecoDeclarado {
  /** O XP que os encontros declarados valem, calculado pelo servidor. */
  xp: number;
  /** Quantos encontros entraram na conta. */
  encontros: number;
  /** O que foi descartado por não fazer sentido — chave torta, setor alto demais. */
  recusados: number;
}

/**
 * Precifica um mapa `"setor:onda" → abates`.
 *
 * Recusa em silêncio o que não faz sentido, em vez de derrubar o envio inteiro:
 * é a lição de `planejarEquipar` — um comando ruim não melhora com retentativa,
 * e derrubar o lote por causa dele transforma um erro num bloqueio permanente
 * de todo o progresso.
 */
export function precificarEncontros(
  declarados: Record<string, unknown>,
  estado: GameState,
  melhorSetor: number,
): PrecoDeclarado {
  let xp = 0;
  let encontros = 0;
  let recusados = 0;

  for (const [chave, valor] of Object.entries(declarados)) {
    if (encontros + recusados >= ENCONTROS_MAX) break;

    const [s, o] = chave.split(':');
    const setor = Number(s);
    const onda = Number(o);
    const abates = Number(valor);

    const saoNumeros = [setor, onda, abates].every((n) => Number.isFinite(n));
    // O setor é aparado pelo MELHOR JÁ ALCANÇADO, que é do servidor. Sem isso,
    // declarar a onda do setor 300 no primeiro dia pagaria o setor 300.
    const cabeNoMundo = saoNumeros
      && setor >= 1 && setor <= melhorSetor
      && onda >= 1 && onda <= 64
      && abates > 0;

    if (!cabeNoMundo) { recusados++; continue; }

    // `precoDoEncontro` já apara `abates` pelo tamanho real da onda, então
    // declarar mil numa onda de quarenta não paga mais que quarenta.
    xp += precoDoEncontro(estado, Math.floor(setor), Math.floor(onda), Math.floor(abates));
    encontros++;
  }

  return { xp, encontros, recusados };
}
