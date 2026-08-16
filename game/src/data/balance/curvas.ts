/**
 * Todas as curvas de progressão do jogo, num lugar só (§2, §36).
 *
 * Antes disto os expoentes viviam espalhados por sete arquivos — dificuldade em
 * `sim/progression.ts`, custo da Matriz em `sim/tree.ts`, XP de patrulha em
 * `sim/index.ts`, escala de afixo em `sim/loot.ts`. O efeito prático era que
 * ninguém nunca havia calculado a RAZÃO entre a curva do inimigo e a do
 * jogador, que é justamente o número que define o ritmo do jogo. A auditoria da
 * FASE 0 mediu essa razão em 1,129 por setor: 131 mil vezes acumuladas em 99
 * setores, o que torna o jogo trivial até o setor 40 e impossível depois do 80.
 *
 * Este arquivo é só de DADOS: nenhuma regra de jogo mora aqui, só os números e
 * a forma das curvas. Quem os consome continua em `sim/`.
 *
 * ► Os valores abaixo são os ORIGINAIS, movidos sem alteração. A recalibragem é
 *   a etapa 1.4, e vai mexer nestes números com simulação por trás.
 */

// ── estrutura do setor ──────────────────────────────────────────────────────

/** Ondas por setor antes do encontro final. */
export const WAVES_PER_SECTOR = 5;

// ── dificuldade ─────────────────────────────────────────────────────────────

/**
 * Vida do encontro por setor.
 *
 * 1,235 por setor dobra a cada ~3,3 setores. É o expoente mais agressivo do
 * jogo, e é ele que descola da curva do jogador (medida em 1,096).
 */
export const HP_BASE = 34;
export const HP_RAZAO = 1.235;

/**
 * Dano de um golpe inimigo.
 *
 * Cresce mais devagar que a vida de propósito: a ameaça precisa acompanhar o
 * casco sem transformar cada projétil perdido em morte instantânea, já que quem
 * pilota é a IA e não o jogador. A base 9 é alta o bastante para o piloto cru
 * sentir cada tiro que não desviou — com 3,4 o começo era inofensivo e a curva
 * de pilotagem não tinha como se provar.
 */
export const DANO_BASE = 9;
export const DANO_RAZAO = 1.1;

/** Recompensa base do setor, antes dos multiplicadores do jogador. */
export const RECOMPENSA_BASE = 7;
export const RECOMPENSA_RAZAO = 1.19;

/** Nível de item que cai no setor. */
export const ILVL_POR_SETOR = 0.9;

// ── progressão do jogador ───────────────────────────────────────────────────

/**
 * XP para subir de patente de comando.
 *
 * Base baixa e crescimento moderado: os primeiros pontos precisam chegar nos
 * primeiros minutos, senão a Matriz fica trancada justamente quando ela é a
 * coisa mais interessante para quem está começando.
 */
export const COMANDO_XP_BASE = 140;
export const COMANDO_XP_RAZAO = 1.155;

/** Sincronia do piloto concedida por patente, e o teto dessa fonte. */
export const COMANDO_IA_POR_NIVEL = 0.011;
export const COMANDO_IA_MAX = 0.4;

/** XP para subir o nível de patrulha da faixa horizontal. */
export const PATRULHA_XP_BASE = 120;
export const PATRULHA_XP_RAZAO = 1.24;

// ── itens ───────────────────────────────────────────────────────────────────

/**
 * Quanto um afixo aditivo cresce por nível de item.
 *
 * Percentuais não escalam — já são relativos. Resistência também não, apesar de
 * ser aditiva na forma: ela é fração no significado, e escalada por nível um
 * +4% viraria +130% no setor 30, ou seja, imunidade.
 */
export const AFIXO_ESCALA_POR_ILVL = 0.32;

/** Chance de um abate soltar item, por tipo de encontro. */
export const DROP_BASE = { onda: 0.06, elite: 0.5, chefe: 1 } as const;
/** Quanto a sorte empurra a chance de drop, e o teto dela. */
export const DROP_SORTE_PESO = 0.8;
export const DROP_TETO = 0.75;

// ── funções de curva ────────────────────────────────────────────────────────

const geometrica = (base: number, razao: number, n: number): number =>
  base * Math.pow(razao, n - 1);

export const curvaHp = (setor: number): number => geometrica(HP_BASE, HP_RAZAO, setor);
export const curvaDano = (setor: number): number => geometrica(DANO_BASE, DANO_RAZAO, setor);
export const curvaRecompensa = (setor: number): number =>
  geometrica(RECOMPENSA_BASE, RECOMPENSA_RAZAO, setor);
export const curvaIlvl = (setor: number): number =>
  Math.max(1, Math.floor(setor * ILVL_POR_SETOR));

export const curvaXpComando = (nivel: number): number =>
  Math.ceil(geometrica(COMANDO_XP_BASE, COMANDO_XP_RAZAO, nivel));
export const curvaXpPatrulha = (nivel: number): number =>
  Math.ceil(geometrica(PATRULHA_XP_BASE, PATRULHA_XP_RAZAO, nivel));
