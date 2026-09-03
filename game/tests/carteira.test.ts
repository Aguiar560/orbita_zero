/**
 * O livro-caixa das moedas.
 *
 * ## Por que estes testes são diferentes dos outros
 *
 * O resto da suíte protege diversão: uma curva errada deixa o jogo chato e se
 * conserta no dia seguinte. Aqui a coisa protegida é **dinheiro e prêmio**, e
 * os defeitos correspondentes não se consertam depois:
 *
 * - lançamento gravado errado não pode ser corrigido, porque o livro é
 *   append-only por definição — corrigir seria destruir a prova;
 * - saldo que fica negativo vira um estado que o jogo não sabe mostrar nem
 *   cobrar;
 * - webhook processado duas vezes credita compra que foi paga uma vez.
 *
 * Por isso a regra aqui é mais dura que no resto: o teste cobre o caminho
 * feliz E cada forma conhecida de o lançamento chegar torto.
 */

import { describe, expect, it } from 'vitest';

import {
  MOEDAS, MOTIVOS, TETO_POR_LANCAMENTO,
  conferirLancamento, divergencias, podeDebitar, saldoDoLivro, saldosDoLivro,
  type Lancamento,
} from '../server/src/carteira';

const lancamento = (p: Partial<Lancamento> = {}): Lancamento => ({
  usuario: 'u1', moeda: 'cristal', quantia: 100, motivo: 'compra', em: 1_700_000_000, ...p,
});

describe('o lançamento é conferido antes de virar linha', () => {
  it('aceita um lançamento bem formado', () => {
    expect(conferirLancamento(lancamento())).toBeNull();
  });

  it('recusa moeda que não existe', () => {
    // O jogo tem três moedas. Uma quarta chegando aqui é defeito ou ataque, e
    // nos dois casos o livro não pode ser o lugar onde isso é descoberto.
    expect(conferirLancamento(lancamento({ moeda: 'ouro' as never }))).toBe('moeda_desconhecida');
  });

  it('recusa motivo fora da lista', () => {
    // Motivo livre vira campo de texto que ninguém consulta, e a pergunta "de
    // onde saíram estes cristais" volta a não ter resposta.
    expect(conferirLancamento(lancamento({ motivo: 'porque_sim' as never }))).toBe('motivo_desconhecido');
  });

  it('recusa quantia zero', () => {
    // Lançamento de zero não move saldo e ainda assim ocupa uma linha da
    // auditoria. É ruído no único registro que precisa ser limpo.
    expect(conferirLancamento(lancamento({ quantia: 0 }))).toBe('quantia_invalida');
  });

  it('recusa NaN, infinito e fracionário', () => {
    // Os três chegam de JSON malformado sem nenhum erro no caminho. `NaN`
    // gravado num saldo contamina toda soma futura, e não há como saber
    // depois qual linha o introduziu.
    for (const q of [NaN, Infinity, -Infinity, 1.5, 0.1]) {
      expect(conferirLancamento(lancamento({ quantia: q })), String(q)).toBe('quantia_invalida');
    }
  });

  it('recusa quantia acima do teto de sanidade', () => {
    // Não é balanceamento, é sanidade: um bilhão só chega aqui por defeito ou
    // por ataque, e é melhor recusar do que gravar no que não se corrige.
    expect(conferirLancamento(lancamento({ quantia: TETO_POR_LANCAMENTO + 1 }))).toBe('quantia_absurda');
    expect(conferirLancamento(lancamento({ quantia: -TETO_POR_LANCAMENTO - 1 }))).toBe('quantia_absurda');
  });

  it('aceita exatamente o teto', () => {
    expect(conferirLancamento(lancamento({ quantia: TETO_POR_LANCAMENTO }))).toBeNull();
  });

  it('aceita débito, que é quantia negativa', () => {
    // Um campo com sinal, e não duas colunas: com duas, o saldo deixaria de
    // ser uma soma simples e viraria consulta com CASE.
    expect(conferirLancamento(lancamento({ quantia: -50, motivo: 'loja' }))).toBeNull();
  });

  it('todo motivo declarado é aceito', () => {
    // Guarda contra acrescentar um motivo na lista e esquecer que a validação
    // é feita sobre ela: o motivo novo passaria a ser recusado em produção.
    for (const motivo of MOTIVOS) {
      expect(conferirLancamento(lancamento({ motivo })), motivo).toBeNull();
    }
  });

  it('toda moeda declarada é aceita', () => {
    for (const moeda of MOEDAS) {
      expect(conferirLancamento(lancamento({ moeda })), moeda).toBeNull();
    }
  });
});

