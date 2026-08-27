-- Esquema do D1.
--
-- Uma tabela só por enquanto, e de propósito: o placar não entra antes de a
-- validação de plausibilidade existir. Um placar que aceita o que o cliente
-- relata é decoração, e publicá-lo cedo ensina o jogo errado a quem chega.

CREATE TABLE IF NOT EXISTS saves (
  -- `sub` do token do Supabase. É a única identidade que este servidor conhece:
  -- e-mail e senha ficam do lado do Supabase, e nunca chegam aqui.
  usuario       TEXT PRIMARY KEY,
  estado        TEXT NOT NULL,
  versao        INTEGER NOT NULL,
  -- Epoch em SEGUNDOS. O intervalo mínimo entre gravações é medido com ele, e
  -- é ele que faz a conta da camada gratuita fechar.
  atualizado_em INTEGER NOT NULL
);

-- Para varrer saves antigos sem ler a coluna `estado`, que é a pesada.
CREATE INDEX IF NOT EXISTS idx_saves_atualizado ON saves (atualizado_em);

-- ── placar ─────────────────────────────────────────────────────────────────
--
-- Separado da tabela `saves` de propósito. O save é um blob opaco que só o dono
-- lê; a marca é um número público que TODO MUNDO lê, e consultar o placar não
-- pode arrastar o estado inteiro de nenhum jogador.

-- O nome público do jogador. Um por conta.
--
-- `apelido_normal` é a forma comparável (minúsculas, sem espaço duplo): a
-- unicidade é sobre ELA e não sobre o texto exibido, senão "Vektor" e "vektor"
-- coexistiriam e o placar viraria uma lista de quase-homônimos.
CREATE TABLE IF NOT EXISTS apelidos (
  usuario        TEXT PRIMARY KEY,
  apelido        TEXT NOT NULL,
  apelido_normal TEXT NOT NULL UNIQUE,
  criado_em      INTEGER NOT NULL
);

-- A marca de cada jogador em cada placar.
--
-- Chave composta porque o placar de NAVES é por casco: o mesmo jogador tem uma
-- marca por nave. Nos outros placares `casco` é string vazia.
CREATE TABLE IF NOT EXISTS marcas (
  usuario       TEXT NOT NULL,
  placar        TEXT NOT NULL,
  casco         TEXT NOT NULL DEFAULT '',
  valor         INTEGER NOT NULL,
  desempate     INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL,
  PRIMARY KEY (usuario, placar, casco)
);

-- O placar é sempre "os melhores DESTE placar", então o índice é por placar e
-- valor. Sem ele, montar um top 50 seria varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_marcas_placar ON marcas (placar, valor DESC, desempate DESC);
