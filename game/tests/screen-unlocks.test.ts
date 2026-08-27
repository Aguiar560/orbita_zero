import { describe, expect, it } from 'vitest';
import { SCREEN_UNLOCKS, screenUnlockFor } from '@data/screen-unlocks';

describe('marcos de telas', () => {
  it('mantém os cinco sistemas em uma progressão de patentes não uniforme', () => {
    expect(SCREEN_UNLOCKS.baus?.level).toBe(6);
    expect(SCREEN_UNLOCKS.fabricacao?.level).toBe(10);
    expect(SCREEN_UNLOCKS.loja?.level).toBe(14);
    expect(SCREEN_UNLOCKS.afixos?.level).toBe(21);
    expect(SCREEN_UNLOCKS.provacao?.level).toBe(30);
  });

  it('não cria requisito para telas que sempre devem estar acessíveis', () => {
    expect(screenUnlockFor('galaxia')).toBeUndefined();
    expect(screenUnlockFor('missoes')).toBeUndefined();
  });
});
