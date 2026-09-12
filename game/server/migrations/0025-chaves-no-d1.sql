-- As chaves de acesso saem do save e viram estado do servidor.
--
-- ## Por que elas não podiam ficar onde estavam
--
-- Item, casco, moeda, material, XP, Matriz e setor alcançado são do D1 desde o
-- Passo 9, pela mesma razão: o save é um blob que o cliente escreve. A chave
-- ficou para trás e isso tinha uma consequência concreta — a de 12/09/2026: o
-- servidor não conseguia barrar a entrada no setor do chefe porque não sabia
-- quais chaves a conta tinha. A trava ficou sendo uma DECISÃO ("a ausência não
-- enfrenta chefe") em vez de uma VERIFICAÇÃO. Com a chave aqui, ela pode ser
-- verificação.
--
-- ## O `CHECK`, e por que ele não é zelo
--
-- Medido em 12/09 com `node:sqlite`: num `batch`, um `UPDATE` que casa zero
-- linhas NÃO é erro, e sem erro não há reversão. Então `WHERE quantia >= 1`
-- recusaria o gasto e deixaria o resto do lote passar — no caso da chave, o
-- jogador entraria no chefe sem pagar. Com `CHECK (quantia >= 0)`, gastar o
-- que não se tem vira ERRO, e erro o `batch` reverte inteiro.
--
-- ## A semeadura lê o save, e não o cliente
--
-- As chaves que os jogadores já têm estão dentro do blob `saves.estado`. Elas
-- são copiadas daqui, por SQL, e não pedidas ao cliente: pedir seria abrir, no
-- exato momento da migração, a porta que esta migração existe para fechar.
--
-- `MAX(quantia, excluded.quantia)` em vez de somar: aplicar duas vezes não pode
-- dobrar o estoque de ninguém.

CREATE TABLE IF NOT EXISTS chaves (
  usuario TEXT    NOT NULL,
  chave   TEXT    NOT NULL,
  quantia INTEGER NOT NULL DEFAULT 0 CHECK (quantia >= 0),
  PRIMARY KEY (usuario, chave)
);

-- Qual chefe a conta PAGOU para enfrentar agora.
--
-- Tabela própria, e não uma coluna em `progresso`: é estado de uma incursão em
-- curso, some quando ela termina, e `progresso` guarda o que só cresce. Juntar
-- os dois faria uma linha que nasceu monotônica passar a ser apagada.
CREATE TABLE IF NOT EXISTS acesso_ao_chefe (
  usuario TEXT PRIMARY KEY,
  boss    TEXT    NOT NULL,
  em      INTEGER NOT NULL
);

INSERT INTO chaves (usuario, chave, quantia)
SELECT s.usuario, j.key, CAST(j.value AS INTEGER)
  FROM saves s, json_each(json_extract(s.estado, '$.chavesAcesso')) j
 WHERE json_extract(s.estado, '$.chavesAcesso') IS NOT NULL
   AND CAST(j.value AS INTEGER) > 0
ON CONFLICT(usuario, chave) DO UPDATE SET quantia = MAX(quantia, excluded.quantia);
