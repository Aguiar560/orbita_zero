import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toda consulta do Worker roda contra o esquema que as migrações constroem.
 *
 * ## O defeito que isto pega
 *
 * Em 08/09 o `SELECT` de `progressoDe` ganhou a coluna `semente` junto da
 * migração `0013`. O Worker foi publicado; a migração NÃO foi aplicada em
 * produção. O resultado foi `no such column: semente`, e a rota `/progresso`
 * passou a devolver erro em toda chamada — por horas, sem um único sintoma no
 * servidor, porque ninguém estava olhando os logs.
 *
 * No jogo o sintoma foi outro, e foi por isso que custou a ser entendido: o
 * cliente engole a falha (`catch { return null }`) e cai no padrão. O jogador
 * não vê "o servidor falhou", vê **o nível do piloto zerado e a nave errada em
 * campo** — parece perda de dados, e não indisponibilidade.
 *
 * ## Por que um banco de verdade e não uma conferência de texto
 *
 * Procurar nomes de coluna por expressão regular acerta o caso fácil e erra
 * todo o resto — junção, alias, subconsulta. O SQLite já sabe fazer isso: um
 * `prepare` de uma consulta que cita coluna inexistente ERRA na hora, sem
 * executar nada. Então o teste monta o esquema em memória, exatamente como as
 * migrações o montam, e manda o SQLite preparar cada consulta que o Worker tem.
 *
 * É o mesmo motor do D1, o que faz este teste falhar pelos mesmos motivos que
 * a produção falharia — e não por uma imitação dela.
 *
 * ## O que ele NÃO cobre
 *
 * Que a migração foi APLICADA em produção. Isso não é conferível daqui, e a
 * ordem continua sendo: migração primeiro, `npm run deploy` depois. O que o
 * teste garante é que o par (código, migrações) é coerente — ou seja, que
 * existe uma migração a aplicar. Ficar sem ela era o caso silencioso.
 */

const SERVIDOR = resolve(__dirname, '../server');

/** O esquema como o D1 o tem: a base, e depois cada migração em ordem. */
function montarEsquema(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(resolve(SERVIDOR, 'schema.sql'), 'utf8'));

  const migracoes = readdirSync(resolve(SERVIDOR, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const arquivo of migracoes) {
    db.exec(readFileSync(resolve(SERVIDOR, 'migrations', arquivo), 'utf8'));
  }
  return db;
}

interface Consulta {
  arquivo: string;
  linha: number;
  sql: string;
}

/**
 * Todo texto passado a `.prepare(...)`.
 *
 * Varredura por caractere, e não por expressão regular, porque a maioria das
 * consultas do Worker é template literal de várias linhas — e há duas que
 * interpolam a lista de `?` de um `IN`. A interpolação vira um `?` só: o que se
 * está conferindo são as COLUNAS, e um `IN (?)` as cita do mesmo jeito.
 *
 * As concatenadas com `+` precisam ser juntadas antes de virar SQL. Sem isso o
 * teste lia só o primeiro pedaço e o SQLite reclamava de "incomplete input" —
 * um erro do teste que passaria por erro do código, que é a pior espécie.
 */
function extrairConsultas(fonte: string, arquivo: string): Consulta[] {
  const achados: Consulta[] = [];
  const marca = '.prepare(';

  for (let i = fonte.indexOf(marca); i !== -1; i = fonte.indexOf(marca, i + 1)) {
    let j = i + marca.length;
    while (j < fonte.length && /\s/.test(fonte[j]!)) j++;
    if (!/['"`]/.test(fonte[j] ?? '')) continue;

    let texto = '';
    // Cada volta consome um literal; a seguinte só acontece se houver `+`.
    for (;;) {
      const aspa = fonte[j]!;
      j++;
      for (; j < fonte.length; j++) {
        const c = fonte[j]!;
        if (c === '\\') { texto += fonte[j + 1] ?? ''; j++; continue; }
        if (c === aspa) break;
        texto += c;
      }
      j++;

      let k = j;
      while (k < fonte.length && /\s/.test(fonte[k]!)) k++;
      if (fonte[k] !== '+') break;
      k++;
      while (k < fonte.length && /\s/.test(fonte[k]!)) k++;
      if (!/['"`]/.test(fonte[k] ?? '')) break;
      j = k;
    }

    achados.push({
      arquivo,
      linha: fonte.slice(0, i).split('\n').length,
      // `${...}` só aparece onde o código monta uma lista de placeholders.
      sql: texto.replace(/\$\{[^}]*\}/g, '?').trim(),
    });
  }
  return achados;
}

function consultasDoWorker(): Consulta[] {
  const dir = resolve(SERVIDOR, 'src');
  // `src/chat/` fala com OUTRO banco (`orbita-zero-chat`, esquema próprio), e
  // conferi-lo contra este esquema acusaria tabela faltando que não falta.
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.ts'));

  const todas: Consulta[] = [];
  for (const f of arquivos) {
    todas.push(...extrairConsultas(readFileSync(resolve(dir, f), 'utf8'), `server/src/${f}`));
  }
  return todas;
}

describe('o esquema do servidor', () => {
  it('constrói sem erro a partir da base mais as migrações', () => {
    // Se isto falha, uma migração é inválida ou depende de outra que veio
    // depois dela — e nesse caso nem adianta olhar as consultas.
    expect(() => montarEsquema()).not.toThrow();
  });

  it('tem toda coluna e tabela que as consultas do Worker citam', () => {
    const db = montarEsquema();
    const consultas = consultasDoWorker();

    // Se a varredura deixar de achar as consultas — porque alguém trocou
    // `.prepare(` por um ajudante, por exemplo —, o teste passaria vazio e
    // silencioso, que é o pior jeito de um teste morrer.
    expect(consultas.length, 'a varredura não achou consulta nenhuma').toBeGreaterThan(30);

    const quebradas: string[] = [];
    for (const c of consultas) {
      try {
        db.prepare(c.sql);
      } catch (erro) {
        quebradas.push(`${c.arquivo}:${c.linha} — ${(erro as Error).message}\n    ${c.sql.replace(/\s+/g, ' ').slice(0, 160)}`);
      }
    }

    expect(quebradas.join('\n'), 'consultas que o esquema não sustenta').toBe('');
    db.close();
  });
});
