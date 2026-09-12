# Servidor — Cloudflare Worker + Supabase Auth

API do Órbita Zero. Guarda o save por conta e, no passo seguinte, vai conferir a
plausibilidade do que recebe.

## Por que estas duas plataformas

**Cloudflare Worker para a API** porque ele roda TypeScript e este repositório
tem uma peça rara: `sim/` e `data/` não conhecem DOM nem canvas. O Worker pode
importar **as mesmas tabelas** que o navegador usa e derivar os tetos de
plausibilidade do mesmo lugar — sem cópia da fórmula para divergir.

**Supabase para o login** porque autenticação por senha feita à mão exige
Argon2id, limite de tentativas, recuperação por e-mail e rotação de sessão. É
muito código, e do tipo em que o erro não aparece em teste.

O Worker **não guarda segredo nenhum**. O Supabase assina os tokens com ES256 e
publica as chaves públicas num JWKS; o Worker confere a assinatura sozinho. Um
vazamento daqui não permite forjar token, porque a chave privada nunca sai do
servidor de autenticação.

## Camada gratuita — verificada em 2026-08-27

| | grátis |
|---|---|
| Workers | 100 mil requisições/dia · 10ms de CPU por chamada |
| D1 | 5 GB · 5M leituras/dia · **100 mil escritas/dia** |
| Supabase Auth | 50 mil usuários ativos/mês |
| Supabase DB | 500 MB · 2 projetos |

⚠️ **O projeto Supabase pausa após 7 dias sem uso.** Voltar é um clique no
painel, mas não serve para produção sem o plano pago.

### A conta que define `INTERVALO_MINIMO_DE_SAVE`

Mil registrados, uns oitenta simultâneos no pico, salvando a cada 60s dá cerca
de **115 mil requisições por dia** — estoura Workers *e* as escritas do D1.

A 120s cai para ~58 mil e cabe com folga. Num jogo idle isso quase não custa: o
progresso é função do TEMPO e o cliente recalcula o que passou desde o último
save. Perder dois minutos de relógio não é perder duas jogadas.

**A cadência de save é o orçamento.** Se um dia ela precisar cair, é o plano de
US$ 5/mês (10M requisições/mês) que paga, não uma reescrita.

## Subir do zero

Nenhum destes passos é automatizável por aqui — todos exigem sua conta.

### 1. Supabase

1. Criar projeto em supabase.com (plano gratuito).
2. Anotar a **Project URL**. O domínio é **`.supabase.co`**, não `.supabase.com`
   — o segundo nem resolve, e o erro apareceria só como falha de verificação.
3. Em **Authentication → Providers → Email**, ligar e-mail e **Confirm Email**.
   Conferir em `/auth/v1/settings` que `mailer_autoconfirm` responde `false`.
   Se responder `true`, o cliente bloqueia cadastros e o Worker bloqueia todas
   as rotas autenticadas para não aceitar confirmação automática como clique
   real do jogador. Para produção, configurar SMTP próprio; o SMTP padrão do
   Supabase é restrito e não deve ser tratado como serviço de produção.
4. Migrar a assinatura de JWT para **assimétrica**, em Settings → JWT Keys:
   **Migrate JWT secret** → **Rotate keys**. O projeto novo nasce em HS256
   (segredo compartilhado) e o Worker só aceita ES256, de propósito.
   Ninguém é deslogado: os tokens antigos continuam válidos até expirarem.
5. Depois da janela de expiração, **revogar** a chave HS256 antiga.

### 2. Cloudflare

```bash
cd game/server
npm install
npx wrangler login
npx wrangler d1 create orbita-zero
```

Copiar o `database_id` que ele imprime para o `wrangler.toml`, e trocar
`SUPABASE_URL` pela URL do passo 1.

```bash
npm run db:remoto     # cria as tabelas no D1 de verdade
npm run deploy
```

### 3. Conferir

```bash
curl https://orbita-zero-api.<seu-subdominio>.workers.dev/saude
```

Deve responder `{"ok":true,...}`. `/save` sem token deve dar **401**.

## Rodar local

```bash
npm run db:local      # cria as tabelas no D1 local
npm run dev
```

