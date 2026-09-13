import { isBossSector } from '@data/bosses';
import { HULL_BY_ID } from '@data/hulls';
import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { nivelPorXpAcumulado } from '@sim/nivel';
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
  /** O casco em campo, guardado. Vazio = nunca escolheu. */
  cascoEmCampo?: string;
  /** A semente do universo do jogador. Zero = o servidor ainda não a conhece. */
  semente?: number;
  /**
   * Expiração do passe VIP, em segundos. É do SERVIDOR, nunca do cliente.
   *
   * Sem ela a simulação da ausência rodava sempre sem passe — e com o descarte
   * automático sendo benefício VIP desde 12/09/2026, isso significava gerar e
   * GRAVAR as peças que a automação deveria ter consumido. O jogador voltava de
   * horas fora com a carga cheia de Comum e o corte "abaixo de Raro" ligado.
   */
  vipExpiraEm?: number;
  itens: { item: Item; nave: string | null; slot: string | null }[];
}

/** O contexto de cena que o cliente informa. Nada aqui decide poder. */
export interface ContextoDoCliente {
  hull?: string;
  setor?: number;
  onda?: number;
  postura?: string;
  /**
   * As preferências de descarte automático, como `postura`: PREFERÊNCIA, não
   * poder. O cliente as declara porque elas moram no save e o servidor não as
   * tem — e mentir aqui só destrói o próprio loot, que não é ataque nenhum.
   *
   * Quem decide se a automação PODE rodar continua sendo o servidor, pelo
   * `vipExpiraEm` que ele mesmo leu de `assinaturas`.
   */
  autoSalvage?: number;
  autoDispose?: string;
}

