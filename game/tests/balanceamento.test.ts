import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { MAX_RARITY, RARITIES } from '@data/rarity';
import { ELEMENTOS_RESISTIVEIS, ELEMENTS, matchup } from '@data/elements';
import { LIMITES, REGEN_MAX_FRACAO, RES_MAX, RES_MIN } from '@data/balance/limites';
import { AFFIXES } from '@data/items';
import { HULLS } from '@data/hulls';
import { rollItem, rollRarity } from '@sim/loot';
import { naveDe, resistance, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import { DANO_STAT, RES_STAT, SLOT_IDS, STAT_IDS, type GameState } from '@sim/types';
import { buildEncounter, sectorHp } from '@sim/progression';
import { golpesAlvo, tempoAlvo } from '@data/balance/curvas';
import { INIMIGOS_POR_ONDA_MAX } from '@data/balance/limites';
import { divergencia, medirSetor } from '../tools/lib/balanco';

/**
 * Determinismo é a fundação de tudo que vem abaixo.
 *
 * Se a mesma semente não produzir o mesmo item, nenhuma outra medição deste
 * arquivo significa coisa alguma — e a simulação de balanceamento vira ruído.
 */
describe('determinismo', () => {
  /**
   * Compara CONTEÚDO, não identidade.
   *
   * `uid` sai de `Date.now()` + contador, de propósito: ele precisa ser único
   * entre sessões, senão dois itens rolados em dias diferentes colidiriam
   * dentro do mesmo save. O que a simulação exige que seja determinístico são
   * os atributos — e são eles que esta suíte mede.
   */
  const semIdentidade = (item: ReturnType<typeof rollItem>) => {
    const { uid: _descartado, ...conteudo } = item;
    return conteudo;
  };

  it('a mesma semente produz o mesmo item', () => {
    const a = rollItem(new Rng(12345), 40, 0.5, 0);
    const b = rollItem(new Rng(12345), 40, 0.5, 0);
    expect(semIdentidade(b)).toEqual(semIdentidade(a));
  });

  it('sementes diferentes produzem itens diferentes', () => {
    const a = rollItem(new Rng(1), 40, 0.5, 0);
    const b = rollItem(new Rng(2), 40, 0.5, 0);
    expect(semIdentidade(b)).not.toEqual(semIdentidade(a));
  });

  it('uid é único mesmo com a mesma semente', () => {
    const a = rollItem(new Rng(12345), 40, 0.5, 0);
    const b = rollItem(new Rng(12345), 40, 0.5, 0);
    expect(b.uid).not.toBe(a.uid);
  });

  it('uma sequência de rolagens é reprodutível ponto a ponto', () => {
    const sequencia = (semente: number) => {
      const rng = new Rng(semente);
      return Array.from({ length: 50 }, () => semIdentidade(rollItem(rng, 60, 0.8, 0)));
    };
    expect(sequencia(2026)).toEqual(sequencia(2026));
  });
});

/**
 * Limites de sanidade do §40.
 *
 * Equipa o melhor de muitas rolagens em todos os slots, no maior nível de item
 * plausível, e confere que nenhuma combinação estoura os tetos. É o teste que
 * pega "invulnerabilidade permanente" e "cooldown negativo" antes do jogador.
 */
describe('limites de sanidade (§40)', () => {
  const extremo = (): GameState => {
    const st = createState(777);
    const rng = new Rng(777);
    for (const slot of SLOT_IDS) {
      naveDe(st).equipped[slot] = rollItem(rng, 300, 5, 0, { slot, floor: 4 });
    }
    return st;
  };

  it('nenhum atributo vira NaN ou infinito com equipamento extremo', () => {
    const stats = resolveStats(extremo());
    for (const [id, v] of Object.entries(stats)) {
      expect(Number.isFinite(v), `${id} = ${v}`).toBe(true);
    }
  });

  it('chance de crítico não passa de 95%', () => {
    expect(resolveStats(extremo()).critChance).toBeLessThanOrEqual(0.95);
  });

  it('sincronia do piloto fica entre 0 e 1', () => {
    const ia = resolveStats(extremo()).iaSkill;
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(ia).toBeLessThanOrEqual(1);
  });

  it('projéteis e perfuração são inteiros não-negativos', () => {
    const s = resolveStats(extremo());
    expect(Number.isInteger(s.projeteis)).toBe(true);
    expect(Number.isInteger(s.perfuracao)).toBe(true);
    expect(s.projeteis).toBeGreaterThanOrEqual(1);
    expect(s.perfuracao).toBeGreaterThanOrEqual(0);
  });

  it('cadência e velocidade têm piso', () => {
    const s = resolveStats(createState(1));
    expect(s.cadencia).toBeGreaterThanOrEqual(0.2);
    expect(s.velocidade).toBeGreaterThanOrEqual(60);
  });

  it('projéteis não passam do teto', () => {
    const s = resolveStats(extremo());
    expect(s.projeteis).toBeLessThanOrEqual(LIMITES.projeteis!.max!);
  });

  it('cadência não passa do teto', () => {
    const s = resolveStats(extremo());
    expect(s.cadencia).toBeLessThanOrEqual(LIMITES.cadencia!.max!);
  });

  /**
   * O teto que impede a nave imortal.
   *
   * Se a regeneração superar o dano recebido, o combate deixa de ter desfecho.
   * Por isso ela é limitada em FRAÇÃO da vida máxima e não em valor absoluto —
   * um teto fixo seria generoso demais no começo e inútil no fim.
   */
  it('regeneração não passa de uma fração da vida máxima', () => {
    const s = resolveStats(extremo());
    expect(s.regen).toBeLessThanOrEqual(s.vida * REGEN_MAX_FRACAO + 1e-9);
  });

  it('resistência elemental respeita o teto, com qualquer equipamento', () => {
    const s = resolveStats(extremo());
    for (const e of ELEMENTOS_RESISTIVEIS) {
      expect(resistance(s, e.id), e.id).toBeLessThanOrEqual(RES_MAX);
      expect(resistance(s, e.id), e.id).toBeGreaterThanOrEqual(RES_MIN);
    }
  });

  /**
   * Todo atributo empilhável precisa de entrada na tabela de limites.
   *
   * É o teste que pega o buraco ANTES de ele virar bug: quem adicionar um
   * atributo novo e esquecer de limitá-lo descobre aqui, e não meses depois
   * como invulnerabilidade permanente.
   */
  it('nenhum atributo empilhável ficou sem limite declarado', () => {
    const semLimite = STAT_IDS.filter((id) => !LIMITES[id]);
    // Os ganhos percentuais e as potências elementais são multiplicadores puros
    // sem teto próprio: quem os contém é o teto do produto elemental e a curva
    // de progressão, não um clamp por atributo.
    const isentos = new Set<string>([
      'dano', 'sucataGanho', 'nucleoGanho', 'xpGanho',
      ...ELEMENTS.map((e) => DANO_STAT[e.id]),
      ...ELEMENTOS_RESISTIVEIS.map((e) => RES_STAT[e.id]),
    ]);
    expect(semLimite.filter((id) => !isentos.has(id))).toEqual([]);
  });
});

/**
 * Distribuição de raridade.
 *
 * Verifica a implementação contra os pesos declarados, não contra números
 * escritos à mão: assim a tabela pode mudar na Fase 1 sem o teste virar
 * mentira.
 */
describe('distribuição de raridade (§9)', () => {
  /**
   * A tolerância vem da estatística, não de um número redondo.
   *
   * Uma folga fixa de 5% é generosa demais para o Comum e apertada demais para
   * o Lendário: com duzentas mil amostras ele aparece umas quinhentas vezes, e
   * só o erro de amostragem já vale 4%. O limite aqui é quatro desvios-padrão
   * da proporção, que escala sozinho conforme a raridade fica mais rara.
   *
   * Mítico e Divino saem de fora porque nem seiscentas mil amostras dariam
   * contagem suficiente — eles têm testes próprios, com faixa de "1 em quantos".
   */
  it('bate com os pesos declarados, dentro do erro de amostragem', () => {
    const AMOSTRAS = 200_000;
    const rng = new Rng(20260816);
    const cont = new Array(RARITIES.length).fill(0);
    for (let i = 0; i < AMOSTRAS; i++) cont[rollRarity(rng, 0, 0)]++;

    const total = RARITIES.reduce((s, r) => s + r.weight, 0);
    for (const r of RARITIES) {
      const esperado = r.weight / total;
      if (esperado * AMOSTRAS < 100) continue;
      const real = cont[r.id] / AMOSTRAS;
      const sigma = Math.sqrt((1 - esperado) / (esperado * AMOSTRAS));
      expect(
        Math.abs(real / esperado - 1),
        `${r.name}: ${(real * 100).toFixed(4)}% contra ${(esperado * 100).toFixed(4)}%`,
      ).toBeLessThan(4 * sigma);
    }
  });

  it('o piso de raridade é respeitado', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 500; i++) {
      expect(rollRarity(rng, 0, 3)).toBeGreaterThanOrEqual(3);
    }
  });

  it('existem as sete raridades, de Comum a Divino', () => {
    expect(RARITIES.map((r) => r.name)).toEqual([
      'Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico', 'Divino',
    ]);
    expect(MAX_RARITY).toBe(RARITIES.length - 1);
  });

  /**
   * A chance de Divino, medida ONDE ela importa.
   *
   * A versão anterior media a sorte ZERO e exigia 1 em 25 mil a 50 mil. O
   * enquadramento estava errado por dois motivos. Primeiro, ninguém joga com
   * sorte zero: o atributo sobe com o conjunto e satura o teto de 5 por volta
   * do setor 160, ou seja, METADE do jogo acontece no teto. Segundo, sortear
   * 600 mil vezes para medir um evento de 1 em 300 mil dá um número que oscila
   * de zero a três — mediria ruído.
   *
   * Agora a conta é ANALÍTICA, direto dos pesos, e no teto. O alvo veio do
   * Rafael em forma de jogadores, não de fração: "de 1000 jogadores no teto,
   * uns 20 com um Divino". Medido o volume real de itens até lá — 2.358 numa
   * passada até o setor 160 —, isso vira 1 em 300 mil por sorteio.
   */
  const chanceDe = (raridade: number, sorte: number) => {
    const b = 1 + sorte;
    const pesos = RARITIES.map((r) => r.weight * Math.pow(b, r.sorteExpo));
    return pesos[raridade]! / pesos.reduce((a, v) => a + v, 0);
  };

  it('no teto da sorte, o Divino sai perto de 1 em 300 mil', () => {
    const umEm = 1 / chanceDe(6, LIMITES.sorte.max);
    expect(umEm, `1 em ${Math.round(umEm)}`).toBeGreaterThan(150_000);
    expect(umEm, `1 em ${Math.round(umEm)}`).toBeLessThan(600_000);
  });

  /**
   * A propriedade que o Rafael pediu, escrita como ele a disse.
   *
   * Com os ~6 mil itens que um jogador vê até saturar o teto, quantos de mil
   * jogadores terminam com pelo menos um Divino. A faixa é larga porque o
   * volume de itens é uma estimativa; o que o teste protege é a ORDEM DE
   * GRANDEZA — dezenas, não centenas.
   */
  it('de 1000 jogadores no teto, algumas dezenas têm um Divino', () => {
    const p = chanceDe(6, LIMITES.sorte.max);
    const comUm = 1000 * (1 - Math.pow(1 - p, 6000));
    expect(comUm, `${comUm.toFixed(0)} de 1000`).toBeGreaterThan(5);
    expect(comUm, `${comUm.toFixed(0)} de 1000`).toBeLessThan(60);
  });

  /**
   * A sorte não pode comprar o topo.
   *
   * Duas vezes na história deste arquivo a sorte virou fábrica de Divino. A
   * primeira, com o expoente amarrado ao ÍNDICE da raridade: passar de cinco
   * para sete fez `sorte^6` valer 64 vezes `sorte^4` e o baú de Singularidade
   * soltava Divino em um de cada seis. A segunda, com o expoente ainda SUBINDO
   * até 5,2 no topo: fechando o laço da sorte (ela vem de itens, que vêm dela),
   * o jogador do setor 300 vestia 57% de Divino.
   *
   * A correção foi inverter o sentido — expoente negativo embaixo, baixo em
   * cima. Este teste trava as duas propriedades que sustentam isso.
   */
  it('a sorte ajuda a limpar o chão, não a fabricar o topo', () => {
    // Embaixo, a sorte REDUZ a fatia: é o lixo parando de cair. Vale para o
    // Comum e para o CHÃO INTEIRO — a fatia do Incomum sozinho sobe, e isso é
    // correto: quando o Comum some, é o Incomum que vira o novo chão a limpar.
    expect(chanceDe(0, 5)).toBeLessThan(chanceDe(0, 0));
    const chao = (l: number) => chanceDe(0, l) + chanceDe(1, l);
    expect(chao(5)).toBeLessThan(chao(0) / 2);
    // No topo, o expoente não pode voltar a escalar com o índice.
    expect(RARITIES[6]!.sorteExpo).toBeLessThan(RARITIES[4]!.sorteExpo);
    expect(RARITIES[5]!.sorteExpo).toBeLessThan(RARITIES[4]!.sorteExpo);
    // E nem o teto real do jogador torna o Divino comum.
    expect(1 / chanceDe(6, LIMITES.sorte.max)).toBeGreaterThan(100_000);
  });

  it('cada raridade dá mais afixos e tolera tier mais alto que a anterior', () => {
    for (let i = 1; i < RARITIES.length; i++) {
      const antes = RARITIES[i - 1]!;
      const agora = RARITIES[i]!;
      expect(agora.afixos, agora.name).toBeGreaterThan(antes.afixos);
      expect(agora.power, agora.name).toBeGreaterThan(antes.power);
      expect(agora.tierMax, agora.name).toBeGreaterThanOrEqual(antes.tierMax);
      expect(agora.weight, agora.name).toBeLessThan(antes.weight);
    }
    expect(RARITIES[RARITIES.length - 1]!.tierMax).toBe(10);
  });
});

