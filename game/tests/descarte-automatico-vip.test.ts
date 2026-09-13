import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { bus } from '@app/Bus';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Item, Rarity } from '@sim/types';

/**
 * Desmontar e vender automaticamente são benefício do Passe VIP.
 *
 * Regra de 12/09/2026: "auto desmontar e auto vender apenas VIP pode ter". Antes
 * disso o corte por raridade era de todos e só a VENDA era VIP.
 *
 * Medido no dia da mudança, nos saves de produção: 5 contas tinham corte
 * ligado, 3 delas VIP. Duas perderam a automação — e é por isso que a tela
 * precisa DIZER que é VIP, em vez de só parar de funcionar.
 */

const peca = (rarity: number): Item => ({
  uid: `x${rarity}`, baseId: 'principal_1', slot: 'principal', rarity: rarity as Rarity,
  ilvl: 10, affixes: [], icon: '', origin: 1,
});

const comVip = (sim: Sim, ativo: boolean): void => {
  sim.state.vip.expiresAt = ativo ? Date.now() + 86_400_000 : 0;
};

describe('o descarte automático é do Passe', () => {
  it('sem VIP, o corte por raridade não pega — nem para desmontar', () => {
    const sim = new Sim(createState(1));
    sim.state.settings.autoSalvage = 3 as Rarity;
    comVip(sim, false);

    expect(sim.descarteAutomaticoPega(peca(1)), 'desmontou sem Passe').toBe(false);
    // E a conta de espaço tem de concordar: peça que não some ocupa lugar.
    expect(sim.ocupaEspaco(peca(1))).toBe(true);
  });

  it('com VIP, pega o que está abaixo do corte', () => {
    const sim = new Sim(createState(2));
    sim.state.settings.autoSalvage = 3 as Rarity;
    comVip(sim, true);

    expect(sim.descarteAutomaticoPega(peca(1))).toBe(true);
    expect(sim.ocupaEspaco(peca(1)), 'a peça soma e some ao mesmo tempo').toBe(false);
    // No corte ou acima dele, a peça é guardada — o corte é "abaixo de".
    expect(sim.descarteAutomaticoPega(peca(3))).toBe(false);
    expect(sim.descarteAutomaticoPega(peca(4))).toBe(false);
  });

  it('e o corte desligado não pega nada, nem com VIP', () => {
    const sim = new Sim(createState(3));
    sim.state.settings.autoSalvage = 0 as Rarity;
    comVip(sim, true);

    expect(sim.descarteAutomaticoPega(peca(0))).toBe(false);
  });

  it('o destino é UM alternador, e o nome acessível carrega o valor', () => {
    // Dois botões gastavam a largura de duas palavras para dizer uma escolha
    // entre duas. A posição responde qual vale; o leitor de tela, que não vê
    // posição, precisa do valor no nome.
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');
    expect(inventario).toContain('inv-destino-switch');
    expect(inventario).toContain('Destino do descarte: ');
    expect(inventario).not.toContain("destino('vender', 'Vender')");
  });

  it('as duas telas desabilitam e explicam, em vez de esconder', () => {
    // Automação que some sem explicação parece defeito; a que se vê bloqueada
    // explica e convida. Lido do fonte: a suíte não tem DOM.
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');
    expect(inventario).toContain('Somente Passe VIP pode acionar o descarte automático');
    expect(inventario).toContain('disabled: !vip');

    const config = readFileSync('src/ui/panels/SettingsPanel.ts', 'utf8');
    expect(config).toContain('Somente Passe VIP pode acionar o descarte automático');
    expect(config).toContain('disabled: !vip');
  });

  it('e o Inventário escreve no MESMO ajuste que as Configurações', () => {
    // Dois lugares, um estado. Um segundo campo é que seria duplicata — e
    // divergiria no primeiro dia em que alguém mudasse um só deles.
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');
    expect(inventario).toContain('s.autoSalvage = Number(');
    expect(inventario).toContain("s.autoDispose = vendendo ? 'desmontar' : 'vender';");
  });
});

