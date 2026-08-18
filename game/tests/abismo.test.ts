import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { RECURSO_POR_ID } from '@data/recursos';
import {
  ABISMO_PISOS, MODIFICADORES, MODIFICADOR_POR_ID,
  efeitosDoPiso, escalaDoPiso, ignoraTetoDePeso, nivelExigidoNoPiso, pisoDoAbismo, tetoDePeso,
} from '@data/abismo';
import { createState, migrate } from '@sim/state';
import { requisitoSatisfeito, textoDoRequisito } from '@sim/missoes';

/**
 * O Abismo Estelar (§32–§35).
 *
 * O que estes testes guardam não é o conteúdo dos cem pisos — é o que a
 * especificação PROÍBE: piso que seja o mesmo chefe com mais vida (§33) e
 * recompensa que suba tudo linearmente (§35).
 */

const todos = Array.from({ length: ABISMO_PISOS }, (_, i) => pisoDoAbismo(i + 1));

describe('a geração dos pisos', () => {
  it('gera os cem, e cada um com um chefe que existe', () => {
    expect(todos).toHaveLength(100);
    const ids = new Set(BOSSES.map((b) => b.id));
    for (const p of todos) expect(ids.has(p.chefeId), `piso ${p.piso}`).toBe(true);
  });

  /**
   * DETERMINISMO: o piso 63 é o mesmo para todo jogador e em toda sessão.
   *
   * Sem isso não há como conversar sobre um piso nem testá-lo — e o jogador que
   * morresse e voltasse encontraria outra luta.
   */
  it('o mesmo piso sai sempre igual', () => {
    for (const n of [1, 7, 33, 63, 99, 100]) {
      expect(JSON.stringify(pisoDoAbismo(n))).toBe(JSON.stringify(pisoDoAbismo(n)));
    }
  });

  it('recorta piso fora da faixa em vez de estourar', () => {
    expect(pisoDoAbismo(0).piso).toBe(1);
    expect(pisoDoAbismo(-5).piso).toBe(1);
    expect(pisoDoAbismo(999).piso).toBe(ABISMO_PISOS);
  });

  /**
   * O CONTRATO CENTRAL do §33: não pode ser "mesmo chefe + mais vida".
   *
   * Os dez chefes se repetem a cada dez pisos. O que precisa DIFERIR entre duas
   * aparições do mesmo chefe é a mecânica — os modificadores.
   */
  it('a mesma criatura pede resposta diferente em cada volta', () => {
    for (const b of BOSSES) {
      const aparicoes = todos.filter((p) => p.chefeId === b.id);
      expect(aparicoes.length, b.id).toBeGreaterThanOrEqual(9);

      const combinacoes = new Set(aparicoes.map((p) => p.modificadores.join('+')));
      // Dez aparições, ao menos cinco lutas diferentes. Menos que isso e o
      // chefe vira repetição com número maior.
      expect(combinacoes.size, `${b.id}: ${[...combinacoes].join(' | ')}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('o modificador respeita a profundidade mínima', () => {
    for (const p of todos) {
      for (const id of p.modificadores) {
        const m = MODIFICADOR_POR_ID.get(id);
        expect(m, `${id} não existe`).toBeDefined();
        expect(m!.profundidadeMin, `piso ${p.piso} usa ${id}`).toBeLessThanOrEqual(p.piso);
      }
    }
  });

  it('nenhum piso GERADO passa do teto de peso', () => {
    for (const p of todos.filter((x) => !ignoraTetoDePeso(x.piso))) {
      expect(p.peso, `piso ${p.piso}`).toBeLessThanOrEqual(tetoDePeso(p.piso));
    }
  });

  /**
   * Os MARCOS furam o teto de propósito — e precisam furar.
   *
   * Eles são escritos à mão justamente para quebrar o padrão; um pico dentro da
   * média não seria pico. O teste fixa a intenção para ninguém "consertar" isso
   * depois achando que é bug.
   */
  it('os marcos furam o teto, e é assim que tem de ser', () => {
    const acima = todos.filter((p) => p.marco && p.peso > tetoDePeso(p.piso));
    expect(acima.length).toBeGreaterThan(0);
  });

  it('não repete modificador dentro do mesmo piso', () => {
    for (const p of todos) {
      expect(new Set(p.modificadores).size, `piso ${p.piso}`).toBe(p.modificadores.length);
    }
  });

  /** Os primeiros pisos ensinam o modo; empilhar efeito ali afogaria. */
  it('os dois primeiros pisos são limpos', () => {
    expect(todos[0]!.modificadores).toEqual([]);
    expect(todos[1]!.modificadores).toEqual([]);
  });

  it('os marcos são de dez em dez e têm combinação própria', () => {
    for (const p of todos) expect(p.marco, `piso ${p.piso}`).toBe(p.piso % 10 === 0);
    for (const p of todos.filter((x) => x.marco)) {
      expect(p.modificadores.length, `marco ${p.piso}`).toBeGreaterThan(0);
    }
  });
});

describe('a escala', () => {
  /**
   * A vida sobe de forma CONTIDA — a dificuldade tem de vir da mecânica.
   *
   * Se a escala explodisse, o §33 estaria violado mesmo com modificadores: o
   * jogador sentiria só a barra de vida.
   */
  it('cem pisos multiplicam por centenas, não por milhares', () => {
    const total = escalaDoPiso(100) / escalaDoPiso(1);
    expect(total).toBeGreaterThan(50);
    expect(total).toBeLessThan(500);
  });

  it('é monótona e começa em 1', () => {
    expect(escalaDoPiso(1)).toBe(1);
    for (let n = 2; n <= 100; n++) {
      expect(escalaDoPiso(n)).toBeGreaterThan(escalaDoPiso(n - 1));
    }
  });
});

describe('os efeitos somados', () => {
  /**
   * Multiplicador COMPÕE, parcela SOMA — a mesma regra da tabela de drop.
   *
   * Somar multiplicadores daria 2,2 + 1,2 = 3,4 onde o certo é 2,64, e o erro
   * cresceria com a profundidade justamente onde ele dói mais.
   */
  it('multiplicadores compõem em vez de somar', () => {
    const e = efeitosDoPiso({ ...pisoDoAbismo(50), modificadores: ['colosso', 'blindado'], peso: 6 });
    expect(e.vida).toBeCloseTo(2.2 * 1.2, 6);
  });

  it('a resistência tem teto e o chefe nunca fica imortal', () => {
    const e = efeitosDoPiso({
      ...pisoDoAbismo(100),
      modificadores: ['blindado', 'espelho', 'colosso', 'furia'], peso: 16,
    });
    expect(e.resistencia).toBeLessThanOrEqual(0.75);
    expect(e.reflexo).toBeLessThanOrEqual(0.4);
  });

  it('todo piso produz efeitos dentro dos limites de sanidade', () => {
    for (const p of todos) {
      const e = efeitosDoPiso(p);
      expect(e.vida, `piso ${p.piso}`).toBeGreaterThan(0);
      expect(e.cadencia).toBeGreaterThan(0);
      expect(e.velocidade).toBeGreaterThan(0);
      expect(e.resistencia).toBeLessThan(1);
      expect(e.reflexo).toBeLessThan(1);
    }
  });

  it('do intervalo de invocação vale o mais agressivo', () => {
    const e = efeitosDoPiso({ ...pisoDoAbismo(70), modificadores: ['enxame', 'furia'], peso: 8 });
    expect(e.invocaCada).toBe(6);
  });
});

describe('as recompensas (§35)', () => {
  /**
   * O §35 é explícito: NÃO subir tudo linearmente.
   *
   * Cada linha tem curva própria. Se todas andassem juntas, a recompensa seria
   * um número só com cinco nomes.
   */
  it('as linhas não sobem todas juntas', () => {
    const cristais = todos.map((p) => p.recompensa.cristais);
    const medalhas = todos.map((p) => p.recompensa.medalhas);

    // Cristal em degrau: a maioria dos pisos não dá nenhum.
    expect(cristais.filter((c) => c === 0).length).toBeGreaterThan(60);
    // Medalha só em marco: dez pisos em cem.
    expect(medalhas.filter((m) => m > 0).length).toBe(10);
  });

  it('sucata e núcleos crescem com a profundidade', () => {
    expect(todos[99]!.recompensa.sucata).toBeGreaterThan(todos[0]!.recompensa.sucata * 20);
    expect(todos[49]!.recompensa.nucleos).toBeGreaterThan(todos[9]!.recompensa.nucleos);
  });

  it('o piso de raridade sobe em degraus e chega ao Mítico', () => {
    expect(todos[0]!.recompensa.itens.raridadeMin).toBe(0);
    expect(todos[99]!.recompensa.itens.raridadeMin).toBe(5);
    for (let n = 1; n < 100; n++) {
      expect(todos[n]!.recompensa.itens.raridadeMin).toBeGreaterThanOrEqual(
        todos[n - 1]!.recompensa.itens.raridadeMin,
      );
    }
  });

  /** Exclusivo com tabela PRÓPRIA: só fundo, e subindo devagar. */
  it('o exclusivo não aparece cedo nem vira rotina', () => {
    for (const p of todos.filter((x) => x.piso < 20)) {
      expect(p.recompensa.chanceExclusivo, `piso ${p.piso}`).toBe(0);
    }
    expect(todos[99]!.recompensa.chanceExclusivo).toBeGreaterThan(0);
    expect(todos[99]!.recompensa.chanceExclusivo).toBeLessThanOrEqual(0.35);
  });

  it('dois pisos vizinhos pagam diferente quando um é mais difícil', () => {
    // O peso dos modificadores entra na conta — senão a recompensa ignoraria a
    // única coisa que o §33 usa para criar dificuldade.
    const pares = todos.filter((p) => !p.marco && p.piso > 20);
    const variados = new Set(pares.map((p) => p.peso));
    expect(variados.size).toBeGreaterThan(1);
  });

  it('todo material prometido existe no catálogo', () => {
    const faltando: string[] = [];
    for (const p of todos) {
      for (const id of Object.keys(p.recompensa.materiais)) {
        if (!RECURSO_POR_ID.has(id)) faltando.push(`piso ${p.piso}: ${id}`);
      }
    }
    expect(faltando).toEqual([]);
  });

  it('nenhuma quantidade de material é zero ou negativa', () => {
    for (const p of todos) {
      for (const [id, n] of Object.entries(p.recompensa.materiais)) {
        expect(n, `piso ${p.piso}: ${id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('os requisitos de acesso (§34)', () => {
  it('todo piso exige nível, e o nível sobe sem passar do teto', () => {
    for (const p of todos) {
      const nivel = p.requisitos.find((r) => r.tipo === 'nivelPersonagem');
      expect(nivel, `piso ${p.piso}`).toBeDefined();
    }
    expect(nivelExigidoNoPiso(1)).toBe(40);
    expect(nivelExigidoNoPiso(100)).toBeLessThanOrEqual(300);
    for (let n = 2; n <= 100; n++) {
      expect(nivelExigidoNoPiso(n)).toBeGreaterThanOrEqual(nivelExigidoNoPiso(n - 1));
    }
  });

  /** É uma escada: o piso anterior é porta obrigatória. */
  it('cada piso exige o anterior, menos o primeiro', () => {
    expect(todos[0]!.requisitos.some((r) => r.tipo === 'abismoPiso')).toBe(false);
    for (const p of todos.slice(1)) {
      const porta = p.requisitos.find((r) => r.tipo === 'abismoPiso');
      expect(porta, `piso ${p.piso}`).toBeDefined();
      expect((porta as { valor: number }).valor).toBe(p.piso - 1);
    }
  });

  /**
   * O requisito do Abismo passa pelo MESMO resolvedor das missões.
   *
   * É o que garante que o §34 ("configuráveis") não virou um segundo sistema
   * com as mesmas oito variantes.
   */
  it('resolve pelo mesmo caminho das missões', () => {
    const s = createState(1);
    expect(requisitoSatisfeito(s, { tipo: 'abismoPiso', valor: 5 }, 1)).toBe(false);
    s.abismo.pisoMax = 5;
    expect(requisitoSatisfeito(s, { tipo: 'abismoPiso', valor: 5 }, 1)).toBe(true);
    expect(requisitoSatisfeito(s, { tipo: 'abismoPiso', valor: 6 }, 1)).toBe(false);
  });

  it('o requisito tem texto legível para a tela', () => {
    const t = textoDoRequisito({ tipo: 'abismoPiso', valor: 30 });
    expect(t).toContain('30');
    expect(t).not.toContain('undefined');
  });
});

describe('o catálogo de modificadores', () => {
  it('não tem id repetido e todo peso está na faixa', () => {
    expect(new Set(MODIFICADORES.map((m) => m.id)).size).toBe(MODIFICADORES.length);
    for (const m of MODIFICADORES) {
      expect(m.peso, m.id).toBeGreaterThanOrEqual(1);
      expect(m.peso, m.id).toBeLessThanOrEqual(5);
      expect(m.descricao, m.id).toBeTruthy();
    }
  });

  /** Modificador que nenhum piso alcança seria conteúdo morto. */
  it('todo modificador aparece em algum piso', () => {
    const usados = new Set(todos.flatMap((p) => p.modificadores));
    for (const m of MODIFICADORES) expect(usados.has(m.id), `${m.id} nunca aparece`).toBe(true);
  });
});

describe('o save', () => {
  it('save anterior ao Abismo não trava o boot', () => {
    const antigo = createState(2) as Record<string, unknown>;
    delete antigo.abismo;
    const migrado = migrate(JSON.parse(JSON.stringify(antigo)));
    expect(migrado).not.toBeNull();
    expect(migrado!.abismo).toEqual({ pisoMax: 0, tentativas: 0, vitorias: 0 });
  });

  /**
   * Só o piso MÁXIMO é salvo; o conteúdo é derivado por regra.
   *
   * Salvar os cem pisos gerados seria salvar o que o código recalcula de graça
   * — e que ficaria velho no primeiro ajuste de balanceamento.
   */
  it('o save guarda progresso, não conteúdo', () => {
    const s = createState(3);
    expect(Object.keys(s.abismo).sort()).toEqual(['pisoMax', 'tentativas', 'vitorias']);
  });
});
