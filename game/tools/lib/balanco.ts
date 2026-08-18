/**
 * Medição de balanceamento — a régua, sem a interface.
 *
 * Importa os mesmos módulos de `sim/` e `data/` que o navegador importa. Eles
 * são TypeScript puro, sem DOM e sem canvas, então a mesma função que decide o
 * dano no jogo decide o dano aqui: não há cópia da fórmula, e por isso a
 * medição não pode divergir do jogo real.
 *
 * Separado do CLI (`tools/simular.ts`) porque os testes também consomem isto, e
 * importar um arquivo que executa `process.argv` no topo faria o `vitest`
 * disparar o comando de ajuda a cada suíte.
 */
import { Rng } from '@core/math';
import { HULLS } from '@data/hulls';
import { rollItem } from '@sim/loot';
import { sectorDamage, sectorHp, sectorIlvl } from '@sim/progression';
import { dps, effectiveHp, powerScore, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import { SLOT_IDS, type GameState } from '@sim/types';

/** Faixa saudável fixada na auditoria da FASE 0. */
/**
 * Faixa de tempo para limpar um setor.
 *
 * O teto era 50 s e reprovava coisa que o design aceita: o Rafael declarou que
 * um setor demorar um ou dois minutos não é problema. Com o teto antigo, uma
 * mudança CORRETA na escada de raridade foi reprovada por um limite mais rígido
 * que a intenção — a régua estava mais exigente que o jogo.
 *
 * O piso continua em 6 s: setor que se limpa em menos que isso não é encontro,
 * é corredor.
 */
export const FAIXA_SEGUNDOS = [6, 150] as const;
export const FAIXA_GOLPES = [8, 30] as const;

/**
 * Jogador "bem equipado" para um nível de item.
 *
 * Melhor de `tentativas` rolagens por slot, não uma rolagem só: o jogo é idle e
 * o jogador acumula drops por horas antes de avançar de setor, então a rolagem
 * média subestima grosseiramente o poder real que ele leva para o combate.
 */
export function equiparMelhor(
  ilvl: number,
  hullId: string,
  semente: number,
  tentativas = 40,
  slots = SLOT_IDS.length,
  sorte = 0,
): GameState {
  const st = createState(semente);
  st.hull = hullId;
  const rng = new Rng(semente);

  for (const slot of SLOT_IDS.slice(0, slots)) {
    let melhor = null;
    let melhorNota = -Infinity;
    for (let i = 0; i < tentativas; i++) {
      const item = rollItem(rng, ilvl, sorte, 0, { slot });
      const sonda: GameState = { ...st, equipped: { ...st.equipped, [slot]: item } };
      const nota = powerScore(resolveStats(sonda));
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = item;
      }
    }
    if (melhor) st.equipped[slot] = melhor;
  }
  return st;
}

/**
 * Quanto o jogador já otimizou o equipamento, por setor.
 *
 * Não é constante ao longo do jogo, e tratá-la como constante distorce as
 * pontas: quem está no setor 1 viu duas ou três peças por slot, quem está no
 * 100 já viu centenas e escolhe entre as melhores. Medir tudo com melhor-de-40
 * fazia o começo parecer trivial (2,3 s) quando na prática é o trecho mais
 * apertado do jogo.
 */
export function tentativasDoSetor(setor: number): number {
  return Math.min(40, Math.max(2, Math.round(2 + setor * 0.55)));
}

/**
 * Quantos dos nove slots estão PREENCHIDOS num setor.
 *
 * A falha mais cara da primeira calibragem foi ignorar isto: a medição equipava
 * os nove slots já no setor 1, e o jogador real começa com zero. A curva então
 * pressupunha um poder cinco vezes maior do que o disponível, e o resultado
 * medido no jogo foi espiral de morte — o piloto morria com 17% da onda feita,
 * não coletava item, e por isso nunca saía do lugar.
 *
 * Slot vazio não contribui nada, então preencher os primeiros importa muito
 * mais que melhorar os já preenchidos. É por isso que esta rampa é separada da
 * de `tentativas`, que mede a QUALIDADE do que já está equipado.
 */