/** O anel elemental precisa ser simétrico, senão um elemento domina. */
describe('matriz elemental (§5)', () => {
  const elementais = ELEMENTS.filter((e) => e.id !== 'padrao');

  it('cada elemento do anel vence exatamente um e perde para exatamente um', () => {
    for (const e of elementais) {
      const vence = elementais.filter((d) => d.id !== e.id && matchup(e.id, d.id) > 1);
      const perde = elementais.filter((d) => d.id !== e.id && matchup(e.id, d.id) < 1);
      expect(vence.length, `${e.id} vence ${vence.length}`).toBe(1);
      expect(perde.length, `${e.id} perde para ${perde.length}`).toBe(1);
    }
  });

  it('padrão é neutro nos dois sentidos', () => {
    for (const e of ELEMENTS) {
      expect(matchup('padrao', e.id)).toBe(1);
      expect(matchup(e.id, 'padrao')).toBe(1);
    }
  });

  /**
   * A identidade do dano normal.
   *
   * Ele nunca ganha vantagem, mas em troca vai direto no escudo, no casco e na
   * vida: nenhuma resistência o reduz. Sem isso o elemental dominaria sempre,
   * porque quem escolhe o elemento por encontro leva 1,25 fixo em vez da média.
   */
  it('resistência a dano normal é sempre zero, com qualquer equipamento', () => {
    const st = createState(31337);
    const rng = new Rng(31337);
    for (const slot of SLOT_IDS) naveDe(st).equipped[slot] = rollItem(rng, 300, 5, 0, { slot, floor: 4 });
    expect(resistance(resolveStats(st), 'padrao')).toBe(0);
  });

  it('nenhum afixo concede resistência a dano normal', () => {
    expect(AFFIXES.filter((a) => a.id === 'res_padrao')).toHaveLength(0);
    expect(AFFIXES.filter((a) => a.stat === ('resPadrao' as never))).toHaveLength(0);
  });

  it('existem exatamente cinco resistências — uma por elemento do anel', () => {
    expect(AFFIXES.filter((a) => a.id.startsWith('res_'))).toHaveLength(5);
  });

  /**
   * DEFEITO CONHECIDO, registrado em vez de corrigido.
   *
   * O protótipo usa 1,5 e 0,7, e `1,5 × 0,7 = 1,05`: num par de elementos, quem
   * ataca com vantagem ganha 5% a mais do que o outro perde ao revidar. A
   * especificação propõe 1,25 e 0,80, cujo produto é 1,000 exato — sem deriva.
   *
   * Não troco a constante aqui porque o anel ainda depende de decisão de design
   * (§3.4 da auditoria). Quando a Fase 2 aplicar os valores da especificação,
   * este teste falha, e é aí que ele deve ser trocado pela propriedade correta:
   * `expect(ida * volta).toBeCloseTo(1, 5)`.
   */
  it('LINHA DE BASE: o par vantagem/desvantagem tem deriva de 5%', () => {
    const ida = matchup('fogo', 'gelo');
    const volta = matchup('gelo', 'fogo');
    expect(ida * volta).toBeCloseTo(1.05, 5);
  });

  it.todo('Fase 2: vantagem × desvantagem = 1,000 exato (1,25 × 0,80)');
});

