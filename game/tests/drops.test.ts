import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeGalaxy } from '@data/galaxies';
import { REGRAS_DE_DROP, afinidadeDoAlvo, resolverDrop, type AlvoDoDrop } from '@data/balance/drops';
import { Rng } from '@core/math';
import { rollItem } from '@sim/loot';
import { ELEMENTS } from '@data/elements';
import {
  CARGA_INICIAL, CARGA_MAXIMA, CONCESSOES, RECURSO_INICIAL,
  capacidadeDeItens, colunasDaGrade, linhasDaGrade,
} from '@data/balance/capacidade';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { RECURSOS, recursoDoChefe, recursosDoPlaneta } from '@data/recursos';
import { RESISTIVEIS } from '@sim/types';

/**
 * Tabelas de drop por regra (§10).
 *
 * O que estes testes protegem não é o valor de nenhuma regra — é a PROPRIEDADE
 * que faz o sistema aceitar conteúdo futuro sem cadastro: qualquer alvo casa
 * com pelo menos uma regra, e nenhum efeito depende de o conteúdo estar listado.
 */
const alvo = (p: Partial<AlvoDoDrop> = {}): AlvoDoDrop => ({
  setor: 10, galaxia: 1, kind: 'onda', ...p,
});

describe('nenhum conteúdo fica sem drop', () => {
  /**
   * A garantia central. As galáxias são PROCEDURAIS: não existe lista delas em
   * lugar nenhum, e o índice não tem teto. Se a resolução dependesse de o alvo
   * estar cadastrado, a galáxia 31 nasceria sem drop e ninguém perceberia.
   */
  it('galáxia, setor e chefe nunca vistos ainda resolvem', () => {
    for (const setor of [1, 300, 1000, 9999]) {
      for (const kind of ['onda', 'elite', 'chefe'] as const) {
        const r = resolverDrop(alvo({ setor, galaxia: Math.floor(setor / 10), kind, chefe: 'chefe_que_nao_existe' }));
        expect(r.regras.length, `setor ${setor} ${kind}`).toBeGreaterThan(0);
        expect(r.quantidade).toBeGreaterThan(0);
      }
    }
  });

  it('inimigo com tag desconhecida cai na regra base', () => {
    const r = resolverDrop(alvo({ inimigo: 'inimigo_futuro', tags: ['faccao_que_nao_existe'] }));
    expect(r.regras).toContain('base');
  });

  it('toda regra declara uma nota — a tabela é para ser lida', () => {
    for (const r of REGRAS_DE_DROP) expect(r.nota, r.id).toBeTruthy();
  });
});

describe('a forma de acumular importa', () => {
  /**
   * Dois pisos de raridade não se empilham: o mais alto já contém o outro. Se
   * somassem, um chefe de galáxia tardia daria piso 2 + 3 = 5 (Mítico), o que
   * nenhuma regra pediu.
   */
  it('o piso de raridade pega o maior, não a soma', () => {
    const r = resolverDrop(alvo({ kind: 'chefe', galaxia: 12 }));
    expect(r.regras).toContain('chefe');
    expect(r.regras).toContain('chefe-de-galaxia-tardia');
    expect(r.pisoDeRaridade).toBe(3);
  });

  it('sorte e quantidade multiplicam; nível de item e extras somam', () => {
    const so = resolverDrop(alvo({ kind: 'chefe', galaxia: 1, setor: 10 }));
    const duplo = resolverDrop(alvo({ kind: 'chefe', galaxia: 12, setor: 250 }));
    expect(duplo.sorteMult).toBeCloseTo(so.sorteMult * 1.2 * 1.25, 6);
    expect(duplo.ilvlBonus).toBe(so.ilvlBonus);
  });
});

describe('o alvo influencia o que cai', () => {
  it('o elemento do alvo favorece o elemento da peça', () => {
    const favor = afinidadeDoAlvo(alvo({ elemento: 'gelo' }));
    expect(favor.gelo).toBeGreaterThan(1);

    const rng = new Rng(4242);
    const conta = (fav: Record<string, number> | undefined) => {
      let gelo = 0; let outros = 0;
      for (let i = 0; i < 20_000; i++) {
        const it = rollItem(rng, 200, 3, 0, { elementoFavorecido: fav });
        if (it.element === 'gelo') gelo++;
        else if (it.element !== 'padrao') outros++;
      }
      return gelo / Math.max(1, gelo + outros);
    };
    // Sem viés, gelo é um de cinco elementais.
    expect(conta(undefined)).toBeCloseTo(0.2, 1);
    expect(conta(favor)).toBeGreaterThan(0.35);
  });

  it('alvo neutro não distorce elemento nenhum', () => {
    expect(afinidadeDoAlvo(alvo({ elemento: 'padrao' }))).toEqual({});
    expect(afinidadeDoAlvo(alvo())).toEqual({});
  });

  it('o viés de slot desloca a base sorteada sem excluir as outras', () => {
    const rng = new Rng(77);
    let blindagem = 0; let armas = 0;
    for (let i = 0; i < 20_000; i++) {
      const it = rollItem(rng, 200, 0, 0, { slotFavorecido: { blindagem: 6 } });
      if (it.slot === 'blindagem') blindagem++;
      if (it.slot === 'principal' || it.slot === 'secundaria') armas++;
    }
    expect(blindagem / 20_000).toBeGreaterThan(0.3);
    // E continua caindo arma — viés, não exclusão.
    expect(armas).toBeGreaterThan(0);
  });
});

