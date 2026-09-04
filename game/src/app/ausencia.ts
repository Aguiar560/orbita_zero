import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';
import type { OfflineReport } from '@sim/index';

import { tokenValido } from './conta';

/**
 * O crédito de ausência, que agora é calculado pelo servidor.
 *
 * ## O que mudou de dono
 *
 * O CÁLCULO. `sim.applyOffline` rodava aqui e o resultado subia como ganho
 * declarado — era o maior buraco que sobrava depois da Fase 4, e a medição
 * registrada no PLANO mostra o tamanho: offline rendia **368 itens contra 44**
 * do jogo ao vivo no mesmo trecho.
 *
 * ## O cliente não diz quanto tempo ficou fora
 *
 * É a peça central, e é o que torna esta rota diferente de tudo que veio antes.
 * A ausência sai da diferença entre agora e o último carimbo que o SERVIDOR
 * gravou. Alegar dez horas depois de cinco minutos não funciona porque ninguém
 * pergunta ao cliente — não há campo para mentir.
 *
 * ## Por que não há recuo para o cálculo local
 *
 * Seria a saída óbvia para "servidor fora", e devolveria o buraco inteiro:
 * bastaria bloquear a requisição para voltar a calcular a própria recompensa.
 *
 * E não é preciso. O carimbo do servidor só anda quando ele CREDITA, então uma
 * tentativa que falha não perde nada: a ausência continua contando, e o crédito
 * acontece na próxima conexão que der certo. Quem ficou sem rede recebe atrasado,
 * não recebe a menos.
 */

export interface RelatorioDeAusencia {
  segundos: number;
  limitado?: boolean;
  ganhou?: OfflineReport['gained'];
  setores?: number;
  abates?: number;
  baus?: number;
  xp?: number;
  itensNovos?: number;
  motivo?: string;
}

/**
 * Pede ao servidor que credite a ausência.
 *
 * Devolve `null` quando não deu para falar com ele — e quem chama NÃO deve
 * calcular por conta própria nesse caso, pelo motivo no cabeçalho.
 */
export async function creditarAusencia(sim: Sim): Promise<RelatorioDeAusencia | null> {
  const token = await tokenValido();
  if (!token) return null;

  try {
    const r = await fetch(`${API_URL}/ausencia`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      // Só contexto de cena. Nada aqui decide poder, e o que poderia ser
      // abusado — casco e setor — é aparado no servidor contra o que ele sabe.
      body: JSON.stringify({
        hull: sim.state.hull,
        setor: sim.state.run.sector,
        onda: sim.state.run.wave,
        postura: sim.state.settings.pilot,
      }),
    });
    if (!r.ok) return null;
    return (await r.json()) as RelatorioDeAusencia;
  } catch {
    return null;
  }
}
