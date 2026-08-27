/**
 * Marcos de acesso às centrais da nave.
 *
 * Não seguem uma cadência de cinco níveis: cada acesso entra quando a sua
 * decisão passa a fazer sentido para o jogador. Manter a tabela centralizada
 * impede que o menu, um atalho e uma chamada interna discordem do requisito.
 */
export interface ScreenUnlock {
  level: number;
  message: string;
}

export const SCREEN_UNLOCKS: Readonly<Record<string, ScreenUnlock>> = {
  baus: {
    level: 6,
    message: 'A Câmara de Baús recebe as primeiras recompensas de campanha.',
  },
  fabricacao: {
    level: 10,
    message: 'A Câmara de Fabricação permite fundir equipamentos encontrados.',
  },
  loja: {
    level: 14,
    message: 'A Central de Serviços abre contratos de logística e sistemas.',
  },
  afixos: {
    level: 21,
    message: 'A Bancada de Modulação permite recalibrar afixos de equipamento.',
  },
  provacao: {
    level: 30,
    message: 'O Núcleo de Provação abre desafios de chefe para construções maduras.',
  },
};

export const screenUnlockFor = (panelId: string): ScreenUnlock | undefined => SCREEN_UNLOCKS[panelId];
