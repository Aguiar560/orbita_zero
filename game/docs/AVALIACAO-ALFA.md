# Avaliação para o alfa — 04/09/2026

O que o jogo é hoje, com nota por sistema, e o que falta para pôr jogadores
dentro. Tudo abaixo foi **medido nesta data**, não lido de documento — quando um
número vem de registro anterior, está dito.

> **Veredito, revisto ao fim de 04/09.** Os dois bloqueadores desta avaliação
> caíram no mesmo dia: a conta virou obrigatória com três portas (e-mail,
> Google, Facebook), e a dificuldade do setor 4 foi confirmada como
> **deliberada** pelo Rafael — não era defeito de curva, era o jogo.
>
> **Está pronto para um alfa fechado.** O que resta é configuração de painel,
> não engenharia: ligar os provedores OAuth no Supabase.

---

## Censo

| | |
|---|---|
| Cascos | 53 |
| Chefes · inimigos | 30 · 68 |
| Bases de item · afixos · conjuntos | 80 · 35 · 4 |
| Nós da Matriz · ramos | 177 · 8 |
| Recursos | 70 |
| Missões | 21 |
| Baús · trilhas | 4 · 3 |
| Testes · bundle | 2.035 · 554 KB JS + 277 KB CSS |

Produção no ar: site **200**, API **200**, chat **403** (barrando origem, como
deve).

---

## Notas por sistema

### Arquitetura e disciplina de código — 9/10

A melhor parte do projeto, com folga. Regras de camada guardadas por teste
(`sim/` e `data/` sem DOM, o que deixa o mesmo arquivo rodar no navegador, no
Node e no Worker). Zero dependência de produção. Cultura de medir antes de
afirmar, com ferramenta própria (`npm run simular`). Comentários que explicam
*por que a alternativa óbvia não serviu*.

O que tira o ponto: 2.035 testes concentram-se em regra e dado; quase nada cobre
render e interação, que é onde os defeitos desta semana apareceram.

### Progressão e balanceamento — 6/10

**O ponto mais fraco, e o que decide o alfa.** Medido hoje, uma hora por setor,
build representativo:

| setor | setores limpos | mortes | xp/s |
|---|---|---|---|
| 1 | 17 | 0 | 2,40 |
| 2 | 16 | 0 | 0,09 |
| 3 | 8 | 8 | 1,32 |
| **4** | **0** | **54** | 1,06 |
| **5** | **0** | **123** | 0,49 |
| 6–12 | 0 | 76 a 168 | 0,47–0,87 |

O jogo abre generoso e **fecha de vez no setor 4**. A amplitude de ganho é de
26× entre setores vizinhos, e não é monotônica — o setor 2 rende menos que o 1 e
que o 3.

Duas ressalvas honestas:

1. **A simulação modela quem nunca recua.** `failEncounter` só *oferece* recuar;
   quem aceita farma abaixo e volta. Medido antes (registrado no `PLANO`): setor
   5 sem recuo 0 setores/112 mortes, **com recuo 31 setores/6 mortes**. A saída
   existe e funciona.
2. Ela depende de o jogador **entender e aceitar** a oferta, que aparece só
   depois de três quedas no mesmo setor.

Ou seja: a parede é atravessável, mas o jogo cobra do jogador uma leitura
correta logo no primeiro obstáculo sério.

> **A dificuldade é deliberada — confirmado pelo Rafael em 04/09.** A nota subiu
> de 4 para 6 por isso: o que eu li como defeito de curva é a intenção do jogo,
> e a oferta de recuo é o mecanismo que a torna atravessável.
>
> O que ainda tira pontos é a **não-monotonicidade**: o setor 2 render menos que
> o 1 e que o 3 não serve a desenho nenhum, e atrapalha justamente a leitura de
> "ficou difícil porque avancei" que uma dificuldade deliberada precisa passar.

### Conteúdo — 8/10

Volume real e bem distribuído: 30 galáxias com elencos que não se repetem, 53
cascos com arquétipo, calibração e elemento próprios, 177 nós de Matriz.

O que destoa: **21 missões** é pouco para um idle, e são a principal fonte de
direção fora do combate. Quatro conjuntos de itens também é enxuto para 80 bases.

### Autoridade do servidor — 7/10

Dinheiro, itens, frota, XP, Matriz e materiais moram no D1. Livro-caixa
append-only com idempotência, coleta determinística por semente (o item nunca
sobe do cliente), save sem dinheiro dentro.

O que falta: o ganho **ao vivo** ainda é declarado pelo cliente. A Fase 5 passo 4
já **mede** (tabela `excedentes`, margem de 10× sobre o teto físico), mas não
recusa — e ligar a recusa depende de dados de jogadores reais, que só o alfa
produz. É a ordem certa.

### Conta e persistência — 8/10

> **Resolvido em 04/09.** A conta virou **obrigatória** e há três portas:
> e-mail com senha, Google e Facebook. Não existe mais entrada anônima.
>
> A decisão de tornar obrigatório só coube porque **ainda não há ninguém
> jogando** — nenhuma conta anônima ficou órfã. Depois do primeiro jogador isso
> seria uma migração, não uma escolha.

O que havia antes, e por que era o bloqueador número um: entrar era um clique e
criava conta anônima de verdade, com id no servidor — mas sem forma de
vinculá-la a um e-mail. Limpar os dados do navegador apagava o ACESSO a um
progresso que continuava existindo no D1, sem caminho de volta.

