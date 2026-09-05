import { API_URL } from '@data/servidor';
import { SAVE_VERSION, migrate } from '@sim/state';
import type { GameState } from '@sim/types';
import { tokenValido } from './conta';

/**
 * O save na nuvem: a fonte de verdade entre dispositivos.
 *
 * ## O que mudou, e por quê
 *
 * A primeira versão comparava `savedAt` — o relógio do PC do jogador — para
 * decidir quem vencia. Dois defeitos, e os dois aparecem justamente quando se
 * troca de máquina, que é o motivo de existir sincronização:
 *
 * 1. **Relógio errado ganha.** Máquina sem NTP, fuso trocado, VM que dormiu: um
 *    relógio adiantado vence sempre, inclusive contra progresso mais novo.
 * 2. **A gravação de fim de sessão era recusada.** O servidor só aceitava uma
 *    a cada 120s, e fechar a aba cai nessa janela — até dois minutos de jogo
 *    sumiam em toda troca de PC.
 *
 * Agora quem ordena é o SERVIDOR, com `versaoServidor`: um contador que ele
 * mesmo incrementa. O cliente manda a versão que conhecia; se não for a atual,
 * outro dispositivo gravou no meio e o servidor devolve 409 com o save dele.
 *
 * ## Como o conflito é resolvido
 *
 * Pelo TEMPO JOGADO, não pela hora. `playtime` é acumulado somando `dt`, então
 * não depende de relógio nenhum e é monotônico — e é o que o jogador quer dizer
 * quando fala "esse é o save mais adiantado". Ganha quem jogou mais.
 *
 * ## O local continua existindo
 *
 * O jogo roda inteiro sem conta e sem rede. `localStorage` é gravado a cada dez
 * segundos e é dele que o jogo lê ao abrir; a nuvem entra na abertura e a cada
 * poucos minutos. Perder a rede não pode impedir de jogar.
 */

export interface EstadoDaNuvem {
  /** Epoch em segundos da última subida bem-sucedida. */
  ultimaSubida: number | null;
  ultimoErro: string | null;
  /** Segundos a esperar antes da próxima tentativa, quando o servidor recusou. */
  esperarAte: number;
  /**
   * A versão do servidor que este cliente conhece.
   *
   * É a peça central da concorrência otimista: vai em toda gravação, e o
   * servidor recusa se não for a atual dele.
   */
  versaoServidor: number;
  /** `true` quando o servidor devolveu um save mais adiantado que o local. */
  conflitoPendente: boolean;
}

export const nuvem: EstadoDaNuvem = {
  ultimaSubida: null,
  ultimoErro: null,
  esperarAte: 0,
  versaoServidor: 0,
  conflitoPendente: false,
};

/**
 * Teto do `keepalive`, pela especificação do fetch: 64 KB por requisição.
 *
 * Medido num save real: 3,5 KB. Mesmo um inventário cheio fica muito abaixo,
 * mas o recuo existe porque estourar o limite faz o navegador REJEITAR a
 * requisição inteira — e o caso em que isso aconteceria é justamente o do
 * jogador mais avançado, que é quem menos pode perder progresso.
 */
const TETO_KEEPALIVE = 60 * 1024;

async function chamar(metodo: 'GET' | 'PUT', corpo?: unknown, saindo = false): Promise<Response | null> {
  const token = await tokenValido();
  if (!token) return null;

  const body = corpo ? JSON.stringify(corpo) : undefined;

  try {
    return await fetch(`${API_URL}/save`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      // `keepalive` deixa a requisição sobreviver à página.
      //
      // Sem ele, a gravação disparada ao fechar a aba morre junto com o
      // documento — o navegador cancela o que está em voo. É a outra metade do
      // "no outro PC não tem o progresso": a gravação até saía, mas não
      // chegava.
      ...(saindo && body && body.length < TETO_KEEPALIVE ? { keepalive: true } : {}),
      ...(body ? { body } : {}),
    });
  } catch (err) {
    // Rede fora do ar não é erro de jogo: o save local está intacto e a próxima
    // tentativa acontece sozinha.
    nuvem.ultimoErro = err instanceof Error ? err.message : 'sem rede';
    return null;
  }
}

/** Quanto o jogador JOGOU, em segundos. É o critério de desempate. */
export const progressoDe = (s: GameState): number => s.playtime ?? 0;

/**
 * O save guardado no servidor, ou `null` se não houver.
 *
 * Passa pelo mesmo `migrate` do save local — e por isso herda todo o
 * saneamento. O que ele NÃO faz é marcar `contaminado`: isto é o progresso do
 * próprio jogador voltando, não um save colado de fora.
 */
