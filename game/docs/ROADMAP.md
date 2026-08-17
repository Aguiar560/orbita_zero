# Roadmap — Órbita Zero

Documento **vivo**: atualizado a cada etapa concluída. É a resposta para "onde
estamos e o que vem agora".

Os dois documentos ao lado não são isto:
[`ESPECIFICACAO-MESTRE.md`](ESPECIFICACAO-MESTRE.md) é a fonte de verdade de
design, e [`FASE-0-AUDITORIA.md`](FASE-0-AUDITORIA.md) é o diagnóstico de um
momento — o ponto de partida, que não se reescreve.

**Última atualização:** 17/08/2026 · 176 testes passando · typecheck e build limpos.

---

## Onde estamos

```
Etapa 0  ██████████  concluída
Fase 1   ██████████  concluída
Fase 1B  ██████████  concluída — morte, progresso e permanência
Fase 2   ██████████  concluída — combate elemental
Fase 3   ░░░░░░░░░░
Fase 4   ░░░░░░░░░░
Fase 5   ░░░░░░░░░░
```

**Próxima:** Fase 3.6 — a décima categoria, Upgrades Gerais (§11).



---

## Etapa 0 — Rede de segurança ✅

Bloqueava todas as outras: sem controle de versão e sem forma de medir, qualquer
mudança de balanceamento seria fé.

| # | Tarefa | Onde |
|---|---|---|
| 0.1 | ✅ Repositório, `.gitignore` de lista branca, `.gitattributes` | `276369c` |
| 0.2 | ✅ Vitest com testes de determinismo, limites, raridade, saves | `c456541` |
| 0.3 | ✅ Arnês de simulação em Node — `tools/lib/balanco.ts`, `tools/simular.ts` | `c456541` |

---

## Fase 1 — Fundação de dados

| # | Tarefa | Estado |
|---|---|---|
| 1.1 | Tetos de sanidade do §40 em `data/balance/limites.ts` | ✅ `f6cbac6` |
| 1.2 | Curvas centralizadas em `data/balance/curvas.ts` | ✅ `f6cbac6` |
| 1.3 | Inverter a dependência: `hpDaOnda = poderEsperado × tempoAlvo` | ✅ `72c849e` |
| 1.4 | Calibrar por simulação, com corrida do zero como prova | ✅ `72c849e` |
| — | Densidade e pressão como eixos de dificuldade (§16) | ✅ `82b4347` |
| 1.5 | Sete raridades, Comum → Divino (§9) | ✅ |
| 1.6 | ✅ Tiers de atributo T1–T10 (§6) | `data/balance/tiers.ts` |
| 1.7 | Orçamento e peso de atributos (§7) | ✅ |
| 1.8 | Nível de personagem 1–300 (§17) | ✅ com a 1B.3 |
| 1.9 | Nível de nave 1–300, sem transferência (§17, §18) | ✅ com a 1B.3 |
| ~~1.10~~ | ~~Save v4 + migração~~ — cancelado: o save é descartável no desenvolvimento | — |

### Fora do plano, feito no caminho

Duas remoções que a especificação pedia e que não dependiam de mais nada:

| Tarefa | Onde |
|---|---|
| Remover o menu Melhorias (§31) | `dc6ec0b` |
| Remover os Power Ups de batalha (§30) e tornar o dano normal irresistível | `857c2cc` |

### 1.6 — Tiers de afixo T1–T10 ✅

`tierMax` existia na tabela de raridades desde a Fase 1 e **nunca era lido pelo
gerador** — só um teste conferia que a coluna era monótona. A magnitude de uma
linha vinha de duas fontes ao mesmo tempo: uma rolagem uniforme dentro da faixa
do afixo, multiplicada pelo `power` da raridade. Nenhuma das duas aparecia na
ficha, então dois Épicos com "+Dano" podiam diferir 3× sem nada explicando por quê.

| O quê | Onde |
|---|---|
| Escada de magnitude, portões por ilvl, janela de tiers | `data/balance/tiers.ts` |
| `rollAffix` sorteia tier; `power` sai de cena | `sim/loot.ts` |
| `Affix.tier` opcional — saves antigos não quebram | `sim/types.ts` |
| Etiqueta `T4` na ficha, coluna alinhada | `ui/ItemCard.ts` |

