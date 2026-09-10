/**
 * Item que não cabe NÃO é coletado.
 *
 * ## O que era feito antes
 *
 * `rollDrops` tirava a peça do lote e entregava; `stash` descobria que o
 * Inventário estava cheio e a jogava fora. O jogador gastava uma peça do lote —
 * que tem cursor e não volta — para receber nada, e o servidor gravava e
 * apagava uma linha à toa no mesmo ciclo.
 *
 * A correção é espiar antes de consumir. O teste guarda as duas metades: que a
 * peça FICA no lote, e que a automação que o jogador pediu continua valendo.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { bus } from '@app/Bus';
import { Sim } from '@sim/index';
import { createState, migrate } from '@sim/state';
import { PECAS_RETIDAS_MAX } from '@data/balance/capacidade';
import { vagasNaMochila } from '../server/src/inventario';

const shell = readFileSync(new URL('../src/ui/Shell.ts', import.meta.url), 'utf8');

const peca = (uid: string, rarity: number) => ({
  uid, baseId: 'b', slot: 'principal', rarity, ilvl: 90,
  affixes: [], icon: 'i', origin: 0,
});

/** Sim com o Inventário lotado de peças ÓTIMAS e um lote de peças ruins. */
function lotado(semente: number): Sim {
  const sim = new Sim(createState(semente));
  sim.jumpSector(3);
  sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`cheio${i}`, 5));
  sim.state.settings.autoSalvage = 0;
  sim.state.settings.autoEquip = false;
  const ruim = (tag: string) => Array.from({ length: 40 }, (_, i) => peca(`${tag}${i}`, 0));
  sim.receberLote({ onda: ruim('o'), elite: ruim('e'), chefe: ruim('c') } as never);
  return sim;
}

describe('Inventário cheio', () => {
  it('usa a mensagem curta definida para o combate', () => {
    expect(shell).toContain("const texto = 'Inventario Cheio';");
    expect(shell).not.toContain("'Inventário Cheio!'");
    expect(shell).not.toContain("'Inventário cheio — peça desfeita ao coletar'");
  });

  it('a peça continua no lote', () => {
    const sim = lotado(11);
    const antes = sim.pote!.chefe.length;
    expect(sim.rollDrops('chefe')).toEqual([]);
    expect(sim.pote!.chefe.length).toBe(antes);
  });

  it('e nenhum comando sobe para o servidor', () => {
    // A outra metade da economia: sem isto, o servidor recebia coletar+descartar
    // do mesmo uid — duas escritas em D1 para o inventário terminar igual.
    const sim = lotado(12);
    const antes = sim.state.comandosDeItem.length;
    sim.rollDrops('chefe');
    expect(sim.state.comandosDeItem.length).toBe(antes);
  });

  it('e nem uma peça MELHOR que tudo que está guardado', () => {
    /**
     * Aqui morava a exceção: se a peça que chegava fosse melhor que a pior
     * guardada, o jogo vendia ou desmanchava a pior para caber a nova, e o
     * teste chamava isso de "trocar é coletar".
     *
     * Era ganho de poder, e por isso passou despercebida — mas descartava uma
     * peça do jogador, irreversível, sem ele pedir e com dois segundos de aviso
     * no meio de uma onda. `autoSalvage` e `autoEquip` também descartam e
     * continuam existindo: a diferença é que são interruptores que ele LIGOU.
     *
     * Cheio é cheio, melhor ou pior.
     */
    const sim = lotado(13);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`ruim${i}`, 0));
    expect(sim.rollDrops('chefe').length).toBe(0);
    // E nada do que estava guardado foi vendido para abrir espaço.
    expect(sim.state.inventory.length).toBe(sim.cargoSlots);
  });

  it('e o desmanche automático continua consumindo', () => {
    // `autoSalvage` é automação PEDIDA: ali a peça é consumida e paga em sucata.
    // Confundir isso com "não coube" desligaria o desmanche automático.
    const sim = lotado(14);
    sim.state.settings.autoSalvage = 5;
    expect(sim.rollDrops('chefe').length).toBeGreaterThan(0);
  });
});

