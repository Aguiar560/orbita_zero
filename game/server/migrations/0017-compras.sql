-- A compra de cristais com dinheiro de verdade.
--
-- ## Por que uma tabela, se o livro-caixa já registra o crédito
--
-- Porque são duas perguntas diferentes, e só uma delas o livro responde.
--
-- `transacoes` responde "de onde saíram estes cristais" — e só existe DEPOIS do
-- pagamento confirmado. Ela não sabe nada da cobrança que foi criada e nunca
-- paga, que é a maioria: o jogador abre o Pix, pensa melhor, fecha a aba.
--
-- Esta tabela responde as outras: o que foi oferecido, por quanto, quando, e o
-- que aconteceu com aquela cobrança. Sem ela, uma reclamação de "paguei e não
-- recebi" não tem contra o que ser conferida.
--
-- ## Por que `cristais` e `centavos` são CONGELADOS aqui
--
-- Eles vêm do catálogo (`CRYSTAL_PACKAGES`), que é tabela do jogo e vai mudar —
-- promoção, reajuste, pacote novo. Entre criar a cobrança e o Pix ser pago
-- passam minutos, e nesse intervalo o catálogo pode ter mudado.
--
-- O jogador precisa receber **o que foi anunciado quando ele pagou**, não o que
-- o catálogo diz na hora em que o webhook chega. Guardar aqui é o que torna
-- isso verdade, e é também o que a auditoria vai ler quando alguém perguntar
-- quanto custava o pacote em tal dia.
--
-- ## O que NÃO fica aqui
--
-- O crédito. Ele é do livro-caixa, com `motivo = 'compra'` e `origem` = o id do
-- pagamento no provedor. O índice único `(motivo, origem)` de `transacoes` é o
-- que garante que o mesmo pagamento nunca credite duas vezes — e o provedor
-- REENVIA o mesmo webhook por desenho, então isso não é zelo, é o caminho
-- normal.

CREATE TABLE IF NOT EXISTS compras (
  -- Nosso id da cobrança. É ele que viaja como referência externa até o
  -- provedor e volta no webhook, e é por ele que se acha a compra sem depender
  -- de o provedor ter mandado tudo de volta.
  id          TEXT PRIMARY KEY,
  usuario     TEXT NOT NULL,
  -- O id do pacote em `CRYSTAL_PACKAGES`. Guardado para a auditoria saber o
  -- que foi vendido mesmo depois de o pacote sair do catálogo.
  pacote      TEXT NOT NULL,
  -- Congelados no momento da criação. Ver o cabeçalho.
  cristais    INTEGER NOT NULL,
  centavos    INTEGER NOT NULL,
  -- `pendente` | `paga` | `expirada` | `cancelada`. Só sobe de pendente para
  -- um dos outros três, e nunca volta.
  estado      TEXT NOT NULL DEFAULT 'pendente',
  -- O id do pagamento no provedor. Guardado assim que a cobrança é criada lá,
  -- e não quando o webhook chega: é por ele que se PERGUNTA ao provedor se o
  -- Pix caiu, e essa pergunta é o que fecha a compra quando o webhook falha.
  -- É ele, também, que vira a `origem` do lançamento no livro.
  provedor_id TEXT,
  criada_em   INTEGER NOT NULL,
  paga_em     INTEGER
);

-- "As compras deste jogador", que é a pergunta da tela e a do suporte.
CREATE INDEX IF NOT EXISTS idx_compras_usuario ON compras (usuario, criada_em);

-- E "de quem é este pagamento", que é a pergunta do webhook. Único porque um
-- pagamento do provedor pertence a UMA cobrança: se dois registros dissessem o
-- contrário, o banco recusa antes de alguém ser creditado em dobro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_provedor
  ON compras (provedor_id) WHERE provedor_id IS NOT NULL;
