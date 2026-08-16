/**
 * Arnês de simulação de balanceamento — a interface de linha de comando.
 *
 * O JOGO continua sendo do navegador. Isto não roda jogo nenhum: importa os
 * mesmos módulos de `sim/` e `data/` e faz perguntas numéricas sobre eles.
 *
 * Existe porque os critérios de aceite da FASE 0 não são verificáveis pelo
 * navegador. "200 000 rolagens dentro de ±5%" trava uma aba; "tempo de onda
 * entre 6 s e 50 s do setor 1 ao 300" precisa de medições reprodutíveis. Antes
 * disto a medição era JavaScript colado no console, que morria com a aba e que
 * ninguém conseguia repetir nem conferir.
 *
 *   npm run simular -- curva 1 120
 *   npm run simular -- drops 200000
 *   npm run simular -- item 30
 */
import { Rng } from '@core/math';
import { RARITIES } from '@data/rarity';
import { rollItem, rollRarity } from '@sim/loot';
import { WAVES_PER_SECTOR, buildEncounter } from '@sim/progression';
import { powerScore, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import type { GameState } from '@sim/types';
import {
  ajustarLeiDePotencia, diagnostico, divergencia, medirSetor, tentativasDoSetor,
} from './lib/balanco';

// ── formatação ──────────────────────────────────────────────────────────────

/** Número legível: sufixo em vez de notação científica. */
function n(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const abs = Math.abs(v);
  if (abs < 1000) return abs < 10 ? v.toFixed(1) : String(Math.round(v));
  const sufixos = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'De'];
  const grau = Math.min(sufixos.length - 1, Math.floor(Math.log10(abs) / 3) - 1);
  return `${(v / Math.pow(1000, grau + 1)).toFixed(2)}${sufixos[grau]}`;
}

function tabela(cabecalho: string[], linhas: string[][]): void {
  const larguras = cabecalho.map((h, i) =>
    Math.max(h.length, ...linhas.map((l) => (l[i] ?? '').length)));
  const linha = (cels: string[]) => cels.map((c, i) => c.padStart(larguras[i]!)).join('  ');
  console.log(linha(cabecalho));
  console.log(larguras.map((w) => '─'.repeat(w)).join('  '));
  for (const l of linhas) console.log(linha(l));
}

// ── comandos ────────────────────────────────────────────────────────────────

/**
 * Curva de dificuldade contra curva de poder.
 *
 * As duas colunas finais são o produto das outras: é nelas que se vê se o jogo
 * é jogável. A faixa saudável fixada na auditoria é 6–50 s e 8–30 golpes.
 */
function comandoCurva(de: number, ate: number): void {
  const passo = Math.max(1, Math.round((ate - de) / 14));
  const setores: number[] = [];
  for (let s = de; s <= ate; s += passo) setores.push(s);
  if (setores[setores.length - 1] !== ate) setores.push(ate);

  // `map(medirSetor)` passaria índice e array como 2º e 3º argumentos — que
  // agora são `tentativas` e `repeticoes`. A seta explícita evita isso.
  // `tentativas` fica no padrão, que sobe com o setor: é o que representa um
  // jogador real, com poucas opções no começo e muitas no fim.
  const medidas = setores.map((s) => medirSetor(s, tentativasDoSetor(s), 5));

  tabela(
    ['setor', 'casco', 'DPS', 'vida ef.', 'HP da onda', 'dano ini.', 'seg', 'golpes', ''],
    medidas.map((m) => [
      String(m.setor), m.casco, n(m.dps), n(m.ehp), n(m.hpDaOnda), n(m.danoInimigo),
      m.segParaLimpar < 0.05 ? '~0' : n(m.segParaLimpar),
      n(m.golpesAteMorrer),
      diagnostico(m),
    ]),
  );

  const d = divergencia(medidas[0]!, medidas[medidas.length - 1]!);
  console.log(`\nCrescimento composto por setor, do ${medidas[0]!.setor} ao ${medidas[medidas.length - 1]!.setor}:`);
  console.log(`  DPS do jogador     ${d.rDps.toFixed(4)}`);
  console.log(`  HP do inimigo      ${d.rHp.toFixed(4)}`);
  console.log(`  divergência        ${d.ofensiva.toFixed(4)}  →  ${n(d.ofensivaAcumulada)}× em ${d.span} setores`);
  console.log(`  vida ef. jogador   ${d.rEhp.toFixed(4)}`);
  console.log(`  dano do inimigo    ${d.rDano.toFixed(4)}`);
  console.log(`  divergência        ${d.defensiva.toFixed(4)}  →  ${n(d.defensivaAcumulada)}× em ${d.span} setores`);
}

