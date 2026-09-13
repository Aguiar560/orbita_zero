/**
 * Monta o banco de staging do zero: `schema.sql` e todas as migrações, em ordem.
 *
 * ## Por que um script e não um comando
 *
 * Porque `schema.sql` não é o esquema. Ele tem três tabelas — `saves`,
 * `apelidos` e `marcas` — e o resto do banco foi nascendo nas migrações
 * `0002..NNNN`. Aplicar só o `schema.sql` daria um staging que responde a login
 * e falha em tudo mais, e a falha apareceria uma rota por vez, dias depois.
 *
 * A ordem é a do NOME do arquivo, que é a ordem em que a produção os recebeu.
 * `d1_migrations` não registra o que subiu por `--file=`, então quem garante a
 * ordem aqui é a listagem ordenada, não o banco.
 *
 * ## Idempotência
 *
 * As migrações usam `CREATE TABLE IF NOT EXISTS` e `INSERT OR IGNORE`, e as que
 * mexem em dado citam ids de jogadores que não existem no staging — viram
 * no-op. Rodar de novo é seguro; `--reiniciar` é para quando se quer um banco
 * realmente vazio.
 *
 *   node tools/criar-staging.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BANCO = 'orbita-zero-staging';

/**
 * `shell: true` é necessário no Windows para achar o `npx`, e é ele que obriga
 * a citar o SQL: sem aspas o shell quebra `SELECT valor FROM ...` em vários
 * argumentos e o wrangler recusa com "Unknown arguments". Custou uma execução
 * inteira para aparecer, porque só o último passo do script usa `--command`.
 */
function executar(args) {
  const citados = args.map((a) => (a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a));
  return execFileSync('npx', ['wrangler', 'd1', 'execute', BANCO, '--remote', ...citados], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
}

const arquivos = [
  'schema.sql',
  ...readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()
    .map((f) => join('migrations', f)),
];

for (const arquivo of arquivos) {
  process.stdout.write(`→ ${arquivo} ... `);
  try {
    executar(['--file', arquivo, '--yes']);
    console.log('ok');
  } catch (erro) {
    const saida = `${erro.stdout ?? ''}${erro.stderr ?? ''}`;
    console.log('FALHOU');
    console.error(saida.split('\n').filter((l) => l.trim()).slice(-8).join('\n'));
    process.exit(1);
  }
}

/**
 * O marcador tem que dizer STAGING.
 *
 * A migração `0028` grava o valor da produção, porque é ela que vai ser
 * aplicada lá. Aqui o valor é sobrescrito depois — se este passo falhar, o
 * `/saude` do staging diria `orbita-zero`, que é precisamente a mentira que o
 * marcador existe para impedir.
 */
const temporario = join('migrations', '.marcador-staging.sql');
writeFileSync(
  temporario,
  `INSERT OR REPLACE INTO instalacao (chave, valor) VALUES ('banco', '${BANCO}');\n`,
);
try {
  executar(['--file', temporario, '--yes']);
  console.log(`→ marcador = ${BANCO} ok`);
} finally {
  rmSync(temporario, { force: true });
}

const conferencia = executar([
  '--json', '--command', "SELECT valor FROM instalacao WHERE chave = 'banco'",
]);
if (!conferencia.includes(BANCO)) {
  console.error('marcador não confere:', conferencia);
  process.exit(1);
}
console.log(`\nBanco ${BANCO} pronto. Publicar: npm run deploy:staging`);
