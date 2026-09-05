# Avaliação para o alfa — 04/09/2026

O que o jogo é hoje, com nota por sistema, e o que falta para pôr jogadores
dentro. Tudo abaixo foi **medido nesta data**, não lido de documento — quando um
número vem de registro anterior, está dito.

> **Veredito curto:** o jogo está pronto tecnicamente e **não está pronto
> socialmente**. O que impede o alfa não é bug nem falta de conteúdo — é que o
> jogador não consegue *guardar* a conta dele, e a curva o para no setor 4.

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

### Progressão e balanceamento — 4/10

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

### Conta e persistência — 3/10

**O bloqueador número um.** Entrar é um clique e cria conta anônima de verdade,
com id no servidor. Mas **não existe forma de vincular essa conta a um e-mail**.

Consequência: limpar os dados do navegador, trocar de máquina ou perder o
`localStorage` apaga o acesso a um progresso que continua existindo no servidor,
sem caminho de volta. Num alfa você pede horas de investimento a alguém — e hoje
não há como devolvê-las.

Isso já causa um efeito colateral visível: o chat diz *"Vincule uma conta e
escolha um apelido para conversar"*, prometendo um caminho que o jogo não tem.

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

### Bloqueadores — sem isto não convide ninguém

1. **Vincular a conta anônima a um e-mail.** Sem isso o alfa perde testador por
   acidente de navegador, e não há como recuperar. É `POST /auth/v1/user` no
   Supabase sobre a sessão anônima — pequeno em código, grande em consequência.

2. **Tornar a parede do setor 4 sobrevivível sem leitura perfeita.** A oferta de
   recuo funciona, mas chega depois de três mortes e depende de o jogador aceitar.
   Três saídas possíveis, em ordem de custo: afrouxar a curva entre os setores 3
   e 6; oferecer o recuo mais cedo; ou explicar a parede no tutorial da Galáxia.

### Deveriam entrar junto

3. **`slot_secundaria.webp` não existe** — o único dos dez soquetes sem arte.
   Responde 404 em produção, deixando um buraco na Anatomia.
4. **O texto do chat promete o que não há** — trocar enquanto a vinculação não
   existir.
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

**6,5/10 como jogo · 8/10 como projeto.**

A distância entre os dois números é o resumo honesto: a engenharia está à frente
do produto. Há um motor sólido, medido e documentado, servindo uma curva de
dificuldade que ainda para o jogador no setor 4 e um sistema de contas que não
sabe devolver o progresso a quem o perdeu.

Nenhum dos dois é trabalho grande. São os dois únicos que precisam estar prontos
antes de alguém de fora entrar.
