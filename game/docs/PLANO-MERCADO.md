# Levantamento — mercado de itens entre jogadores

Jogador anuncia uma peça por cristal; outro compra; a peça vai para quem
comprou e o cristal para quem vendeu. Acesso restrito a quem tem passe VIP.

Este documento é levantamento, não implementação. Ele mede o que já existe,
aponta o que falta, compara compra direta com leilão a partir dos números reais
desta base e propõe o desenho que aguenta dinheiro de verdade do outro lado.
Escrito em 12/09/2026.

Documentos vizinhos: [`PLANO-INDICACOES.md`](PLANO-INDICACOES.md) (mesma classe
de risco — dinheiro, fraude e estorno), [`SISTEMAS.md`](SISTEMAS.md),
[`SEGURANCA-E-CONTA.md`](SEGURANCA-E-CONTA.md).

---

## Decisão executiva

**Compra direta a preço fixo, com custódia no servidor. Leilão não.** E há uma
condição que precede tudo: hoje o mercado seria uma impressora de cristal, e o
buraco não está no mercado — está no `/lote`. Ver "Lacuna 1".

O que a produção diz hoje (medido no D1 em 12/09/2026):

| medida | valor |
|---|---|
| contas com item guardado | 38 |
| contas ativas em 24h | 21 |
| **contas com passe VIP ativo** | **3** |
| contas que já tiveram VIP alguma vez | 3 |
| **cristais existentes no jogo inteiro** | **237**, em 4 contas |
| maior saldo individual de cristal | 234 |
| compras de cristal com dinheiro, desde sempre | 1 |

Três números decidem o desenho:

1. **Três VIPs.** Um leilão precisa de disputa; com três participantes ele não é
   leilão, é uma compra direta com contagem regressiva e mais peças para
   quebrar. Ver "Compra direta × leilão".
2. **237 cristais no mundo todo.** O poder de compra do mercado inteiro hoje é
   de ~R$ 10 a R$ 15. Isso não impede construir — impede *esperar movimento*. O
   mercado nasce como encanamento correto, e não como economia.
3. **O cristal é a única moeda que o cliente não sabe imprimir.** Sucata e
   núcleo são declarados pelo cliente e entram no livro por sua palavra; cristal
   tem `cristal_so_do_servidor` em
   [`server/src/carteira.ts`](../server/src/carteira.ts). Precificar o mercado
   em cristal não é só a sua preferência — é a **única** escolha que não nasce
   quebrada.

### MVP recomendado

- Anúncio de **preço fixo**, item único por anúncio, validade de 7 dias.
- **Custódia**: anunciar tira a peça da mochila; ela não pode ser equipada,
  descartada nem fundida enquanto estiver anunciada.
- **Compra atômica**: débito, crédito, taxa e troca de dono num único `batch`,
  com o banco recusando por constraint — não por `if`. Ver "A transação de
  compra".
- **VIP obrigatório para anunciar e para comprar**, conferido no servidor.
- **Taxa de 15% em cristal, queimada** (some do jogo). É sumidouro e é pedágio
  contra lavagem entre contas do mesmo dono.
- **Quarentena de 7 dias** para cristal recém-comprado com dinheiro: ele compra
  VIP e loja na hora, e só entra no mercado depois da janela de arrependimento
  do CDC.
- **Teto diário de cristal recebido por vendedor.** É o que limita o estrago de
  qualquer buraco que ainda não conhecemos.
- Contas de teste (`contas_teste`) ficam de fora dos dois lados.

---

## O que já existe e pode ser aproveitado

O jogo está mais perto disto do que parece. Quase toda peça já existe:

| peça | onde | serve para |
|---|---|---|
| item é do servidor, com dono em coluna | `itens` (migração 0008) | trocar dono é um `UPDATE` |
| `uid` nasce no servidor | `lote.ts` + `inventario.ts` | não há item forjado para vender |
| livro-caixa com motivo fechado | `transacoes` / `saldos` (0005) | pagar deixa rastro auditável |
| débito condicional e idempotência | `lancar`, índice `transacoes_origem` | não se gasta o que não se tem |
| passe VIP com expiração no servidor | `assinaturas` (0006) | o portão do mercado |
| baldes de ficha por assunto | `ritmo.ts` (`BALDES`) | ritmo do mercado sem inventar limite novo |
| livro das recusas + alerta a cada 5 min | `recusas.ts`, `alerta.ts` | ver abuso no mesmo dia |
| recado do comando para UM jogador | `recados` (0018) | avisar "sua peça foi vendida" |
| gatilho de tempo `*/5` | `wrangler.toml` | expirar anúncio sem ninguém olhando |
| contas de teste marcadas | `contas_teste` (0019) | excluir quem tem poder de teste |
| painel administrativo | `painel-admin.ts` | moderação e auditoria |

