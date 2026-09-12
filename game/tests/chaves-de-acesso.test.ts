import { describe, expect, it } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BOSSES } from '@data/bosses';
import { CHANCES_DROP_CHAVE_POR_FASE, CHAVE_POR_ID, CHAVES_DE_ACESSO, chanceDropChavePorAbate } from '@data/chaves-de-acesso';
import { createState, migrate, SAVE_VERSION } from '@sim/state';
import { Sim } from '@sim/index';
import { WAVES_PER_SECTOR } from '@sim/progression';

describe('chaves de acesso', () => {
  it('mantém uma chave exclusiva para cada galáxia e chefe', () => {
    expect(CHAVES_DE_ACESSO).toHaveLength(BOSSES.length);
    expect(new Set(CHAVES_DE_ACESSO.map((c) => c.id)).size).toBe(BOSSES.length);
    expect(new Set(CHAVES_DE_ACESSO.map((c) => c.arte)).size).toBe(BOSSES.length);
    CHAVES_DE_ACESSO.forEach((chave, galaxia) => {
      expect(chave.galaxia).toBe(galaxia);
      expect(chave.bossId).toBe(BOSSES[galaxia]!.id);
      expect(CHAVE_POR_ID.get(chave.id)).toBe(chave);
      expect(chave.arte).toMatch(new RegExp(`^chaves/chave-${String(galaxia + 1).padStart(2, '0')}-.*\\.webp$`));
    });
  });

  it('entrega 30 artes próprias, transparentes e prontas para a interface', async () => {
    await Promise.all(CHAVES_DE_ACESSO.map(async (chave) => {
      const arquivo = new URL(`../public/assets/${chave.arte}`, import.meta.url);
      await access(arquivo);
      const metadata = await sharp(fileURLToPath(arquivo)).metadata();
      expect(metadata.width).toBe(256);
      expect(metadata.height).toBe(256);
      expect(metadata.hasAlpha).toBe(true);
    }));
  });

  it('usa a arte própria também quando a chave cai fisicamente do inimigo', async () => {
    const source = await readFile(new URL('../src/modes/vertical/VerticalMode.ts', import.meta.url), 'utf8');
    expect(source).toContain('chave.chave.arte');
    expect(source).toContain('assets.prefetch(arte)');
    expect(source).toContain('assets.peek(item.icon)');
  });

  it('guarda chaves fora do inventário e migra dados inválidos', () => {
    const state = createState();
    expect(state.inventory).toHaveLength(0);
    expect(state.chavesAcesso).toEqual({});
    const migrated = migrate({ ...state, version: SAVE_VERSION - 1, chavesAcesso: { [CHAVES_DE_ACESSO[0]!.id]: 3, fantasma: 99 }, chavesAcessoGarantidas: [0, 0, -1, 999] });
    expect(migrated?.chavesAcesso).toEqual({ [CHAVES_DE_ACESSO[0]!.id]: 3 });
    expect(migrated?.chavesAcessoGarantidas).toEqual([0]);
  });

  it('consome apenas a chave da própria galáxia por tentativa', () => {
    const state = createState();
    const chave = CHAVES_DE_ACESSO[0]!;
    state.chavesAcesso[chave.id] = 1;
    const sim = new Sim(state);
    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.prepararAcessoAoChefe(BOSSES[1]!.id)).toBe(false);
  });

  it('pede confirmação antes de avançar para o setor do chefe', async () => {
    const source = await readFile(new URL('../src/ui/Shell.ts', import.meta.url), 'utf8');
    expect(source).toContain('boss:access-requested');
    expect(source).toContain('Você possui ${quantidade}');
  });

  it('segura o avanço do setor anterior até confirmar a chave', () => {
    const state = createState();
    const chave = CHAVES_DE_ACESSO[0]!;
    state.run.sector = 9;
    state.run.wave = WAVES_PER_SECTOR + 1;
    state.chavesAcesso[chave.id] = 1;
    const sim = new Sim(state);

    sim.completeEncounter();
    expect(sim.state.run.sector).toBe(9);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(1); // concluir não concede chave diretamente

    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
  });

  it('não deixa o salto do mapa entrar no chefe antes da confirmação', () => {
    const state = createState();
    const chave = CHAVES_DE_ACESSO[0]!;
    state.chavesAcesso[chave.id] = 1;
    const sim = new Sim(state);

    sim.jumpSector(10);
    expect(sim.state.run.sector).toBe(1);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(1);

    expect(sim.prepararAcessoAoChefe(chave.bossId)).toBe(true);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);
  });

  /**
   * "Se não tem chave não pode nem entrar no setor" — regra do Rafael, 12/09.
   *
   * O relato foi de entrar no 10, 20 e 30 sem chave e travar só na porta do
   * chefe. Medidas as seis portas, as do jogo estavam fechadas e as do MODO DE
   * TESTE entravam — e a barreira da cena não isentava o modo de teste, então
   * quem entrava por ali ficava preso: sem chave para gastar e sem volta.
   *
   * Estes testes guardam as duas metades: a regra num lugar só, e a rede
   * embaixo dela em `migrate`, para um save que já esteja dentro não continuar
   * dentro.
   */
  it('nenhuma porta do jogo entra no setor do chefe sem a chave', () => {
    const entrou = (preparar: (sim: Sim) => void): number => {
      const state = createState();
      state.universe.bestSector = 40;
      const sim = new Sim(state);
      preparar(sim);
      return sim.state.run.sector;
    };

    // Avanço natural: conclui o 9 e para, esperando a confirmação.
    expect(entrou((sim) => {
      sim.jumpSector(9);
      sim.state.run.wave = WAVES_PER_SECTOR + 1;
      sim.completeEncounter();
    })).toBe(9);

    // Com "Repetir setor" ligado o ponteiro nem tenta andar.
    expect(entrou((sim) => {
      sim.jumpSector(9);
      sim.state.settings.repetirSetor = true;
      sim.state.run.wave = WAVES_PER_SECTOR + 1;
      sim.completeEncounter();
    })).toBe(9);

    // Salto do mapa e recuo para cima de um setor de chefe.
    expect(entrou((sim) => sim.jumpSector(20))).toBe(1);
    expect(entrou((sim) => { sim.jumpSector(11); sim.recuarUmSetor(); })).toBe(11);
  });

  it('e um save que JÁ esteja dentro é recuado ao entrar no jogo', () => {
    const state = createState();
    state.run.sector = 10;
    state.run.wave = 3;
    state.universe.bestSector = 12;

    const migrado = migrate({ ...state, version: SAVE_VERSION });
    expect(migrado?.run.sector, 'continuou preso na porta do chefe').toBe(9);
    expect(migrado?.run.wave).toBe(1);
    // O que ele conquistou não se perde: o setor volta a ser escolhível assim
    // que a chave aparecer.
    expect(migrado?.universe.bestSector).toBe(12);
  });

  it('mas quem GASTOU a chave continua no setor depois de recarregar', () => {
    const state = createState();
    state.run.sector = 10;
    state.run.wave = 4;
    state.run.chaveAcessoConsumida = BOSSES[0]!.id;

    expect(migrate({ ...state, version: SAVE_VERSION })?.run.sector,
      'a recarga expulsou quem pagou a entrada').toBe(10);
  });

  it('e o modo de teste entra e LUTA, em vez de travar na porta', () => {
    // O defeito relatado: o `Sim` isentava o modo de teste e a cena não.
    const state = createState();
    state.settings.testMode = true;
    state.run.sector = 10;
    expect(migrate({ ...state, version: SAVE_VERSION })?.run.sector).toBe(10);

    const sim = new Sim(createState());
    sim.setTestMode(true);
    sim.jumpSector(10);
    expect(sim.state.run.sector).toBe(10);
    expect(sim.acessoAoChefeLiberado(BOSSES[0]!.id), 'entrou e ficou preso na porta').toBe(true);
  });

  it('e a cena pergunta ao Sim, em vez de reescrever a regra', async () => {
    // Duas condições escritas à mão discordam — foi o que aconteceu aqui.
    const cena = await readFile(new URL('../src/modes/vertical/VerticalMode.ts', import.meta.url), 'utf8');
    expect(cena).toContain('!this.sim.acessoAoChefeLiberado(e.boss.id)');
    expect(cena).not.toContain('run.chaveAcessoConsumida !== e.boss.id');
  });

  it('cancelar um chefe escolhido longe mantém o setor atual', () => {
    const sim = new Sim(createState());
    sim.jumpSector(10);
    expect(sim.recuarUmSetor()).toBe(true);
    expect(sim.state.run.sector).toBe(1);
  });

  it('materializa a garantia como cápsula física no último abate', () => {
    const state = createState();
    const sim = new Sim(state);
    const drop = sim.rollChaveDuranteAbate(9, true);

    expect(drop?.garantida).toBe(true);
    expect(drop?.chave.id).toBe(CHAVES_DE_ACESSO[0]!.id);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(0);

    sim.adquirirChave(drop!.chave.id, 9, drop!.garantida);
    expect(sim.quantidadeChaveDaGalaxia(0)).toBe(1);
    expect(state.chavesAcessoGarantidas).toEqual([0]);
  });

  it('aumenta progressivamente a chance do primeiro ao nono setor de toda galáxia', () => {
    expect(CHANCES_DROP_CHAVE_POR_FASE).toHaveLength(9);
    expect(chanceDropChavePorAbate(0)).toBe(0);
    expect(chanceDropChavePorAbate(10)).toBe(0);
    for (let fase = 2; fase <= 9; fase++) {
      expect(chanceDropChavePorAbate(fase)).toBeGreaterThan(chanceDropChavePorAbate(fase - 1));
    }
    expect(chanceDropChavePorAbate(1)).toBe(0.001);
    expect(chanceDropChavePorAbate(9)).toBe(0.01);
  });
});
