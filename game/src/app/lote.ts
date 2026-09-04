import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';

import { tokenValido } from './conta';

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
  lote: Record<TipoDeDrop, unknown[]>;
  porPool: number;
}

let setorEmMaos = 0;
let pagina = 0;
let buscando = false;

/**
 * Busca o lote do setor, se ainda não temos o dele.
 *
 * Idempotente por setor: pedir o mesmo de novo devolve o MESMO lote (é o
 * servidor que garante), então chamar à toa custa uma requisição e nada mais.
 */
export async function garantirLote(sim: Sim, setor: number): Promise<boolean> {
  if (buscando) return false;

  // Setor novo recomeça na página 0; pote seco no MESMO setor avança uma.
  //
  // Paginar não é re-rolar: a página seguinte é a continuação da mesma
  // sequência da mesma semente, então pedi-la de novo dá sempre o mesmo
  // resultado. É a resposta ao jogador preso num setor difícil, que continua
  // matando ondas sem nunca concluir — medido: 39 drops devidos contra 12 no
  // pote, em dez minutos.
  const setorNovo = setorEmMaos !== setor;
  if (setorNovo) pagina = 0;
  else if (sim.poteSecou) pagina++;
  else if (sim.temLote) return true;

  const token = await tokenValido();
  if (!token) return false;

  buscando = true;
  try {
    const r = await fetch(`${API_URL}/lote`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        setor,
        pagina,
        sorte: sim.stats.sorte,
        universo: sim.state.universe.index,
      }),
    });
    if (!r.ok) return false;
    const dados = (await r.json()) as Resposta;
    sim.receberLote(dados.lote as never);
    setorEmMaos = setor;
    return true;
  } catch {
    // Rede fora não é erro de jogo: o pote atual continua valendo, e o que
    // faltar fica devendo até a próxima tentativa.
    return false;
  } finally {
    buscando = false;
  }
}

/** Esquece o lote ao trocar de conta, para o loot de um não cair no outro. */
export function esquecerLote(): void {
  setorEmMaos = 0;
  pagina = 0;
}