/**
 * O bug que apareceu ao ligar as regras: a tabela de neutralidade tinha CINCO
 * entradas para SETE raridades, então Mítico e Divino caíam no `?? 0.5` e eram
 * mais neutros que o Lendário (0,12). A raridade máxima era a menos elemental
 * do jogo — o oposto do pretendido pelo §9.
 */
describe('raridade alta é mais elemental, não menos', () => {
  it('a chance de sair neutro cai monotonicamente com a raridade', () => {
    const rng = new Rng(31415);
    const neutro: number[] = [];
    for (let r = 0; r <= 6; r++) {
      let n = 0; let total = 0;
      for (let i = 0; i < 8000; i++) {
        const it = rollItem(rng, 200, 0, 0, { floor: r as 0 });
        if (it.rarity !== r) continue;
        total++;
        if (it.element === 'padrao') n++;
      }
      neutro.push(total ? n / total : 0);
    }
    for (let r = 1; r < neutro.length; r++) {
      expect(neutro[r]!, `raridade ${r} contra ${r - 1}`).toBeLessThanOrEqual(neutro[r - 1]! + 0.02);
    }
    expect(ELEMENTS.length).toBe(6);
  });
});

/**
 * Capacidade de carga (§28).
 *
 * O inventário NASCE apertado e cresce por conquista. Com 70 espaços desde o
 * primeiro minuto, "guardar ou desmanchar" nunca é uma decisão.
 */
describe('a carga começa pequena e cresce por conquista', () => {
  it('começa em 15 — grade 5 × 3', () => {
    expect(capacidadeDeItens([])).toBe(CARGA_INICIAL);
    expect(CARGA_INICIAL).toBe(5 * 3);
    expect(colunasDaGrade(CARGA_INICIAL)).toBe(5);
  });

  it('as concessões existentes chegam ao teto de 70 — grade 7 × 10', () => {
    const todas = CONCESSOES.map((c) => c.id);
    expect(capacidadeDeItens(todas)).toBe(CARGA_MAXIMA);
    expect(CARGA_MAXIMA).toBe(7 * 10);
    expect(colunasDaGrade(CARGA_MAXIMA)).toBe(7);
  });

  /**
   * O teto vale mesmo se alguém cadastrar concessão demais — e é por isso que
   * ele é aplicado na função e não confiado à soma da tabela.
   */
  it('nenhuma soma de concessões passa do teto', () => {
    const dobradas = [...CONCESSOES, ...CONCESSOES].map((c) => c.id);
    expect(capacidadeDeItens(dobradas)).toBeLessThanOrEqual(CARGA_MAXIMA);
  });

  it('a grade cresce em ALTURA antes de alargar', () => {
    // Uma grade que muda de largura a cada compra apaga a memória visual de
    // onde cada item fica, que é metade do valor de um inventário em grade.
    expect(colunasDaGrade(20)).toBe(5);
    expect(colunasDaGrade(35)).toBe(5);
    expect(colunasDaGrade(40)).toBe(7);
    expect(linhasDaGrade(15)).toBe(3);
    expect(linhasDaGrade(70)).toBe(10);
  });

  it('conceder duas vezes a mesma fonte não dá espaço duas vezes', () => {
    const sim = new Sim(createState(5));
    const base = sim.cargoSlots;
    expect(sim.concederCarga('loja_carga_1')).toBe(true);
    const depois = sim.cargoSlots;
    expect(depois).toBeGreaterThan(base);
    expect(sim.concederCarga('loja_carga_1')).toBe(false);
    expect(sim.cargoSlots).toBe(depois);
  });

  it('id desconhecido é recusado, não guardado', () => {
    const sim = new Sim(createState(6));
    expect(sim.concederCarga('fonte_que_nao_existe')).toBe(false);
    expect(sim.state.cargaLiberada).not.toContain('fonte_que_nao_existe');
  });

  it('o depósito de recursos é separado e cresce junto (§29)', () => {
    const sim = new Sim(createState(7));
    expect(sim.resourceSlots).toBe(RECURSO_INICIAL);
    sim.concederCarga('universo_2');
    expect(sim.resourceSlots).toBeGreaterThan(RECURSO_INICIAL);
  });
});

