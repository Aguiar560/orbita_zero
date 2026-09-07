/**
 * Levantamento dos recursos: de onde cada um CAI e onde cada um é GASTO.
 *
 *     npm run recursos            # a tabela inteira
 *     npm run recursos -- orfaos  # só o que está quebrado
 *
 * ## Por que uma ferramenta e não um documento
 *
 * `data/recursos.ts` já DECLARA origem e função de cada material, e ainda diz
 * se cada lado está `ativo` ou `planejado`. Mas isso é texto mantido à mão, e
 * texto mantido à mão envelhece: a receita muda, o evento sai, e a declaração
 * continua afirmando o que era verdade no mês passado.
 *
 * Aqui as duas colunas saem do CÓDIGO que o jogo executa — as mesmas receitas,
 * as mesmas missões, os mesmos eventos que o navegador importa. Rodar de novo
 * depois de mexer no balanço custa dois segundos e não depende de ninguém
 * lembrar de atualizar nada.
 *
 * ## O que conta como fonte, e por quê
 *
 * Só entram os caminhos que REALMENTE creditam material no armazém, rastreados
 * a partir das chamadas de `guardarMaterial` em `sim/index.ts`:
 *
 * - galáxia: o material-assinatura do setor (`quantidadeDeMaterialGalactico`);
 * - chefe: o material do chefe abatido;
 * - evento: o gás do evento ativo;
 * - missão: a recompensa de `materiais`;
 * - desmanche: o retorno de desfazer uma peça.
 *
 * A ausência (offline) não entra como fonte própria: ela credita os MESMOS
 * materiais das fontes acima, com um fator — contá-la duplicaria tudo.
 */

import { RECURSOS, RECURSO_POR_ID } from '@data/recursos';
import { RECEITAS } from '@data/balance/fusao';
import { OPERACOES_DE_MODULACAO } from '@data/balance/modulacao';
import { MISSOES } from '@data/missoes';
import { EVENTOS } from '@data/eventos';
import { BOSSES } from '@data/bosses';
import { describeGalaxy } from '@data/galaxies';

type Lado = Map<string, string[]>;

const somar = (m: Lado, id: string, onde: string): void => {
  const atual = m.get(id) ?? [];
  if (!atual.includes(onde)) atual.push(onde);
  m.set(id, atual);
};

// ── FONTES ──────────────────────────────────────────────────────────────────
const fontes: Lado = new Map();

// Galáxia: um material-assinatura por galáxia, creditado ao limpar setor.
for (const r of RECURSOS) {
  if (r.escopo === 'galaxia' && r.galaxia !== undefined) {
    somar(fontes, r.id, `galáxia ${r.galaxia + 1} (${describeGalaxy(r.galaxia).name})`);
  }
}

// Chefe: o catálogo marca o escopo; a concessão sai de `sim/index.ts:1386`.
for (const r of RECURSOS) {
  if (r.escopo === 'chefe') somar(fontes, r.id, 'chefe abatido');
}

// Provação.
for (const r of RECURSOS) {
  if (r.escopo === 'provacao') somar(fontes, r.id, 'Provação');
}

// Evento: cada evento credita um gás nomeado.
for (const e of EVENTOS) somar(fontes, e.gas, `evento "${e.nome}"`);

// Missão: recompensa em material.
for (const m of MISSOES) {
  for (const id of Object.keys(m.recompensa?.materiais ?? {})) {
    somar(fontes, id, `missão "${m.nome}"`);
  }
}

// ── SUMIDOUROS ──────────────────────────────────────────────────────────────
const usos: Lado = new Map();

for (const r of RECEITAS) {
  for (const id of Object.keys(r.custo)) somar(usos, id, `fusão · ${r.nome}`);
}

for (const m of OPERACOES_DE_MODULACAO) somar(usos, m.essencia, `modulação · ${m.nome}`);

for (const m of MISSOES) {
  for (const id of Object.keys(m.consomeNaEntrega ?? {})) {
    somar(usos, id, `entrega da missão "${m.nome}"`);
  }
}

