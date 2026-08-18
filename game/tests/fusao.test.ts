import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { RECEITAS, chanceDeSubir, ilvlDaFusao, receitaPara } from '@data/balance/fusao';
import { RECURSO_POR_ID } from '@data/recursos';
import type { Item, Rarity } from '@sim/types';

/**
 * Sacrifício e fusão de itens (§26).
 *
 * Existe para dar destino ao drop inferior no fim do jogo: um Comum ocupa um
 * dos 15 a 70 espaços do inventário e só serve para desmanchar. Dez viram uma
 * tentativa.
 */
const comItens = (sim: Sim, raridade: Rarity, quantos: number, ilvl = 100): string[] => {
  const rng = new Rng(11);
  const uids: string[] = [];
  for (let i = 0; i < quantos; i++) {
    let it: Item | null = null;
    for (let t = 0; t < 3000 && !it; t++) {
      const c = rollItem(rng, ilvl, 0, 0);
      if (c.rarity === raridade) it = c;
    }
    if (!it) throw new Error(`não gerei raridade ${raridade}`);
    sim.state.inventory.push(it);
    uids.push(it.uid);
  }
  return uids;
};

/** Dá recursos e núcleos de sobra para a receita daquela raridade. */
const abastecer = (sim: Sim, raridade: Rarity) => {
  const r = receitaPara(raridade)!;
  sim.state.resources.nucleo = r.nucleos * 10;
  for (const id of Object.keys(r.custo)) sim.guardarMaterial(id, 1e6);
};

describe('as receitas', () => {
  it('cobrem todas as raridades menos a máxima', () => {
    expect(RECEITAS).toHaveLength(6);
    for (let r = 0; r <= 5; r++) expect(receitaPara(r as Rarity), `raridade ${r}`).toBeTruthy();
    // Divino não funde em nada: é o topo.
    expect(receitaPara(6)).toBeUndefined();
  });

  /**
   * A chance CAI conforme sobe. Transformar Comum em Incomum é rotina;
   * transformar Mítico em Divino é aposta — e é essa curva que impede a fusão
   * de virar uma esteira de conversão até o topo.
   */
  /**
   * Compara a chance de SUBIR, derivada dos pesos.
   *
   * A escada tem de ser monótona: um degrau nunca pode parecer mais fácil que o
   * anterior e entregar menos.
   */
  it('a chance cai e o custo sobe a cada degrau', () => {
    for (let i = 1; i < RECEITAS.length; i++) {
      expect(chanceDeSubir(RECEITAS[i]!), RECEITAS[i]!.id).toBeLessThan(chanceDeSubir(RECEITAS[i - 1]!));
      expect(RECEITAS[i]!.nucleos).toBeGreaterThan(RECEITAS[i - 1]!.nucleos);
    }
  });

  it('todo recurso pedido existe no catálogo', () => {
    const faltando: string[] = [];
    for (const r of RECEITAS) {
      for (const id of Object.keys(r.custo)) if (!RECURSO_POR_ID.has(id)) faltando.push(`${r.id}: ${id}`);
    }
    expect(faltando).toEqual([]);
  });

  it('toda receita pode entregar o degrau seguinte', () => {
    for (const r of RECEITAS) {
      expect(r.resultados.some((x) => x.raridade > r.entrada), r.id).toBe(true);
    }
  });

  /**
   * O que não sobe volta na raridade de ENTRADA — em todo degrau.
   *
   * É a regra que substituiu a perda seca: dez Lendários que não viram Mítico
   * devolvem um Lendário. Sem consolação em algum degrau, aquele degrau voltaria
   * a confiscar tudo, que é exatamente o que se removeu.
   */
  it('toda receita devolve a raridade de entrada quando não sobe', () => {
    for (const r of RECEITAS) {
      const consolo = r.resultados.find((x) => x.raridade === r.entrada);
      expect(consolo, `${r.id} não tem consolação`).toBeDefined();

      const total = r.resultados.reduce((s, x) => s + x.peso, 0);
      // Só duas saídas: sobe um degrau, ou fica. Nada de pular raridade nem de
      // descer.
      for (const x of r.resultados) {
        expect(x.raridade === r.entrada || x.raridade === r.entrada + 1).toBe(true);
      }
      // Os pesos e a chance anunciada têm de ser a MESMA coisa: é o que impede
      // a tela de dizer 7% enquanto a tabela sorteia outro número.
      expect(consolo!.peso / total).toBeCloseTo(1 - chanceDeSubir(r), 10);
    }
  });

  /** As chances pedidas, degrau a degrau. */
  it('as chances de subir são as combinadas', () => {
    const esperado = [0.72, 0.48, 0.3, 0.15, 0.07, 0.03];
    RECEITAS.forEach((r, i) => {
      expect(chanceDeSubir(r), r.id).toBeCloseTo(esperado[i]!, 10);
    });
  });

  /**
   * DEZ em todo degrau, do Comum ao Divino.
   *
   * A quantidade fixa é o que torna a escada legível: a regra se aprende uma
   * vez e vale em todo lugar. O que varia entre degraus é chance e custo.
   */
  it('toda receita consome exatamente dez itens', () => {
    for (const r of RECEITAS) expect(r.quantidade, r.id).toBe(10);
  });

  /**
   * Mítico e Divino têm de ser extremamente difíceis, e o teste fixa o número:
   * 7% e 3%. Uma recalibragem que afrouxe isso quebra aqui.
   */
  it('os dois últimos degraus são muito improváveis', () => {
    expect(chanceDeSubir(receitaPara(4)!)).toBeLessThanOrEqual(0.07);
    expect(chanceDeSubir(receitaPara(5)!)).toBeLessThanOrEqual(0.03);
  });
});

