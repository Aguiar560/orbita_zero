import { HULL_BY_ID } from '@data/hulls';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { GameState, Item, SlotId } from '@sim/types';

import { rolarLote } from './lote';

/**
 * Monta um `GameState` do servidor, para ele poder simular.
 *
 * ## Por que isto é possível
 *
 * `Sim` roda sem DOM — medido, não suposto: os 900 testes o instanciam em Node,
 * e o passo 1 desta fase deixou os dois lados compilando. O Worker importa o
 * MESMO arquivo que o navegador usa para jogar, então não existe cópia da
 * simulação. Custo medido: 2,5 ms para 150 s de jogo, 23 ms para quatro horas.
 *
 * ## Por que parte de `createState()`
 *
 * O `GameState` tem 31 campos e o servidor guarda oito. Montar o objeto à mão
 * significaria escrever um valor plausível para cada campo que falta — e errar
 * um deles em silêncio, com a simulação divergindo do jogo por um motivo que
 * ninguém encontraria. Partir do estado padrão e sobrepor o que o servidor sabe
 * garante que o resto tenha exatamente o valor que um save novo teria.
 *
 * ## O que o cliente ainda informa, e por quê
 *
 * `run`, `hull` e a postura da IA. Nenhum dos três decide PODER — são contexto
 * de cena: onde a nave está e como ela se comporta. O que decide poder — item,
 * nível, Matriz, casco possuído — já é do servidor desde a Fase 4, e é por isso
 * que esta montagem é segura mesmo com o cliente informando parte dela.
 */

export interface DadosDoServidor {
  saldos: { sucata: number; nucleo: number; cristal: number };
  xp: number;
  nivel: number;
  matriz: string[];
  melhorSetor: number;
  materiais: Record<string, number>;
  naves: Record<string, number>;
  frota: string[];
  itens: { item: Item; nave: string | null; slot: string | null }[];
}

/** O contexto de cena que o cliente informa. Nada aqui decide poder. */
export interface ContextoDoCliente {
  hull?: string;
  setor?: number;
  onda?: number;
  postura?: string;
}

export function montarEstado(dados: DadosDoServidor, ctx: ContextoDoCliente): GameState {
  const estado = createState();

  estado.resources = { ...dados.saldos };
  estado.command.xp = dados.xp;
  estado.command.nivel = dados.nivel;
  estado.command.allocated = [...dados.matriz];
  estado.universe.bestSectorEver = dados.melhorSetor;
  estado.armazem = { ...dados.materiais };

  // A frota vem do servidor; o casco EM CAMPO vem do cliente, e só é aceito se
  // estiver na frota. Sem essa conferência, alegar um casco melhor seria uma
  // troca de atributos de graça — e é justamente o que a Fase 3c fechou.
  estado.fleet = [...dados.frota];
  const desejado = ctx.hull;
  estado.hull = desejado && dados.frota.includes(desejado) && HULL_BY_ID.has(desejado)
    ? desejado
    : (dados.frota[0] ?? estado.hull);

  estado.naves = {};
  for (const casco of dados.frota) {
    estado.naves[casco] = { nivel: 1, xp: dados.naves[casco] ?? 0, equipped: {} };
  }
  if (!estado.naves[estado.hull]) {
    estado.naves[estado.hull] = { nivel: 1, xp: 0, equipped: {} };
  }

  estado.inventory = [];
  for (const linha of dados.itens) {
    if (linha.nave && linha.slot) {
      const nave = estado.naves[linha.nave];
      if (nave) { nave.equipped[linha.slot as SlotId] = linha.item; continue; }
    }
    estado.inventory.push(linha.item);
  }

  // O setor é aparado pelo MELHOR JÁ ALCANÇADO, que é do servidor. Alegar o
  // setor 300 para simular recompensa de fim de jogo era a saída óbvia, e esta
  // linha é a que a fecha.
  const setor = Math.floor(Number(ctx.setor) || 1);
  estado.run.sector = Math.min(Math.max(1, setor), Math.max(1, dados.melhorSetor));
  estado.run.wave = Math.max(1, Math.floor(Number(ctx.onda) || 1));

  const postura = ctx.postura;
  if (postura === 'agressivo' || postura === 'evasivo' || postura === 'equilibrado') {
    estado.settings.pilot = postura as GameState['settings']['pilot'];
  }

  return estado;
}

/**
 * Um `Sim` pronto para simular, com o pote de itens já abastecido.
 *
 * O pote precisa vir cheio: `rollDrops` consome dele e, vazio, registra dívida
 * em vez de entregar. No cliente isso é o certo — a dívida é paga quando o lote
 * chega. Aqui não haveria quem pagasse, e o jogador perderia todo o loot da
 * ausência sem nada explicando.
 */
export function simDoServidor(
  dados: DadosDoServidor,
  ctx: ContextoDoCliente,
  semente: number,
): Sim {
  const estado = montarEstado(dados, ctx);
  const sim = new Sim(estado);
  // Sorte entra na rolagem, e ela sai dos atributos que o servidor acabou de
  // montar — não do que o cliente diz ter.
  sim.receberLote(rolarLote(semente, estado.run.sector, sim.stats.sorte, estado.universe.index));
  return sim;
}