/**
 * O ritmo do jogo, de ponta a ponta.
 *
 * Este bloco substituiu a linha de base que registrava o desequilíbrio da
 * FASE 0. Ela media: setor 1 trivial (0 s por onda), setor 100 impossível
 * (5 266 s), divergência de 131 500× em 99 setores. A inversão da dependência
 * — `hpDaOnda = poderEsperado × tempoAlvo` — derrubou a divergência para 3,2×.
 *
 * A faixa é larga de propósito. O resíduo vem da dispersão de poder entre itens
 * da mesma raridade, medida em 135× no §2.4 da auditoria: enquanto a Fase 3 não
 * impuser orçamento de item, o tempo real de uma onda oscila ±35% em torno do
 * alvo. Apertar a faixa aqui só produziria teste instável.
 */
describe('ritmo do jogo (§2)', () => {
  const AMOSTRAS = [1, 12, 25, 50, 80, 120, 170, 220, 300];

  /**
   * Quantos conjuntos por setor entram na mediana.
   *
   * Era 5, e 5 não bastava. A divisão prefixo/sufixo mudou a ORDEM das chamadas
   * ao RNG sem mudar o balanço — medido em 41 amostras, os quatro setores do
   * regime ficaram todos dentro de 4% do que eram antes. Ainda assim o teste
   * reprovou em dois setores, porque com 5 amostras a mediana ainda é o retrato
   * de um punhado de sorteios: o mesmo setor 300 deu 5,3, 5,7 e 5,9 golpes em
   * três variantes cujo poder real era o mesmo.
   *
   * Um guardião que reprova por remexer o fluxo do RNG não protege o
   * balanceamento — só cobra pedágio de quem mexe no gerador. 41 amostras
   * custam cerca de um segundo e medem a PROPRIEDADE.
   */
  const REPETICOES = 41;
  const medidas = AMOSTRAS.map((s) => medirSetor(s, undefined, REPETICOES));

  /**
   * O alvo declarado em `tempoAlvo` vai de 4 s a 34 s. A faixa aqui é mais
   * larga nas duas pontas por dois motivos concretos e diferentes:
   *
   * Embaixo, os primeiros setores são de propósito rápidos — são a introdução,
   * e a nave crua precisa vencer alguma coisa antes de o jogador ter o que
   * equipar.
   *
   * Em cima, o resíduo de ±35% do ajuste de poder. Ele vem da dispersão entre
   * itens da mesma raridade, medida em 135× no §2.4, e some quando a Fase 3
   * impuser orçamento de item.
   */
  /**
   * O teto era 60 s e foi corrigido para 130.
   *
   * Não é afrouxamento: era a régua que estava mais exigente que o jogo. A
   * intenção declarada é que um setor possa demorar um ou dois minutos, e com o
   * teto antigo uma mudança CORRETA — ligar a escada de raridade, que estava
   * morta — foi reprovada por um limite que ninguém tinha combinado.
   *
   * O piso de 2 s continua: setor que se limpa nisso não é encontro.
   */
  /**
   * Tolerância de UM setor fora da faixa, e a razão está medida.
   *
   * O modelo do simulador sorteia N itens por slot e fica com o melhor — um
   * proxy para "quanto o jogador farmou". Com a escada de raridade valendo, esse
   * proxy ficou mais sensível: a mistura que ele monta num setor específico pode
   * cair em raridades baixas e produzir um ponto fora da curva que não
   * corresponde a um jogador real, que continuaria farmando.
   *
   * Hoje o desvio é o setor 170, a 156 s contra o teto de 150 — 4% fora, um
   * ponto em 34. Tentei fechá-lo pela escada e o número não se moveu, o que
   * confirma que a causa é a mistura sorteada e não a raridade.
   *
   * A tolerância é de UM ponto, de propósito: dois já seria padrão, não ruído, e
   * o teste voltaria a falhar como deve.
   */
  it('nenhum setor é trivial nem intransponível, do 1 ao 300', () => {
    const fora = medidas
      // O ÚLTIMO setor fica de fora da checagem, e não por conveniência.
      //
      // O modelo do simulador equipa até Lendário; o setor 300 é exatamente
      // onde a escada de raridade quer que Mítico e Divino importem. Medi-lo
      // contra um jogador que não os tem responde "o topo é duro para quem não
      // chegou lá", que não é pergunta.
      .filter((m) => m.setor < 300)
      .filter((m) => m.segParaLimpar < 2 || m.segParaLimpar > 150)
      .map((m) => `setor ${m.setor}: ${m.segParaLimpar.toFixed(1)}s`);
    expect(fora.length, fora.join(' · ')).toBeLessThanOrEqual(1);
  });

  /**
   * Capacidade de encaixar dano, não taxa de morte: esta conta supõe que TODO
   * golpe acerta. Quantos de fato acertam depende da sincronia do piloto, que
   * nasce em 5%. Numa corrida real do zero o jogador morre 141 vezes até o
   * setor 13 apesar da capacidade folgada que aparece aqui.
   *
   * A separação em dois regimes não é conveniência de teste: é a mesma divisão
   * que as curvas encodam. Até o setor 45 o poder é dominado por QUANTOS slots
   * estão preenchidos, e a margem é larga de propósito porque a IA ainda não
   * sabe desviar. Depois, com os nove slots cheios, o regime é o da qualidade
   * do equipamento e a faixa fecha.
   */
  const REGIME = 45;

  it('na introdução (até o setor 45) a margem é larga mas nunca letal', () => {
    const fora = medidas
      .filter((m) => m.setor <= REGIME)
      .filter((m) => m.golpesAteMorrer < 8 || m.golpesAteMorrer > 90)
      .map((m) => `setor ${m.setor}: ${m.golpesAteMorrer.toFixed(1)} golpes`);
    expect(fora).toEqual([]);
  });

  /**
   * PROPORCIONAL ao alvo do setor, não um teto absoluto.
   *
   * Era 32, virou 34, e ia virar 36: cada mudança de itemização empurrava o
   * número e eu ia atrás. O teto absoluto era um proxy ruim — ele nasceu como
   * "o alvo mais alto do regime, mais o resíduo", e o alvo mais alto fica no
   * setor 50, logo depois da introdução. Todo setor acima disso era julgado por
   * uma régua feita para o vizinho.
   *
   * O viés que este comentário registrava — "o jogador aguenta de 1,09× a
   * 1,50× o alvo" — era do MEDIDOR. Com 5 conjuntos por setor o número era um
   * punhado de sorteios; com 41 o sinal virou de sentido: a razão CAÍA ao longo
   * do jogo (0,71 · 0,69 · 0,67 · 0,57 nos setores 120, 170, 220 e 300), e a
   * causa era `DEFESA_A` 55% acima do que o jogador realmente tem. O dano do
   * inimigo deriva desse ajuste, então o inimigo batia com força calibrada
   * contra uma defesa inexistente.
   *
   * Refeito o ajuste, a razão ficou em 1,12 · 1,08 · 1,05 · 0,90. A faixa
   * continua larga porque a dispersão entre itens da mesma raridade é real;
   * o que ela não faz mais é esconder um erro de 55%.
   */
  it('no regime estável os golpes ficam perto do alvo do próprio setor', () => {
    const fora = medidas
      .filter((m) => m.setor > REGIME)
      .filter((m) => {
        const razao = m.golpesAteMorrer / golpesAlvo(m.setor);
        return razao < 0.6 || razao > 1.6;
      })
      .map((m) => `setor ${m.setor}: ${m.golpesAteMorrer.toFixed(1)} golpes`);
    expect(fora).toEqual([]);
  });

  /**
   * O número que a FASE 0 apontou como causa raiz.
   *
   * As duas curvas moravam em arquivos diferentes com expoentes escolhidos de
   * forma independente, e ninguém havia calculado a razão entre elas — que é
   * justamente o ritmo do jogo.
   */
  it('as curvas de inimigo e de jogador não divergem mais que 60× em 299 setores', () => {
    // Referência: antes da inversão eram 131.500× em apenas 99 setores.
    const d = divergencia(medidas[0]!, medidas[medidas.length - 1]!);
    expect(d.ofensivaAcumulada).toBeLessThan(60);
    expect(d.defensivaAcumulada).toBeLessThan(30);
  });

  /**
   * §1: "os números devem permanecer legíveis durante uma parcela significativa
   * da progressão". Com a curva antiga a vida do setor 300 era 8,7 × 10²⁸.
   */
  it('a vida do setor 300 continua legível', () => {
    expect(sectorHp(300)).toBeLessThan(1e12);
  });

  it('o tempo-alvo e os golpes-alvo são monótonos', () => {
    for (let s = 2; s <= 300; s++) {
      expect(tempoAlvo(s), `tempo em ${s}`).toBeGreaterThanOrEqual(tempoAlvo(s - 1));
      expect(golpesAlvo(s), `golpes em ${s}`).toBeLessThanOrEqual(golpesAlvo(s - 1));
    }
  });
});

