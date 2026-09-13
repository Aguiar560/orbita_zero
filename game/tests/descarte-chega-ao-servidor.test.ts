import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Rarity } from '@sim/types';
import { derivarColeta, vagasNaMochila } from '../server/src/inventario';
import { rolarDoCursor, TIPOS, type TipoDeDrop } from '../server/src/lote';

/**
 * O caminho inteiro do descarte automático, dos dois lados.
 *
 * Relato de 12/09/2026: "o setor foi concluído e recebi dois itens no
 * inventário mesmo com o descarte automático abaixo de raro". Uma peça Comum
 * em vinte escapava — e o livro das recusas mostrava `acima_do_teto` dezenas de
 * vezes com a carga em 2/70, que é o sintoma de o servidor não reconhecer os
 * descartes que o cliente manda.
 *
 * O teste roda o pipeline de verdade, sem servidor falso: o pote sai de
 * `rolarDoCursor` (o MESMO código do Worker), o cliente coleta e descarta, e
 * então o servidor deriva do cursor e aplica os comandos. Se os `uid` dos dois
 * lados divergirem, a asserção final pega.
 */

const CORTE = 2 as Rarity; // abaixo de Raro

function simComPote(semente: number, setor = 3) {
  const estado = createState(semente);
  const sim = new Sim(estado);
  sim.jumpSector(setor);
  estado.vip.expiresAt = Date.now() + 86_400_000;
  estado.settings.autoEquip = false;
  estado.settings.autoSalvage = CORTE;
  estado.comandosDeItem.length = 0;

  // O pote do servidor, entregue ao cliente como a rota `/lote` entrega.
  const cursorZero = { onda: 0, elite: 0, chefe: 0 } as Record<TipoDeDrop, number>;
  const pote = rolarDoCursor(semente, setor, 0, 0, cursorZero);
  sim.receberLote(pote);
  return { sim, estado, pote, cursorZero };
}

describe('o que o cliente descarta, o servidor não guarda', () => {
  it('todo item coletado ou é descartado ou está na carga — nunca some do radar', () => {
    const { sim, estado } = simComPote(4242);

    for (let onda = 0; onda < 300; onda++) {
      for (const item of sim.rollDrops('onda', undefined, 0)) sim.acquire(item);
    }

    const coletados = estado.comandosDeItem.filter((c) => c.tipo === 'coletar').length;
    const descartados = estado.comandosDeItem.filter((c) => c.tipo === 'descartar');
    expect(coletados, 'o pote não rendeu nada — o teste mediria o vazio').toBeGreaterThan(0);

    // A conta que fecha: tudo que saiu do pote virou carga ou virou descarte.
    expect(descartados.length + estado.inventory.length).toBe(coletados);
  });

  it('e o servidor, aplicando os mesmos comandos, guarda só o que ficou', () => {
    const { sim, estado, cursorZero } = simComPote(777);

    for (let onda = 0; onda < 300; onda++) {
      for (const item of sim.rollDrops('onda', undefined, 0)) sim.acquire(item);
    }

    // ── o lado do servidor, com o código do servidor ──────────────────────
    const pedido: Partial<Record<TipoDeDrop, number>> = {};
    for (const tipo of TIPOS) {
      const n = estado.comandosDeItem.filter((c) => c.tipo === 'coletar' && c.pote === tipo).length;
      if (n) pedido[tipo] = n;
    }
    const descartar = estado.comandosDeItem
      .filter((c): c is { tipo: 'descartar'; uid: string } => c.tipo === 'descartar')
      .map((c) => c.uid);

    const rolado = rolarDoCursor(777, sim.state.run.sector, 0, 0, cursorZero);
    const coleta = derivarColeta(rolado, cursorZero, pedido);
    const descartados = new Set(descartar);

    // O servidor grava o que nasceu e NÃO morreu no mesmo lote.
    const gravados = coleta.itens.filter((item) => !descartados.has(item.uid));

    expect(gravados.map((i) => i.uid).sort())
      .toEqual(estado.inventory.map((i) => i.uid).sort());
    // E nenhuma peça abaixo do corte sobrevive no servidor.
    expect(gravados.filter((i) => i.rarity < CORTE), 'peça abaixo do corte foi gravada')
      .toHaveLength(0);
  });

  it('e o teto da mochila não é gasto pelo que foi descartado', () => {
    /**
     * Era o sintoma no livro das recusas: `acima_do_teto` dezenas de vezes com
     * a carga quase vazia. Se o descarte não for reconhecido, cada peça
     * consumida pela automação ainda ocupa uma vaga na conta do servidor — e a
     * partir da septuagésima ele começa a recusar coleta de quem tem duas
     * peças guardadas.
     */
    const mochila = ['a', 'b'];
    const descartar = Array.from({ length: 60 }, (_, i) => `x${i}`);

    expect(vagasNaMochila(mochila, descartar, 70), 'o descarte gastou vaga').toBe(68);
  });
});