Nada disso precisa ser inventado. O mercado é, em grande parte, costura.

---

## Lacunas reais encontradas

### 1. BLOQUEANTE — o setor do lote vem do cliente

[`server/src/index.ts:1649`](../server/src/index.ts) lê `corpo.setor` e o valida
só por faixa: `setorValido` em [`server/src/lote.ts:79`](../server/src/lote.ts)
aceita qualquer inteiro de 1 a `SETOR_MAX`. Não há conferência contra o
progresso gravado da conta.

Hoje isso machuca só quem faz: uma conta pede o pote do setor 300, recebe peça
de fim de campanha e estraga o próprio jogo. **Com mercado, isso deixa de ser
auto-sabotagem e vira renda**: peça de endgame farmada em conta nova, vendida
por cristal — e cristal é o que você vende por dinheiro. O caminho fica curto:
cliente modificado → item caro → cristal → passe VIP e cápsulas de graça, ou
revenda.

O `melhor_setor` de `progresso` também é declarado pelo cliente, então ele não
serve de trava sozinho — só desloca a mentira de uma rota para outra. O que
existe hoje é auditoria (`excedentes`), que **mede e não recusa**, por decisão
registrada: as duas fórmulas de recusa testadas recusavam jogador legítimo.

Não proponho resolver isso dentro deste trabalho. Proponho que o mercado não
abra sem uma das três:

- **(a)** o `/lote` passar a derivar o setor do progresso auditado, com
  `excedentes` virando recusa acima de uma folga; ou
- **(b)** vendável só o item cujo `ilvl` cabe na progressão auditada da conta,
  com o resto retido para revisão no painel; ou
- **(c)** teto diário de cristal recebido por vendedor, baixo o bastante para
  que explorar não pague o trabalho — a defesa de menor esforço, e a única que
  continua valendo contra o buraco que ainda não achamos.

A recomendação é **(c) sempre, (a) quando a Fase 5 chegar**. (c) não conserta
nada, mas limita o prejuízo de tudo — inclusive do desconhecido.

### 2. BLOQUEANTE — `lancar` não é atômico como o comentário afirma

[`server/src/index.ts:1363`](../server/src/index.ts) faz
`batch([inserir, mover])` e, quando o `UPDATE` do saldo casa zero linhas,
devolve `saldo_insuficiente`. O comentário logo abaixo diz que "a transação
inteira é revertida pelo `batch`, então não sobra lançamento órfão".

**Isso não é o que o SQLite faz, e foi medido.** Um `UPDATE` que casa zero
linhas não é erro; sem erro não há reversão, e o `INSERT` do livro fica.
Reproduzido em `node:sqlite`:

```
UPDATE casou linhas: 0
lancamentos no livro depois do COMMIT: 1
saldo depois: 10
```

Consequência hoje: na corrida entre a conferência de saldo e o `UPDATE`, sobra
no livro um débito que nunca saiu do saldo. O livro é a verdade por desenho —
então, no dia em que `saldos` for reconstruído a partir dele, o jogador perde
cristal que nunca gastou. É raro (a janela é de milissegundos) e é silencioso,
que é a pior combinação.

Para o mercado isso deixa de ser raro e passa a ser inaceitável: é o caso em que
**a peça troca de dono e o pagamento não acontece**.

O conserto é do banco, não do código — também medido:

```
com CHECK (quantia >= 0): erro -> CHECK constraint failed: quantia >= 0
livro depois do rollback: 0

UNIQUE em vendas(anuncio): erro -> UNIQUE constraint failed: vendas.anuncio
```

