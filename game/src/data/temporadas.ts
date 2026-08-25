/**
 * Temporadas e o relógio do servidor.
 *
 * Os placares são SAZONAIS e MUNDIAIS. Sazonal significa que existe um marco de
 * início e um de fim, e que o placar zera entre eles; mundial significa que a
 * comparação é contra todo mundo, não contra amigos ou região.
 *
 * ## Por que isto existe sem servidor
 *
 * O placar mundial precisa de um back-end, que ainda não existe. QUAL temporada
 * está correndo, porém, é regra pura: sai de uma data-âncora e de uma duração.
 * Calcular isso no cliente hoje significa que, quando o servidor entrar, ele e o
 * jogo já concordam sobre o número da temporada e sobre quando ela vira — e
 * nenhuma tela precisa mudar.
 *
 * ## Por que a hora é de Brasília, e não a do jogador
 *
 * Uma temporada que virasse no fuso de cada um teria fim diferente para cada
 * jogador, e o último dia — que é quando o placar decide — valeria mais para uns
 * do que para outros. O corte é único e é o do servidor.
 *
 * O Brasil não usa horário de verão desde 2019, então o deslocamento é fixo em
 * **UTC−3**. Isto é uma DECISÃO, não um descuido: usar a API de fuso do
 * navegador traria as regras históricas do sistema operacional junto, e um
 * jogador com o relógio mal configurado veria a temporada virar na hora errada.
 * Se o horário de verão voltar, este arquivo é o único lugar a mexer.
 */

/** Deslocamento de Brasília em relação ao UTC, em minutos. */
export const BRASILIA_OFFSET_MIN = -180;

/**
 * Primeira temporada: 1º de setembro de 2026, 00:00 de Brasília.
 *
 * Em UTC isso é 03:00 do mesmo dia — o `Date.UTC` abaixo já leva o
 * deslocamento embutido, para a âncora não depender do relógio de quem compila.
 */
export const TEMPORADA_1_INICIO = Date.UTC(2026, 8, 1, 3, 0, 0);

/**
 * Duração de uma temporada.
 *
 * Vinte e oito dias, e não um mês de calendário: mês tem 28, 30 ou 31 dias, e
 * uma temporada de fevereiro valeria 10% menos que uma de março. Num placar de
 * progressão, tempo É pontuação — a temporada precisa medir o mesmo para todos.
 */
export const TEMPORADA_DIAS = 28;

const DIA_MS = 86_400_000;
export const TEMPORADA_MS = TEMPORADA_DIAS * DIA_MS;

export interface Temporada {
  /** Número da temporada, começando em 1. */
  numero: number;
  /** Instante de início, em ms de época. */
  inicio: number;
  /** Instante de fim (exclusivo), em ms de época. */
  fim: number;
}

/**
 * Em qual temporada cai um instante.
 *
 * Antes da âncora devolve a temporada 1 em vez de número zero ou negativo: um
 * relógio atrasado é muito mais provável que uma viagem no tempo, e uma tela
 * dizendo "Temporada −4" seria pior que uma dizendo que a primeira ainda não
 * começou.
 */
export function temporadaEm(agora: number): Temporada {
  const decorrido = agora - TEMPORADA_1_INICIO;
  const indice = decorrido < 0 ? 0 : Math.floor(decorrido / TEMPORADA_MS);
  const inicio = TEMPORADA_1_INICIO + indice * TEMPORADA_MS;
  return { numero: indice + 1, inicio, fim: inicio + TEMPORADA_MS };
}

/**
 * Segundos até o PRÓXIMO MARCO — que antes da âncora é o início, e depois é o
 * fim da temporada corrente.
 *
 * A distinção não é detalhe. `temporadaEm` devolve a temporada 1 também para
 * instantes anteriores à âncora, então contar sempre até `fim` fazia a
 * pré-temporada anunciar a virada da PRIMEIRA temporada em vez do começo dela:
 * medido a 7 dias da âncora, a tela dizia "começa em 34d".
 */
export function segundosAteVirar(agora: number): number {
  const alvo = agora < TEMPORADA_1_INICIO ? TEMPORADA_1_INICIO : temporadaEm(agora).fim;
  return Math.max(0, Math.floor((alvo - agora) / 1000));
}

/** A temporada já começou? Falso só antes da âncora. */
export const temporadaComecou = (agora: number): boolean => agora >= TEMPORADA_1_INICIO;

/**
 * Formata um instante no relógio de Brasília.
 *
 * Constrói a data deslocada e lê os campos em UTC — é o que dá o horário de
 * Brasília sem consultar o fuso da máquina, que é justamente o que não se quer
 * aqui.
 */
export function horaDeBrasilia(agora: number): string {
  const d = new Date(agora + BRASILIA_OFFSET_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Só a data, para rótulos de início e fim de temporada. */
export function dataDeBrasilia(agora: number): string {
  return horaDeBrasilia(agora).slice(0, 10);
}
