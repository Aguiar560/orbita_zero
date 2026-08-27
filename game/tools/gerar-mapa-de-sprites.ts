import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { HULLS } from '@data/hulls';
import { ALL_ENEMIES } from '@data/enemies';
import { BOSSES } from '@data/bosses';

/**
 * Escreve o mapa `id da nave` → `chave no atlas`, para o pipeline consultar.
 *
 * ## Por que um arquivo no meio do caminho
 *
 * A ligação identidade↔arte mora em `data/`, que é TypeScript. O pipeline de
 * assets é `.mjs` e roda antes de qualquer build — ele não importa aquele
 * mundo, e carregar TypeScript ali dentro só para ler três tabelas seria mais
 * máquina do que o problema pede.
 *
 * A alternativa que existia era pior: uma tabela escrita à mão ligando arquivo
 * a chave de atlas, com entradas do tipo `'vespa_ambar.png': 's2/enemy/d_5'`.
 * Funciona para duas trocas. Para cem, exige descobrir a chave de cada uma —
 * e `d_5` não é descobrível, é procurável.
 *
 * Com este mapa, trocar a arte de uma nave é largar um PNG chamado com o ID
 * dela em `art-source/naves/`. O nome do arquivo passa a ser a única coisa que
 * precisa estar certa, e ele é legível.
 *
 * ## Por que gerado e não versionado à mão
 *
 * Nave nova entra em `data/` e o mapa a inclui na próxima geração. Um arquivo
 * mantido à mão envelheceria em silêncio, e o sintoma seria uma arte que não
 * substitui nada sem dizer por quê.
 */

const raiz = path.resolve(import.meta.dirname, '..');

interface Entrada {
  id: string;
  sprite: string;
  papel: 'jogador' | 'inimigo' | 'chefe';
  nome: string;
  /** Decide o pareamento por cor em `preparar-naves.mjs`. */
  elemento: string;
}

const entradas: Entrada[] = [
  ...HULLS.map((h) => ({ id: h.id, sprite: h.sprite, papel: 'jogador' as const, nome: h.name, elemento: h.element })),
  ...ALL_ENEMIES.map((e) => ({ id: e.id, sprite: e.sprite, papel: 'inimigo' as const, nome: e.name, elemento: e.element })),
  ...BOSSES.map((b) => ({ id: b.id, sprite: b.sprite, papel: 'chefe' as const, nome: b.name, elemento: b.element })),
].filter((x): x is Entrada => !!x.sprite);

// Um id pode aparecer duas vezes se alguém repetir — avisa em vez de perder.
const vistos = new Map<string, Entrada>();
const repetidos: string[] = [];
for (const e of entradas) {
  if (vistos.has(e.id)) repetidos.push(e.id);
  else vistos.set(e.id, e);
}

const mapa = Object.fromEntries([...vistos.values()].map((e) => [e.id, {
  sprite: e.sprite, papel: e.papel, nome: e.nome, elemento: e.elemento,
}]));

const saida = path.join(raiz, 'tools', 'mapa-de-sprites.json');
writeFileSync(saida, `${JSON.stringify(mapa, null, 2)}\n`);

const porPapel = { jogador: 0, inimigo: 0, chefe: 0 };
for (const e of vistos.values()) porPapel[e.papel]++;
const chaves = new Set([...vistos.values()].map((e) => e.sprite));

console.log('\n▸ mapa de sprites');
console.log(`  jogador   ${String(porPapel.jogador).padStart(4)}`);
console.log(`  inimigo   ${String(porPapel.inimigo).padStart(4)}`);
console.log(`  chefe     ${String(porPapel.chefe).padStart(4)}`);
console.log(`  ${'-'.repeat(20)}`);
console.log(`  ids       ${String(vistos.size).padStart(4)}`);
console.log(`  sprites   ${String(chaves.size).padStart(4)}  (menos que ids = arte compartilhada)`);
if (repetidos.length) console.log(`  ⚠ ids repetidos: ${repetidos.join(', ')}`);
console.log(`  em        ${path.relative(raiz, saida)}\n`);