describe('o nível do item gerado', () => {
  /**
   * Média e não o MAIOR: com o maior, fundir nove lixos de nível 1 com um bom
   * de nível 270 devolveria um item de 270 por quase nada.
   */
  it('é a média do que entrou', () => {
    expect(ilvlDaFusao([1, 1, 1, 1, 1, 1, 1, 1, 1, 271])).toBe(28);
    expect(ilvlDaFusao([100, 100])).toBe(100);
    expect(ilvlDaFusao([])).toBe(1);
  });
});

describe('fundir de verdade', () => {
  it('consome os itens e devolve um novo', () => {
    const sim = new Sim(createState(1));
    abastecer(sim, 0);
    const uids = comItens(sim, 0, 10);
    const r = sim.fundirItens(uids);
    expect(r).toBeTruthy();
    for (const u of uids) expect(sim.state.inventory.some((i) => i.uid === u)).toBe(false);

    // O item sai por `acquire`, que pode EQUIPÁ-LO em vez de guardar quando o
    // auto-equipar está ligado. Conferir só o inventário faria o teste falhar
    // justamente quando a fusão deu o melhor resultado possível.
    if (r!.item) {
      const guardado = sim.state.inventory.some((i) => i.uid === r!.item!.uid);
      const equipado = Object.values(sim.state.equipped).some((i) => i?.uid === r!.item!.uid);
      expect(guardado || equipado).toBe(true);
    }
  });

  /**
   * O contrato que substituiu a perda seca: SEMPRE sai um item, e cada tentativa
   * cobra igual.
   *
   * O peso da decisão passou a morar na razão dez para um — dez entram, um sai —
   * e não num desfecho vazio. Sem a cobrança em toda tentativa, incluindo as que
   * não sobem, fundir viraria conversão de graça.
   */
  it('sempre devolve um item, e toda tentativa cobra', () => {
    const sim = new Sim(createState(2));
    /**
     * Semente FIXA no rng do `Sim`, que nasce sem uma — o jogo real quer
     * imprevisibilidade. Um teste instável é pior que nenhum: ensina a ignorar
     * vermelho.
     */
    (sim as unknown as { rng: Rng }).rng = new Rng(20260817);
    abastecer(sim, 0);
    const receita = receitaPara(0)!;

    /**
     * Automação DESLIGADA e inventário limpo a cada volta.
     *
     * Sem isso a bagagem enche, `acquire` desmancha o item recém-criado e
     * DEVOLVE núcleos — o saldo subia de 360 para 489 e a conta do custo não
     * fechava. O reembolso é comportamento correto do jogo; ele é que não pode
     * se misturar com a cobrança que este teste mede.
     */
    sim.state.settings.autoEquip = false;
    sim.state.settings.autoSalvage = 0;

    let subiu = 0;
    let manteve = 0;
    const TENTATIVAS = 60;
    for (let t = 0; t < TENTATIVAS; t++) {
      // Reabastece a cada volta: `abastecer` dá dez receitas de núcleos, e o
      // teste agora faz sessenta tentativas inteiras em vez de parar na
      // primeira falha. Sem isto ele fica sem núcleo na décima e a fusão passa a
      // ser RECUSADA — que é outra coisa, e não o que se está medindo.
      sim.state.inventory = [];
      abastecer(sim, 0);
      const nucleosAntes = sim.state.resources.nucleo;
      const uids = comItens(sim, 0, 10);
      const r = sim.fundirItens(uids);

      expect(r, 'a fusão devolveu null com a receita satisfeita').not.toBeNull();
      expect(r!.item, 'saiu sem item — a perda seca não existe mais').toBeTruthy();
      // Os dez entram sempre, subindo ou não.
      for (const u of uids) expect(sim.state.inventory.some((i) => i.uid === u)).toBe(false);
      expect(sim.state.resources.nucleo).toBe(nucleosAntes - receita.nucleos);

      if (r!.item.rarity > 0) subiu++;
      else manteve++;
      // Nunca desce de raridade.
      expect(r!.item.rarity).toBeGreaterThanOrEqual(0);
    }

    expect(subiu + manteve).toBe(TENTATIVAS);
    // Com 72% e semente fixa, os dois desfechos têm de aparecer — se um sumisse,
    // o sorteio estaria preso num deles.
    expect(manteve, 'nenhuma fusão manteve a raridade em 60 tentativas').toBeGreaterThan(0);
    expect(subiu, 'nenhuma fusão subiu em 60 tentativas').toBeGreaterThan(0);
  });

  it('recusa seleção com raridades misturadas', () => {
    const sim = new Sim(createState(3));
    abastecer(sim, 0);
    const uids = [...comItens(sim, 0, 9), ...comItens(sim, 1, 1)];
    expect(sim.faltaParaFundir(uids)).toContain('todos precisam ser da mesma raridade');
    expect(sim.fundirItens(uids)).toBeNull();
  });

  /** Fundir é destrutivo; a marca de favorito existe para proteger disso. */
  it('recusa favoritos', () => {
    const sim = new Sim(createState(4));
    abastecer(sim, 0);
    const uids = comItens(sim, 0, 10);
    sim.state.inventory.find((i) => i.uid === uids[0])!.favorite = true;
    expect(sim.faltaParaFundir(uids)).toContain('há favoritos na seleção');
    expect(sim.fundirItens(uids)).toBeNull();
  });

  it('recusa quando falta recurso, sem consumir nada', () => {
    const sim = new Sim(createState(5));
    const uids = comItens(sim, 0, 10);
    sim.state.resources.nucleo = 0;
    sim.state.armazem = {};

    expect(sim.faltaParaFundir(uids).length).toBeGreaterThan(0);
    expect(sim.fundirItens(uids)).toBeNull();
    // Nada foi tocado.
    for (const u of uids) expect(sim.state.inventory.some((i) => i.uid === u)).toBe(true);
  });

  it('recusa quantidade errada', () => {
    const sim = new Sim(createState(6));
    abastecer(sim, 0);
    const uids = comItens(sim, 0, 4);
    expect(sim.faltaParaFundir(uids).join()).toContain('10 itens');
  });
});

