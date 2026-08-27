import { PROVACAO_PISOS, pisoDaProvacao } from '@data/provacao';
import { requisitoSatisfeito } from './missoes';
import type { GameState } from './types';

/**
 * Progressão do Núcleo de Provação (§32–§35 e o prompt mestre do modo).
 *
 * Sem DOM e sem canvas, como todo o `sim/`: é o que permite medir a curva do
 * modo no Node, sem abrir navegador.
 */

// ── estados do piso ─────────────────────────────────────────────────────────

/**
 * Os cinco estados que o §10 pede.
 *
 * `MESTRADO` já existe no tipo mesmo sem desafio mestre implementado, porque ele
 * muda a forma do save: descobrir isso depois obrigaria a migrar. O mesmo
 * raciocínio do `ritmo` das missões.
 */
export type EstadoDoPiso = 'travado' | 'disponivel' | 'atual' | 'vencido' | 'mestrado';

/**
 * O piso está liberado?
 *
 * CHECKPOINT PERMANENTE (§8): quem chegou ao piso 37 acessa 1–37 livremente, e o
 * 38 é o próximo. Nunca se recomeça do 1 — um modo de cem pisos que obrigasse a
 * refazer tudo a cada tentativa não seria desafio, seria pedágio.
 */
export function pisoLiberado(state: GameState, piso: number): boolean {
  if (piso < 1 || piso > PROVACAO_PISOS) return false;
  // Modo de teste abre os cem pisos.
  //
  // Aqui e não escrevendo `pisoMax`: a regra do modo é ser REVERSÍVEL, e
  // desligá-lo tem de devolver o save exatamente como estava. Um atalho que
  // gravasse o progresso deixaria o jogador com cem pisos vencidos por ter
  // ligado o modo para dar uma olhada — que é a mesma cicatriz do hangar.
  if (state.settings.testMode) return true;
  // O piso seguinte ao maior vencido é sempre acessível; os anteriores também.
  if (piso > state.provacao.pisoMax + 1) return false;
  // E os requisitos declarados ainda valem por cima (§11).
  return pisoDaProvacao(piso).requisitos.every((r) => requisitoSatisfeito(state, r, piso));
}

export function estadoDoPiso(state: GameState, piso: number): EstadoDoPiso {
  const p = state.provacao;
  if (!pisoLiberado(state, piso)) return 'travado';
  if (p.mestrados.includes(piso)) return 'mestrado';
  if (piso <= p.pisoMax) return 'vencido';
  return piso === p.pisoMax + 1 ? 'atual' : 'disponivel';
}

// ── tentativas por período ──────────────────────────────────────────────────

/**
 * Tentativas limitadas por período.
 *
 * O §29 do prompt original dizia o contrário — "NÃO limitar artificialmente a
 * quantidade de tentativas". O Rafael reverteu isso depois, de propósito, e a
 * decisão está registrada aqui para ninguém "consertar" achando que é um
 * descuido.
 *
 * A forma escolhida é ENERGIA QUE VOLTA, não um contador que zera à meia-noite.
 * Um teto diário castiga quem joga muito num dia só e não devolve nada a quem
 * joga pouco todo dia; a energia acumula até o teto e trata os dois igual. É
 * também o que combina com um idle: o jogo continua rendendo enquanto o jogador
 * não está, e o Núcleo passa a ser o lugar onde ele gasta o que acumulou.
 */
export const TENTATIVAS_MAX = 5;
/** Segundos para recuperar uma tentativa. */
export const TENTATIVA_INTERVALO = 30 * 60;

/**
 * Quantas tentativas o jogador tem AGORA.
 *
 * Calculado a partir do relógio, não incrementado por tique. Um contador
 * incrementado no laço para de contar quando a aba fecha — e este é um jogo
 * idle, onde a aba fica fechada a maior parte do tempo. Derivar do tempo
 * decorrido faz a recuperação valer offline sem código de offline.
 */
export function tentativasDisponiveis(state: GameState, agora = Date.now()): number {
  const p = state.provacao;
  // A tela lê daqui. Sem esta linha ela mostraria "0 tentativas" enquanto o
  // modo de teste deixa entrar — e o jogador acreditaria na tela, que é o
  // certo a fazer quando ela e o comportamento discordam.
  if (state.settings.testMode) return TENTATIVAS_MAX;
  if (p.tentativas >= TENTATIVAS_MAX) return TENTATIVAS_MAX;
  const decorrido = Math.max(0, (agora - p.tentativasEm) / 1000);
  const recuperadas = Math.floor(decorrido / TENTATIVA_INTERVALO);
  return Math.min(TENTATIVAS_MAX, p.tentativas + recuperadas);
}