**A decisão que estruturou tudo:** o tier **substitui** `power` como controle de
magnitude da raridade. Deixar os dois multiplicando faria a raridade contar duas
vezes e um Divino T10 sairia 7× acima do que a curva de poder pressupõe. A
raridade continua mandando em três eixos — quantas linhas, até onde elas sobem
(`tierMax`) e a chance de conjunto —, mas a magnitude POR LINHA é do tier.

A escada é geométrica de 1,0 a 7,0, de propósito a **mesma** que o `power` das
sete raridades percorria. Assim o teto do jogo não se move: o que muda é que
chegar nele passa a ser uma rolagem.

**A janela de 4 tiers** é o que impede o fim do jogo de continuar soltando T1.
Sem ela um item de ilvl 270 sortearia entre dez tiers e quase sempre cairia num
baixo — itens de nível alto ficariam piores que os de nível médio.

> **Bug pego pelos próprios testes:** o vetor de pesos estava invertido. Ele é
> indexado pela distância até o TETO, então `[4,3,2,1]` dava ao tier máximo o
> peso mais alto e ele saía na maioria das linhas — justo onde deveria ser
> conquista. Com `[1,2,3,4]`, o teto sai em 10% das linhas.

**Recalibragem.** Tornar o topo uma rolagem enfraqueceu o jogador médio, e a
primeira medição acusou o setor 295 como IMPOSSÍVEL (7,1 golpes contra o piso de
10). Remedido com `npm run simular -- ajustar`:

| | antes | depois |
|---|---|---|
| `PODER_A` · `PODER_P` · `PODER_C` | 2,118 · 2,7626 · 1,5 | 1,022 · 2,7999 · 2,5 |
| `DEFESA_A` · `DEFESA_P` · `DEFESA_C` | 81,525 · 1,2485 · 0,5 | 48,121 · 1,2757 · 1,5 |
| divergência ofensiva em 299 setores | 19× | **6,7×** |
| divergência defensiva | — | **4,2×** |
| setores fora da faixa | 1 (IMPOSSÍVEL) | **0** |

O coeficiente caiu pela metade e o expoente quase não se moveu (2,7626 →
2,7999): a FORMA da curva não mudou, só a altura. R² 0,9939 e 0,9907.

Verificado no navegador: as etiquetas saem como `T4 +146 Dano`, `T5 +116 Dano`,
`T3 +667 Escudo`. Os 331 afixos do save antigo, sem o campo, renderizam sem
etiqueta e sem erro — que é o contrato do `tier?` opcional.

**Dívida que esta etapa NÃO resolveu.** A dispersão dentro da mesma raridade
(§7) subiu de 135× para 570× na medição, mas o número está contaminado: o piso é
~0 porque `powerScore` é cego a vários atributos, e a razão máx/mín amplifica
isso. Consertar a métrica é pré-requisito da **1.7**, senão o orçamento de poder
será calibrado contra um medidor quebrado.

### 1.7 — Orçamento e peso de atributos ✅

**O medidor foi consertado e ele achou um buraco maior que o orçamento.**

`powerScore` enxergava 9 dos 27 atributos. Perfuração, explosão, velocidade,
sorte, as três rendas e as cinco resistências valiam **zero** na comparação de
itens — o auto-equipar descartava uma peça de resistência pura como se fosse
vazia, e a dispersão do §7 media a cegueira do medidor, não a dos itens.

Agora cada coeficiente entra ONDE o atributo age (`data/balance/orcamento.ts`):
perfuração e explosão no dano contra a onda, velocidade e resistência na
sobrevivência, sorte e renda num fator próprio. A forma continua sendo PRODUTO
(`√dps × √vida`) e não soma ponderada — é o que faz um canhão de vidro pontuar
abaixo de uma nave equilibrada.

> **Nove afixos estavam mortos.** Os seis `pot_*` (potência elemental) e as três
> rendas eram `kind: 'mul'` sobre atributos de base zero. A conta era
> `(0 + 0) × (1 + 0,26) = 0`: nada alimenta o lado `add` desses atributos — nem
> casco, nem conjunto, nem matriz. Eles rolavam, apareciam na ficha como "+18%
> de dano de fogo" e não faziam **nada**. Todos são consumidos como `1 + x`, ou
> seja, já são a fração: viraram `add`. As três rendas entraram junto em
> `ATRIBUTOS_FRACIONARIOS`, senão passariam a escalar com o nível de item e
> "+6% de sucata" viraria +580% no fim do jogo.
>
> Medido depois: os elementais foram de 6,7 (idêntico a não ter afixo) para 23.

