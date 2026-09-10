import type { OfflineReport } from './index';
import { RESOURCE_IDS, type ResourceId } from './types';

/**
 * O que a ausência deu e o que ela tirou, SEPARADOS.
 *
 * ## Por que existe
 *
 * O servidor devolve números LÍQUIDOS — saldo depois menos saldo antes. Um
 * líquido esconde a metade da história que mais importa: a nave que depositou
 * 5.000 de sucata e pagou 5.000 de multa aparece como zero, e zero se lê como
 * "não aconteceu nada". Foi o que se mediu em 10/09: 41 quedas, 7.297 de
 * sucata tirada do cofre e XP perdido, e o relatório mostrou "3,21K abates".
 *
 * O bruto sai do líquido somado ao que as quedas levaram — as perdas vêm
 * contadas uma a uma pela simulação, então a conta fecha sem estimativa.
 *
 * Mora em `sim/` porque é conta, e a UI só desenha o resultado.
 */
export interface BalancoDaAusencia {
  ganhos: {
    xp: number;
    moedas: Record<ResourceId, number>;
    materiais: Record<string, number>;
  };
  perdas: {
    xp: number;
    /** Multa das quedas sobre a sucata do cofre. */
    multa: number;
    /** Carga da incursão que evaporou nas quedas. */
    carga: Record<ResourceId, number>;
    materiais: Record<string, number>;
    /** Nós da Matriz devolvidos por patente perdida. */
    matriz: string[];
  };
  /** O que de fato mudou no saldo e no XP — é o que o topo da tela mostra. */
  liquido: { xp: number; moedas: Record<ResourceId, number> };
  quedas: number;
  patente: { antes: number; depois: number } | null;
  naves: NonNullable<OfflineReport['naves']>;
  /** Alguma coisa saiu? Decide se o relatório abre com o aviso vermelho. */
  houvePerda: boolean;
  /** Nada entrou e nada saiu — a frota ficou parada (sem combustível, p. ex.). */
  vazio: boolean;
}

const zeros = (): Record<ResourceId, number> => ({ sucata: 0, nucleo: 0, cristal: 0 });

export function balancoDaAusencia(r: OfflineReport): BalancoDaAusencia {
  const p = r.perdas;
  const multa = Math.max(0, Math.trunc(p?.multa ?? 0));
  const xpPerdido = Math.max(0, p?.xpPiloto ?? 0);
  const xpLiquido = r.xp ?? 0;

  const moedasGanhas = zeros();
  const carga = zeros();
  const liquido = zeros();
  for (const id of RESOURCE_IDS) {
    const l = Math.trunc(r.gained[id] ?? 0);
    liquido[id] = l;
    // A multa já está descontada do líquido; somá-la de volta é o que
    // separa o que entrou do que saiu.
    moedasGanhas[id] = Math.max(0, l + (id === 'sucata' ? multa : 0));
    carga[id] = Math.max(0, Math.trunc(p?.carga?.[id] ?? 0));
  }

  const matGanhos: Record<string, number> = {};
  const matPerdidos: Record<string, number> = {};
  for (const [id, d] of Object.entries(r.materiais ?? {})) {
    if (d > 0) matGanhos[id] = d;
    else if (d < 0) matPerdidos[id] = -d;
  }

  const patente = r.patente && r.patente.depois !== r.patente.antes ? r.patente : null;
  const naves = r.naves ?? [];
  const quedas = r.quedas ?? 0;

  const perdas = {
    xp: xpPerdido, multa, carga, materiais: matPerdidos, matriz: [...(p?.matriz ?? [])],
  };
  const houvePerda = quedas > 0 || multa > 0 || xpPerdido > 0
    || RESOURCE_IDS.some((id) => carga[id] > 0)
    || Object.keys(matPerdidos).length > 0
    || (patente !== null && patente.depois < patente.antes)
    || naves.some((n) => n.depois < n.antes || n.xp < 0);

  const ganhos = { xp: Math.max(0, xpLiquido + xpPerdido), moedas: moedasGanhas, materiais: matGanhos };
  const houveGanho = ganhos.xp > 0
    || RESOURCE_IDS.some((id) => moedasGanhas[id] > 0)
    || Object.keys(matGanhos).length > 0;

  return {
    ganhos,
    perdas,
    liquido: { xp: xpLiquido, moedas: liquido },
    quedas,
    patente,
    naves,
    houvePerda,
    vazio: !houvePerda && !houveGanho && r.kills <= 0,
  };
}
