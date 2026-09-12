-- Uma conta só pode manter um jogo ativo por vez.
-- A instância identifica a aba/dispositivo sem guardar navegador, IP ou outro
-- dado pessoal. O pulso distingue uma sessão aberta de registro abandonado.

CREATE TABLE IF NOT EXISTS sessoes_ativas (
  usuario      TEXT PRIMARY KEY,
  instancia    TEXT NOT NULL,
  iniciada_em  INTEGER NOT NULL,
  atividade_em INTEGER NOT NULL
);
