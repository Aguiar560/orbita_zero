import { describe, expect, it } from 'vitest';
import { WAVES_PER_SECTOR, buildEncounter, unidadesMinimasDaOnda, xpDaOnda } from '@sim/progression';
import { createState } from '@sim/state';
import { PERFIS_DE_ONDA, TAXA_DE_ENTRADA } from '@data/balance/curvas';
import { FOLGA_DO_PISO, excedeuPorReplica, pisoDeTempoDaOnda, tetoPorReplica } from '../server/src/replica';

/**
 * O teto que REPLICA o jogo, em vez de estimá-lo.
 *
 * ## Por que uma terceira tentativa
 *
 * As duas do `PLANO` (Fase 5, passo 4) falharam pela mesma razão: as duas
 * ESTIMAVAM quanto o jogador deveria ganhar, e a estimativa é instável porque o
 * ganho é dominado por passar ou não do chefe. Medido lá, a folga da fórmula ia
 * de 0,3× a 9,9× em quinze setores — e **no setor 1 o teto ficava três vezes
 * abaixo do ganho honesto**, ou seja, recusaria todo jogador novo em silêncio.
 *
 * Aqui não há número para calibrar. O servidor pergunta ao próprio jogo quanto
 * a onda paga e quanto tempo ela leva, no mínimo, para entrar em campo.
 */

describe('o preço de uma onda', () => {
  it('não depende da semente do universo', () => {
    /**
     * É o que torna o preço calculável por quem não tem o universo do jogador
     * na mão. `bounty` de onda é `RECOMPENSA_FRACAO × waveHp`, e `waveHp` sai
     * de setor, onda e tipo — a semente decide QUAIS inimigos aparecem, não
     * quanto a onda vale.
     */
    const a = createState(1);
    const b = createState(999_999);
    for (const setor of [1, 40, 300]) {
      for (const onda of [1, 2, WAVES_PER_SECTOR + 1]) {
        expect(
          buildEncounter(a, setor, onda).bounty,
          `setor ${setor} onda ${onda} mudou de preço com a semente`,
        ).toBe(buildEncounter(b, setor, onda).bounty);
      }
    }
  });

  it('e é a MESMA conta que o jogo paga ao concluir', () => {
    /**
     * Sem esta asserção, `xpDaOnda` viraria uma segunda versão da regra — e
     * divergiria na primeira vez que alguém mexesse na curva. O sintoma seria o
     * servidor recusar ganho honesto, em silêncio.
     */
    const state = createState(7);
    for (const setor of [1, 21, 150]) {
      for (const onda of [1, 2, WAVES_PER_SECTOR, WAVES_PER_SECTOR + 1]) {
        const e = buildEncounter(state, setor, onda);
        const multiplicador = e.kind === 'chefe' ? 12 : e.kind === 'elite' ? 5 : 2;
        expect(xpDaOnda(setor, onda), `setor ${setor} onda ${onda}`)
          .toBeCloseTo(e.bounty * multiplicador, 6);
      }
    }
  });
});

describe('o piso de tempo', () => {
  it('supõe a onda mais VAZIA possível', () => {
    // Supor a média recusaria quem tirou vanguarda três vezes seguidas. O
    // mínimo é lido dos perfis, não escrito à mão.
    const menor = Math.min(...PERFIS_DE_ONDA.map((p) => p.densidade));
    expect(menor).toBeLessThan(1);
    // Varre SEMENTES: a composicao muda com ela, e um piso valido para uma
    // semente nao e piso. Foi assim que este teste pegou o erro da primeira
    // versao, que supunha 23 unidades onde o jogo produz 22.
    for (const setor of [1, 40, 300]) {
      let menorReal = Infinity;
      for (let semente = 1; semente <= 60; semente++) {
        const state = createState(semente);
        for (let onda = 1; onda <= WAVES_PER_SECTOR; onda++) {
          menorReal = Math.min(menorReal, buildEncounter(state, setor, onda).unidades);
        }
      }
      expect(
        unidadesMinimasDaOnda(setor),
        `o piso do setor ${setor} supõe mais unidades do que a onda mais vazia`,
      ).toBeLessThanOrEqual(menorReal);
    }
  });

  it('e sai das mesmas constantes que a CENA usa para agendar as levas', () => {
    // `TAXA_DE_ENTRADA` não é constante do modelo abstrato: ela é derivada de
    // `LEVA_MIN/MAX` e `LEVA_INTERVALO_MIN/MAX`, que são o agendamento real do
    // `WaveDirector`. Se alguém a transformar num número solto, isto quebra.
    expect(TAXA_DE_ENTRADA).toBeGreaterThan(0);
    expect(pisoDeTempoDaOnda(40)).toBeCloseTo(unidadesMinimasDaOnda(40) / TAXA_DE_ENTRADA, 9);
  });
});

