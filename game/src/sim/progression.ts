import { Rng } from '@core/math';
import { bossForSector, isBossSector, type BossDef } from '@data/bosses';
import { enemiesForSector, type EnemyDef } from '@data/enemies';
import {
  WAVES_PER_SECTOR, curvaDano, curvaHp, curvaIlvl, curvaRecompensa,
} from '@data/balance/curvas';
import type { EncounterKind, GameState } from './types';

/**
 * As curvas moram em `data/balance/curvas.ts`; aqui ficam só os apelidos que o
 * resto do jogo já usava. A indireção não é cerimônia: é o que permite mexer no
 * ritmo do jogo num arquivo só, em vez de caçar expoentes por sete.
 */
export { WAVES_PER_SECTOR };

export const sectorHp = curvaHp;
export const sectorDamage = curvaDano;
export const sectorBounty = curvaRecompensa;
export const sectorIlvl = curvaIlvl;

export interface Encounter {
  sector: number;
  wave: number;
  kind: EncounterKind;
  /** Vida total do encontro. As entidades da camada vertical dividem esse bolo. */
  hpPool: number;
  /** Composição da onda: tipos e quantidades. */
  squad: { def: EnemyDef; count: number }[];
  boss: BossDef | null;
  /** Dano de um golpe inimigo neste encontro, em valor absoluto. */
  damage: number;
  bounty: number;
  ilvl: number;
}

/**
 * Monta o encontro atual.
 *
 * A composição é derivada de uma semente estável (universo + setor + onda), o
 * que garante que sair e voltar ao jogo não reembaralhe a onda em andamento e
 * que a simulação offline chegue no mesmo resultado do combate ao vivo.
 */
export function buildEncounter(state: GameState, sector: number, wave: number): Encounter {
  const { seed } = state.universe;
  const rng = new Rng((seed ^ (sector * 0x27d4eb2d) ^ (wave * 0x165667b1)) >>> 0);

  const baseDamage = sectorDamage(sector);

  const isFinal = wave > WAVES_PER_SECTOR;
  const boss = isFinal && isBossSector(sector) ? bossForSector(sector) : null;
  const kind: EncounterKind = boss ? 'chefe' : isFinal ? 'elite' : 'onda';

  const baseHp = sectorHp(sector);
  const bounty = sectorBounty(sector);
  const ilvl = sectorIlvl(sector);

  if (boss) {
    // Chefes ciclam a lista; a cada volta ficam substancialmente mais duros.
    const cycle = Math.floor((sector / 10 - 1) / 10);
    const cycleMult = Math.pow(2.6, cycle);
    return {
      sector, wave, kind, boss,
      hpPool: baseHp * boss.hp * cycleMult,
      squad: [],
      damage: baseDamage * boss.dano,
      bounty: bounty * boss.reward,
      ilvl: ilvl + 6,
    };
  }

  const elite = kind === 'elite';
  const pool = enemiesForSector(sector, elite);
  const fallback = enemiesForSector(sector, false);
  const usable = pool.length ? pool : fallback;

  // Ondas normais: 2–3 tipos. Elites: 1 tipo forte + escolta.
  const typeCount = elite ? 1 : Math.min(usable.length, rng.int(2, 3));
  const chosen: EnemyDef[] = [];
  for (let i = 0; i < typeCount; i++) {
    const pick = rng.weighted(
      usable.filter((e) => !chosen.includes(e)),
      (e) => e.weight,
    );
    if (pick) chosen.push(pick);
  }
  if (elite && fallback.length) chosen.push(rng.weighted(fallback, (e) => e.weight));

  const waveHp = baseHp * (elite ? 3.2 : 1) * (0.85 + wave * 0.06);
  const totalWeight = chosen.reduce((s, e) => s + e.hp, 0) || 1;

  const squad = chosen.map((def, i) => {
    const share = def.hp / totalWeight;
    const budget = waveHp * share;
    const perUnit = baseHp * def.hp * 0.16;
    const count = Math.max(1, Math.round(budget / Math.max(1, perUnit)));
    // Elites nunca vêm em bando; o slot de escolta pode.
    return { def, count: elite && i === 0 ? Math.min(count, 3) : Math.min(count, 26) };
  });

  return {
    sector, wave, kind, boss: null,
    hpPool: waveHp,
    squad,
    damage: baseDamage,
    bounty: bounty * (elite ? 3.2 : 1),
    ilvl: elite ? ilvl + 2 : ilvl,
  };
}

/** Vida individual de um inimigo dentro de um encontro. */
export function unitHp(encounter: Encounter, def: EnemyDef): number {
  const totalUnits = encounter.squad.reduce((s, e) => s + e.count * e.def.hp, 0) || 1;
  return (encounter.hpPool * def.hp) / totalUnits;
}

/** Rótulo curto do encontro para a HUD. */
export function encounterLabel(e: Encounter): string {
  if (e.kind === 'chefe') return e.boss?.name ?? 'Chefe';
  if (e.kind === 'elite') return 'Guarda de Elite';
  return `Onda ${e.wave}/${WAVES_PER_SECTOR}`;
}
