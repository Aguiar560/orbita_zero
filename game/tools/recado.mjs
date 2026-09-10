#!/usr/bin/env node
/**
 * Manda um recado do comando para a tela de quem está jogando.
 *
 *   node tools/recado.mjs --para todos    "texto"
 *   node tools/recado.mjs --para vips     "texto"
 *   node tools/recado.mjs --para sem-vip  "texto"
 *   node tools/recado.mjs --para 1e884e5b "texto"     (id ou prefixo dele)
 *
 * Sem `--enviar` ele só ENSAIA: conta o público, mostra os apelidos e imprime
 * o SQL. É o padrão de propósito — a diferença entre um recado e um engano de
 * operação é uma condição no `WHERE`, e conferir custa três segundos.
 *
 *   node tools/recado.mjs --pendentes     (o que ainda não foi lido)
 *
 * ## Por que existe, em vez de um `INSERT` escrito à mão
 *
 * Porque escrever à mão é onde o engano acontece. Um `WHERE` esquecido manda
 * para todo mundo; uma aspa no texto quebra a consulta; um prefixo ambíguo
 * acerta a pessoa errada. Aqui os três casos param antes de virar linha.
 *
 * ## Por que o público é CONGELADO no envio
 *
 * "Mandar para os vips" quer dizer os vips de agora. Guardar a regra e avaliar
 * na entrega faria um agradecimento aos assinantes cair, semanas depois, na
 * tela de quem acabou de assinar — e sumir da de quem deixou vencer. Por isso
 * o comando resolve a lista na hora e grava uma linha por jogador.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SERVIDOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');

/** O cartão é pequeno, e texto longo vira parede que ninguém lê. */
const TEXTO_MAX = 300;

/**
 * Quem é "todo mundo".
 *
 * A união das duas tabelas, e não só uma: `contas` nasceu na migração 0004 e
 * não conhece quem chegou antes dela; `apelidos` só tem quem escolheu um nome.
 * Hoje são 5 e 8 — a diferença é exatamente o buraco que a união fecha.
 */
const TODOS = 'SELECT usuario FROM apelidos UNION SELECT usuario FROM contas';
const VIPS = "SELECT usuario FROM assinaturas WHERE expira_em > strftime('%s','now')";

const publicos = {
  todos: TODOS,
  vips: VIPS,
  'sem-vip': `${TODOS} EXCEPT ${VIPS}`,
};

/** Aspa simples dobrada: é o único escape que o SQLite pede numa string. */
const aspas = (t) => `'${String(t).replace(/'/g, "''")}'`;

/**
 * Chama o wrangler pelo ARQUIVO, e não pelo `npx`.
 *
 * No Windows, `spawnSync` recusa um `.cmd` sem shell (EINVAL) — e COM shell os
 * argumentos são concatenados sem aspas, então um SQL com espaços vira vários
 * parâmetros e o comando quebra. Chamar o `.js` com o próprio node escapa dos
 * dois: nenhum shell no meio, nenhum argumento reinterpretado.
 */
function d1(sql) {
  const r = spawnSync(
    process.execPath,
    [
      path.join(SERVIDOR, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1', 'execute', 'orbita-zero', '--remote', '--json', '--command', sql,
    ],
    { cwd: SERVIDOR, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  // O wrangler imprime avisos antes do JSON; o primeiro `[` é o começo dele.
  const bruto = r.stdout.slice(r.stdout.indexOf('['));
  try {
    return JSON.parse(bruto)[0].results;
  } catch {
    console.error(r.stdout);
    process.exit(1);
  }
}

// ── linha de comando ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const pega = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : null;
};
const tem = (nome) => args.includes(nome);

if (tem('--pendentes')) {
  const linhas = d1(`
    SELECT r.id, COALESCE(n.apelido, substr(r.usuario, 1, 8)) AS quem,
           r.texto, CASE WHEN r.lido_em IS NULL THEN 'não' ELSE 'sim' END AS lido
      FROM recados r LEFT JOIN apelidos n ON n.usuario = r.usuario
     ORDER BY r.id DESC LIMIT 30`);
  console.table(linhas);
  process.exit(0);
}

const alvo = pega('--para');
const texto = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--para').join(' ').trim();

if (!alvo || !texto) {
  console.error('uso: node tools/recado.mjs --para todos|vips|sem-vip|<id> "texto" [--enviar]');
  process.exit(1);
}
if (texto.length > TEXTO_MAX) {
  console.error(`texto com ${texto.length} caracteres; o teto é ${TEXTO_MAX}.`);
  process.exit(1);
}

// Um alvo que não é grupo é um jogador — por id inteiro ou pelo começo dele.
const publico = publicos[alvo]
  ?? `SELECT usuario FROM apelidos WHERE usuario LIKE ${aspas(`${alvo}%`)}`;

const quem = d1(`
  SELECT COALESCE(n.apelido, substr(a.usuario, 1, 8)) AS apelido, a.usuario
    FROM (${publico}) a LEFT JOIN apelidos n ON n.usuario = a.usuario
   ORDER BY apelido`);

if (!quem.length) {
  console.error(`nenhum jogador em "${alvo}". Nada foi enviado.`);
  process.exit(1);
}

const insercao = `INSERT INTO recados (usuario, texto, criado_em)
  SELECT usuario, ${aspas(texto)}, strftime('%s','now') FROM (${publico})`;

console.log(`\npúblico "${alvo}" — ${quem.length} jogador(es):`);
console.log(`  ${quem.map((q) => q.apelido).join(', ')}`);
console.log(`\ntexto:\n  "${texto}"\n`);

if (!tem('--enviar')) {
  console.log('ENSAIO. Nada foi gravado. Repita com --enviar para mandar de verdade.');
  console.log(`\nSQL:\n${insercao}\n`);
  process.exit(0);
}

d1(insercao);
console.log(`enviado para ${quem.length} jogador(es). Aparece na tela deles em até 30 s.`);