Com `CHECK (quantia >= 0)` em `saldos`, o débito impossível vira **erro**, e
erro o `batch` reverte inteiro. Com `UNIQUE` no anúncio vendido, a segunda
compra simultânea do mesmo anúncio vira erro pela mesma razão. As duas
constraints são o que torna a compra atômica sem precisar acreditar em `if`.

`saldos` precisa ser reconstruída para ganhar o `CHECK` (SQLite não adiciona
constraint com `ALTER`). É migração de tabela com cópia — trabalho conhecido, e
que conserta um defeito que já existe hoje, independentemente do mercado.

### 3. Não há requisito de nível para equipar

`podeIrPara` em [`server/src/inventario.ts:183`](../server/src/inventario.ts)
confere **slot** e **elemento**, e nada mais. Uma peça de `ilvl` 300 entra numa
nave de quem está no setor 1.

Sem mercado isso é inofensivo: ninguém consegue a peça antes da hora. Com
mercado, comprar substitui progredir — e a campanha inteira vira opcional para
quem tem cristal. Isso colide de frente com o que o [`CLAUDE.md`](../CLAUDE.md)
fixa: *a nave evolui por item, craft e Matriz, e não existe sistema paralelo*. O
mercado não cria uma quarta fonte de poder, mas cria um **atalho com cartão de
crédito** para a primeira.

Três saídas, em ordem de preferência:

1. **Requisito de nível por `ilvl`** (`ilvl <= nivelDeComando + folga`) aplicado
   ao EQUIPAR, no servidor. Resolve o mercado e resolve também o dia em que um
   presente de evento entregar peça acima da curva.
2. **Requisito só na COMPRA**: o comprador não pode adquirir acima da própria
   faixa. Mais simples, e furado — basta comprar com a conta grande e repassar.
3. Aceitar o atalho como decisão de produto e dizer isso em voz alta.

Esta é decisão sua, não minha. Mas ela precisa ser tomada ANTES, porque muda o
modelo de dados: a opção 1 quer `ilvl` numa coluna, não dentro do JSON.

### 4. `sintetizar` consome peças, e não sabe de anúncio

A fusão apaga os `uid`s consumidos. Se a peça estiver anunciada e a fusão não
souber, o anúncio fica apontando para um item que não existe — e o comprador
paga por nada. Vale para `descartar` e para `equipar` igualmente. É a razão de a
custódia precisar ser uma coluna que **toda** consulta de item respeita, e não
uma tabela paralela que se esquece de consultar.

### 5. A mochila tem teto de 70, e a compra pode não caber

`CARGA_MAXIMA` = 70 em
[`src/data/balance/capacidade.ts:22`](../src/data/balance/capacidade.ts),
conferido no servidor por `vagasNaMochila`. Comprar com a mochila cheia tem de
ser recusado **antes** do pagamento, com frase clara. A alternativa — criar uma
caixa de recebidos — inventa um conceito novo de armazenamento e não vale o
preço no MVP.

### 6. O passe VIP hoje é de graça no nível 25

`VIP_TESTE_NIVEL_25_ATIVO` está ligado em
[`server/src/vip-de-teste.ts`](../server/src/vip-de-teste.ts): quem chega ao
nível 25 ganha 30 dias. Como portão de fraude, portanto, "ser VIP" custa tempo
de jogo, não dinheiro — e tempo de jogo é o que um farmador tem de sobra.

O portão VIP continua valendo como **produto** (é um benefício de assinante) e
como **atrito** (uma conta descartável precisa chegar ao 25). Só não deve ser
contado como defesa antifraude sozinho.

---

## Compra direta × leilão

| critério | compra direta | leilão |
|---|---|---|
| participantes necessários | 1 comprador | vários, simultâneos |
| VIPs hoje | **3** | **3** |
| requisições por anúncio | 1 leitura de vitrine + 1 compra | vitrine + lances + contagem + fechamento |
| escritas no D1 | 1 por venda | 1 por lance, mais o fechamento |
| precisa de gatilho de tempo | só para expirar | para fechar **todo** leilão |
| dinheiro parado | nenhum | o lance fica preso até perder |
| formas novas de errar | anúncio órfão | lance perdido, empate, sniping, devolução de lance, leilão fechado duas vezes |
| descoberta de preço | fraca (precisa de histórico) | boa — quando há disputa |

