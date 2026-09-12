import { describe, expect, it } from 'vitest';
import { SCREEN_UNLOCKS, screenUnlockFor } from '@data/screen-unlocks';

describe('marcos de telas', () => {
  it('mantém os quatro sistemas em uma progressão de patentes não uniforme', () => {
    expect(SCREEN_UNLOCKS.baus?.level).toBe(6);
    expect(SCREEN_UNLOCKS.fabricacao?.level).toBe(10);
    expect(SCREEN_UNLOCKS.afixos?.level).toBe(21);
    expect(SCREEN_UNLOCKS.provacao?.level).toBe(30);
  });

  it('não cria requisito para telas que sempre devem estar acessíveis', () => {
    expect(screenUnlockFor('galaxia')).toBeUndefined();
    expect(screenUnlockFor('missoes')).toBeUndefined();
    // A LOJA entrou nesta lista em 12/09/2026. Ela abria na patente 14, e as
    // outras travas pedem que o jogador ja TENHA algo — recompensa acumulada,
    // dez pecas iguais, um afixo que valha recalibrar. A Central de Servicos e
    // onde ele GASTA o que acabou de ganhar, e e a primeira decisao que o jogo
    // oferece a quem chegou agora.
    expect(screenUnlockFor('loja')).toBeUndefined();
  });

  it('todo desbloqueio explica a funcionalidade liberada', () => {
    for (const [id, unlock] of Object.entries(SCREEN_UNLOCKS)) {
      expect(unlock.message.trim().length, id).toBeGreaterThan(24);
    }
  });
});