describe('com espaço, nada muda', () => {
  it('a peça é coletada normalmente', () => {
    const sim = lotado(15);
    sim.state.inventory = [];
    const antes = sim.pote!.chefe.length;
    expect(sim.rollDrops('chefe').length).toBeGreaterThan(0);
    expect(sim.pote!.chefe.length).toBeLessThan(antes);
  });
});

describe('os três desfechos do Inventário cheio', () => {
  /**
   * Relatado em 04/09: *"o inventário está full, e ao pegar um item não está
   * mostrando a mensagem e também não sei o que está sendo feito com o item"*.
   *
   * O aviso existia para UM caso só — a peça que não é coletada. Os outros dois
   * aconteciam em silêncio, e são os mais comuns: com desmanche automático
   * ligado, a peça É coletada e desfeita na hora, e a cápsula sumia sem o
   * inventário mudar.
   *
   * Os três precisam de textos diferentes porque só o primeiro é uma perda.
   */
  const eventos = (sim: Sim, corpo: () => void): string[] => {
    const vistos: string[] = [];
    const off = bus.on('inventario:cheio', ({ motivo }) => vistos.push(motivo));
    try { corpo(); } finally { off(); }
    return vistos;
  };

  it('a peça que não cabe avisa que NÃO foi coletada', () => {
    // Elite, e não chefe: desde 10/09 a peça de CHEFE que não cabe fica
    // guardada, com aviso próprio — ver o bloco abaixo.
    const sim = lotado(21);
    expect(eventos(sim, () => { sim.rollDrops('elite'); })).toContain('nao-coletado');
  });

  it('a peça desfeita ao coletar avisa que foi desfeita', () => {
    // Cheio de peças MELHORES: a que chega é pior, então é ela que se desfaz.
    const sim = lotado(22);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`bom${i}`, 3));
    expect(eventos(sim, () => { sim.acquire(peca('ruim', 0)); })).toContain('descartada');
  });

  it('e desequipar com a bagagem cheia RECUSA, em vez de destruir a peça', () => {
    /**
     * O outro lado de tirar a troca. `unequip` mandava a peça para `stash`, e
     * de bagagem cheia ela era desmanchada na hora: o jogador clicava para tirar
     * uma peça e a perdia.
     *
     * Recusar é a única resposta honesta — desequipar é ação deliberada sobre
     * algo que ele já tem, e destruir o objeto da ação é o oposto do pedido.
     */
    const sim = lotado(23);
    sim.state.inventory = Array.from({ length: sim.cargoSlots }, (_, i) => peca(`ruim${i}`, 0));

    const arma = peca('equipada', 4);
    sim.equipamentoDe()[arma.slot] = arma;

    const avisos = eventos(sim, () => {
      expect(sim.unequip(arma.slot)).toBe(false);
    });

    expect(avisos).toContain('nao-coletado');
    // A peça continua no soquete: não foi para lugar nenhum.
    expect(sim.equipamentoDe()[arma.slot]?.uid).toBe(arma.uid);
  });
});