export async function baixarSave(): Promise<{ estado: GameState; atualizadoEm: number } | null> {
  const r = await chamar('GET');
  if (!r || !r.ok) {
    if (r) nuvem.ultimoErro = `servidor respondeu ${r.status}`;
    return null;
  }

  try {
    const dados = await r.json() as {
      vazio?: boolean; estado?: unknown; atualizadoEm?: number; versaoServidor?: number;
    };
    // A versão vem mesmo quando não há save: é ela que o primeiro PUT usa como
    // base, e sem guardá-la a primeira gravação bateria em conflito.
    nuvem.versaoServidor = dados.versaoServidor ?? 0;
    if (dados.vazio || !dados.estado) return null;

    const estado = migrate(dados.estado);
    if (!estado) {
      nuvem.ultimoErro = 'save da nuvem ilegível';
      return null;
    }
    return { estado, atualizadoEm: dados.atualizadoEm ?? 0 };
  } catch {
    nuvem.ultimoErro = 'resposta da nuvem ilegível';
    return null;
  }
}

export type ResultadoDeSubida =
  | { fase: 'subiu' }
  | { fase: 'cedo'; esperar: number }
  | { fase: 'conflito'; doServidor: GameState | null; versaoServidor: number }
  | { fase: 'falhou' };

/**
 * Sobe o estado, carimbando a versão que este cliente conhece.
 *
 * Não trata o conflito: quem trata é `reconciliar`, porque resolver conflito é
 * decidir qual save o jogador fica, e essa decisão não pode estar escondida
 * dentro de uma função chamada "subir".
 */
export async function subirSave(estado: GameState, saindo = false): Promise<ResultadoDeSubida> {
  const agora = Math.floor(Date.now() / 1000);
  if (agora < nuvem.esperarAte) return { fase: 'cedo', esperar: nuvem.esperarAte - agora };

  const r = await chamar('PUT', { estado: semODinheiro(estado), versao: SAVE_VERSION, base: nuvem.versaoServidor }, saindo);
  if (!r) return { fase: 'falhou' };

  if (r.status === 429) {
    try {
      const { esperar } = await r.json() as { esperar?: number };
      nuvem.esperarAte = agora + (esperar ?? 60);
      return { fase: 'cedo', esperar: esperar ?? 60 };
    } catch {
      nuvem.esperarAte = agora + 60;
      return { fase: 'cedo', esperar: 60 };
    }
  }

  if (r.status === 409) {
    try {
      const d = await r.json() as { estado?: unknown; versaoServidor?: number };
      nuvem.versaoServidor = d.versaoServidor ?? nuvem.versaoServidor;
      return { fase: 'conflito', doServidor: d.estado ? migrate(d.estado) : null, versaoServidor: nuvem.versaoServidor };
    } catch {
      return { fase: 'falhou' };
    }
  }

  if (!r.ok) {
    nuvem.ultimoErro = `servidor respondeu ${r.status}`;
    return { fase: 'falhou' };
  }

  try {
    const d = await r.json() as { versaoServidor?: number };
    if (typeof d.versaoServidor === 'number') nuvem.versaoServidor = d.versaoServidor;
  } catch { /* a gravação valeu; a versão se corrige no próximo GET */ }

  nuvem.ultimaSubida = agora;
  nuvem.ultimoErro = null;
  nuvem.conflitoPendente = false;
  return { fase: 'subiu' };
}

/**
 * Apaga o progresso NA NUVEM, para o "Apagar progresso" não ser meia-verdade.
 *
 * ## Por que isto precisou existir
 *
 * `clearStorage` limpa só o navegador. Para quem está com conta, o boot
 * seguinte chama `reconciliar`, encontra a nuvem com 542 minutos contra os 0
 * do save recém-nascido, e **baixa tudo de volta**. O botão parecia não fazer
 * nada — e o aviso ao lado dele dizia "não há cópia em outro lugar", que
 * deixou de ser verdade no dia em que a conta passou a existir.
 *
 * ## Por que subir um estado novo, e não um DELETE
 *
 * Não há rota de apagar no Worker, e criar uma para isto seria pior: uma rota
 * que destrói o save de quem chama é a mais perigosa da API, e ela existiria
 * para um botão que se usa uma vez na vida. Subir um estado zerado deixa a
 * nuvem no mesmo ponto em que o navegador ficou, que é o que se quer dizer com
 * "apagar", e passa pelas mesmas defesas de todas as outras gravações.
 *
 * O `baixarSave` antes NÃO é desperdício: ele carimba `versaoServidor`, e sem
 * esse carimbo a subida bate na trava de conflito e volta 409.
 *
 * Devolve `false` quando a nuvem NÃO foi limpa — sem conta não é falha, mas
 * limite de ritmo e rede fora são, e quem chama precisa poder contar isso em
 * vez de apagar o local e deixar o jogador achar que acabou.
 */
export async function apagarNaNuvem(estadoNovo: GameState): Promise<boolean> {
  if (!await tokenValido()) return true;

  await baixarSave();
  const r = await subirSave(estadoNovo);
  return r.fase === 'subiu';
}

