-- Onde o ganho declarado passou do que é fisicamente possível.
--
-- ## Esta tabela NÃO recusa nada
--
-- Ela é a Fase 5, passo 4, na forma que o PLANO deixou escrita: *medir antes de
-- impedir*. Duas tentativas de recusar por fórmula já foram medidas e falharam
-- — a pior delas recusaria todo jogador novo no setor 1, em silêncio, porque o
-- teto proposto ficava TRÊS VEZES abaixo do ganho honesto ali.
--
-- Então o servidor registra e deixa passar. Quando houver dados de jogadores
-- reais, a decisão de ligar a recusa vem deles. Um teto que nunca disparou em
-- produção pode ser ligado com confiança.
--
-- ## Por que ela não custa cota
--
-- Só o excedente entra, e o teto tem margem de 10× (ver `teto.ts`: a folga
-- honesta medida chega a 9,9×). Quem joga normal não gera uma linha sequer.
-- Numa base saudável esta tabela fica VAZIA — e ficar vazia é o resultado
-- esperado, não um sinal de que o registro quebrou.
--
-- ## Por que não há chave estrangeira para `transacoes`
--
-- O lançamento entra de qualquer forma: o registro não pode alterar o caminho
-- do dinheiro, nem falhar junto com ele. Amarrar as duas tabelas transformaria
-- um erro de auditoria em erro de pagamento, que é o oposto da intenção.

CREATE TABLE IF NOT EXISTS excedentes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario   TEXT    NOT NULL,
  em        INTEGER NOT NULL,
  moeda     TEXT    NOT NULL,
  motivo    TEXT    NOT NULL,
  -- O declarado, o teto que ele passou, e quantas vezes o teto FÍSICO ele é.
  -- `folga` é o número que se lê: 1,2 é ruído de borda; 40 é outra coisa.
  quantia   REAL    NOT NULL,
  teto      REAL    NOT NULL,
  folga     REAL    NOT NULL,
  -- O contexto sem o qual o número não significa nada: o teto depende do setor,
  -- e a janela diz sobre quanto tempo o ganho foi declarado.
  setor     INTEGER NOT NULL,
  segundos  REAL    NOT NULL
);

-- Por jogador e por tempo: as duas perguntas da auditoria são "quem" e "quando
-- começou". Sem o índice, varrer a tabela é barato hoje (ela é vazia) e caro
-- exatamente no dia em que ela deixar de ser.
CREATE INDEX IF NOT EXISTS idx_excedentes_usuario ON excedentes (usuario, em);