describe('as peças do chefe esperam espaço', () => {
  /**
   * Pedido de 10/09/2026: "o player não sabe quantos itens irá ganhar". Ao
   * matar o chefe com o inventário cheio, as peças dele ficavam no lote e se
   * perdiam na troca de setor — ou viravam cápsula e eram DESCARTADAS na
   * coleta, porque a conta de espaço ignorava as cápsulas já no ar.
   */
  const retidas = (sim: Sim, corpo: () => void): number[] => {
    const vistos: number[] = [];
    const off = bus.on('chefe:pecasRetidas', ({ retidas: n }) => vistos.push(n));
    try { corpo(); } finally { off(); }
    return vistos;
  };

  it('o que não cabe é guardado e avisado, e não sai do lote', () => {
    const sim = lotado(31);
    const lote = sim.pote!.chefe.length;
    const avisos = retidas(sim, () => { expect(sim.rollDrops('chefe')).toEqual([]); });
    expect(sim.state.pecasRetidas).toBeGreaterThanOrEqual(3);
    expect(avisos.at(-1)).toBe(sim.state.pecasRetidas);
    expect(sim.pote!.chefe.length).toBe(lote);
  });

  it('com espaço para parte, entrega a parte e guarda o resto', () => {
    const sim = lotado(32);
    sim.state.inventory.splice(0, 1); // um espaço livre
    const soltas = sim.rollDrops('chefe');
    expect(soltas).toHaveLength(1);
    expect(sim.state.pecasRetidas).toBeGreaterThanOrEqual(2);
  });

  it('as cápsulas já no ar contam como espaço ocupado', () => {
    const sim = lotado(33);
    sim.state.inventory.splice(0, 2); // dois espaços livres…
    const soltas = sim.rollDrops('chefe', undefined, 2); // …e duas cápsulas a caminho
    expect(soltas).toEqual([]);
    expect(sim.state.pecasRetidas).toBeGreaterThanOrEqual(3);
  });

  it('liberar espaço entrega as guardadas, direto no inventário', () => {
    const sim = lotado(34);
    sim.rollDrops('chefe');
    const guardadas = sim.state.pecasRetidas;
    expect(sim.entregarPecasRetidas(), 'cheio: nada a entregar').toBe(0);

    sim.state.inventory.splice(0, 2);
    const avisos = retidas(sim, () => { expect(sim.entregarPecasRetidas()).toBe(2); });
    expect(sim.state.pecasRetidas).toBe(guardadas - 2);
    expect(sim.state.inventory.length).toBe(sim.cargoSlots);
    expect(avisos.at(-1)).toBe(guardadas - 2);
    // Saiu do lote pela porta de sempre: o servidor recebe "coletar chefe".
    expect(sim.state.comandosDeItem.filter((c) => c.tipo === 'coletar' && c.pote === 'chefe')).toHaveLength(2);
  });

  it('o save guarda a contagem, com teto', () => {
    const sim = lotado(35);
    sim.rollDrops('chefe');
    const salvo = JSON.parse(JSON.stringify(sim.state)) as Record<string, unknown>;
    expect(migrate(salvo).pecasRetidas).toBe(sim.state.pecasRetidas);
    expect(migrate({ ...salvo, pecasRetidas: 1000 }).pecasRetidas).toBe(PECAS_RETIDAS_MAX);
    expect(migrate({ ...salvo, pecasRetidas: -3 }).pecasRetidas).toBe(0);
  });

  it('o aviso antes da luta sabe quantas peças o chefe pode soltar', () => {
    const sim = new Sim(createState(36));
    sim.jumpSector(10);
    sim.state.run.wave = 7;
    sim.refreshEncounter();
    expect(sim.encounter.kind).toBe('chefe');
    expect(sim.pecasDoChefe()).toBeGreaterThanOrEqual(3);
  });
});

describe('o teto absoluto de 70', () => {
  /**
   * Relato de 10/09/2026: a conta de teste tinha 71 peças na mochila do
   * SERVIDOR. O teto só existia no navegador, e a normalização da conta de teste
   * cortava a lista só na tela — a sincronização seguinte trazia as peças de
   * volta.
   */
  it('o servidor conta as vagas depois dos descartes do lote', () => {
    const mochila = Array.from({ length: 70 }, (_, i) => `m${i}`);
    expect(vagasNaMochila(mochila, [], 70)).toBe(0);
    expect(vagasNaMochila(mochila, ['m1', 'm2', 'fora'], 70)).toBe(2);
    expect(vagasNaMochila([...mochila, 'm70'], [], 70)).toBe(0);
  });

  it('a normalização da conta de teste manda o corte para o servidor', () => {
    const sim = new Sim(createState(41));
    sim.state.settings.testMode = true;
    sim.state.inventory = Array.from({ length: 73 }, (_, i) => peca(`p${i}`, 1));
    expect(sim.normalizarCargaDeTeste()).toBe(3);
    expect(sim.state.inventory).toHaveLength(70);
    const descartes = sim.state.comandosDeItem.filter((c) => c.tipo === 'descartar');
    expect(descartes).toHaveLength(3);
    // O que sobe é exatamente o que saiu da tela.
    const ficaram = new Set(sim.state.inventory.map((i) => i.uid));
    for (const d of descartes) expect(ficaram.has(d.uid!)).toBe(false);
  });
});
