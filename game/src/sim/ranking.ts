import { HULL_BY_ID } from '@data/hulls';
import type { GameState } from './types';

/**
 * O que cada placar mede, e de onde tira o número.
 *
 * Mora em `sim/` e não na tela porque é REGRA: "melhor setor" é
 * `bestSectorEver` e não `run.sector`, "missões" conta só as entregues, e o
 * placar de naves é por casco. Uma tela que decidisse isso sozinha divergiria
 * do que o servidor for pontuar no dia em que existir.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não inventa adversário. O placar é mundial e precisa de um back-end que ainda
 * não existe; até lá o jogo sabe apenas a própria marca. Preencher a lista com
 * nomes fabricados daria ao jogador uma posição falsa — ele decidiria o que
 * jogar comparando-se com gente que não existe.
 */

export type PlacarId = 'provacao' | 'galaxia' | 'personagem' | 'naves' | 'missoes';

export interface Placar {
  id: PlacarId;
  nome: string;
  /** O que a coluna de pontuação significa. */
  unidade: string;
  /** Uma linha de explicação: o que exatamente conta. */
  criterio: string;
}

export const PLACARES: readonly Placar[] = [
  {
    id: 'provacao',
    nome: 'Provação',
    unidade: 'andar',
    criterio: 'O maior andar VENCIDO. Chegar sem vencer não conta.',
  },
  {
    id: 'galaxia',
    nome: 'Galáxia',
    unidade: 'setor',
    criterio: 'O setor mais distante alcançado, mesmo que você tenha recuado depois.',
  },
  {
    id: 'personagem',
    nome: 'Personagem',
    unidade: 'nível',
    criterio: 'Nível de comando. Empate se desfaz pelo XP acumulado dentro do nível.',
  },
  {
    id: 'naves',
    nome: 'Naves',
    unidade: 'nível',
    criterio: 'Nível de cada casco, separado. Uma nave só entra depois de subir do nível 1.',
  },
  {
    id: 'missoes',
    nome: 'Missões',
    unidade: 'entregues',
    criterio: 'Contratos ENTREGUES. Missão aceita ou em andamento não conta.',
  },
];

export const PLACAR_POR_ID = new Map(PLACARES.map((p) => [p.id, p]));

/** A marca do jogador num placar. `desempate` ordena empates. */
export interface Marca {
  valor: number;
  desempate: number;
  /** Rótulo curto do que produziu a marca — a nave, no placar de naves. */
  detalhe?: string;
}

export function missoesEntregues(state: GameState): number {
  return Object.values(state.missoes ?? {}).filter((m) => m?.entregue).length;
}

/**
 * A marca do jogador num placar.
 *
 * `naves` exige o id do casco: é o único placar com um filtro, porque cada nave
 * corre numa lista própria. Sem casco ele devolve a MELHOR nave — é o que a
 * tela mostra antes de o jogador escolher uma.
 */
export function marcaDoJogador(state: GameState, placar: PlacarId, casco?: string): Marca {
  switch (placar) {
    case 'provacao':
      return { valor: state.provacao?.pisoMax ?? 0, desempate: 0 };

    case 'galaxia':
      return { valor: state.universe.bestSectorEver, desempate: 0 };

    case 'personagem':
      // O XP desempata: dois jogadores no nível 300 não são a mesma coisa, e
      // sem desempate o placar viraria uma lista alfabética de quem chegou lá.
      return { valor: state.command.nivel, desempate: state.command.xp };

    case 'missoes':
      return { valor: missoesEntregues(state), desempate: 0 };

    case 'naves': {
      if (casco) {
        const nave = state.naves[casco];
        return { valor: nave?.nivel ?? 0, desempate: nave?.xp ?? 0, detalhe: HULL_BY_ID.get(casco)?.name };
      }
      let melhor: Marca = { valor: 0, desempate: 0 };
      for (const [id, nave] of Object.entries(state.naves ?? {})) {
        if (!nave) continue;
        if (nave.nivel > melhor.valor || (nave.nivel === melhor.valor && nave.xp > melhor.desempate)) {
          melhor = { valor: nave.nivel, desempate: nave.xp, detalhe: HULL_BY_ID.get(id)?.name };
        }
      }
      return melhor;
    }
  }
}

/**
 * As naves que podem aparecer no placar, da melhor para a pior.
 *
 * Só as da frota: um casco que o jogador não tem não tem marca, e listá-lo com
 * nível 0 encheria o filtro de linhas mortas.
 */
export function navesClassificaveis(state: GameState): { id: string; nome: string; nivel: number; xp: number }[] {
  return state.fleet
    .map((id) => {
      const nave = state.naves[id];
      return { id, nome: HULL_BY_ID.get(id)?.name ?? id, nivel: nave?.nivel ?? 1, xp: nave?.xp ?? 0 };
    })
    .filter((n) => HULL_BY_ID.has(n.id))
    .sort((a, b) => b.nivel - a.nivel || b.xp - a.xp || a.nome.localeCompare(b.nome));
}
