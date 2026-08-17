import { Rng } from '@core/math';
import { AFFIXES, SLOTS } from '@data/items';
import { rollItem } from '@sim/loot';
import type { FamiliaDeAfixo } from '@data/items';
import type { SlotId } from '@sim/types';

/**
 * Quanto do que cai em cada slot é do TEMA daquele slot (§7).
 *
 * A pergunta que o número responde: "uma blindagem parece uma blindagem?".
 * Sem afinidade, todo slot rola do mesmo bolo e nove peças diferentes viram a
 * mesma peça com nomes diferentes.
 *
 * ► `controle` marca baixo de propósito, e é limitação do MEDIDOR, não do jogo.
 *   A tabela abaixo obriga cada slot a ter UM tema, e o de controle é
 *   genuinamente misto: o `hint` dele é "precisão e sincronia com o piloto de
 *   IA", ou seja, chance de crítico (ofensiva) e sincronia (utilidade) ao mesmo
 *   tempo. Contar só uma das duas como "no tema" joga a outra metade fora.
 */
const TEMA: Record<SlotId, FamiliaDeAfixo> = {
  asas: 'defensiva', principal: 'ofensiva', secundaria: 'ofensiva',
  motor: 'defensiva', reator: 'ofensiva', controle: 'utilidade',
  escudo: 'defensiva', blindagem: 'defensiva', suporte: 'utilidade',
};

const familiaDe = new Map(AFFIXES.map((a) => [a.id, a.familia]));
const rng = new Rng(90210);

console.log('slot          no tema   fora');
console.log('───────────  ────────  ─────');
let somaNoTema = 0;
for (const slot of SLOTS) {
  let noTema = 0; let total = 0;
  for (let i = 0; i < 4000; i++) {
    for (const a of rollItem(rng, 200, 4, 0, { slot: slot.id }).affixes) {
      total++;
      if (familiaDe.get(a.id) === TEMA[slot.id]) noTema++;
    }
  }
  const frac = noTema / Math.max(1, total);
  somaNoTema += frac;
  console.log(`${slot.id.padEnd(11)}  ${(frac * 100).toFixed(1).padStart(7)}%  ${((1 - frac) * 100).toFixed(1).padStart(5)}%`);
}
console.log(`\nmédia no tema: ${((somaNoTema / SLOTS.length) * 100).toFixed(1)}%`);
console.log('Sem afinidade a média fica perto da fração natural da família no bolo.');
