-- Desde quando o servidor conhece cada conta.
--
-- ## Para que serve
--
-- É o orçamento de progresso. Uma conta de dez minutos não pode ter chegado ao
-- andar 100 da Provação, e essa é uma afirmação que o servidor faz sozinho, com
-- o PRÓPRIO relógio, sem entender o formato do save e sem conhecer as tabelas
-- de balanceamento do jogo.
--
-- Era o buraco documentado na conferência de marcas: a primeira marca de uma
-- conta não tem histórico contra o que ser comparada, então passava qualquer
-- valor dentro do teto. Agora o histórico existe — e é a idade da conta.
--
-- ## Por que não `saves.criado_em`
--
-- Porque nem todo jogador com marca tem save (dá para sincronizar o placar sem
-- nunca ter subido o save), e porque o campo precisa nascer na PRIMEIRA
-- requisição autenticada, não na primeira gravação.
CREATE TABLE IF NOT EXISTS contas (
  usuario    TEXT PRIMARY KEY,
  -- Epoch em SEGUNDOS, do relógio do servidor. Nunca vem do cliente: se viesse,
  -- bastaria mentir aqui para desbloquear qualquer progresso.
  primeiro_em INTEGER NOT NULL
);

-- Quem JÁ existia é apadrinhado, com data recuada.
--
-- O servidor não tem como saber há quanto tempo estas contas existem: ele só
-- começou a registrar agora. Semear com o carimbo do último save seria pior que
-- não semear — `atualizado_em` é a gravação MAIS RECENTE, então toda conta
-- pareceria ter minutos de vida e teria a própria marca recusada.
--
-- Medido antes de aplicar: a conta existente tinha save de 94 segundos atrás e
-- marca de galáxia 201. Com a semente errada, o orçamento dela seria ~61 e a
-- próxima sincronização passaria a ser rejeitada em silêncio.
--
-- O apadrinhamento acontece AQUI, na migração, e não no código: no código ele
-- viraria brecha — bastaria gravar um save antes de mandar a primeira marca
-- para ganhar noventa dias de crédito.
-- `INSERT OR IGNORE` e nao `ON CONFLICT`: com origem em SELECT, o SQLite nao
-- consegue separar o alvo do conflito da clausula do SELECT e recusa a sintaxe.
INSERT OR IGNORE INTO contas (usuario, primeiro_em)
  SELECT usuario, CAST(strftime('%s', 'now') AS INTEGER) - 7776000 FROM saves;

INSERT OR IGNORE INTO contas (usuario, primeiro_em)
  SELECT DISTINCT usuario, CAST(strftime('%s', 'now') AS INTEGER) - 7776000 FROM marcas;

-- Corrige quem foi semeado errado antes desta migração ficar pronta.
--
-- O Worker chegou a rodar com a semente antiga e gravou uma conta como tendo
-- segundos de vida — o suficiente para a marca dela passar a ser recusada. Esta
-- linha recua qualquer conta que JÁ TENHA MARCA, que é a definição de "existia
-- antes de o servidor começar a contar".
--
-- Idempotente pelo `MIN`: rodar de novo não recua mais ninguém, e não afeta
-- conta criada depois, que não tem marca no momento em que nasce.
UPDATE contas
   SET primeiro_em = MIN(primeiro_em, CAST(strftime('%s', 'now') AS INTEGER) - 7776000)
 WHERE usuario IN (SELECT DISTINCT usuario FROM marcas);