O que sobra hoje: **os provedores precisam ser ligados no painel do Supabase**
(cliente OAuth no Google e no Facebook, chaves coladas no painel, URL de retorno
autorizada). Sem isso os dois botões existem e falham — o e-mail funciona
sozinho, e foi verificado ponta a ponta em 04/09: criar conta devolve token na
hora, sem confirmação por e-mail no caminho.

### Onboarding — 6/10

O passeio de entrada existe (dez passos) e **catorze telas ganharam guia
próprio** em 04/09, com zoom, recorte e reabertura pelo "?".

Falta a outra metade do critério, que é de **ritmo**: introduzir uma decisão por
vez nos primeiros setores e não mostrar aba antes de existir motivo. Hoje o
jogador novo vê treze abas de uma vez — cinzas, mas visíveis.

### Interface — 7/10

Densa e consistente, com gramática de painel unificada. Ganhou nesta semana:
dicas nas linhas elementais, no combustível, na sincronia e na carga; aviso de
inventário cheio dizendo *o que foi feito com a peça*; confirmação ao abrir baú
sem espaço; filtro por tipo de peça.

Pesa contra: **acessibilidade parou no meio** — há foco visível, navegação por
teclado e alto contraste, mas nunca houve auditoria de teclado fluxo a fluxo nem
medição de contraste AA.

### Áudio — 5/10

Chegou agora e por isso a nota é baixa por *imaturidade*, não por defeito:
síntese de disparo e explosão por `AudioContext`, e três faixas de trilha com
troca pelo jogador e uma por galáxia.

Não foi julgado de ouvido em sessão longa. E o histórico pede cautela: a
primeira tentativa de som deste projeto foi descartada inteira porque quem a
escreveu não conseguia ouvi-la.

### Infraestrutura — 6/10

Vercel + Cloudflare Workers + D1, tudo no plano gratuito. Medido: ~33 linhas de
escrita por ciclo de 150 s, cortadas para ~17 pela coleta líquida. Isso dá:

| perfil | jogadores no gratuito |
|---|---|
| aba aberta 24 h | **~10** |
| 2 h por dia | **~122** |

Suficiente para um alfa fechado. O histórico de migrações do D1 se perdeu e foi
reparado em 04/09 — vale saber que ele *pode* se perder.

---

## O que falta para o alfa

### Bloqueadores — resolvidos em 04/09

1. ~~**Vincular a conta a um e-mail.**~~ ✅ Resolvido por decisão, e ela era
   melhor que a solução: em vez de dar saída à conta anônima, a **conta virou
   obrigatória**. Três portas — e-mail com senha, Google e Facebook — e nenhuma
   entrada sem dono. Só coube porque ainda não há ninguém jogando.

2. ~~**A parede do setor 4.**~~ ✅ Não era bloqueador: **a dificuldade é
   deliberada**. A oferta de recuo é o mecanismo previsto para atravessá-la.

### O que falta ANTES de convidar alguém

3. **Ligar Google e Facebook no painel do Supabase.** O código está pronto e os
   botões existem; medido em 04/09, `/authorize?provider=google` responde **400**
   porque o provedor está desligado. É trabalho de painel:

   - criar cliente OAuth no Google Cloud Console e app no Facebook Developers;
   - colar client id e secret em *Supabase → Authentication → Providers*;
   - autorizar a URL de retorno em *URL Configuration* — a de produção **e** a
     de desenvolvimento, senão só uma das duas funciona.

   Enquanto isso não acontece, o e-mail sustenta o alfa sozinho: verificado
   ponta a ponta, cria conta e devolve token na hora, sem confirmação no meio.

4. **`slot_secundaria.webp` não existe** — o único dos dez soquetes sem arte.
   Responde 404 em produção, deixando um buraco na Anatomia.

5. **Oito arquivos de `public/assets` não têm fonte** em `assets-static` (sete
   SVGs de elemento e o troféu do ranking). Somem no próximo `npm run assets` de
   quem for. Já sumiram uma vez em 04/09.

### Vale ter, não bloqueia

6. Ritmo de onboarding (esconder aba sem motivo, uma decisão por vez).
7. Auditoria de teclado e contraste AA.
8. Mais missões — 21 é pouco para sustentar direção num idle.

### Não fazer antes do alfa

- **Ligar a recusa do teto de ganho.** Ela depende de dados que só jogador real
  produz, e um teto calibrado em laboratório recusa o jogador novo na segunda.
- **Anunciar ranking premiado.** Decidido em 03/09 e continua certo: anunciar
  prêmio antes da Fase 6 convida exatamente quem sabe quebrar o que ainda não
  está protegido.
- **Plano pago do Cloudflare.** Com ~122 jogadores no perfil de 2 h/dia, o
  gratuito segura um alfa fechado. Reavaliar se aparecer gente deixando a aba
  aberta a noite toda.

---

## Nota geral

**7,5/10 como jogo · 8,5/10 como projeto.**

As notas subiram ao fim do dia porque os dois pontos baixos deixaram de ser
problema: a conta virou obrigatória com três portas, e a dificuldade do setor 4
foi confirmada como intenção, não como defeito.

A distância que sobra entre os dois números continua sendo o resumo honesto: a
engenharia está à frente do produto. O que separa o jogo de um beta não é
código — são missões, ritmo de onboarding e uma passada de acessibilidade.

Para o **alfa fechado**, falta ligar Google e Facebook no painel do Supabase e
desenhar um ícone de soquete que nunca existiu.
