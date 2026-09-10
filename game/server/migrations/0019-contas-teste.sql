-- Contas operacionais usadas para testar o jogo sem contaminar os placares.
--
-- A marca vive no servidor e usa o UUID autenticado. Apelido e e-mail podem
-- mudar; a conta continua fora de todo ranking enquanto esta linha existir.
CREATE TABLE IF NOT EXISTS contas_teste (
  usuario   TEXT PRIMARY KEY,
  criado_em INTEGER NOT NULL,
  motivo    TEXT NOT NULL DEFAULT 'teste_manual'
);