describe('o descarte automático avisa o servidor, e mostra o que rendeu', () => {
  /**
   * O defeito de 12/09/2026: "terminei o setor e mesmo com o descarte
   * automático abaixo de raro apareceu esses itens".
   *
   * A peça É declarada como coletada — `tirarDoPote` enfileira um `coletar`,
   * porque o cursor do lote andou. Sem um `descartar` junto, o servidor criava
   * a linha e a sincronização seguinte devolvia a peça que a automação tinha
   * acabado de consumir. E como o crédito acontecia do mesmo jeito, o jogador
   * ficava com a sucata E com o item.
   */
  const comVipEComCorte = (sim: Sim): void => {
    sim.state.vip.expiresAt = Date.now() + 86_400_000;
    sim.state.settings.autoSalvage = 3 as Rarity;
  };

  it('enfileira o descarte, para o item não voltar na sincronização', () => {
    const sim = new Sim(createState(21));
    comVipEComCorte(sim);
    sim.state.comandosDeItem.length = 0;

    sim.acquire(peca(1));

    const descartes = sim.state.comandosDeItem.filter((c) => c.tipo === 'descartar');
    expect(descartes, 'o servidor não soube que a peça morreu').toHaveLength(1);
    expect(descartes[0]).toMatchObject({ uid: 'x1' });
    expect(sim.state.inventory, 'a peça ficou na carga').toHaveLength(0);
  });

  it('e diz quanto rendeu, para o canto da tela somar', () => {
    const sim = new Sim(createState(22));
    comVipEComCorte(sim);
    sim.state.settings.autoDispose = 'vender';

    const rendeu: { sucata: number; materiais: Record<string, number> }[] = [];
    const solta = bus.on('descarte:automatico', (e) => rendeu.push(e));
    try { sim.acquire(peca(1)); } finally { solta(); }

    expect(rendeu).toHaveLength(1);
    expect(rendeu[0]!.sucata, 'vendeu sem dizer quanto').toBeGreaterThan(0);
  });

  it('e o desmanche diz o material, não a sucata', () => {
    const sim = new Sim(createState(23));
    comVipEComCorte(sim);
    sim.state.settings.autoDispose = 'desmontar';

    const rendeu: { sucata: number; materiais: Record<string, number> }[] = [];
    const solta = bus.on('descarte:automatico', (e) => rendeu.push(e));
    try { sim.acquire(peca(1)); } finally { solta(); }

    expect(rendeu[0]!.sucata).toBe(0);
    expect(Object.keys(rendeu[0]!.materiais).length).toBeGreaterThan(0);
  });
});

describe('a mensagem do descarte automatico e a mesma do manual', () => {
  it('fala no fim da onda, com o texto e o icone que o Inventario ja usa', () => {
    /**
     * Pedido em 12/09/2026: "a mensagem de descarte das pecas tem que ser igual
     * a mensagem de quando o player descarta manualmente, pode ser no final da
     * onda ou quando morrer tudo de uma vez".
     *
     * Duas redacoes para o mesmo fato fazem o jogador achar que sao dois
     * sistemas. Lido do fonte: a suite nao tem DOM.
     */
    const shell = readFileSync('src/ui/Shell.ts', 'utf8');
    const inventario = readFileSync('src/ui/panels/InventoryPanel.ts', 'utf8');

    for (const trecho of ['vendido', 'sucata', 'desmontado', 'ui/icon_coin', 'recurso/ferrita']) {
      expect(shell, `a frase do automatico perdeu ${trecho}`).toContain(trecho);
      expect(inventario, `a frase do manual perdeu ${trecho}`).toContain(trecho);
    }
    // O resumo de materiais e o MESMO codigo, e nao uma copia.
    expect(inventario).toContain('export function resumoDeMateriais');
    expect(shell).toContain('resumoDeMateriais(materiais)');
    // E o gatilho e a queda da onda.
    expect(shell).toContain("bus.on('wave:cleared', () => this.contarDescarte())");
  });
});