export function slotsDoSetor(setor: number): number {
  return Math.min(SLOT_IDS.length, Math.max(1, Math.ceil(setor * 0.6)));
}

/** Melhor casco liberado num setor, pelo tier. */
export function cascoDoSetor(setor: number) {
  return [...HULLS]
    .filter((h) => h.requiresSector <= setor)
    .sort((a, b) => b.tier - a.tier)[0]!;
}

export interface MedidaDeSetor {
  setor: number;
  casco: string;
  dps: number;
  ehp: number;
  hpDaOnda: number;
  danoInimigo: number;
  /** Segundos para limpar a onda. É aqui que o ritmo do jogo aparece. */
  segParaLimpar: number;
  /** Quantos golpes o jogador aguenta. É aqui que a letalidade aparece. */
  golpesAteMorrer: number;
}

/**
 * Mede um setor.
 *
 * `repeticoes` roda a montagem com sementes diferentes e usa a MEDIANA. Uma
 * amostra só oscila de −80% a +240% conforme a sorte das rolagens, e ajustar
 * curva sobre esse ruído produziria expoente errado com aparência de precisão.
 * A mediana também é mais honesta que a média aqui: uma rolagem excepcional não
 * deve puxar a expectativa de todos os jogadores.
 */
/**
 * A SORTE que o jogador daquele setor realmente tem.
 *
 * Era 0,3 fixo, cravado dentro de `equiparMelhor`, e isso desligava o medidor
 * do jogo: a Sorte vem dos itens equipados e volta a decidir a raridade dos
 * próximos, um laço que 0,3 não representa em ponto nenhum da curva. Medido, o
 * jogador vai de 0,2 no setor 30 até saturar o teto de 5 — a diferença entre
 * um extremo e outro multiplica por milhares a chance das raridades altas.
 *
 * Resolve o ponto fixo por iteração: equipa com uma sorte suposta, mede a que
 * o conjunto resultante dá, repete até parar de se mover. Converge em poucas
 * voltas porque a realimentação é forte mas saturada.
 *
 * O resultado é memorizado por setor: o laço é caro (dezenas de conjuntos
 * completos) e o valor não muda dentro de uma execução.
 */
const sorteCache = new Map<number, number>();
export function sorteDoSetor(setor: number): number {
  const posto = sorteCache.get(setor);
  if (posto !== undefined) return posto;

  const ilvl = sectorIlvl(setor);
  const casco = cascoDoSetor(setor).id;
  const tent = tentativasDoSetor(setor);
  const slots = slotsDoSetor(setor);

  let sorte = 0.3;
  for (let volta = 0; volta < 6; volta++) {
    const v: number[] = [];
    for (let i = 0; i < 11; i++) {
      v.push(resolveStats(equiparMelhor(ilvl, casco, 3300 + setor + i * 104729, tent, slots, sorte)).sorte);
    }
    v.sort((a, b) => a - b);
    const proximo = v[5]!;
    if (Math.abs(proximo - sorte) < 0.01) { sorte = proximo; break; }
    sorte = proximo;
  }
  sorteCache.set(setor, sorte);
  return sorte;
}

export function medirSetor(
  setor: number,
  tentativas = tentativasDoSetor(setor),
  repeticoes = 1,
): MedidaDeSetor {
  const casco = cascoDoSetor(setor);
  const ilvl = sectorIlvl(setor);

  const slots = slotsDoSetor(setor);
  const amostras = Array.from({ length: repeticoes }, (_, i) => {
    const stats = resolveStats(
      equiparMelhor(ilvl, casco.id, 1000 + setor + i * 7919, tentativas, slots, sorteDoSetor(setor)),
    );
    return { dps: dps(stats), ehp: effectiveHp(stats) };
  });

  const mediana = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  const d = mediana(amostras.map((a) => a.dps));
  const ehp = mediana(amostras.map((a) => a.ehp));

  return {
    setor,
    casco: casco.id,
    dps: d,
    ehp,
    hpDaOnda: sectorHp(setor),
    danoInimigo: sectorDamage(setor),
    segParaLimpar: sectorHp(setor) / d,
    golpesAteMorrer: ehp / sectorDamage(setor),
  };
}

