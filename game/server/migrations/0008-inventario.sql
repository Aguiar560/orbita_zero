-- O inventário sai do save e vira estado do servidor.
--
-- ## O que faltava depois da 3a
--
-- A Fase 3a tirou do cliente o poder de escolher QUAL item cai: a rolagem é do
-- servidor, com semente que o cliente não conhece. Faltava a outra metade — o
-- inventário continuava no save, e save é blob que o cliente escreve. Dava para
-- não rolar nada e simplesmente ESCREVER uma peça Divina na lista.
--
-- ## Por que o conteúdo do item vem em JSON, e não em colunas
--
-- Um item tem base, raridade, nível, elemento, ícone, favorito e uma lista de
-- afixos de tamanho variável. Normalizar isso em tabelas custaria duas junções
-- por leitura para responder a única pergunta que o jogo faz — "quais itens
-- este jogador tem" — e amarraria o esquema do banco ao esquema do item, que
-- ainda muda a cada entrega de balanceamento.
--
-- O que NÃO fica em JSON é o que o servidor precisa CONFERIR ou FILTRAR: dono,
-- nave e slot têm coluna própria.
--
-- ## Por que `nave` e `slot` são colunas
--
-- Equipar é a operação que o servidor precisa validar sozinho — uma peça de
-- fogo não entra numa nave de gelo, e essa regra vale poder real. Com o vínculo
-- em coluna, "o que está equipado nesta nave" é uma consulta indexada, e não um
-- `JSON_EXTRACT` sobre a mochila inteira.
--
-- Nulo nos dois = a peça está na mochila.

CREATE TABLE IF NOT EXISTS itens (
  -- O `uid` do item. Vem do gerador, que roda no servidor desde a 3a — o
  -- cliente nunca inventa um.
  uid     TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  -- O item inteiro, como o jogo o conhece. Serializado de `Item`.
  dados   TEXT NOT NULL,
  -- Casco em que a peça está equipada, ou NULL se está na mochila.
  nave    TEXT,
  -- Slot ocupado. Só faz sentido junto de `nave`.
  slot    TEXT,
  em      INTEGER NOT NULL
);

-- A mochila de um jogador é a leitura mais frequente do sistema.
CREATE INDEX IF NOT EXISTS itens_usuario ON itens (usuario, nave);

-- Uma nave não pode ter duas peças no mesmo slot.
--
-- É invariante de jogo, e vale ser do BANCO e não só do código: um equipar que
-- corresse duas vezes por causa de uma retentativa de rede deixaria a nave com
-- dois peitorais, e o cálculo de atributos somaria os dois sem reclamar. O
-- índice recusa antes disso virar poder.
CREATE UNIQUE INDEX IF NOT EXISTS itens_equipado
  ON itens (usuario, nave, slot) WHERE nave IS NOT NULL;

-- Até onde o jogador já consumiu o lote em curso.
--
-- É o que impede coletar o mesmo item duas vezes. O cliente não manda o item
-- que pegou — ele diz QUANTOS pegou de cada tipo, e o servidor deriva quais
-- são a partir da semente e deste cursor. Item nenhum trafega do cliente para
-- o servidor, então não há o que forjar.
ALTER TABLE lotes ADD COLUMN usados_onda INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lotes ADD COLUMN usados_elite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lotes ADD COLUMN usados_chefe INTEGER NOT NULL DEFAULT 0;
