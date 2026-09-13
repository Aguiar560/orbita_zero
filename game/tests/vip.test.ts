import { describe, expect, it } from 'vitest';
import { MISSOES } from '@data/missoes';
import { BOSSES } from '@data/bosses';
import { situacaoDe, alternarRastreioDeMissao, missoesRastreadas } from '@sim/missoes';
import { tentativasDisponiveis } from '@sim/provacao';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import type { Item } from '@sim/types';
import {
  CRYSTAL_PACKAGES, VIP_COST_CRYSTALS, VIP_DURATION_MS, VIP_MANUAL_LEVEL,
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

  it('o passe reconhecido pelo cliente vem do espelho do servidor', () => {
    // A COMPRA saiu daqui na Fase 2 do Passo 9: quem debita os 500 cristais e
    // carimba a validade é o servidor, e as regras de renovação são medidas em
    // `carteira-fila.test.ts`, contra o código do Worker.
    //
    // O que continua sendo do cliente, e é o que este teste cobre, é LER esse
    // carimbo e derivar dele os benefícios.
    const sim = new Sim(createState(201));
    const agora = 2_000_000_000_000;
    expect(vipAtivo(sim.state, agora)).toBe(false);
    sim.state.vip.expiresAt = agora + VIP_DURATION_MS;
    expect(vipAtivo(sim.state, agora)).toBe(true);
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
    // Candidata e a que PODE ocupar vaga: ainda por aceitar ('disponivel'),
    // aceita ('ativa') ou pronta. Antes do aceite existir, toda missao liberada
    // ja nascia ativa e as duas ultimas bastavam.
    const candidatas = MISSOES.filter((missao) => {
      const situacao = situacaoDe(sim.state, missao, sim.alcanceLiberado);
      return situacao === 'ativa' || situacao === 'pronta' || situacao === 'disponivel';
    }).slice(0, 5);
    expect(candidatas).toHaveLength(5);
    for (const missao of candidatas) alternarRastreioDeMissao(sim.state, missao, sim.alcanceLiberado);
    expect(limiteDeMissoes(sim.state)).toBe(5);
    expect(missoesRastreadas(sim.state, sim.alcanceLiberado)).toHaveLength(5);
  });

  it('reserva auto-equipar e TODO o descarte automático ao VIP', () => {
    /**
     * A venda automática já era VIP; o DESMANCHE por raridade era de todos, e
     * passou a ser VIP em 12/09/2026 — "auto desmontar e auto vender apenas VIP
     * pode ter". Medido no dia: 5 contas tinham corte ligado, 3 delas VIP.
     */
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

    // Sem passe, NENHUM dos dois destinos acontece: a peça vai inteira para a
    // carga. Antes ela virava material, porque desmontar era de graça.
    const semPasse = new Sim(createState(206));
    semPasse.state.settings.autoEquip = false;
    semPasse.state.settings.autoSalvage = 2;
    semPasse.state.settings.autoDispose = 'vender';
    semPasse.acquire(item('sem-vip'));
    expect(semPasse.state.resources.sucata).toBe(0);
    expect(semPasse.state.armazem, 'desmontou sem passe').toEqual({});
    expect(semPasse.state.inventory.map((i) => i.uid)).toContain('sem-vip');

    const semPasseDesmontando = new Sim(createState(208));
    semPasseDesmontando.state.settings.autoEquip = false;
    semPasseDesmontando.state.settings.autoSalvage = 2;
    semPasseDesmontando.state.settings.autoDispose = 'desmontar';
    semPasseDesmontando.acquire(item('sem-vip-desmontar'));
    expect(semPasseDesmontando.state.armazem).toEqual({});
    expect(semPasseDesmontando.state.inventory.map((i) => i.uid)).toContain('sem-vip-desmontar');

    const comVenda = new Sim(createState(207));
    comVenda.state.vip.expiresAt = Date.now() + 60_000;
    comVenda.state.settings.autoEquip = false;
    comVenda.state.settings.autoSalvage = 2;
    comVenda.state.settings.autoDispose = 'vender';
    comVenda.acquire(item('com-vip'));
    expect(comVenda.state.resources.sucata).toBeGreaterThan(0);
    expect(comVenda.state.armazem).toEqual({});
  });

  it('mantém manual livre abaixo da régua e exige VIP a partir dela', () => {
    /**
     * Os níveis saem de `VIP_MANUAL_LEVEL`, e não de literais: a régua já
     * mudou uma vez (15 → 25), e um teste com o número escrito à mão teria
     * caído junto com a mudança sem nenhum defeito por trás.
     */
    const state = createState(208);
    state.settings.controlMode = 'manual';
    state.command.nivel = VIP_MANUAL_LEVEL - 1;
    expect(controleManualDisponivel(state)).toBe(true);
    expect(controleManualAtivo(state)).toBe(true);
    state.command.nivel = VIP_MANUAL_LEVEL;
    expect(controleManualDisponivel(state)).toBe(false);
    expect(controleManualAtivo(state)).toBe(false);
    state.vip.expiresAt = Date.now() + 60_000;
    expect(controleManualDisponivel(state)).toBe(true);
    expect(controleManualAtivo(state)).toBe(true);
  });
});