O leilão só ganha em uma linha: descobrir preço. E ele só ganha essa linha **se
houver disputa**, que é exatamente o que três VIPs não produzem.

E há o custo que acabamos de aprender na pele: em 12/09/2026 a cota diária de
escrita do D1 estourou e derrubou a API inteira. Um leilão é, por natureza, uma
máquina de escrita (cada lance) e de leitura (cada contagem regressiva na tela
de cada espectador). Não é a hora.

**A descoberta de preço se resolve mais barato**: mostrar as últimas vendas de
peças parecidas (mesmo slot, mesma raridade, faixa de `ilvl`) e um preço
sugerido derivado do orçamento de poder que o balanceamento já calcula
(`npm run simular -- item <nivel>`). Uma leitura agregada, sem lance nenhum.

Leilão fica registrado como fase futura, condicionada a uma medida objetiva:
**mais de 30 contas com VIP ativo e mais de 10 vendas por semana**. Abaixo
disso ele é complexidade sem função.

---

## Regra de produto proposta

### Quem entra

- Anunciar: VIP ativo, conta fora de `contas_teste`.
- Comprar: VIP ativo, conta fora de `contas_teste`.
- Os dois conferidos **no servidor**, por `assinaturas.expira_em > agora`. A
  lista `ADMINS` do cliente não vale como portão — ela já está documentada como
  portão de interface, não de segurança.

### O que pode ser anunciado

- Peça na mochila (`nave IS NULL`). Equipada, não.
- Peça sem assinatura de dono (`de` — a peça exclusiva nomeia um jogador; ela
  não deveria mudar de mãos com o nome de outro escrito nela).
- Uma peça por anúncio. Nada de lote.
- Máximo de 10 anúncios ativos por conta. É contenção, não balanceamento.

### Preço

- Inteiro, em cristal. Mínimo 1, máximo 5.000 (o maior saldo do jogo hoje é 234;
  o teto é sanidade contra dedo escorregado e contra isca de clique).
- A compra manda o preço que o comprador VIU. Divergiu, recusa com `preco_mudou`
  — assim ninguém compra por um valor que não estava na tela.

### Taxa

15% do preço, arredondado para cima, **descontado do vendedor e queimado**. Duas
funções:

1. **Sumidouro.** Todo cristal do jogo foi vendido por dinheiro ou dado em
   marco; um mercado sem taxa só os faz circular para sempre.
2. **Pedágio contra lavagem.** Passar item para a própria conta secundária passa
   a custar 15% a cada salto.

O vendedor vê "você recebe X" antes de confirmar. Nunca depois.

### Validade e cancelamento

- 7 dias. Vencido, a peça volta à mochila pelo gatilho `*/5`.
- Cancelar devolve na hora, se ainda não vendeu.
- Volta bloqueada por mochila cheia: a peça fica em custódia e o jogador recebe
  recado dizendo o que fazer. Não se apaga item de ninguém por falta de espaço.

### Quarentena do cristal comprado

Cristal creditado por `motivo = 'compra'` só pode ser **gasto no mercado** 7 dias
depois. Antes disso compra VIP, cápsula e serviço normalmente.

O número não é arbitrário: é a janela de arrependimento do CDC, a mesma que o
[`PLANO-INDICACOES.md`](PLANO-INDICACOES.md) já usa. É o que impede o golpe mais
previsível — comprar cristal com cartão de terceiro, converter em item e pedir
estorno.

### Teto diário por vendedor

Proposta: **2.000 cristais recebidos por conta por dia**, contados do livro. É
folgado para qualquer venda honesta no tamanho atual do jogo e transforma
qualquer exploração desconhecida num vazamento lento e visível, em vez de um
saque.

---

## Modelo de dados proposto

### `anuncios`

