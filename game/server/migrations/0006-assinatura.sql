-- O passe VIP sai do save e vira estado do servidor.
--
-- ## Por que uma tabela, e não uma coluna em `contas`
--
-- `contas` guarda um fato que o servidor observa sozinho — desde quando a conta
-- existe — e nunca muda depois de escrito. A assinatura é o oposto: muda toda
-- vez que alguém renova, e é consultada junto dos saldos. Misturar as duas
-- faria uma linha que nasceu imutável passar a ser reescrita, e a próxima
-- pessoa a ler `contas` não teria como saber disso.
--
-- ## Por que só a expiração
--
-- O passe inteiro cabe num carimbo de tempo: ativo é `expira_em > agora`. Não
-- há "níveis" de VIP nem benefícios separados, então guardar mais campos seria
-- inventar estado que ninguém consulta. Renovar é somar 30 dias ao MAIOR entre
-- agora e a expiração atual — quem renova antes de vencer não perde o resto.
--
-- ## O que NÃO fica aqui
--
-- O pagamento. Quem comprou o quê e por quanto mora em `transacoes`, junto do
-- resto do dinheiro. Esta tabela é só a consequência: o direito que a compra
-- gerou. Separado assim, estornar é um lançamento novo no livro mais um
-- `UPDATE` aqui, e as duas coisas continuam explicáveis uma sem a outra.

CREATE TABLE IF NOT EXISTS assinaturas (
  usuario  TEXT PRIMARY KEY,
  -- Epoch em SEGUNDOS, do relógio do servidor. Zero e passado significam a
  -- mesma coisa — sem passe — e a linha pode existir com valor vencido: é o
  -- histórico de que a pessoa já foi assinante.
  expira_em INTEGER NOT NULL DEFAULT 0
);
