/**
 * O aviso — como alguém FICA SABENDO sem precisar consultar.
 *
 * ## O que faltava depois do livro
 *
 * A tabela `recusas` respondeu "o que está quebrado" em cinco segundos. Ela não
 * resolve o problema de fundo, que é o mesmo desde 08/09: **alguém precisa
 * suspeitar e ir olhar.** Enquanto o Rafael for o único jogador isso quase
 * funciona; com testadores dentro, quem descobre o defeito é sempre a pessoa
 * errada, e horas depois.
 *
 * Um gatilho de tempo do Worker lê o que ainda não foi avisado e manda um
 * resumo. É a peça que fecha o ciclo: o sistema deixa de depender de quem olha.
 *
 * ## Por que RESUMO, e não uma mensagem por erro
 *
 * "Todo erro precisa ser avisado" e "toda ocorrência vira uma mensagem" são
 * coisas diferentes, e a segunda destrói a primeira. Uma rota quebrada gera
 * milhares de recusas por hora; mil mensagens não avisam mais do que uma —
 * avisam menos, porque ninguém lê a milésima e o canal deixa de ser olhado.
 *
 * Então: **todo tipo de erro entra no resumo**, sempre. O que é agrupado é a
 * repetição, e a contagem vai junto, porque "40 vezes" e "4 vezes" pedem
 * reações diferentes.
 *
 * ## O que faz um aviso ser URGENTE
 *
 * Três coisas, e cada uma tem um motivo concreto vindo de 08/09:
 *
 * 1. **`http_5xx`** — exceção não tratada. Ninguém previu, ninguém escreveu
 *    aquele caminho, e é o mais provável de estar derrubando a rota inteira.
 * 2. **Motivo NOVO** — nunca visto antes. Foi exatamente a assinatura da
 *    migração que não subiu: um erro que não existia passou a existir a partir
 *    de um deploy.
 * 3. **Volume acima do limiar** — um erro conhecido que saiu do normal.
 */

/** Uma linha do livro com o quanto dela ainda não foi avisado. */
export interface LinhaDeRecusa {
  rota: string;
  motivo: string;
  hora: number;
  n: number;
  avisado: number;
  /** A hora do primeiro registro DESTE par rota+motivo, de todos os tempos. */
  primeiraHora: number;
}

export interface Aviso {
  texto: string;
  urgente: boolean;
  /** Quantas recusas o aviso cobre. Usado pelo teste e pelo registro. */
  total: number;
}

/**
 * Recusas novas de um mesmo tipo que já bastam para chamar de anormal.
 *
 * Trinta em cinco minutos é um erro a cada dez segundos. O ritmo normal do jogo
 * é uma escrita por rota a cada três minutos por jogador, então isto só é
 * alcançado por algo repetindo — que é o que interessa.
 */
export const LIMIAR_URGENTE = 30;

/** Quantos tipos distintos cabem numa mensagem antes de virar "e mais N". */
export const LINHAS_MAX = 12;

/**
 * Monta o aviso do que ainda não foi contado. `null` quando não há nada.
 *
 * Pura: o teste monta uma tempestade e confere o texto sem rede nem banco.
 */
