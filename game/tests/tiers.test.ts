import { describe, expect, it } from 'vitest';
import { Rng } from '@core/math';
import { JANELA_DE_TIERS, TIERS, TIER_ILVL, fatorDoTier, tierPorIlvl, tiersDisponiveis } from '@data/balance/tiers';
import { RARITIES } from '@data/rarity';
import { rollItem } from '@sim/loot';
import { montarPacote } from '@sim/dano';
import { FRACAO_ELEMENTAL_MAX } from '@data/balance/elemental';
import { AFFIXES } from '@data/items';
import { comEquipamento, powerScore, resolveStats } from '@sim/stats';
import { createState } from '@sim/state';
import type { Item } from '@sim/types';

/**
 * Tiers de afixo, T1–T10 (§6).
 *
 * O eixo que dá o que caçar depois que a raridade já saiu boa. Errar aqui é
 * errar a magnitude de toda linha de todo item do jogo.
 */
describe('a escada de magnitude', () => {
  it('T1 não altera nada e T10 é o teto de 7×', () => {
    expect(fatorDoTier(1)).toBeCloseTo(1, 6);
    expect(fatorDoTier(TIERS)).toBeCloseTo(7, 6);
  });

  it('cresce sempre — um tier acima nunca vale menos', () => {
    for (let t = 1; t < TIERS; t++) {
      expect(fatorDoTier(t + 1)).toBeGreaterThan(fatorDoTier(t));
    }
  });

  it('tier fora da faixa é aparado, não extrapolado', () => {
    expect(fatorDoTier(0)).toBeCloseTo(fatorDoTier(1), 6);
    expect(fatorDoTier(99)).toBeCloseTo(fatorDoTier(TIERS), 6);
  });
});

describe('os portões por nível de item', () => {
  it('a tabela é monótona: um tier mais alto nunca abre antes', () => {
    for (let t = 1; t < TIERS; t++) {
      expect(TIER_ILVL[t]!, `T${t + 1}`).toBeGreaterThan(TIER_ILVL[t - 1]!);
    }
  });

  it('o nível de item mais baixo do jogo ainda produz T1', () => {
    expect(tierPorIlvl(1)).toBe(1);
    expect(tierPorIlvl(0)).toBe(1);
  });

  it('o nível de item do setor 300 destrava o topo', () => {
    // `curvaIlvl(300)` = 270 com ILVL_POR_SETOR = 0,9.
    expect(tierPorIlvl(270)).toBe(TIERS);
  });
});

describe('a janela de tiers', () => {
  /**
   * A regra que impede o fim do jogo de continuar soltando T1 — sem ela, um
   * item de nível alto sorteia entre dez tiers e quase sempre cai num baixo,
   * ficando PIOR que os de nível médio.
   */
  it('nunca oferece mais que a janela', () => {
    for (const ilvl of [1, 30, 90, 160, 270]) {
      for (const r of RARITIES) {
        expect(tiersDisponiveis(ilvl, r.tierMax).length).toBeLessThanOrEqual(JANELA_DE_TIERS);
      }
    }
  });

  it('o teto respeita o menor entre a raridade e o nível de item', () => {
    // Nível de item altíssimo, raridade baixa: quem limita é a raridade.
    const comum = tiersDisponiveis(270, RARITIES[0]!.tierMax);
    expect(Math.max(...comum.map((o) => o.tier))).toBe(RARITIES[0]!.tierMax);

    // Raridade máxima, nível de item baixo: quem limita é o nível.
    const divinoCedo = tiersDisponiveis(5, RARITIES[6]!.tierMax);
    expect(Math.max(...divinoCedo.map((o) => o.tier))).toBe(tierPorIlvl(5));
  });

  it('o topo da janela é o mais raro', () => {
    const opcoes = tiersDisponiveis(270, TIERS);
    const topo = opcoes.find((o) => o.tier === TIERS)!;
    for (const o of opcoes) {
      if (o.tier < TIERS) expect(o.peso).toBeGreaterThan(topo.peso);
    }
  });

  /**
   * O bug que a indexação por distância-até-o-topo existe para evitar: com a
   * janela curta (começo do jogo), indexar pelo fundo daria ao teto o peso alto
   * do fundo e o tier máximo sairia na MAIORIA das linhas.
   */
  it('mesmo com a janela curta, o teto continua sendo o mais raro', () => {
    const opcoes = tiersDisponiveis(5, 2); // janela de dois tiers só
    expect(opcoes).toHaveLength(2);
    const [baixo, alto] = opcoes;
    expect(alto!.peso).toBeLessThan(baixo!.peso);
  });
});

