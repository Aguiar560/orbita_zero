-- Banco social separado. Não executar no banco econômico do jogo.
CREATE TABLE IF NOT EXISTS chat_perfis (
  usuario TEXT PRIMARY KEY, apelido TEXT NOT NULL, normal TEXT NOT NULL,
  privadas INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS chat_perfis_nome ON chat_perfis(normal);
CREATE TABLE IF NOT EXISTS chat_conversas (
  id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, iniciador TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendente','aceita','recusada')),
  criado INTEGER NOT NULL, ultima INTEGER NOT NULL DEFAULT 0, UNIQUE(a,b)
);
CREATE INDEX IF NOT EXISTS chat_conversas_a ON chat_conversas(a,ultima);
CREATE INDEX IF NOT EXISTS chat_conversas_b ON chat_conversas(b,ultima);
CREATE TABLE IF NOT EXISTS chat_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, conversa TEXT NOT NULL, autor TEXT NOT NULL,
  apelido TEXT NOT NULL, texto TEXT NOT NULL, criado INTEGER NOT NULL,
  clienteId TEXT NOT NULL, removida INTEGER NOT NULL DEFAULT 0, UNIQUE(autor,clienteId)
);
CREATE INDEX IF NOT EXISTS chat_mensagens_conversa ON chat_mensagens(conversa,id);
CREATE INDEX IF NOT EXISTS chat_mensagens_criado ON chat_mensagens(criado);
CREATE TABLE IF NOT EXISTS chat_leituras (
  usuario TEXT NOT NULL, conversa TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(usuario,conversa)
);
CREATE TABLE IF NOT EXISTS chat_bloqueios (
  usuario TEXT NOT NULL, alvo TEXT NOT NULL, PRIMARY KEY(usuario,alvo)
);
CREATE INDEX IF NOT EXISTS chat_bloqueios_alvo ON chat_bloqueios(alvo,usuario);
CREATE TABLE IF NOT EXISTS chat_denuncias (
  id TEXT PRIMARY KEY, denunciante TEXT NOT NULL, mensagem INTEGER NOT NULL,
  motivo TEXT NOT NULL, evidencia TEXT NOT NULL, criado INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'aberta', UNIQUE(denunciante,mensagem)
);
CREATE INDEX IF NOT EXISTS chat_denuncias_estado ON chat_denuncias(estado,criado);
CREATE TABLE IF NOT EXISTS chat_sancoes (
  usuario TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK(tipo IN ('silencio','banimento')),
  ate INTEGER NOT NULL, motivo TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT, moderador TEXT NOT NULL,
  acao TEXT NOT NULL, alvo TEXT NOT NULL, motivo TEXT NOT NULL, criado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_entregas (
  mensagem INTEGER PRIMARY KEY
);
