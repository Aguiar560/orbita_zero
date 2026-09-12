-- Devolve 350 de ferrita a todo mundo, pelo material que o desmanche perdeu.
--
-- ## O que aconteceu
--
-- O Armazém virou espelho do servidor na Fase 4, mas o caminho de volta nunca
-- foi ligado: `drenarProgresso` mandava `materiais: {}` em toda drenagem, e a
-- resposta seguinte escrevia o armazém do servidor por cima do que o jogador
-- tinha acabado de desmanchar. A única rota que gravava material era
-- `/ausencia`. Medido em 12/09/2026: doze linhas em `materiais` no jogo
-- inteiro, quase todas `ferrita`.
--
-- O defeito foi corrigido no cliente no mesmo dia. Esta migração é a
-- reparação: ninguém consegue reconstruir quanto cada um perdeu — o ganho
-- nunca chegou a existir fora da memória de uma aba —, então a devolução é
-- igual para todos.
--
-- ## Por que 350
--
-- Escolha do Rafael. É da ordem do que um jogador acumula em algumas horas de
-- desmanche, e ferrita é o material de desmanche mais comum.
--
-- ## Por que isto pode rodar duas vezes sem dobrar
--
-- `d1_migrations` NÃO registra o que sobe por `--file=`, então uma migração
-- aplicada à mão pode ser aplicada de novo por engano meses depois. A marca em
-- `compensacoes` é o que torna a segunda vez inofensiva: o `WHERE NOT EXISTS`
-- faz o SELECT devolver zero linhas, e nada é creditado.

CREATE TABLE IF NOT EXISTS compensacoes (
  chave TEXT    PRIMARY KEY,
  em    INTEGER NOT NULL
);

-- Todo mundo que o servidor conhece, e não só quem tem save: uma conta pode ter
-- progresso, item ou linha em `contas` sem ter subido save ainda.
INSERT INTO materiais (usuario, material, quantia)
SELECT u.usuario, 'ferrita', 350
  FROM (SELECT usuario FROM saves
        UNION SELECT usuario FROM progresso
        UNION SELECT usuario FROM contas
        UNION SELECT usuario FROM itens) AS u
 WHERE NOT EXISTS (SELECT 1 FROM compensacoes WHERE chave = 'ferrita_350_desmanche_perdido')
ON CONFLICT(usuario, material) DO UPDATE SET quantia = quantia + 350;

INSERT OR IGNORE INTO compensacoes (chave, em)
VALUES ('ferrita_350_desmanche_perdido', strftime('%s','now'));
