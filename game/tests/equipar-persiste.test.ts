import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Equipar uma peça sobrevive a atualizar a página.
 *
 * O jogador equipava, atualizava, e a peça voltava para o inventário. Duas
 * coisas se somavam:
 *
 * 1. A fila de comandos de item subia no relógio de **150 segundos**, junto com
 *    XP e moeda. Esses são ganho contínuo e podem esperar, porque o delta
 *    acumula. Equipar não: é ação deliberada, o efeito aparece na hora, e
 *    ninguém espera dois minutos e meio antes de recarregar.
 *
 * 2. No boot o jogo BUSCAVA o inventário sem enviar a fila. `adotar` apaga todo
 *    o equipado e o reconstrói pelo que veio do servidor — então a peça que
 *    ainda estava na fila era desequipada na tela pelo próprio boot.
 *
 * A ordem é o defeito inteiro: enviar antes de adotar, e enviar cedo.
 */

const fonte = (...p: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('equipar chega ao servidor antes da recarga', () => {
  const jogo = fonte('app', 'Game.ts');

  it('o boot ENVIA a fila antes de adotar a resposta', () => {
    /**
     * `drenarInventario` envia e adota; `sincronizarInventario` só adota. Trocar
     * um pelo outro no boot é o que impede o próprio boot de desfazer o que o
     * jogador acabou de fazer.
     */
    expect(jogo).toContain('await drenarInventario(this.sim);');
    expect(jogo).not.toMatch(/await sincronizarInventario\(this\.sim\);/);
    // E no outro ponto de sincronização, o mesmo.
    expect(jogo).not.toMatch(/^\s+sincronizarInventario\(this\.sim\),$/m);
  });

  it('e um comando de item dispara o envio em segundos, não no ciclo grande', () => {
    const vigia = jogo.slice(jogo.indexOf('private vigiarComandosDeItem'));
    const corpo = vigia.slice(0, vigia.indexOf('\n  private '));

    expect(corpo).toContain("bus.on('itens:comando'");
    expect(corpo).toContain('drenarInventario(this.sim)');

    // A espera existe para juntar a rajada de trocar vários slots, mas tem de
    // ser MUITO menor que o ciclo de 150 s — senão não resolve nada.
    const espera = /\}, (\d+)\)/.exec(corpo);
    expect(espera).not.toBeNull();
    expect(Number(espera![1])).toBeLessThan(10_000);
  });

  it('e quem enfileira o comando é quem avisa', () => {
    /**
     * O aviso sai de `sim/`, no mesmo lugar em que o comando entra na fila. Pôr
     * o aviso na interface deixaria de fora qualquer outro caminho que equipe —
     * o auto-equipar, por exemplo.
     */
    const sim = fonte('sim', 'index.ts');
    const avisos = sim.split("bus.emit('itens:comando', {});").length - 1;
    // Equipar, desequipar e o corte da normalização da conta de teste, que
    // desde 10/09/2026 manda o descarte para o servidor em vez de só esconder.
    expect(avisos).toBe(3);
  });

  it('e o servidor é a autoridade sobre o que está equipado', () => {
    /**
     * Isto não mudou, e é por isso que a ordem importa tanto: `adotar` zera o
     * equipado de todas as naves e reconstrói pela resposta. Se um dia alguém
     * fizer o cliente mandar mais e perguntar menos, este teste cai junto e a
     * discussão volta à mesa.
     */
    const inv = fonte('app', 'inventario.ts');
    expect(inv).toContain('if (nave) nave.equipped = {};');
    expect(inv).toContain('nave.equipped[l.slot as SlotId] = l.item;');
  });
});
