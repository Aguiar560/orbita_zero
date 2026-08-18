import { Rng } from '@core/math';
import { rollItem, scoreItem } from '@sim/loot';
import { dps, effectiveHp, resolveStats } from '@sim/stats';
import { sectorDamage, sectorHp, sectorIlvl } from '@sim/progression';
import { createState } from '@sim/state';
import { BASE_BY_ID } from '@data/items';
import { SLOT_IDS } from '@sim/types';
import { RARITIES } from '@data/rarity';
import { cascoDoSetor } from './lib/balanco';

/**
 * Gera os conjuntos UMA vez e reavalia com escadas diferentes.
 *
 * `resolveStats` lê o `power` da tabela, então trocar a escada exigiria mexer no
 * módulo a cada tentativa. Em vez disso, o implícito é recalculado aqui com o
 * multiplicador candidato — a mesma conta de `resolveStats`, aplicada por fora.
 */
const conjuntos = new Map<string, ReturnType<typeof createState>>();
function conjunto(setor: number, raridade: number) {
  const chave = `${setor}:${raridade}`;
  const guardado = conjuntos.get(chave);
  if (guardado) return guardado;
  const ilvl = sectorIlvl(setor);
  const st = createState(4242);
  st.hull = cascoDoSetor(setor).id;
  const rng = new Rng(4242 + setor * 31 + raridade);
  for (const slot of SLOT_IDS) {
    let melhor = null, nota = -Infinity;
    for (let i = 0; i < 20; i++) {
      const it = rollItem(rng, ilvl, 0, 0, { slot, exata: raridade as never });
      const n = scoreItem(st, it);
      if (n > nota) { nota = n; melhor = it; }
    }
    if (melhor) st.equipped[slot] = melhor;
  }
  conjuntos.set(chave, st);
  return st;
}

/** Mede com um multiplicador de implícito arbitrário, sem tocar na tabela. */
function medir(setor: number, raridade: number, mult: number) {
  const st = conjunto(setor, raridade);
  // Reaplica o implícito com o multiplicador candidato, cancelando o da tabela.
  const atual = RARITIES[raridade]!.power / 4.9;
  const fator = mult / atual;
  const clone = { ...st, equipped: { ...st.equipped } };
  const s = resolveStats(clone);
  // O implícito entra em `add` do atributo da base; escalar o resultado inteiro
  // seria grosseiro, então reconstrói-se o delta do implícito.
  let deltaDano = 0, deltaVida = 0, deltaEscudo = 0;
  for (const it of Object.values(clone.equipped)) {
    if (!it) continue;
    const b = BASE_BY_ID.get(it.baseId);
    if (!b) continue;
    const cont = b.implicit.per * it.ilvl * atual * (fator - 1);
    if (b.implicit.kind !== 'add') continue;
    if (b.implicit.stat === 'dano') deltaDano += cont;
    if (b.implicit.stat === 'vida') deltaVida += cont;
    if (b.implicit.stat === 'escudo') deltaEscudo += cont;
  }
  const ajustado = { ...s, dano: s.dano + deltaDano, vida: s.vida + deltaVida, escudo: s.escudo + deltaEscudo };
  return {
    seg: sectorHp(setor) / dps(ajustado),
    golpes: effectiveHp(ajustado) / sectorDamage(setor),
  };
}

function paredeDe(raridade: number, mult: number): number {
  for (let setor = 4; setor <= 300; setor += 4) {
    const m = medir(setor, raridade, mult);
    if (m.seg > 150 || m.golpes < 8) return setor;
  }
  return 400;
}

const alvos = [20, 45, 90, 200, 260, 300, 400];
console.log('  k    ' + RARITIES.map((r) => r.name.slice(0, 4).padStart(6)).join(''));
console.log('alvo   ' + alvos.map((a) => String(a === 400 ? '>300' : a).padStart(6)).join(''));
for (const k of [1.35, 1.5, 1.65, 1.8, 2.0]) {
  const paredes = RARITIES.map((_, r) => paredeDe(r, Math.pow(k, r - 5)));
  const erro = paredes.reduce((s, p, i) => s + Math.abs(p - alvos[i]!) / alvos[i]!, 0) / 7;
  console.log(k.toFixed(2).padStart(5), ' ' +
    paredes.map((p) => String(p >= 400 ? '>300' : p).padStart(6)).join(''),
    `  erro ${(erro * 100).toFixed(0)}%`);
}
