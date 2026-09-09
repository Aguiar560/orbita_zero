/**
 * Quanto cada jogador pode gravar, e por quê não é um intervalo fixo.
 *
 * ## O defeito que isto conserta
 *
 * A regra anterior era "uma gravação a cada 120s, ponto". Ela protegia a cota,
 * e quebrava o caso mais importante do jogo: **a gravação de fim de sessão**.
 *
 *   entra no PC A          grava    (t=0)
 *   joga 90 segundos
 *   fecha a aba            RECUSADA (t=90, faltavam 30s)
 *   abre no PC B           recebe o save de t=0
 *
 * Os 90 segundos sumiram. E não é um caso raro: a última gravação de TODA
 * sessão cai nessa janela, então até dois minutos de jogo se perdiam sempre
 * que a pessoa trocava de máquina. Era o "no PC não dá certo".
 *
 * ## Balde de fichas, e por que ele não custa mais caro
 *
 * O que a cota precisa é do rate MÉDIO baixo; o que o jogo precisa é de poder
 * gravar DUAS vezes seguidas de vez em quando. Um balde dá as duas coisas: o
 * refil é a mesma taxa de antes (uma ficha a cada 120s), então o custo médio
 * não muda, mas a capacidade de 3 deixa passar a rajada de fim de sessão.
 *
 * Com mil registrados e ~80 simultâneos no pico, a média continua ~30
 * gravações por hora por jogador ativo — os mesmos 57 mil por dia do desenho
 * anterior, dentro dos 100 mil do D1 gratuito.
 */

/** Segundos para repor uma ficha. É a taxa MÉDIA de gravação. */
export const INTERVALO_DE_REFIL = 120;

/** Quantas fichas cabem no balde. É o tamanho da rajada permitida. */
export const FICHAS_MAX = 3;

export interface Balde {
  fichas: number;
  em: number;
}

/**
 * O balde depois de repor o que o tempo devolveu.
 *
 * `null` para quem nunca gravou: começa cheio, senão a primeira gravação de uma
 * conta nova esperaria dois minutos sem motivo.
 */
export function repor(balde: Balde | null, agora: number): number {
  if (!balde) return FICHAS_MAX;
  const decorrido = Math.max(0, agora - balde.em);
  return Math.min(FICHAS_MAX, balde.fichas + decorrido / INTERVALO_DE_REFIL);
}

export type Permissao =
  | { pode: true; fichasRestantes: number }
  | { pode: false; esperar: number };

/** Dá para gravar agora? */
export function podeGravar(balde: Balde | null, agora: number): Permissao {
  const fichas = repor(balde, agora);
  if (fichas >= 1) return { pode: true, fichasRestantes: fichas - 1 };

  // Quanto falta para a próxima ficha. Dizer isto evita o cliente ficar
  // batendo na porta — sem o número ele só sabe "não", e tenta de novo.
  return { pode: false, esperar: Math.ceil((1 - fichas) * INTERVALO_DE_REFIL) };
}


// ── baldes por assunto ──────────────────────────────────────────────────────

/**
 * Os ritmos de cada rota, e de onde cada número saiu.
 *
 * Todos generosos para o uso REAL e apertados para o laço. O cliente sobe
 * marcas junto com o save (a cada 150s) e busca o placar a cada 20s enquanto a
 * tela está aberta — os limites cabem isso com folga e não cabem um laço.
 */
