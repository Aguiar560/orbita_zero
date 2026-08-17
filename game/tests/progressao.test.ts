import { describe, expect, it } from 'vitest';
import { TREE_NODES, custoDoNo } from '@data/tree';
import { allocatePath, pointsAvailable, pointsForLevel } from '@sim/tree';
import { NIVEL_MAX, nivelExigido } from '@data/balance/curvas';
import { HULLS } from '@data/hulls';
import { Sim } from '@sim/index';
import { buildEncounter } from '@sim/progression';
import { createState } from '@sim/state';
import { dps } from '@sim/stats';

/**
 * O encontro anda por ABATE, não por dano acumulado.
 *
 * O modelo antigo era um poço de vida que drenava a cada golpe, e a onda
 * terminava quando o poço zerava — com naves ainda vivas na tela. Ficava
 * estranho e apagava a sensação de ter limpado alguma coisa.
 *
 * Trocar exigia resolver o motivo pelo qual o poço existia: antes dele, os
 * inimigos que escapavam pela base limpavam a onda de graça. Agora quem escapa
 * volta para a fila do diretor, então deixar passar não é atalho.
 */
describe('progresso do encontro (§16)', () => {
  const sim = (setor = 20) => {
    const s = new Sim(createState(4242));
    s.jumpSector(setor);
    return s;
  };

  it('o encontro conta unidades, não vida', () => {
    const s = sim();
    const e = s.encounter;
    expect(e.unidades).toBe(e.squad.reduce((a, g) => a + g.count, 0));
    expect(s.state.run.restam).toBe(e.unidades);
    expect(s.state.run.unidades).toBe(e.unidades);
  });

  it('um chefe é uma unidade só', () => {
    const estado = createState(1);
    const e = buildEncounter(estado, 10, 6);
    expect(e.boss).not.toBeNull();
    expect(e.unidades).toBe(1);
  });

  it('cada abate anda com o progresso', () => {
    const s = sim();
    const total = s.state.run.unidades;
    expect(s.sectorProgress).toBe(0);

    s.creditKill();
    expect(s.state.run.restam).toBe(total - 1);
    expect(s.sectorProgress).toBeCloseTo(1 / total, 5);

    for (let i = 1; i < total; i++) s.creditKill();
    expect(s.state.run.restam).toBe(0);
    expect(s.sectorProgress).toBe(1);
  });

  it('o progresso nunca fica negativo, mesmo com abates a mais', () => {
    const s = sim();
    for (let i = 0; i < s.state.run.unidades + 20; i++) s.creditKill();
    expect(s.state.run.restam).toBe(0);
    expect(s.sectorProgress).toBe(1);
  });

  /**
   * O invariante que sustenta a troca: dano por si só não move nada.
   *
   * Verificado também no jogo — com o disparo do jogador desarmado, 104
   * inimigos escaparam em 60 segundos e `restam` ficou parado.
   */
  it('dano sem abate não move o encontro', () => {
    const s = sim();
    const antes = s.state.run.restam;
    // `damageEncounter` não existe mais; se voltar a existir, este teste morre
    // junto com a garantia.
    expect((s as unknown as Record<string, unknown>).damageEncounter).toBeUndefined();
    expect(s.state.run.restam).toBe(antes);
  });

  /**
   * A carga da incursão: ganho de combate só vira saldo quando o setor cai.
   *
   * É o que dá peso à morte sem confiscar o que o jogador já tinha guardado. O
   * risco é o da incursão em curso, e cresce conforme ela avança — que é
   * exatamente a tensão que se quer.
   */
  it('ganho de combate entra na carga, não no banco', () => {
    const s = sim();
    const banco = s.state.resources.sucata;
    s.grantCarga('sucata', 500);
    expect(s.state.run.carga.sucata).toBe(500);
    expect(s.state.resources.sucata).toBe(banco);
  });

  it('a carga vira saldo quando o setor inteiro cai', () => {
    const s = sim();
    const banco = s.state.resources.sucata;
    s.grantCarga('sucata', 500);

    // Vence tudo menos a última: a carga continua em risco.
    for (let w = s.state.run.wave; w <= 5; w++) s.completeEncounter();
    expect(s.state.resources.sucata).toBe(banco);

    // A última fecha o setor e deposita.
    s.completeEncounter();
    expect(s.state.resources.sucata).toBeGreaterThan(banco + 500);
    expect(s.state.run.carga.sucata).toBe(0);
  });

  it('morrer perde a carga e não toca no banco', () => {
    const s = sim();
    const banco = s.state.resources.sucata;
    s.grantCarga('sucata', 900);
    s.grantCarga('nucleo', 40);

    s.failEncounter();

    expect(s.state.run.carga.sucata).toBe(0);
    expect(s.state.run.carga.nucleo).toBe(0);
    expect(s.state.resources.sucata, 'o banco não é tocado aqui').toBe(banco);
  });

  /**
   * A cena e o caminho abstrato precisam medir a MESMA coisa.
   *
   * O abstrato roda quando a janela está fechada. Se ele contasse dano
   * enquanto a cena conta abates, o progresso mudaria de ritmo conforme o
   * jogador estivesse com o jogo aberto ou não.
   */
  it('o caminho abstrato limpa o encontro no tempo que o dano por segundo prevê', () => {
    // Setor 1 de propósito: é o único ponto da curva onde a nave SEM
    // equipamento é a premissa. Num setor adiantado, um jogador nu levaria
    // horas — e o teste mediria a falta de itens, não a conversão de dano em
    // abates, que é o que interessa aqui.
    const s = sim(1);
    const esperado = s.encounter.hpPool / dps(s.stats);
    const ondaAntes = s.state.run.wave;

    let t = 0;
    const PASSO = 0.02;
    while (t < esperado * 4 && s.state.run.wave === ondaAntes) {
      s.abstractTick(PASSO);
      t += PASSO;
    }

    expect(s.state.run.wave, 'o encontro precisa ter sido concluído').not.toBe(ondaAntes);
    expect(Math.abs(t / esperado - 1), `levou ${t.toFixed(1)}s contra ${esperado.toFixed(1)}s`)
      .toBeLessThan(0.15);
  });
});

