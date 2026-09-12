/**
 * Marcos de acesso às centrais da nave.
 *
 * Não seguem uma cadência de cinco níveis: cada acesso entra quando a sua
 * decisão passa a fazer sentido para o jogador. Manter a tabela centralizada
 * impede que o menu, um atalho e uma chamada interna discordem do requisito.
 *
 * ## A LOJA não está aqui, e a ausência é a regra
 *
 * Ela abria na patente 14 e passou a abrir desde o primeiro minuto, por decisão
 * de 12/09/2026. O argumento das outras travas não valia para ela: Baús,
 * Fabricação, Bancada e Provação pedem que o jogador já TENHA alguma coisa —
 * recompensa acumulada, dez peças da mesma raridade, um afixo que valha
 * recalibrar, uma construção madura. A Central de Serviços é o contrário: ela é
 * onde o jogador gasta o que acabou de ganhar, e é a primeira tela que dá uma
 * decisão a quem acabou de chegar.
 *
 * Tela ausente desta tabela é tela sempre acessível — não existe um segundo
 * lugar dizendo o contrário. Ver `unlockDaTela` em `ui/Shell.ts`.
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