export type Reconciliacao =
  | { acao: 'sem-conta' }
  | { acao: 'subiu'; motivo: 'nuvem-vazia' | 'local-mais-adiantado' }
  | { acao: 'desceu'; estado: GameState; motivo: 'nuvem-mais-adiantada' }
  | { acao: 'nada'; motivo: 'empate' | 'falhou' | 'cedo' };

/**
 * Junta o save local e o da nuvem, e diz o que fazer.
 *
 * Devolve a decisão em vez de aplicá-la porque trocar `sim.state` é assunto de
 * quem tem o `Sim` na mão — e porque uma função que decide E age não dá para
 * testar sem montar o jogo inteiro.
 */
export async function reconciliar(local: GameState): Promise<Reconciliacao> {
  if (!await tokenValido()) return { acao: 'sem-conta' };

  const daNuvem = await baixarSave();
  if (!daNuvem) {
    // Nuvem vazia (conta nova) ou falha de rede. Nos dois casos tentar subir é
    // o certo: se foi falha, a subida também falha e nada se perde.
    const r = await subirSave(local);
    if (r.fase === 'subiu') return { acao: 'subiu', motivo: 'nuvem-vazia' };
    return { acao: 'nada', motivo: r.fase === 'cedo' ? 'cedo' : 'falhou' };
  }

  // O critério é TEMPO JOGADO, não hora. `playtime` é somado a partir de `dt`,
  // então não depende do relógio de máquina nenhuma — e é o que o jogador quer
  // dizer com "esse save é o mais adiantado".
  const meu = progressoDe(local);
  const dele = progressoDe(daNuvem.estado);

  if (dele > meu) {
    nuvem.conflitoPendente = false;
    return { acao: 'desceu', estado: daNuvem.estado, motivo: 'nuvem-mais-adiantada' };
  }
  if (meu > dele) {
    const r = await subirSave(local);
    if (r.fase === 'subiu') return { acao: 'subiu', motivo: 'local-mais-adiantado' };
    return { acao: 'nada', motivo: r.fase === 'cedo' ? 'cedo' : 'falhou' };
  }
  return { acao: 'nada', motivo: 'empate' };
}

/**
 * O save que sobe NÃO leva dinheiro nem passe.
 *
 * ## Por que arrancar, em vez de só ignorar
 *
 * Saldo e assinatura moram em `transacoes`, `saldos` e `assinaturas` desde a
 * Fase 2 do Passo 9. Se o save continuasse carregando uma cópia, existiriam
 * duas verdades no MESMO servidor — e a segunda seria escrita pelo cliente,
 * que é exatamente o que a fase inteira existe para acabar.
 *
 * O perigo não é hipotético: bastaria alguém, um dia, restaurar recurso a
 * partir do save (numa migração, num conserto de conta) para reabrir o buraco
 * sem perceber. Campo que não sobe não pode ser lido de volta por engano.
 *
 * ## `pendentes` também fica
 *
 * É fila de saída, não progresso: ela existe para sobreviver a fechar a aba
 * com a rede fora, e isso o `localStorage` já garante. Subir a fila faria o
 * outro dispositivo baixar movimentos que este ainda vai enviar — e o mesmo
 * ganho entraria duas vezes no livro.
 */
function semODinheiro(estado: GameState): GameState {
  // Cópia rasa e sobrescrita dos três campos: clonar fundo o save inteiro a
  // cada subida custaria mais que a requisição, e nada aqui muda em
  // profundidade.
  return {
    ...estado,
    resources: { sucata: 0, nucleo: 0, cristal: 0 },
    vip: { expiresAt: 0 },
    pendentes: [],
    // O inventário mora na tabela `itens` desde a Fase 3b. Mesmo motivo do
    // dinheiro: duas verdades no mesmo servidor, e a segunda escrita pelo
    // cliente, é o buraco que estas fases existem para fechar.
    inventory: [],
    comandosDeItem: [],
    // O equipado também sai, e este era o furo: `inventory` vazio não basta se
    // a peça Divina viaja dentro de `naves[id].equipped`. O progresso da nave
    // — nem o nível nem o XP, desde a Fase 4 — sobe junto: o que resta em
    // `naves` é a existência da entrada, e nada mais.
    // A frota mora na tabela `frota` desde a Fase 3c. Casco é poder — os
    // melhores custam cristal —, então a lista não pode ser escrita pelo
    // cliente e subir como se fosse verdade.
    fleet: [],
    // XP, nível, Matriz e materiais moram no servidor desde a Fase 4. O
    // `bestSectorEver` também: é ele que libera casco e conteúdo.
    command: { ...estado.command, xp: 0, nivel: 1, allocated: [] },
    armazem: {},
    universe: { ...estado.universe, bestSectorEver: 1 },
    naves: Object.fromEntries(
      Object.entries(estado.naves).map(([id, n]) => [id, { ...n, equipped: {}, xp: 0, nivel: 1 }]),
    ),
  };
}