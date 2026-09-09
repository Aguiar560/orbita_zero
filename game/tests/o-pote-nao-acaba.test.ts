import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { derivarColeta } from '../server/src/inventario';
import {
  ITENS_POR_POOL, TIPOS, rolarDoCursor, rolarLote, rolarPagina, sementeDaPagina,
  uidDoPote, type TipoDeDrop,
} from '../server/src/lote';

/**
 * O pote do setor não acaba, e cada tipo anda no próprio passo.
 *
 * ## As duas coisas que estavam erradas, e eram a mesma
 *
 * **1. A lista tinha fim.** `rolarLote` rolava desde o item zero e descartava o
 * começo, para a página 3 de hoje ser idêntica à de amanhã. O preço era
 * quadrático — medido: a página 50 custava 1.836 rolagens e 14,8 ms para
 * devolver os mesmos 36 itens que a página 0 entrega com 36 e 0,9 ms. O teto de
 * 50 páginas existia por causa disso, e tinha um efeito colateral que ninguém
 * tinha notado: **o setor acabava em 600 itens por tipo**, e o drop parava.
 *
 * **2. Os três potes seguiam a página de UM.** A rota escolhia a página pelo
 * cursor mais adiantado e aplicava aos três. Como uma elite cai a cada cinco
 * ondas, a elite era arrastada para a página da onda: medido em produção, o
 * cursor da elite pulava de 6 para 27 num único envio. Perto da virada de
 * página a coleta era aparada, e aí o jogador via na mochila uma peça que o
 * servidor nunca criou — ela sumia na sincronização seguinte.
 *
 * A semente por página resolve as duas: a página distante custa o mesmo que a
 * primeira, e por isso não há mais motivo para os tipos compartilharem uma.
 */

const CURSOR_ZERO = { onda: 0, elite: 0, chefe: 0 } as Record<TipoDeDrop, number>;
const uids = (itens: { uid: string }[]): string[] => itens.map((i) => i.uid);

describe('a semente de cada página', () => {
  it('é sempre a mesma para a mesma entrada', () => {
    // É o que garante que a página 3 de hoje seja a página 3 de amanhã, sem
    // precisar passar pelas anteriores para chegar nela.
    expect(sementeDaPagina(12345, 'onda', 7)).toBe(sementeDaPagina(12345, 'onda', 7));
  });

  it('e muda com o tipo — senão os três potes sairiam idênticos', () => {
    // Sem o tipo na mistura, a onda comum soltaria exatamente as mesmas peças
    // que o chefe, e o degrau de raridade entre eles perderia o sentido.
    const vistas = new Set(TIPOS.map((t) => sementeDaPagina(12345, t, 3)));
    expect(vistas.size).toBe(TIPOS.length);
  });

  it('e páginas vizinhas não têm parentesco', () => {
    /**
     * Somar um número pequeno a uma semente produz sequências parecidas em
     * geradores simples, e o resultado seria a página 4 parecer a 3. O
     * finalizador do murmur3 é o que embaralha.
     */
    const a = rolarPagina(999, 40, 1, 0, 'onda', 3);
    const b = rolarPagina(999, 40, 1, 0, 'onda', 4);
    expect(uids(a)).not.toEqual(uids(b));
    expect(new Set([...uids(a), ...uids(b)]).size).toBe(ITENS_POR_POOL * 2);
  });
});

