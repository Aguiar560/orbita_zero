import { toast } from './Bus';

/**
 * O que fazer quando o servidor recusa — dito, em vez de engolido.
 *
 * ## O defeito que isto fecha
 *
 * Todo módulo daqui fala com o Worker por um `chamar()` que faz
 * `if (!r.ok) return null` e `catch { return null }`, e quem chama transforma
 * `null` em "usa o que já tinha". É bom para rede instável e **péssimo para
 * diagnóstico**: o jogador nunca vê "o servidor falhou", vê nível zerado, nave
 * errada, saldo zero ou um botão mudo.
 *
 * Em 08/09/2026 quatro defeitos diferentes chegaram com esse mesmo disfarce, e
 * em nenhum deles o custo foi o defeito — foi as horas até alguém entender qual
 * era.
 *
 * ## Por que fundo e ação são tratados DIFERENTE
 *
 * É a decisão inteira deste arquivo, e ignorá-la faria o conserto virar um
 * defeito pior.
 *
 * | | recusada, o que acontece | o que a tela faz |
 * |---|---|---|
 * | **ação** — fundir, comprar casco, comprar passe | um botão que não funciona | **fala sempre** |
 * | **fundo** — carteira, inventário, lote, progresso, missões, ausência | tenta de novo no ciclo seguinte e ninguém percebe | fala só quando **insiste** |
 *
 * Um aviso a cada oscilação de rede treinaria o jogador a ignorar avisos, e aí
 * o aviso que importa passa despercebido junto. O que merece a tela do jogador
 * é a falha que PERSISTE, porque aí o progresso dele está de fato parado.
 *
 * O `console.warn`, esse, sai sempre: ele não incomoda ninguém e é o que se
 * copia e cola quando o motivo precisa chegar a quem vai consertar.
 */

export type Natureza = 'acao' | 'fundo';

/** Falhas seguidas de uma rota de fundo antes de a tela dizer alguma coisa. */
export const FALHAS_ATE_FALAR = 3;

/**
 * As frases, por código do servidor.
 *
 * Uma tabela só para todas as rotas: o mesmo `rapido_demais` quer dizer a mesma
 * coisa na fusão e na compra de casco, e duas tabelas divergiriam na primeira
 * vez que alguém mexesse numa delas.
 */
const FRASES: Record<string, string> = {
  rapido_demais: 'Muitas ações seguidas. Espere alguns segundos e tente de novo.',
  itens_nao_sao_seus: 'O servidor ainda não conhece uma das peças. Tente de novo em instantes.',
  raridades_diferentes: 'Todas as peças precisam ser da mesma raridade.',
  favorito_na_fusao: 'Há um favorito no anel. Favorito nunca é fundido.',
  quantidade_errada: 'O anel não tem a quantidade que a receita pede.',
  sem_receita: 'Não há receita para esta raridade.',
  saldo_insuficiente: 'Saldo insuficiente.',
  casco_ja_e_seu: 'Esta nave já é sua.',
  casco_desconhecido: 'Esta nave não existe no catálogo.',
  nao_autenticado: 'Sessão expirada. Recarregue a página.',
  corpo_grande_demais: 'O envio ficou grande demais. Recarregue a página.',
};

/** Quantas vezes seguidas cada rota falhou. Zerado no primeiro sucesso. */
const seguidas = new Map<string, number>();

/**
 * Os campos que o servidor usa para dizer "deu certo, MENOS isto".
 *
 * `/inventario` devolve `recusados` (equipar barrado) e `faltaram` (o pote deu
 * menos); `/missoes` e `/marcas` devolvem `recusadas`; `/progresso` conta
 * encontros recusados. Todos dentro de um **200**, de propósito — um comando
 * ruim não derruba o lote —, e todos ignorados pelo cliente até 09/09.
 *
 * Erro escondido dentro de sucesso é o pior lugar para um erro estar.
 */
const CAMPOS_DE_RECUSA = ['recusados', 'recusadas', 'faltaram'] as const;

/**
 * Deu certo: a rota volta a poder avisar se falhar de novo mais tarde.
 *
 * Recebe o corpo porque um 200 pode carregar recusa dentro. É o ponto único que
 * já existia no caminho de êxito de TODOS os módulos — pendurar a conferência
 * aqui evita seis chamadas novas para alguém esquecer a sétima.
 */
export function relatarSucesso(rota: string, dados?: unknown): void {
  seguidas.delete(rota);
  if (!dados || typeof dados !== 'object') return;

  const corpo = dados as Record<string, unknown>;
  for (const campo of CAMPOS_DE_RECUSA) {
    const valor = corpo[campo];
    if (valor === undefined || valor === null) continue;

    const vazio = Array.isArray(valor)
      ? !valor.length
      : typeof valor === 'number' ? !(valor > 0) : !Object.keys(valor).length;
    if (vazio) continue;

    // Console e não `toast`: nada disso quebra o jogo do jogador, e a maioria é
    // um comando obsoleto sendo descartado. O que não pode é sumir.
    console.warn(`[${rota}] o servidor aceitou, mas recusou parte — ${campo}:`, valor);
  }
}

/**
 * Relata uma recusa. `resposta` nula significa rede fora ou exceção.
 *
 * Devolve o código de erro do servidor, quando houver — quem chamou às vezes
 * precisa dele para decidir o que fazer, e ler o corpo duas vezes não é
 * possível.
 */
export async function relatarFalha(
  rota: string,
  natureza: Natureza,
  resposta: Response | null,
): Promise<string> {
  let motivo = '';
  if (resposta) {
    try {
      motivo = ((await resposta.json()) as { erro?: string }).erro ?? '';
    } catch { /* corpo vazio ou não-JSON: o status ainda vale como resposta */ }
  }

  const status = resposta ? resposta.status : 0;
  const vezes = (seguidas.get(rota) ?? 0) + 1;
  seguidas.set(rota, vezes);

  console.warn(
    `[${rota}] recusada — ${status ? `HTTP ${status}` : 'sem resposta'}`
    + ` · ${motivo || 'sem motivo no corpo'}`
    + (natureza === 'fundo' ? ` · ${vezes}ª seguida` : ''),
  );

  // A ação fala sempre. O fundo fala UMA vez, ao cruzar o limiar: repetir a
  // cada tentativa transformaria uma queda de rede num carrossel de avisos.
  if (natureza === 'acao' || vezes === FALHAS_ATE_FALAR) {
    toast(frase(motivo, status, natureza), 'bad');
  }

  return motivo;
}

function frase(motivo: string, status: number, natureza: Natureza): string {
  const conhecida = FRASES[motivo];
  if (conhecida) return conhecida;

  if (!status) {
    return natureza === 'acao'
      ? 'Sem resposta do servidor. A ação não aconteceu.'
      : 'Sem conexão com o servidor. Seu progresso não está sendo salvo.';
  }

  // O caso desconhecido diz o código de propósito: é o que o jogador consegue
  // repetir para quem conserta, e foi assim que o defeito de 08/09 caiu.
  return natureza === 'acao'
    ? `A ação foi recusada (${motivo || status}). Nada foi perdido.`
    : `O servidor está recusando a sincronização (${motivo || status}).`;
}

/**
 * Esquece a contagem de todas as rotas.
 *
 * Existe para o mesmo motivo que os outros `esquecer*` de `app/`: a contagem é
 * de uma sessão, e uma queda que ficou pela metade não deve fazer a próxima
 * avisar antes da hora.
 */
export function esquecerRecusas(): void {
  seguidas.clear();
}
