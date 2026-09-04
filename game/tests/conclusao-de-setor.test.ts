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
    expect(s).toContain('Próximo setor');
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
});