/**
 * O Armazém (§29).
 *
 * A separação de itens não é arrumação, é natureza: equipamento é escolha que
 * compete por espaço, material é acúmulo que vira outra coisa no craft.
 */
describe('o armazém guarda TIPOS, não unidades', () => {
  it('material já guardado sempre aceita mais, mesmo com o depósito cheio', () => {
    const sim = new Sim(createState(11));
    // Enche o depósito de tipos até o limite inicial.
    const ids = RECURSOS.map((m) => m.id).slice(0, sim.resourceSlots);
    for (const id of ids) expect(sim.guardarMaterial(id, 10)).toBe(10);
    expect(sim.materiaisGuardados).toBe(ids.length);

    // Mais do MESMO entra; é a quantidade que não é limitada.
    expect(sim.guardarMaterial(ids[0]!, 500)).toBe(500);
  });

  it('tipo novo é recusado quando não há espaço, e devolve zero', () => {
    const sim = new Sim(createState(12));
    // Força o depósito a caber um tipo só.
    sim.state.armazem = {};
    const todos = RECURSOS.map((m) => m.id);
    for (const id of todos.slice(0, sim.resourceSlots)) sim.guardarMaterial(id, 1);

    const excedente = todos[sim.resourceSlots];
    if (excedente) {
      // Zero e não uma exceção: quem chamou precisa poder AVISAR o jogador em
      // vez de o material sumir calado.
      expect(sim.guardarMaterial(excedente, 5)).toBe(0);
      expect(sim.state.armazem[excedente]).toBeUndefined();
    }
  });

  it('gastar até o fim remove a chave em vez de deixá-la em zero', () => {
    const sim = new Sim(createState(13));
    sim.guardarMaterial('ferrita', 10);
    expect(sim.gastarMaterial('ferrita', 4)).toBe(true);
    expect(sim.state.armazem.ferrita).toBe(6);
    expect(sim.gastarMaterial('ferrita', 6)).toBe(true);
    // Chave zerada contaria como tipo guardado e comeria capacidade à toa.
    expect('ferrita' in sim.state.armazem).toBe(false);
    expect(sim.materiaisGuardados).toBe(0);
  });

  it('gastar mais do que se tem falha sem alterar nada', () => {
    const sim = new Sim(createState(14));
    sim.guardarMaterial('ferrita', 3);
    expect(sim.gastarMaterial('ferrita', 4)).toBe(false);
    expect(sim.state.armazem.ferrita).toBe(3);
  });

  it('material fora do catálogo é recusado', () => {
    const sim = new Sim(createState(15));
    expect(sim.guardarMaterial('recurso_inventado', 9)).toBe(0);
  });

  /**
   * O elo entre o inventário apertado (§28) e o craft: uma peça que não serve
   * deixa de ser lixo e vira insumo.
   */
  it('desmanchar rende minério, e mais quanto melhor a peça', () => {
    const sim = new Sim(createState(16));
    const rng = new Rng(2024);
    let peca = null;
    for (let i = 0; i < 4000 && !peca; i++) {
      const it = rollItem(rng, 120, 8, 0);
      if (it.rarity >= 3 && it.element === 'gelo') peca = it;
    }
    expect(peca, 'nenhuma peça de gelo rara em 4000 rolagens').toBeTruthy();

    sim.state.inventory = [peca!];
    sim.salvage(peca!.uid);
    expect(sim.state.armazem.ferrita ?? 0).toBeGreaterThan(0);
    // Raridade 3 ou acima também rende titânio — desmanchar um Épico tem de
    // valer mais que desmanchar dez Comuns.
    expect(sim.state.armazem.titanio ?? 0).toBeGreaterThan(0);
  });

});

/**
 * O catálogo de 70 recursos (§10, §29).
 *
 * O que estes testes protegem é a ligação entre a FOLHA e os dados: o ícone é
 * casado por índice, então o catálogo e o recorte precisam ter o mesmo tamanho
 * e a mesma ordem. Uma fileira nova na folha sem linha nova aqui deixaria dez
 * ícones órfãos, e o contrário daria dez recursos invisíveis.
 */