export function diagnostico(m: MedidaDeSetor): string {
  if (m.segParaLimpar < FAIXA_SEGUNDOS[0]) return 'trivial';
  if (m.segParaLimpar > FAIXA_SEGUNDOS[1]) return 'IMPOSSÍVEL';
  if (m.golpesAteMorrer < FAIXA_GOLPES[0]) return 'letal demais';
  if (m.golpesAteMorrer > FAIXA_GOLPES[1]) return 'sem ameaça';
  return 'ok';
}

/**
 * Ajuste de lei de potência sobre o nível de item.
 *
 * A curva de poder do jogador **não é exponencial**, e é aí que mora o problema
 * estrutural do jogo: o afixo escala com `1 + ilvl × 0,32` e o nível de item
 * cresce linearmente com o setor, então o poder cresce como POLINÔMIO em ilvl.
 * A curva do inimigo é exponencial pura. Uma exponencial sempre ultrapassa um
 * polinômio — não existe constante que conserte isso, só mudar a forma.
 *
 * Por isso o ajuste é `poder = A × ilvl^P`, por mínimos quadrados em escala
 * log-log. `P` sai da medição, não de palpite.
 */
export function ajustarLeiDePotencia(
  amostras: { ilvl: number; valor: number }[],
): { A: number; P: number; C: number; r2: number } {
  const ajusteCom = (C: number) => {
    const pts = amostras.filter((s) => s.valor > 0)
      .map((s) => ({ x: Math.log(s.ilvl + C), y: Math.log(s.valor) }));
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const P = sxy / sxx;
    const A = Math.exp(my - P * mx);
    const ssTot = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
    const ssRes = pts.reduce((s, p) => s + (p.y - (my + P * (p.x - mx))) ** 2, 0);
    return { A, P, C, r2: 1 - ssRes / ssTot };
  };

  // O deslocamento `C` existe por causa do começo do jogo: no nível de item 1 o
  // poder vem quase todo do CASCO, e uma lei de potência pura em ilvl não tem
  // como representar esse piso — ela previa 14 de dano onde a medição dava 296.
  // Varrer `C` e ficar com o melhor R² resolve sem inventar um segundo termo.
  let melhor = ajusteCom(0);
  for (let C = 0.5; C <= 40; C += 0.5) {
    const tentativa = ajusteCom(C);
    if (tentativa.r2 > melhor.r2) melhor = tentativa;
  }
  return melhor;
}

/** Crescimento composto por setor entre duas medidas. */
export function taxaComposta(inicio: number, fim: number, setores: number): number {
  return Math.pow(fim / inicio, 1 / setores);
}

/**
 * Divergência entre a curva do inimigo e a do jogador.
 *
 * É o número que define o ritmo do jogo, e o achado central da FASE 0 foi
 * justamente que ninguém o havia calculado: as duas curvas moram em arquivos
 * diferentes, com expoentes escolhidos de forma independente.
 */
export function divergencia(a: MedidaDeSetor, b: MedidaDeSetor) {
  const span = b.setor - a.setor;
  const rDps = taxaComposta(a.dps, b.dps, span);
  const rHp = taxaComposta(a.hpDaOnda, b.hpDaOnda, span);
  const rEhp = taxaComposta(a.ehp, b.ehp, span);
  const rDano = taxaComposta(a.danoInimigo, b.danoInimigo, span);

  return {
    span,
    rDps, rHp, rEhp, rDano,
    ofensiva: rHp / rDps,
    ofensivaAcumulada: Math.pow(rHp / rDps, span),
    defensiva: rDano / rEhp,
    defensivaAcumulada: Math.pow(rDano / rEhp, span),
  };
}
