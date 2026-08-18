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
   * Compara a chance REAL de subir, não o campo `chance`.
   *
   * Os dois divergem nos degraus com consolação, e comparar o campo cru deixaria
   * passar uma escada em que um degrau parece mais fácil que o anterior mas
   * entrega menos.
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
   * A consolação existe só onde a chance é generosa.
   *
   * Nos degraus baratos ela faz a fusão bem-sucedida ser boa notícia sem ser
   * garantia. Nos degraus de 7% e 3% ela sairia — dividir um sucesso já raro
   * tornaria o número ANUNCIADO uma mentira: o jogador leria 3% e receberia
   * menos que isso.
   */
  it('consolação só nas receitas generosas', () => {
    for (const r of RECEITAS) {
      const temConsolacao = r.resultados.some((x) => x.raridade === r.entrada);
      expect(temConsolacao, `${r.id} (chance ${r.chance})`).toBe(r.chance >= 0.15);
    }
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
   * O contrato mais delicado: falhar CONSOME. É o que dá peso à decisão — sem
   * risco, fundir seria uma conversão com um passo a mais.
   */
  it('falhar consome os itens e o custo', () => {
    const sim = new Sim(createState(2));
    /**
     * Semente FIXA no rng do `Sim`.
     *
     * Ele nasce sem semente — o jogo real quer imprevisibilidade —, e sem isto
     * o teste dependia de sorte: ele falhou uma vez e passou na seguinte. Um
     * teste instável é pior que nenhum, porque ensina a ignorar vermelho.
     */
    (sim as unknown as { rng: Rng }).rng = new Rng(20260817);
    abastecer(sim, 0);
    const receita = receitaPara(0)!;
    const nucleosAntes = sim.state.resources.nucleo;

    let houveFalha = false;
    for (let tentativa = 0; tentativa < 60 && !houveFalha; tentativa++) {
      const uids = comItens(sim, 0, 10);
      const r = sim.fundirItens(uids);
      if (r && !r.item) {
        houveFalha = true;
        for (const u of uids) expect(sim.state.inventory.some((i) => i.uid === u)).toBe(false);
      }
    }
    expect(houveFalha, 'nenhuma falha em 60 tentativas com 85% de chance').toBe(true);
    // No MÁXIMO o que sobrou: cada tentativa cobra uma receita, e a falha pode
    // vir logo na primeira — foi o que a semente fixa expôs. A asserção pedia
    // gasto ESTRITAMENTE maior que uma receita e quebrava nesse caso.
    expect(sim.state.resources.nucleo).toBeLessThanOrEqual(nucleosAntes - receita.nucleos);
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
