import { equipamentoDe } from '@sim/stats';
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

describe('fundir de verdade — agora no servidor', () => {
  /**
   * A fusão SAIU do cliente na Fase 3c do Passo 9.
   *
   * Era a última porta por onde um item nascia aqui: dez peças entravam e uma
   * saía de `rollItem` local, então bastava fundir lixo até o resultado
   * agradar — e a peça saía legítima pelos olhos de todo o resto do sistema,
   * inclusive do inventário que a 3b tinha acabado de blindar.
   *
   * As regras não mudaram; mudou quem as aplica. Elas são medidas contra o
   * código do Worker em `fabrica.test.ts` — mesmas raridades, mesmos pesos,
   * mesma média de nível. O que fica AQUI é o que continua sendo do cliente:
   * dizer o que falta antes de gastar uma requisição.
   */
  it('faltaParaFundir aponta o que impede, sem consumir nada', () => {
    const sim = new Sim(createState(1));
    const uids = comItens(sim, 0, 10);

    // Sem recurso, a recusa vem com motivo e o inventário fica intacto — é o
    // que o painel usa para desabilitar o botão em vez de deixar o servidor
    // recusar depois.
    sim.state.resources.nucleo = 0;
    expect(sim.faltaParaFundir(uids).length).toBeGreaterThan(0);
    expect(sim.state.inventory.filter((i) => uids.includes(i.uid))).toHaveLength(10);
  });

  it('abastecido, não falta nada', () => {
    const sim = new Sim(createState(1));
    abastecer(sim, 0);
    expect(sim.faltaParaFundir(comItens(sim, 0, 10))).toEqual([]);
  });

  it('o cliente não tem mais como fundir sozinho', () => {
    // A ausência é o teste. Se `fundirItens` voltar, volta com ela a porta.
    const sim = new Sim(createState(1));
    expect((sim as unknown as Record<string, unknown>).fundirItens).toBeUndefined();
  });
});