describe('o saldo é a soma do livro', () => {
  it('soma créditos e débitos da moeda pedida', () => {
    const livro = [
      lancamento({ moeda: 'cristal', quantia: 500 }),
      lancamento({ moeda: 'cristal', quantia: -200, motivo: 'vip' }),
      lancamento({ moeda: 'sucata', quantia: 9999, motivo: 'drop' }),
    ];
    expect(saldoDoLivro(livro, 'cristal')).toBe(300);
    expect(saldoDoLivro(livro, 'sucata')).toBe(9999);
  });

  it('moeda sem lançamento vale zero, e não indefinido', () => {
    // `undefined` num saldo vira `NaN` na primeira soma e some pela interface
    // como se fosse valor. Zero é a resposta certa e é explícita.
    expect(saldoDoLivro([], 'cristal')).toBe(0);
    expect(saldosDoLivro([])).toEqual({ sucata: 0, nucleo: 0, cristal: 0 });
  });

  it('o livro vazio não inventa moeda', () => {
    expect(Object.keys(saldosDoLivro([])).sort()).toEqual([...MOEDAS].sort());
  });

  it('a ordem dos lançamentos não muda o saldo', () => {
    // Soma é comutativa, e depender da ordem seria o sintoma de alguém ter
    // trocado a soma por uma máquina de estados escondida.
    const a = lancamento({ quantia: 100 });
    const b = lancamento({ quantia: -30, motivo: 'loja' });
    const c = lancamento({ quantia: 7, motivo: 'missao' });
    expect(saldoDoLivro([a, b, c], 'cristal')).toBe(saldoDoLivro([c, a, b], 'cristal'));
  });
});

describe('o cache tem de concordar com o livro', () => {
  it('silencia quando estão de acordo', () => {
    const livro = [lancamento({ quantia: 400 }), lancamento({ quantia: -100, motivo: 'vip' })];
    expect(divergencias(livro, { cristal: 300, sucata: 0, nucleo: 0 })).toEqual([]);
  });

  it('aponta a moeda, o valor do livro e o do cache', () => {
    // A auditoria do pódio precisa saber QUAL moeda divergiu e por quanto —
    // "há divergência" não permite decidir nada.
    const livro = [lancamento({ quantia: 400 })];
    expect(divergencias(livro, { cristal: 999 })).toEqual([
      { moeda: 'cristal', livro: 400, cache: 999 },
    ]);
  });

  it('cache faltando conta como zero, não como igual', () => {
    // O caso perigoso: linha de saldo que nunca foi criada. Tratar ausência
    // como "de acordo" esconderia exatamente a falha que este teste procura.
    expect(divergencias([lancamento({ quantia: 50 })], {})).toEqual([
      { moeda: 'cristal', livro: 50, cache: 0 },
    ]);
  });
});

describe('saldo nunca fica negativo', () => {
  it('deixa gastar o que tem, inclusive tudo', () => {
    expect(podeDebitar(500, 500)).toBe(true);
    expect(podeDebitar(500, 499)).toBe(true);
  });

  it('recusa gastar mais do que tem, mesmo por um', () => {
    // O passe VIP custa 500. Quem tem 499 não compra — e a diferença de um
    // cristal é onde um `>` trocado por `>=` apareceria.
    expect(podeDebitar(499, 500)).toBe(false);
  });

  it('recusa débito de zero ou negativo', () => {
    // Débito negativo é crédito disfarçado: passaria pela conferência de
    // saldo e daria dinheiro a quem pediu para gastar.
    expect(podeDebitar(500, 0)).toBe(false);
    expect(podeDebitar(500, -100)).toBe(false);
  });

  it('conta zerada não gasta nada', () => {
    expect(podeDebitar(0, 1)).toBe(false);
  });
});