describe('o tier no item gerado', () => {
  it('toda linha sai com tier dentro da faixa', () => {
    const rng = new Rng(4242);
    for (let i = 0; i < 400; i++) {
      const item = rollItem(rng, 1 + (i % 270), 0, 0);
      for (const a of item.affixes) {
        expect(a.tier, `${item.baseId}/${a.id}`).toBeGreaterThanOrEqual(1);
        expect(a.tier!).toBeLessThanOrEqual(TIERS);
      }
    }
  });

  /**
   * O contrato central: a raridade limita o tier. Se vazar, um Comum pode rolar
   * a mesma linha que um Divino e a raridade perde o sentido.
   */
  it('nenhuma linha ultrapassa o tierMax da própria raridade', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 3000; i++) {
      const item = rollItem(rng, 270, 3, 0);
      const teto = RARITIES[item.rarity]!.tierMax;
      for (const a of item.affixes) {
        expect(a.tier!, `${RARITIES[item.rarity]!.name}/${a.id}`).toBeLessThanOrEqual(teto);
      }
    }
  });

  it('nível de item alto empurra os tiers para cima', () => {
    const media = (ilvl: number) => {
      const rng = new Rng(7);
      let soma = 0; let n = 0;
      for (let i = 0; i < 1500; i++) {
        for (const a of rollItem(rng, ilvl, 0, 0, { floor: 6 }).affixes) { soma += a.tier!; n++; }
      }
      return soma / n;
    };
    expect(media(270)).toBeGreaterThan(media(30));
  });
});

/**
 * Orçamento e peso de atributos (§7).
 *
 * O teste que teria pego o bug de nove afixos inertes anos antes: `pot_*` e as
 * três rendas eram `kind: 'mul'` sobre atributos de base zero, então a conta
 * era `(0 + 0) × (1 + 0,26) = 0`. Rolavam, apareciam na ficha e não faziam nada.
 */
describe('todo afixo precisa mover a nota de poder', () => {
  const base = createState(1);
  const notaBase = powerScore(resolveStats(base));

  /** Equipa um afixo isolado e devolve quanto ele acrescentou. */
  const ganhoDe = (def: typeof AFFIXES[number]): number => {
    const slot = def.slots?.[0] ?? 'principal';
    const item = {
      uid: 'sonda', baseId: 'principal_0', slot, rarity: 0, ilvl: 30,
      element: def.element ?? 'padrao', icon: '', origin: 0,
      affixes: [{ id: def.id, stat: def.stat, kind: def.kind, value: (def.min + def.max) / 2, quality: 0.5, tier: 5 }],
    } as unknown as Item;
    const sonda = comEquipamento(base, slot, item);
    return powerScore(resolveStats(sonda)) - notaBase;
  };

  it.each(AFFIXES.map((a) => [a.id, a] as const))('%s vale alguma coisa', (_id, def) => {
    expect(ganhoDe(def)).toBeGreaterThan(0);
  });

  /**
   * A causa raiz, dita diretamente: um afixo `mul` sobre atributo que ninguém
   * alimenta pelo lado `add` multiplica zero. Se alguém reintroduzir um, aqui
   * quebra.
   */
  it('nenhum afixo é `mul` sobre atributo de base e casco zerados', () => {
    const zerados = AFFIXES.filter((def) => {
      if (def.kind !== 'mul') return false;
      const semAfixo = resolveStats(base);
      return semAfixo[def.stat] === 0;
    }).map((d) => d.id);
    expect(zerados).toEqual([]);
  });
});

/**
 * Canais de dano (§7).
 *
 * O dano tem três canais de multiplicação e o valor de uma linha depende de
 * quão cheio já está o canal que ela alimenta. Foi a descoberta que reorientou
 * a 1.7: medir um afixo sobre nave NUA inverte o resultado, porque afixo
 * multiplicativo vale em proporção à base que multiplica.
 */
