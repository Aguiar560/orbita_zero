-- A recompensa do período de teste passa a ter VAGAS e DUAS faixas.
--
-- Regra de 12/09/2026: as primeiras 40 contas a alcançar a patente 25 ganham
-- passe — as 10 primeiras com 30 dias, as 30 seguintes com 7. Antes disto a
-- recompensa era 30 dias para quem chegasse, sem teto.
--
-- ## O que a coluna guarda, e por que ela não é dedutível
--
-- `bonus_nivel_25_em` responde "esta conta ocupa uma vaga?". Ela não responde
-- "quanto ganhou" — e a partir de agora as duas perguntas têm respostas
-- diferentes, porque há duas faixas e porque existe quem ocupe vaga sem ter
-- ganhado nada (ver abaixo). Deduzir a faixa pela ordem do carimbo seria
-- reconstruir a promoção a cada leitura, e erraria no dia em que o teto mudar.
--
-- ## Quem já tinha passe ocupa vaga
--
-- Pedido explícito: as 40 contam a partir de hoje, incluindo quem já é VIP. As
-- contas com passe ativo neste instante recebem o carimbo e `bonus_dias = 0` —
-- ocupam vaga, não ganham nada de novo e não recebem mensagem nenhuma, porque
-- não teriam o que agradecer.
--
-- Medido antes de escrever: 3 linhas em `assinaturas`, as 3 com passe ativo, e
-- só 1 delas com o bônus de nível 25. Então este arquivo marca 2 contas novas e
-- deixa 7 vagas na faixa de 30 dias.
--
-- ## Aplicar duas vezes
--
-- O `ALTER TABLE` falha na segunda vez (coluna duplicada) e derruba o arquivo
-- inteiro junto, então nada abaixo dele roda de novo. É o que impede a segunda
-- aplicação de carimbar — e consumir a vaga de — quem comprar um passe depois
-- de hoje.

ALTER TABLE assinaturas ADD COLUMN bonus_dias INTEGER NOT NULL DEFAULT 0;

-- Quem já recebeu o bônus recebeu 30 dias, que era a regra da época.
UPDATE assinaturas SET bonus_dias = 30 WHERE bonus_nivel_25_em > 0;

-- E quem já tinha passe entra na conta das 40, sem receber nada de novo.
UPDATE assinaturas
   SET bonus_nivel_25_em = CAST(strftime('%s','now') AS INTEGER)
 WHERE bonus_nivel_25_em = 0
   AND expira_em > CAST(strftime('%s','now') AS INTEGER);
