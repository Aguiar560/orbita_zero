import { bossForSector } from '@data/bosses';
import { describe, expect, it } from 'vitest';
import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { WAVES_PER_SECTOR, buildEncounter, precoDoEncontro } from '@sim/progression';
import { xpAcumuladoDe } from '@sim/nivel';
import { curvaXpPersonagem } from '@data/balance/curvas';
import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { HULLS } from '@data/hulls';

/**
 * O servidor consegue calcular EXATAMENTE o que o jogo pagou?
 *
 * É a pergunta que decide se ele pode deixar de acreditar no cliente. Enquanto a
 * resposta for "quase", o teto só pode limitar; quando for "exatamente", ele
 * pode pagar.
 *
 * Três coisas tiveram de ficar prontas antes, e cada uma veio de uma medição que
 * derrubou uma suposição minha:
 *
 * 1. A **semente** no servidor (`migrations/0013`), senão ele monta outra onda —
 *    outros inimigos, outra densidade, outra contagem.
 * 2. Descobrir que a maior parte do XP vem do **abate**, não da conclusão. No
 *    setor 1 são 99% do abate. Precificar "onda concluída" faria o jogador novo
 *    perder quase tudo.
 * 3. `grantXp` multiplica por `XP_GANHO_GLOBAL × (1 + xpGanho)`, e `xpGanho` vem
 *    do equipamento. Sem isso o preço sairia **24× abaixo** do que o jogo paga.
 *
 * Nada disso apareceu lendo o código: apareceu medindo.
 */

const casco = HULLS[0]!.id;
const SEMENTE = 424242;

const dados = (): DadosDoServidor => ({
  saldos: { sucata: 0, nucleo: 0, cristal: 0 },
  xp: 0, nivel: 1, matriz: [], melhorSetor: 300,
  materiais: {}, naves: {}, frota: [casco], itens: [], semente: SEMENTE,
});

/** O XP que o jogo REALMENTE creditou, em acumulado — não no resto do nível. */
const xpTotal = (sim: Sim): number => xpAcumuladoDe(sim.state.command, curvaXpPersonagem);

describe('o preço de um encontro', () => {
  it('bate com o que o JOGO pagou, do primeiro abate à conclusão', () => {
    /**
     * O teste que autoriza o servidor a pagar. Ele roda o jogo de verdade — o
     * mesmo `premiarAbates` e o mesmo `completeEncounter` — e compara com o que
     * o servidor calcula sozinho, tendo só a semente e o estado.
     */
    for (const setor of [1, 8, 40, 150]) {
      for (const onda of [1, 3, WAVES_PER_SECTOR + 1]) {
        const sim = new Sim(createState(SEMENTE));
        sim.state.run.sector = setor;
        sim.state.run.wave = onda;
        // A chave já paga: o teste mede o PREÇO do encontro, e o setor 40 é de
        // chefe. Sem isto `refreshEncounter` recua um setor e a comparação
        // passaria a ser entre encontros diferentes.
        sim.state.run.chaveAcessoConsumida = bossForSector(setor).id;
        sim.refreshEncounter();

        const e = sim.encounter;
        const antes = xpTotal(sim);

        // Abate a onda inteira em pedaços, como a cena faz, e conclui.
        let mortos = 0;
        while (mortos < e.unidades) {
          const lote = Math.min(7, e.unidades - mortos);
          sim.premiarAbates(lote, 1 / Math.max(1, e.unidades));
          mortos += lote;
        }
        sim.completeEncounter();

        const pago = xpTotal(sim) - antes;
        const calculado = precoDoEncontro(sim.state, setor, onda, e.unidades);

        expect(
          calculado,
          `setor ${setor} onda ${onda}: o servidor não reproduz o que o jogo pagou`,
        ).toBeCloseTo(pago, 4);
      }
    }
  });

  it('e o servidor monta a MESMA onda que o jogador enfrentou', () => {
    // É o que a semente compra. Sem ela, `unidades` e `abatesDeReferencia` saem
    // diferentes, e o preço junto.
    const doJogador = createState(SEMENTE);
    const doServidor = montarEstado(dados(), {});
    for (const setor of [1, 40, 300]) {
      for (let onda = 1; onda <= WAVES_PER_SECTOR + 1; onda++) {
        const a = buildEncounter(doJogador, setor, onda);
        const b = buildEncounter(doServidor, setor, onda);
        expect(b.unidades, `setor ${setor} onda ${onda}`).toBe(a.unidades);
        expect(b.abatesDeReferencia).toBe(a.abatesDeReferencia);
        expect(b.bounty).toBe(a.bounty);
      }
    }
  });

  it('e meia onda paga meio abate e NENHUMA conclusão', () => {
    /**
     * A regra que impede declarar "matei três" e receber o bônus de ter
     * limpado. É o que o jogo faz: `completeEncounter` só roda quando
     * `run.restam` chega a zero.
     */
    const estado = montarEstado(dados(), {});
    for (const setor of [1, 40]) {
      const e = buildEncounter(estado, setor, 1);
      const metade = precoDoEncontro(estado, setor, 1, Math.floor(e.unidades / 2));
      const inteira = precoDoEncontro(estado, setor, 1, e.unidades);
      expect(metade).toBeLessThan(inteira);
      expect(inteira - metade, 'a diferença tem de incluir o bônus de conclusão')
        .toBeGreaterThan(e.bounty);
    }
  });

  it('e declarar mais abates do que a onda tem não paga mais', () => {
    const estado = montarEstado(dados(), {});
    const e = buildEncounter(estado, 40, 1);
    expect(precoDoEncontro(estado, 40, 1, e.unidades * 100))
      .toBe(precoDoEncontro(estado, 40, 1, e.unidades));
    expect(precoDoEncontro(estado, 40, 1, -5)).toBe(0);
  });

  it('e o multiplicador do equipamento entra no preço', () => {
    /**
     * Sem ele o preço sai 24× abaixo — `XP_GANHO_GLOBAL` sozinho já é 24 — e o
     * servidor recusaria todo ganho honesto. É o defeito das duas tentativas
     * anteriores, chegando por uma terceira porta.
     */
    const estado = montarEstado(dados(), {});
    const e = buildEncounter(estado, 40, 1);
    const cru = (2 + e.bounty * 0.25) * e.abatesDeReferencia + e.bounty * 2;
    expect(precoDoEncontro(estado, 40, 1, e.unidades)).toBeGreaterThan(cru * 20);
  });
});
