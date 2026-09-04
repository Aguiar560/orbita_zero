-- O lote de itens que o servidor rolou para o setor em curso.
--
-- ## O problema que isto resolve
--
-- `rollItem` rodava no cliente, com o RNG do cliente. Quem abre o console rola
-- até sair Divino — e nenhuma proteção posterior recupera isso, porque o item
-- ruim nunca chegou a existir para ser comparado com nada.
--
-- ## Por que um LOTE, e não um item por vez
--
-- Medido em 03/09: **186 itens por hora** em jogo normal. Uma ida ao servidor
-- por item seria uma requisição a cada vinte segundos, para sempre, por
-- jogador. Um lote por setor concluído é uma a cada três minutos — o mesmo
-- ritmo que a carteira já usa, porque é o mesmo evento: o setor caiu.
--
-- ## Por que a semente fica GUARDADA, e não derivada
--
-- A tentação é derivar a semente de `(usuario, setor)` com um hash. Não serve:
-- o cliente conhece os dois, então prevê o lote inteiro — e passa a escolher
-- em quais setores vale a pena entrar, que é a mesma trapaça com outro nome.
--
-- Guardada e sorteada com `crypto.getRandomValues`, ela não é previsível nem
-- pelo dono da conta. E como a linha é REGRAVADA a cada setor novo, pedir o
-- mesmo setor duas vezes devolve o MESMO lote: reiniciar não re-rola.
--
-- Trocar de setor gera lote novo, e isso é de propósito — repetir conteúdo para
-- pegar loot diferente é o jogo funcionando. O que se fecha aqui é o re-rolar
-- INSTANTÂNEO, sem custo de tempo.
--
-- ## Uma linha por jogador, não um histórico
--
-- Só o lote em curso importa: o anterior já foi consumido e o próximo ainda não
-- existe. Guardar histórico custaria 480 linhas por jogador por dia para
-- responder uma pergunta que ninguém faz.

CREATE TABLE IF NOT EXISTS lotes (
  usuario   TEXT PRIMARY KEY,
  -- Qual setor este lote atende. Pedido para outro setor regrava a linha.
  setor     INTEGER NOT NULL,
  -- Semente de 32 bits, sorteada no servidor. É o que o cliente não pode prever.
  semente   INTEGER NOT NULL,
  -- A sorte usada na rolagem, TRAVADA junto da semente.
  --
  -- Guardar isto não é zelo: sorte alterada muda o resultado da MESMA semente,
  -- então aceitar um valor novo a cada chamada devolveria ao cliente o botão de
  -- re-rolar que a tabela inteira existe para tirar. A primeira chamada de um
  -- setor fixa as duas, e as seguintes usam o que ficou aqui.
  sorte     REAL NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
