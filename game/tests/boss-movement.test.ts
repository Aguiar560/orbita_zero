import { describe, expect, it } from 'vitest';
import type { BossMovement } from '@data/bosses';
import { chefeDoPiso } from '@data/provacao-chefes';
import { abrirDesafio, bossDoPiso } from '@sim/desafio';
import { bossMovementTarget } from '@modes/vertical/boss-movement';

const MOVEMENTS: readonly BossMovement[] = [
  'fortaleza', 'artilheiro', 'investida', 'invocador',
  'orbital', 'cacador', 'dispersor', 'espectro',
];

const target = (movement: BossMovement, time: number, playerX = 310) => bossMovementTarget({
  movement,
  time,
  wobble: 0.37,
  anchorX: 270,
  anchorY: 210,
  strafe: 90,
  movementSpeed: 1,
  playerX,
  playerY: 790,
  viewW: 540,
  viewH: 960,
});

describe('movimentação dos chefes da Provação', () => {
  it('os oito arquétipos produzem assinaturas de trajetória diferentes', () => {
    const tempos = [0.5, 1.5, 2.5, 4, 6];
    const assinaturas = MOVEMENTS.map((movement) => JSON.stringify(
      tempos.map((time) => {
        const p = target(movement, time);
        return [Math.round(p.x), Math.round(p.y)];
      }),
    ));
    expect(new Set(assinaturas).size).toBe(MOVEMENTS.length);
  });

  it('investida mergulha muito mais fundo que fortaleza', () => {
    const ys = (movement: BossMovement) => [0, 1, 2, 3, 4, 5, 6]
      .map((time) => target(movement, time).y);
    const span = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(span(ys('investida'))).toBeGreaterThan(span(ys('fortaleza')) * 8);
  });

  it('caçador acompanha o jogador e os demais não teleportam até ele', () => {
    expect(target('cacador', 2, 430).x - target('cacador', 2, 180).x).toBeCloseTo(250);
    expect(target('fortaleza', 2, 430).x).toBe(target('fortaleza', 2, 180).x);
  });

  it('cada piso entrega seu arquétipo e sua velocidade ao combate', () => {
    const usados = new Set<BossMovement>();
    for (let piso = 1; piso <= 100; piso++) {
      const desafio = abrirDesafio(piso);
      const chefe = chefeDoPiso(piso);
      const boss = bossDoPiso(chefe, desafio.efeitos);
      expect(boss.movement, `piso ${piso}`).toBe(chefe.arquetipo);
      expect(boss.movementSpeed, `piso ${piso}`).toBeCloseTo(chefe.velocidade * desafio.efeitos.velocidade);
      usados.add(chefe.arquetipo);
    }
    expect(usados).toEqual(new Set(MOVEMENTS));
  });
});
