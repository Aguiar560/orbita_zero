/**
 * O lote de itens rolado pelo servidor.
 *
 * ## O que estes testes protegem
 *
 * O buraco que a Fase 3 fecha não é o gerador de itens — é o CONTROLE sobre
 * ele. Quem rola no cliente rola até sair Divino, e o item ruim nunca chega a
 * existir para ser comparado com nada.
 *
 * Fechar isso exigiu tirar do cliente três alavancas: a semente, as regras de
 * drop e a sorte. Cada uma delas, sozinha, reabre o re-rolar — e a forma de
 * reabrir é sempre a mesma e sempre silenciosa: a mesma semente com um
 * parâmetro diferente devolve itens diferentes. É isso que os testes abaixo
 * medem, um parâmetro de cada vez.
 */

import { describe, expect, it } from 'vitest';

import {
  ITENS_POR_POOL, TIPOS, paginaValida, precisaDeLoteNovo, rolarLote, setorValido, sorteValida,
} from '../server/src/lote';

const assinatura = (lote: ReturnType<typeof rolarLote>): string =>
  TIPOS.map((t) => lote[t].map((i) => `${i.baseId}:${i.rarity}:${i.ilvl}`).join(',')).join('|');

describe('o lote é determinístico', () => {
  it('a mesma semente devolve exatamente os mesmos itens', () => {
    // É o que faz reiniciar o setor não re-rolar. Sem isto, morrer de propósito
    // vira o botão de re-rolar que a fase inteira existe para tirar da mesa.
    expect(assinatura(rolarLote(12345, 50, 1.2, 0)))
      .toBe(assinatura(rolarLote(12345, 50, 1.2, 0)));
  });

  it('sementes diferentes dão lotes diferentes', () => {
    // O contrapeso: trocar de setor precisa render loot novo, senão repetir
    // conteúdo deixa de fazer sentido.
    expect(assinatura(rolarLote(1, 50, 1.2, 0)))
      .not.toBe(assinatura(rolarLote(2, 50, 1.2, 0)));
  });

  it('todo pool vem cheio', () => {
    const lote = rolarLote(999, 30, 0.5, 0);
    for (const t of TIPOS) expect(lote[t], t).toHaveLength(ITENS_POR_POOL);
  });
});

describe('as três alavancas do re-rolar estão travadas', () => {
  it('a sorte muda o resultado da MESMA semente — por isso ela é guardada', () => {
    // Este teste não protege um comportamento desejável: ele DOCUMENTA o
    // perigo. Se sorte não fosse travada junto da semente, bastaria pedir o
    // lote com 0,1 · 0,2 · 0,3… até gostar do que veio.
    expect(assinatura(rolarLote(777, 60, 0, 0)))
      .not.toBe(assinatura(rolarLote(777, 60, 3, 0)));
  });

  it('setores VIZINHOS dão o mesmo lote, e isso é fato do jogo', () => {
    // Medido: `sectorIlvl` é granular, então 60 e 61 caem na mesma faixa e na
    // mesma galáxia — o lote sai idêntico. Não é defeito: é o que impede o
    // nível de item de andar de um em um.
    //
    // Mas foi por aqui que a primeira versão de `precisaDeLoteNovo` vazou: ela
    // dava semente nova a cada troca de setor, então alternar 60↔61 era
    // re-rolagem instantânea. Quem fecha isso é o último bloco deste arquivo.
    expect(assinatura(rolarLote(777, 60, 1, 0)))
      .toBe(assinatura(rolarLote(777, 61, 1, 0)));
  });

  it('setores DISTANTES dão lotes diferentes', () => {
    expect(assinatura(rolarLote(777, 10, 1, 0)))
      .not.toBe(assinatura(rolarLote(777, 200, 1, 0)));
  });

  it('as regras de drop NÃO vêm do cliente', async () => {
    // A prova é de forma, não de valor: `rolarLote` não aceita piso de
    // raridade, viés de slot nem bônus de nível. Ela os deriva de
    // `resolverDrop(setor, kind)`. Aceitar qualquer um deles como argumento
    // devolveria a alavanca — a mesma semente com piso diferente dá itens
    // diferentes, e o piso é o parâmetro mais valioso de todos.
    expect(rolarLote.length).toBe(4);
    const fonte = await import('node:fs')
      .then((fs) => fs.readFileSync('server/src/lote.ts', 'utf8'));
    expect(fonte).toContain('resolverDrop({ setor, galaxia, kind })');
  });
});

describe('o chefe continua sendo generoso', () => {
  /**
   * A parte que NÃO podia mudar ao mover a rolagem para o servidor.
   *
   * `pisoDeRaridade` do chefe é o que faz derrubá-lo nunca ser decepcionante,
   * por pior que a rolagem saia. Se o servidor perdesse essa regra, o sintoma
   * seria uma reclamação difusa — "os chefes pioraram" — sem nada no código
   * apontando para a causa.
   */
  it('o pool do chefe respeita o piso de raridade', () => {
    // Piso 2 (Raro) até a galáxia 9; 3 (Épico) a partir da 10.
    for (const [setor, piso] of [[10, 2], [600, 3]] as const) {
      const lote = rolarLote(4242, setor, 1, 0);
      const abaixo = lote.chefe.filter((i) => i.rarity < piso);
      expect(abaixo.map((i) => i.rarity), `setor ${setor}`).toEqual([]);
    }
  });

  it('o pool do chefe tem nível de item acima do da onda comum', () => {
    // `ilvlBonus: 4` no chefe contra 0 na onda. É o outro meio do "vale a pena".
    const lote = rolarLote(31337, 80, 1, 0);
    const media = (xs: { ilvl: number }[]) => xs.reduce((a, b) => a + b.ilvl, 0) / xs.length;
    expect(media(lote.chefe)).toBeGreaterThan(media(lote.onda));
  });

  it('o pool da elite fica entre os dois', () => {
    const lote = rolarLote(31337, 80, 1, 0);
    const media = (xs: { ilvl: number }[]) => xs.reduce((a, b) => a + b.ilvl, 0) / xs.length;
    expect(media(lote.elite)).toBeGreaterThan(media(lote.onda));
    expect(media(lote.elite)).toBeLessThan(media(lote.chefe));
  });
});

