-- Recompensa temporária do teste: um passe VIP ao alcançar a patente 25.
--
-- O carimbo na assinatura torna a entrega única mesmo depois que o passe
-- expirar. A chave do recado faz a mensagem sobreviver a recarga e rede ruim
-- sem nunca ser criada duas vezes para a mesma conta.

ALTER TABLE assinaturas ADD COLUMN bonus_nivel_25_em INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recados ADD COLUMN chave TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recados_chave
  ON recados (usuario, chave)
  WHERE chave IS NOT NULL;
