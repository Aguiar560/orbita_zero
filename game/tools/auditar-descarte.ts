import { Rng } from '@core/math';
import { retornoDeDesmanche, valorDeVenda } from '@data/balance/descarte';
import { RARITIES } from '@data/rarity';
import { rollItem } from '@sim/loot';
import type { Rarity } from '@sim/types';

const NIVEIS = [1, 50, 100, 200, 270] as const;
const AMOSTRAS = 101;

function mediana(valores: number[]): number {
  valores.sort((a, b) => a - b);
  return valores[Math.floor(valores.length / 2)] ?? 0;
}

console.log('Órbita Zero · auditoria de venda e desmontagem');
console.log(`Mediana de ${AMOSTRAS} itens por célula\n`);

for (const ilvl of NIVEIS) {
  const linhas = RARITIES.map((info) => {
    const rng = new Rng(80_000 + ilvl * 101 + info.id * 7_919);
    const vendas: number[] = [];
    const principais: number[] = [];
    const secundarios: number[] = [];
    let nomes = '';

    for (let i = 0; i < AMOSTRAS; i++) {
      const item = rollItem(rng, ilvl, 0, 0, { exata: info.id as Rarity });
      vendas.push(valorDeVenda(item));
      const materiais = retornoDeDesmanche(item).materiais;
      const entradas = Object.entries(materiais);
      nomes = entradas.map(([id]) => id).join(' + ');
      principais.push(entradas[0]?.[1] ?? 0);
      secundarios.push(entradas[1]?.[1] ?? 0);
    }

    return {
      raridade: info.name,
      sucata: mediana(vendas),
      materiais: nomes,
      principal: mediana(principais),
      secundario: mediana(secundarios),
    };
  });
  console.log(`Nível de item ${ilvl}`);
  console.table(linhas);
}