describe('a trava: nenhuma escrita nova de item passa despercebida', () => {
  /**
   * A auditoria que fecha o assunto, feita em 12/09/2026 depois de o defeito
   * ser consertado DUAS vezes em lugares diferentes: primeiro a coleta das
   * ondas, que não avisava o servidor do descarte; depois a ausência, que
   * simulava sem passe e sem corte e gravava o que a automação teria comido.
   *
   * Consertar caminho por caminho até não sobrar nenhum é o que se fez. Esta
   * trava é para o PRÓXIMO caminho: qualquer escrita nova em `itens` quebra o
   * build até alguém dizer se ela respeita o descarte automático.
   */
  const PERMITIDO: Record<string, number> = {
    // A coleta das ondas (respeita `descartar`), a fusão (item único, pedido
    // pelo jogador) e a ausência (simula com o passe e o corte reais).
    'server/src/index.ts': 3,
  };

  it('só as três escritas auditadas criam item', () => {
    const fonte = readFileSync('server/src/index.ts', 'utf8');
    const escritas = (fonte.match(/INSERT (?:OR IGNORE )?INTO itens\b/g) ?? []).length;

    expect({ 'server/src/index.ts': escritas },
      'apareceu (ou sumiu) uma escrita de item fora da lista auditada')
      .toEqual(PERMITIDO);
  });

  it('e a ausência simula com o passe e o corte do jogador', () => {
    // Era o buraco: `montarEstado` não preenchia `vip` nem `autoSalvage`, então
    // a simulação rodava como conta sem passe e com o corte desligado.
    const estado = readFileSync('server/src/estado.ts', 'utf8');
    expect(estado).toContain('estado.vip.expiresAt =');
    expect(estado).toContain('estado.settings.autoSalvage =');

    const rota = readFileSync('server/src/index.ts', 'utf8');
    expect(rota, 'a rota tem o passe em mãos e não o passava')
      .toContain('vipExpiraEm: carteira.vipExpiraEm');
  });
});

