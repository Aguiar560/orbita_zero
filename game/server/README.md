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
2. Anotar a **Project URL** (`https://<ref>.supabase.co`).
3. Em **Authentication → Providers**, ligar e-mail (e o que mais quiser).
4. Conferir em **Settings → API** que a assinatura de JWT é **assimétrica**
   (ES256). Se o projeto ainda estiver em HS256, migrar antes — o Worker só
   aceita ES256, de propósito.

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