```sql
CREATE TABLE IF NOT EXISTS anuncios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vendedor   TEXT    NOT NULL,
  item       TEXT    NOT NULL,              -- itens.uid
  preco      INTEGER NOT NULL CHECK (preco >= 1 AND preco <= 5000),
  taxa       INTEGER NOT NULL,              -- congelada na criação
  -- desnormalizado da peça, para a vitrine filtrar sem abrir o JSON de cada item
  slot       TEXT    NOT NULL,
  raridade   TEXT    NOT NULL,
  ilvl       INTEGER NOT NULL,
  estado     TEXT    NOT NULL,              -- anunciado | vendido | cancelado | expirado
  criado_em  INTEGER NOT NULL,
  expira_em  INTEGER NOT NULL
);

-- Uma peça não pode estar em dois anúncios vivos ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS anuncios_item_vivo
  ON anuncios (item) WHERE estado = 'anunciado';

-- A vitrine pergunta sempre a mesma coisa: o que está à venda, mais novo primeiro.
CREATE INDEX IF NOT EXISTS anuncios_vitrine
  ON anuncios (estado, criado_em DESC);

CREATE INDEX IF NOT EXISTS anuncios_vendedor ON anuncios (vendedor, estado);
```

`preco` e `taxa` congelados por lançamento, pelo mesmo motivo de `compras`
congelar cristais e centavos: entre anunciar e vender o catálogo pode mudar, e
vale o que estava escrito.

### `vendas`

```sql
CREATE TABLE IF NOT EXISTS vendas (
  anuncio    INTEGER NOT NULL UNIQUE,       -- a trava atômica contra compra dupla
  comprador  TEXT    NOT NULL,
  vendedor   TEXT    NOT NULL,
  preco      INTEGER NOT NULL,
  taxa       INTEGER NOT NULL,
  em         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS vendas_historico ON vendas (em DESC);
```

Separada de `anuncios` por dois motivos: o `UNIQUE` sobre ela é o que torna a
compra dupla um **erro de banco** em vez de um `UPDATE` que casa zero linhas
(ver Lacuna 2), e ela é o histórico que alimenta o preço sugerido sem varrer
anúncios mortos.

### `itens` ganha a custódia

```sql
ALTER TABLE itens ADD COLUMN anuncio INTEGER;  -- NULL = livre
```

**Toda** consulta que hoje lê ou escreve item precisa passar a respeitar a
coluna: `inventarioDe`, o `descartar`, o `equipar`, a fusão e a compra de casco.
Uma peça anunciada não aparece na mochila, não equipa, não funde e não descarta.
Esta é a linha do trabalho onde um esquecimento vira duplicação de item — ver
Lacuna 4.

### `saldos` ganha a trava

```sql
-- Tabela reconstruída: SQLite não adiciona CHECK por ALTER.
CREATE TABLE saldos_novo (
  usuario       TEXT    NOT NULL,
  moeda         TEXT    NOT NULL,
  quantia       INTEGER NOT NULL DEFAULT 0 CHECK (quantia >= 0),
  atualizado_em INTEGER NOT NULL,
  PRIMARY KEY (usuario, moeda)
);
INSERT INTO saldos_novo SELECT * FROM saldos;
DROP TABLE saldos;
ALTER TABLE saldos_novo RENAME TO saldos;
```

É o que transforma "saldo insuficiente" de resultado consultado em erro do
banco, e portanto em reversão de verdade.

### Livro-caixa

`MOTIVOS` em [`server/src/carteira.ts:30`](../server/src/carteira.ts) é lista
fechada. Entram três:

| motivo | sinal | quem |
|---|---|---|
| `mercado_compra` | negativo | comprador |
| `mercado_venda` | positivo | vendedor, já líquido da taxa |
| `mercado_estorno` | positivo | devolução administrativa |

A taxa **não** vira lançamento: ela é o que não foi creditado. Registrar um
terceiro lançamento para uma conta que não existe seria inventar um usuário
"casa" no livro.

`recusaDoCliente` precisa recusar os três vindos do cliente, como já faz com
`compra`, `estorno` e `marco` — senão o mercado abre a porta que
`cristal_so_do_servidor` fechou em 10/09.

---

## A transação de compra

É a parte que não pode errar. Um único `env.DB.batch`, nesta ordem:

