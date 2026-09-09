-- Até onde cada linha do livro já foi AVISADA.
--
-- ## Por que uma coluna, e não uma marca de tempo do último aviso
--
-- O gatilho de tempo roda a cada cinco minutos e as linhas de `recusas` são
-- baldes de UMA HORA. Um relógio de "avisei até tal instante" reavisaria a
-- mesma linha doze vezes, porque ela continua dentro da janela enquanto a hora
-- não vira — e um canal que repete o mesmo aviso doze vezes deixa de ser lido.
--
-- Guardar o CONTADOR já avisado resolve exatamente: o aviso é sobre
-- `n - avisado`, e o que já foi contado nunca volta.
--
-- ## E por que ela só sobe DEPOIS do envio confirmado
--
-- É a disciplina da fila da carteira: só se apaga o que se confirmou ter
-- entregado. Um aviso perdido por rede fora reaparece no ciclo seguinte em vez
-- de sumir com a marca de "já avisei" — e sumir seria o pior dos dois mundos,
-- porque o defeito continua lá e ninguém mais vai ser avisado dele.
--
-- ## Zero é o certo para as linhas que já existem
--
-- Elas nascem "não avisadas", então o primeiro ciclo depois deste deploy conta
-- o que o livro já tinha juntado. É uma mensagem a mais, uma vez só, com o
-- histórico que ninguém tinha visto — exatamente o que se quer.

ALTER TABLE recusas ADD COLUMN avisado INTEGER NOT NULL DEFAULT 0;

-- A varredura do gatilho é sempre "o que falta avisar", nunca a tabela toda.
CREATE INDEX IF NOT EXISTS idx_recusas_pendente ON recusas (hora) WHERE n > avisado;