/**
 * Custo de nó na Matriz (Fase 4).
 *
 * A Matriz saturava no nível 177: eram 177 nós custando 1 ponto cada, e o
 * nível máximo entrega 300 pontos. Cento e vinte e três níveis não faziam NADA
 * por ela, num jogo em que chegar ao 300 é para custar semanas.
 */
describe('a Matriz acompanha os 300 níveis', () => {
  it('o custo total fica logo abaixo dos pontos do nível máximo', () => {
    const total = TREE_NODES.reduce((s, n) => s + custoDoNo(n), 0);
    const disponiveis = pointsForLevel(NIVEL_MAX);
    expect(total).toBeLessThanOrEqual(disponiveis);
    // E perto: sobrar muito significaria a Matriz enchendo cedo de novo.
    expect(disponiveis - total).toBeLessThan(20);
  });

  it('o custo cresce com a distância ao centro', () => {
    const porRaio = TREE_NODES
      .map((n) => ({ raio: Math.hypot(n.x, n.y), custo: custoDoNo(n) }))
      .sort((a, b) => a.raio - b.raio);
    const perto = porRaio.slice(0, 30).reduce((s, n) => s + n.custo, 0) / 30;
    const longe = porRaio.slice(-30).reduce((s, n) => s + n.custo, 0) / 30;
    expect(longe).toBeGreaterThan(perto);
  });

  /**
   * O contrato que a UI depende: alocar uma rota cobra o CUSTO, não a
   * contagem. Comparar contagem com pontos deixaria alocar de graça.
   */
  it('alocar uma rota cobra o custo somado, não o número de nós', () => {
    const s = createState(4242);
    s.command.nivel = 300;

    const alvo = [...TREE_NODES].sort(
      (a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y),
    )[0]!;

    const antes = pointsAvailable(s);
    const cobrado = allocatePath(s, alvo.id);
    expect(cobrado).toBeGreaterThan(0);
    expect(pointsAvailable(s)).toBe(antes - cobrado);
    // A rota até a borda passa por nós caros, então custa mais que o número de
    // nós que ela atravessa.
    expect(cobrado).toBeGreaterThan(s.command.allocated.length - 1);
  });

  it('sem pontos suficientes, nada é alocado', () => {
    const s = createState(99);
    s.command.nivel = 1;
    const alvo = [...TREE_NODES].sort(
      (a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y),
    )[0]!;
    expect(allocatePath(s, alvo.id)).toBe(0);
    expect(s.command.allocated).toHaveLength(0);
  });
});

/**
 * Requisito de nível de personagem (§17).
 *
 * Antes, tudo era liberado só por SETOR — e subir de nível só abastecia a
 * Matriz. Com ela saturando, o nível deixava de significar qualquer coisa.
 */
describe('nível exigido, além do setor', () => {
  /**
   * A promessa que faz este requisito não ser uma segunda parede: quem chegou
   * ao setor JOGANDO passa com folga. Se essa margem sumir, o jogador fica
   * preso olhando uma nave que alcançou e não pode comprar.
   */
  it('quem chega jogando tem folga sobre o exigido', () => {
    // Medido: por volta do setor 10 o jogador está no nível 11; no 20, acima
    // de 30. O exigido no setor 10 é 5, e no 20 é 11.
    expect(nivelExigido(10)).toBeLessThan(11);
    expect(nivelExigido(20)).toBeLessThan(30);
  });

  it('cresce com o setor e nunca é menor que 1', () => {
    expect(nivelExigido(0)).toBe(1);
    expect(nivelExigido(1)).toBe(1);
    for (const s of [10, 50, 150, 300]) {
      expect(nivelExigido(s)).toBeGreaterThan(nivelExigido(s - 5));
    }
  });

  it('no fim do jogo continua abaixo do teto de nível', () => {
    expect(nivelExigido(300)).toBeLessThan(NIVEL_MAX);
  });

  /**
   * O caso que o requisito existe para barrar: alcance sem progressão. Um
   * jogador que pulou setores tem o SETOR mas não o nível.
   */
  it('barra quem tem o setor mas não o nível', () => {
    const s = createState(2);
    const nave = HULLS.find((h) => h.requiresSector > 20)!;
    s.universe.bestSectorEver = nave.requiresSector;
    s.resources.cristal = 1e9;

    const sim = new Sim(s);
    s.command.nivel = 1;
    expect(sim.buyHull(nave.id), 'nível 1 não deveria comprar').toBe(false);

    s.command.nivel = nivelExigido(nave.requiresSector);
    expect(sim.buyHull(nave.id)).toBe(true);
  });
});