describe('a lista não acaba', () => {
  it('a página distante entrega tanto quanto a primeira', () => {
    for (const pagina of [0, 50, 5_000, 99_999]) {
      const p = rolarPagina(777, 40, 1, 0, 'elite', pagina);
      expect(p, `página ${pagina}`).toHaveLength(ITENS_POR_POOL);
    }
  });

  it('e nenhuma delas repete a outra', () => {
    // O teto de 600 itens por tipo era o que fazia o pote secar de vez. Agora
    // é 1,2 milhão, e mesmo assim o que importa é não repetir pelo caminho.
    const todos = [0, 1, 2, 50, 500, 5_000]
      .flatMap((pagina) => uids(rolarPagina(777, 40, 1, 0, 'elite', pagina)));
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('e custa o mesmo, que é a razão de ela ter podido crescer', () => {
    const medir = (pagina: number): number => {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) rolarPagina(4242, 40, 1, 0, 'onda', pagina);
      return performance.now() - t0;
    };
    medir(0);
    expect(medir(10_000)).toBeLessThan(medir(0) * 4 + 20);
  });
});

describe('cada tipo anda no próprio passo', () => {
  it('a elite atrasada recebe a partir DELA, não da página da onda', () => {
    /**
     * O caso medido em produção: a onda em 30, a elite em 6. A rota antiga
     * escolhia a página 2 (base 24) e entregava à elite os itens 24, 25, 26 —
     * pulando os itens 6 a 23, que ninguém nunca viu.
     */
    const cursor = { onda: 30, elite: 6, chefe: 6 } as Record<TipoDeDrop, number>;
    const doCursor = rolarDoCursor(555, 40, 1, 0, cursor);

    // O primeiro item entregue à elite é EXATAMENTE o item 6 dela.
    const paginaDaElite = rolarPagina(555, 40, 1, 0, 'elite', 0);
    expect(doCursor.elite[0]!.uid).toBe(paginaDaElite[6]!.uid);
  });

  it('e o cursor no meio de uma página emenda com a seguinte', () => {
    // Sem emendar, o pote entregue seria menor perto da virada — e é
    // exatamente disso que vinha o `faltaram_*`.
    const cursor = { onda: 0, elite: 8, chefe: 0 } as Record<TipoDeDrop, number>;
    const doCursor = rolarDoCursor(555, 40, 1, 0, cursor);

    expect(doCursor.elite).toHaveLength(ITENS_POR_POOL);
    const p0 = rolarPagina(555, 40, 1, 0, 'elite', 0);
    const p1 = rolarPagina(555, 40, 1, 0, 'elite', 1);
    expect(uids(doCursor.elite)).toEqual([...uids(p0.slice(8)), ...uids(p1.slice(0, 8))]);
  });

  it('e a coleta perto da virada não é mais aparada', () => {
    /**
     * O sintoma que o jogador via: dois inimigos morrem juntos no fim de uma
     * página, o cliente mostra as duas peças, e o servidor só cria uma. A
     * segunda desaparecia da mochila na sincronização seguinte.
     */
    const cursor = { onda: 23, elite: 4, chefe: 4 } as Record<TipoDeDrop, number>;
    const r = derivarColeta(rolarDoCursor(555, 40, 1, 0, cursor), CURSOR_ZERO, { onda: 2, elite: 3 });

    expect(r.faltaram, 'nada pode faltar com o pote cheio').toEqual({});
    expect(r.itens).toHaveLength(5);
  });

  it('e o cursor avança exatamente o que saiu, sem pular nada', () => {
    // O `base` comum era o que fazia a elite pular de 6 para 27. O cursor novo
    // é o antigo mais o que saiu, e nada além disso.
    const cursor = { onda: 30, elite: 6, chefe: 6 } as Record<TipoDeDrop, number>;
    const r = derivarColeta(rolarDoCursor(555, 40, 1, 0, cursor), CURSOR_ZERO, { elite: 3 });

    expect(cursor.elite + r.cursor.elite).toBe(9);
    expect(cursor.onda + r.cursor.onda).toBe(30);
  });

  it('e o que é entregue é o que a coleta cria — sem discordância possível', () => {
    /**
     * A garantia inteira desta mudança em uma linha: os dois lados derivam do
     * MESMO cursor, então o item que o jogador vê é o item que o servidor
     * grava. Antes, um pedia página e o outro derivava outra.
     */
    const cursor = { onda: 17, elite: 5, chefe: 2 } as Record<TipoDeDrop, number>;
    const entregue = rolarDoCursor(555, 40, 1, 0, cursor);
    const coletado = derivarColeta(rolarDoCursor(555, 40, 1, 0, cursor), CURSOR_ZERO, { onda: 3, elite: 2 });

    expect(uids(coletado.itens)).toEqual([
      ...uids(entregue.onda.slice(0, 3)),
      ...uids(entregue.elite.slice(0, 2)),
    ]);
  });
});

describe('as duas rotas derivam do cursor, e não do cliente', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
  const cliente = readFileSync(new URL('../src/app/lote.ts', import.meta.url), 'utf8');

  it('a entrega lê o cursor do banco', () => {
    expect(index).toContain('const cursor = await cursorDoLote(env, id);');
    expect(index).toContain('rolarDoCursor(semente, setor, sorte, Number(corpo.universo), cursor)');
  });

  it('e a coleta usa o mesmo caminho', () => {
    expect(index).toContain('rolarDoCursor(lote.semente, lote.setor, lote.sorte, 0, cursor)');
  });

  it('e o cliente não escolhe mais página nenhuma', () => {
    // Era a alavanca que ele nunca deveria ter tido. Se ela voltar, a
    // discordância entre entrega e coleta volta junto.
    expect(cliente).not.toMatch(/\bpagina\b/);
  });

  it('e reporta o que coletou ANTES de pedir mais', () => {
    /**
     * O cursor só anda quando a coleta chega ao servidor. Pedir com a fila
     * cheia devolveria os mesmos itens que o jogador acabou de pegar, e o
     * cliente os mostraria duas vezes.
     */
    const i = cliente.indexOf('export async function garantirLote');
    const bloco = cliente.slice(i, cliente.indexOf('} finally', i));
    expect(bloco).toContain('await drenarInventario(sim);');
    expect(bloco.indexOf('await drenarInventario(sim);'))
      .toBeLessThan(bloco.indexOf('await fetch('));
  });
});

