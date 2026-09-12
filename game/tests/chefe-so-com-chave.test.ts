import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BOSSES, BOSS_INTERVAL, bossForSector, isBossSector } from '@data/bosses';
import { CHAVES_DE_ACESSO } from '@data/chaves-de-acesso';
import { Sim } from '@sim/index';
import { createState, migrate, SAVE_VERSION } from '@sim/state';
import { WAVES_PER_SECTOR } from '@sim/progression';
import { montarEstado } from '../server/src/estado';

/**
 * Estar num setor de chefe SEM ter gasto a chave é impossível. Auditoria.
 *
 * ## Por que um arquivo só para isto
 *
 * Porque a pergunta do Rafael, em 12/09/2026, não foi "conserte" — foi "tenha
 * certeza absoluta, verifique 100% das possibilidades". Uma garantia dessas não
 * se dá com um teste por defeito encontrado: se dá enumerando as portas e
 * trancando a criação de portas novas.
 *
 * ## O histórico que justifica a paranoia
 *
 * | quando | o que estava aberto |
 * |---|---|
 * | até 10/09 | o avanço natural entrava no chefe sem pedir nada |
 * | até 12/09 02:11 | o SALTO DO MAPA movia a nave e só depois pedia a chave |
 * | até 12/09 (esta auditoria) | o modo de teste entrava e a cena o barrava — entrava e travava |
 * | até 12/09 (esta auditoria) | a AUSÊNCIA aceitava `{setor: 10}` do cliente e simulava o chefe |
 *
 * Cada uma foi fechada depois de alguém tropeçar nela. A última — a ausência —
 * ninguém tropeçou: ela apareceu porque desta vez a busca foi por TODA escrita
 * de `run.sector` no projeto, e não pelas que a memória lembrava.
 *
 * ## As quatro camadas, e o que cada uma cobre
 *
 * 1. **As portas** (`jumpSector`, `completeEncounter`) — barram a entrada.
 * 2. **`refreshEncounter`** — recua no meio da sessão, cobrindo a porta que
 *    ninguém listou, inclusive uma escrita nova feita amanhã.
 * 3. **`migrate`** — recusa o save que já esteja dentro, venha ele de onde vier.
 * 4. **O servidor** — a ausência nunca simula um setor de chefe.
 *
 * E a trava de baixo, que é a que dá validade às outras: nenhuma escrita nova
 * em `run.sector` pode nascer sem passar por aqui.
 */

const raiz = (p: string): string => fileURLToPath(new URL(`../${p}`, import.meta.url));

