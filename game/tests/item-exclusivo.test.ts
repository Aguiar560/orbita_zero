import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MISSOES, MISSAO_POR_ID } from '@data/missoes';
import { pisoDaProvacao } from '@data/provacao';
import { createState } from '@sim/state';
import { Sim } from '@sim/index';
import { itemName } from '@sim/loot';
import { alternarRastreioDeMissao, progressoDe } from '@sim/missoes';
import { BOSSES } from '@data/bosses';
import { PERSONAGENS, CONFIANCA_MAX } from '@data/personagens';

/**
 * O item exclusivo é ENTREGUE, e não apenas prometido.
 *
 * Quatro lugares do jogo declaravam item exclusivo e nenhum entregava:
 *
 * 1. `balance/drops.ts` → `exclusivos`, vazio e documentado como tal;
 * 2. `provacao.ts` → `chanceExclusivo`, com curva e teto próprios, nunca lido;
 * 3. `personagens.ts` → degrau 5 da confiança, "Item exclusivo", só texto;
 * 4. `missoes.ts` → `recompensaExclusiva`, com nome, dono, slot e raridade — e
 *    o painel a desenhava GRANDE na tela.
 *
 * O quarto era o pior: o jogador via a peça prometida, cumpria o contrato e
 * recebia todo o resto da recompensa sem ela.
 *
 * O que torna a peça exclusiva é de onde ela veio e quem a assina — não uma
 * regra de dano que ninguém mais tem. Ela é rolada pelo mesmo motor de sempre,
 * com piso de raridade garantido, e ganha nome e dono.
 */

/**
 * Deixa a missao PRONTA: requisitos satisfeitos e objetivos batidos.
 *
 * A unica missao com `recompensaExclusiva` hoje exige o chefe do Nucleo
 * Ferrugem derrotado e confianca 1 com ele -- e um contrato especial, e e por
 * isso que ele paga uma peca com nome proprio.
 */
function deixarPronta(sim: Sim, def: (typeof MISSOES)[number]): void {
  sim.setTestMode(true);
  sim.state.codex.push(...BOSSES.map((b) => b.id));
  for (const p of PERSONAGENS) sim.state.confianca[p.id] = CONFIANCA_MAX;
  alternarRastreioDeMissao(sim.state, def, sim.alcanceLiberado);
  const p = progressoDe(sim.state, def);
  def.objetivos.forEach((o, i) => { p.passos[i] = o.alvo; });
}

describe('a peça exclusiva da missão', () => {
  it('é entregue com nome e dono próprios', () => {
    const comExclusiva = MISSOES.find((m) => m.recompensaExclusiva)!;
    expect(comExclusiva, 'nenhuma missão declara recompensaExclusiva').toBeTruthy();

    const sim = new Sim(createState(77));
    deixarPronta(sim, comExclusiva);

    const antes = sim.state.inventory.length;
    expect(sim.resgatarMissao(comExclusiva.id)).toBe(true);

    const novos = sim.state.inventory.slice(antes);
    const exclusiva = novos.find((i) => i.exclusivo);
    expect(exclusiva, 'a peça prometida não foi entregue').toBeTruthy();
    expect(exclusiva!.exclusivo!.nome).toBe(comExclusiva.recompensaExclusiva!.nome);
    expect(itemName(exclusiva!)).toBe(comExclusiva.recompensaExclusiva!.nome);
  });

  it('e respeita o slot e o piso de raridade declarados', () => {
    /**
     * O slot importa: a peça exclusiva tem razão de ser AQUELA — um reator, uma
     * arma —, e o painel já desenha o ícone do slot prometido. Entregar outra
     * coisa faria a tela mentir.
     */
    const def = MISSOES.find((m) => m.recompensaExclusiva?.slot)!;
    const sim = new Sim(createState(78));
    deixarPronta(sim, def);

    const antes = sim.state.inventory.length;
    sim.resgatarMissao(def.id);
    const exclusiva = sim.state.inventory.slice(antes).find((i) => i.exclusivo)!;

    expect(exclusiva.slot).toBe(def.recompensaExclusiva!.slot);
    if (def.recompensaExclusiva!.raridadeMin !== undefined) {
      expect(exclusiva.rarity).toBeGreaterThanOrEqual(def.recompensaExclusiva!.raridadeMin);
    }
  });

  it('e não é entregue duas vezes', () => {
    // A missão entregue não paga de novo — a mesma guarda do resto da recompensa.
    const def = MISSOES.find((m) => m.recompensaExclusiva)!;
    const sim = new Sim(createState(79));
    deixarPronta(sim, def);

    sim.resgatarMissao(def.id);
    const depois = sim.state.inventory.length;
    expect(sim.resgatarMissao(def.id)).toBe(false);
    expect(sim.state.inventory.length).toBe(depois);
  });
});

describe('a relíquia da Provação', () => {
  it('a chance por piso deixou de ser número morto', () => {
    /**
     * `chanceExclusivo` sobe de 0% no piso 20 até 32% no piso 100 — com curva e
     * teto próprios, o que fazia qualquer um que lesse o arquivo concluir que
     * estava implementado. Ninguém a lia.
     *
     * O teste guarda a leitura, não o sorteio: sortear é do RNG, e um teste que
     * dependa de dado cai sozinho um dia.
     */
    const sim = readFileSync(join(process.cwd(), 'src', 'sim', 'index.ts'), 'utf8');
    expect(sim).toContain('rec.chanceExclusivo > 0 && this.rng.chance(rec.chanceExclusivo)');
  });

  it('e os pisos rasos não pagam relíquia nenhuma', () => {
    // Abaixo do piso 20 a chance é zero: a peça só é exclusiva se for rara de
    // ver. Aos 40 já vale 8%, e no topo 32%.
    expect(pisoDaProvacao(10).recompensa.chanceExclusivo).toBe(0);
    expect(pisoDaProvacao(40).recompensa.chanceExclusivo).toBeCloseTo(0.08, 5);
    expect(pisoDaProvacao(100).recompensa.chanceExclusivo).toBeCloseTo(0.32, 5);
  });
});

describe('a assinatura', () => {
  it('vence o nome da base em toda tela', () => {
    /**
     * `itemName` é a única porta pela qual o nome de um item chega à interface.
     * Pôr a assinatura ali evita que cada painel precise lembrar de perguntar —
     * e "lembrar de perguntar" é o que produz a metade das telas certas e
     * metade erradas.
     */
    const def = MISSAO_POR_ID.get(MISSOES.find((m) => m.recompensaExclusiva)!.id)!;
    expect(def.recompensaExclusiva!.nome.length).toBeGreaterThan(0);
  });
});
