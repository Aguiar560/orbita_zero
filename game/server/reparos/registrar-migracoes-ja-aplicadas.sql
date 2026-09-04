-- Reparo: reconstrói o histórico de migrações que se perdeu.
--
-- ## O sintoma
--
--     duplicate column name: versao_servidor: SQLITE_ERROR [code: 7500]
--
-- `wrangler d1 migrations apply` lista as DEZ migrações como pendentes e morre
-- na primeira. Nada depois dela roda.
--
-- ## A causa
--
-- A tabela `d1_migrations` está VAZIA — zero linhas — mas sete migrações
-- claramente rodaram: as tabelas delas existem no banco. O histórico se perdeu
-- em algum momento (as primeiras provavelmente foram aplicadas à mão, com
-- `d1 execute`, que não escreve nessa tabela).
--
-- Sem histórico, o wrangler tenta reaplicar desde a 0002. E a 0002 é
-- `ALTER TABLE saves ADD COLUMN`, que NÃO é idempotente: as colunas já existem,
-- o SQLite recusa, e `migrations apply` para na primeira falha.
--
-- ## O que este arquivo faz
--
-- Registra como aplicadas apenas as que REALMENTE rodaram — verificado tabela
-- por tabela em 04/09:
--
--   0002  saves.versao_servidor, .fichas, .fichas_em   ✓ existem
--   0003  limites                                      ✓
--   0004  contas                                       ✓
--   0005  transacoes, saldos                            ✓
--   0006  assinaturas                                   ✓
--   0007  lotes                                         ✓
--   0009  frota                                         ✓
--
-- Ficam de FORA de propósito, porque não rodaram e precisam rodar:
--
--   0008  itens, lotes.usados_*      ✗ ausentes
--   0010  progresso, naves_progresso, materiais  ✗ ausentes
--   0011  excedentes                 ✗ ausente
--
-- Repare que a 0009 rodou e a 0008 não: elas não foram aplicadas em ordem, o
-- que confirma que não vieram de `migrations apply`.
--
-- ## Por que um arquivo, e não `--command`
--
-- O mesmo INSERT por `--command` não chegou ao banco no PowerShell 5.1 — ele
-- mastiga aspas e parênteses ao repassar para o executável, e o comando falha
-- em silêncio. `--file` não passa por essa análise.
--
-- ## Como usar
--
--   cd D:\bbb\game\server
--   npx wrangler d1 execute orbita-zero --remote --file=reparos/registrar-migracoes-ja-aplicadas.sql
--   npx wrangler d1 migrations apply orbita-zero --remote
--
-- O segundo comando deve listar EXATAMENTE 0008, 0010 e 0011. Se listar mais,
-- este arquivo não pegou — e aplicar a 0002 de novo falha do mesmo jeito.
--
-- `INSERT OR IGNORE` porque `name` é UNIQUE: rodar isto duas vezes não faz mal.

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0002-ritmo-e-versao.sql'),
  ('0003-limites.sql'),
  ('0004-contas.sql'),
  ('0005-carteira.sql'),
  ('0006-assinatura.sql'),
  ('0007-lotes.sql'),
  ('0009-frota.sql');
