import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState, migrate, SAVE_VERSION } from '@sim/state';
import { equipamentoDe, naveDe, resolveStats, dps } from '@sim/stats';
import { rollItem } from '@sim/loot';
import { Rng } from '@core/math';
import { HULLS } from '@data/hulls';

/**
 * Cada casco carrega o próprio conjunto.
 *
 * Antes havia um `equipped` só, no topo do estado: trocar de nave levava o
 * equipamento junto, e a frota era troca de silhueta e não de configuração.
 * Isso também tornava impossível o combustível forçar rotação — a nave de
 * troca chegaria sempre com o mesmo conjunto.
 */
describe('equipamento por nave', () => {
  const comDuasNaves = () => {
    const sim = new Sim(createState(4242));
    const outra = HULLS.find((h) => h.id !== sim.state.hull && sim.state.fleet.includes(h.id));
    return { sim, ativa: sim.state.hull, outra: outra?.id };
  };

  it('equipar numa nave não toca no conjunto da outra', () => {
    const { sim, ativa, outra } = comDuasNaves();
    expect(outra, 'a frota inicial precisa de duas naves').toBeTruthy();
    const rng = new Rng(7);
    const a = rollItem(rng, 30, 0, 0, { slot: 'reator' });
    const b = rollItem(rng, 30, 0, 0, { slot: 'reator' });
    sim.state.inventory.push(a, b);

    sim.equip(a.uid, ativa);
    sim.equip(b.uid, outra!);

    expect(sim.state.naves[ativa]!.equipped.reator?.uid).toBe(a.uid);
    expect(sim.state.naves[outra!]!.equipped.reator?.uid).toBe(b.uid);
  });

  /**
   * O que dá sentido ao resto: trocar de nave muda os ATRIBUTOS, porque muda o
   * conjunto. Se o dps não se mover, o equipamento continua sendo global com
   * outro nome.
   */
  it('trocar de nave muda os atributos resolvidos', () => {
    const { sim, ativa, outra } = comDuasNaves();
    const rng = new Rng(99);
    for (const slot of ['principal', 'reator', 'controle'] as const) {
      const item = rollItem(rng, 120, 0, 0, { slot, floor: 4 });
      sim.state.inventory.push(item);
      sim.equip(item.uid, ativa);
    }
    const comConjunto = dps(resolveStats(sim.state));

    sim.trocarCasco(outra!);
    const nua = dps(resolveStats(sim.state));

    expect(equipamentoDe(sim.state)).toEqual({});
    expect(nua, 'a nave sem conjunto tem de ser mais fraca').toBeLessThan(comConjunto);
  });

  /**
   * `equipamentoDe` devolve um objeto SOLTO quando o casco não tem registro —
   * o `?? {}` cria fora do estado. Escrever nele perdia o conjunto inteiro, e
   * o arnês mediu o setor 170 em 7.995 s por isso. Leitura usa `equipamentoDe`;
   * escrita usa `naveDe`.
   */
  it('naveDe grava no estado; equipamentoDe é só leitura', () => {
    const st = createState(1);
    st.hull = 'nave_que_nao_tem_registro';

    const solto = equipamentoDe(st);
    solto.reator = { uid: 'x' } as never;
    expect(st.naves['nave_que_nao_tem_registro'], 'leitura não pode criar registro').toBeUndefined();

    naveDe(st).equipped.reator = { uid: 'y' } as never;
    expect(st.naves['nave_que_nao_tem_registro']!.equipped.reator).toBeTruthy();
  });

  it('a migração leva o conjunto antigo para a nave em uso', () => {
    const antigo = {
      ...createState(3),
      version: 6,
      hull: 'void_canhao',
      equipped: { reator: { uid: 'antigo', slot: 'reator', rarity: 2 } },
    } as unknown;

    const s = migrate(antigo)!;

    expect(s.version).toBe(SAVE_VERSION);
    expect(s.naves['void_canhao']!.equipped.reator?.uid).toBe('antigo');
    expect((s as unknown as Record<string, unknown>).equipped, 'o campo do topo sai do save').toBeUndefined();
  });
});
