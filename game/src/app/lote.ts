import { API_URL } from '@app/api';
import type { Sim } from '@sim/index';

import { tokenValido } from './conta';
import { relatarFalha, relatarSucesso } from './recusa';
import { drenarInventario } from './inventario';

/**
 * O lote de itens do setor, rolado pelo servidor.
 *
 * ## O que mudou, e por quê
 *
 * `rollItem` rodava aqui, com o RNG do cliente. Quem abre o console rola até
 * sair Divino — e o item ruim nunca chega a existir para ser comparado com
 * nada, então nenhuma auditoria posterior recupera isso.
 *
 * Agora o servidor rola e o cliente CONSOME. Ele não escolhe o que sai; escolhe
 * apenas quando tirar do bolso.
 *
 * ## Por que um lote, e não um pedido por item
 *
 * Medido em 03/09: **186 itens por hora** em jogo normal. Uma ida ao servidor
 * por item seria uma requisição a cada vinte segundos, para sempre, por
 * jogador. Um lote por setor é uma a cada três minutos — o mesmo ritmo da
 * carteira, porque é o mesmo evento: o setor caiu.
 *
 * ## A página saiu do cliente em 09/09
 *
 * Ele pedia "me dá a página 2" e o servidor derivava outra do cursor na hora de
 * conferir a coleta. Os dois lados olhavam para itens diferentes: o jogador via
 * na mochila uma peça que o servidor nunca criou, e ela sumia na sincronização
 * seguinte. Era o `faltaram_*` do livro das recusas.
 *
 * Hoje quem decide é o CURSOR, que é do servidor. O cliente só diz "preciso de
 * mais", e recebe a continuação de onde cada pote parou. Uma alavanca a menos
 * na mão de quem não deveria tê-la.
 *
 * ## Por que o pote vazio não volta a rolar localmente
 *
 * Seria a saída óbvia para rede fora, e é exatamente o buraco de novo: bastaria
 * bloquear a requisição para voltar a rolar à vontade. Quando o pote esvazia, o
 * drop fica DEVENDO — `Sim` guarda a dívida e ela é paga quando o lote chega.
 * O jogador não perde o item; ele o recebe alguns segundos depois.
 */

export type TipoDeDrop = 'onda' | 'elite' | 'chefe';

interface Resposta {
  setor: number;
  /** Até onde cada pote já foi consumido. Quem manda agora é ele. */
  cursor: Record<TipoDeDrop, number>;
  lote: Record<TipoDeDrop, unknown[]>;
  porPool: number;
}

let setorEmMaos = 0;
let buscando = false;

/**
 * Busca o lote do setor, se ainda não temos o dele.
 *
 * Idempotente por setor: pedir o mesmo de novo devolve o MESMO lote (é o
 * servidor que garante), então chamar à toa custa uma requisição e nada mais.
 */
export async function garantirLote(sim: Sim, setor: number): Promise<boolean> {
  if (buscando) return false;

  // Quando pedir: setor novo, ou pote seco no mesmo setor.
  //
  // Não é re-rolar: o servidor entrega a continuação da mesma sequência da
  // mesma semente, a partir de onde CADA pote parou. É a resposta ao jogador
  // preso num setor difícil, que continua matando ondas sem nunca concluir —
  // medido: 39 drops devidos contra 12 no pote, em dez minutos.
  const setorNovo = setorEmMaos !== setor;
  if (!setorNovo && !sim.poteSecou && sim.temLote) return true;

  const token = await tokenValido();
  if (!token) return false;

  /**
   * O que já foi coletado SOBE antes de pedir o próximo pote.
   *
   * Desde 09/09 é o CURSOR do servidor que decide quais itens entregar — e o
   * cursor só anda quando a coleta chega lá. Pedir com a fila cheia devolveria
   * os mesmos itens que o jogador acabou de pegar, e o cliente os mostraria
   * duas vezes: peça duplicada na mochila, e a segunda sumindo depois.
   *
   * É a mesma disciplina que a fusão já usa, e pelo mesmo motivo: quando os
   * dois lados precisam concordar sobre o mesmo número, quem tem a informação
   * mais nova fala primeiro.
   */
  await drenarInventario(sim);

  buscando = true;
  try {
    const r = await fetch(`${API_URL}/lote`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        setor,
        sorte: sim.stats.sorte,
        universo: sim.state.universe.index,
      }),
    });
    if (!r.ok) { await relatarFalha('/lote', 'fundo', r); return false; }
    const dados = (await r.json()) as Resposta;
    relatarSucesso('/lote', dados);
    sim.receberLote(dados.lote as never);
    setorEmMaos = setor;
    return true;
  } catch {
    // Rede fora não é erro de jogo: o pote atual continua valendo, e o que
    // faltar fica devendo até a próxima tentativa.
    await relatarFalha('/lote', 'fundo', null);
    return false;
  } finally {
    buscando = false;
  }
}

/** Esquece o lote ao trocar de conta, para o loot de um não cair no outro. */
export function esquecerLote(): void {
  setorEmMaos = 0;
}