describe('o que NÃO mudou', () => {
  it('pedir a mesma coisa duas vezes continua dando o mesmo', () => {
    // É a regra que impede re-rolar: sem ela, bastaria consumir o pote para
    // ganhar outro.
    const a = rolarDoCursor(31337, 40, 1, 0, { onda: 5, elite: 5, chefe: 5 } as never);
    const b = rolarDoCursor(31337, 40, 1, 0, { onda: 5, elite: 5, chefe: 5 } as never);
    for (const t of TIPOS) expect(uids(a[t]), t).toEqual(uids(b[t]));
  });

  it('e sementes diferentes continuam dando lotes diferentes', () => {
    expect(uids(rolarLote(1, 50, 1, 0).onda)).not.toEqual(uids(rolarLote(2, 50, 1, 0).onda));
  });

  it('e toda página continua vindo cheia', () => {
    const lote = rolarLote(555, 40, 1, 0, 7);
    for (const t of TIPOS) expect(lote[t], t).toHaveLength(ITENS_POR_POOL);
  });
});

describe('a identidade do item é reproduzível', () => {
  /**
   * ## O defeito que produção mostrou
   *
   * O desenho da Fase 3a é "o cliente diz QUANTOS pegou, o servidor deriva
   * QUAIS". Derivar só funciona se o item derivado for o MESMO item — e o
   * `uid` padrão sai de `Date.now()` mais um contador mais `Math.random()`.
   * Entrega e coleta produziam peças com os mesmos atributos e identidades
   * diferentes.
   *
   * O livro das recusas registrou o custo em 09/09: **`/inventario ·
   * item_nao_e_seu ×2`** — equipar uma peça recém-caída, recusado, dentro de um
   * 200 que ninguém olhava.
   */
  it('rolar a mesma página duas vezes dá os MESMOS uids', () => {
    const a = rolarPagina(31337, 40, 1, 0, 'onda', 3);
    const b = rolarPagina(31337, 40, 1, 0, 'onda', 3);
    expect(a.map((i) => i.uid)).toEqual(b.map((i) => i.uid));
  });

  it('e o que a entrega mostra é o que a coleta cria', () => {
    // A garantia inteira em uma linha: o item que o jogador vê na mochila é o
    // item que o servidor grava.
    const cursor = { onda: 17, elite: 5, chefe: 2 } as Record<TipoDeDrop, number>;
    const entregue = rolarDoCursor(555, 40, 1, 0, cursor);
    const naColeta = rolarDoCursor(555, 40, 1, 0, cursor);
    expect(naColeta.onda.map((i) => i.uid)).toEqual(entregue.onda.map((i) => i.uid));
  });

  it('e nenhum uid se repete dentro de um setor', () => {
    // `uid` é chave primária global em `itens`: repetir significa um item
    // engolindo outro no banco.
    const todos: string[] = [];
    for (const t of TIPOS) {
      for (const pagina of [0, 1, 2, 37, 4_000]) {
        todos.push(...rolarPagina(31337, 40, 1, 0, t, pagina).map((i) => i.uid));
      }
    }
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('e o uid NÃO revela a semente', () => {
    /**
     * Ele viaja para o cliente. Escrever a semente nele entregaria a chave que
     * faz o pote inteiro ser previsível — e a Fase 3a inteira depende de o
     * cliente não conhecê-la.
     */
    const semente = 123456789;
    const u = uidDoPote(semente, 'onda', 0, 0);
    expect(u).not.toContain(String(semente));
    expect(u).not.toContain(semente.toString(36));
    // E sementes vizinhas não produzem uids parecidos.
    expect(uidDoPote(semente + 1, 'onda', 0, 0)).not.toBe(u);
  });
});