describe('a fila de itens vai ANTES do lote novo', () => {
  /**
   * A terceira causa do mesmo sintoma, e a que explicava o "sempre ao concluir
   * o setor": `sector:advanced` disparava `garantirLote` solto, e o pedido do
   * lote ultrapassava a fila do setor que acabou. O servidor via setor
   * diferente, rolava SEMENTE NOVA, e a fila chegava depois com os `uid` do
   * pote antigo — nenhum descarte casava, e ele gravava tudo.
   *
   * Medido em 12/09/2026: seis peças `_0` gravadas no mesmo segundo, nenhuma
   * na lista de descarte que o cliente tinha mandado.
   */
  it('a virada de setor e o ciclo da nuvem passam pelo mesmo lugar', () => {
    const game = readFileSync('src/app/Game.ts', 'utf8');

    expect(game).toContain('private async trocarDeLote(');
    // E o lote não é mais pedido solto em nenhum dos dois gatilhos.
    expect(game, 'a virada de setor voltou a pedir o lote sem esvaziar a fila')
      .not.toContain("bus.on('sector:advanced', ({ sector }) => { void garantirLote(");
    expect(game.match(/void garantirLote\(/g) ?? [], 'sobrou um pedido de lote solto')
      .toHaveLength(0);
  });

  it('e a ordem dentro dele é drenar, depois pedir', () => {
    const game = readFileSync('src/app/Game.ts', 'utf8');
    const corpo = game.slice(game.indexOf('private async trocarDeLote('));
    const drenar = corpo.indexOf('await drenarInventario(');
    const lote = corpo.indexOf('await garantirLote(');

    expect(drenar).toBeGreaterThan(-1);
    expect(lote, 'pediu o lote antes de esvaziar a fila').toBeGreaterThan(drenar);
  });
});

describe('a capsula que nao foi coletada some do servidor tambem', () => {
  /**
   * A raiz, achada em 12/09/2026 com a pista do Rafael: "aparece a mensagem de
   * setor concluído e logo em seguida já aparecem os itens, pode ser os itens
   * que sobram na tela".
   *
   * O item é declarado ao servidor quando a CÁPSULA NASCE — `tirarDoPote`
   * empurra o `coletar` porque o cursor andou. Quem decide o destino é
   * `acquire`, e ele só roda se a nave alcançar a cápsula. Entre um e outro há
   * quatro finais em que a peça se perde, e em todos o servidor ficava com um
   * item que o jogador nunca teve — sem passar pelo descarte automático.
   */
  it('o Sim sabe declarar a peça perdida', () => {
    const sim = new Sim(createState(31));
    sim.state.comandosDeItem.length = 0;

    sim.perderItemNaoColetado({ uid: 'perdida-1' } as never);

    expect(sim.state.comandosDeItem).toEqual([{ tipo: 'descartar', uid: 'perdida-1' }]);
  });

  it('e a cena avisa nos QUATRO finais em que a cápsula morre sem coleta', () => {
    // Lido do fonte: a cena precisa de canvas e a suíte não tem. O que se
    // guarda aqui é que nenhum dos caminhos volte a ficar mudo.
    const cena = readFileSync('src/modes/vertical/VerticalMode.ts', 'utf8');
    const avisos = (cena.match(/perderItemNaoColetado\(/g) ?? []).length;

    expect(avisos, 'um final de cápsula voltou a ficar mudo').toBe(5);
    // O da borda de baixo é o que mais acontece, e o que o jogador vê: são as
    // cápsulas que continuam caindo depois do painel de setor concluído.
    expect(cena).toContain('if (item.item) this.sim.perderItemNaoColetado(item.item);');
  });
});

describe('slot morto nao e capsula', () => {
  /**
   * O erro que EU introduzi ao consertar a cápsula perdida, em 12/09/2026.
   *
   * `Pool.each` percorre de 0 até o cursor — os slots já apagados no mesmo
   * quadro entram no laço, e o `item` deles ainda aponta para a peça até o slot
   * ser reaproveitado. Sem guarda, a peça que a nave acabou de COLETAR era
   * declarada perdida logo em seguida, e o servidor a apagava.
   *
   * O sintoma foi o contrário do anterior e por isso denunciou: a carga cheia
   * na tela e VAZIA no D1 — zero itens no servidor com seis na tela.
   */
  it('os três laços sobre cápsulas ignoram slot morto', () => {
    const cena = readFileSync('src/modes/vertical/VerticalMode.ts', 'utf8');

    // O laço de atualização e o do sacrifício pela chave, com a guarda no topo.
    expect((cena.match(/if \(!item\.alive/g) ?? []).length,
      'um laço voltou a tratar slot morto como cápsula viva').toBe(2);
    // E o de desmontar a cena, que declara perda só do que está no ar.
    expect(cena).toContain('if (item.alive && item.item) this.sim.perderItemNaoColetado(item.item);');
  });
});

describe('a coleta e declarada no FINAL da capsula, nao no comeco', () => {
  /**
   * O transitório que fazia a peça "aparecer e sumir sozinha", achado em
   * 12/09/2026 depois de o Rafael notar que os itens mudavam sem ele fazer
   * nada e sumiam ao concluir o setor.
   *
   * O `coletar` saía quando a CÁPSULA NASCIA, mas o destino da peça só é
   * decidido quando a nave a alcança. Uma sincronia caindo no meio mandava
   * `coletar` sem o `descartar` que viria depois: o servidor gravava a peça e
   * ela ficava na carga até o ciclo seguinte apagá-la.
   *
   * Agora os dois saem juntos, sempre — e o servidor nem chega a gravar a
   * linha, porque vê a peça nascer e morrer no mesmo lote.
   */
  it('tirar do pote nao declara nada por si', () => {
    const { sim, estado } = simComPote(909);
    estado.comandosDeItem.length = 0;

    const caiu: unknown[] = [];
    for (let i = 0; i < 300 && !caiu.length; i++) caiu.push(...sim.rollDrops('onda', undefined, 0));

    expect(caiu.length, 'o pote nao rendeu — o teste mediria o vazio').toBeGreaterThan(0);
    expect(estado.comandosDeItem, 'a coleta foi declarada antes de a peça resolver')
      .toHaveLength(0);
  });

  it('e os dois finais declaram a coleta junto do destino', () => {
    const { sim, estado } = simComPote(910);

    // Final 1: a nave alcança.
    estado.comandosDeItem.length = 0;
    const colhidos: never[] = [];
    for (let i = 0; i < 300 && !colhidos.length; i++) colhidos.push(...sim.rollDrops('onda', undefined, 0) as never[]);
    for (const item of colhidos) sim.acquire(item);
    const coletas = estado.comandosDeItem.filter((c) => c.tipo === 'coletar').length;
    expect(coletas, 'a coleta não foi declarada ao alcançar').toBe(colhidos.length);

    // Final 2: a cápsula morre no caminho.
    estado.comandosDeItem.length = 0;
    const perdidos: never[] = [];
    for (let i = 0; i < 300 && !perdidos.length; i++) perdidos.push(...sim.rollDrops('onda', undefined, 0) as never[]);
    for (const item of perdidos) sim.perderItemNaoColetado(item);
    const ambos = estado.comandosDeItem;
    expect(ambos.filter((c) => c.tipo === 'coletar')).toHaveLength(perdidos.length);
    expect(ambos.filter((c) => c.tipo === 'descartar')).toHaveLength(perdidos.length);
  });
});