export function montarAviso(linhas: readonly LinhaDeRecusa[]): Aviso | null {
  const porTipo = new Map<string, { rota: string; motivo: string; n: number; nova: boolean }>();

  for (const l of linhas) {
    const delta = l.n - l.avisado;
    if (delta <= 0) continue;

    const chave = `${l.rota} ${l.motivo}`;
    const atual = porTipo.get(chave);
    if (atual) {
      atual.n += delta;
      continue;
    }
    porTipo.set(chave, {
      rota: l.rota,
      motivo: l.motivo,
      n: delta,
      /**
       * NOVO é "nunca avisado antes", e as duas condições são necessárias.
       *
       * `primeiraHora >= hora` diz que o par não tem balde anterior; `avisado
       * === 0` diz que ele ainda não saiu em aviso nenhum. Sem a segunda, um
       * erro contínuo seria marcado NOVO em todos os avisos da primeira hora
       * de vida dele — e "NOVO" que se repete deixa de significar o que
       * significa, que é *um deploy acabou de quebrar alguma coisa*.
       */
      nova: l.primeiraHora >= l.hora && l.avisado === 0,
    });
  }

  if (!porTipo.size) return null;

  const tipos = [...porTipo.values()].sort((a, b) => b.n - a.n);
  const total = tipos.reduce((s, t) => s + t.n, 0);

  const urgente = tipos.some(
    (t) => t.motivo.startsWith('http_5') || t.nova || t.n >= LIMIAR_URGENTE,
  );

  const cabecalho = urgente
    ? `🔴 Órbita Zero — ${total} recusas, ${tipos.length} tipo(s)`
    : `⚠️ Órbita Zero — ${total} recusas, ${tipos.length} tipo(s)`;

  const corpo = tipos.slice(0, LINHAS_MAX).map((t) => {
    const marcas = [t.nova ? 'NOVO' : '', t.n >= LIMIAR_URGENTE ? 'volume' : '']
      .filter(Boolean).join(', ');
    return `• ${t.rota} — ${t.motivo} ×${t.n}${marcas ? ` (${marcas})` : ''}`;
  });

  if (tipos.length > LINHAS_MAX) {
    corpo.push(`• …e mais ${tipos.length - LINHAS_MAX} tipo(s)`);
  }

  return { texto: [cabecalho, ...corpo].join('\n'), urgente, total };
}

/**
 * Manda o aviso. `false` quando não deu — e aí o livro NÃO é marcado.
 *
 * É a mesma disciplina da fila da carteira: só se apaga o que se confirmou ter
 * entregado. Um aviso perdido por rede fora reaparece no ciclo seguinte, em vez
 * de sumir com a marca de "já avisei".
 *
 * O corpo carrega `content` e `text` juntos de propósito: o primeiro é o que o
 * Discord lê, o segundo é o do Slack. Uma carga só serve os dois, e não custa
 * nada — quando um webhook novo entrar, provavelmente já funciona.
 */
export async function enviarAviso(url: string, aviso: Aviso): Promise<number> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpoDoAviso(url, aviso.texto)),
    });
    return r.status;
  } catch {
    // Zero significa "nem chegou a responder" — rede fora, DNS, URL inválida.
    return 0;
  }
}

/**
 * O corpo, no formato que o destino entende.
 *
 * ## Por que não dá para mandar os dois campos juntos
 *
 * A primeira versão mandava `{ content, text }` de uma vez, com o argumento de
 * que "uma carga só serve Discord e Slack e não custa nada". Custava: **o
 * Discord recusa campo que não conhece**, e devolve 400 dizendo `Unknown field`
 * para o `text`. O aviso nunca saía.
 *
 * E foi um defeito exemplar de tudo o que este dia produziu — a esperteza de
 * economizar um `if` transformou o sistema de avisos no único componente que
 * não conseguia avisar que estava quebrado.
 *
 * O host decide, porque é o que se sabe com certeza. Um destino desconhecido
 * leva os dois campos: sem saber quem é, servir os dois formatos é a aposta com
 * mais chance de acertar.
 */
export function corpoDoAviso(url: string, texto: string): Record<string, string> {
  const host = hostDoAviso(url);

  if (host.endsWith('discord.com') || host.endsWith('discordapp.com')) return { content: texto };
  if (host.endsWith('slack.com')) return { text: texto };
  return { content: texto, text: texto };
}

/**
 * O host do destino — a única parte da URL que pode virar linha no livro.
 *
 * ## Por que isto existe
 *
 * `envio_0` diz que o `fetch` nem recebeu resposta, e isso tem duas causas
 * muito diferentes: a URL não é uma URL, ou é e o destino não respondeu. Sem
 * separar as duas, o diagnóstico volta a ser palpite.
 *
 * O host é seguro de gravar: `discord.com` não identifica ninguém e não abre
 * porta nenhuma. O **caminho** é que carrega o segredo — é nele que mora o
 * token do webhook —, e ele nunca sai daqui.
 */
export function hostDoAviso(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
