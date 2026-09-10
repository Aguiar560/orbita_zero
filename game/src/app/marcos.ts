import { toast } from '@app/Bus';
import type { Sim } from '@sim/index';

import { espelharNoSim, sincronizar } from './carteira';

/**
 * O aviso de que um marco virou cristal.
 *
 * O crédito é do servidor (`server/src/marcos.ts`): ele devolve, na resposta de
 * `/progresso` e `/missoes`, os marcos que acabou de pagar. Sem este aviso o
 * cristal apareceria no topo da tela do nada — e na moeda que o jogo vende,
 * um ganho que ninguém explica parece defeito, não recompensa.
 */
export interface MarcoCreditado {
  id: string;
  cristais: number;
  rotulo: string;
}

/** Acima disto os avisos viram um só — ver o corpo. */
const AVISOS_SEPARADOS = 3;

export async function avisarMarcos(sim: Sim, marcos: readonly MarcoCreditado[] | undefined): Promise<void> {
  if (!marcos?.length) return;

  // Um aviso por marco no jogo normal, que cumpre um de cada vez. A conta que
  // já tinha passado de vinte chefes antes desta regra recebe tudo de uma vez
  // na primeira sincronização, e vinte avisos empilhados esconderiam a tela.
  if (marcos.length <= AVISOS_SEPARADOS) {
    for (const m of marcos) toast(`+${m.cristais} cristais · ${m.rotulo}`, 'epic', 'moeda_2');
  } else {
    const total = marcos.reduce((s, m) => s + m.cristais, 0);
    toast(`+${total} cristais · ${marcos.length} marcos da campanha`, 'epic', 'moeda_2');
  }

  // O saldo mudou no servidor, e o topo da tela lê o espelho.
  if (await sincronizar()) espelharNoSim(sim);
}