describe('o teto', () => {
  it('NUNCA fica abaixo do jogador honesto mais rápido possível', () => {
    /**
     * É o teste do defeito da tentativa 2, e o mais importante do arquivo.
     *
     * O jogador honesto mais rápido concebível limpa cada onda exatamente no
     * piso de tempo — mais rápido que isso é impossível, porque não se mata
     * quem não entrou. Se o teto ficar abaixo dele, o servidor está recusando
     * jogo legítimo.
     *
     * Medido em 09/09, refeito depois que este mesmo teste pegou dois erros
     * meus: a folga vai de 1,25× a 1,41× de 1 a 300.
     */
    const JANELA = 150;
    for (const setor of [1, 3, 8, 15, 21, 40, 85, 150, 300]) {
      const piso = pisoDeTempoDaOnda(setor);
      let honesto = 0;
      let gasto = 0;
      let onda = 1;
      while (gasto + piso <= JANELA) {
        honesto += xpDaOnda(setor, onda);
        gasto += piso;
        onda = (onda % (WAVES_PER_SECTOR + 1)) + 1;
      }
      const { xp: teto } = tetoPorReplica(setor, JANELA);
      expect(teto, `setor ${setor}: o teto recusaria jogo honesto`)
        .toBeGreaterThanOrEqual(honesto);
    }
  });

  it('e cresce com a janela, não com o palpite', () => {
    // Dobrar o tempo dobra o que cabe. É a propriedade que a fórmula antiga não
    // tinha: lá o teto crescia com `sectorBounty`, que é exponencial.
    const curto = tetoPorReplica(40, 60).xp;
    const longo = tetoPorReplica(40, 600).xp;
    expect(longo).toBeGreaterThan(curto * 5);
  });

  it('e uma janela absurda não vira laço infinito', () => {
    // Relógio adulterado ou conta parada por meses.
    const r = tetoPorReplica(40, 60 * 60 * 24 * 365);
    expect(r.ondas).toBeLessThanOrEqual(20_000);
    expect(Number.isFinite(r.xp)).toBe(true);
  });
});

describe('o registro do excedente', () => {
  it('não registra quem está dentro do teto', () => {
    const { xp: teto } = tetoPorReplica(40, 150);
    expect(excedeuPorReplica(teto * 0.5, 40, 150)).toBeNull();
    expect(excedeuPorReplica(0, 40, 150)).toBeNull();
  });

  it('e registra com a folga, que é o número que se lê', () => {
    const { xp: teto } = tetoPorReplica(40, 150);
    const e = excedeuPorReplica(teto * 40, 40, 150);
    expect(e).toBeTruthy();
    expect(e!.folga, '1,2 é ruído de borda; 40 é outra coisa').toBeCloseTo(40, 1);
    expect(e!.setor).toBe(40);
  });

  it('e a folga do piso é uma margem, não um enfeite', () => {
    // Sem ela o setor 40 — medido em 1,00× do piso — recusaria jogo honesto.
    expect(FOLGA_DO_PISO).toBeGreaterThan(0);
    expect(FOLGA_DO_PISO).toBeLessThan(1);
    const comMargem = tetoPorReplica(40, 150).xp;
    expect(comMargem).toBeGreaterThan(0);
  });
});