describe('modo de teste e o Armazém', () => {
  /**
   * O modo de teste já dava recursos infinitos pelos quatro do banco e pelos
   * pontos de matriz, mas o Armazém veio depois (§29) e ficou de fora — com o
   * modo ligado a fusão ainda travava por falta de Ferrita. Este teste existe
   * para a próxima fonte de custo não repetir o esquecimento.
   */
  it('não trava a fusão por falta de material', () => {
    const sim = new Sim();
    sim.rng = new Rng(7);
    sim.state.armazem = {}; // armazém VAZIO, de propósito
    sim.setTestMode(true);

    const itens = comItens(sim, 0, 10);
    expect(sim.faltaParaFundir(itens)).toEqual([]);

    expect(sim.materialDisponivel('ferrita')).toBe(Infinity);
    // Gastar não pode quebrar nem criar chave no armazém vazio.
    expect(sim.gastarMaterial('ferrita', 999_999)).toBe(true);
    expect(sim.state.armazem.ferrita).toBeUndefined();
  });

  it('volta a cobrar material quando o modo de teste sai', () => {
    const sim = new Sim();
    sim.setTestMode(true);
    sim.setTestMode(false);
    sim.state.armazem = {};
    expect(sim.materialDisponivel('ferrita')).toBe(0);
    expect(sim.gastarMaterial('ferrita', 1)).toBe(false);
  });
});

/**
 * A raridade sorteada pela receita é a raridade que SAI.
 *
 * A fusão passava o resultado como `floor` — piso —, e o sorteio natural subia
 * por cima dele. Medido: o Divino anunciado a 3% saía a 10,4%, 3,47× mais, e o
 * Mítico a 18,1% em vez de 7%. Justamente as duas raridades que o §26 manda ser
 * extremamente difíceis eram as mais infladas, porque quanto mais baixa a chance
 * anunciada, maior o peso relativo do vazamento.
 */
describe('a raridade que sai é a sorteada', () => {
  it('não sobe além do que a receita decidiu', () => {
    const rng = new Rng(4242);
    for (const r of RECEITAS) {
      const N = 4000;
      let subiu = 0;
      for (let i = 0; i < N; i++) {
        const saida = rng.weighted(r.resultados, (x) => x.peso).raridade;
        const item = rollItem(rng, 100, 0, 0, { exata: saida });
        // A raridade pedida é a entregue — sem sorteio por cima.
        expect(item.rarity).toBe(saida);
        if (item.rarity > r.entrada) subiu++;
      }
      // E o agregado bate com o anunciado, dentro do ruído de 4 mil amostras.
      const desvio = Math.abs(subiu / N - chanceDeSubir(r));
      expect(desvio, `${r.id}: ${(subiu / N * 100).toFixed(1)}% vs ${(chanceDeSubir(r) * 100).toFixed(0)}%`)
        .toBeLessThan(0.03);
    }
  });

  /** `floor` continua sendo piso para quem realmente quer piso — os baús. */
  it('floor continua deixando subir', () => {
    const rng = new Rng(7);
    let acima = 0;
    for (let i = 0; i < 3000; i++) {
      if (rollItem(rng, 100, 0, 0, { floor: 1 }).rarity > 1) acima++;
    }
    expect(acima).toBeGreaterThan(0);
  });
});
