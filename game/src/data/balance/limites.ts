import { STAT_IDS, type StatId, type Stats } from '@sim/types';

/**
 * Todos os tetos e pisos de sanidade do jogo (§40 da Especificação Mestre).
 *
 * Existe como tabela, e num arquivo só, por um motivo prático: antes disto os
 * limites estavam escritos à mão no fim de `resolveStats`, e quem adicionava um
 * atributo novo não tinha como saber que existia um lugar para limitá-lo. Um
 * teto esquecido não aparece em teste normal — aparece muito depois, como
 * invulnerabilidade permanente ou como mil projéteis derrubando o quadro.
 *
 * A regra é: se um atributo pode ser empilhado por item, conjunto, Matriz ou
 * casco, ele precisa de entrada aqui.
 */

export interface Limite {
  min?: number;
  max?: number;
  /** Arredonda para inteiro antes de aplicar piso e teto. */
  inteiro?: boolean;
}

/**
 * Limites por atributo.
 *
 * Os valores que já existiam foram preservados exatamente para esta etapa não
 * alterar o balanceamento — ela move e organiza, não recalibra. Os marcados
 * como NOVO fecham buracos que o §40 aponta e que hoje não têm teto nenhum.
 */
export const LIMITES: Partial<Record<StatId, Limite>> = {
  // NOVO — o §8 mediu: cada projétil extra vale +100% de dano. Sem teto, um
  // punhado de afixos multiplicaria o dano por dez e encheria a tela de
  // entidades até derrubar o quadro.
  projeteis: { min: 1, max: 12, inteiro: true },
  perfuracao: { min: 0, max: 20, inteiro: true },

  // NOVO no teto: 20 disparos por segundo já é um jato contínuo. Acima disso o
  // pool de projéteis satura e o ganho vira ilusão — o jogador paga por dano
  // que nunca chega a existir.
  cadencia: { min: 0.2, max: 20 },

  // Sem teto de propósito. O §40 pede limite para VELOCIDADE DE ATAQUE, que é
  // `cadencia`; deslocamento é outra coisa. Um teto aqui reduziria a esquiva do
  // piloto de IA, que é mudança de jogo — e medindo, era o único teto que
  // chegava a morder hoje, a partir do setor 43.
  velocidade: { min: 60 },
  vida: { min: 1 },
  escudo: { min: 0 },

  // NOVO — regeneração é limitada em fração da vida máxima, não em valor
  // absoluto, porque um teto fixo seria generoso demais no começo e inútil no
  // fim. Ver `REGEN_MAX_FRACAO`; aqui fica só o piso.
  regen: { min: 0 },

  critChance: { min: 0, max: 0.95 },
  critDano: { min: 0 },
  critElemChance: { min: 0, max: 0.95 },
  critElemDano: { min: 0 },
  /**
   * Penetração para em 0,8, o mesmo `PENETRACAO_MAX` do módulo elemental.
   *
   * Repetido aqui de propósito: este teto é o que o §40 exige de TODA fórmula,
   * e o de lá é o que a função de confronto aplica. Penetração total tornaria a
   * escolha de elemento irrelevante — bastaria empilhá-la e atirar em qualquer
   * coisa. Em 0,8 o pior confronto sai de 0,70 para 0,94: quase neutro, nunca
   * melhor.
   */
  penetracao: { min: 0, max: 0.8 },
  explosao: { min: 0, max: 260 },
  iaSkill: { min: 0, max: 1 },

  // NOVO — sorte era o único atributo fracionário sem teto, e por isso foi o
  // único cujo defeito de escala apareceu no jogo em vez de ser mascarado por
  // um limite. Ela entra na tabela de raridade como expoente, então cada ponto
  // a mais desloca a distribuição inteira.
  sorte: { min: 0, max: 5 },
};

/**
 * Teto de resistência elemental.
 *
 * Sem ele, empilhar resistência zeraria uma linha inteira de dano e o jogador
 * ficaria imune a metade do bestiário — o oposto de uma escolha.
 *
 * A auditoria propôs 0,80; fica em 0,75 até a calibragem da etapa 1.4, porque
 * mexer nisto agora mudaria o balanceamento numa etapa que só deveria mover
 * código de lugar.
 */
export const RES_MAX = 0.75;

/** Piso de resistência: −1 significa levar o dobro, não mais que isso. */
export const RES_MIN = -1;

/**
 * Regeneração máxima por segundo, em fração da vida máxima.
 *
 * Se a regeneração superar o dano recebido, a nave vira imortal e o combate
 * deixa de ter desfecho. O teto garante que exista sempre um dano por segundo
 * capaz de vencê-la.
 */
export const REGEN_MAX_FRACAO = 0.25;

/**
 * Teto do produto de multiplicadores elementais num único golpe.
 *
 * Vantagem no anel, potência do elemento, penetração e vulnerabilidade do alvo
 * se multiplicam. Cada um é modesto sozinho; juntos, o §40 avisa que viram
 * "multiplicações recursivas".
 */
export const MULT_ELEMENTAL_MAX = 4;

/** Teto de redução de dano físico, para o mesmo motivo da resistência. */
export const REDUCAO_DANO_MAX = 0.8;

/**
 * Teto de inimigos por onda.
 *
 * O §40 fala em "travamentos por excesso de entidades", e a densidade agora é
 * um eixo de dificuldade — sem teto, um perfil de enxame num setor profundo
 * pediria centenas de naves. O pool de inimigos comporta 200; este limite fica
 * bem abaixo para sobrar espaço aos lacaios que os chefes invocam.
 */
export const INIMIGOS_POR_ONDA_MAX = 240;

/** Teto de inimigos do mesmo tipo num grupo, para a formação continuar legível. */
export const INIMIGOS_POR_GRUPO_MAX = 160;

/**
 * Aplica todos os limites, no lugar.
 *
 * Muta em vez de devolver cópia porque roda no fim de `resolveStats`, que já é
 * chamado a cada mudança de estado e é o caminho quente da simulação de
 * balanceamento — copiar vinte e sete atributos ali não paga.
 */
export function aplicarLimites(stats: Stats): void {
  for (const id of STAT_IDS) {
    const limite = LIMITES[id];
    if (!limite) continue;

    let v = stats[id];
    if (limite.inteiro) v = Math.round(v);
    if (limite.min !== undefined && v < limite.min) v = limite.min;
    if (limite.max !== undefined && v > limite.max) v = limite.max;
    stats[id] = v;
  }

  // Depende de outro atributo, então não cabe na tabela.
  const tetoRegen = stats.vida * REGEN_MAX_FRACAO;
  if (stats.regen > tetoRegen) stats.regen = tetoRegen;
}
