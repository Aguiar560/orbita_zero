-- As contas administrativas saem de todo ranking.
--
-- "Tira o Aguiar dos rankings, é adm, não pode adm ter rank" — 12/09/2026.
--
-- ## Por que `contas_teste` e não uma lista nova
--
-- A exclusão já existe e já é respeitada: `placar.ts` tem
-- `NOT EXISTS (SELECT 1 FROM contas_teste ...)` em TODAS as consultas de
-- ranking. Uma segunda lista significaria duas fontes para a mesma pergunta —
-- e a próxima consulta de placar escolheria uma delas por acaso.
--
-- A lista `ADMINS` de `src/data/servidor.ts` não serve para isto: ela mora no
-- pacote do cliente e é portão de INTERFACE, não de servidor. O próprio arquivo
-- diz isso com todas as letras.
--
-- ## As duas contas
--
-- Rafael tem dois ids, e os dois estão em `ADMINS`:
--
-- - `8d4be4e6` — a conta anônima de maio, apelido "Aguiar", onde está o
--   progresso antigo. É ela que aparecia no placar.
-- - `0a069f4f` — a conta do Google, em uso hoje.
--
-- As duas entram, e não só a que aparece: a outra aparece no dia em que ele
-- jogar por ela, e aí o problema volta sem ninguém lembrar do porquê.
--
-- ## O efeito colateral, dito em voz alta
--
-- `contas_teste` também bloqueia recompensa de indicação, dos dois lados — ver
-- o filtro em `registrarRecompensaDaCompra`. A conta `8d4be4e6` é hoje o
-- indicador de dois vínculos, e eles deixam de gerar comissão. Para uma conta
-- administrativa isso é coerente: quem opera o jogo não deveria ganhar comissão
-- do programa que administra. Mas é uma consequência, não um detalhe.

INSERT OR IGNORE INTO contas_teste (usuario, criado_em, motivo)
VALUES
  ('8d4be4e6-52d6-437c-ad4e-556cca3aa43b', CAST(strftime('%s','now') AS INTEGER), 'conta administrativa'),
  ('0a069f4f-254d-49a8-b4df-dd4a9881c591', CAST(strftime('%s','now') AS INTEGER), 'conta administrativa');