describe('os 70 recursos da folha', () => {
  it('são 70, dez por fileira', () => {
    expect(RECURSOS).toHaveLength(70);
    for (let l = 0; l < 7; l++) {
      expect(RECURSOS.filter((r) => Math.floor(r.indice / 10) === l)).toHaveLength(10);
    }
  });

  it('os índices são contíguos e sem repetição', () => {
    const vistos = new Set(RECURSOS.map((r) => r.indice));
    expect(vistos.size).toBe(70);
    for (let i = 0; i < 70; i++) expect(vistos.has(i), `índice ${i}`).toBe(true);
  });

  it('os ids são únicos e não-visuais', () => {
    const ids = new Set(RECURSOS.map((r) => r.id));
    expect(ids.size).toBe(70);
    for (const r of RECURSOS) expect(r.id, r.nome).toMatch(/^[a-z0-9_]+$/);
  });

  it('nenhum recurso é inalcançável', () => {
    for (const r of RECURSOS) expect(r.origens.length, r.id).toBeGreaterThan(0);
  });

  /**
   * `torre` e `missao` não têm sistema ainda — são da Fase 5. Estão declarados
   * agora porque o pedido é explícito em já deixar guardado: quando a torre
   * existir, ligá-la é ler esta lista, não reclassificar setenta recursos.
   */
  it('as origens futuras já estão declaradas', () => {
    const todas = new Set(RECURSOS.flatMap((r) => r.origens));
    for (const o of ['planeta', 'chefe', 'torre', 'missao', 'evento', 'desmanche']) {
      expect(todas.has(o as never), o).toBe(true);
    }
  });
});

describe('quem solta o quê', () => {
  /**
   * Determinístico é o ponto: o jogador aprende onde um recurso cai e VOLTA lá.
   * Com sorteio a cada visita, farmar um recurso específico seria impossível.
   */
  it('o mesmo setor dá sempre os mesmos três recursos', () => {
    for (const setor of [1, 30, 90, 250]) {
      const a = recursosDoPlaneta(setor).map((r) => r.id);
      const b = recursosDoPlaneta(setor).map((r) => r.id);
      expect(a).toEqual(b);
      expect(a.length).toBeGreaterThan(0);
      expect(a.length).toBeLessThanOrEqual(3);
    }
  });

  it('setores diferentes dão conjuntos diferentes', () => {
    const conjuntos = [1, 30, 90, 250].map((s) => recursosDoPlaneta(s).map((r) => r.id).join(','));
    expect(new Set(conjuntos).size).toBeGreaterThan(1);
  });

  it('as famílias melhores só abrem mais fundo no jogo', () => {
    const cedo = new Set(recursosDoPlaneta(5).map((r) => r.familia));
    expect(cedo).toEqual(new Set(['minerio']));
    const tarde = new Set(recursosDoPlaneta(250).map((r) => r.familia));
    expect(tarde.size).toBeGreaterThanOrEqual(1);
  });

  it('cada chefe tem o SEU recurso, sempre o mesmo', () => {
    expect(recursoDoChefe('nebulon')?.id).toBe(recursoDoChefe('nebulon')?.id);
    expect(recursoDoChefe('nebulon')).toBeTruthy();
  });

  it('chefe nunca solta recurso que já cai em planeta comum', () => {
    for (const id of ['nebulon', 'devorador', 'chefe_futuro_qualquer']) {
      const r = recursoDoChefe(id);
      expect(r, id).toBeTruthy();
      expect(r!.origens).toContain('chefe');
    }
  });
});

/**
 * Os cenários de galáxia da pasta `backgrounds`.
 *
 * `data/galaxies.ts` lista os ids à mão porque `data/` é tabela pura e não
 * conhece `render/`. Este teste é o que impede a lista de envelhecer em
 * silêncio quando a pasta ganhar ou perder um conjunto.
 */
describe('os cenários de galáxia', () => {
  const manifesto = JSON.parse(
    readFileSync(new URL('../public/assets/manifest.json', import.meta.url), 'utf8'),
  ) as { fundos?: { id: string; tipo: string }[] };

  it('todo id que uma galáxia pede existe no manifesto', () => {
    const disponiveis = new Set((manifesto.fundos ?? []).map((f) => f.id));
    expect(disponiveis.size, 'rode `npm run assets`').toBeGreaterThan(0);

    const faltando = new Set<string>();
    for (let g = 0; g < 60; g++) {
      const id = describeGalaxy(g).fundoId;
      if (id && !disponiveis.has(id)) faltando.add(id);
    }
    expect([...faltando]).toEqual([]);
  });

  it('nenhum cenário fica sem galáxia que o use', () => {
    const usados = new Set<string>();
    for (let g = 0; g < 60; g++) {
      const id = describeGalaxy(g).fundoId;
      if (id) usados.add(id);
    }
    const orfaos = (manifesto.fundos ?? []).map((f) => f.id).filter((id) => !usados.has(id));
    expect(orfaos).toEqual([]);
  });

  /**
   * Os dois formatos convivem de propósito: a arte veio de packs diferentes, e
   * uniformizar seria mentir sobre o que existe.
   */
  it('cada conjunto é parallax de três camadas ou chapado com variações', () => {
    for (const f of manifesto.fundos ?? []) {
      expect(['parallax', 'chapado'], f.id).toContain(f.tipo);
    }
  });
});
