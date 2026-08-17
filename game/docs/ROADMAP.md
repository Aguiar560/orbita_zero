# Roadmap — Órbita Zero

Documento **vivo**: atualizado a cada etapa concluída. É a resposta para "onde
estamos e o que vem agora".

Os dois documentos ao lado não são isto:
[`ESPECIFICACAO-MESTRE.md`](ESPECIFICACAO-MESTRE.md) é a fonte de verdade de
design, e [`FASE-0-AUDITORIA.md`](FASE-0-AUDITORIA.md) é o diagnóstico de um
momento — o ponto de partida, que não se reescreve.

**Última atualização:** 16/08/2026 · 73 testes passando · typecheck e build limpos.

---

## Onde estamos

```
Etapa 0  ██████████  concluída
Fase 1   ███████░░░  5 de 7 tarefas
Fase 1B  ████████░░  4 de 5 — morte, progresso e permanência
Fase 2   ░░░░░░░░░░
Fase 3   ░░░░░░░░░░
Fase 4   ░░░░░░░░░░
Fase 5   ░░░░░░░░░░
```

**Próxima:** Fase 1B.4 — chefes que exigem farm. Depois dela, a Fase 2 (combate elemental).



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
| 1.6 | Tiers de atributo T1–T10 (§6) | ⬜ |
| 1.7 | Orçamento e peso de atributos (§7) | ⬜ |
| 1.8 | Nível de personagem 1–300 (§17) | ✅ com a 1B.3 |
| 1.9 | Nível de nave 1–300, sem transferência (§17, §18) | ✅ com a 1B.3 |
| ~~1.10~~ | ~~Save v4 + migração~~ — cancelado: o save é descartável no desenvolvimento | — |

### Fora do plano, feito no caminho

Duas remoções que a especificação pedia e que não dependiam de mais nada:

| Tarefa | Onde |
|---|---|
| Remover o menu Melhorias (§31) | `dc6ec0b` |
| Remover os Power Ups de batalha (§30) e tornar o dano normal irresistível | `857c2cc` |

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

Pendências de calibragem, não de mecânica:

- Nível 6 de personagem em duas horas. Para 300 níveis, a curva de XP precisa de
  simulação contra as metas do §2 — os expoentes atuais são primeira passada.
- O caminho abstrato (janela fechada) ainda não modela morte, então continua
  rendendo mais que jogar.

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

### 1B.4 — Chefes de verdade

O chefe deve exigir farm dos setores anteriores — item e nível — em vez de cair
na primeira tentativa. Hoje ele vale 3,5 ondas comuns (`CHEFE_ONDAS`), o que é
pouco para um marco de galáxia.

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
| 2.1 | `DamagePacket` — separar dano normal de elemental (§3) |
| 2.2 | Refatorar o protótipo elemental para o novo modelo |
| 2.3 | Matriz elemental gerada a partir do anel, configurável (§5) |
| 2.4 | Crítico normal × crítico elemental, separados (§4) |
| 2.5 | Resistência e penetração elemental (§4) |
| 2.6 | Pipeline de `tiros e explosoes.png` — 6 elementos × 8 categorias (§21) |
| 2.7 | Projéteis, impactos e explosões por elemento (§22) |

---

## Fase 3 — Itemização

| # | Tarefa |
|---|---|
| 3.1 | Pipeline de `novos itens.png` — 10 categorias × 7 raridades (§23) |
| 3.2 | `AffixDef` com tier, pesos e restrições (§6, §7) |
| 3.3 | Gerador de item com orçamento de poder |
| 3.4 | `+N projéteis` com as restrições do §8 |
| 3.5 | Tabelas de drop por galáxia, inimigo, chefe e exclusivo (§10) |
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
