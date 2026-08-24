import { Rng } from '@core/math';
import { AFFIXES, pesoNoSlot, tipoDoAfixo } from '@data/items';
import { rarityInfo } from '@data/rarity';
import type { OperacaoDeModulacaoId } from '@data/balance/modulacao';
import type { Affix, Item } from './types';
import { affixCandidates, recalibrateAffix, rollAffixAtTier } from './loot';

export interface ResultadoDeModulacao {
  operacao: OperacaoDeModulacaoId;
  antes: Affix[];
  depois: Affix[];
}

const copiar = (afixos: readonly Affix[]): Affix[] => afixos.map((a) => ({ ...a }));

function sortearNovaLinha(
  rng: Rng,
  item: Item,
  tipo: 'prefixo' | 'sufixo',
  tier: number,
  ignoreIndex: number | null = null,
): Affix | null {
  const pool = affixCandidates(item, tipo, ignoreIndex);
  if (!pool.length) return null;
  const def = rng.weighted(pool, (a) => pesoNoSlot(a, item.slot));
  return rollAffixAtTier(rng, def, item.ilvl, tier);
}

/** Executa somente a mutação. Cobrança e persistência pertencem ao `Sim`. */
export function aplicarModulacao(
  rng: Rng,
  item: Item,
  operacao: OperacaoDeModulacaoId,
  index: number,
): ResultadoDeModulacao | null {
  const antes = copiar(item.affixes);
  const atual = item.affixes[index];

  if (operacao === 'eco_temporal') {
    if (!item.modulationSnapshot?.length) return null;
    const anterior = copiar(item.modulationSnapshot);
    item.modulationSnapshot = antes;
    item.affixes = anterior;
    return { operacao, antes, depois: copiar(item.affixes) };
  }

  let mudou = false;
  switch (operacao) {
    case 'remoldar': {
      if (!atual || atual.locked) return null;
      const novo = recalibrateAffix(rng, item, index);
      if (!novo) return null;
      item.affixes[index] = novo;
      mudou = true;
      break;
    }
    case 'ancorar': {
      if (!atual) return null;
      atual.locked = !atual.locked;
      mudou = true;
      break;
    }
    case 'lapidar': {
      if (!atual || atual.locked) return null;
      const def = AFFIXES.find((a) => a.id === atual.id);
      if (!def) return null;
      item.affixes[index] = rollAffixAtTier(rng, def, item.ilvl, atual.tier ?? 1);
      mudou = true;
      break;
    }
    case 'dissolver': {
      if (!atual || atual.locked || item.affixes.length <= 1) return null;
      item.affixes.splice(index, 1);
      mudou = true;
      break;
    }
    case 'imprimir_prefixo':
    case 'imprimir_sufixo': {
      if (item.affixes.length >= rarityInfo(item.rarity).afixos) return null;
      const tipo = operacao === 'imprimir_prefixo' ? 'prefixo' : 'sufixo';
      const novo = sortearNovaLinha(rng, item, tipo, 1);
      if (!novo) return null;
      item.affixes.push(novo);
      mudou = true;
      break;
    }
    case 'ascender': {
      if (!atual || atual.locked) return null;
      const tier = atual.tier ?? 1;
      if (tier >= rarityInfo(item.rarity).tierMax) return null;
      const def = AFFIXES.find((a) => a.id === atual.id);
      if (!def) return null;
      item.affixes[index] = rollAffixAtTier(rng, def, item.ilvl, tier + 1);
      mudou = true;
      break;
    }
    case 'transpor': {
      if (!atual || atual.locked) return null;
      const def = AFFIXES.find((a) => a.id === atual.id);
      if (!def) return null;
      const destino = tipoDoAfixo(def) === 'prefixo' ? 'sufixo' : 'prefixo';
      const novo = sortearNovaLinha(rng, item, destino, atual.tier ?? 1, index);
      if (!novo) return null;
      item.affixes[index] = novo;
      mudou = true;
      break;
    }
    case 'primordial': {
      const livres = item.affixes.map((a, i) => ({ a, i })).filter(({ a }) => !a.locked);
      if (!livres.length) return null;
      for (const { a, i } of livres) {
        const def = AFFIXES.find((d) => d.id === a.id);
        if (def) item.affixes[i] = rollAffixAtTier(rng, def, item.ilvl, a.tier ?? 1, 0.75);
      }
      mudou = true;
      break;
    }
  }

  if (!mudou) return null;
  item.modulationSnapshot = antes;
  return { operacao, antes, depois: copiar(item.affixes) };
}