```
1. INSERT INTO vendas (anuncio, ...)                    -- UNIQUE: segunda compra = erro
2. UPDATE anuncios SET estado='vendido' WHERE id=? AND estado='anunciado'
3. INSERT INTO transacoes (comprador, -preco, 'mercado_compra')
4. UPDATE saldos SET quantia = quantia - preco
    WHERE usuario=comprador AND moeda='cristal'         -- CHECK: sem saldo = erro
5. INSERT INTO transacoes (vendedor, +liquido, 'mercado_venda')
6. INSERT INTO saldos (vendedor, ...) ON CONFLICT DO UPDATE quantia = quantia + liquido
7. UPDATE itens SET usuario=comprador, anuncio=NULL, nave=NULL, slot=NULL
    WHERE uid=? AND anuncio=?
```

O que torna isto seguro **não** são os `WHERE` — é que as duas condições que
realmente importam falham como ERRO:

- compra dupla → `UNIQUE constraint failed: vendas.anuncio`
- saldo insuficiente → `CHECK constraint failed: quantia >= 0`

Erro o `batch` reverte inteiro. Condição que apenas casa zero linhas, não —
medido, ver Lacuna 2. É a diferença entre "recusou" e "metade aconteceu".

Antes do `batch`, fora dele, as conferências que não precisam de atomicidade:
VIP do comprador, conta de teste, mochila com vaga, quarentena do cristal, teto
diário do vendedor, preço igual ao que ele viu, comprador ≠ vendedor.

Depois do `batch`: recado ao vendedor ("sua peça X foi vendida por Y"), pela
tabela `recados`, que já entrega em até 30 s sem o jogador recarregar nada.

---

## API proposta

| rota | método | balde | o quê |
|---|---|---|---|
| `/mercado` | GET | leitura em memória | vitrine paginada, filtros de slot/raridade/ilvl/preço |
| `/mercado` | POST | `acao` | anunciar `{uid, preco}` |
| `/mercado/cancelar` | POST | `acao` | cancelar `{anuncio}` |
| `/mercado/comprar` | POST | `acao` | comprar `{anuncio, preco}` |
| `/mercado/meus` | GET | leitura em memória | meus anúncios e minhas vendas |

Recusas nomeadas, todas contadas no livro: `sem_vip`, `conta_de_teste`,
`item_nao_e_seu`, `item_equipado`, `item_ja_anunciado`, `item_intransferivel`,
`preco_invalido`, `preco_mudou`, `anuncio_encerrado`, `saldo_insuficiente`,
`mochila_cheia`, `cristal_em_quarentena`, `teto_diario`, `voce_e_o_vendedor`,
`anuncios_demais`.

A vitrine usa balde **em memória**, como `/placar` já faz: é leitura pura e não
vale uma escrita em `limites` por consulta. Ver o comentário de `consumirFicha`.

---

## Interface proposta

- Entrada pelo menu de perfil ou pela Central de Serviços, visível para todos e
  **com cadeado para quem não é VIP** — um mercado invisível não vende passe.
- Vitrine com os filtros do inventário (mesma linguagem visual, mesmos ícones).
- Cartão do anúncio: ícone, nome, raridade, `ilvl`, afixos, preço e vendedor.
- Comprar abre confirmação com preço, saldo antes e depois. Sem confirmação, um
  clique errado gasta cristal comprado com dinheiro.
- Anunciar parte do próprio item na mochila, com **preço sugerido** e as três
  últimas vendas parecidas ao lado.
- "Meus anúncios" com o que vendeu, o que expirou e o que voltou.
- Sem atualização automática. A vitrine recarrega por gesto do jogador — a lição
  de 12/09 é que tela que se atualiza sozinha custa cota de banco.

---

## Fraude, abuso e dinheiro de verdade

| vetor | defesa |
|---|---|
| item forjado | `uid` nasce no servidor; o item nunca sobe pelo cliente |
| item farmado acima da progressão | Lacuna 1 — teto diário sempre; `/lote` auditado depois |
| compra dupla do mesmo anúncio | `UNIQUE (vendas.anuncio)` — erro, não zero linhas |
| gastar o que não tem | `CHECK (quantia >= 0)` — erro, não zero linhas |
| vender e fundir a mesma peça | coluna `anuncio` respeitada por toda consulta de item |
| vender e equipar a mesma peça | idem |
| estorno de cartão depois de gastar | quarentena de 7 dias do cristal de `compra` |
| lavagem para conta secundária | taxa de 15% por salto + VIP dos dois lados + histórico em `vendas` |
| isca de clique com preço absurdo | teto de 5.000, confirmação com saldo antes/depois |
| preço trocado no meio da compra | o comprador manda o preço que viu; divergiu, recusa |
| conta de teste vendendo | `contas_teste` barrada nos dois lados |
| trapaça combinada por fora do jogo | a custódia dispensa confiança: não existe "paga que eu mando" |
| enchente de anúncios | 10 ativos por conta, balde `acao`, taxa por anúncio |

