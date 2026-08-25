import { describe, expect, it } from 'vitest';
import {
  BRASILIA_OFFSET_MIN, TEMPORADA_1_INICIO, TEMPORADA_MS,
  dataDeBrasilia, horaDeBrasilia, segundosAteVirar, temporadaComecou, temporadaEm,
} from '@data/temporadas';
import { PLACARES, marcaDoJogador, missoesEntregues, navesClassificaveis } from '@sim/ranking';
import { DEMO_ATIVA, DEMO_TOPO, placarDeDemonstracao } from '@sim/ranking-demo';
import { createState } from '@sim/state';

/**
 * A temporada é a única parte do ranking que dá para testar hoje, e é
 * justamente a que precisa estar certa antes do servidor existir: é ela que vai
 * ter de concordar com o back-end sobre qual temporada está correndo. Errar o
 * corte por um fuso significa zerar o placar de alguém no dia errado.
 */

describe('temporadas', () => {
  it('a âncora é 1º de setembro de 2026, 00:00 em Brasília', () => {
    expect(dataDeBrasilia(TEMPORADA_1_INICIO)).toBe('01/09/2026');
    expect(horaDeBrasilia(TEMPORADA_1_INICIO)).toBe('01/09/2026 00:00');
  });

  it('a hora não depende do fuso da máquina — é sempre UTC−3', () => {
    expect(BRASILIA_OFFSET_MIN).toBe(-180);
    // meio-dia UTC é 09:00 em Brasília, rode este teste onde rodar
    expect(horaDeBrasilia(Date.UTC(2026, 8, 15, 12, 0))).toBe('15/09/2026 09:00');
  });

  it('o primeiro instante da temporada 1 já é a temporada 1', () => {
    const t = temporadaEm(TEMPORADA_1_INICIO);
    expect(t.numero).toBe(1);
    expect(t.inicio).toBe(TEMPORADA_1_INICIO);
  });

  it('o último milissegundo ainda é a temporada 1, e o seguinte é a 2', () => {
    // O corte é exclusivo no fim. Se fosse inclusivo, um instante pertenceria a
    // duas temporadas e o placar não saberia em qual gravar.
    expect(temporadaEm(TEMPORADA_1_INICIO + TEMPORADA_MS - 1).numero).toBe(1);
    expect(temporadaEm(TEMPORADA_1_INICIO + TEMPORADA_MS).numero).toBe(2);
  });

  it('as temporadas têm todas a mesma duração — tempo é pontuação', () => {
    for (let n = 0; n < 14; n++) {
      const t = temporadaEm(TEMPORADA_1_INICIO + n * TEMPORADA_MS + 5_000);
      expect(t.numero).toBe(n + 1);
      expect(t.fim - t.inicio).toBe(TEMPORADA_MS);
    }
  });

  it('relógio atrasado cai na temporada 1, não em número negativo', () => {
    const antes = TEMPORADA_1_INICIO - 90 * 86_400_000;
    expect(temporadaEm(antes).numero).toBe(1);
    expect(temporadaComecou(antes)).toBe(false);
    expect(temporadaComecou(TEMPORADA_1_INICIO)).toBe(true);
  });

  it('a conta regressiva nunca é negativa e zera exatamente na virada', () => {
    expect(segundosAteVirar(TEMPORADA_1_INICIO)).toBe(TEMPORADA_MS / 1000);
    expect(segundosAteVirar(TEMPORADA_1_INICIO + TEMPORADA_MS - 1)).toBe(0);
    expect(segundosAteVirar(TEMPORADA_1_INICIO - 999_999)).toBeGreaterThanOrEqual(0);
  });

  it('na pré-temporada conta até o COMEÇO, não até o fim da primeira', () => {
    // `temporadaEm` devolve a temporada 1 também antes da âncora, então contar
    // sempre até `fim` fazia a tela anunciar a virada em vez do começo:
    // medido a 7 dias da âncora, dizia "começa em 34d".
    const seteDias = 7 * 86_400;
    expect(segundosAteVirar(TEMPORADA_1_INICIO - seteDias * 1000)).toBe(seteDias);
  });
});

