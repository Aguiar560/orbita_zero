-- Recado do comando: uma mensagem do operador para UM jogador.
--
-- ## Por que uma tabela, e não o chat
--
-- O chat já entrega mensagem privada entre jogadores, e seria o lugar óbvio.
-- Ele não serve para isto por três motivos:
--
-- 1. Exige uma CONTA de remetente e uma sessão viva para enviar. Um aviso de
--    operação sai de um comando administrativo, não de alguém logado.
-- 2. Ele vive noutro Worker, noutro D1. Ligar a operação do jogo à
--    disponibilidade do chat faz um cair junto com o outro.
-- 3. Mensagem de chat se perde na rolagem. Esta precisa aparecer NA TELA e
--    ficar até ser lida — é o que a diferencia de uma conversa.
--
-- ## O que ela guarda, e o que não guarda
--
-- Guarda o texto e quando foi lido. Não guarda remetente: quem manda é sempre
-- o comando, e um campo que só tem um valor possível é um campo que mente
-- assim que alguém escrever outro.
--
-- Não é fila de notificação nem histórico: um recado lido some da entrega e
-- fica só como registro de que foi entregue — que é a pergunta que o suporte
-- faz depois ("ele viu?").

CREATE TABLE IF NOT EXISTS recados (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario   TEXT NOT NULL,
  -- O texto pronto, em português, do jeito que aparece na tela. Nada de
  -- chave de tradução: são poucos, escritos à mão, e um id de mensagem que
  -- ninguém cadastrou vira uma tela em branco.
  texto     TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  -- Nulo enquanto não entregue. É o único estado que existe.
  lido_em   INTEGER
);

-- A pergunta do jogo é sempre "o que falta entregar para ESTE jogador".
CREATE INDEX IF NOT EXISTS idx_recados_pendentes
  ON recados (usuario, lido_em);
