/**
 * O teto que MEDE, e não impede (Fase 5, passo 4).
 *
 * ## O que estes testes protegem
 *
 * A tentação é ligar a recusa. Duas fórmulas já foram medidas e as duas
 * falharam, e a pior delas falharia em silêncio: `TAXA_DE_ENTRADA ×
 * sectorBounty × 12` fica TRÊS VEZES abaixo do ganho honesto no setor 1 —
 * recusaria todo jogador novo, no primeiro minuto, sem sintoma nenhum.
 *
 * Por isso a margem de 10×. Ela parece esvaziar a medida e é o contrário: a
 * folga honesta medida chega a 9,9× em setores altos, então qualquer margem
 * menor registraria jogo normal e o registro viraria ruído caro.
 *
 * Os testes abaixo fixam as duas pontas: o honesto NÃO entra na tabela, e o
 * absurdo entra.
 */

import { describe, expect, it } from 'vitest';

import { MARGEM, excedeu, tetoDeRegistro, tetoFisico } from '../server/src/teto';
import { TAXA_DE_ENTRADA } from '@data/balance/curvas';
import { sectorBounty } from '@sim/progression';

/** O ganho honesto máximo de uma janela: todo inimigo que coube, todo abatido. */
const honestoMaximo = (setor: number, segundos: number): number =>
  TAXA_DE_ENTRADA * sectorBounty(setor) * 12 * segundos;

describe('o teto físico', () => {
  it('cresce com o setor e com a janela', () => {
    expect(tetoFisico(10, 60)).toBeGreaterThan(tetoFisico(5, 60));
    expect(tetoFisico(10, 120)).toBeGreaterThan(tetoFisico(10, 60));
  });

  it('nunca é zero, nem com janela zero', () => {
    // Janela de zero faria QUALQUER valor exceder — o pior defeito possível
    // aqui, porque ele registraria jogo honesto em massa.
    expect(tetoFisico(1, 0)).toBeGreaterThan(0);
    expect(tetoDeRegistro(1, 0)).toBeGreaterThan(0);
  });

  it('e o de registro é o físico vezes a margem', () => {
    expect(tetoDeRegistro(7, 90)).toBeCloseTo(tetoFisico(7, 90) * MARGEM, 6);
  });
});

describe('o jogador honesto não entra na tabela', () => {
  /**
   * A varredura que a fórmula sem margem não passaria. `honestoMaximo` é o
   * limite superior do que a cena pode pagar — todo inimigo que coube, todo
   * abatido — e ainda assim ele fica dez vezes abaixo do teto de registro.
   */
  it('em toda a faixa de 1 a 300', () => {
    for (let setor = 1; setor <= 300; setor += 7) {
      for (const janela of [30, 90, 150, 600]) {
        expect(excedeu(honestoMaximo(setor, janela), setor, janela)).toBeNull();
      }
    }
  });

  it('e nem com nove vezes o máximo honesto — a folga medida chega a 9,9×', () => {
    // O número que justifica a margem de 10. Se ela fosse 5, esta linha
    // registraria jogo legítimo de setor alto.
    expect(excedeu(honestoMaximo(15, 90) * 9, 15, 90)).toBeNull();
  });
});

describe('o absurdo entra', () => {
  it('cem vezes o máximo honesto é registrado', () => {
    const e = excedeu(honestoMaximo(3, 90) * 100, 3, 90);
    expect(e).not.toBeNull();
    expect(e!.folga).toBeGreaterThan(MARGEM);
    expect(e!.setor).toBe(3);
  });

  it('e a folga é lida em múltiplos do teto FÍSICO, não do de registro', () => {
    // `folga` é o número que a auditoria lê. Medi-lo contra o teto já
    // multiplicado esconderia uma ordem de grandeza.
    const janela = 60;
    const e = excedeu(tetoFisico(9, janela) * 40, 9, janela);
    expect(e!.folga).toBeCloseTo(40, 1);
  });
});

