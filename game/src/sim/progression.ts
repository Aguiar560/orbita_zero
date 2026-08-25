import { Rng } from '@core/math';
import { bossForSector, isBossSector, type BossDef } from '@data/bosses';
import { enemiesForSector, type EnemyDef } from '@data/enemies';
import {
  CHEFE_BONUS_RECOMPENSA, CHEFE_CICLO, CHEFE_EXIGENCIA, CHEFE_ONDAS, ELITE_ONDAS, PERFIS_DE_ONDA,
  RECOMPENSA_FRACAO, WAVES_PER_SECTOR, curvaDano, curvaHp, curvaIlvl, curvaRecompensa,
  densidadeAlvo, densidadeParaXp, pressaoAlvo,
} from '@data/balance/curvas';
import { INIMIGOS_POR_GRUPO_MAX, INIMIGOS_POR_ONDA_MAX } from '@data/balance/limites';
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
  /**
   * Vida total do encontro. As entidades dividem esse bolo.
   *
   * Continua DIMENSIONANDO os inimigos — é dele que sai a vida de cada nave —,
   * mas não é mais o medidor de progresso: quem mede é `unidades`.
   */
  hpPool: number;
  /** Quantos inimigos precisam ser abatidos para o encontro acabar. */
  unidades: number;
  /**
   * Quantos abates esta onda PAGA de XP, independente de em quantos inimigos
   * ela vem. E a contagem que a onda teria com a densidade antiga.
   *
   * Existe porque a XP por abate e fixa por inimigo: sem isto, adensar a onda
   * multiplicaria a progressao junto. `rewardKill` divide um orcamento em
   * vez de pagar por cabeca, e o total da onda fica identico ao de antes —
   * exatamente, nao por aproximacao.
   */
  abatesDeReferencia: number;
  /** Composição da onda: tipos e quantidades. */
  squad: { def: EnemyDef; count: number }[];
  boss: BossDef | null;
  /** Dano de um golpe inimigo neste encontro, em valor absoluto. */
  damage: number;
  /** Multiplicador de cadência dos inimigos — o eixo de "quantos tiros". */
  pressao: number;
  /** Nome do perfil da onda, para o aviso na tela. */
  perfil: string;
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
  const ilvl = sectorIlvl(sector);

  if (boss) {
    // Chefes ciclam a lista; a cada volta ficam mais duros.
    const cycle = Math.floor((sector / 10 - 1) / 10);
    const cycleMult = Math.pow(CHEFE_CICLO, cycle);
    // `boss.hp` é identidade (1,0 a 2,0), não escalada: quem escala com o setor
    // é `baseHp`, que já embute o tempo-alvo.
    const hpPool = baseHp * CHEFE_ONDAS * CHEFE_EXIGENCIA * boss.hp * cycleMult;
    return {
      sector, wave, kind, boss,
      hpPool,
      // O chefe é uma unidade só: o encontro acaba quando ele cai.
      unidades: 1,
      abatesDeReferencia: 1,
      squad: [],
      damage: baseDamage * boss.dano * CHEFE_EXIGENCIA,
      // O chefe tem cadência própria por fase; a pressão do setor não se aplica.
      pressao: 1,
      perfil: 'Chefe',
      // Proporcional à vida que o chefe realmente tem, mais um bônus pelo feito.
      // Antes era `bounty × boss.reward`, com reward de 30 a 200 — números que
      // vinham de quando a recompensa era uma exponencial própria.
      bounty: RECOMPENSA_FRACAO * hpPool * CHEFE_BONUS_RECOMPENSA,
      ilvl: ilvl + 6,
    };
  }

  const elite = kind === 'elite';
  const pool = enemiesForSector(sector, elite);
  const fallback = enemiesForSector(sector, false);
  const usable = pool.length ? pool : fallback;

  // O perfil decide a CARA da onda: enxame, pelotão, vanguarda ou fuzilaria.
  // Elites têm perfil próprio — poucos, duros e agressivos, por definição.
  const perfil = elite
    ? { id: 'elite', nome: 'Elite', densidade: 0.3, pressao: 1.3, tipos: [1, 2] as const, peso: 0 }
    : rng.weighted(PERFIS_DE_ONDA, (p) => p.peso);

  const typeCount = Math.min(usable.length, rng.int(perfil.tipos[0], perfil.tipos[1]));
  const chosen: EnemyDef[] = [];
  for (let i = 0; i < typeCount; i++) {
    const pick = rng.weighted(
      usable.filter((e) => !chosen.includes(e)),
      (e) => e.weight,
    );
    if (pick) chosen.push(pick);
  }
  if (elite && fallback.length) chosen.push(rng.weighted(fallback, (e) => e.weight));

  const waveHp = baseHp * (elite ? ELITE_ONDAS : 1) * (0.85 + wave * 0.06);

  /**
   * A contagem é ALVO e a vida por unidade é derivada — inversão igual à da
   * dificuldade. Antes era o contrário: a vida por unidade era fixa em
   * `baseHp × def.hp × 0,16` e a contagem saía da divisão. Como as duas
   * parcelas escalavam com `baseHp`, ela se cancelava e TODA onda do jogo tinha
   * o mesmo número de inimigos, do setor 1 ao 300.
   */
  const alvo = Math.min(
    INIMIGOS_POR_ONDA_MAX,
    Math.max(1, Math.round(densidadeAlvo(sector) * perfil.densidade)),
  );
  // A referencia de XP acompanha o PERFIL tambem: hoje uma onda de enxame paga
  // mais XP que uma de vanguarda porque tem mais cabecas, e adensar nao pode
  // apagar essa diferenca sem querer.
  const abatesDeReferencia = Math.max(1, Math.round(densidadeParaXp(sector) * perfil.densidade));
  const totalWeight = chosen.reduce((s, e) => s + e.hp, 0) || 1;

  const squad = chosen.map((def) => {
    // Um inimigo "pesado" ocupa mais do orçamento de contagem que um leve, para
    // uma onda de encouraçados não virar um enxame de encouraçados.
    const share = def.hp / totalWeight;
    const count = Math.max(1, Math.round(alvo * share));
    return { def, count: Math.min(INIMIGOS_POR_GRUPO_MAX, count) };
  });

  // A contagem REAL, depois do teto por grupo e dos arredondamentos. É ela que
  // divide a pressão e a XP — usar o alvo teórico deixaria as duas erradas
  // justamente nas ondas que bateram no teto.
  const alvoFinal = squad.reduce((s, g) => s + g.count, 0);

  return {
    sector, wave, kind, boss: null,
    hpPool: waveHp,
    unidades: alvoFinal,
    abatesDeReferencia,
    squad,
    damage: baseDamage,
    // A pressão do setor, temperada pelo perfil, é o que faz uma onda de poucos
    // inimigos ser tão perigosa quanto uma de muitos.
    //
    // E é dividida pelo adensamento pelo mesmo motivo que a XP: ela é cadência
    // POR INIMIGO, e a onda passou a ter dez vezes mais cabeças. Sem dividir, o
    // adensamento multiplicaria por dez os projéteis em tela — o jogador pediu
    // mais alvos, não uma parede de tiro. O que a onda cospe por segundo
    // continua sendo o que cuspia antes; o que muda é em quantas bocas.
    pressao: pressaoAlvo(sector) * perfil.pressao * (abatesDeReferencia / Math.max(1, alvoFinal)),
    perfil: perfil.nome,
    bounty: RECOMPENSA_FRACAO * waveHp,
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