export function montarEstado(dados: DadosDoServidor, ctx: ContextoDoCliente): GameState {
  /**
   * A SEMENTE do jogador, e não uma nova.
   *
   * Era `createState()` sem argumento — semente aleatória a cada requisição.
   * O servidor montava as ondas do jogador com uma composição que não era a
   * dele: outros inimigos, outra densidade, outra contagem. O ganho da ausência
   * saía plausível e errado.
   *
   * Zero significa "ainda não sei" (save de antes da coluna), e aí o
   * comportamento antigo vale até o cliente informar a dele.
   */
  const estado = dados.semente ? createState(dados.semente) : createState();

  estado.resources = { ...dados.saldos };

  /**
   * O XP do piloto tambem e ACUMULADO, e o campo do estado e o RESTO.
   *
   * Era `estado.command.xp = dados.xp`, com o acumulado indo parar no campo
   * que o cliente le como resto. Na simulacao, `avancarNivel` tratava aquele
   * numero como progresso dentro do nivel e subia varios niveis de uma vez --
   * ate 200 por chamada, que e o teto que existe justamente para isso nao
   * enfileirar 400 avisos. O nivel do piloto na ausencia era inventado.
   *
   * Nível e resto saem do MESMO número, e não de `dados.nivel` mais uma
   * conta: dois campos que deviam concordar e são preenchidos de origens
   * diferentes acabam discordando, e aqui isso viraria uma nave simulada com
   * poder que ninguém consegue explicar. `dados.nivel` continua existindo para
   * quem confere a Matriz, e deriva do mesmo XP pela mesma função.
   */
  const piloto = nivelPorXpAcumulado(dados.xp, curvaXpPersonagem);
  estado.command.nivel = piloto.nivel;
  estado.command.xp = piloto.resto;
  estado.command.allocated = [...dados.matriz];
  estado.universe.bestSectorEver = dados.melhorSetor;
  estado.armazem = { ...dados.materiais };

  // A frota vem do servidor; o casco EM CAMPO vem do cliente, e só é aceito se
  // estiver na frota. Sem essa conferência, alegar um casco melhor seria uma
  // troca de atributos de graça — e é justamente o que a Fase 3c fechou.
  estado.fleet = [...dados.frota];
  /**
   * O casco em campo tem TRÊS origens, nesta ordem.
   *
   * 1. O que o cliente informa, se for dele. É a intenção mais recente — ele
   *    pode ter trocado de nave neste boot, antes de a troca ser drenada.
   * 2. O que está GUARDADO. É a novidade: antes não havia onde guardar, e a
   *    ausência de um jogador que não tivesse informado nada caía direto no
   *    primeiro casco da frota — quase sempre o do piloto.
   * 3. O primeiro da frota, como último recurso.
   *
   * As três passam pela mesma conferência: só vale casco que é da pessoa.
   */
  const dele = (id: string | undefined): boolean =>
    !!id && dados.frota.includes(id) && HULL_BY_ID.has(id);
  estado.hull = dele(ctx.hull) ? ctx.hull!
    : dele(dados.cascoEmCampo) ? dados.cascoEmCampo!
      : (dados.frota[0] ?? estado.hull);

  /**
   * A nave entra na simulação com o NÍVEL dela, e não no 1.
   *
   * Era `{ nivel: 1, xp: <acumulado> }` — duas coisas erradas de uma vez: o
   * nível fixo e o acumulado guardado num campo que o cliente lê como resto.
   * `nivelDaNave` já existia aqui do lado, escrita para isto, e nunca era
   * chamada; o piloto usava a irmã dela e a da nave ficou órfã.
   *
   * O nível da nave multiplica os atributos do CASCO (ver `resolveStats`).
   * Medido em 08/09: uma nave nível 60 com equipamento épico simulava a
   * ausência com **74% menos dano** do que ela tem. O jogador fechava a aba e
   * recebia por uma nave que não é a dele.
   */
  estado.naves = {};
  for (const casco of dados.frota) {
    const { nivel, resto } = nivelPorXpAcumulado(dados.naves[casco] ?? 0, curvaXpNave);
    estado.naves[casco] = { nivel, xp: resto, equipped: {} };
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
  const aparado = Math.min(Math.max(1, setor), Math.max(1, dados.melhorSetor));

  /**
   * A AUSÊNCIA NÃO ENFRENTA CHEFE. Nunca.
   *
   * A chave de acesso mora no save, que é do cliente — o servidor não tem como
   * conferir se ela foi gasta, e aceitar a palavra dele aqui seria aceitar
   * `{setor: 10}` de um cliente modificado e simular o chefe sem chave
   * nenhuma. Era a última porta aberta para "estar num setor de chefe sem a
   * chave", e a única que não dava para fechar conferindo: dava para fechar
   * decidindo.
   *
   * Recuar um setor é coerente com o que a ausência já é. Ela não solta item
   * (ver `completeEncounter`) pelo mesmo motivo de fundo: o que exige ESTAR LÁ
   * não acontece com a aba fechada, e enfrentar um chefe exige estar lá mais
   * que qualquer outra coisa no jogo.
   *
   * O custo é de quem parou a nave em cima do chefe com a chave já gasta: a
   * ausência dele rende como o setor anterior. É um setor de diferença, e do
   * lado seguro.
   */
  estado.run.sector = isBossSector(aparado) ? Math.max(1, aparado - 1) : aparado;
  estado.run.wave = Math.max(1, Math.floor(Number(ctx.onda) || 1));

  // O passe, do servidor. Em milissegundos porque é assim que `vipAtivo` lê.
  estado.vip.expiresAt = Math.max(0, Math.floor(Number(dados.vipExpiraEm) || 0)) * 1000;

  // O corte, do cliente, aparado no catálogo de raridades que o jogo conhece.
  const corte = Math.floor(Number(ctx.autoSalvage) || 0);
  estado.settings.autoSalvage = Math.max(0, Math.min(6, corte)) as GameState['settings']['autoSalvage'];
  if (ctx.autoDispose === 'vender' || ctx.autoDispose === 'desmontar') {
    estado.settings.autoDispose = ctx.autoDispose;
  }

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
