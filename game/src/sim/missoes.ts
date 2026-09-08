import {
  MISSAO_POR_ID, MISSOES, quantoConta,
  type FatoDeJogo, type MissaoDef, type Requisito,
} from '@data/missoes';
import { BOSS_BY_ID } from '@data/bosses';
import { PHASES_PER_GALAXY } from '@data/galaxies';
import { CONFIANCA_MAX, PERSONAGEM_POR_ID, ROMANOS, type PersonagemDef } from '@data/personagens';
import type { GameState } from './types';
import { limiteDeMissoes } from './vip';

/**
 * Rastreamento de missões (§27).
 *
 * Sem DOM e sem canvas, como todo o `sim/`: é o que deixa a suíte medir o
 * progresso de uma missão sem abrir navegador.
 */

export interface ProgressoDeMissao {
  /** Quanto já andou, um número por objetivo, na ordem do `def`. */
  passos: number[];
  /** Já foi resgatada? */
  entregue: boolean;
  /** Já foi aceita alguma vez? Distingue progresso válido do legado automático. */
  iniciada: boolean;
}

export type EstadoDeMissoes = Record<string, ProgressoDeMissao>;

export type SituacaoDeMissao = 'oculta' | 'disponivel' | 'ativa' | 'pronta' | 'entregue';

/**
 * Missoes que o jogador ACEITOU. So elas progridem.
 *
 * A lista mora em `settings.pinnedMissions`, que ate aqui era rastreio
 * decorativo: ela decidia o que aparecia no HUD, e TODA missao liberada
 * progredia de qualquer forma. Reusar o campo em vez de criar outro evita duas
 * listas dizendo coisas parecidas e livres para discordar -- e o limite de
 * quatro (cinco no VIP) ja estava escrito em `limiteDeMissoes`.
 */
export function missoesAceitas(state: GameState): readonly string[] {
  return state.settings.pinnedMissions;
}

export const missaoAceita = (state: GameState, id: string): boolean =>
  state.settings.pinnedMissions.includes(id);

export const LIMITE_MISSOES_RASTREADAS = 4;

/**
 * Progresso de uma missão, criado na primeira vez que alguém pergunta.
 *
 * Criar sob demanda, e não semear o save com as onze missões, mantém o save
 * pequeno e — mais importante — faz uma missão nova no catálogo já nascer
 * funcionando em save antigo, sem migração.
 */
export function progressoDe(state: GameState, def: MissaoDef): ProgressoDeMissao {
  const atual = state.missoes[def.id];
  if (atual && atual.passos.length === def.objetivos.length && typeof atual.iniciada === 'boolean') return atual;

  /**
   * Saves anteriores ao aceite não dizem se o progresso veio de uma escolha do
   * jogador ou do contador automático antigo. Só há prova de aceite quando a
   * missão ainda está na lista, ou de conclusão quando já foi entregue. Sem
   * uma dessas provas, o progresso legado precisa começar em zero.
   */
  const iniciada = atual?.iniciada === true
    || atual?.entregue === true
    || missaoAceita(state, def.id);
  // Objetivo acrescentado a uma missão já iniciada preserva o índice; missão
  // nunca aceita nasce zerada mesmo que o save antigo traga passos automáticos.
  const passos = def.objetivos.map((_, i) => iniciada ? (atual?.passos[i] ?? 0) : 0);
  const novo = { passos, entregue: atual?.entregue ?? false, iniciada };
  state.missoes[def.id] = novo;
  return novo;
}

/**
 * Um requisito é satisfeito? Ponto ÚNICO onde isso se decide (§42).
 *
 * A UI nunca pergunta "o nível é maior que 30 e o chefe caiu?" — ela pergunta a
 * situação da missão e desenha. Espalhar a regra pelos componentes é o que faz
 * uma tela discordar da outra sobre o que está liberado.
 */
export function requisitoSatisfeito(
  state: GameState,
  req: Requisito,
  alcance: number,
): boolean {
  switch (req.tipo) {
    case 'nivelPersonagem': return state.command.nivel >= req.valor;
    case 'nivelNave': return (state.naves[state.hull]?.nivel ?? 1) >= req.valor;
    case 'setorAlcancado': return alcance >= req.valor;
    // Galáxia CONCLUÍDA é ter passado do último setor dela, não estar nela.
    case 'galaxiaConcluida': return alcance > (req.galaxia + 1) * PHASES_PER_GALAXY;
    case 'chefeDerrotado': return state.codex.includes(req.chefeId);
    case 'missaoConcluida': return !!state.missoes[req.missaoId]?.entregue;
    case 'confianca': return (state.confianca[req.personagem] ?? 0) >= req.valor;
    case 'recurso': return (state.armazem[req.recurso] ?? 0) >= req.valor;
    case 'provacaoPiso': return (state.provacao?.pisoMax ?? 0) >= req.valor;
  }
}

