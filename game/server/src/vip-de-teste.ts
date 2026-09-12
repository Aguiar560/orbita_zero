/** Interruptor único para retirar a recompensa quando o período de teste acabar. */
export const VIP_TESTE_NIVEL_25_ATIVO = true;
export const NIVEL_DA_RECOMPENSA_VIP = 25;

/**
 * A promoção tem VAGAS, e elas são o produto — não um detalhe de implementação.
 *
 * Regra de 12/09/2026: as primeiras 40 contas a alcançar a patente 25 ganham
 * passe. As **10 primeiras levam 30 dias**; as **30 seguintes, 7**. Passou de
 * 40, ninguém mais ganha — o interruptor acima continua existindo para desligar
 * antes disso, se for o caso.
 *
 * ## Por que a vaga é contada por carimbo, e não por "quem tem VIP"
 *
 * "Quem tem VIP" é um alvo móvel: quem ganhar pela promoção passa a ter, e quem
 * COMPRAR um passe amanhã passaria a consumir vaga de graça alheia. O carimbo
 * `bonus_nivel_25_em` é o contrário — ele marca a vaga no momento em que ela é
 * tomada e nunca mais muda, nem quando o passe expira.
 *
 * As contas que já tinham passe quando a regra nasceu entram na conta das 40,
 * como pedido. Elas recebem o carimbo pela migração `0024` e `bonus_dias = 0`:
 * ocupam vaga e não ganham nada de novo, porque já tinham.
 */
export const VAGAS_DA_RECOMPENSA_VIP = 40;
export const VAGAS_DE_30_DIAS = 10;
export const DIAS_DA_PRIMEIRA_FAIXA = 30;
export const DIAS_DA_SEGUNDA_FAIXA = 7;

const SEGUNDOS_POR_DIA = 24 * 60 * 60;

/**
 * As mensagens, uma por faixa.
 *
 * Em inglês porque a primeira foi, e quem já recebeu leu assim — trocar de
 * idioma no meio de uma promoção faria a segunda leva parecer outra coisa.
 *
 * A chave é por FAIXA, e não uma só: o índice único em `(usuario, chave)` é o
 * que impede a mensagem de nascer duas vezes, e uma chave compartilhada entre
 * faixas faria a segunda leva perder a mensagem se a primeira já tivesse
 * gravado — o que nunca acontece hoje, mas é o tipo de armadilha que só aparece
 * no dia em que alguém muda de faixa à mão.
 */
export const MENSAGENS_DA_RECOMPENSA_VIP: Record<number, string> = {
  [DIAS_DA_PRIMEIRA_FAIXA]:
    'Thank you for helping us test Órbita Zero! You reached Command Level 25 and you are one of the first 10 pilots to do it — your reward is a free 30-day VIP Pass. Your time in the game is helping us make it better.',
  [DIAS_DA_SEGUNDA_FAIXA]:
    'Thank you for helping us test Órbita Zero! You reached Command Level 25 and received a free 7-day VIP Pass. Your time in the game is helping us make it better.',
};

export const CHAVES_DO_RECADO_VIP: Record<number, string> = {
  [DIAS_DA_PRIMEIRA_FAIXA]: 'vip_teste_nivel_25',
  [DIAS_DA_SEGUNDA_FAIXA]: 'vip_teste_nivel_25_7d',
};

interface LinhaDeBonus {
  bonus_dias: number;
}