describe('a potência elemental não pode dominar o canal', () => {
  const potencia = AFFIXES.filter((a) => a.id.startsWith('pot_'));

  it('existe um afixo de potência para cada elemento', () => {
    expect(potencia).toHaveLength(6);
  });

  /**
   * A invariante mudou na Fase 2, e a razão importa.
   *
   * Na 1.7 a regra era "faixa estreita, porque o canal está vazio": a potência
   * multiplicava o dano INTEIRO (`out.dano *= 1 + potência`), então uma faixa
   * larga a tornava o afixo mais forte do jogo — 4,84× a mediana, medido.
   *
   * Com o `DamagePacket` ela não multiplica mais nada: cria um COMPONENTE
   * próprio, de tamanho `dano × potência`. A faixa pôde voltar a subir, e a
   * restrição que sobra é a do §3 — "não transformar todo o dano da nave em
   * elemental". O normal precisa continuar sendo a maior parte, mesmo com as
   * seis potências no tier máximo.
   */
  it('nem com as seis potências no topo o elemental passa o teto', () => {
    const stats = { ...resolveStats(createState(1)) };
    for (const def of potencia) {
      stats[def.stat] = def.max * fatorDoTier(TIERS);
    }
    const p = montarPacote(stats);
    const elemental = Object.values(p.elementais).reduce((s, v) => s + (v ?? 0), 0);
    const fatia = elemental / (elemental + p.normal);

    // Medido sem o teto: 0,74. A build mais elemental possível do jogo.
    expect(fatia).toBeLessThanOrEqual(FRACAO_ELEMENTAL_MAX + 1e-9);
    // E o componente normal continua existindo — é ele que nenhum inimigo
    // resiste, então zerá-lo tornaria alguém imune a esta build.
    expect(p.normal).toBeGreaterThan(0);
  });

  it('uma nave sem afixo elemental atira 100% normal', () => {
    const p = montarPacote(resolveStats(createState(1)));
    expect(Object.values(p.elementais).reduce((s, v) => s + (v ?? 0), 0)).toBe(0);
    expect(p.normal).toBeGreaterThan(0);
  });

  /**
   * Elas são fração consumida como `1 + x`, então precisam ser `add`. Como
   * `mul` multiplicariam uma base zero e não fariam nada — o bug de nove afixos
   * inertes.
   */
  it('são aditivas, nunca multiplicativas', () => {
    for (const def of potencia) expect(def.kind, def.id).toBe('add');
  });
});

/**
 * Projéteis adicionais (§8).
 *
 * "Não tratar +1 projétil como equivalente a um pequeno aumento percentual de
 * dano" — e de fato não é: medido, valia 5,3× a mediana dos outros afixos. É o
 * atributo com maior potencial multiplicativo do jogo, e o §8 pede restrições
 * específicas em vez de só um peso baixo.
 */
describe('os três degraus de projétil', () => {
  const degraus = AFFIXES.filter((a) => a.stat === 'projeteis');

  it('são três, cada um mais raro que o anterior', () => {
    expect(degraus).toHaveLength(3);
    const pesos = degraus.map((d) => d.weight);
    for (let i = 1; i < pesos.length; i++) expect(pesos[i]!).toBeLessThan(pesos[i - 1]!);
  });

  /**
   * O freio que peso baixo sozinho NÃO dá. Sem portão de raridade, o jogador do
   * setor 300 acaba vendo `+3` só por rolar muito — raro vira questão de tempo,
   * e tempo é justamente o que um idle tem de sobra.
   */
  it('os degraus altos exigem raridade, não só nível', () => {
    const porValor = [...degraus].sort((a, b) => a.min - b.min);
    expect(porValor[0]!.raridadeMin ?? 0).toBe(0);
    expect(porValor[1]!.raridadeMin).toBeGreaterThanOrEqual(4);
    expect(porValor[2]!.raridadeMin).toBe(6);
  });

  it('nenhum item rola mais de um degrau', () => {
    const rng = new Rng(8080);
    let pior = 0;
    for (let i = 0; i < 60_000; i++) {
      const it = rollItem(rng, 250, 3, 0);
      pior = Math.max(pior, it.affixes.filter((a) => a.stat === 'projeteis').length);
    }
    // Medido antes do grupo de exclusão: 23 peças em 89 mil com dois degraus.
    expect(pior).toBeLessThanOrEqual(1);
  });

  it('o portão de raridade vale na prática, não só na tabela', () => {
    const rng = new Rng(1234);
    const violacoes: string[] = [];
    for (let i = 0; i < 60_000; i++) {
      const it = rollItem(rng, 250, 6, 0);
      for (const a of it.affixes) {
        const def = AFFIXES.find((d) => d.id === a.id);
        if (def?.raridadeMin !== undefined && it.rarity < def.raridadeMin) {
          violacoes.push(`${a.id} em raridade ${it.rarity}`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });
});