describe('placares', () => {
  it('são cinco, um por eixo de progresso', () => {
    expect(PLACARES.map((p) => p.id)).toEqual(['provacao', 'galaxia', 'personagem', 'naves', 'missoes']);
  });

  it('galáxia usa o melhor setor ALCANÇADO, não o atual', () => {
    // Recuar para farmar não pode custar posição — quem chegou ao 80 chegou.
    const st = createState(11);
    st.universe.bestSectorEver = 80;
    st.run.sector = 12;
    expect(marcaDoJogador(st, 'galaxia').valor).toBe(80);
  });

  it('personagem desempata pelo XP dentro do nível', () => {
    const st = createState(11);
    st.command.nivel = 300;
    st.command.xp = 4321;
    const m = marcaDoJogador(st, 'personagem');
    expect(m.valor).toBe(300);
    expect(m.desempate).toBe(4321);
  });

  it('missões conta só as ENTREGUES', () => {
    const st = createState(11);
    st.missoes = {
      a: { passos: [1], entregue: true },
      b: { passos: [0], entregue: false },
      c: { passos: [2], entregue: true },
    };
    expect(missoesEntregues(st)).toBe(2);
    expect(marcaDoJogador(st, 'missoes').valor).toBe(2);
  });

  it('naves sem filtro devolve a MELHOR da frota', () => {
    const st = createState(11, 'piloto_darin');
    st.fleet = ['aurora1', 'lanca_rubra'];
    st.naves = {
      aurora1: { nivel: 4, xp: 10, equipped: {} },
      lanca_rubra: { nivel: 9, xp: 3, equipped: {} },
    };
    const m = marcaDoJogador(st, 'naves');
    expect(m.valor).toBe(9);
    expect(m.detalhe).toBe('Lança Rubra');
  });

  it('naves com filtro devolve a nave pedida, mesmo que pior', () => {
    const st = createState(11, 'piloto_darin');
    st.fleet = ['aurora1', 'lanca_rubra'];
    st.naves = {
      aurora1: { nivel: 4, xp: 10, equipped: {} },
      lanca_rubra: { nivel: 9, xp: 3, equipped: {} },
    };
    expect(marcaDoJogador(st, 'naves', 'aurora1').valor).toBe(4);
  });

  it('o filtro lista só a frota, e da melhor para a pior', () => {
    const st = createState(11, 'piloto_sora');
    st.fleet = ['aurora1', 'baluarte_glacial'];
    st.naves = {
      aurora1: { nivel: 2, xp: 0, equipped: {} },
      baluarte_glacial: { nivel: 7, xp: 0, equipped: {} },
    };
    const lista = navesClassificaveis(st);
    expect(lista.map((n) => n.id)).toEqual(['baluarte_glacial', 'aurora1']);
    // um casco fora da frota não aparece
    expect(lista.some((n) => n.id === 'lanca_rubra')).toBe(false);
  });

  it('save novo não inventa marca: tudo em zero ou no piso', () => {
    const st = createState(11);
    expect(marcaDoJogador(st, 'provacao').valor).toBe(0);
    expect(marcaDoJogador(st, 'missoes').valor).toBe(0);
    expect(marcaDoJogador(st, 'personagem').valor).toBe(1);
  });
});

describe('placar de demonstração', () => {
  /**
   * Andaime para avaliar o layout enquanto não há servidor. O que os testes
   * seguram não é a beleza da lista: é ela não MENTIR na direção (marca maior
   * tem de dar posição melhor) e não passar despercebida quando for hora de
   * desligá-la.
   */
  const agora = TEMPORADA_1_INICIO + 1000;

  it('a chave de desligar existe e é uma linha só', () => {
    // Se este teste falhar depois de o servidor entrar, é porque alguém
    // esqueceu de virar a chave — e a lista falsa foi para produção.
    expect(typeof DEMO_ATIVA).toBe('boolean');
  });

  it('é determinístico: a mesma temporada dá a mesma lista', () => {
    // O painel reconstrói a ~5 Hz. Sem isto a lista tremeria a cada quadro e
    // não daria para julgar nada.
    const st = createState(11);
    const a = placarDeDemonstracao(st, 'galaxia', undefined, agora);
    const b = placarDeDemonstracao(st, 'galaxia', undefined, agora + 30_000);
    expect(a.topo.map((l) => l.nome)).toEqual(b.topo.map((l) => l.nome));
    expect(a.total).toBe(b.total);
  });

  it('muda quando a temporada vira', () => {
    const st = createState(11);
    const t1 = placarDeDemonstracao(st, 'galaxia', undefined, agora);
    const t2 = placarDeDemonstracao(st, 'galaxia', undefined, agora + TEMPORADA_MS);
    expect(t1.topo.map((l) => l.nome)).not.toEqual(t2.topo.map((l) => l.nome));
  });

  it('não repete nome — repetido lê como bug, não como coincidência', () => {
    const st = createState(11);
    for (const placar of ['provacao', 'galaxia', 'personagem', 'naves', 'missoes'] as const) {
      const { topo } = placarDeDemonstracao(st, placar, undefined, agora);
      expect(new Set(topo.map((l) => l.nome)).size).toBe(topo.length);
    }
  });

  it('respeita o teto de cada placar — andar 4.100 na Provação denunciaria tudo', () => {
    const st = createState(11);
    const tetos = { provacao: 100, galaxia: 300, personagem: 300, naves: 60, missoes: 140 } as const;
    for (const [placar, teto] of Object.entries(tetos)) {
      const { topo } = placarDeDemonstracao(st, placar as keyof typeof tetos, undefined, agora);
      for (const l of topo) {
        expect(l.valor).toBeGreaterThan(0);
        expect(l.valor).toBeLessThanOrEqual(teto);
      }
    }
  });

  it('o topo desce, nunca sobe', () => {
    const st = createState(11);
    const { topo } = placarDeDemonstracao(st, 'personagem', undefined, agora);
    expect(topo).toHaveLength(DEMO_TOPO);
    for (let i = 1; i < topo.length; i++) {
      expect(topo[i]!.valor).toBeLessThanOrEqual(topo[i - 1]!.valor);
      expect(topo[i]!.posicao).toBe(i + 1);
    }
  });

  it('marca maior dá posição melhor — a demonstração não pode mentir na direção', () => {
    const fraco = createState(11);
    fraco.universe.bestSectorEver = 5;
    const forte = createState(11);
    forte.universe.bestSectorEver = 250;
    const a = placarDeDemonstracao(fraco, 'galaxia', undefined, agora);
    const b = placarDeDemonstracao(forte, 'galaxia', undefined, agora);
    expect(b.eu.posicao).toBeLessThan(a.eu.posicao);
  });

  it('quem não tem marca fica em último, e nunca acima do topo', () => {
    const st = createState(11);
    const { eu, total } = placarDeDemonstracao(st, 'missoes', undefined, agora);
    expect(eu.valor).toBe(0);
    expect(eu.posicao).toBe(total);
    expect(eu.posicao).toBeGreaterThan(DEMO_TOPO);
    expect(eu.euMesmo).toBe(true);
  });
});