/** Todo arquivo `.ts` de um diretório, recursivamente. */
function arquivos(dir: string): string[] {
  return readdirSync(raiz(dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${dir}/${f.replace(/\\/g, '/')}`);
}

describe('a trava: nenhuma escrita nova em run.sector passa despercebida', () => {
  /**
   * Onde é PERMITIDO escrever o setor, e quantas vezes.
   *
   * Mudou o número? Ou você fechou uma porta — e o número cai — ou abriu uma, e
   * aí a pergunta é se ela pede a chave. Este teste não sabe a resposta; ele
   * garante que alguém tenha de responder antes de seguir.
   */
  const PERMITIDO: Record<string, number> = {
    // `jumpSector` (barrado), `prepararAcessoAoChefe` (consome a chave),
    // `completeEncounter` (barrado) e `garantirSetorComChave` (a rede).
    'src/sim/index.ts': 4,
    // O aparo de sanidade e o recuo do save inválido.
    'src/sim/state.ts': 2,
    // A ausência, que nunca simula chefe.
    'server/src/estado.ts': 1,
  };

  it('só os lugares auditados escrevem run.sector', () => {
    const escrita = /\brun\.sector\s*=(?!=)/g;
    const achados: Record<string, number> = {};

    for (const arquivo of [...arquivos('src'), ...arquivos('server/src')]) {
      const n = (readFileSync(raiz(arquivo), 'utf8').match(escrita) ?? []).length;
      if (n > 0) achados[arquivo] = n;
    }

    expect(achados, 'apareceu (ou sumiu) uma escrita de setor fora da lista auditada')
      .toEqual(PERMITIDO);
  });
});

describe('nenhuma porta entra no setor do chefe sem a chave', () => {
  const semChaves = (): ReturnType<typeof createState> => {
    const state = createState(7);
    state.chavesAcesso = {};
    state.universe.bestSector = 300;
    state.universe.bestSectorEver = 300;
    return state;
  };

  /** Todos os setores de chefe do jogo, e não uma amostra simpática. */
  const setoresDeChefe = Array.from(
    { length: BOSSES.length }, (_, i) => (i + 1) * BOSS_INTERVAL,
  );

  it('o salto do mapa não entra em NENHUM dos setores de chefe', () => {
    for (const setor of setoresDeChefe) {
      const sim = new Sim(semChaves());
      sim.jumpSector(setor);
      expect(sim.state.run.sector, `o salto entrou no setor ${setor}`).not.toBe(setor);
    }
  });

  it('o avanço natural para diante de cada um deles', () => {
    for (const setor of setoresDeChefe) {
      const sim = new Sim(semChaves());
      sim.state.run.sector = setor - 1;
      sim.state.run.wave = WAVES_PER_SECTOR + 1;
      sim.refreshEncounter();
      sim.completeEncounter();
      expect(sim.state.run.sector, `o avanço entrou no setor ${setor}`).toBe(setor - 1);
    }
  });

  it('e nem com "Repetir setor", nem pelo caminho offline', () => {
    for (const repetir of [true, false]) {
      for (const offline of [true, false]) {
        const state = semChaves();
        state.settings.repetirSetor = repetir;
        state.run.sector = 9;
        state.run.wave = WAVES_PER_SECTOR + 1;
        const sim = new Sim(state);
        sim.refreshEncounter();
        sim.completeEncounter(offline);
        expect(sim.state.run.sector, `repetir=${repetir} offline=${offline}`).toBe(9);
      }
    }
  });

  it('recuar para cima de um setor de chefe também não entra', () => {
    for (const setor of setoresDeChefe) {
      const sim = new Sim(semChaves());
      sim.jumpSector(setor + 1);
      sim.recuarUmSetor();
      expect(sim.state.run.sector, `o recuo entrou no setor ${setor}`).not.toBe(setor);
    }
  });

  it('confirmar o cartão sem ter a chave não move a nave', () => {
    const sim = new Sim(semChaves());
    sim.jumpSector(9);
    sim.jumpSector(10);
    expect(sim.prepararAcessoAoChefe(BOSSES[0]!.id)).toBe(false);
    expect(sim.state.run.sector).toBe(9);
  });

  it('mas com a chave na mão a entrada acontece, e consome', () => {
    // A trava não pode virar parede: o caminho legítimo continua inteiro.
    const state = semChaves();
    state.chavesAcesso[CHAVES_DE_ACESSO[0]!.id] = 1;
    const sim = new Sim(state);
    sim.jumpSector(10);
    expect(sim.prepararAcessoAoChefe(BOSSES[0]!.id)).toBe(true);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
    // E continua lá depois de remontar o encontro: a rede não expulsa quem pagou.
    sim.refreshEncounter();
    expect(sim.state.run.sector).toBe(10);
  });
});

describe('e a rede embaixo das portas', () => {
  it('recua no meio da sessão uma porta que ninguém listou', () => {
    /**
     * O teste finge a porta desconhecida: escreve o setor direto no estado, que
     * é o que qualquer caminho novo — ou um console em desenvolvimento — faria.
     * `refreshEncounter` é obrigatório para a mudança virar jogo, e é lá que a
     * rede está.
     */
    const sim = new Sim(createState(11));
    sim.state.run.sector = 20;
    sim.refreshEncounter();

    expect(sim.state.run.sector, 'a porta desconhecida continuou aberta').toBe(19);
    expect(sim.state.run.wave).toBe(1);
  });

  it('e o save que já esteja dentro é recuado, venha de onde vier', () => {
    for (const setor of [10, 20, 150, 300]) {
      const state = createState(12);
      state.run.sector = setor;
      state.universe.bestSector = setor;
      const migrado = migrate({ ...state, version: SAVE_VERSION });
      expect(migrado?.run.sector, `o save no setor ${setor} continuou dentro`).toBe(setor - 1);
      // O recorde não cai junto: a chave adia a entrada, não apaga a conquista.
      expect(migrado?.universe.bestSector).toBe(setor);
    }
  });

  it('e quem gastou a chave não é expulso por nenhuma das duas', () => {
    const state = createState(13);
    state.run.sector = 10;
    state.run.chaveAcessoConsumida = bossForSector(10).id;

    expect(migrate({ ...state, version: SAVE_VERSION })?.run.sector).toBe(10);

    const sim = new Sim(state);
    sim.refreshEncounter();
    expect(sim.state.run.sector).toBe(10);
  });
});

describe('e o servidor não simula chefe na ausência', () => {
  const dados = {
    saldos: { sucata: 0, nucleo: 0, cristal: 0 },
    xp: 0, nivel: 1, matriz: [], melhorSetor: 300,
    materiais: {}, naves: {}, frota: [], itens: [],
  };

  it('o setor declarado pelo cliente é recuado quando é de chefe', () => {
    for (const setor of [10, 20, 100, 300]) {
      const estado = montarEstado(dados, { setor, onda: WAVES_PER_SECTOR + 1 });
      expect(isBossSector(estado.run.sector), `a ausência simulou o chefe do setor ${setor}`)
        .toBe(false);
      expect(estado.run.sector).toBe(setor - 1);
    }
  });

  it('e o setor comum passa intacto', () => {
    expect(montarEstado(dados, { setor: 37, onda: 2 }).run.sector).toBe(37);
  });

  it('e o aparo pelo melhor setor continua valendo', () => {
    // A defesa antiga não pode ter sido perdida no caminho: alegar o setor 300
    // com melhor setor 5 continua rendendo o setor 5.
    expect(montarEstado({ ...dados, melhorSetor: 5 }, { setor: 300 }).run.sector).toBe(5);
  });
});