describe('o que nunca é suspeito', () => {
  it('gasto e perda passam batido', () => {
    // Ninguém trapaceia para ficar mais pobre. Tratar pelo módulo faria uma
    // morte cara — que já custa XP e sucata — virar excedente.
    expect(excedeu(-999_999_999, 1, 60)).toBeNull();
    expect(excedeu(0, 1, 60)).toBeNull();
  });

  it('e valor inválido não vira registro', () => {
    expect(excedeu(Number.NaN, 5, 60)).toBeNull();
    expect(excedeu(Number.POSITIVE_INFINITY, 5, 60)).toBeNull();
    expect(excedeu(100, 5, Number.NaN)).toBeNull();
  });
});

describe('a medição NÃO circular', () => {
  /**
   * Os testes acima comparam a fórmula com ela mesma: `honestoMaximo` é o
   * próprio `tetoFisico`. Isso prova que a margem multiplica, e nada mais — é
   * o mesmo erro que o `progressao.test.ts` cometeu, comparando a fórmula ao
   * seu próprio resultado e chamando aquilo de medida.
   *
   * Este bloco compara com o que a SIMULAÇÃO paga: build representativo do
   * setor, `abstractTick` de verdade, e o ganho de MOEDA — que é o que o livro
   * registra. Medido em 04/09 na faixa de 1 a 300: o pior caso usa **7,4% do
   * teto de registro**, no setor 180. Folga de 13×.
   *
   * ## O que a medição corrigiu
   *
   * O `PLANO` registrava "no setor 1 o teto fica três vezes ABAIXO do ganho
   * honesto". Aquilo foi medido em XP. **O livro não registra XP — registra
   * sucata, núcleo e cristal.** Em moeda, o setor 1 usa 73% do teto físico e
   * 7,4% do de registro. A fórmula não estava errada; estava sendo comparada
   * com a grandeza errada.
   */
  it('o ganho de moeda medido fica muito abaixo do teto', async () => {
    const { Sim } = await import('@sim/index');
    const { sectorIlvl } = await import('@sim/progression');
    const {
      cascoDoSetor, equiparMelhor, slotsDoSetor, sorteDoSetor, tentativasDoSetor,
    } = await import('../tools/lib/balanco');

    const JANELA = 300;
    let pior = 0;

    // Amostra e não a curva inteira: o teste roda em toda execução da suíte, e
    // treze setores de 300 s já custam segundos. A varredura completa mora na
    // mensagem do commit e no PLANO.
    for (const setor of [1, 21, 85, 180, 300]) {
      const estado = equiparMelhor(
        sectorIlvl(setor), cascoDoSetor(setor).id, 4000 + setor,
        tentativasDoSetor(setor), slotsDoSetor(setor), sorteDoSetor(setor),
      );
      const sim = new Sim(estado);
      sim.jumpSector(setor);

      const carga0 = { ...sim.state.run.carga };
      const banco0 = { ...sim.state.resources };
      for (let t = 0; t < JANELA; t += 0.5) sim.abstractTick(0.5);

      const ganho = (['sucata', 'nucleo', 'cristal'] as const).reduce((n, m) => n
        + Math.max(0, (sim.state.run.carga[m] ?? 0) - (carga0[m] ?? 0))
        + Math.max(0, (sim.state.resources[m] ?? 0) - (banco0[m] ?? 0)), 0);

      // Nenhum setor pode registrar o jogador honesto.
      expect(excedeu(ganho, setor, JANELA)).toBeNull();
      pior = Math.max(pior, ganho / JANELA / tetoDeRegistro(setor, 1));
    }

    // A folga medida foi de 13×. Guardar 5× dá espaço para o balanceamento
    // mudar sem quebrar o teste, e ainda quebra se alguém apertar a margem.
    expect(pior).toBeLessThan(0.2);
  }, 120_000);
});
