import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { drenarInventario, esquecerInventario } from '@app/inventario';
import { Rng } from '@core/math';
import { Sim } from '@sim/index';
import { rollItem } from '@sim/loot';
import { createState } from '@sim/state';

const shell = readFileSync(new URL('../src/ui/Shell.ts', import.meta.url), 'utf8');

describe('atualização do inventário ao coletar', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    esquecerInventario();
  });

  it('redesenha a Carga diretamente no evento de loot', () => {
    const inicio = shell.indexOf("bus.on('loot:dropped'");
    const fim = shell.indexOf("bus.on('sector:advanced'", inicio);
    const handler = shell.slice(inicio, fim);

    expect(handler).toContain('this.renderPanel();');
    expect(handler.indexOf('this.renderPanel();')).toBeLessThan(handler.indexOf("if (item.rarity < 2) return;"));
  });

  it('uma resposta antiga do servidor não apaga uma coleta feita durante a requisição', async () => {
    let responder!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { responder = resolve; })));

    const sim = new Sim(createState(89));
    sim.state.comandosDeItem.push({ tipo: 'coletar', pote: 'onda' });
    const envio = drenarInventario(sim);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const recemColetada = rollItem(new Rng(89), 1, 0, 0);
    sim.state.inventory.push(recemColetada);
    sim.state.comandosDeItem.push({ tipo: 'coletar', pote: 'onda' });

    responder({
      ok: true,
      json: async () => ({ itens: [] }),
    } as unknown as Response);
    await envio;

    expect(sim.state.inventory.map((item) => item.uid)).toContain(recemColetada.uid);
    expect(sim.state.comandosDeItem).toHaveLength(1);
  });
});
