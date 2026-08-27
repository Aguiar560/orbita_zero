-- Ordenação por VERSÃO do servidor, e balde de fichas por jogador.
--
-- ## Por que versão e não carimbo de tempo
--
-- A ordenação anterior comparava `savedAt`, que é o relógio do PC do jogador.
-- Dois computadores com relógios diferentes decidem errado, e um relógio
-- adiantado ganha SEMPRE — inclusive contra progresso mais novo. Não é um caso
-- exótico: máquina sem NTP, fuso trocado, VM que dormiu.
--
-- `versao_servidor` é atribuída aqui, num relógio só, e cresce de um em um.
-- Quem grava manda a versão que conhecia; se não for a atual, houve escrita de
-- outro dispositivo no meio e o cliente precisa reconciliar antes.
ALTER TABLE saves ADD COLUMN versao_servidor INTEGER NOT NULL DEFAULT 0;

-- O balde de fichas. Ver `src/ritmo.ts` para a conta.
ALTER TABLE saves ADD COLUMN fichas REAL NOT NULL DEFAULT 3;
ALTER TABLE saves ADD COLUMN fichas_em INTEGER NOT NULL DEFAULT 0;
