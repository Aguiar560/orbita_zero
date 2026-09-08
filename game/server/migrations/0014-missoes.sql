-- Missões no servidor — fatia 1 do `docs/PLANO-MISSOES-NO-SERVIDOR.md`.
--
-- ## Os dois defeitos que isto fecha
--
-- 1. **Fraude.** `resgatarMissao` roda inteiro no cliente: confere `situacaoDe`
--    contra `state.missoes` — que é save, escrito pelo cliente — e paga com
--    `grant()`. Marcar uma missão como pronta no save faz o servidor pagar.
-- 2. **Divergência entre aparelhos.** `missoes` viajava dentro do bloco do
--    save, e a reconciliação escolhe UM bloco por maior `playtime`. Duas
--    máquinas em paralelo terminavam com o de uma delas.
--
-- ## A confiança NÃO tem coluna, e é de propósito
--
-- Ela é função pura das entregas: no cliente é `min(MAX, atual +
-- confiancaDaMissao(def))`, concedida uma vez por entrega, e
-- `confiancaDaMissao` é tabela. Somar sobre o que foi entregue devolve o mesmo
-- número. Guardá-la seria guardar a mesma informação duas vezes — o argumento
-- que `progresso.ts` já usa para o nível não ter coluna.
--
-- ## As regras de mescla são o coração disto
--
-- | campo | regra | por quê |
-- |---|---|---|
-- | `passos` | MAX elemento a elemento | contador de progresso só sobe |
-- | `iniciada` | OU | aceitar em qualquer aparelho vale |
-- | `entregue_em` | o primeiro vence | entrega é irreversível |
--
-- Todas monotônicas. É isso que faz o multi-dispositivo funcionar SEM código de
-- mescla: duas máquinas em paralelo somam, como `melhor_setor` já faz. Não há
-- "última escrita vence" em lugar nenhum — o defeito que a Matriz e o casco em
-- campo já tiveram, cada um do seu jeito.
--
-- ## A migração dos saves atuais
--
-- Não há backfill: o servidor nunca soube das missões. O cliente semeia o
-- `state.missoes` inteiro uma vez, e a mescla cuida do resto. É seguro por ser
-- idempotente — semear duas vezes dá o mesmo que semear uma, e há teste disso.

CREATE TABLE IF NOT EXISTS missoes (
  usuario     TEXT NOT NULL,
  missao      TEXT NOT NULL,
  -- Contadores por objetivo, como vetor JSON. É a forma que `state.missoes` já
  -- usa, e mantê-la evita uma conversão que só existiria para ser esquecida.
  passos      TEXT NOT NULL DEFAULT '[]',
  iniciada    INTEGER NOT NULL DEFAULT 0,
  -- NULL = não entregue. Gravado UMA vez; nunca volta a NULL.
  entregue_em INTEGER,
  PRIMARY KEY (usuario, missao)
);

-- A pergunta da tela é sempre "as missões DESTE jogador", nunca "quem entregou
-- a missão X". Sem o índice, cada boot varre a tabela inteira — barato hoje,
-- caro exatamente no dia em que ela deixar de ser pequena.
CREATE INDEX IF NOT EXISTS idx_missoes_usuario ON missoes (usuario);