/** Texto do requisito, para a tela do card bloqueado (§16). */
export function textoDoRequisito(req: Requisito): string {
  switch (req.tipo) {
    case 'nivelPersonagem': return `Nível ${req.valor} de comando`;
    case 'nivelNave': return `Nave nível ${req.valor}`;
    case 'setorAlcancado': return `Alcançar o setor ${req.valor}`;
    case 'galaxiaConcluida': return `Concluir a galáxia ${req.galaxia + 1}`;
    case 'chefeDerrotado': return `Derrotar ${BOSS_BY_ID.get(req.chefeId)?.name ?? req.chefeId}`;
    case 'missaoConcluida': return `Concluir "${MISSAO_POR_ID.get(req.missaoId)?.nome ?? req.missaoId}"`;
    case 'confianca':
      return `Confiança nível ${ROMANOS[req.valor - 1] ?? req.valor} com ${PERSONAGEM_POR_ID.get(req.personagem)?.nome ?? req.personagem}`;
    case 'recurso': return `${req.valor} de ${req.recurso}`;
    case 'provacaoPiso': return `Vencer o piso ${req.valor} da Provação`;
  }
}

/** A missão está visível para o jogador? */
export function estaLiberada(state: GameState, def: MissaoDef, alcance: number): boolean {
  // Uma missão não pode ficar pronta antes de o contato que a oferece existir.
  // Sem essa trava, contratos de ex-chefes acumulavam progresso escondidos e o
  // contador de entrega exibia recompensas que não apareciam na tela.
  const giver = def.giverId ? PERSONAGEM_POR_ID.get(def.giverId) : undefined;
  if (giver && !contatoDesbloqueado(state, giver)) return false;
  return (def.requisitos ?? []).every((r) => requisitoSatisfeito(state, r, alcance));
}

/** Os requisitos que ainda faltam — é o que o card bloqueado mostra. */
export function requisitosPendentes(
  state: GameState,
  def: MissaoDef,
  alcance: number,
): Requisito[] {
  return (def.requisitos ?? []).filter((r) => !requisitoSatisfeito(state, r, alcance));
}

// ── contatos e confiança ────────────────────────────────────────────────────

/**
 * O contato já apareceu na rede?
 *
 * Lê o CÓDEX para o ex-chefe, que já registra quem foi derrotado. Nenhum estado
 * novo: converter um chefe em aliado é reinterpretar um dado que já existia, e
 * é isso que faz a conversão funcionar em save antigo sem migração.
 */
export function contatoDesbloqueado(state: GameState, p: PersonagemDef): boolean {
  return !p.requerChefe || state.codex.includes(p.requerChefe);
}

/** Confiança atual com um contato, 0..CONFIANCA_MAX. */
export function confiancaDe(state: GameState, id: string): number {
  return Math.min(CONFIANCA_MAX, Math.max(0, state.confianca[id] ?? 0));
}

/**
 * Situação de um contato na lista, para o ícone do card (§8).
 *
 * Ordem de prioridade deliberada: "pronta para entrega" ganha de "nova missão",
 * porque entregar é a ação que o jogador pode fazer AGORA. Um contato com as
 * duas coisas mostra o ✓, não o !.
 */
export type SinalDeContato = 'bloqueado' | 'pronta' | 'especial' | 'nova' | 'nenhum';

export function sinalDoContato(
  state: GameState,
  p: PersonagemDef,
  alcance: number,
): SinalDeContato {
  if (!contatoDesbloqueado(state, p)) return 'bloqueado';

  const minhas = MISSOES.filter((m) => m.giverId === p.id);
  let temEspecial = false;
  let temNova = false;
  for (const m of minhas) {
    const s = situacaoDe(state, m, alcance);
    if (s === 'pronta') return 'pronta';
    if (s === 'ativa') {
      if (m.tipo === 'especial') temEspecial = true;
      // "Nova" é a que ainda não saiu do zero: já vista e em andamento não
      // merece chamar atenção toda vez que o painel abre.
      if (fracaoDe(state, m) === 0) temNova = true;
    }
  }
  return temEspecial ? 'especial' : temNova ? 'nova' : 'nenhum';
}

/** Todo objetivo batido? */
export function estaCompleta(state: GameState, def: MissaoDef): boolean {
  const p = progressoDe(state, def);
  return def.objetivos.every((o, i) => (p.passos[i] ?? 0) >= o.alvo);
}

export function situacaoDe(state: GameState, def: MissaoDef, alcance: number): SituacaoDeMissao {
  if (progressoDe(state, def).entregue) return 'entregue';
  if (!estaLiberada(state, def, alcance)) return 'oculta';
  // Mesmo com progresso preservado de uma aceitação anterior, abandonar pausa
  // a missão: ela só pode ficar pronta e ser entregue depois de aceita novamente.
  if (!missaoAceita(state, def.id)) return 'disponivel';
  return estaCompleta(state, def) ? 'pronta' : 'ativa';
}

