-- Baldes de ritmo por jogador e por ASSUNTO.
--
-- ## Por que uma tabela, e não mais colunas em `saves`
--
-- O balde do save já vive em `saves.fichas`, e funcionou porque save é uma
-- coisa só. Marcas e apelido têm ritmos próprios: quem grava o save no ritmo
-- normal não pode ficar sem poder escolher um apelido, e quem troca de apelido
-- não pode perder a gravação do save.
--
-- Um balde por assunto separa isso. A chave composta deixa acrescentar assunto
-- novo sem tocar no esquema.
CREATE TABLE IF NOT EXISTS limites (
  usuario TEXT NOT NULL,
  -- 'marcas', 'apelido'… O nome é do CÓDIGO, não do jogador.
  balde   TEXT NOT NULL,
  fichas  REAL NOT NULL,
  -- Epoch em segundos da última reposição.
  em      INTEGER NOT NULL,
  PRIMARY KEY (usuario, balde)
);
