/**
 * O resumo da incursão, e o vocabulário do jogo.
 *
 * ## As duas regras
 *
 * 1. **Não existe "fase".** O jogo tem ONDA e SETOR. A palavra estava na tela
 *    com três sentidos ao mesmo tempo: "FASE CONCLUÍDA" para um setor, "fase N"
 *    para a posição do setor dentro da galáxia, e "Próxima fase" para o setor
 *    seguinte. Três coisas, um nome.
 * 2. **O painel de setor presta contas.** É o único momento em que a carga
 *    retida vira saldo, e o número aparecia somado no HUD sem ninguém ver de
 *    onde veio.
 *
 * ## A exceção, decidida em 04/09
 *
 * Três nomes de conteúdo mantêm a palavra e devem ser deixados em paz:
 * **Agulha de Fase** (casco), **Salto de Fase** e **Barreira de Fase** (itens).
 *
 * Ali "fase" é sabor de física — atravessar, deslocar —, não unidade de
 * progressão, e nenhum deles se confunde com onda ou setor. Não há asserção
 * guardando isto de propósito: uma trancaria o catálogo por um motivo que não
 * é o desta regra. Esta nota existe para a próxima varredura não "consertar"
 * o que foi decidido manter.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { WAVES_PER_SECTOR } from '@sim/progression';

const fonte = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

describe('o jogo não tem "fase"', () => {
  it('nem na cena de combate', () => {
    // Onde a palavra estava com três sentidos. `phaseOfSector` continua como
    // IDENTIFICADOR interno da posição na galáxia — o que não pode voltar é a
    // palavra na tela.
    const s = fonte('modes/vertical/VerticalMode.ts');
    // O LITERAL, não a menção: o comentário do painel cita os textos antigos
    // para explicar por que saíram, e proibir a palavra apagaria a história.
    expect(s).not.toContain(String.fromCharCode(39) + 'FASE CONCLUÍDA' + String.fromCharCode(39));
    expect(s).not.toContain(String.fromCharCode(39) + 'Próxima fase' + String.fromCharCode(39));
    expect(s).toContain('SETOR CONCLUÍDO');
    expect(s).toContain('PRÓXIMO SETOR');
  });

  it('nem nos ajustes', () => {
    // O ajuste sempre se chamou `repetirSetor`; só o rótulo dizia outra coisa.
    expect(fonte('ui/panels/SettingsPanel.ts')).toContain("'Repetir o setor'");
  });

  it('e o combate do chefe tem ESTÁGIOS, não fases', () => {
    // `boss.phases` é o identificador e fica: o que muda é o que o Códex diz,
    // para o jogador não ter duas coisas chamadas fase.
    expect(fonte('ui/panels/CodexPanel.ts')).toContain('estágios');
  });
});

describe('o resumo da incursão', () => {
  /** Leva o sim até a onda do chefe do setor, sem passar pela cena. */
  const atéOChefe = (sim: Sim): void => {
    sim.state.run.wave = WAVES_PER_SECTOR + 1;
    sim.refreshEncounter();
  };

  it('conta o que a incursão rendeu, e só a partir da entrada no setor', () => {
    const sim = new Sim(createState(31));
    sim.jumpSector(4);
    // Antes do marco: nada disto pode aparecer no resumo do setor seguinte.
    sim.grantXp(1000);
    sim.state.stats.kills += 50;

    sim.jumpSector(5);
    sim.grantXp(400);
    sim.state.stats.kills += 7;
    sim.guardarMaterial('ferrita', 12);

    const r = sim.resumoDaIncursao();
    expect(r.setor).toBe(5);
    expect(r.abates).toBe(7);
    expect(r.materiais.ferrita).toBe(12);
    // XP é acumulado, não diferença — ver o campo `marco` no `Sim`.
    expect(r.xp).toBeGreaterThan(0);
  });

  it('o XP não fica negativo ao subir de nível', () => {
    /**
     * A armadilha que o acumulador existe para evitar. `command.xp` é o
     * progresso DENTRO do nível: uma diferença de marco daria número negativo
     * exatamente quando o jogador subiu — a hora mais comemorativa do painel.
     */
    const sim = new Sim(createState(32));
    sim.jumpSector(2);
    const antes = sim.state.command.nivel;
    sim.grantXp(500_000);
    expect(sim.state.command.nivel).toBeGreaterThan(antes);
    expect(sim.resumoDaIncursao().xp).toBeGreaterThan(0);
  });

  it('a carga mostrada é a RETIDA, que a conclusão vai depositar', () => {
    // Lida antes de `completeEncounter` de propósito: depois dela a carga já
    // virou saldo e foi zerada, e o painel mostraria tudo em branco.
    const sim = new Sim(createState(33));
    sim.jumpSector(3);
    sim.state.run.carga = { sucata: 900, nucleo: 12, cristal: 1 };
    expect(sim.resumoDaIncursao().carga.sucata).toBe(900);
  });

  it('a contagem recomeça a cada setor — inclusive repetindo o mesmo', () => {
    /**
     * O caso que uma checagem preguiçosa por número de setor não pegaria: com
     * `repetirSetor` ligado, `run.sector` não muda ao concluir, e o resumo da
     * segunda incursão viria somado com o da primeira.
     */
    const sim = new Sim(createState(34));
    sim.jumpSector(6);
    sim.state.settings.repetirSetor = true;
    sim.state.stats.kills += 40;
    atéOChefe(sim);
    sim.completeEncounter();

    expect(sim.state.run.sector).toBe(6);
    expect(sim.resumoDaIncursao().abates).toBe(0);
  });

  it('e o tempo é do setor, não do encontro', () => {
    const sim = new Sim(createState(35));
    sim.jumpSector(8);
    expect(sim.resumoDaIncursao().segundos).toBeGreaterThanOrEqual(0);
    expect(sim.resumoDaIncursao().setor).toBe(8);
  });
});

