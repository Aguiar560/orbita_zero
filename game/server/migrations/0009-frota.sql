-- A frota sai do save.
--
-- ## O que faltava depois da 3b
--
-- A 3b tirou o ITEM do save: ele não pode mais ser inventado. O casco continuou
-- lá, e casco é poder — cada um tem atributos-base próprios, e os melhores
-- custam cristal ou exigem setor alcançado. Escrever um id em `state.fleet`
-- entregava de graça o que a loja cobra.
--
-- ## Por que uma tabela, e não uma coluna com lista
--
-- "Este jogador tem este casco?" é a pergunta que o servidor faz antes de
-- deixar equipar, decolar ou trocar. Com uma lista em JSON, cada uma dessas
-- respostas seria um parse da lista inteira; com linha por casco, é um índice.
--
-- ## O que NÃO fica aqui
--
-- O progresso da nave — nível, XP e o que está equipado. Nível e XP continuam
-- no save (são a Fase 4), e o equipado mora em `itens` desde a 3b. Esta tabela
-- responde uma pergunta só: quais cascos são desta pessoa.

CREATE TABLE IF NOT EXISTS frota (
  usuario TEXT NOT NULL,
  casco   TEXT NOT NULL,
  -- Como veio parar aqui: `piloto` (o casco inicial da escolha de personagem),
  -- `compra` (pago em cristal) ou `semente` (migração do save antigo).
  --
  -- É a mesma ideia do `motivo` do livro-caixa: sem ele, "de onde saiu esta
  -- nave" não tem resposta, e é a pergunta que a auditoria do pódio vai fazer.
  origem  TEXT NOT NULL,
  em      INTEGER NOT NULL,
  PRIMARY KEY (usuario, casco)
);
