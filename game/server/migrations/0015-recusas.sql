-- O livro das recusas: como o servidor conta que está quebrado.
--
-- ## O defeito que isto fecha
--
-- Em 08/09/2026 quatro defeitos ficaram horas no ar sem um único sintoma do
-- lado do servidor. Não foi distração: **uma recusa não parece um erro**. `409`
-- e `429` são respostas HTTP normais, o Cloudflare não vê nada de errado nelas,
-- e o cliente engole todas (`return null`) e mostra ao jogador um número
-- plausível. O pior deles — a coleta que derrubava o lote de comandos inteiro —
-- respondeu `409` milhares de vezes parecendo estar funcionando.
--
-- O sistema só reportava pelo Rafael. Ele era o monitoramento.
--
-- ## A pergunta que esta tabela responde
--
--   SELECT rota, motivo, SUM(n) FROM recusas
--    WHERE hora > strftime('%s','now') - 86400
--    GROUP BY rota, motivo ORDER BY 3 DESC;
--
-- Cinco segundos, sem depender de ninguém reclamar e sem estar olhando na hora
-- certa. É a diferença entre "meu nível zerou" e "a /progresso falhou 40 vezes
-- às 19h52".
--
-- ## Por que AGREGADO, e não uma linha por recusa
--
-- A cota do D1 é de ESCRITA — 100 mil por dia —, e é exatamente numa tempestade
-- de recusas que se escreveria mais. Um livro que se afoga no incidente que
-- existe para registrar não serve.
--
-- A chave é `(rota, motivo, hora)` com contador. Além disso o isolado acumula
-- em memória e descarrega no máximo uma vez por minuto por chave (ver
-- `recusas.ts`): o que se quer saber é QUE algo falha e em que ordem de
-- grandeza, não o carimbo de cada ocorrência.
--
-- No pior caso são `rotas × motivos × 24` linhas por dia. No caso normal —
-- que é o esperado — quase nenhuma, e uma tabela vazia aqui é uma boa notícia
-- legível.
--
-- ## O que NÃO entra
--
-- `401` e `404`. Token vencido acontece com todo mundo o tempo todo, e rota
-- inexistente é varredura de robô. Os dois enchem o livro de ruído que esconde
-- o sinal.
--
-- ## Por que sem `usuario`
--
-- A pergunta é "o que está quebrado", nunca "quem tomou erro". Guardar o
-- jogador transformaria um livro de operação num rastro de comportamento, com
-- retenção e privacidade para pensar, sem responder nada a mais.

CREATE TABLE IF NOT EXISTS recusas (
  -- A rota, sem query: `/inventario`, `/sintetizar`.
  rota   TEXT NOT NULL,
  -- O campo `erro` do corpo, ou `http_<status>` quando não houver.
  motivo TEXT NOT NULL,
  -- Início da hora, em epoch de segundos. É o que agrupa.
  hora   INTEGER NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rota, motivo, hora)
);

-- A leitura é sempre "as últimas horas", nunca "esta rota desde sempre".
CREATE INDEX IF NOT EXISTS idx_recusas_hora ON recusas (hora);
