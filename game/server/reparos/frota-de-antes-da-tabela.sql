-- Reparo: a frota de quem já jogava antes de a tabela `frota` existir.
--
-- ## O sintoma
--
-- A lista de naves aparece VAZIA, e nada do que estava equipado é mostrado —
-- num save com progresso, inventário cheio e setor avançado. A Anatomia desenha
-- uma nave, mas o seletor não tem nenhuma opção.
--
-- ## A causa
--
-- A migração `0009-frota.sql` criou a tabela e passou a ser a autoridade sobre
-- quais cascos o jogador tem. Ela nasceu VAZIA para todo mundo, e o passo que
-- deveria semear as contas existentes nunca rodou — o próprio comentário da
-- coluna `origem` já previa esse valor, `semente`, "migração do save antigo".
--
-- Do lado do cliente, `sincronizarFrota` escreve o que o servidor responde por
-- cima de `state.fleet`. Para essas contas o servidor respondia `[]`, e a frota
-- local era apagada. Pior: o save com a lista já zerada subiu para a nuvem, e
-- com ele se perdeu a única cópia do que a pessoa tinha. Hoje TODOS os saves
-- têm `fleet: []`.
--
-- ## De onde a prova vem agora, e o que ela vale
--
-- De `naves_progresso`: um casco com XP acumulado foi pilotado, e não há como
-- pilotar o que não se tem. É a melhor evidência que sobrou depois de os saves
-- serem zerados.
--
-- Ela NÃO é prova de compra — `naves_progresso` é escrita a partir de deltas
-- que o cliente envia. Por isso este arquivo é um reparo pontual, para contas
-- que já existiam, e não uma regra permanente: daqui para a frente só entram
-- em `frota` cascos concedidos pela escolha de piloto ou pagos em cristal.
--
-- `origem = 'semente'` deixa isso registrado linha a linha. Quando a auditoria
-- do pódio perguntar "de onde saiu esta nave", a resposta existe e é honesta.
--
-- ## Como rodar
--
--     cd D:\bbb\game\server
--     npx wrangler d1 execute orbita-zero --remote --file reparos/frota-de-antes-da-tabela.sql
--
-- É seguro repetir: `INSERT OR IGNORE` com a chave primária `(usuario, casco)`
-- não duplica nada, e o `NOT EXISTS` protege quem já tem frota montada — quem
-- recebeu o casco pela escolha de piloto não ganha os outros de brinde.

INSERT OR IGNORE INTO frota (usuario, casco, origem, em)
SELECT n.usuario, n.casco, 'semente', CAST(strftime('%s', 'now') AS INTEGER)
FROM naves_progresso n
WHERE NOT EXISTS (SELECT 1 FROM frota f WHERE f.usuario = n.usuario);