/** Distribuição real de raridade contra a planejada. */
function comandoDrops(amostras: number, sorte: number): void {
  const rng = new Rng(20260816);
  const cont = new Array(RARITIES.length).fill(0);
  for (let i = 0; i < amostras; i++) cont[rollRarity(rng, sorte, 0)]++;

  const pesoTotal = RARITIES.reduce((s, r) => s + r.weight * Math.pow(1 + sorte, r.id), 0);

  tabela(
    ['raridade', 'esperado', 'real', 'desvio', '1 em'],
    RARITIES.map((r, i) => {
      const esperado = (r.weight * Math.pow(1 + sorte, r.id)) / pesoTotal;
      const real = cont[i] / amostras;
      const desvio = esperado > 0 ? (real / esperado - 1) * 100 : 0;
      return [
        r.name,
        `${(esperado * 100).toFixed(4)}%`,
        `${(real * 100).toFixed(4)}%`,
        `${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}%`,
        cont[i] > 0 ? n(amostras / cont[i]) : '—',
      ];
    }),
  );
  console.log(`\n${n(amostras)} rolagens · sorte ${sorte}`);
}

/** Dispersão de poder entre itens do mesmo nível — o §7 quer isso controlado. */
function comandoItem(ilvl: number, amostras: number): void {
  const rng = new Rng(4242);
  const base = createState(1);
  const notaBase = powerScore(resolveStats(base));

  const porRaridade = new Map<number, number[]>();
  for (let i = 0; i < amostras; i++) {
    const item = rollItem(rng, ilvl, 0.3, 0);
    const sonda: GameState = { ...base, equipped: { ...base.equipped, [item.slot]: item } };
    const ganho = powerScore(resolveStats(sonda)) - notaBase;
    if (!porRaridade.has(item.rarity)) porRaridade.set(item.rarity, []);
    porRaridade.get(item.rarity)!.push(ganho);
  }

  tabela(
    ['raridade', 'amostras', 'mín', 'mediana', 'máx', 'máx/mín'],
    RARITIES.filter((r) => porRaridade.has(r.id)).map((r) => {
      const v = porRaridade.get(r.id)!.sort((a, b) => a - b);
      const min = v[0]!;
      const max = v[v.length - 1]!;
      return [
        r.name, String(v.length), n(min), n(v[Math.floor(v.length / 2)]!), n(max),
        min > 0.01 ? `${(max / min).toFixed(1)}×` : '—',
      ];
    }),
  );
  console.log(`\nnível de item ${ilvl} · ${n(amostras)} itens`);
  console.log('máx/mín é a dispersão dentro da MESMA raridade — o §7 quer isso sob controle.');
}

/**
 * Mede a curva REAL de poder do jogador e ajusta a lei de potência.
 *
 * É a entrada da calibragem (§45): os expoentes que vão para
 * `data/balance/curvas.ts` saem daqui, não de palpite.
 *
 * `tentativas` modela quanto o jogador otimizou o equipamento. Um jogador do
 * setor 1 tem duas ou três peças por slot; um do setor 100 já viu centenas de
 * drops. Medir com os dois extremos mostra a faixa dentro da qual o ritmo
 * precisa se sustentar.
 */