describe('a pausa de conclusão', () => {
  it('o setor espera o dobro da onda', () => {
    // Dez segundos contra cinco: o painel de setor presta contas de uma
    // incursão inteira, e cinco não dão para ler isso.
    const s = fonte('modes/vertical/VerticalMode.ts');
    expect(s).toContain('const VICTORY_HOLD = 5;');
    expect(s).toContain('const VICTORY_HOLD_SETOR = 10;');
    // A barra tem de dividir pela espera DESTA vitória; fixá-la em
    // `VICTORY_HOLD` faria a de setor encher pela metade e parar.
    expect(s).toContain('this.victory / this.victoryHold');
  });

  it('usa a linguagem holográfica do cockpit, não uma caixa plana', () => {
    const s = fonte('modes/vertical/VerticalMode.ts');
    expect(s).toContain('drawMolduraDeConquista');
    expect(s).toContain('PROTOCOLO DE COMBATE  //  CONCLUÍDO');
    expect(s).toContain("const halo = ctx.createRadialGradient");
    expect(s).toContain("ctx.rotate(Math.PI / 4)");
    expect(s).toContain('PRÓXIMA ONDA');
  });
});

/**
 * Setor concluído devolve a nave inteira. SEMPRE.
 *
 * Regra pedida pelo Rafael em 09/09/2026 — o descanso é a recompensa de fechar
 * o setor, e é o que dá sentido a "aguentar até o fim" em vez de "morrer de
 * propósito para renascer inteiro" — e reafirmada em 12/09: *independente se
 * foi repetido, chefe ou qualquer coisa*.
 *
 * ## O que estava quebrado
 *
 * `completeEncounter` sempre gravou `vidaFracao = 1`. Quem aplica isso na nave
 * em cena é o `VerticalMode`, e o gatilho dele era comparar o NÚMERO do setor
 * encenado com o do encontro. O número não muda em dois caminhos comuns:
 *
 * | caminho | setor 4 -> ? | curou? |
 * |---|---|---|
 * | avanço normal | 5 | sim |
 * | "Repetir setor" ligado | 4 | **não** |
 * | próximo é setor de chefe | 4 (espera a chave) | **não** |
 *
 * Nos dois de baixo a cena não recarregava a nave, e `guardarVida` — que roda
 * todo quadro — escrevia a vida machucada por cima do `1`. A cura acontecia no
 * save e era desfeita antes de chegar à tela.
 */
