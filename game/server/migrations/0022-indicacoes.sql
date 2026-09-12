-- Programa de indicações e fotografia mínima dos reembolsos.
--
-- Toda conta toma UMA decisão: vinculada a um indicador ou explicitamente sem
-- indicação. Guardar o segundo caso fecha a porta de uma conta antiga alegar
-- um código depois do lançamento.

CREATE TABLE IF NOT EXISTS codigos_indicacao (
  codigo    TEXT PRIMARY KEY,
  usuario   TEXT NOT NULL UNIQUE,
  criado_em INTEGER NOT NULL,
  ativo     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS decisoes_indicacao (
  usuario     TEXT PRIMARY KEY,
  estado      TEXT NOT NULL,
  indicador   TEXT,
  codigo      TEXT,
  decidida_em INTEGER NOT NULL,
  motivo      TEXT
);

CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador
  ON decisoes_indicacao (indicador, decidida_em);
CREATE INDEX IF NOT EXISTS idx_indicacoes_estado
  ON decisoes_indicacao (estado, decidida_em);

CREATE TABLE IF NOT EXISTS recompensas_indicacao (
  compra               TEXT PRIMARY KEY,
  pagamento            TEXT NOT NULL UNIQUE,
  indicador            TEXT NOT NULL,
  indicado              TEXT NOT NULL,
  base_centavos         INTEGER NOT NULL,
  percentual_bps        INTEGER NOT NULL,
  comissao_centavos     INTEGER NOT NULL,
  revertidos_centavos   INTEGER NOT NULL DEFAULT 0,
  liberados_centavos    INTEGER NOT NULL DEFAULT 0,
  estado                TEXT NOT NULL DEFAULT 'pendente',
  criada_em             INTEGER NOT NULL,
  liberar_em            INTEGER NOT NULL,
  liberada_em           INTEGER,
  revertida_em          INTEGER
);

CREATE INDEX IF NOT EXISTS idx_recompensas_indicacao_fila
  ON recompensas_indicacao (estado, liberar_em);
CREATE INDEX IF NOT EXISTS idx_recompensas_indicacao_dono
  ON recompensas_indicacao (indicador, criada_em);

-- Livro-caixa em centavos. Disponível e reservado nunca se misturam com a
-- carteira de cristais do jogo.
CREATE TABLE IF NOT EXISTS carteiras_indicacao (
  usuario              TEXT PRIMARY KEY,
  disponivel_centavos  INTEGER NOT NULL DEFAULT 0,
  reservado_centavos   INTEGER NOT NULL DEFAULT 0,
  divida_centavos      INTEGER NOT NULL DEFAULT 0,
  atualizado_em        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS movimentos_indicacao (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario            TEXT NOT NULL,
  tipo               TEXT NOT NULL,
  quantia_centavos   INTEGER NOT NULL,
  origem             TEXT NOT NULL,
  criado_em          INTEGER NOT NULL,
  UNIQUE (tipo, origem)
);

CREATE INDEX IF NOT EXISTS idx_movimentos_indicacao_usuario
  ON movimentos_indicacao (usuario, criado_em);

-- A transição pendente -> liberada é a única porta que põe dinheiro no saldo.
-- O gatilho calcula a compensação da dívida usando o saldo mais novo, mesmo se
-- duas compras vencerem no mesmo instante.
CREATE TRIGGER IF NOT EXISTS liberar_comissao_indicacao
AFTER UPDATE OF estado ON recompensas_indicacao
WHEN OLD.estado = 'pendente' AND NEW.estado = 'liberada'
BEGIN
  UPDATE recompensas_indicacao
     SET liberados_centavos = MAX(0,
       NEW.comissao_centavos - NEW.revertidos_centavos
       - COALESCE((SELECT divida_centavos FROM carteiras_indicacao WHERE usuario = NEW.indicador), 0))
   WHERE compra = NEW.compra;
  UPDATE carteiras_indicacao
     SET disponivel_centavos = disponivel_centavos + (
           SELECT liberados_centavos FROM recompensas_indicacao WHERE compra = NEW.compra
         ),
         divida_centavos = MAX(0, divida_centavos - (NEW.comissao_centavos - NEW.revertidos_centavos)),
         atualizado_em = NEW.liberada_em
   WHERE usuario = NEW.indicador;
  INSERT OR IGNORE INTO movimentos_indicacao
    (usuario, tipo, quantia_centavos, origem, criado_em)
  SELECT NEW.indicador, 'comissao_liberada', liberados_centavos, NEW.pagamento, NEW.liberada_em
    FROM recompensas_indicacao WHERE compra = NEW.compra AND liberados_centavos > 0;
END;

-- Reembolso posterior à liberação retira primeiro o que ainda está disponível;
-- o restante vira dívida a compensar antes de novas liberações.
CREATE TRIGGER IF NOT EXISTS reverter_comissao_liberada
AFTER UPDATE OF revertidos_centavos ON recompensas_indicacao
WHEN OLD.estado = 'liberada' AND NEW.revertidos_centavos > OLD.revertidos_centavos
BEGIN
  UPDATE carteiras_indicacao
     SET disponivel_centavos = MAX(0, disponivel_centavos - (NEW.revertidos_centavos - OLD.revertidos_centavos)),
         divida_centavos = divida_centavos + MAX(0,
           (NEW.revertidos_centavos - OLD.revertidos_centavos) - disponivel_centavos),
         atualizado_em = NEW.revertida_em
   WHERE usuario = NEW.indicador;
  INSERT OR IGNORE INTO movimentos_indicacao
    (usuario, tipo, quantia_centavos, origem, criado_em)
  VALUES (NEW.indicador, 'comissao_estornada',
          -(NEW.revertidos_centavos - OLD.revertidos_centavos),
          NEW.pagamento || ':' || NEW.revertidos_centavos, NEW.revertida_em);
END;

-- A chave Pix é cifrada no Worker; banco, logs e resposta pública guardam só
-- a forma mascarada. O tipo segue CPF/CNPJ, telefone, e-mail ou EVP.
CREATE TABLE IF NOT EXISTS dados_pix_indicacao (
  usuario             TEXT PRIMARY KEY,
  tipo                TEXT NOT NULL,
  chave_cifrada       TEXT NOT NULL,
  chave_mascarada     TEXT NOT NULL,
  atualizado_em       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saques_indicacao (
  id                          TEXT PRIMARY KEY,
  usuario                     TEXT NOT NULL,
  centavos                    INTEGER NOT NULL,
  tipo_pix                    TEXT NOT NULL,
  chave_pix_cifrada           TEXT NOT NULL,
  chave_pix_mascarada         TEXT NOT NULL,
  janela_semana               TEXT NOT NULL,
  estado                      TEXT NOT NULL DEFAULT 'solicitado',
  solicitado_em               INTEGER NOT NULL,
  revisado_em                 INTEGER,
  revisado_por                TEXT,
  pago_em                     INTEGER,
  referencia_pagamento        TEXT,
  motivo                      TEXT,
  UNIQUE (usuario, janela_semana)
);

CREATE INDEX IF NOT EXISTS idx_saques_indicacao_fila
  ON saques_indicacao (estado, solicitado_em);
CREATE INDEX IF NOT EXISTS idx_saques_indicacao_usuario
  ON saques_indicacao (usuario, solicitado_em);

CREATE TRIGGER IF NOT EXISTS conferir_saldo_antes_do_saque
BEFORE INSERT ON saques_indicacao
BEGIN
  SELECT CASE WHEN NEW.centavos < 1500
    THEN RAISE(ABORT, 'saque_abaixo_do_minimo') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM saques_indicacao
     WHERE usuario = NEW.usuario
       AND solicitado_em > NEW.solicitado_em - 604800
  ) THEN RAISE(ABORT, 'saque_semanal') END;
  SELECT CASE WHEN COALESCE((
    SELECT disponivel_centavos FROM carteiras_indicacao WHERE usuario = NEW.usuario
  ), 0) < NEW.centavos THEN RAISE(ABORT, 'saldo_insuficiente') END;
END;

CREATE TRIGGER IF NOT EXISTS reservar_saldo_apos_saque
AFTER INSERT ON saques_indicacao
BEGIN
  UPDATE carteiras_indicacao
     SET disponivel_centavos = disponivel_centavos - NEW.centavos,
         reservado_centavos = reservado_centavos + NEW.centavos,
         atualizado_em = NEW.solicitado_em
   WHERE usuario = NEW.usuario;
END;

CREATE TRIGGER IF NOT EXISTS baixar_reserva_apos_pix_pago
AFTER UPDATE OF estado ON saques_indicacao
WHEN OLD.estado IN ('solicitado', 'analise') AND NEW.estado = 'pago'
BEGIN
  UPDATE carteiras_indicacao
     SET reservado_centavos = MAX(0, reservado_centavos - NEW.centavos),
         atualizado_em = NEW.pago_em
   WHERE usuario = NEW.usuario;
END;

CREATE TRIGGER IF NOT EXISTS devolver_reserva_apos_saque_recusado
AFTER UPDATE OF estado ON saques_indicacao
WHEN OLD.estado IN ('solicitado', 'analise') AND NEW.estado = 'recusado'
BEGIN
  UPDATE carteiras_indicacao
     SET reservado_centavos = MAX(0, reservado_centavos - NEW.centavos),
         disponivel_centavos = disponivel_centavos + MAX(0, NEW.centavos - divida_centavos),
         divida_centavos = MAX(0, divida_centavos - NEW.centavos),
         atualizado_em = NEW.revisado_em
   WHERE usuario = NEW.usuario;
END;

-- Um marco nasce apenas uma vez. Os cristais daqui são prêmio de progressão,
-- e não a moeda da comissão financeira.
CREATE TABLE IF NOT EXISTS marcos_indicacao (
  indicador    TEXT NOT NULL,
  jogadores    INTEGER NOT NULL,
  cristais     INTEGER NOT NULL,
  criado_em    INTEGER NOT NULL,
  PRIMARY KEY (indicador, jogadores)
);

CREATE TABLE IF NOT EXISTS acoes_indicacao_admin (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  admin     TEXT NOT NULL,
  codigo    TEXT NOT NULL,
  acao      TEXT NOT NULL,
  motivo    TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acoes_indicacao_admin_codigo
  ON acoes_indicacao_admin (codigo, criado_em);

ALTER TABLE compras ADD COLUMN centavos_reembolsados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compras ADD COLUMN reembolsada_em INTEGER;

-- Primeiro, garantir que toda identidade que já tocou o servidor exista em
-- `contas`. A união é deliberadamente larga: alguém sem save ainda pode ter
-- comprado, escolhido apelido ou aberto uma sessão.
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM saves;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM apelidos;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM marcas;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM transacoes;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM saldos;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM compras;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM assinaturas;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM progresso;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM frota;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM itens;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM missoes;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM sessoes_ativas;
INSERT OR IGNORE INTO contas SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) FROM contas_teste;

-- Quem já existia no lançamento não pode ser atribuído retroativamente.
INSERT OR IGNORE INTO decisoes_indicacao
  (usuario, estado, indicador, codigo, decidida_em, motivo)
SELECT usuario, 'sem_indicacao', NULL, NULL,
       CAST(strftime('%s', 'now') AS INTEGER), 'preexistente'
  FROM contas;
