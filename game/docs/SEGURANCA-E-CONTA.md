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

## Estado em 09/09/2026 — o que a proposta virou

O Passo 9 chegou à **Fase 5**. Fora do save e no D1: dinheiro, assinatura,
inventário, frota, XP, Matriz, materiais, setor alcançado, casco em campo,
semente do universo, missões e confiança. O detalhamento das rotas, das tabelas
e dos princípios está na **seção 12 do [`SISTEMAS.md`](SISTEMAS.md)**.

**Login.** Conta é obrigatória — não existe mais caminho para jogar sem sessão,
e o tipo de `Login.mostrar()` é a regra: ele resolve com a sessão, nunca com
`null`. Duas portas hoje: e-mail/senha e **Google** (Supabase OAuth em pop-up).
`Entrar` e `Criar conta` são caminhos separados na capa.

**Confirmação de e-mail.** Cadastro por e-mail/senha permanece inelegível para
todo recurso autenticado até o Supabase Auth devolver `email_confirmed_at`. A
API não confia em metadado enviado pelo navegador nem presume confirmação a
partir do JWT: depois de validar assinatura, emissor e expiração, consulta
`/auth/v1/user` com o token do próprio jogador. Save, sessão, compra, indicação,
admin e chat passam por essa porta. Configuração automática, indisponibilidade
do Auth ou resposta inconclusiva fecham o acesso. Contas sociais seguem a
confirmação autoritativa que o provedor entrega ao Supabase.

**Sessão única.** Depois do login, a aba reivindica uma instância própria no
D1. Se outra aba, navegador ou dispositivo já estiver ativo, a nova entrada
para e pergunta antes de assumir. Confirmar atualiza a instância no servidor;
o local antigo detecta a substituição pelo pulso e é encerrado, sem apagar o
token compartilhado do navegador. Um registro sem pulso por três minutos deixa
de bloquear a entrada, cobrindo encerramentos abruptos.

**Ritmo.** Dois baldes de fichas por natureza: `sincronia` (20 s, 12) para o que
o jogo faz sozinho e `acao` (20 s, 5) para o que o jogador clica, mais `marcas`
e `apelido`. Ver `server/src/ritmo.ts`.

**O que ainda NÃO está fechado, e é o que importa para um pódio premiado:** o
servidor reproduz o encontro e **precifica** o que o cliente declarou, mas quem
paga ainda é o número declarado, contido por um teto. A virada da chave é o que
falta da Fase 5.

**Uma fragilidade operacional, registrada porque custou caro em 08/09:** o
cliente engole toda recusa do servidor (`if (!r.ok) return null`), então uma
rota quebrada não produz sintoma nenhum do lado de cá — ela vira um número
plausível e errado na tela do jogador. Isso é hoje o maior risco do sistema, e
está como bloqueador 1 na [`AVALIACAO-ALFA.md`](AVALIACAO-ALFA.md).

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

## Indicações e dados de compra

O link de convite carrega somente um código aleatório de dez caracteres. Ele não
codifica UUID, e-mail ou apelido. O código fica no armazenamento local apenas
até a primeira sessão; o vínculo definitivo é criado no Worker a partir do JWT
validado pelo Supabase. Metadados editáveis do usuário não participam da
atribuição.

Uma conta só pode decidir uma vez. Contas antigas são seladas como
`preexistente`, autovínculo é recusado e contas de teste não entram no programa.
A comissão financeira nasce exclusivamente de uma compra aprovada pelo
provedor, equivale a 10% dos centavos pagos, fica retida por sete dias e possui
chave idempotente. Reembolso gera reversão auditável; se já tiver sido sacada,
vira dívida financeira compensada antes de novas liberações. A carteira de
cristais nunca participa desse acerto.

Chaves Pix são validadas, cifradas em AES-GCM com segredo fora do repositório e
exibidas mascaradas. Cada saque guarda uma fotografia cifrada; somente a rota
administrativa autorizada decifra. Cada solicitação exige no mínimo R$ 15,00
de saldo liberado e bloqueia outra por sete dias completos. O perfil mostra
apenas agregados. Política
de privacidade e termos devem informar finalidade, retenção, pagamento,
reembolso, tratamento da chave, proibição de contas artificiais e atendimento
antes de `INDICACOES_ATIVAS=1`.

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
