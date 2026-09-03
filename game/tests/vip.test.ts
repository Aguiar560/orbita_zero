import { describe, expect, it } from 'vitest';
import { MISSOES } from '@data/missoes';
import { BOSSES } from '@data/bosses';
import { situacaoDe, alternarRastreioDeMissao, missoesRastreadas } from '@sim/missoes';
import { tentativasDisponiveis } from '@sim/provacao';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Item } from '@sim/types';
import {
  CRYSTAL_PACKAGES, VIP_COST_CRYSTALS, VIP_DURATION_MS,
  controleManualAtivo, controleManualDisponivel, cristaisDoPacote, limiteDeMissoes,
  limiteTentativasDaProvacao, vipAtivo,
} from '@sim/vip';

const item = (uid: string): Item => ({
  uid, baseId: 'principal_4', slot: 'principal', rarity: 0, ilvl: 30,
  affixes: [{ id: 'dano_bruto', stat: 'dano', kind: 'add', value: 12, tier: 2, quality: 0.5 }],
  element: 'padrao', icon: 'item/principal_0', origin: 0,
});

describe('Passe VIP', () => {
  it('custa o equivalente exato ao pacote de R$ 24,90', () => {
    const pacote = CRYSTAL_PACKAGES.find((pack) => pack.priceCents === 2490)!;
    expect(cristaisDoPacote(pacote)).toBe(VIP_COST_CRYSTALS);
  });

  it('debita 500 cristais, dura 30 dias e acumula renovação', () => {
    const sim = new Sim(createState(201));
    const agora = 2_000_000_000_000;
    sim.state.resources.cristal = 1_000;
    expect(sim.buyVip(agora)).toBe(true);
    expect(sim.state.resources.cristal).toBe(500);
    expect(sim.state.vip.expiresAt).toBe(agora + VIP_DURATION_MS);
    expect(vipAtivo(sim.state, agora)).toBe(true);
    expect(sim.buyVip(agora)).toBe(true);
    expect(sim.state.vip.expiresAt).toBe(agora + VIP_DURATION_MS * 2);
  });

  it('aumenta a Provação para seis tentativas', () => {
    const sim = new Sim(createState(202));
    sim.state.vip.expiresAt = Date.now() + 60_000;
    sim.state.provacao.tentativas = 5;
    sim.state.provacao.tentativasEm = Date.now();
    sim.state.resources.cristal = 12;
    expect(limiteTentativasDaProvacao(sim.state)).toBe(6);
    expect(sim.buyShopItem('tentativa_provacao')).toBe(true);
    expect(tentativasDisponiveis(sim.state)).toBe(6);
  });

  it('permite rastrear cinco missões', () => {
    const sim = new Sim(createState(203));
    sim.setTestMode(true);
    sim.state.vip.expiresAt = Date.now() + 60_000;
    sim.state.codex.push(...BOSSES.map((boss) => boss.id));
    const candidatas = MISSOES.filter((missao) => {
      const situacao = situacaoDe(sim.state, missao, sim.alcanceLiberado);
      return situacao === 'ativa' || situacao === 'pronta';
    }).slice(0, 5);
    expect(candidatas).toHaveLength(5);
    for (const missao of candidatas) alternarRastreioDeMissao(sim.state, missao, sim.alcanceLiberado);
    expect(limiteDeMissoes(sim.state)).toBe(5);
    expect(missoesRastreadas(sim.state, sim.alcanceLiberado)).toHaveLength(5);
  });

  it('reserva auto-equipar e venda automática ao VIP', () => {
    const comum = new Sim(createState(204));
    comum.state.settings.autoEquip = true;
    comum.acquire(item('comum'));
    expect(comum.state.naves[comum.state.hull]?.equipped.principal).toBeUndefined();
    expect(comum.state.inventory.map((i) => i.uid)).toContain('comum');

    const vip = new Sim(createState(205));
    vip.state.vip.expiresAt = Date.now() + 60_000;
    vip.state.settings.autoEquip = true;
    vip.acquire(item('vip-equip'));
    expect(vip.state.naves[vip.state.hull]?.equipped.principal?.uid).toBe('vip-equip');

    const semVenda = new Sim(createState(206));
    semVenda.state.settings.autoEquip = false;
    semVenda.state.settings.autoSalvage = 2;
    semVenda.state.settings.autoDispose = 'vender';
    semVenda.acquire(item('sem-vip'));
    expect(semVenda.state.resources.sucata).toBe(0);
    expect(Object.keys(semVenda.state.armazem).length).toBeGreaterThan(0);

    const comVenda = new Sim(createState(207));
    comVenda.state.vip.expiresAt = Date.now() + 60_000;
    comVenda.state.settings.autoEquip = false;
    comVenda.state.settings.autoSalvage = 2;
    comVenda.state.settings.autoDispose = 'vender';
    comVenda.acquire(item('com-vip'));
    expect(comVenda.state.resources.sucata).toBeGreaterThan(0);
    expect(comVenda.state.armazem).toEqual({});
  });

  it('mantém manual livre até o nível 14 e exige VIP a partir do 15', () => {
    const state = createState(208);
    state.settings.controlMode = 'manual';
    state.command.nivel = 14;
    expect(controleManualDisponivel(state)).toBe(true);
    expect(controleManualAtivo(state)).toBe(true);
    state.command.nivel = 15;
    expect(controleManualDisponivel(state)).toBe(false);
    expect(controleManualAtivo(state)).toBe(false);
    state.vip.expiresAt = Date.now() + 60_000;
    expect(controleManualDisponivel(state)).toBe(true);
    expect(controleManualAtivo(state)).toBe(true);
  });
});
