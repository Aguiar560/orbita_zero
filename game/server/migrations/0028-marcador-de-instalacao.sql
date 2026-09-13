-- Marcador de instalação: qual banco é este, respondido PELO banco.
--
-- Existe porque `AMBIENTE` no `wrangler.toml` é uma declaração, e a pergunta
-- que interessa é outra: para onde o binding `DB` realmente escreve. Um
-- `database_id` copiado errado faz o Worker se anunciar como staging enquanto
-- grava na produção, e nenhuma resposta de API revela isso — as duas
-- instalações rodam o mesmo código e respondem igual.
--
-- Uma linha por chave, lida por `/saude`. Aplicar em CADA banco com o valor
-- daquele banco; nunca copiar o valor de um para o outro.
CREATE TABLE IF NOT EXISTS instalacao (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- O valor abaixo é o da PRODUÇÃO. Ao aplicar no staging, trocar para
-- 'orbita-zero-staging' — é o que `npm run db:staging:criar` faz.
INSERT OR REPLACE INTO instalacao (chave, valor) VALUES ('banco', 'orbita-zero');