describe('o que o cliente declara é aparado', () => {
  it('setor fora da faixa é recusado, não corrigido', () => {
    // Corrigir em silêncio esconderia um cliente quebrado; recusar aparece.
    for (const mau of [0, -5, NaN, Infinity, 'dez', null, 1e9]) {
      expect(setorValido(mau), String(mau)).toBeNull();
    }
    expect(setorValido(1)).toBe(1);
    expect(setorValido(300)).toBe(300);
  });

  it('setor fracionário vira inteiro', () => {
    expect(setorValido(42.9)).toBe(42);
  });

  it('a sorte é limitada nos dois extremos', () => {
    // Sorte é o multiplicador de raridade. Sem teto, `sorte: 1e9` transformaria
    // todo pool em Divino — e diferente do setor, um valor alto aqui é
    // plausível o bastante para não saltar aos olhos numa auditoria.
    expect(sorteValida(-3)).toBe(0);
    expect(sorteValida(NaN)).toBe(0);
    expect(sorteValida('muita')).toBe(0);
    expect(sorteValida(1e9)).toBe(5);
    expect(sorteValida(1.5)).toBe(1.5);
  });
});

describe('lote novo exige evidência de progresso', () => {
  /**
   * A trava que a primeira versão não tinha, e que só apareceu ao medir.
   *
   * Ela devolvia `true` sempre que o setor mudava, apostando que trocar de
   * setor custa tempo de jogo. Não custa nada: o setor é um número que o
   * cliente declara, e alternar entre dois gerava semente nova a cada troca —
   * re-rolagem instantânea, entrando pela porta recém-construída.
   *
   * Agora lote novo exige um lançamento no livro-caixa POSTERIOR ao lote
   * atual: o depósito que acontece quando o setor cai. Forjar o depósito
   * ainda destrava, mas deixa linha em `transacoes` — buraco visível em vez de
   * invisível, que é a troca possível nesta fase.
   */
  const LOTE = { setor: 5, criado_em: 1000 };

  it('primeira vez sempre gera', () => {
    expect(precisaDeLoteNovo(null, 5, 0)).toBe(true);
  });

  it('o mesmo setor reaproveita, mesmo havendo progresso', () => {
    // Morrer e recomeçar o setor devolve o mesmo lote. É o caso principal.
    expect(precisaDeLoteNovo(LOTE, 5, 9999)).toBe(false);
  });

  it('trocar de setor SEM depósito novo não re-rola', () => {
    // O ataque exato: alternar 5↔6 sem nada ter acontecido no meio.
    expect(precisaDeLoteNovo(LOTE, 6, 1000)).toBe(false);
    expect(precisaDeLoteNovo(LOTE, 4, 999)).toBe(false);
  });

  it('trocar de setor DEPOIS de um depósito gera lote novo', () => {
    // O contrapeso: avançar de verdade precisa render loot novo, senão
    // progredir deixa de recompensar.
    expect(precisaDeLoteNovo(LOTE, 6, 1001)).toBe(true);
  });

  it('conta sem nenhum lançamento não destrava nada', () => {
    expect(precisaDeLoteNovo(LOTE, 6, 0)).toBe(false);
  });
});

describe('paginar continua o lote, e não sorteia outro', () => {
  /**
   * O caso que obrigou a paginação, e que só apareceu medindo.
   *
   * O lote é por setor CONCLUÍDO, mas o drop é por abate. Um jogador preso num
   * setor difícil continua matando ondas e nunca conclui — o pote seca e nunca
   * é reposto. Medido: dez minutos morrendo no setor 3 acumularam 39 drops
   * devidos contra 12 no pote.
   *
   * Sortear um lote novo ao esvaziar devolveria o re-rolar: bastaria consumir
   * o pote para ganhar outro. Paginar não devolve, e é isto que se mede aqui.
   */
  it('a mesma página é sempre igual', () => {
    expect(assinatura(rolarLote(555, 40, 1, 0, 3)))
      .toBe(assinatura(rolarLote(555, 40, 1, 0, 3)));
  });

  it('páginas diferentes trazem itens diferentes', () => {
    expect(assinatura(rolarLote(555, 40, 1, 0, 0)))
      .not.toBe(assinatura(rolarLote(555, 40, 1, 0, 1)));
  });

  it('a página 0 é o lote original', () => {
    // Paginar não pode mudar o que o jogador já recebeu na primeira volta.
    expect(assinatura(rolarLote(555, 40, 1, 0)))
      .toBe(assinatura(rolarLote(555, 40, 1, 0, 0)));
  });

  it('toda página vem cheia', () => {
    const lote = rolarLote(555, 40, 1, 0, 7);
    for (const t of TIPOS) expect(lote[t], t).toHaveLength(ITENS_POR_POOL);
  });

  it('a página é limitada', () => {
    // Paginar não re-rola, mas GASTA: cada página são 36 rolagens no Worker.
    expect(paginaValida(-1)).toBe(0);
    expect(paginaValida(1e9)).toBe(50);
    expect(paginaValida(NaN)).toBe(0);
    expect(paginaValida(3.9)).toBe(3);
  });
});