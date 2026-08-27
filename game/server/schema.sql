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