/**
 * Concede uma única vez o passe do período de testes, enquanto houver vaga.
 *
 * Devolve **quantos dias** foram concedidos, ou `0` quando nada foi. O número é
 * verdade útil para quem chama — o cliente só olha se é diferente de zero, mas
 * o painel e o teste precisam saber qual faixa saiu.
 *
 * ## O que é atômico aqui, e por quê
 *
 * A faixa e o teto vivem DENTRO do `UPDATE`, como subconsulta e `CASE`. Ler o
 * total antes e decidir no JavaScript abriria a janela clássica: duas contas
 * cruzando a patente 25 no mesmo instante leriam 39 e as duas entrariam, ou
 * leriam 9 e as duas levariam 30 dias.
 *
 * O `UPDATE` condicional é também a trava contra duas abas da mesma conta: só
 * uma consegue trocar o carimbo de zero, e a outra casa zero linhas.
 *
 * A linha é criada antes com `INSERT OR IGNORE` e `bonus_nivel_25_em = 0`, que
 * não ocupa vaga — quem ocupa é o carimbo, e ele só é escrito pelo `UPDATE`.
 *
 * ## Por que o recado é tentado em toda leitura elegível
 *
 * Se a rede cair entre o crédito e a mensagem, a próxima leitura repara a
 * entrega. O `INSERT OR IGNORE` com chave única faz disso uma operação segura
 * de repetir. Quem ocupou vaga sem ganhar nada (`bonus_dias = 0`) não recebe
 * mensagem nenhuma: não teria o que agradecer.
 */
export async function concederVipDeTeste(
  env: { DB: D1Database }, usuario: string, nivel: number, agora: number,
): Promise<number> {
  if (!VIP_TESTE_NIVEL_25_ATIVO || nivel < NIVEL_DA_RECOMPENSA_VIP) return 0;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO assinaturas (usuario, expira_em, bonus_nivel_25_em, bonus_dias)
    VALUES (?, 0, 0, 0)
  `).bind(usuario).run();

  const concessao = await env.DB.prepare(`
    UPDATE assinaturas
       SET expira_em = MAX(expira_em, ?1) + CASE
             WHEN (SELECT COUNT(*) FROM assinaturas WHERE bonus_nivel_25_em > 0) < ?2
             THEN ?3 ELSE ?4 END,
           bonus_nivel_25_em = ?1,
           bonus_dias = CASE
             WHEN (SELECT COUNT(*) FROM assinaturas WHERE bonus_nivel_25_em > 0) < ?2
             THEN ?5 ELSE ?6 END
     WHERE usuario = ?7
       AND bonus_nivel_25_em = 0
       AND (SELECT COUNT(*) FROM assinaturas WHERE bonus_nivel_25_em > 0) < ?8
  `).bind(
    agora,
    VAGAS_DE_30_DIAS,
    DIAS_DA_PRIMEIRA_FAIXA * SEGUNDOS_POR_DIA,
    DIAS_DA_SEGUNDA_FAIXA * SEGUNDOS_POR_DIA,
    DIAS_DA_PRIMEIRA_FAIXA,
    DIAS_DA_SEGUNDA_FAIXA,
    usuario,
    VAGAS_DA_RECOMPENSA_VIP,
  ).run();

  /**
   * A CONCESSÃO é deste `UPDATE`; o recado pode ser de uma tentativa anterior.
   *
   * Por isso os dois caminhos são separados abaixo. Devolver os dias em toda
   * leitura elegível faria o cliente ressincronizar a carteira para sempre —
   * `adotarRecompensaVip` dispara uma requisição a cada resposta em que este
   * número não for zero, e a conta já paga isso uma vez.
   */
  const concedeuAgora = Number(concessao.meta.changes ?? 0) === 1;
  const linha = await env.DB
    .prepare('SELECT bonus_dias FROM assinaturas WHERE usuario = ?')
    .bind(usuario)
    .first<LinhaDeBonus>();
  const dias = Number(linha?.bonus_dias ?? 0);
  if (!dias) return 0;

  const texto = MENSAGENS_DA_RECOMPENSA_VIP[dias];
  const chave = CHAVES_DO_RECADO_VIP[dias];
  if (texto && chave) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO recados (usuario, texto, criado_em, chave)
      VALUES (?, ?, ?, ?)
    `).bind(usuario, texto, agora, chave).run();
  }

  return concedeuAgora ? dias : 0;
}