Verificado nesta máquina: `/saude` responde 200, `/save` devolve 401 sem token
e 401 com token inválido — a mesma resposta opaca nos dois casos, porque dizer
qual foi ajuda quem testa um ataque mais do que ajuda um cliente correto.

## Programa de indicações

A migração `0022-indicacoes.sql` cria códigos, decisões únicas, comissões,
carteiras financeiras, dados Pix cifrados, saques e marcos. O Worker calcula
10% do dinheiro efetivamente pago, em centavos, e libera após sete dias. A
carteira financeira é separada dos cristais; estes aparecem somente nos bônus
de 10/25/50/75/100 indicados que chegam ao nível 25. Reembolsos são
proporcionais e idempotentes.

Para habilitar o cadastro Pix, configure um segredo aleatório de pelo menos 32
caracteres com `wrangler secret put INDICACOES_PIX_SECRET`. A chave do jogador
é cifrada por AES-GCM e só a fila administrativa autorizada a decifra. O fluxo
de payout atual é manual: depois de realizar e conferir o Pix, o operador
registra a referência para baixar a reserva. Não existe chamada automática de
saída de dinheiro nesta versão.

O programa permanece desligado por padrão com `INDICACOES_ATIVAS="0"` em
`wrangler.toml`. A sequência de publicação é: aplicar a migração D1, publicar
Worker e cliente compatíveis, revisar termos/privacidade, homologar e só então
alterar a variável para `1`. A migração vem primeiro porque, mesmo com a flag
desligada, novas contas são seladas sem indicação para impedir vínculo
retroativo. Não aplicar a migração remota nesta etapa local.

Cada solicitação usa somente saldo já liberado, deve ser de pelo menos
**R$ 15,00** e abre uma janela móvel de sete dias completos. Durante esse
período a conta não pode criar outro pedido, mesmo que receba novo saldo; a
resposta da API informa quando a próxima solicitação estará disponível.

## No ar

```
https://orbita-zero-api.orbitazero.workers.dev
```

Medido em 27/08, contra o servico publicado:

| | |
|---|---|
| `/saude` | 200 |
| `/save` sem token | 401 |
| `/save` com token falso | 401 |
| `/nada` com token falso | 401 |
| CORS de `localhost:5180` | libera |
| CORS de origem estranha | nao devolve cabecalho |

A rota inexistente tambem responde 401, e nao 404: a autenticacao vem ANTES do
roteamento, entao um visitante sem token nao consegue mapear quais rotas
existem. 404 so aparece para quem ja provou quem e.

Depois do deploy o subdominio leva alguns minutos para o certificado sair — o
sintoma e um `TLS alert 40` (handshake failure), que parece erro de
configuracao e nao e. Saiu em 15s aqui.

## Verificado contra o projeto real

O JWKS mora em **`/auth/v1/.well-known/jwks.json`**, e não em `/auth/v1/jwks`.
O segundo existe e responde **401 pedindo cabeçalho `apikey`** — o primeiro é
público por desenho, e é ele que permite a este Worker não guardar credencial
nenhuma.

Isso foi descoberto testando, não lendo: o caminho errado estava escrito aqui e
teria falhado só na primeira tentativa de login, como `jwks 401`.

Medido em 27/08 contra `vzsiorkeykcbcpmismyy`:

| | |
|---|---|
| JWKS | 200 |
| chave | `e9172b00-…` · EC · ES256 · P-256 |
| import no WebCrypto | OK |
| emissor exigido | `https://vzsiorkeykcbcpmismyy.supabase.co/auth/v1` |

## O que ainda NÃO existe

- **Validação de plausibilidade.** É o próximo passo e o mais importante:
  guardar sem conferir já serve para sincronizar entre dispositivos, mas não
  para placar.
- **Placar.** Não entra antes da validação. Um placar que aceita o que o
  cliente relata é decoração, e publicá-lo cedo ensina o jogo errado a quem
  chega.
- **Resolução de conflito entre dispositivos.** Hoje a última gravação vence, o
  que perde progresso de quem jogou offline nos dois. Decisão de produto
  pendente.