O que este desenho **não** resolve, e é honesto dizer:

- **Ele não impede pay-to-win.** Ele o organiza. Com cristal comprável por
  dinheiro e itens compráveis por cristal, dinheiro vira poder — com taxa,
  rastro e teto, em vez de por fora. É o modelo do token de assinatura que
  outros jogos usam, e funciona quando é assumido, não quando é acidente.
- **Ele não protege o ranking.** Uma conta que compra equipamento sobe no placar
  sem ter jogado por aquilo. Se o pódio virar premiado, o mercado precisa entrar
  na conta da auditoria.
- **Ele não é neutro na sua receita.** Vendedor que ganha cristal compra passe
  sem pagar. O cristal dele, porém, saiu do bolso de alguém — o total vendido
  não cai, muda de mãos. O risco real é outro: quem compraria cristal para o VIP
  passa a poder ganhá-lo vendendo item. Medir a receita antes e depois é parte
  do trabalho, não um extra.

---

## Custo em D1

Depois de 12/09 este item deixou de ser rodapé.

| operação | leituras | escritas |
|---|---|---|
| abrir a vitrine (50 anúncios) | ~50 linhas, 1 índice | 0 |
| anunciar | ~3 | 2 (anúncio + custódia) |
| cancelar / expirar | ~2 | 2 |
| **comprar** | ~6 | **7** |
| varredura de expirados (`*/5`) | poucos | 2 por anúncio vencido |

Uma venda custa ~7 linhas escritas — menos que um ciclo de sincronia de um
jogador, que custa ~12. O mercado não é um problema de cota **enquanto for
compra direta**. Um leilão com 20 lances custaria 20 escritas por item vendido,
mais a tela de contagem de cada espectador.

A varredura do `*/5` precisa de `LIMIT`: uma expiração em massa não pode virar
um lote de centenas de escritas num gatilho só.

---

## Arquivos que a implementação deve tocar

### Servidor

- `server/migrations/0023-mercado.sql` — `anuncios`, `vendas`, `itens.anuncio`
- `server/migrations/0024-saldo-nao-negativo.sql` — reconstrução com `CHECK`
- `server/src/mercado.ts` — regras puras: taxa, validade, quem pode, o que pode
- `server/src/index.ts` — as cinco rotas, o `batch` da compra, a varredura no cron
- `server/src/carteira.ts` — três motivos novos em `MOTIVOS` e em `recusaDoCliente`
- `server/src/ritmo.ts` — decidir se o mercado usa `acao` ou balde próprio
- `server/src/inventario.ts` — custódia em toda consulta de item
- `server/src/painel-admin.ts` — anúncios vivos, vendas do dia, estorno manual

### Cliente

- `src/app/mercado.ts` — espelho, no padrão de `inventario.ts`
- `src/ui/panels/MercadoPanel.ts` — vitrine, anunciar, meus anúncios
- `src/ui/panels/InventoryPanel.ts` — ação "anunciar" na peça
- `src/data/balance/mercado.ts` — taxa, teto, validade, limites

### Documentação obrigatória no mesmo trabalho

`TELAS.md` (tela nova), `SISTEMAS.md` (o sistema por dentro), `PLANO.md` (sai do
que falta), `ROADMAP.md` (com a medição), `CLAUDE.md` (tabela de documentos).

---

## Testes obrigatórios

### Atomicidade — o coração

- compra dupla simultânea do mesmo anúncio: uma vence, a outra recebe
  `anuncio_encerrado`, e o item tem **um** dono no fim
- saldo insuficiente não deixa lançamento órfão em `transacoes`
- `divergencias()` vazia depois de 100 compras aleatórias
- falha no meio do `batch` não move item nem dinheiro

### Custódia

