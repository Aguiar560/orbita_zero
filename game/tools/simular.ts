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
import { diagnosticoDoPiso, medirPiso } from './lib/provacao-balanco';
import { Rng } from '@core/math';
import { RARITIES } from '@data/rarity';
import { rollItem, rollRarity } from '@sim/loot';
import { WAVES_PER_SECTOR, buildEncounter } from '@sim/progression';
import { powerScore, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import type { GameState, Item } from '@sim/types';
import { AFFIXES } from '@data/items';
import { fatorDoTier } from '@data/balance/tiers';
import { AFIXO_ESCALA_POR_ILVL, ATRIBUTOS_FRACIONARIOS } from '@data/balance/curvas';
import {
  ajustarLeiDePotencia, diagnostico, divergencia, equiparMelhor, medirSetor, tentativasDoSetor,
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

  const pesoTotal = RARITIES.reduce((s, r) => s + r.weight * Math.pow(1 + sorte, r.sorteExpo), 0);

  tabela(
    ['raridade', 'esperado', 'real', 'desvio', '1 em'],
    RARITIES.map((r, i) => {
      const esperado = (r.weight * Math.pow(1 + sorte, r.sorteExpo)) / pesoTotal;
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

/**
 * Valor MARGINAL de cada afixo, em nota de poder (§7).
 *
 * O medidor que faltava para o orçamento existir. A dispersão dentro de uma
 * raridade é o sintoma; a causa é que os afixos não custam o mesmo. Um Comum
 * tem UMA linha, e se ela pode ser `+dano` ou `+1,2% de crítico`, a mesma
 * raridade produz itens que diferem por ordens de grandeza sem que o jogador
 * tenha feito escolha nenhuma.
 *
 * Mede o afixo isolado, na MEDIANA da sua faixa e num tier fixo, para o número
 * refletir o afixo e não a sorte da rolagem.
 */
/**
 * Ganho marginal de cada afixo, sobre uma nave montada no nível.
 *
 * Separado de `comandoAfixos` porque a calibragem precisa do MESMO número em
 * dois níveis de item, e reimplementar a sonda seria duas medições que podem
 * divergir — o tipo de divergência que não aparece em teste.
 */
export function medirAfixos(ilvl: number, tier: number): { def: typeof AFFIXES[number]; ganho: number }[] {
  /**
   * A base é uma nave MONTADA no nível, não uma nave nua.
   *
   * Foi o erro da primeira versão deste comando, e ele inverte o resultado.
   * Afixo multiplicativo vale em proporção à base que multiplica: `+15% de dano
   * crítico` sobre uma nave nua não vale quase nada, e sobre uma nave equipada
   * vale muito. Medindo contra o zero, todo afixo de porcentagem parecia lixo e
   * todo afixo de valor bruto parecia dominante — que foi exatamente a
   * "assimetria estrutural" que a medição anterior acusou.
   *
   * A sonda ACRESCENTA uma linha à peça já equipada, em vez de trocar a peça.
   * Trocar mediria o ganho da linha MENOS a perda do que saiu do slot, que é
   * outra pergunta.
   */
  const base = equiparMelhor(ilvl, 'void_canhao', 1234, tentativasDoSetor(Math.round(ilvl / 0.9)));
  const notaBase = powerScore(resolveStats(base));

  const linhas = AFFIXES.map((def) => {
    const slot = def.slots?.[0] ?? 'principal';
    const alvo = base.equipped[slot];
    if (!alvo) return { def, ganho: 0 };

    const bruto = (def.min + def.max) / 2;
    const escalavel = def.kind === 'add' && !def.element && !ATRIBUTOS_FRACIONARIOS.has(def.stat);
    const escalado = escalavel ? bruto * (1 + ilvl * AFIXO_ESCALA_POR_ILVL) : bruto;
    // Por ATRIBUTO e não por id: a checagem era `def.id === 'proj_f'` e quebrou
    // em silêncio quando o §8 dividiu os projéteis em três degraus. O que faz
    // um afixo ser contagem é o atributo ser inteiro, não como ele se chama.
    const contagem = def.stat === 'projeteis' || def.stat === 'perfuracao';
    // ESPELHA `rollAffix`, `calibre` incluído. Sem ele, a sonda media o item
    // que o gerador NÃO produz: a calibragem entrava no jogo e não na medição,
    // então medir depois de calibrar não mostrava efeito nenhum — e a leitura
    // era "a calibragem não funcionou", quando o que não funcionava era a régua.
    const value = contagem
      ? Math.round(bruto)
      : escalado * fatorDoTier(tier) * (def.calibre ?? 1);

    const comLinha: Item = {
      ...alvo,
      // O afixo de potência elemental só age se a arma for daquele elemento —
      // é a regra do próprio gerador. Sem isto, os seis `pot_*` mediriam zero
      // por um motivo que não é o deles.
      ...(def.element ? { element: def.element } : {}),
      affixes: [...alvo.affixes, { id: def.id, stat: def.stat, kind: def.kind, value, quality: 0.5, tier }],
    };

    const sonda: GameState = { ...base, equipped: { ...base.equipped, [slot]: comLinha } };
    return { def, ganho: powerScore(resolveStats(sonda)) - notaBase };
  }).sort((a, b) => b.ganho - a.ganho);

  return linhas;
}

/** Tabela legível do ganho marginal — o comando `afixos`. */
function comandoAfixos(ilvl: number, tier: number): void {
  const linhas = medirAfixos(ilvl, tier);
  const valores = linhas.map((l) => l.ganho).filter((g) => g > 0);
  const mediana = valores.sort((a, b) => a - b)[Math.floor(valores.length / 2)] ?? 1;

  tabela(
    ['afixo', 'atributo', 'tipo', 'ganho', 'x mediana'],
    linhas.map((l) => [
      l.def.id, l.def.stat, l.def.kind, n(l.ganho),
      `${(l.ganho / mediana).toFixed(2)}×`,
    ]),
  );

  const positivos = linhas.filter((l) => l.ganho > 0.001).map((l) => l.ganho);
  const menor = Math.min(...positivos);
  const maior = Math.max(...positivos);
  console.log(`\nnível de item ${ilvl} · tier ${tier} · mediana ${n(mediana)}`);
  console.log(`dispersão entre afixos: ${(maior / menor).toFixed(1)}×`);
  console.log(`afixos que não movem a nota: ${linhas.filter((l) => l.ganho <= 0.001).length}`);
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
  case 'calibrar':
    comandoCalibrar(Number(args[0] ?? 0.6));
    break;
  case 'provacao':
    provacao(Number(args[0] ?? 1), Number(args[1] ?? 20));
    break;

  case 'afixos':
    comandoAfixos(Number(args[0] ?? 30), Number(args[1] ?? 5));
    break;
  default:
    console.log(`Arnês de simulação do Órbita Zero.

  npm run simular -- curva <de> <ate>           dificuldade × poder, setor a setor
  npm run simular -- drops <amostras> [sorte]   distribuição de raridade
  npm run simular -- item <ilvl> [amostras]     dispersão de poder por item

Não roda o jogo: só importa sim/ e data/, que são TypeScript puro.`);
}

/**
 * Calcula o `calibre` de cada afixo a partir de medição (§7).
 *
 * O ganho marginal é medido em DOIS níveis de item e a razão usada é a MÉDIA
 * geométrica dos dois. Medir num só ponto calibraria o jogo para aquele ponto:
 * afixo de valor bruto ganha força com o nível e afixo fracionário não, então
 * uma correção tirada do ilvl 270 estragaria o começo do jogo.
 *
 * A correção é AMORTECIDA por `FORCA`. Igualar tudo a 1,00 tornaria os afixos
 * intercambiáveis e apagaria a escolha — em ARPG alguns afixos são melhores, e
 * é isso que faz uma peça ser boa. O objetivo é limitar a dispersão, não zerá-la.
 */
function comandoCalibrar(forca: number): void {
  const PONTOS: [number, number][] = [[40, 5], [250, 9]];
  const soma = new Map<string, number[]>();

  for (const [ilvl, tier] of PONTOS) {
    for (const l of medirAfixos(ilvl, tier)) {
      if (!soma.has(l.def.id)) soma.set(l.def.id, []);
      soma.get(l.def.id)!.push(l.ganho);
    }
  }

  // A referência é a MEDIANA dos ganhos, não a média: um punhado de afixos
  // muito fortes puxaria a média e empurraria todo o resto para cima.
  const razoes = new Map<string, number>();
  for (const [id, ganhos] of soma) {
    const geo = Math.exp(ganhos.reduce((s, g) => s + Math.log(Math.max(g, 1e-9)), 0) / ganhos.length);
    razoes.set(id, geo);
  }
  const ordenadas = [...razoes.values()].filter((v) => v > 1e-6).sort((a, b) => a - b);
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)] ?? 1;

  const linhas: string[][] = [];
  const saturados: string[] = [];
  for (const [id, geo] of razoes) {
    const atual = AFFIXES.find((a) => a.id === id)?.calibre ?? 1;


    /**
     * Ganho zero NÃO é calibrável, e tratá-lo como tal é o erro que este bloco
     * existe para impedir.
     *
     * Um afixo mede zero quando a nave já está no TETO daquele atributo (§40) —
     * cadência 20, crítico 95%, explosão 260, sorte 5. O problema dele é
     * saturação, não magnitude: multiplicar o valor por mil continua dando zero,
     * porque `aplicarLimites` apara depois. Sem esta guarda a fórmula sugeria
     * calibre 73.000 para `pen_f`.
     *
     * O teste é sobre CADA amostra, não sobre a média geométrica: a média de
     * (0, positivo) não é zero, é só pequena — foi assim que a primeira versão
     * desta guarda passou reto e imprimiu os 73.000 mesmo assim.
     */
    if ((soma.get(id) ?? []).some((g) => g <= 1e-6)) { saturados.push(id); continue; }

    // Contagem não é calibrável por outro motivo: "+1,4 projéteis" não existe.
    const def = AFFIXES.find((a) => a.id === id);
    const contagem = def?.stat === 'projeteis' || def?.stat === 'perfuracao';
    const novo = contagem ? 1 : atual * Math.pow(mediana / geo, forca);
    linhas.push([id, n(geo), `${(geo / mediana).toFixed(2)}×`, atual.toFixed(2), novo.toFixed(3)]);
  }

  linhas.sort((a, b) => Number(b[4]) - Number(a[4]));
  tabela(['afixo', 'ganho', 'x mediana', 'calibre', 'sugerido'], linhas);
  console.log(`\namortecimento ${forca} · mediana ${n(mediana)}`);
  console.log('Cole os `sugerido` em `calibre` nos afixos de `data/items.ts` e remeça.');
}


/**
 * Mede os pisos da Provação.
 *
 * Existe para responder três perguntas antes de expandir o modo, como o §84
 * manda: o piso 1 é factível, onde bate a parede, e a luta dura o bastante para
 * o especial aparecer.
 */
function provacao(de: number, ate: number): void {
  console.log('piso  setor  dur(s)  golpes  disp  especial               modificadores / diagnóstico');
  const medidas = [];
  for (let n = de; n <= ate; n++) {
    const m = medirPiso(n);
    medidas.push(m);
    const marca = m.marco ? '*' : ' ';
    console.log(
      (String(n) + marca).padStart(5),
      String(m.setorEquiv).padStart(6),
      m.segParaMatar.toFixed(1).padStart(7),
      m.golpesAteMorrer.toFixed(1).padStart(7),
      String(m.disparosDoEspecial).padStart(5),
      '  ' + m.especial.padEnd(22),
      (m.modificadores.join(',') || '-').padEnd(28),
      diagnosticoDoPiso(m),
    );
  }
  const ruins = medidas.filter((m) => diagnosticoDoPiso(m) !== 'ok');
  console.log(`\n${ruins.length} de ${medidas.length} pisos fora da faixa saudável.`);
}
