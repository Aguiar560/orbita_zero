-- Passe de 30 dias para dois testadores, concedido à mão em 12/09/2026.
--
-- INGameGG (679be4af) e MaisUmJogosYT (66ca7e1d). O segundo é quem relatou o
-- defeito da porta do chefe travada, que rendeu a auditoria das quatro camadas;
-- o primeiro é a conta que mais jogou no período.
--
-- ## Por que o carimbo vai junto
--
-- `bonus_nivel_25_em` é o que diz "esta conta já recebeu". Sem ele, os dois
-- ganhariam OUTRO passe ao alcançar a patente 25 — e a decisão foi explícita:
-- o VIP deles é este, agora, e não se acrescenta depois. `bonus_dias = 30`
-- registra QUAL faixa saiu, que é o que a promoção precisa saber para contar as
-- vagas e para escolher a mensagem.
--
-- Eles passam, portanto, a ocupar 2 das 40 vagas. É coerente: a vaga existe
-- para limitar quantos passes a promoção distribui, e estes dois são passes
-- distribuídos.
--
-- ## Por que não somar sobre o que já existe
--
-- `MAX(expira_em, agora)` está lá por hábito e por segurança, mas nenhum dos
-- dois tem linha em `assinaturas` hoje — conferido antes de escrever. Se
-- tivessem, somar sobre o maior entre agora e a expiração é a mesma regra de
-- `renovar`: quem renova antes de vencer não perde o resto.
--
-- ## Aplicar duas vezes
--
-- A marca em `compensacoes` (criada na 0023) é o que torna a segunda aplicação
-- inofensiva: o `WHERE NOT EXISTS` faz o SELECT não devolver linha nenhuma, e
-- ninguém ganha 30 dias de novo.

INSERT INTO assinaturas (usuario, expira_em, bonus_nivel_25_em, bonus_dias)
SELECT u.usuario,
       MAX(COALESCE((SELECT expira_em FROM assinaturas a WHERE a.usuario = u.usuario), 0),
           CAST(strftime('%s','now') AS INTEGER)) + 30 * 86400,
       CAST(strftime('%s','now') AS INTEGER),
       30
  FROM (SELECT '679be4af-918f-4c72-8d9d-55ffbed4a53e' AS usuario
        UNION ALL SELECT '66ca7e1d-0260-4156-906b-d86bee6f1c86') AS u
 WHERE NOT EXISTS (SELECT 1 FROM compensacoes WHERE chave = 'vip_agradecimento_2026_09_12')
ON CONFLICT(usuario) DO UPDATE SET
  expira_em = excluded.expira_em,
  bonus_nivel_25_em = excluded.bonus_nivel_25_em,
  bonus_dias = excluded.bonus_dias;

-- O agradecimento. Texto pronto, em português, do jeito que aparece na tela —
-- a regra da migração 0018. A chave impede que ele nasça duas vezes.
INSERT OR IGNORE INTO recados (usuario, texto, criado_em, chave)
SELECT u.usuario,
       'Obrigado por testar o Órbita Zero! O seu tempo em jogo e o que você reporta são o que está deixando o jogo melhor — inclusive defeitos que ninguém teria achado sem alguém jogando de verdade. Um Passe VIP de 30 dias já está ativo na sua conta.',
       CAST(strftime('%s','now') AS INTEGER),
       'vip_agradecimento_2026_09_12'
  FROM (SELECT '679be4af-918f-4c72-8d9d-55ffbed4a53e' AS usuario
        UNION ALL SELECT '66ca7e1d-0260-4156-906b-d86bee6f1c86') AS u
 WHERE NOT EXISTS (SELECT 1 FROM compensacoes WHERE chave = 'vip_agradecimento_2026_09_12');

INSERT OR IGNORE INTO compensacoes (chave, em)
VALUES ('vip_agradecimento_2026_09_12', CAST(strftime('%s','now') AS INTEGER));