/**
 * Missões que realmente ocupam o rastreador.
 *
 * Saves antigos podiam conservar ids depois da entrega. O HUD escondia esses
 * contratos concluídos, mas o botão contava os quatro ids brutos e parecia
 * limitar o jogador a uma única missão visível. Esta leitura elimina inválidas,
 * ocultas, entregues e duplicadas antes de aplicar o limite.
 */
export function missoesRastreadas(
  state: GameState,
  alcance: number,
): MissaoDef[] {
  const vistos = new Set<string>();
  const rastreadas: MissaoDef[] = [];
  const limite = limiteDeMissoes(state);

  for (const id of state.settings.pinnedMissions) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const def = MISSAO_POR_ID.get(id);
    if (!def) continue;
    /**
     * A situacao aqui NAO pode consultar o aceite: `situacaoDe` pergunta a esta
     * mesma lista se a missao foi aceita, e o resultado seria circular. O que
     * importa e se a missao continua valendo -- nao entregue e nao oculta.
     */
    if (progressoDe(state, def).entregue) continue;
    if (!estaLiberada(state, def, alcance)) continue;
    rastreadas.push(def);
    if (rastreadas.length === limite) break;
  }

  return rastreadas;
}

/** Alterna uma missão e devolve ao save somente as quatro vagas válidas. */
export function alternarRastreioDeMissao(
  state: GameState,
  def: MissaoDef,
  alcance: number,
): void {
  const ids = missoesRastreadas(state, alcance).map((missao) => missao.id);
  const limite = limiteDeMissoes(state);
  const situacao = situacaoDe(state, def, alcance);
  /**
   * `disponivel` PRECISA passar: e a missao que ainda nao foi aceita, e aceitar
   * e exatamente o que este metodo faz. Sem ela na lista, nada poderia ser
   * aceito -- so `oculta` e `entregue` ficam de fora, que sao as duas em que
   * nao ha o que decidir.
   */
  if (situacao === 'oculta' || situacao === 'entregue') {
    state.settings.pinnedMissions = ids;
    return;
  }
  if (ids.includes(def.id)) {
    state.settings.pinnedMissions = ids.filter((id) => id !== def.id);
    return;
  }
  if (ids.length >= limite) {
    state.settings.pinnedMissions = ids;
    return;
  }

  const progresso = progressoDe(state, def);
  if (!progresso.iniciada) {
    progresso.passos = def.objetivos.map(() => 0);
    progresso.iniciada = true;
  }
  state.settings.pinnedMissions = [...ids, def.id];
}

/**
 * Aplica um fato a todas as missões e devolve as que ficaram PRONTAS agora.
 *
 * Devolver só a transição, e não a lista de tocadas, é o que permite avisar o
 * jogador uma vez — um aviso a cada abate seria ruído.
 *
 * Missão oculta NÃO acumula: sem isso, uma missão liberada no setor 25 nasceria
 * completa com o que o jogador fez antes de ela existir, e o §27 estaria
 * premiando o passado em vez do objetivo.
 */
export function aplicarFato(
  state: GameState,
  fato: FatoDeJogo,
  alcance: number,
): MissaoDef[] {
  const prontas: MissaoDef[] = [];

  for (const def of MISSOES) {
    const p = progressoDe(state, def);
    if (p.entregue) continue;
    if (!estaLiberada(state, def, alcance)) continue;
    /**
     * So a missao ACEITA progride.
     *
     * Antes toda missao liberada avancava ao mesmo tempo, e o efeito era a
     * escada de confianca perder o sentido: Kael Voss soma 8 de confianca para
     * um teto de 5, entao a barra enchia na quarta missao e as tres ultimas nao
     * valiam nada. Com quatro vagas, escolher QUAL caminho seguir volta a ser
     * decisao -- que e o que a barra existe para medir.
     */
    if (!missaoAceita(state, def.id)) continue;
    // Protege também integrações e testes que escrevam a lista de aceitas
    // diretamente, sem passar por `alternarRastreioDeMissao`.
    if (!p.iniciada) {
      p.passos = def.objetivos.map(() => 0);
      p.iniciada = true;
    }

    const eraCompleta = estaCompleta(state, def);
    let mexeu = false;

    def.objetivos.forEach((obj, i) => {
      const soma = quantoConta(obj, fato);
      if (soma <= 0) return;
      const antes = p.passos[i] ?? 0;
      if (antes >= obj.alvo) return; // já batido: não passa do alvo
      p.passos[i] = Math.min(obj.alvo, antes + soma);
      mexeu = true;
    });

    if (mexeu && !eraCompleta && estaCompleta(state, def)) prontas.push(def);
  }

  return prontas;
}

/** Fração 0..1 do progresso total da missão, para a barra da tela. */
export function fracaoDe(state: GameState, def: MissaoDef): number {
  const p = progressoDe(state, def);
  const total = def.objetivos.reduce((s, o) => s + o.alvo, 0) || 1;
  const feito = def.objetivos.reduce((s, o, i) => s + Math.min(o.alvo, p.passos[i] ?? 0), 0);
  return Math.min(1, feito / total);
}
