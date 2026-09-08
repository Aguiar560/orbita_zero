# Missões e confiança no servidor — plano

Escrito em 09/09/2026, antes de tocar em código, porque isto é mudança de
progressão com dados vivos: a política do projeto (§49) põe migração e economia
na faixa crítica.

## O problema, em uma frase

`resgatarMissao` roda inteiro no cliente: ele confere `situacaoDe(state, def)`
contra `state.missoes` — que é save, escrito pelo cliente — e paga com `grant()`,
que empilha em `pendentes`. O servidor registra o movimento como declarado.

Disso saem dois defeitos de naturezas diferentes:

1. **Fraude.** Marcar uma missão como pronta no save faz o servidor pagar.
2. **Divergência entre aparelhos.** `missoes` e `confianca` viajam dentro do
   bloco do save, e a reconciliação escolhe UM bloco por maior `playtime`. Duas
   máquinas em paralelo terminam com o de uma delas.

O segundo é o que o Rafael perguntou; o primeiro é o que torna o trabalho
urgente.

## A descoberta que simplifica tudo

**A confiança é função pura das entregas.** Medido em `sim/index.ts`:

```ts
confianca[giverId] = min(CONFIANCA_MAX, atual + confiancaDaMissao(def))
```

concedido uma vez por entrega, e `confiancaDaMissao` é tabela. Logo:

> `confianca[contato] = min(5, Σ confiancaDaMissao(m)) para toda missão m
> entregue daquele contato`

Ela **não precisa de tabela**. Deriva, exatamente como o nível deriva do XP — e
pelo mesmo motivo escrito em `server/src/progresso.ts`: "guardar XP e nível é
guardar a mesma informação duas vezes, e duas cópias de um número divergem".

Isso corta metade do trabalho e remove uma fonte de inconsistência futura.

## A tabela

```sql
CREATE TABLE IF NOT EXISTS missoes (
  usuario     TEXT NOT NULL,
  missao      TEXT NOT NULL,
  -- Contadores por passo, como vetor JSON. É a forma que `state.missoes` já usa.
  passos      TEXT NOT NULL DEFAULT '[]',
  iniciada    INTEGER NOT NULL DEFAULT 0,
  -- NULL = não entregue. Gravado UMA vez; nunca volta a NULL.
  entregue_em INTEGER,
  PRIMARY KEY (usuario, missao)
);
```

### As regras de mescla, que são o coração do desenho

| campo | regra | por quê |
|---|---|---|
| `passos` | **MAX elemento a elemento** | contador de progresso só sobe |
| `iniciada` | **OU** | aceitar em qualquer aparelho vale |
| `entregue_em` | **primeiro vence** (`COALESCE`) | entrega é irreversível |

Todas monotônicas. É isso que faz o multi-dispositivo funcionar **sem código de
mescla**: duas máquinas em paralelo SOMAM, como já acontece com `melhor_setor`.
Não há "última escrita vence" em lugar nenhum.

## O que o servidor passa a validar — DECISÃO 1

Três níveis possíveis. Não são alternativas de gosto: são degraus de custo.

| | o que faz | fecha a fraude? | custo |
|---|---|---|---|
| **A** | só guarda e mescla | não | baixo |
| **B** | confere que a missão existe, não foi entregue, e que os `passos` declarados atingem o alvo do catálogo | sim, a de "entreguei sem fazer" | médio |
| **C** | o servidor CONTA os passos a partir dos fatos (abates, setores, itens) | sim, inteira | é a Fase 5 inteira |

**Recomendo B.** O catálogo de missões é `@data`, que o servidor já importa —
então a conferência é a mesma tabela, sem cópia da regra. B deixa de pé só a
declaração dos contadores; C tira a caneta da mão do cliente de vez, mas exige
o servidor simular o jogo, que é outro projeto.

## Quem paga a recompensa — DECISÃO 2

Hoje quem paga é o cliente, via `grant()` → `pendentes`. Uma recompensa tem:

```ts
{ moedas?, materiais?, xp?, medalhas?, itens?, baus?, concessao? }
```

- `moedas`, `xp`, `materiais`, `medalhas`: o servidor já sabe pagar — são as
  mesmas tabelas da carteira e do progresso.
- **`itens` é o complicado.** A recompensa GERA peças, hoje com `rollItem` no
  cliente. Isso contradiz a Fase 3a ("o item nunca sobe") por outra porta. O
  servidor sabe gerar (ele já rola lotes), mas é trabalho próprio.

**Recomendo dividir:**

- **Fatia 1 (esta):** a tabela, a mescla, a validação B, e a confiança derivada.
  O pagamento continua onde está. Ganho: multi-dispositivo correto e a fraude
  do "entreguei sem fazer" fechada.
- **Fatia 2 (depois):** o servidor paga, inclusive gerando o item. Fecha a
  última porta e junta com a Fase 5.

Fazer as duas juntas dobra a superfície de uma mudança que já mexe em dados
vivos. Prefiro entregar a 1 medida e funcionando.

## Migração dos saves atuais

Não há backfill possível a partir do servidor: ele nunca soube das missões. O
caminho é o cliente **semear uma vez**.

1. Na primeira sincronização depois da mudança, o cliente manda o `state.missoes`
   inteiro como valor absoluto.
2. O servidor mescla com as regras acima.

É seguro por serem monotônicas: semear duas vezes dá o mesmo resultado que
semear uma. E é honesto quanto ao que garante — quem já tinha missões entregues
no save as mantém; quem tiver adulterado o save entra com o que adulterou, uma
única vez. Fechar isso exigiria C, que é a Fase 5.

## Quem estiver online na virada

Mesma ordem das últimas duas mudanças, e pelo mesmo motivo:

1. **Migração primeiro** (`wrangler d1 execute --file=...`).
2. **Deploy do Worker depois.**

Cliente antigo não manda o campo novo e continua usando só o save — nada quebra.
Cliente novo semeia e mescla. A rota tolera o campo ausente.

## O que fica de fora, e é proposital

- `eventos` tem a mesma forma e entra depois, pelo mesmo desenho.
- `chests` **não** cabe aqui: é contador que sobe E desce, então não é
  monotônico. Precisa de livro-caixa como a carteira, ou de o servidor abrir o
  baú. Trabalho diferente.
- `codex`, `provacao`, `stats`, `settings`: não pagam nada. Tabela para eles
  compra pouco.

## Critérios de aceite

- [ ] Duas máquinas com progressos diferentes na mesma missão convergem para o
      MAIOR de cada passo, sem perder entrega.
- [ ] Entregar duas vezes a mesma missão paga uma vez só.
- [ ] Declarar uma entrega sem os passos completos é recusada (validação B).
- [ ] A confiança calculada a partir das entregas do servidor bate com a que o
      save tinha, para um save real.
- [ ] Cliente antigo continua jogando sem erro contra o Worker novo.
- [ ] A recusa de uma missão não derruba o lote — a lição de `planejarEquipar`.