- item anunciado não aparece em `inventarioDe`
- anunciado não equipa, não descarta, não funde, não anuncia de novo
- cancelar e expirar devolvem à mochila; mochila cheia mantém em custódia

### Portões

- sem VIP recusa anunciar e comprar
- `contas_teste` recusada dos dois lados
- comprar de si mesmo recusado
- preço divergente do visto recusa com `preco_mudou`
- cristal em quarentena recusa com `cristal_em_quarentena`
- teto diário recusa a venda que passa

### Economia

- a taxa some do total de cristal do jogo (soma do livro cai)
- venda credita líquido, nunca bruto
- 10.000 vendas simuladas não criam nem destroem cristal fora da taxa

### Operação

- toda recusa nova aparece no livro `recusas`
- o recado de venda chega uma vez só
- a varredura do cron respeita `LIMIT` e é idempotente

---

## Ordem segura de entrega

1. **`CHECK (quantia >= 0)` em `saldos`** e teste provando a reversão. Conserta
   um defeito que já existe, sem depender do mercado. Vai sozinho.
2. **Custódia**: coluna `anuncio` e toda consulta de item respeitando-a, ainda
   sem mercado nenhum. Testável isolado.
3. **Decidir a Lacuna 3** (requisito de nível). Muda o modelo de dados.
4. **`anuncios` + `vendas` + anunciar/cancelar.** Sem comprar. Dá para ver a
   vitrine encher sem nenhum cristal mudar de mãos.
5. **Comprar**, com o `batch` completo e os testes de atomicidade.
6. **Quarentena, taxa e teto diário.**
7. **Vitrine, preço sugerido e histórico.**
8. **Painel administrativo** e estorno manual.

Publicação: **migração primeiro, deploy depois** — sempre, e mais ainda aqui,
porque o passo 1 reconstrói uma tabela de dinheiro. Exportar `saldos` e
`transacoes` antes (`wrangler d1 export`) não é excesso: é a única tabela do
jogo em que um erro não se conserta com deploy.

---

## Estimativa de porte

| etapa | porte |
|---|---|
| `CHECK` em `saldos` + teste | pequeno |
| custódia em toda consulta de item | médio — o risco está no que se esquece |
| anúncio e cancelamento | médio |
| compra atômica | pequeno em código, **grande em teste** |
| quarentena, taxa, teto | pequeno |
| vitrine e painéis | grande — é tela nova, com filtro e paginação |
| painel administrativo | pequeno |

O trabalho não está na compra. Está na custódia (achar todas as consultas) e na
tela (o mercado é uma tela inteira, não um botão).

---

## Critérios de aceite do MVP

1. Uma peça anunciada não existe para nenhum outro caminho do jogo.
2. Duas compras simultâneas do mesmo anúncio terminam com um dono e um débito.
3. O total de cristal do jogo depois de N vendas é o de antes menos as taxas.
4. Nenhum lançamento órfão aparece em `transacoes` sob concorrência.
5. Quem não é VIP vê o mercado, entende o que é e não consegue usar.
6. Conta de teste não vende nem compra.
7. Toda recusa aparece no livro com nome próprio.
8. O vendedor sabe que vendeu sem precisar procurar.

---

## Decisões que precisam de aprovação antes de implementar

1. **Requisito de nível para equipar** (Lacuna 3) — muda o modelo de dados e é a
   diferença entre um mercado que acelera e um que substitui a campanha.
2. **Abrir antes ou depois de fechar o `/lote`** (Lacuna 1). Minha recomendação:
   abrir com teto diário baixo e fechar o `/lote` na sequência.
3. **Taxa de 15%** — número escolhido por analogia, não medido. Não há venda
   nenhuma para calibrar ainda.
4. **VIP dos dois lados** — como pedido. Com 3 VIPs hoje, isso é um mercado de
   três pessoas. A variante que sugiro considerar: **VIP para anunciar** (onde
   mora o risco) e compra aberta a todos, o que faz do mercado uma vitrine que
   vende passe em vez de um clube fechado.
5. **Quarentena de 7 dias** do cristal comprado — protege contra estorno e
   atrasa o jogador que pagou. É troca, e a escolha é sua.
6. **Teto de 2.000 cristais por dia por vendedor** — folgado hoje, apertado se o
   jogo crescer.