// ── SAÍDA ───────────────────────────────────────────────────────────────────
const modo = process.argv[2] ?? 'tudo';
const linhas = RECURSOS.map((r) => ({
  id: r.id,
  nome: r.nome,
  familia: r.familia,
  raridade: r.raridade,
  cai: fontes.get(r.id) ?? [],
  gasta: usos.get(r.id) ?? [],
  declarado: `${r.dropEstado}/${r.usoEstado}`,
}));

const orfaos = linhas.filter((l) => !l.cai.length || !l.gasta.length);

console.log(`\n▸ ${RECURSOS.length} recursos · ${RECEITAS.length} receitas de fusão · ${OPERACOES_DE_MODULACAO.length} modulações · ${MISSOES.length} missões · ${EVENTOS.length} eventos · ${BOSSES.length} chefes\n`);

if (modo !== 'orfaos') {
  console.log('ID'.padEnd(24) + 'FAMÍLIA'.padEnd(12) + 'R'.padEnd(3) + 'CAI DE'.padEnd(34) + 'GASTO EM');
  console.log('─'.repeat(130));
  for (const l of linhas) {
    console.log(
      l.id.padEnd(24)
      + l.familia.padEnd(12)
      + String(l.raridade).padEnd(3)
      + (l.cai.join('; ') || '— NADA —').slice(0, 32).padEnd(34)
      + (l.gasta.join('; ') || '— NADA —'),
    );
  }
}

console.log('\n── Onde a economia está aberta ──────────────────────────────────');
const semFonte = linhas.filter((l) => !l.cai.length);
const semUso = linhas.filter((l) => !l.gasta.length);
const dosDois = linhas.filter((l) => !l.cai.length && !l.gasta.length);

console.log(`  sem fonte nenhuma:   ${semFonte.length} de ${linhas.length}`);
console.log(`  sem uso nenhum:      ${semUso.length} de ${linhas.length}`);
console.log(`  inertes (nem um nem outro): ${dosDois.length}`);
console.log(`  fechados (caem E são gastos): ${linhas.length - new Set([...semFonte, ...semUso]).size}`);

if (modo === 'orfaos') {
  console.log('\n  ── caem e não são gastos ──');
  for (const l of linhas.filter((x) => x.cai.length && !x.gasta.length)) {
    console.log(`    ${l.id.padEnd(24)} ${l.familia.padEnd(12)} cai de: ${l.cai.join('; ')}`);
  }
  console.log('\n  ── são gastos e não caem ──');
  for (const l of linhas.filter((x) => !x.cai.length && x.gasta.length)) {
    console.log(`    ${l.id.padEnd(24)} ${l.familia.padEnd(12)} gasto em: ${l.gasta.join('; ')}`);
  }
  console.log('\n  ── inertes ──');
  console.log('    ' + (dosDois.map((l) => l.id).join(', ') || 'nenhum'));
}

// A declaração do catálogo contra a realidade medida.
console.log('\n── Catálogo contra código ───────────────────────────────────────');
const mentemDrop = linhas.filter((l) => {
  const r = RECURSO_POR_ID.get(l.id)!;
  return (r.dropEstado === 'ativo') !== (l.cai.length > 0);
});
const mentemUso = linhas.filter((l) => {
  const r = RECURSO_POR_ID.get(l.id)!;
  return (r.usoEstado === 'ativo') !== (l.gasta.length > 0);
});
console.log(`  dropEstado discorda do código em ${mentemDrop.length} recursos`);
console.log(`  usoEstado  discorda do código em ${mentemUso.length} recursos`);
if (mentemDrop.length) console.log('    drop: ' + mentemDrop.map((l) => `${l.id}(${l.declarado})`).join(', '));
if (mentemUso.length) console.log('    uso:  ' + mentemUso.map((l) => `${l.id}(${l.declarado})`).join(', '));
console.log('');