Novo comando de medição: `npm run simular -- afixos <ilvl> <tier>` dá o valor
marginal de cada afixo isolado. É o instrumento que faltava para o orçamento
existir.

| medida | antes | depois |
|---|---|---|
| atributos que a nota enxerga | 9 de 27 | **27 de 27** |
| afixos inertes | 9 | **0** |
| piso da dispersão por raridade | 0,0 (falso) | 2,2 |
| divergência da curva | 6,7× | **5,8×** |

Nenhum setor fora da faixa, então **não** foi preciso recalibrar as curvas.

#### O medidor mentiu de novo — e o diagnóstico virou do avesso

A primeira leitura ("afixo bruto escala com ilvl, fracionário não; a diversidade
morre") estava **errada**. Era artefato de medir um afixo isolado sobre uma nave
**nua**: afixo multiplicativo vale em proporção à base que multiplica, então
`+15% de dano crítico` sobre dps quase zero parecia lixo.

Refeita a medição contra uma nave **montada no nível** — que é o contexto em que
a escolha acontece —, tudo inverte:

| afixo | nave nua | nave montada |
|---|---|---|
| `dano_f` | 22,96× a mediana | **1,67×** |
| `pot_fogo` | 1,41× | **4,84×** |
| `crit_d` | 0,50× | **2,47×** |

**A causa real são CANAIS.** O dano tem três canais de multiplicação — `add
dano`, `mul dano` e a potência elemental — e o valor de uma linha depende de
quão cheio já está o canal que ela alimenta. `mul dano` acumula com casco,
conjuntos e matriz num somatório grande, então mais 63% ali muda pouco. A
potência elemental **não recebe de mais ninguém**: cada ponto quase dobra o dano
sozinho. Ao consertar os seis `pot_*` na primeira metade, eu os tornei os
afixos mais fortes do jogo sem perceber.

Faixa de `pot_*` de 0,07–0,26 para **0,02–0,08**. Medido depois: 4,84× → **1,67×**,
o mesmo que `dano_f`. Dispersão no fim do jogo 38,5× → **23,1×**, e o núcleo dos
afixos (fora contagem e utilidade) fica entre 0,7× e 2,7× — cerca de 4×, faixa
saudável. Curva conferida: 6,3×, zero setores fora da faixa.

#### O que fica registrado e não foi mexido

**Quatro afixos morrem no fim do jogo por saturação de teto.** Numa nave montada
no ilvl 270, `cadencia_p`, `crit_c`, `expl_f` e `sorte_f` dão ganho **zero**: a
nave já está em cadência 20, crítico 95%, explosão 260 e sorte 5, que são os
tetos do §40. Um Divino de sete linhas pode rolar quatro linhas mortas.

Não é bug de fórmula — os tetos são deliberados. É problema de *experiência de
drop*, e a correção mexe em teto ou em elegibilidade de afixo por nível. Fica
para a Fase 3 (orçamento de item), com o número já medido.

Os afixos de **contagem** (`proj_f` 4,28×, `perf_f`, `expl_f`) ficam acima da
faixa de propósito: pesos 9 contra 100 do `dano_f`. A raridade já os precifica.

---

## Fase 1B — Morte, progresso e permanência

Bloco pedido em 16/08/2026. Muda a natureza do jogo: hoje morrer custa pouco e o
setor avança sozinho; a intenção é que morrer doa e que o avanço venha de matar.

Vem **antes da Fase 2** porque redefine o que o combate significa — implementar
dano elemental sobre um sistema de progresso que vai mudar é retrabalho certo.

### 1B.1 — Progresso por ABATE, não por dano ✅

Hoje o encontro é um poço de vida que drena a cada golpe: `applyDamage` credita
o dano ao `hpPool`, e quando o poço zera a onda acaba **com inimigos ainda
vivos na tela**. Fica estranho, e é o que o pedido aponta.

O modelo de poço existe por um motivo que não pode ser perdido: antes dele, os
inimigos que escapavam pela base da tela limpavam a onda de graça. A substituição
precisa resolver os dois lados — o avanço vem de abate, e quem escapa não conta.

> **Evidência do problema, medida.** Setor 4, onda de elite: o poço marcava
> 435 de 970 enquanto as três naves em tela estavam com vida cheia. Os inimigos
> desciam e saíam pela base, o diretor repunha a onda inteira, e o jogador de
> nave nua (24 de dano por segundo) nunca fechava a conta — 90 minutos, 67
> mortes, zero itens coletados.

**Como ficou.** `run.hp/hpMax` viraram `run.restam/unidades`, e o crédito saiu de
`applyDamage` para `killEnemy`. O caminho abstrato converte dano por segundo em
abates por segundo, para os dois medirem a mesma coisa. Quem escapa pela base
volta para a fila do diretor **com a vida que lhe restava**.

Essa última parte não estava no plano e é o que faz a peça funcionar: na
primeira tentativa o fugitivo voltava curado, e isso apagava o trabalho do
jogador. Medido: cinco minutos na onda de elite do setor 3 com **zero abates e
35 escapes**, `restam` congelado em 2 de 2. Um casco que não cai numa passagem
também não cai na seguinte, e o encontro nunca terminava.

Verificado depois: com o disparo desarmado, 104 inimigos escaparam em 60
segundos e o progresso ficou em zero — escapar não é atalho. E `restam` chega a
zero sempre com a tela limpa.

> **Efeito colateral no ritmo.** A corrida do zero passou de setor 10 em 40
> minutos para **setor 7 em 60 minutos**. Vai na direção da meta do §2 (dez
> horas por galáxia) sem que ninguém tenha mexido em curva — o jogador agora
> paga pelos inimigos que deixa passar.

### 1B.2 — Recursos só ao concluir o SETOR ✅

Sucata, núcleos e cristais de combate deixaram de ser creditados por onda. Ficam
em `run.carga` e só entram no banco quando o setor inteiro cai; morrer no meio
perde tudo o que está lá.

A renda de PATRULHA continua indo direto para o banco: ela é a camada ociosa e
não faz parte da incursão, então não faz sentido pô-la em risco.

A carga aparece no cockpit, com quantas ondas faltam para garanti-la. Perder só
é risco se o jogador souber o tamanho do que está em jogo antes de morrer —
escondida, seria surpresa.

Medido: morrer com 5.360 de sucata e 1.127 núcleos na carga zerou os dois e
deixou o banco intacto.

### 1B.3 — Morte muito punitiva ✅

Puxou junto as tarefas **1.8 e 1.9**: a perda incide sobre a faixa de XP entre
um nível e o próximo, então os níveis precisavam existir primeiro.

**Níveis.** `command.level` virou `command.nivel` e passou a ser o nível de
personagem do §17 — patente e nível sempre foram a mesma coisa, e separá-los
criaria dois eixos idênticos. Cada nave ganhou `nivel`/`xp` próprios em
`state.naves`, sem transferência: trocar de casco recomeça a progressão dele, e
é isso que dá sentido a manter uma frota. O nível da nave amplifica os atributos
DELA, não os do equipamento.

As curvas viraram **polinomiais**. Com a exponencial antiga o nível 300 custaria
7 × 10²⁰ de XP e o teto do §17 seria decorativo.

**Verificado numa corrida do zero de duas horas:** setor 8, 24 mortes, nível 6
de personagem e 9 de nave, 44 itens, dano por segundo de 24 a 596. A sucata
recuou entre os minutos 100 e 120 — é o imposto da morte aparecendo.

> O risco do empate **não se materializou**. Voltar à onda 1 funcionou desta vez
> porque o terreno mudou: com progresso por abate e itens acumulando, o jogador
> recupera o setor mais rápido do que a morte o atrasa.

**Nível 6 em duas horas é o desenho, não um problema.** Confirmado em 16/08/2026:
a progressão é para ser lenta, e o nível 300 é para custar **semanas de jogo**.
Isso reclassifica a pendência que estava anotada aqui — o ritmo lento deixa de
ser dívida e vira critério de aceite: qualquer mudança que faça o nível subir
rápido está errada, mesmo que pareça mais gostosa nas primeiras horas.

Pendência de calibragem que continua de pé: o caminho abstrato (janela fechada)
ainda não modela morte, então render mais que jogar ficou pior agora que morrer
custa caro.

### 1B.3 — o pedido original

| Perda | Detalhe |
|---|---|
| Progresso do setor | Volta para a onda 1 e refaz o setor inteiro |
| XP do personagem | −15% do acumulado **dentro da faixa do nível atual** |
| XP da nave | idem, na faixa do nível da nave |
| Nível | Se o XP cair abaixo do piso do nível, **desce de nível** e continua perdendo na faixa anterior |
| Matriz | Ao perder nível, o **último ponto alocado** é devolvido |
| Carga da incursão | Todos os recursos coletados no setor são perdidos |
| Sucata em banco | Perde uma parcela do que já estava guardado |
| Itens | **Não se perdem** — o que caiu, caiu |

Exemplo dado, que vira o teste: nível 10 começa em 1000 de XP e o 11 exige
1400. Com 1200 de total, o acumulado na faixa é 200, e a morte tira 30 (15% de
200). Se o total chegar a 1000 ou menos, cai para o nível 9 e as perdas
seguintes passam a incidir sobre a faixa de 9 → 10.

Confirmado em 16/08/2026: **15%** nas duas quedas, inclusive após perder nível.

> ⚠️ **Risco conhecido.** Voltar à onda 1 do setor foi tentado e removido no
> commit `72c849e`: com as ondas dimensionadas por tempo, a regressão criava
> empate — o piloto avançava e recuava no mesmo ritmo e passava quarenta
> minutos no mesmo setor. Só volta a funcionar se a curva de dificuldade e a
> aquisição de itens estiverem calibradas para o jogador **vencer** o setor na
> maioria das tentativas. Precisa de simulação antes de fechar.

### 1B.4 — Chefes de verdade ✅

O chefe deve exigir farm dos setores anteriores — item e nível — em vez de cair
na primeira tentativa. Valia 3,5 ondas comuns (`CHEFE_ONDAS`), pouco para um
marco de galáxia.

| O quê | Onde |
|---|---|
| `CHEFE_ONDAS` 3,5 → 5 | `data/balance/curvas.ts` |
| `CHEFE_EXIGENCIA` = 1,6 — multiplica vida **e** dano do chefe | `data/balance/curvas.ts` |
| Trava de fase: `settings.repetirSetor` | `sim/types.ts`, `sim/index.ts` |
| Botão da trava no mapa de fases e nos ajustes | `ui/panels/GalaxyPanel.ts`, `SettingsPanel.ts` |

`CHEFE_EXIGENCIA` multiplica os dois eixos de propósito: só vida faria uma luta
longa, só dano faria uma loteria. Juntos, exigem equipamento para aguentar e
para derrubar.

**A trava foi o que faltava para o pedido ser honesto.** Medindo uma corrida do
zero, o jogador empacou no setor 10 — 62 mortes, dps caindo de 420 para 398 em
dez minutos. Travar no chefe e voltar a farmar é o desenho pretendido, mas num
jogo ocioso quem joga é o laço: sem a trava, farmar exigiria voltar ao mapa e
reclicar a fase a cada volta. Ligada, a incursão refaz a mesma fase ao vencê-la.
O que a vitória rende não muda — recompensa, XP, drops e a liberação do setor
seguinte continuam iguais; ela segura só o ponteiro da incursão.

Decidido junto: a morte **não** regride o setor sozinha, e não existe recuo
automático. Escolher onde jogar é do jogador.

### 1B.5 — Aba em segundo plano não é ausência ✅

Feito. A aba oculta continua simulando; ausência é só janela fechada.

`requestAnimationFrame` congela em segundo plano, então não bastava deixar de
parar o laço — foi preciso um segundo relógio. O avanço é calculado pelo relógio
de PAREDE decorrido e não pelo número de chamadas, então o estrangulamento que o
navegador aplica a `setInterval` não atrasa o jogo: um tick que demorou um
segundo processa um segundo de simulação.

Medido: três segundos ocultos produziram três segundos de jogo, sem desvio.

---

## Fase 2 — Combate

Depende da Fase 1: sem tiers e sem orçamento de poder, o dano elemental não tem
como ser dimensionado.

| # | Tarefa |
|---|---|
| 2.1 | ✅ `DamagePacket` — normal e elemental separados (§3) |
| 2.2 | ✅ Combate refatorado para o pacote |
| 2.3 | ✅ Matriz configurável em `data/balance/elemental.ts` |
| 2.4 | ✅ Dois críticos, rolados à parte |
| 2.5 | ✅ Penetração com teto de 0,8 |
| 2.6 | ✅ Pipeline de `tiros e explosoes.png` — atlas `elemental`, 117 sprites |
| 2.7 | ✅ Projéteis, impactos e explosões por elemento (§22) |

---

## Fase 3 — Itemização

| # | Tarefa |
|---|---|
| 3.1 | ✅ Pipeline de `novos itens.png` — atlas `itens-novos`, 140 ícones |
| 3.2 | ✅ Afinidade de slot: cada categoria puxa a própria família de afixo |
| 3.3 | ✅ `calibre` por afixo, medido — dispersão 22,1× → 10,0× |
| 3.4 | ✅ Três degraus de projétil, com portão de raridade e exclusão mútua |
| 3.5 | ✅ Drop por REGRA — casa por padrão, aceita conteúdo futuro sem cadastro |
| 3.6 | Décima categoria: Upgrades Gerais (§11) |
| 3.7 | Filtros e ordenação do inventário (§28) |
| 3.8 | Separar inventário de itens do armazém de recursos (§29) |

---

## Fase 4 — Progressão

Integração da Matriz com o nível de personagem, curvas de XP calibradas,
requisitos de nível, e o balanceamento das galáxias contra as metas de tempo do
§2 — hoje a galáxia 1 leva 40 minutos e a meta é ~10 horas.

---

## Fase 5 — Conteúdo

Naves, inimigos, chefes, recursos por galáxia, crafting (§25), sacrifício e
fusão de itens (§26), missões (§27) e o modo de chefes de 100 pisos (§32–§35).
É onde o `content-data-agent` trabalha em volume, a partir de schemas já
aprovados.

---

## Dívidas conhecidas

Coisas medidas e registradas, que ainda não têm etapa marcada.

| O quê | Evidência | Onde resolve |
|---|---|---|
| **Ritmo de relógio 15× rápido** | galáxia 1 em 40 min; meta é ~10 h | Fase 4 |
| **Itemização torta na origem** | ofensiva cresce com expoente 3,70, defensiva com 1,10 | Fase 3 (orçamento) |
| **Dispersão de 135× entre itens da mesma raridade** | `simular item 30` | Fase 3 (orçamento) |
| **O jogador aguenta 1,09× a 1,50× os golpes que a curva pretende** | medido em 8 setores do regime estável; pior ponto no setor 50 | Fase 3 (orçamento) — é viés SISTEMÁTICO, não ruído |
| **`powerScore` é cego para vários atributos** | itens utilitários pontuam 0 e o auto-equipar erra | Fase 3 |
| **Anel elemental com deriva de 5%** | 1,5 × 0,7 = 1,05; a especificação propõe 1,25 × 0,80 | Fase 2 · decisão pendente |
| **Mortes acumulam muito no fim** | 141 mortes até o setor 13 numa corrida do zero | Fase 4 |
| **Nave nua trava em onda de elite** | setor 4: 90 min, 67 mortes, 0 itens — inimigos escapam pela base e a onda é reposta com vida cheia | Fase 1B.1 |
| **Offline rende ~20× mais que jogar** | 2 h fechado = 18 setores e 8.211 abates; ao vivo, o mesmo jogador leva 90 min para sair do setor 4. `abstractTick` usa `dps` puro: não erra tiro, não morre, não perde cápsula | Fase 1B.3 — ao modelar morte, o caminho abstrato precisa modelá-la também |
| **Escala de afixo fracionário** | crítico, sorte e sincronia escalavam com ilvl; sorte chegava a 3699% e o baú soltava Divino em metade dos itens | ✅ resolvido em `1.5` |
| **`sharp` com CVE de libvips** | `npm audit`; é ferramenta de build, não entra no bundle | etapa própria |

---

## Como verificar cada etapa

Os critérios de aceite completos estão no §6 da auditoria. Os comandos:

```bash
npm test                              # 48 testes
npm run simular -- curva 1 300        # dificuldade × poder, setor a setor
npm run simular -- ondas 40 42        # composição e variedade das ondas
npm run simular -- drops 200000       # distribuição real de raridade
npm run simular -- item 30            # dispersão de poder entre itens
npm run simular -- ajustar            # remede o poder e reajusta os expoentes
```

O último é o mais importante depois de qualquer mudança em afixos, cascos ou
Matriz: os expoentes em `curvas.ts` **descrevem** o jogo, e se o jogo mudar e
eles não, o ritmo desanda em silêncio.
