/**
 * Ensaio da restituição do descarte automático que não rodou.
 *
 * ## Por que existe
 *
 * Em 13/09/2026, `drenarCarteira` apagava `state.vip.expiresAt` quando um envio
 * era recusado, e o descarte automático — que é benefício de VIP — parava de
 * consumir a sessão inteira, calado. Contas com o corte ligado acumularam peças
 * que a automação deveria ter comido.
 *
 * O conserto impede novos casos; ele não desfaz os antigos. Este ensaio mostra
 * o que uma restituição daria a cada conta, **sem escrever nada**. Ler antes de
 * decidir é a diferença entre restituir e destruir inventário alheio.
 *
 * ## O que ele NUNCA propõe tocar
 *
 * - peça equipada (`nave IS NOT NULL`);
 * - peça favorita;
 * - conta sem VIP hoje — nela a automação está desligada por regra, e as peças
 *   abaixo do corte são comportamento correto, não estrago.
 *
 *   npm run restituicao:ensaio
 */
import { execFileSync } from 'node:child_process';

import { retornoDeDesmanche, valorDeVenda } from '../src/data/balance/descarte';
import type { Item } from '../src/sim/types';

interface Linha {
  usuario: string;
  corte: number;
  modo: string;
  dados: string;
  uid: string;
}

function consultar<T>(sql: string): T[] {
  const saida = execFileSync('npx', [
    'wrangler', 'd1', 'execute', 'orbita-zero', '--remote', '--json',
    '--command', `"${sql.replace(/\s+/g, ' ').trim()}"`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, cwd: 'server' });
  const bruto = saida.slice(saida.indexOf('['));
  return (JSON.parse(bruto) as { results: T[] }[])[0]!.results;
}

const linhas = consultar<Linha>(`
  SELECT i.usuario, i.uid, i.dados,
         json_extract(s.estado, '$.settings.autoSalvage') AS corte,
         json_extract(s.estado, '$.settings.autoDispose') AS modo
  FROM itens i
  JOIN saves s ON s.usuario = i.usuario
  JOIN assinaturas a ON a.usuario = i.usuario
  WHERE i.nave IS NULL
    AND a.expira_em > strftime('%s','now')
    AND json_extract(s.estado, '$.settings.autoSalvage') > 0
    AND json_extract(i.dados, '$.rarity') < json_extract(s.estado, '$.settings.autoSalvage')
`);

const porConta = new Map<string, {
  corte: number; modo: string; n: number;
  sucata: number; materiais: Record<string, number>; favoritas: number;
}>();

for (const linha of linhas) {
  const item = JSON.parse(linha.dados) as Item;
  const conta = porConta.get(linha.usuario) ?? {
    corte: linha.corte, modo: linha.modo, n: 0, sucata: 0, materiais: {}, favoritas: 0,
  };
  porConta.set(linha.usuario, conta);

  // Favorita é decisão explícita do jogador sobre aquela peça. Ela vence o
  // ajuste geral — e a automação ao vivo também não a tocaria.
  if (item.favorite) { conta.favoritas++; continue; }

  conta.n++;
  if (linha.modo === 'vender') {
    conta.sucata += valorDeVenda(item);
  } else {
    for (const [material, q] of Object.entries(retornoDeDesmanche(item).materiais)) {
      conta.materiais[material] = (conta.materiais[material] ?? 0) + (q ?? 0);
    }
  }
}

if (!porConta.size) {
  console.log('Nenhuma conta VIP com peça abaixo do próprio corte. Nada a restituir.');
} else {
  console.log(`Contas VIP afetadas: ${porConta.size}\n`);
  for (const [usuario, c] of porConta) {
    console.log(`${usuario.slice(0, 8)} · corte ${c.corte} · ${c.modo}`);
    console.log(`  peças a consumir: ${c.n}${c.favoritas ? ` (${c.favoritas} favoritas preservadas)` : ''}`);
    if (c.sucata) console.log(`  sucata a creditar: ${c.sucata.toLocaleString('pt-BR')}`);
    for (const [m, q] of Object.entries(c.materiais)) console.log(`  ${m}: +${q}`);
    console.log();
  }
  console.log('Ensaio: nada foi escrito.');
}