function comandoAjustar(tentativas: number): void {
  const setores: number[] = [];
  for (let s = 1; s <= 300; s += s < 20 ? 2 : s < 60 ? 5 : 15) setores.push(s);

  const REPETICOES = 7;
  // `tentativas = 0` significa "usar a rampa realista"; qualquer outro valor
  // fixa o grau de otimização, o que serve para medir os extremos.
  const medidas = setores.map((s) => medirSetor(s, tentativas || tentativasDoSetor(s), REPETICOES));
  const ilvlDe = (s: number) => Math.max(1, Math.floor(s * 0.9));

  const dps = ajustarLeiDePotencia(medidas.map((m) => ({ ilvl: ilvlDe(m.setor), valor: m.dps })));
  const ehp = ajustarLeiDePotencia(medidas.map((m) => ({ ilvl: ilvlDe(m.setor), valor: m.ehp })));

  console.log(`Ajuste com ${tentativas} tentativas por slot, mediana de ${REPETICOES} sementes,`);
  console.log(`${medidas.length} setores de 1 a 300.\n`);
  console.log(`  DPS       = ${dps.A.toFixed(3)} × (ilvl + ${dps.C}) ^ ${dps.P.toFixed(4)}   R² ${dps.r2.toFixed(4)}`);
  console.log(`  vida ef.  = ${ehp.A.toFixed(3)} × (ilvl + ${ehp.C}) ^ ${ehp.P.toFixed(4)}   R² ${ehp.r2.toFixed(4)}\n`);

  const erros: number[] = [];
  tabela(
    ['setor', 'ilvl', 'DPS medido', 'DPS ajuste', 'erro', 'ehp medido', 'ehp ajuste', 'erro'],
    medidas.map((m) => {
      const il = ilvlDe(m.setor);
      const pd = dps.A * Math.pow(il + dps.C, dps.P);
      const pe = ehp.A * Math.pow(il + ehp.C, ehp.P);
      erros.push(Math.abs(m.dps / pd - 1));
      return [
        String(m.setor), String(il), n(m.dps), n(pd), `${((m.dps / pd - 1) * 100).toFixed(0)}%`,
        n(m.ehp), n(pe), `${((m.ehp / pe - 1) * 100).toFixed(0)}%`,
      ];
    }),
  );
  erros.sort((a, b) => a - b);
  console.log(`\nErro do ajuste de DPS: mediana ${(erros[Math.floor(erros.length / 2)]! * 100).toFixed(0)}%, `
    + `pior ${(erros[erros.length - 1]! * 100).toFixed(0)}%.`);
  console.log('\nA curva do jogador é POLINOMIAL em ilvl, não exponencial —');
  console.log('é por isso que a curva exponencial do inimigo a ultrapassa sempre.');
}

/**
 * Composição das ondas de um setor.
 *
 * Serve para ver a VARIEDADE, que é dificuldade tanto quanto vida e dano: antes
 * a contagem de inimigos se cancelava na conta e toda onda do jogo tinha o
 * mesmo número de naves, do setor 1 ao 300.
 */
function comandoOndas(de: number, ate: number): void {
  const linhas: string[][] = [];
  const estado = createState(20260816);

  for (let setor = de; setor <= ate; setor++) {
    for (let onda = 1; onda <= WAVES_PER_SECTOR + 1; onda++) {
      const e = buildEncounter(estado, setor, onda);
      const total = e.squad.reduce((s, g) => s + g.count, 0);
      linhas.push([
        String(setor),
        String(onda),
        e.perfil,
        e.boss ? '—' : String(total),
        `${e.pressao.toFixed(2)}×`,
        n(e.hpPool),
        e.boss ? e.boss.name : e.squad.map((g) => `${g.def.id}×${g.count}`).join(' + '),
      ]);
    }
  }

  tabela(['setor', 'onda', 'perfil', 'naves', 'cadência', 'vida', 'composição'], linhas);
  console.log('\nA vida total da onda é a mesma em qualquer perfil — muda como ela é repartida.');
}

// ── entrada ─────────────────────────────────────────────────────────────────

const [comando, ...args] = process.argv.slice(2);

switch (comando) {
  case 'curva':
    comandoCurva(Number(args[0] ?? 1), Number(args[1] ?? 100));
    break;
  case 'drops':
    comandoDrops(Number(args[0] ?? 200000), Number(args[1] ?? 0));
    break;
  case 'item':
    comandoItem(Number(args[0] ?? 30), Number(args[1] ?? 5000));
    break;
  case 'ajustar':
    comandoAjustar(Number(args[0] ?? 12));
    break;
  case 'ondas':
    comandoOndas(Number(args[0] ?? 1), Number(args[1] ?? 3));
    break;
  default:
    console.log(`Arnês de simulação do Órbita Zero.

  npm run simular -- curva <de> <ate>           dificuldade × poder, setor a setor
  npm run simular -- drops <amostras> [sorte]   distribuição de raridade
  npm run simular -- item <ilvl> [amostras]     dispersão de poder por item

Não roda o jogo: só importa sim/ e data/, que são TypeScript puro.`);
}
