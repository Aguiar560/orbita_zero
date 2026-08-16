/**
 * Medição de balanceamento — a régua, sem a interface.
 *
 * Importa os mesmos módulos de `sim/` e `data/` que o navegador importa. Eles
 * são TypeScript puro, sem DOM e sem canvas, então a mesma função que decide o
 * dano no jogo decide o dano aqui: não há cópia da fórmula, e por isso a
 * medição não pode divergir do jogo real.
 *
 * Separado do CLI (`tools/simular.ts`) porque os testes também consomem isto, e
 * importar um arquivo que executa `process.argv` no topo faria o `vitest`
 * disparar o comando de ajuda a cada suíte.
 */
import { Rng } from '@core/math';
import { HULLS } from '@data/hulls';
import { rollItem } from '@sim/loot';
import { sectorDamage, sectorHp, sectorIlvl } from '@sim/progression';
import { dps, effectiveHp, powerScore, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import { SLOT_IDS, type GameState } from '@sim/types';

/** Faixa saudável fixada na auditoria da FASE 0. */
export const FAIXA_SEGUNDOS = [6, 50] as const;
export const FAIXA_GOLPES = [8, 30] as const;

/**
 * Jogador "bem equipado" para um nível de item.
 *
 * Melhor de `tentativas` rolagens por slot, não uma rolagem só: o jogo é idle e
 * o jogador acumula drops por horas antes de avançar de setor, então a rolagem
 * média subestima grosseiramente o poder real que ele leva para o combate.
 */
export function equiparMelhor(
  ilvl: number,
  hullId: string,
  semente: number,
  tentativas = 40,
): GameState {
  const st = createState(semente);
  st.hull = hullId;
  const rng = new Rng(semente);

  for (const slot of SLOT_IDS) {
    let melhor = null;
    let melhorNota = -Infinity;
    for (let i = 0; i < tentativas; i++) {
      const item = rollItem(rng, ilvl, 0.3, 0, { slot });
      const sonda: GameState = { ...st, equipped: { ...st.equipped, [slot]: item } };
      const nota = powerScore(resolveStats(sonda));
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = item;
      }
    }
    if (melhor) st.equipped[slot] = melhor;
  }
  return st;
}

/** Melhor casco liberado num setor, pelo tier. */
export function cascoDoSetor(setor: number) {
  return [...HULLS]
    .filter((h) => h.requiresSector <= setor)
    .sort((a, b) => b.tier - a.tier)[0]!;
}

export interface MedidaDeSetor {
  setor: number;
  casco: string;
  dps: number;
  ehp: number;
  hpDaOnda: number;
  danoInimigo: number;
  /** Segundos para limpar a onda. É aqui que o ritmo do jogo aparece. */
  segParaLimpar: number;
  /** Quantos golpes o jogador aguenta. É aqui que a letalidade aparece. */
  golpesAteMorrer: number;
}

export function medirSetor(setor: number): MedidaDeSetor {
  const casco = cascoDoSetor(setor);
  const estado = equiparMelhor(sectorIlvl(setor), casco.id, 1000 + setor);
  const stats = resolveStats(estado);
  const d = dps(stats);
  const ehp = effectiveHp(stats);

  return {
    setor,
    casco: casco.id,
    dps: d,
    ehp,
    hpDaOnda: sectorHp(setor),
    danoInimigo: sectorDamage(setor),
    segParaLimpar: sectorHp(setor) / d,
    golpesAteMorrer: ehp / sectorDamage(setor),
  };
}

export function diagnostico(m: MedidaDeSetor): string {
  if (m.segParaLimpar < FAIXA_SEGUNDOS[0]) return 'trivial';
  if (m.segParaLimpar > FAIXA_SEGUNDOS[1]) return 'IMPOSSÍVEL';
  if (m.golpesAteMorrer < FAIXA_GOLPES[0]) return 'letal demais';
  if (m.golpesAteMorrer > FAIXA_GOLPES[1]) return 'sem ameaça';
  return 'ok';
}

/** Crescimento composto por setor entre duas medidas. */
export function taxaComposta(inicio: number, fim: number, setores: number): number {
  return Math.pow(fim / inicio, 1 / setores);
}

/**
 * Divergência entre a curva do inimigo e a do jogador.
 *
 * É o número que define o ritmo do jogo, e o achado central da FASE 0 foi
 * justamente que ninguém o havia calculado: as duas curvas moram em arquivos
 * diferentes, com expoentes escolhidos de forma independente.
 */
export function divergencia(a: MedidaDeSetor, b: MedidaDeSetor) {
  const span = b.setor - a.setor;
  const rDps = taxaComposta(a.dps, b.dps, span);
  const rHp = taxaComposta(a.hpDaOnda, b.hpDaOnda, span);
  const rEhp = taxaComposta(a.ehp, b.ehp, span);
  const rDano = taxaComposta(a.danoInimigo, b.danoInimigo, span);

  return {
    span,
    rDps, rHp, rEhp, rDano,
    ofensiva: rHp / rDps,
    ofensivaAcumulada: Math.pow(rHp / rDps, span),
    defensiva: rDano / rEhp,
    defensivaAcumulada: Math.pow(rDano / rEhp, span),
  };
}
