import { Sim } from '@sim/index';
import { sectorIlvl } from '@sim/progression';

import { cascoDoSetor, equiparMelhor, slotsDoSetor, sorteDoSetor, tentativasDoSetor } from './balanco';

/**
 * Quanto um jogador GANHA por segundo, setor a setor.
 *
 * ## Por que este medidor existe
 *
 * O passo 4 da Fase 5 do Passo 9 precisa de um teto para o ganho que o cliente
 * declara. Duas fórmulas foram tentadas e as duas falharam ao serem medidas —
 * a segunda, baseada em `TAXA_DE_ENTRADA × sectorBounty`, ficava **três vezes
 * ABAIXO** do ganho honesto no setor 1 e recusaria todo jogador novo em
 * silêncio. O detalhe está no `PLANO.md`.
 *
 * O erro das duas foi o mesmo: modelar o ganho por uma fórmula fechada em vez
 * de MEDIR o que o jogo entrega. Este módulo mede.
 *
 * ## Por que roda o `Sim` de verdade
 *
 * `abstractTick` é o mesmo caminho que credita ausência, e ele já resolve o que
 * uma fórmula não resolve: densidade de onda, morte por acúmulo de dano,
 * recuperação de escudo entre encontros, e o teto de ENTRADA que impede matar
 * quem ainda não chegou. Reproduzir isso numa expressão foi exatamente a
 * tentativa que falhou.
 *
 * ## O build de cada setor não é palpite
 *
 * Vem de `balanco.ts`, o mesmo arranjo que `npm run simular -- curva` usa: o
 * casco esperado, os slots liberados e a Sorte que o próprio conjunto produz,
 * resolvida por ponto fixo. Medir o setor 300 com equipamento de setor 3 não
 * mediria nada.
 */

export interface GanhoDoSetor {
  setor: number;
  casco: string;
  /** Segundos simulados. */
  janela: number;
  xpPorSegundo: number;
  sucataPorSegundo: number;
  nucleoPorSegundo: number;
  /** Setores concluídos na janela. Zero significa que ele empacou ali. */
  setoresLimpos: number;
  mortes: number;
  /**
   * Segundos até a vida zerar sob o dano da ONDA, com a regeneração descontada.
   *
   * `Infinity` é comum e não é defeito: na onda comum a regeneração empata ou
   * vence o dano recebido, e o jogador não morre ali. Quem mata é o CHEFE — foi
   * a reconciliação que explicou por que `curva` chama de "trivial" um setor em
   * que esta mesma medição conta nove mortes em cinco minutos. As duas réguas
   * mediam a onda; a morte vinha de outro lugar.
   */
  segundosAteMorrerNaOnda: number;
}

/**
 * Mede o ganho de um setor rodando o caminho abstrato.
 *
 * `repeticoes` usa a MEDIANA, e não a média, pelo mesmo motivo de `medirSetor`:
 * a montagem do equipamento oscila muito entre sementes, e uma rolagem
 * excepcional não deve puxar a expectativa de todos os jogadores.
 */
export function medirGanho(setor: number, janela = 300, repeticoes = 3): GanhoDoSetor {
  const casco = cascoDoSetor(setor);
  const ilvl = sectorIlvl(setor);
  const slots = slotsDoSetor(setor);
  const tentativas = tentativasDoSetor(setor);
  const sorte = sorteDoSetor(setor);

  const amostras = Array.from({ length: repeticoes }, (_, i) => {
    // Parte do estado JÁ EQUIPADO que `balanco.ts` monta — o mesmo caminho
    // que `npm run simular -- curva` usa. Montar o equipamento à mão aqui
    // seria uma segunda régua, e duas réguas divergem.
    const estado = equiparMelhor(ilvl, casco.id, 4000 + setor + i * 7919, tentativas, slots, sorte);
    const sim = new Sim(estado);
    const st = sim.stats;
    // O MESMO denominador que `abstractTick` usa: `vida + escudo` CRU.
    //
    // Não `effectiveHp`. A diferença entre os dois é a mitigação, e é ela que
    // faz `curva` e a simulação discordarem: uma diz "trivial, 40 golpes até
    // morrer" e a outra mata a cada 35 segundos, sobre o MESMO build.
    const efetiva = Math.max(1, st.vida + st.escudo);
    const liquido = Math.max(0, sim.incomingDps - st.regen);
    const segundos = liquido > 0 ? efetiva / liquido : Infinity;

    // `jumpSector`, e NÃO `run.sector = n`.
    //
    // A primeira versão setava o campo direto, e o resultado foi um medidor
    // que dizia "morre a cada 23 segundos" nos mesmos setores que `curva`
    // chama de triviais. O motivo: `refreshEncounter` não rodava, então o
    // encontro continuava sendo o do setor 1 — vida de inimigo e dano
    // recebido de um lugar, recompensa de outro.
    //
    // Os dois medidores discordarem foi o que denunciou o defeito. Vale a
    // lição: quando a régua nova contradiz a antiga, a régua nova é a
    // suspeita.
    sim.jumpSector(setor);
    const antes = {
      xp: estado.command.xp,
      sucata: estado.resources.sucata,
      nucleo: estado.resources.nucleo,
      setor: estado.run.sector,
      mortes: estado.stats.deaths ?? 0,
    };

    // Passo de 0,5 s: é o mesmo grão que o laço ao vivo usa para o caminho
    // abstrato, e passos maiores mudam o resultado — a vida cai por integração,
    // então um passo grosso demais mata menos do que o jogo mata.
    for (let t = 0; t < janela; t += 0.5) sim.abstractTick(0.5);

    return {
      xp: (estado.command.xp - antes.xp) / janela,
      sucata: (estado.resources.sucata - antes.sucata) / janela,
      nucleo: (estado.resources.nucleo - antes.nucleo) / janela,
      setores: estado.run.sector - antes.setor,
      mortes: (estado.stats.deaths ?? 0) - antes.mortes,
      segundos,
    };
  });

  const mediana = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

  return {
    setor,
    casco: casco.id,
    janela,
    xpPorSegundo: mediana(amostras.map((a) => a.xp)),
    sucataPorSegundo: mediana(amostras.map((a) => a.sucata)),
    nucleoPorSegundo: mediana(amostras.map((a) => a.nucleo)),
    setoresLimpos: mediana(amostras.map((a) => a.setores)),
    mortes: mediana(amostras.map((a) => a.mortes)),
    segundosAteMorrerNaOnda: mediana(amostras.map((a) => a.segundos)),
  };
}
