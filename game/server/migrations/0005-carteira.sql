-- O livro-caixa: toda moeda que entra e sai, e o saldo derivado dele.
--
-- ## Por que um livro, e não um número
--
-- O caminho curto seria uma coluna `cristais` por usuário. Ela funciona até o
-- primeiro dos três casos abaixo, e aí não há como consertar retroativamente:
--
-- 1. **Estorno.** O direito de arrependimento do CDC é de sete dias. Sem
--    histórico não dá para saber o que devolver — só o saldo de agora, que já
--    misturou a compra com tudo que aconteceu depois.
-- 2. **Contestação de cartão.** O provedor pergunta o que foi entregue e
--    quando. "O saldo dele é 340" não é resposta.
-- 3. **Ranking premiado.** Para o pódio é preciso reconstruir como a pessoa
--    chegou lá. Saldo não reconstrói nada; lançamento reconstrói tudo.
--
-- Então: `transacoes` é a VERDADE, append-only, nunca atualizada nem apagada.
-- `saldos` é cache — existe só para a leitura não custar uma soma da história
-- inteira a cada requisição, e pode ser reconstruído a partir do livro a
-- qualquer momento.
--
-- ## Por que INTEGER e não REAL
--
-- Moeda em ponto flutuante acumula erro: somar 0,1 dez vezes não dá 1. As
-- moedas do jogo já são inteiras (`sucata`, `nucleo`, `cristal`), e manter
-- assim no banco elimina uma classe inteira de discussão sobre centavo sumido.

CREATE TABLE IF NOT EXISTS transacoes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario  TEXT    NOT NULL,
  -- `sucata` | `nucleo` | `cristal`. Texto e não enum porque o SQLite não tem
  -- enum, e a validação mora no Worker, onde a lista de moedas já existe.
  moeda    TEXT    NOT NULL,
  -- Positivo credita, negativo debita. Um único campo com sinal, e não duas
  -- colunas: com duas, "quanto entrou no total" vira uma consulta com CASE, e
  -- o saldo deixa de ser uma soma simples.
  quantia  INTEGER NOT NULL,
  -- Por que o lançamento existe: `compra`, `drop`, `missao`, `loja`, `vip`,
  -- `estorno`, `ajuste`. É o que permite responder "de onde saíram estes
  -- cristais" sem adivinhação.
  motivo   TEXT    NOT NULL,
  -- Id do evento EXTERNO que causou o lançamento — o id do webhook do provedor
  -- de pagamento, tipicamente. Nulo quando o lançamento nasceu aqui dentro.
  origem   TEXT,
  em       INTEGER NOT NULL
);

-- A garantia de idempotência, e o motivo de `origem` existir.
--
-- Provedor de pagamento REENVIA webhook: é o comportamento normal deles, não
-- falha. Sem este índice, o jogador paga uma vez e recebe três. Com ele, a
-- segunda tentativa de inserir o mesmo evento falha no banco, e o Worker trata
-- a falha como "já processado" em vez de como erro.
--
-- Parcial (`WHERE origem IS NOT NULL`) porque a esmagadora maioria dos
-- lançamentos é interna e não tem origem externa; um índice único sobre nulos
-- barraria o segundo lançamento interno de cada motivo.
CREATE UNIQUE INDEX IF NOT EXISTS transacoes_origem
  ON transacoes (motivo, origem) WHERE origem IS NOT NULL;

-- A leitura de saldo e a auditoria por usuário passam por aqui.
CREATE INDEX IF NOT EXISTS transacoes_usuario
  ON transacoes (usuario, moeda, id);

CREATE TABLE IF NOT EXISTS saldos (
  usuario       TEXT    NOT NULL,
  moeda         TEXT    NOT NULL,
  -- Nunca negativo. O débito é condicional (`WHERE quantia >= ?`) e o Worker
  -- confere quantas linhas mudaram: zero significa saldo insuficiente, e é
  -- assim que "gastar o que não tem" é recusado sem precisar ler antes de
  -- escrever — que seria uma corrida entre a leitura e a escrita.
  quantia       INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL,
  PRIMARY KEY (usuario, moeda)
);
