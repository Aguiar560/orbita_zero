# Avaliação do jogo — 09/09/2026

O que o Órbita Zero é hoje, com nota por sistema e o que ainda bloqueia pôr
jogadores dentro. Tudo abaixo foi **medido nesta data** com os comandos do
[`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md) §5 e com consultas ao D1 de produção.
Quando um número vem de registro anterior, está dito.

A avaliação de **04/09** continua no fim, como histórico — ela vale como o que
se sabia naquele dia, não como estado atual.

> **Veredito.** O jogo está **jogável de ponta a ponta e íntegro no essencial**:
> nada que vale poder é escrito pelo cliente. O que separa isto de um alfa
> fechado não é mais engenharia de jogo — é **operação**. O dia 08/09 mostrou
> que o sistema não tem como contar que está quebrado: quatro defeitos ficaram
> horas no ar sem sintoma no servidor, e o custo não foi o defeito, foi as horas
> até entender qual era.
>
> **Recomendação:** não abrir para testadores antes de fechar a observabilidade
> (bloqueador 1). Os outros dois são de qualidade, não de risco.

---

## Censo — medido em 09/09

| | |
|---|---|
| Cascos | 53 |
| Inimigos · chefes | 68 · 30 |
| Bases de item · afixos · conjuntos | 80 · 35 · 4 |
| Nós da Matriz · ramos | 177 · 8 |
| Recursos | 70 |
| Missões | **499** (eram 21 em 04/09; as cadeias geram o volume) |
| Galáxias × fases | 30 × 10 = **300 setores** · nível máximo 300 |
| Código | 51.700 linhas de TypeScript, sem dependência de produção |
| Servidor | 16 arquivos · 4.441 linhas · 14 migrações · 16 rotas |
| Testes | **1.325** em 134 arquivos · 2.470 asserções |
| Bundle | 647 KB JS (219 KB gzip) + 324 KB CSS (65 KB gzip) |

Produção agora: site **200** em 0,27 s, API **200**.

> Nota sobre o número de testes: o registro de 04/09 diz "2.035 testes". A
> contagem de hoje pelo relatório JSON do Vitest é **1.325 testes / 2.470
> asserções**. Não persegui a origem da diferença — provavelmente o número
> antigo contava `expect(`. Fica dito para não parecer regressão.

---

## Notas por sistema

### Arquitetura e disciplina de código — 8/10 *(era 9)*

Continua a melhor parte do projeto. Regras de camada guardadas por teste, zero
dependência de produção, e o acerto que mais rende: **o Worker importa `@sim` e
`@data`, os mesmos arquivos do navegador.** A regra que o servidor cobra é
literalmente a regra que o jogo aplica — não existe cópia para divergir. É o que
permitiu a Fase 5 *reproduzir* o encontro em vez de estimá-lo.

**Por que perdeu um ponto.** O sistema virou distribuído e a disciplina não
acompanhou em um eixo: **`src/app/*` devolve `null` em toda recusa**, e quem
chama cai no padrão. Indisponibilidade se disfarça de perda de dado — nível
zerado, nave errada, saldo zero, botão mudo. Isso não é um bug, é uma decisão de
desenho que era boa quando o cliente era autônomo e virou dívida quando ele
passou a depender de dez rotas.

### Integridade e antifraude — 8/10

Forte, e por princípios explícitos, não por remendos:

- **O item nunca sobe.** O cliente diz quantos pegou, nunca quais.
- **O nível é derivado**, nunca guardado. Idem a confiança dos contatos.
- **Toda mescla entre aparelhos é monotônica** — duas máquinas somam.
- O save que sobe tem dinheiro e frota **arrancados** (`semODinheiro`).

O que falta para 10: a **Fase 5 não virou a chave**. O servidor já reproduz o
encontro e precifica o que o cliente declarou — com piso de tempo por onda e
teto por réplica —, mas **quem paga ainda é o número que o cliente manda**. Até
a virada, o pódio premiado repousa sobre um teto, não sobre uma conta.

### Operação e observabilidade — 4/10 · **o elo mais fraco**

A nota mais baixa da avaliação, e a que mudou o veredito.

| o que aconteceu em 08/09 | quanto tempo no ar |
|---|---|
| `0013` não aplicada → `/progresso` 100% falho | ~3 h |
| auditoria de teto gravando zero linhas | desde que subiu |
| coleta envenenando o lote de comandos | indeterminado |

Nenhum tinha sintoma do lado do servidor, **porque um 409 é uma resposta, não um
erro**. E as ferramentas não ajudam: `wrangler tail` não resolve o host neste
ambiente, `d1_migrations` não registra as migrações aplicadas com `--file=`, e
migração e deploy são dois comandos manuais cuja ordem, se invertida, derruba
uma rota inteira em silêncio.

O que já melhorou: `o-esquema-do-servidor-existe.test.ts` impede publicar código
incoerente com as migrações, e toda recusa de fusão agora vira frase na tela
mais linha no console.

### Progressão e balanceamento — 6/10 *(inalterado)*

Medido hoje. A curva do meio e do fim está **boa**: de 22 a 300, limpar uma onda
leva de 11 a 35 s e morrer exige de 12 a 26 golpes — a coluna de veredito diz
`ok` em todas as amostras.

```
setor    DPS      vida ef.   HP da onda   seg  golpes
   1      25         193           18    0.7      88   trivial
  22     731         795        8.25K     11      26   ok
 106  67.80K      12.81K        1.89M     28      23   ok
 300   2.28M      44.32K       58.24M     26      15   ok
```

Crescimento composto por setor: DPS 1,0389 contra HP do inimigo 1,0514 —
divergência de 1,0120, ou **35× em 299 setores**, absorvida pelo equipamento. Do
lado defensivo, 1,0183 contra 1,0244: **6,0×**.

**O problema é a abertura, e é o mesmo de 04/09.** Amostras de cinco minutos:

| setor | setores limpos | mortes | xp/s |
|---|---|---|---|
| 1 | 1 | 0 | 0,46 |
| 6 | **0** | 8 | 1,75 |
| 11 | **0** | 12 | 4,23 |

O setor 1 é trivial (0,7 s por onda, 88 golpes para morrer) e por volta do 4 ao
11 o jogador para de avançar. O Rafael já disse que a parede do setor 4 é
**deliberada**; o que não está resolvido é ela chegar tão cedo e tão seca, e a
amplitude de 9,2× no ganho dentro dos primeiros doze setores.

### Conteúdo — 7/10

Volume real: 53 cascos com história e curiosidade obrigatórias por teste, 68
inimigos, 30 chefes, 499 missões, 177 nós, 30 galáxias com elemento derivado por
tabela. O Códex cobre seis catálogos.

O que segura a nota é **arte**, não regra:

- **1 inimigo comum de gelo e 2 de raio.** As galáxias desses elementos ficam em
  26–29% de presença elemental, contra 62% de média das demais. É a única
  limitação do sistema elemental hoje, e é de sprite.
- Os 100 chefes da Provação usam 6 sprites em rodízio.

### Interface — 7/10

Onboarding, tutoriais por tela, capa navegável, login separado de cadastro,
Google, menu de perfil, tooltip própria do jogo. A gramática de painel é
consistente e a densidade é boa.

**Perdeu ponto pelo que 08/09 expôs:** um botão `disabled` que engolia o clique,
um aviso desenhado atrás da camada que o pediu, uma dica que dizia o que fazer
sem dizer por que não estava feito. Todos os três eram invisíveis para a suíte.

### Som — 6/10

Síntese determinística de combate com perfil por casco, inimigo e elemento; 130
chefes com cadência própria; seis explosões elementais. **Música não existe.**

### Testes e verificação — 7/10

1.325 testes e uma cultura de medir antes de afirmar que é rara — o arnês em
Node importa o mesmo arquivo que o navegador roda, então a medição não pode
divergir do jogo.

**O buraco é grande e conhecido: zero cobertura de render e interação.** Não há
DOM na suíte. Os quatro defeitos de 08/09 foram de interação ou de operação, e
os testes que os pegam hoje leem o **fonte** (`z-index` no CSS, `disabled` no
painel) — melhor que nada, pior que um DOM.

---

## O que bloqueia o alfa

**1. Observabilidade — o único que é risco, não qualidade.**
Sem isso, o próximo defeito custa o mesmo que os de hoje, só que multiplicado
pelo número de testadores. O mínimo: a recusa do servidor virar aviso em toda
ação do jogador (feito para a fusão, falta o resto), e algum caminho para saber
que uma rota está falhando sem depender de alguém reclamar.

**2. A abertura do jogo — do setor 1 ao 12.**
O 1 é trivial e o 4 ao 11 é parede. Um testador novo passa a primeira hora
nesses doze setores; é a única parte do jogo que a maioria vai ver.

**3. A virada da chave da Fase 5.**
Enquanto o servidor precifica mas não paga, o ranking premiado está apoiado num
teto. Não impede um alfa fechado entre conhecidos; impede um pódio que vale
prêmio.

Fora dos bloqueadores, na ordem em que eu faria: **a fusão não cobra os núcleos
que anuncia** (dívida de economia, decisão do Rafael), os inimigos comuns de
gelo e raio, e uma camada de teste com DOM.

---

## Histórico — a avaliação de 04/09/2026

O documento anterior está preservado abaixo por valer como registro do que se
sabia naquele dia.

> **Veredito de 04/09.** Os dois bloqueadores daquela avaliação caíram no mesmo
> dia: a conta virou obrigatória com três portas, e a dificuldade do setor 4 foi
> confirmada como **deliberada** pelo Rafael — não era defeito de curva, era o
> jogo. "Está pronto para um alfa fechado. O que resta é configuração de painel,
> não engenharia: ligar os provedores OAuth no Supabase."
>
> Notas daquele dia: arquitetura 9/10, progressão e balanceamento 6/10. O censo
> registrava 21 missões e um bundle de 554 KB JS + 277 KB CSS.

O que mudou entre 04/09 e 09/09: o Passo 9 avançou da Fase 3 até a Fase 5
(inventário, frota, progressão, casco em campo, semente, missões e confiança
saíram do save), a capa e o login foram refeitos com Google, a onda passou a
retomar de onde parou, a vida parou de curar na recarga, os elementos das
galáxias foram redistribuídos — e os quatro defeitos mudos de 08/09 foram
encontrados e corrigidos.