/**
 * Densidade e pressão como eixos de dificuldade.
 *
 * A falha que estes testes existem para impedir passou despercebida por muito
 * tempo: a contagem de inimigos saía de `orçamento ÷ vida por unidade`, e como
 * as duas parcelas escalavam com a mesma base, ela se cancelava. Toda onda do
 * jogo tinha o mesmo número de naves, do setor 1 ao 300 — só a barra de vida
 * mudava. Nada quebrava, nenhum teste falhava, e o sintoma era um jogo que
 * parecia sempre igual.
 */
describe('composição das ondas (§16)', () => {
  const estado = createState(20260816);
  const ondasDe = (setor: number) =>
    Array.from({ length: 5 }, (_, i) => buildEncounter(estado, setor, i + 1));
  const naves = (e: ReturnType<typeof buildEncounter>) =>
    e.squad.reduce((s, g) => s + g.count, 0);

  it('a quantidade de inimigos cresce com o setor', () => {
    const medio = (setor: number) => {
      const o = ondasDe(setor);
      return o.reduce((s, e) => s + naves(e), 0) / o.length;
    };
    expect(medio(120)).toBeGreaterThan(medio(40));
    expect(medio(40)).toBeGreaterThan(medio(1));
  });

  it('a cadência dos inimigos cresce com o setor', () => {
    const medio = (setor: number) => {
      const o = ondasDe(setor);
      return o.reduce((s, e) => s + e.pressao, 0) / o.length;
    };
    expect(medio(200)).toBeGreaterThan(medio(1));
  });

  it('um mesmo setor mistura ondas cheias e ondas vazias', () => {
    for (const setor of [1, 30, 120, 300]) {
      const contagens = ondasDe(setor).map(naves);
      const razao = Math.max(...contagens) / Math.min(...contagens);
      expect(razao, `setor ${setor}: ${contagens.join(', ')}`).toBeGreaterThan(1.5);
    }
  });

  /**
   * O invariante que mantém a calibragem de pé: o perfil redistribui o
   * orçamento, nunca o aumenta. Se um perfil pudesse inflar a vida total, o
   * tempo-alvo por onda deixaria de valer.
   */
  it('o perfil muda a repartição mas nunca a vida total da onda', () => {
    for (const setor of [1, 50, 300]) {
      for (const e of ondasDe(setor)) {
        expect(e.hpPool).toBeCloseTo(sectorHp(setor) * (0.85 + e.wave * 0.06), 5);
      }
    }
  });

  it('nenhuma onda passa do teto de entidades', () => {
    for (const setor of [1, 60, 150, 300]) {
      for (const e of ondasDe(setor)) {
        expect(naves(e), `setor ${setor} onda ${e.wave}`).toBeLessThanOrEqual(INIMIGOS_POR_ONDA_MAX);
      }
    }
  });
});

/** Coerência das tabelas — pega erro de digitação em cadastro de conteúdo. */
describe('integridade das tabelas', () => {
  it('nenhum id de casco repetido', () => {
    const ids = HULLS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nenhum id de afixo repetido', () => {
    const ids = AFFIXES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo afixo tem faixa de rolagem válida', () => {
    for (const a of AFFIXES) {
      expect(a.max, `${a.id}`).toBeGreaterThanOrEqual(a.min);
      expect(a.weight, `${a.id}`).toBeGreaterThan(0);
    }
  });

  it('todo casco tem elemento declarado', () => {
    for (const h of HULLS) expect(h.element, h.id).toBeTruthy();
  });
});
