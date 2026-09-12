import { CHAVE_POR_ID } from '@data/chaves-de-acesso';

/**
 * As chaves de acesso, do lado do servidor.
 *
 * ## Por que elas vieram para cá
 *
 * "As chaves têm que ser igual os recursos e itens: se eles estão no D1, então
 * as chaves também precisam estar" — Rafael, 12/09/2026. O argumento é o mesmo
 * do Passo 9 inteiro: o save é um blob que o cliente escreve, e o que vale
 * poder não pode morar nele.
 *
 * Havia uma consequência concreta e recente. Em 12/09 a auditoria do acesso ao
 * chefe fechou quatro camadas, e a última — a do servidor — teve de ser uma
 * DECISÃO ("a ausência não enfrenta chefe") em vez de uma VERIFICAÇÃO, porque
 * o servidor não tinha como saber quais chaves a conta tinha. Com a chave
 * aqui, a pergunta passa a ter resposta.
 *
 * ## O que este módulo garante, e o que ainda não
 *
 * GARANTE que ninguém gasta o que não tem, e que gastar e entrar acontecem
 * juntos ou não acontecem. NÃO garante ainda de onde as chaves VÊM: o drop é
 * rolado no cliente (`chanceDropChavePorAbate`), e enquanto for assim o ganho
 * continua sendo palavra do cliente — a mesma dívida da sucata e do material.
 * O caminho honesto é o servidor rolar a chave a partir dos abates declarados,
 * como já faz com o preço do encontro. Está escrito no `PLANO.md`, não aqui.
 */

/** Teto por chave. Espelha o clamp do cliente; é sanidade, não regra de jogo. */
export const CHAVES_MAX = 999;

export type RecusaDeChave =
  | 'chave_desconhecida'
  | 'quantia_invalida'
  | 'sem_chave';

/** A chave existe no catálogo? O id vem do cliente, então é conferido. */
export const chaveValida = (id: unknown): id is string =>
  typeof id === 'string' && CHAVE_POR_ID.has(id);

/** O que o cliente declarou ter ganhado, já aparado. Só ganho: gasto é daqui. */
export function ganhosSaos(bruto: unknown): Record<string, number> | RecusaDeChave {
  if (!bruto || typeof bruto !== 'object') return 'quantia_invalida';
  const fora: Record<string, number> = {};
  for (const [id, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (!chaveValida(id)) return 'chave_desconhecida';
    const n = Math.trunc(Number(valor));
    // Negativo seria o cliente GASTANDO, e gastar é a operação que este módulo
    // existe para tirar da mão dele. Zero não muda nada e não vira escrita.
    if (!Number.isSafeInteger(n) || n < 0 || n > CHAVES_MAX) return 'quantia_invalida';
    if (n > 0) fora[id] = n;
  }
  return fora;
}

export async function chavesDe(
  env: { DB: D1Database }, usuario: string,
): Promise<Record<string, number>> {
  const { results } = await env.DB
    .prepare('SELECT chave, quantia FROM chaves WHERE usuario = ? AND quantia > 0')
    .bind(usuario)
    .all<{ chave: string; quantia: number }>();
  return Object.fromEntries(results.map((l) => [l.chave, l.quantia]));
}

/** O chefe que esta conta PAGOU para enfrentar agora, se houver. */
export async function acessoAoChefeDe(
  env: { DB: D1Database }, usuario: string,
): Promise<string | null> {
  const linha = await env.DB
    .prepare('SELECT boss FROM acesso_ao_chefe WHERE usuario = ?')
    .bind(usuario)
    .first<{ boss: string }>();
  return linha?.boss ?? null;
}

/**
 * Credita o que caiu. Soma, com teto, e nunca desce.
 *
 * `MIN(..., CHAVES_MAX)` no próprio SQL pelo mesmo motivo do `MAX(0, ...)` dos
 * materiais: resolver o teto aqui evita ler antes de escrever, e a leitura
 * antes da escrita é uma janela entre duas abas.
 */
export async function creditarChaves(
  env: { DB: D1Database }, usuario: string, ganhos: Record<string, number>,
): Promise<void> {
  const escritas = Object.entries(ganhos).map(([id, n]) => env.DB.prepare(`
    INSERT INTO chaves (usuario, chave, quantia) VALUES (?, ?, MIN(?, ?))
    ON CONFLICT(usuario, chave) DO UPDATE SET quantia = MIN(quantia + ?, ?)
  `).bind(usuario, id, n, CHAVES_MAX, n, CHAVES_MAX));
  if (escritas.length) await env.DB.batch(escritas);
}

/**
 * Gasta uma chave e abre o acesso ao chefe. Tudo ou nada.
 *
 * ## As três instruções, e por que a primeira não é supérflua
 *
 * O `INSERT OR IGNORE` garante a LINHA antes do débito, e essa linha é a
 * diferença entre uma trava que funciona e uma que parece funcionar. Medido em
 * 12/09/2026 com `node:sqlite`:
 *
 * | conta | sem a linha garantida | com a linha garantida |
 * |---|---|---|
 * | com chave | entrou | entrou |
 * | **sem nenhuma chave** | **ENTROU** | recusado |
 *
 * O motivo: `UPDATE ... WHERE usuario = ?` numa conta que nunca teve chave casa
 * ZERO linhas. Zero linha não viola `CHECK` nenhum, não levanta erro, e o
 * `batch` segue em frente gravando o acesso. Quem nunca teve chave entrava de
 * graça — exatamente o contrário do que a trava promete.
 *
 * Com a linha em zero, o débito viola `CHECK (quantia >= 0)`, o D1 levanta erro
 * e o `batch` reverte inteiro. É a mesma lição do dia: num `batch`, condição
 * que casa zero linhas NÃO reverte nada; só erro reverte.
 */
export async function consumirChave(
  env: { DB: D1Database }, usuario: string, chaveId: string, bossId: string, agora: number,
): Promise<boolean> {
  if (!chaveValida(chaveId)) return false;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO chaves (usuario, chave, quantia) VALUES (?, ?, 0)')
        .bind(usuario, chaveId),
      env.DB.prepare('UPDATE chaves SET quantia = quantia - 1 WHERE usuario = ? AND chave = ?')
        .bind(usuario, chaveId),
      env.DB.prepare(`
        INSERT INTO acesso_ao_chefe (usuario, boss, em) VALUES (?, ?, ?)
        ON CONFLICT(usuario) DO UPDATE SET boss = excluded.boss, em = excluded.em
      `).bind(usuario, bossId, agora),
    ]);
    return true;
  } catch {
    // `CHECK (quantia >= 0)`: não havia chave. O acesso não foi gravado.
    return false;
  }
}

/**
 * Fecha o acesso. Chamado ao SAIR do setor — não ao concluí-lo.
 *
 * A distinção custou um defeito no cliente em 12/09: o recibo era rasgado na
 * conclusão, e com "Repetir setor" ligado a nave ficava dentro do setor do
 * chefe sem ele. Aqui a regra nasce certa.
 */
export async function liberarAcesso(
  env: { DB: D1Database }, usuario: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM acesso_ao_chefe WHERE usuario = ?').bind(usuario).run();
}