/** Segundos até a próxima tentativa voltar. Zero quando está no teto. */
export function segundosParaProximaTentativa(state: GameState, agora = Date.now()): number {
  if (tentativasDisponiveis(state, agora) >= TENTATIVAS_MAX) return 0;
  const decorrido = Math.max(0, (agora - state.provacao.tentativasEm) / 1000);
  return Math.max(0, TENTATIVA_INTERVALO - (decorrido % TENTATIVA_INTERVALO));
}

/**
 * Consome uma tentativa. Devolve `false` quando não há.
 *
 * Normaliza o saldo antes de gastar: sem isso, o crédito acumulado desde a
 * última jogada seria perdido no momento em que o jogador finalmente joga.
 */
export function gastarTentativa(state: GameState, agora = Date.now()): boolean {
  const p = state.provacao;
  // No modo de teste a tentativa não é cobrada, e o motivo é o mesmo de
  // sempre: esta função ESCREVE. Liberar os pisos sem isto daria cem portas
  // abertas e cinco entradas — e cada entrada gastaria uma tentativa de
  // verdade, que continuaria gasta depois de desligar o modo.
  if (state.settings.testMode) return true;

  const tem = tentativasDisponiveis(state, agora);
  if (tem <= 0) return false;

  // Quem estava no teto começa a contar a recuperação AGORA; quem já estava
  // recuperando mantém o relógio, senão gastar reiniciaria o progresso parcial.
  if (p.tentativas >= TENTATIVAS_MAX) p.tentativasEm = agora;
  else p.tentativasEm += Math.floor((agora - p.tentativasEm) / TENTATIVA_INTERVALO) * TENTATIVA_INTERVALO * 1000;

  p.tentativas = tem - 1;
  return true;
}

// ── registros (§27, §55) ────────────────────────────────────────────────────

export interface RegistroDePiso {
  /** Melhor tempo em segundos. */
  melhorTempo: number;
  /** Casco usado na primeira vitória. */
  nave: string;
  nivelDaNave: number;
  danoCausado: number;
  danoRecebido: number;
  /** Timestamp da primeira vitória. */
  primeiraEm: number;
  tentativas: number;
}

/**
 * Registra o resultado de uma tentativa.
 *
 * Guarda o MELHOR tempo, não o último: o registro existe para o jogador se
 * comparar consigo mesmo, e um recorde que piora quando se joga mal não é
 * recorde.
 */
export function registrar(
  state: GameState,
  piso: number,
  r: { venceu: boolean; tempo: number; nave: string; nivelDaNave: number; danoCausado: number; danoRecebido: number },
  agora = Date.now(),
): void {
  const atual = state.provacao.registros[piso];
  const novo: RegistroDePiso = atual ?? {
    melhorTempo: Infinity, nave: r.nave, nivelDaNave: r.nivelDaNave,
    danoCausado: 0, danoRecebido: 0, primeiraEm: 0, tentativas: 0,
  };
  novo.tentativas++;
  if (r.venceu) {
    if (r.tempo < novo.melhorTempo) {
      novo.melhorTempo = r.tempo;
      novo.nave = r.nave;
      novo.nivelDaNave = r.nivelDaNave;
      novo.danoCausado = r.danoCausado;
      novo.danoRecebido = r.danoRecebido;
    }
    if (!novo.primeiraEm) novo.primeiraEm = agora;
  }
  state.provacao.registros[piso] = novo;
}

// ── recompensa em três camadas (§21, §22, §23) ──────────────────────────────

export type CamadaDeRecompensa = 'primeira' | 'repeticao' | 'marco';

/**
 * Que camadas de recompensa esta vitória paga.
 *
 * A PRIMEIRA CONCLUSÃO e o MARCO pagam uma vez só na vida; a repetição paga
 * sempre, mas menos. O §74 chama de teste crítico que recarregar, morrer ou
 * fechar o modal não pague a primeira de novo — por isso a pergunta é feita
 * contra o SAVE, e a marcação é gravada antes da entrega.
 */
export function camadasAPagar(state: GameState, piso: number): CamadaDeRecompensa[] {
  const p = state.provacao;
  const camadas: CamadaDeRecompensa[] = [];
  if (!p.primeiraConclusao.includes(piso)) camadas.push('primeira');
  else camadas.push('repeticao');
  if (piso % 10 === 0 && !p.marcos.includes(piso)) camadas.push('marco');
  return camadas;
}

/**
 * Fração da recompensa que a REPETIÇÃO paga.
 *
 * Um quarto: o suficiente para farmar um piso valer a pena, longe do bastante
 * para substituir avançar. O §67 pede controle sem punição artificial — cortar
 * pela metade ainda faria do piso 10 a melhor fonte do jogo para quem está no
 * 40, e é isso que se quer evitar.
 */
export const FRACAO_REPETICAO = 0.25;