export const BALDES = {
  /**
   * Marcas: uma chamada pode custar até 80 linhas.
   *
   * É a rota mais cara do servidor, e a única em que uma requisição vira
   * dezenas de escritas. Ritmo do save, capacidade menor.
   */
  marcas: { refil: 120, capacidade: 3 },
  /**
   * Apelido: escolhido uma vez, trocado quase nunca.
   *
   * Cinco minutos entre trocas não incomoda ninguém que esteja escolhendo um
   * nome de verdade, e fecha a porta de quem varre nomes livres um por um.
   */
  apelido: { refil: 300, capacidade: 2 },
  /**
   * SINCRONIZAÇÃO DE FUNDO: carteira, inventário, progressão, missões, lote e
   * ausência. Tudo que o jogo faz sozinho, no relógio dele.
   *
   * ## Por que os números cresceram
   *
   * Este balde nasceu em 03/09 chamado `carteira`, medido para UMA rota: um
   * depósito por setor, ~20 por hora. Desde então ele passou a carregar seis, e
   * o nome ficou para trás junto com o dimensionamento.
   *
   * Contado no cliente, não estimado:
   *
   * | momento | rotas que disparam juntas |
   * |---|---|
   * | boot | ausência, carteira, lote, inventário, progresso, missões = **6** |
   * | fim de setor (~3 min) | carteira, inventário, progresso, missões = **4** |
   *
   * Com `capacidade: 6`, um boot esvaziava o balde inteiro — e o segundo boot
   * dentro de meio minuto era recusado em bloco. É o que deixava o espelho do
   * inventário parado enquanto se recarrega a página para testar, e foi metade
   * do "meus itens sumiram" de 08/09.
   *
   * 20 s com estouro de 12 cabe DOIS boots seguidos e ainda dá 3/min
   * sustentados contra 1,3/min do ritmo real. E não afrouxa a cota: o balde não
   * muda quantas escritas o jogo tenta, só quantas ele recusa — o custo médio
   * continua sendo o ritmo do jogo.
   */
  sincronia: { refil: 20, capacidade: 12 },
  /**
   * AÇÃO DELIBERADA do jogador: fundir, comprar casco, comprar passe.
   *
   * ## Por que não pode dividir balde com a sincronização
   *
   * São coisas de naturezas opostas. A sincronização é automática, invisível e
   * tolerante — recusada, ela tenta de novo no próximo ciclo e ninguém percebe.
   * A ação deliberada acontece com o jogador olhando: recusada, ela é um botão
   * que não funciona.
   *
   * Dividindo o balde, a segunda pagava pela primeira. O jogador abria a
   * Fabricação logo depois de um setor cair — que é o momento natural, porque é
   * quando as peças chegam — e encontrava o balde no chão. Foi exatamente o
   * relato de 08/09: FABRICAR aceso, dez peças no anel, e
   * `rapido_demais` na volta.
   *
   * ## Os números
   *
   * Uma mão humana clica isto uma vez a cada muitos minutos. 20 s com estouro
   * de 5 dá 3/min sustentados — larguíssimo para quem joga, e ainda recusa o
   * laço. E a fusão se limita sozinha: cada uma consome dez peças.
   */
  acao: { refil: 20, capacidade: 5 },
  /**
   * ERRO DO CLIENTE: o `TypeError` que aconteceu no navegador do jogador.
   *
   * Apertado de propósito, e por dois motivos que apontam para o mesmo lado.
   *
   * O cliente já se trava sozinho — cada erro distinto sobe uma vez por sessão,
   * no máximo dez —, então o uso legítimo é de alguns envios por sessão e nunca
   * chega perto disto. Se chegar, ou o cliente está quebrado de um jeito novo,
   * ou alguém está usando a rota para escrever no meu banco.
   *
   * E é a única rota do jogo onde o CORPO vira conteúdo de uma coluna. Um
   * minuto entre envios não atrapalha ninguém que esteja relatando um defeito
   * de verdade, e fecha a porta de quem quer encher a tabela.
   */
  cliente: { refil: 60, capacidade: 5 },
  /**
   * A TELA DO PIX perguntando se o dinheiro caiu.
   *
   * É o único lugar do jogo em que o jogador fica olhando uma tela esperando
   * uma resposta que não depende dele. Perguntar de cinco em cinco segundos é
   * o que qualquer app de pagamento faz, e menos que isso parece travado.
   *
   * 5 s com estouro de 15 cobre a espera inteira sem folga para laço: são 12
   * por minuto sustentados, e a cobrança vive trinta minutos.
   */
  cobranca: { refil: 5, capacidade: 15 },
  /**
   * O que o SERVIDOR pergunta ao PROVEDOR, e não o que o jogador pergunta a nós.
   *
   * Os dois ritmos são diferentes de propósito. A tela pergunta a cada cinco
   * segundos e é respondida do banco — barato, nosso, instantâneo. Sair para a
   * API do Mercado Pago a cada uma dessas perguntas seria 12 chamadas por
   * minuto por jogador esperando, e é assim que se toma um bloqueio do provedor
   * justamente na hora em que o dinheiro está entrando.
   *
   * 20 s com estouro de 3 significa: o webhook continua sendo o caminho rápido,
   * e este é o que fecha a compra quando ele não chega — com atraso de segundos,
   * não de horas.
   */
  provedor: { refil: 20, capacidade: 3 },
} as const;

export type NomeDeBalde = keyof typeof BALDES;

/** O mesmo cálculo de `podeGravar`, com os números do balde escolhido. */
export function podeUsar(
  nome: NomeDeBalde,
  balde: Balde | null,
  agora: number,
): Permissao {
  const { refil, capacidade } = BALDES[nome];
  const fichas = balde
    ? Math.min(capacidade, balde.fichas + Math.max(0, agora - balde.em) / refil)
    : capacidade;

  if (fichas >= 1) return { pode: true, fichasRestantes: fichas - 1 };
  return { pode: false, esperar: Math.ceil((1 - fichas) * refil) };
}

// ── leitura: balde em memória ───────────────────────────────────────────────

/**
 * O limite do `GET /placar`, guardado no ISOLADO e não no banco.
 *
 * Um limitador que grava no banco a cada LEITURA custa mais que o que ele
 * protege — trocaria uma consulta barata por uma escrita cara, e a escrita é
 * justamente a cota que está em jogo.
 *
 * Em memória não é à prova de tudo: o Workers cria isolados por região e os
 * recicla, então um cliente distribuído escapa. Mas o caso que isto existe para
 * pegar — um laço de um cliente só — cai no mesmo isolado quase sempre, e essa
 * é a diferença entre "gasta a cota de todos numa tarde" e "não gasta".
 */
const LEITURAS_POR_MINUTO = 30;
const leituras = new Map<string, { fichas: number; em: number }>();

export function podeLer(usuario: string, agora: number): boolean {
  const b = leituras.get(usuario);
  const fichas = b
    ? Math.min(LEITURAS_POR_MINUTO, b.fichas + ((agora - b.em) / 60) * LEITURAS_POR_MINUTO)
    : LEITURAS_POR_MINUTO;

  if (fichas < 1) return false;

  // O mapa não pode crescer para sempre: um isolado longevo com muitos
  // jogadores viraria vazamento. Acima do teto, esquece os mais antigos.
  if (leituras.size > 5000) {
    for (const [k] of leituras) {
      leituras.delete(k);
      if (leituras.size <= 4000) break;
    }
  }

  leituras.set(usuario, { fichas: fichas - 1, em: agora });
  return true;
}
