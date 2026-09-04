-- A progressão sai do save: XP, Matriz, setor alcançado e materiais.
--
-- ## O que sobrou depois da Fase 3
--
-- Item, casco, moeda e passe já eram do servidor. Faltava o que MULTIPLICA
-- tudo isso: nível de piloto e de nave (atributos-base), os nós da Matriz
-- (modificadores diretos) e o setor alcançado (que libera conteúdo e cascos).
-- Um save com `command.nivel = 300` e a Matriz cheia valia mais que qualquer
-- item Divino injetado.
--
-- ## O nível NÃO é guardado. É derivado do XP.
--
-- Guardar os dois é guardar a mesma informação duas vezes, e duas cópias de um
-- número divergem — normalmente numa migração, silenciosamente, e o sintoma
-- aparece meses depois como "meu nível voltou". Com só o XP, `curvaXpPersonagem`
-- responde o nível sempre igual, e não existe estado inconsistente possível.
--
-- ## Por que `matriz` é JSON e não uma tabela de nós
--
-- A alocação é lida INTEIRA ou não é lida: para saber se ela é válida é preciso
-- somar o custo de todos os nós e conferir a conexão de cada um até a raiz.
-- Nunca se pergunta "este jogador tem o nó X" isoladamente. Uma tabela daria
-- uma linha por nó — dezenas por jogador — para responder uma pergunta que
-- ninguém faz.

CREATE TABLE IF NOT EXISTS progresso (
  usuario      TEXT PRIMARY KEY,
  -- XP do piloto, acumulado. REAL porque a morte cobra 15% e a fração importa:
  -- arredondar a cada morte faria o jogador perder mais do que a regra diz.
  xp           REAL    NOT NULL DEFAULT 0,
  -- O maior setor já alcançado. Monotônico: só sobe.
  --
  -- É ele que libera casco e conteúdo, então uma queda por save antigo ou por
  -- corrida ruim tiraria acesso que o jogador já conquistou.
  melhor_setor INTEGER NOT NULL DEFAULT 1,
  -- Os nós alocados, como vetor JSON de ids.
  matriz       TEXT    NOT NULL DEFAULT '[]',
  atualizado_em INTEGER NOT NULL
);

-- XP por nave. O nível sai da curva, pelo mesmo motivo do piloto.
CREATE TABLE IF NOT EXISTS naves_progresso (
  usuario TEXT NOT NULL,
  casco   TEXT NOT NULL,
  xp      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario, casco)
);

-- Materiais de fabricação.
--
-- Separados do livro-caixa de propósito: material não é moeda. Não se compra
-- nada com ferrita, não há preço em ferrita, e não existe estorno de ferrita —
-- as três coisas que fazem o livro-caixa valer a complexidade dele. O que
-- material precisa é de um saldo que o cliente não escreva, e isto basta.
CREATE TABLE IF NOT EXISTS materiais (
  usuario  TEXT NOT NULL,
  material TEXT NOT NULL,
  quantia  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario, material)
);
