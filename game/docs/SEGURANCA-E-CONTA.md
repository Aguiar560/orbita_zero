# Segurança e conta — auditoria e arquitetura

Auditoria feita em 2026-08-27, medindo o código, não por lista genérica. A
segunda metade é a arquitetura proposta para login e servidor.

> **Este documento é anterior ao servidor existir.** Ele foi escrito quando a
> pergunta era "como seria", e hoje o Worker, o D1 e o login estão de pé. A
> auditoria continua valendo como registro do que foi consertado; o que ela
> chama de "proposta" já é realidade em boa parte.
>
> **Para onde as coisas vão agora, leia o Passo 9 do [`PLANO.md`](PLANO.md)**:
> o jogo inteiro migra para o servidor, porque o ranking vai valer prêmio e um
> save escrito pelo cliente não sustenta um pódio premiado.

## O que está bom, e é bom de verdade

Estes não são elogios de praxe — são medições, e cada um remove uma classe
inteira de ataque:

| | medido |
|---|---|
| dependências de produção | **`dependencies: {}`** — zero |
| `npm audit --omit=dev` | **0 vulnerabilidades** |
| segredos no repositório | nenhum |
| `eval` / `new Function` / `document.write` | nenhum |
| chamadas de rede externas | nenhuma (só os próprios assets) |
| middlewares de dev (`/__snap`, `/__lab`) | `apply: 'serve'` — não entram no build |

Zero dependência de produção é o achado mais valioso. Não existe cadeia de
suprimento para comprometer, e é uma decisão que já estava no `CLAUDE.md`
("sem dependência nova sem motivo forte") pagando juros.

## O que precisa mudar ANTES de existir servidor

### F1 — O cliente é a autoridade sobre tudo · crítico

Todo o estado vive em `localStorage` como JSON puro (`state.ts:366`), e
`migrate` valida **forma, não valores**: garante que `inventory` é um array,
mas não que `sucata` caiba num número plausível nem que um item tenha afixos
dentro do orçamento.

Hoje isso é o jogador trapaceando consigo mesmo, e não é problema. **No dia em
que houver placar, é o problema inteiro**: um placar que aceita progresso
relatado pelo cliente é decoração.

### F2 — `testMode` é um booleano no save · crítico com servidor

Um campo em `state.settings` concede, medido em 13 pontos de `sim/index.ts`:

- setor máximo e patente máxima
- as 53 naves
- recursos infinitos e capacidade infinita
- combustível que não gasta
- **imortalidade**
- velocidade 8×

Editar `localStorage` liga tudo isso. Enquanto o jogo é local, é uma
ferramenta legítima. Assim que houver conta, é a primeira coisa que um
servidor precisa saber ignorar.

### F3 — `importSave` aceita qualquer base64 · alto

`state.ts:419` decodifica e passa direto para `migrate`, sem validação de
faixa. O vetor real não é técnico, é social: um "save de presente" postado num
fórum. Hoje o dano é local. Com conta, é a via de contaminar o servidor por um
cliente honesto.

### F4 — Sink de HTML dormente · médio, hoje inofensivo

`h()` aceita `html:` e o joga em `innerHTML` (`dom.ts:44`). **Ninguém usa** —
verificado. `FabricacaoPanel.ts:396` monta um SVG por template, interpolando
apenas cor da tabela de raridade e números calculados.

Fica na lista por uma razão só: no dia em que o placar mostrar **nome escolhido
por outro jogador**, esse é exatamente o caminho de um XSS. A hora de fechar é
antes de existir texto de terceiro na tela, não depois.

### F5 — Sem CSP nem cabeçalhos de segurança · médio

Não há configuração. Só passa a importar quando houver sessão para roubar.

## Arquitetura proposta

### O princípio

**O servidor não confia no cliente.** Tudo abaixo decorre disso.

### Três modelos, e por que o do meio

**A — servidor autoritativo.** A simulação roda no servidor. É o correto e é
inviável aqui: a simulação É o jogo, a 60 quadros por segundo, e foi construída
para o navegador.

**B — cliente reporta, servidor valida plausibilidade.** O servidor recalcula
os TETOS e rejeita o impossível: XP por segundo acima da curva, setor acima do
que o tempo jogado permite, item com afixos fora do orçamento do §7.

Aqui está a peça de sorte da arquitetura atual: **`sim/` e `data/` não conhecem
DOM nem canvas** — a regra número 1 do `CLAUDE.md`, escrita para permitir medir
balanceamento em Node. O servidor pode importar **as mesmas tabelas** que o
navegador usa e derivar os limites do mesmo lugar. Não existe cópia da fórmula
para divergir.

**C — replay verificável.** O cliente manda semente e decisões; o servidor
re-simula. O jogo já é determinístico (mulberry32, passo fixo). Caro em CPU.

**Proposta: B agora, C depois e só para o topo do placar de temporada**, que é
o único lugar onde trapacear compensa.

### Login

**Não escrever autenticação por senha.** Fazer certo exige Argon2id,
limitação de tentativas, fluxo de recuperação por e-mail, rotação de sessão —
muito código, e o tipo de código onde um erro não aparece em teste. Usar um
provedor.

**Sessão em cookie `HttpOnly; Secure; SameSite=Lax`, não em `localStorage`.**
Token em `localStorage` é legível por qualquer XSS — e F4 mostra que o sink
existe. Cookie `HttpOnly` sobrevive a um XSS que o token não sobreviveria.

### Save na nuvem

O save vira `{ versao, atualizadoEm, estado }`. Conflito entre dispositivos é
uma decisão de produto pendente — "o mais recente vence" perde progresso de
quem jogou offline nos dois.

## Hospedagem

⚠️ **Os limites de camada gratuita mudam.** Confira antes de decidir; os
números abaixo são referência, não garantia.

> **A camada gratuita não atravessa o Passo 9.** Medido em 03/09: com
> sincronização a cada 150 s, o teto de 100 mil escritas de linha por dia do D1
> dá cerca de **170 jogadores com a aba aberta o dia inteiro** — e aba aberta o
> dia inteiro é exatamente o que um idle provoca. Com o estado do jogo no
> servidor, a escrita por jogador só sobe.
>
> São US$ 5/mês de Workers e US$ 5/mês de D1. Descobrir esse teto com jogadores
> dentro é bem pior do que pagar antes, e por isso sair do plano gratuito é
> item da **Fase 1** do Passo 9, não uma otimização para depois.

**Primária — Cloudflare.** Pages para o jogo estático, Workers para a API, D1
(SQLite) para os dados. Uma plataforma só, sem partida a frio, e o Worker roda
TypeScript — pode importar `sim/` e `data/` diretamente, que é o que o modelo B
precisa.

**Se quiser autenticação pronta — Supabase.** Postgres e Auth (e-mail e OAuth)
na camada gratuita, com o jogo continuando em Pages ou Netlify. Troca uma
plataforma por menos código de login.

**Render e Fly.io** servem, mas o serviço gratuito hiberna por inatividade — a
primeira requisição depois de um tempo demora, o que é ruim para um jogo que
salva de fundo.