describe('a conclusão de setor devolve a nave inteira', () => {
  const arranhada = (sim: Sim): void => {
    sim.state.run.wave = WAVES_PER_SECTOR + 1;
    sim.state.run.vidaFracao = 0.32;
    sim.state.run.escudoFracao = 0;
    sim.refreshEncounter();
  };

  it('no avanço normal', () => {
    const sim = new Sim(createState(41));
    sim.jumpSector(4);
    arranhada(sim);
    sim.completeEncounter();

    expect(sim.state.run.sector, 'o ponteiro não andou').toBe(5);
    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.escudoFracao).toBe(1);
    expect(sim.state.run.curaPendente, 'a cena não foi avisada de que precisa curar').toBe(true);
  });

  it('com "Repetir setor" ligado, em que o ponteiro NÃO anda', () => {
    const sim = new Sim(createState(42));
    sim.jumpSector(4);
    sim.state.settings.repetirSetor = true;
    arranhada(sim);
    sim.completeEncounter();

    expect(sim.state.run.sector, 'repetir setor deixou de repetir').toBe(4);
    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.curaPendente, 'a incursão nova começaria com a vida da anterior').toBe(true);
  });

  it('e entrando em setor de chefe, com o ponteiro parado na chave', () => {
    // O caso mais caro dos três: era justamente a luta em que a nave mais
    // precisa da vida cheia que a recebia pela metade.
    const sim = new Sim(createState(43));
    sim.jumpSector(9);
    arranhada(sim);
    sim.completeEncounter();

    expect(sim.state.run.sector, 'passou do chefe sem a chave').toBe(9);
    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.curaPendente).toBe(true);
  });

  it('e o caminho offline levanta a mesma marca', () => {
    // Sem isto, voltar de horas fora entregaria a nave como ela ficou.
    const sim = new Sim(createState(44));
    sim.jumpSector(4);
    arranhada(sim);
    sim.completeEncounter(true);

    expect(sim.state.run.vidaFracao).toBe(1);
    expect(sim.state.run.curaPendente).toBe(true);
  });
});

describe('e a cena obedece à marca, não ao número do setor', () => {
  // Lido do fonte porque a regra mora na cena, e a suíte não tem DOM nem
  // canvas — mesma técnica de `vitoria-conclui-na-hora`.
  const cena = fonte('modes/vertical/VerticalMode.ts');

  it('a marca é consumida, e a cura não depende de `setorMudou`', () => {
    expect(cena).toContain('if (run.curaPendente) {');
    expect(cena, 'a cura voltou a depender do número do setor')
      .not.toContain('if (setorMudou) this.retomarVidaGuardada();');
  });

  it('e as frações são REGRAVADAS, sem confiar no que está no save', () => {
    /**
     * `guardarVida` roda todo quadro. Se algum quadro tiver escrito a vida
     * machucada por cima do `1` antes de a cena montar o encontro, confiar no
     * save devolveria a nave arranhada — que era exatamente o defeito.
     */
    const bloco = cena.slice(cena.indexOf('if (run.curaPendente) {'));
    expect(bloco.slice(0, 220)).toContain('run.vidaFracao = 1;');
    expect(bloco.slice(0, 220)).toContain('run.escudoFracao = 1;');
  });

  it('e isso acontece ANTES da barreira do chefe', () => {
    // Sair antes da cura deixaria a nave arranhada na tela enquanto o cartão
    // de acesso espera, e a cura seria aplicada tarde — ou nunca.
    expect(cena.indexOf('if (run.curaPendente) {'))
      .toBeLessThan(cena.indexOf("this.setBanner('CHAVE DE ACESSO NECESSÁRIA')"));
  });
});
