# Ambientes — produção, staging e local

> **Estado:** staging no ar desde 13/09/2026, com o `ORIGENS` da produção já
> fechado e as duas instalações marcadas. **Falta uma coisa:** o `VITE_CHAT_URL`
> na Vercel está valendo para todos os ambientes, então a preview entra no chat
> de PRODUÇÃO. Ver "O que falta".

## O problema que isto resolve

Até 13/09/2026 havia **uma instalação só, e ela era a produção**. Três fatos
que juntos não estavam escritos em lugar nenhum:

- `src/data/servidor.ts` tinha o endereço da API de produção fixo no código;
- abrir o jogo em `localhost` e entrar numa conta escrevia no D1 dos jogadores
  — save, inventário, carteira;
- o `ORIGENS` da produção já aceitava `orbita-zero-*.vercel.app`, então
  qualquer build de preview também escrevia lá.

A consequência prática é que **testar era publicar**, e todo defeito era
descoberto por um jogador.

## As três instalações

| | Worker | Banco | Quem chega |
|---|---|---|---|
| **produção** | `orbita-zero-api` | `orbita-zero` | orbitazero.com.br |
| **staging** | `orbita-zero-api-staging` | `orbita-zero-staging` | previews da Vercel, `localhost` |
| **local** | `wrangler dev` | D1 local | `localhost` |

O **Supabase é o mesmo** nas três, de propósito: o que se separa é o dado do
JOGO, não a identidade. Um Supabase próprio obrigaria a criar conta a cada teste
e tiraria do staging justamente o que ele precisa provar — que login,
confirmação de e-mail e token funcionam. Nenhum dado de jogo mora lá.

## Como o cliente decide para onde falar

`decidirApi`, em `src/data/servidor.ts` (a regra, pura) e avaliada em
`src/app/api.ts` (a leitura, do navegador). Três degraus, nesta ordem:

1. **`VITE_API_URL` declarada** → vence sempre, em qualquer host.
2. **Host local sem a variável** → **FECHA**. Nunca cai para produção.
3. **Qualquer outro host** → produção.

Fechado é `http://127.0.0.1:1` — loopback numa porta que nada escuta, que recusa
na hora. String vazia viraria caminho relativo e o 404 do servidor de dev seria
engolido como perda de dado; um domínio inexistente custaria espera de DNS a
cada chamada.

Quando fecha, o console explica com os comandos prontos e uma **faixa vermelha**
aparece na tela. Fora da produção, a faixa é permanente: **só a produção não se
anuncia**, e por isso a ausência de faixa passa a ser informação confiável.

## Como saber com quem se está falando

```bash
curl -s https://orbita-zero-api-staging.orbitazero.workers.dev/saude
```

```json
{"ok":true,"ambiente":"staging","banco":"orbita-zero-staging"}
```

`banco` vem de uma consulta ao próprio banco (tabela `instalacao`), não de uma
variável. É o que pega o erro que nenhuma outra coisa pega: um `database_id`
copiado errado faz o Worker se anunciar como staging **enquanto escreve na
produção**. Os dois bancos já receberam a migração `0028`, então cada um diz o
próprio nome; `sem marcador` passou a ser sinal de banco que ninguém preparou.

## Quem pode falar com quem

Medido em 13/09/2026, com o cabeçalho `Origin` em cada combinação:

| origem | → produção | → staging |
|---|---|---|
| `https://www.orbitazero.com.br` | **aceita** | recusa |
| `https://orbitazero.com.br` | **aceita** | recusa |
| `https://orbita-zero.vercel.app` | **aceita** | recusa |
| `http://localhost:5180` | recusa | **aceita** |
| `orbita-zero-git-*.vercel.app` | recusa | **aceita** |
| qualquer outro site | recusa | recusa |

A diagonal é o ponto: nenhuma origem alcança as duas.

Vale saber o limite disto: **CORS é trava de navegador.** Um `curl` ignora a
lista inteira, e quem autoriza de verdade é o token. Isto fecha o caminho do
ACIDENTE — que é o que vinha custando caro —, não o de um atacante.

## Rodar local contra o staging

```bash
cp .env.example .env.local
npm run dev
```

`.env.local` é ignorado pelo Git: o destino é escolha de cada máquina.

## Rodar local contra um Worker local

```bash
cd server; npm run db:local; npm run dev
```

E no `.env.local`: `VITE_API_URL=http://127.0.0.1:8787`.

## Publicar

```bash
cd server; npm run deploy:staging
```

```bash
cd server; npm run deploy
```

O segundo é a **produção**. Migração primeiro, deploy depois — sempre.

## Recriar o banco de staging

```bash
cd server; npm run staging:criar
```

Aplica `schema.sql` e todas as migrações em ordem, depois grava o marcador.
`schema.sql` sozinho **não** é o esquema: ele tem três tabelas e o resto do
banco nasceu nas migrações `0002..NNNN`.

## O que falta

**O chat ainda é compartilhado.** `VITE_CHAT_URL` está definida na Vercel para
todos os ambientes, então a preview carrega a mesma URL da produção — e o
`orbita-zero-chat` lê a tabela `apelidos` do banco de PRODUÇÃO
(`wrangler.chat.toml`). Um jogador de teste entra no chat real, conversando com
jogadores reais, e a mensagem fica gravada.

Não corrompe dado de jogo (o chat só faz `SELECT` na produção), mas não é
separado. A correção é uma linha na Vercel: mudar o escopo de `VITE_CHAT_URL`
para **Production apenas**. Um Worker de chat para o staging só vale a pena se
um dia for preciso testar o próprio chat.

**Os dois projetos Vercel.** `orbita_zero` e `orbita-zero` constroem os dois a
cada push, e as variáveis de ambiente foram postas em um só. Conferir qual está
sobrando.

## O que já foi feito

- `ORIGENS` da produção fechado (13/09) — só o site entra.
- Migração `0028` aplicada nos dois bancos, então `/saude` responde o nome
  real de cada um.
- Variáveis de preview ligadas na Vercel com escopo **Preview**, confirmado
  pelo pacote de produção: ele foi construído com `VITE_API_URL` ausente.

## O que o staging deliberadamente não tem

- **cron**: o gatilho de cinco minutos avisa das recusas e varre cobranças Pix.
  Alerta vindo de banco sintético ensina a ignorar alerta, e aí o alerta da
  produção morre junto.
- **indicações**: `INDICACOES_ATIVAS = "0"`. Dinheiro de verdade não passa aqui,
  e o segredo Pix nunca é criado.
- **o domínio de produção no `ORIGENS`**: um cliente servido em
  orbitazero.com.br não tem motivo para falar com o staging.

## Por que `vars`, `d1_databases` e `triggers` são repetidos no bloco do staging

Porque wrangler **não** os herda em ambiente nomeado. Isso é a favor: um
esquecimento faz o deploy **falhar por falta de binding** em vez de fazer o
staging escrever silenciosamente no banco dos jogadores. Errar para o lado
barulhento é o desenho.

## Travas

`tests/ambiente.test.ts` guarda o que não pode voltar: host local sem variável
não fala com a produção, os dois bancos têm ids diferentes, o staging não move
dinheiro nem dispara cron, o domínio de produção não entra no `ORIGENS` do
staging, e `.env.example` não aponta para a produção.
