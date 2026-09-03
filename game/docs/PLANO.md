# Plano — onde chegar, e como

Documento **vivo e voltado para a frente**. O [`ROADMAP.md`](ROADMAP.md) guarda o
que já foi feito com as medições de cada etapa; este diz o que **falta**, em que
ordem, e por quê nessa ordem.

Cada item traz **critério de aceite mensurável** — não "melhorar o balanceamento",
mas "a razão golpes/alvo fica entre 0,8 e 1,2 em todos os setores medidos".

---

## O destino

Um idle/progression shooter **completo e lançável**: 300 setores de campanha, 100
pisos de Provação, 30 galáxias, progressão por item / craft / Matriz, e um laço
ocioso que recompensa voltar sem exigir que o jogador fique olhando.

**O que já está de pé:** as fundações. Combate elemental, itemização com
prefixo/sufixo e tiers, curvas calibradas contra o jogador real, morte, missões,
Provação, Laboratório de calibração, mais de 24.500 linhas de TypeScript e 527
testes. O registro da sessão de 24/08 está em
[`ATUALIZACAO-2026-08-24.md`](ATUALIZACAO-2026-08-24.md).

**O que falta:** conteúdo em volume (sobretudo as artes dedicadas dos chefes da
Provação) e o trabalho que separa "funciona" de "é um jogo" — som e onboarding.

---

## Estado por área

| área | estado | onde |
|---|---|---|
| Combate elemental | ✅ estável | `modes/vertical`, `sim/dano.ts` |
| Itemização | ✅ estável | `sim/loot.ts`, `data/balance/raridades.ts` |
| Curvas e ritmo | ✅ estável, medido | `data/balance/curvas.ts` |
| XP e nível | ✅ estável | `curvas.ts`, `sim/index.ts` |
| Morte | ✅ estável | `sim/morte.ts` |
| Missões | ✅ estável; 9 contatos, 4 rastreios e HUD discreto | `sim/missoes.ts`, `ui/panels/MissoesPanel.ts` |
| Provação | 🟡 funciona; 16 modificadores, restam as artes dos chefes | `data/provacao*.ts` |
| Matriz | ✅ estável | `sim/tree.ts`, `data/tree.ts` |
| **Baús** | ✅ reformados; chances próprias, assets e revelação animada | `data/chests.ts`, `ui/panels/ChestsPanel.ts` |
| **Loja** | ✅ Central de Serviços; logística, cotas e câmbio | `data/shop.ts`, `ui/panels/ShopPanel.ts` |
| **Craft de afixos** | ✅ Bancada própria; Prefixos/Sufixos e remodulação de linha | `data/balance/recalibracao.ts`, `ui/panels/AffixCraftPanel.ts` |
| Códex | ✅ chefes, inimigos/elites, cascos, itens, recursos/fontes e elementos | `ui/panels/CodexPanel.ts` |
| Conteúdo por galáxia | 🟡 elenco base pronto; falta variedade autoral contínua | `data/enemies.ts`, `hulls.ts`, `bosses.ts` |
| **Escada de cascos** | ✅ os 29 Spaceships 2.0 com setor, custo e escala medidos | `data/balance/cascos.ts` |
| **Som** | 🔴 **não existe** | — |
| **Onboarding** | 🔴 **não existe** | — |
| **Acessibilidade** | 🟡 base pronta; falta auditoria fluxo a fluxo | `ui/Shell.ts`, `ui/panels/SettingsPanel.ts` |
| **Personagens jogáveis** | ✅ quatro, com nave própria e 1,58% de dispersão de poder | `data/pilotos.ts`, `ui/EscolhaDePiloto.ts` |
| **Equipamento por nave** | ✅ cada casco com o próprio conjunto | `sim/stats.ts`, `ui/Anatomia.ts` |
| **Ajustes** | ✅ cinco abas; áudio declarado inerte | `ui/panels/SettingsPanel.ts` |
| **Densidade das ondas** | ✅ 10× no começo, XP invariante | `data/balance/curvas.ts`, `sim/progression.ts` |
| **Posturas de IA** | ✅ três, sem meio-termo | `modes/vertical/PilotAI.ts` |
| Migração de save | ✅ v9 normalizada | `sim/state.ts` (`SAVE_VERSION = 9`) |

---

## Os passos, em ordem

A ordem não é arbitrária. Cada bloco depende do anterior estar **medido e
estável**, senão fica impossível saber qual mudança moveu a curva.

---

### Passo 1 — Reformar os baús ✅

**Decisão já tomada pelo Rafael:** os baús passam a ter **percentuais próprios de
raridade**, e **a Sorte deixa de influenciá-los** — ela vale só no drop de setor.

**O que muda**
- `ChestDef.luck` e `ChestDef.floor` **saem**; entra uma distribuição explícita
  por baú (7 percentuais que somam 1).
- `openChest` para de passar a sorte do jogador para `rollItem`.
- `SORTE_EFETIVA_MAX` fica **órfão** — ele só existia para conter o produto
  `sorte × multiplicador do baú`. Removê-lo junto; guarda morto engana quem lê
  depois.

**Por que primeiro:** é a única mudança com decisão fechada e escopo pequeno, e
destrava medir a economia de raridade sem duas fontes concorrentes.

**Critério de aceite**
- Nenhum caminho de código passa `state` de Sorte para o sorteio de baú.
- A distribuição anunciada de cada baú bate com a medida dentro de 1% em 200 mil
  aberturas.
- Mesmo o baú mais caro mantém o Divino além de 1 em 100.000.
- `SORTE_EFETIVA_MAX` não existe mais em lugar nenhum.

**Risco:** o baú é uma das poucas fontes de item de raridade alta cedo. Medir o
volume de itens antes e depois; se cair muito, o ajuste é nos percentuais do
baú, não em devolver a Sorte.

**Concluído em 23/08/2026.** As quatro cápsulas agora têm distribuições
explícitas de Comum a Divino, independentes da Sorte. O Divino do baú mais caro
fica em 0,0008% — 1 em 125 mil por item. A tela foi refeita na gramática visual
da Provação, com quatro assets dedicados e sete assinaturas animadas de
raridade. As tabelas foram verificadas com 200 mil sorteios por cápsula.

---

### Passo 2 — Reformar a Loja ✅

Na auditoria original ela existia como ralo de recurso: Sucata acumulava com a
patrulha e Núcleos vinham também de desmanche. Isso mudou: venda de item agora
gera Sucata; Núcleos vêm do combate e possuem câmbio limitado na Loja.

**A restrição que não muda:** *"nada aqui é exclusivo — a loja compra tempo, não
poder que o jogo não dê de outra forma"*. Uma loja que venda poder viraria a
**quarta fonte de progressão**, e o invariante diz que existem três: item, craft
e Matriz.

**Decisão do Rafael:** opção A, Central de Serviços. A decisão partiu destas
duas linhas de conveniência, implementadas sem poder exclusivo:
- conveniência (espaço de carga, refazes da Matriz, tentativas de Provação)
- conversão de sucata em núcleos, com perda

**Critério de aceite**
- Nenhum item da loja concede atributo que o jogo não conceda por item, craft ou
  Matriz.
- Um teste que **falhe** se algum contrato de loja adicionar poder direto.

**Concluído em 23/08/2026.** A Loja virou **Central de Serviços**. Sorte, XP,
cura e multiplicadores permanentes de renda saíram do catálogo e também da
resolução de atributos. O contrato de carga agora concede de fato os quatro ids
idempotentes que a versão anterior apenas cobrava; compras antigas são
reconciliadas sem contar espaço duas vezes.

O catálogo aprovado na opção A ficou assim:

- quatro módulos permanentes de carga;
- reconfiguração da Matriz e recuperação de tentativa da Provação;
- sucata → núcleos, com perda e cota que cresce por nível;
- compra escolhida de cápsulas, pacotes futuros de cristais e Passe VIP de
  conveniência por 30 dias.

A compra das cápsulas foi centralizada na Loja; a abertura e as probabilidades
continuam exclusivamente na Câmara de Aquisição. Testes dedicados guardam os
contratos, incluindo o invariante de que nenhuma operação da Loja altera os
atributos resolvidos da nave.

### Passo 2.1 — Separar o craft de afixos ✅

A remodulação saiu da Loja e ganhou a **Bancada de Modulação**, uma camada
própria inspirada no princípio de craft por operação aplicado diretamente ao
item: inventário à esquerda, item e Prefixos/Sufixos no centro, protocolo,
pool possível, risco e custo à direita.

A operação substitui uma linha por outra naturalmente possível, preservando
raridade, ilvl, base, elemento, conjunto, tier e o lado Prefixo/Sufixo. O pool
continua respeitando slot, raridade mínima, elemento e grupos de exclusão.

---

### Passo 3 — Os 5 modificadores mecânicos da Provação ✅

Os cinco entraram como efeitos de cena com telegrafia e parâmetros limitados.

| modificador | o quê |
|---|---|
| invulnerabilidade | janelas cíclicas em que o chefe não recebe dano |
| zonas de perigo | círculos avisados por 0,75 s que ferem enquanto armados |
| clones | dois ecos com vida reduzida, sem recompensa ou progresso extra |
| barreira frontal | redução cíclica de dano, desenhada como semicírculo frontal |
| pontos fracos | núcleo móvel com dano ampliado, sem invalidar dano no casco |

Os cinco parâmetros são testados no catálogo; ciclos de invulnerabilidade e
barreira sempre deixam janela de resposta. A próxima validação de balanceamento
é a bateria completa com a PilotAI contra esses pisos, quando a Provação voltar
ao topo da fila.

---

### Passo 4 — Conteúdo em volume 🟡

É onde o `content-data-agent` trabalha, **a partir de schema aprovado**.

| o quê | hoje | alvo |
|---|---|---|
| inimigos | **68 ✅** | o bastante para 30 galáxias não se repetirem |
| chefes de galáxia | **30 ✅** | 30, um por galáxia |
| cascos | **49 ✅** | todas as 29 artes novas convertidas e catalogadas |
| arte dos chefes da Provação | 6 sprites em rodízio | 100 |
| Códex | **6 arquivos ✅** | chefes, inimigos/elites, cascos, itens, recursos/fontes e elementos |

**Critério de aceite**
- Ids estáveis e não-visuais em tudo (`weapon_plasma_mk3`, nunca o nome bonito).
- Nenhum sprite inventado: **conferir no manifesto**. Isso já passou por
  typecheck e por 324 testes duas vezes e a tela renderizou vazia.
- A galáxia N e a N+1 não compartilham a maioria dos inimigos.

**Primeira entrega do volume (24/08/2026).** As 99 artes classificadas de
`spaceships 2.0` entraram no pipeline (23 jogador, 26 inimigo, 50 chefe), mais
seis artes legadas. Os 20 chefes que faltavam receberam identidade, elemento,
fases e arte, fechando um chefe por galáxia. O Laboratório passou a expor o
catálogo completo e permite testar a arte separadamente dos atributos; os 26
novos inimigos e os demais cascos começaram como arte testável, sem números
provisórios contaminando a campanha.

**Segunda entrega do volume (24/08/2026).** As 26 naves inimigas agora têm ids
autorais, nome, facção, origem, elemento e ficha de combate. São 20 comuns e
seis elites distribuídos em elencos estáveis de seis comuns + três elites para
cada uma das 30 galáxias. Todas entram em circulação e vizinhas nunca
compartilham a maioria do elenco; os dois contratos são testes automatizados.
O total do bestiário subiu de 42 para 68.

**Terceira entrega do volume (24/08/2026).** Todas as 29 artes de jogador do
pacote viraram cascos reais. Elas foram distribuídas em sete arquétipos, seis
calibrações e seis famílias de tiro, todas na mesma faixa lateral T4. O Hangar
agora tem 49 cascos; os novos mantêm custo e setor de desbloqueio neutros e o
estado “Em calibração”, utilizável no Laboratório mas fora da campanha, para
que arte, tiro e combate fossem avaliados antes da progressão.

**Quarta entrega do volume (24/08/2026).** A bateria definitiva executou 261
combates reais — 29 cascos × Elite, Enxame e Cerco × três sementes. Vida,
escudo, velocidade, escala, dano, cadência, projéteis, perfuração e explosão
foram recalibrados. Nenhuma família de tiro lidera os três cenários. Os 29
cascos saíram de calibração e entram no Hangar de campanhas novas e saves
existentes; o desbloqueio definitivo continua para uma etapa futura. O Códex
agora possui seis arquivos e cobre todos os catálogos pedidos. A ficha completa
está em [`CATALOGO-CASCOS.md`](CATALOGO-CASCOS.md) e a medição em
[`RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md`](RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md).

Resta neste passo, quando priorizada, a arte dos chefes da Provação.

### Passo 4.1 — Calibração e QA de apresentação 🟡

**Vazamento entre quadros — resolvido em 25/08.** `spriteIcon` fazia do
elemento uma JANELA de `size × size` sobre o atlas inteiro, e o quadro desenhado
quase nunca preenchia essa janela: a escala encaixa a caixa ORIGINAL do sprite,
mas o que se desenha é o recorte aparado, menor. A sobra mostrava o vizinho.
Medido em `void/nave/casco_cheio`: **508 de 886 pixels opacos (57%) da janela
vinham de outros sprites**. Corrigido com `clip-path: inset` na borda do quadro.
`portraitIcon` já tinha o conserto desde antes — e o comentário dele descrevia o
bug —, mas ninguém voltou ao outro renderizador.

O Laboratório e a bateria de combate fecharam a calibração funcional dos
cascos, mas a entrega visual precisa de uma última passada deliberada, não de
novos remendos pontuais.

- Conferir, no navegador e em resoluções de uso, todos os retratos 3×4 do atlas
  `Characters`, principalmente recorte inferior e ausência de vazamento entre
  frames.
- Conferir a escada de confiança em todos os quatro tons de contato: borda,
  preenchimento e conectores devem compartilhar uma única cor sem criar halo
  estranho.
- Rodar Elite, Enxame e Cerco após qualquer alteração de hitbox/escala gravada
  pelo admin. A fonte de verdade é a tabela versionada, não o save local.

**Critério de aceite:** nenhum frame vizinho aparece no retrato; o rastreador
não introduz barras laterais nem painel opaco; e o conjunto de confrontos não
regrede depois de nova calibração.

---

### Passo 4.2 — O jogo precisa PARECER um shooter 🟡

Auditoria de direção de arte feita em 26/08, com quadro capturado em combate e
medição no canvas. A passada anterior (Passo 4.1 e a direção visual) tratou do
FUNDO. Esta trata do que o jogador de fato olha.

Três medições mudam o diagnóstico:

| | medido | referência do gênero |
|---|---|---|
| projéteis em tela | mediana **1,3**, máximo 3 | 15 a 60 |
| silhuetas de inimigo por onda | **1** (de 6 no elenco, 18 no catálogo) | 3 a 5 |
| planeta de fundo | **371 de 540 = 69% da largura** | — |

O jogo tem 21 inimigos cadastrados e mostra um. É de um gênero cuja linguagem
visual é o projétil, e a mediana em tela é um.

#### 1. Tipos por onda

`PERFIS_DE_ONDA` sorteia `tipos: [1, 2]`. Em 518 amostras de um setor inteiro,
um único sprite. O elenco por setor tem seis, e a arte já está paga.

É a melhoria mais barata da lista: um par de números.

**Critério de aceite:** a mediana de silhuetas distintas simultâneas em tela
passa de 1 para 2 ou mais, sem que a contagem total de inimigos nem a XP do
setor mudem.

#### 2. Presença de projétil

A nave dispara sprites a `alpha: 0.92`, sem brilho e sem rastro. O comentário
em `drawBullets` explica por quê — em `lighter`, dezenas de sprites somam até
estourar em branco — mas a conclusão foi DESLIGAR a presença.

A saída que o gênero usa não é aditivo puro: é **halo saturado não-aditivo por
baixo, núcleo claro por cima**. Some sem estourar.

- Rastro: posições anteriores com alfa decrescente. É o que dá velocidade.
- Clarão de disparo no bico da nave.
- Desacoplar o projétil VISTO do projétil SIMULADO — um projétil lógico pode
  ser desenhado como dois ou três traços. Resolve densidade sem tocar em
  balanceamento.

**Critério de aceite:** a mediana de marcas de projétil visíveis sobe para 6 ou
mais sem que a contagem simulada mude, e o pico de luminância do quadro não
cresce mais que 15% (o estouro em branco é o que se está evitando).

#### 3. Hitstop e impacto

**Não existe hitstop no projeto.** É o efeito com maior retorno por linha
escrita em todo shooter: dois a quatro quadros de congelamento no abate.

Falta também faísca no ponto de acerto, na cor do elemento.

**Critério de aceite:** o abate congela o mundo por um tempo medido e limitado,
o congelamento não acumula com múltiplos abates no mesmo quadro, e a simulação
de balanceamento em Node não muda em nada — o congelamento é de APRESENTAÇÃO.

#### 4. Cor reservada para perigo

As balas inimigas usam cinco cores, e quatro inimigos atiram `#8dff5c` — verde,
sendo que os próprios inimigos são verdes.

Ikaruga, Touhou e Nex Machina reservam uma cor para "isto encosta em você e
dói", e nada mais na tela usa essa cor. É a regra mais rígida do gênero e a mais
barata de aplicar. Agravante: as estrelas do setor 8 são rosa saturado, mesmo
registro visual de um projétil.

#### 5. O corpo celeste é uma parede

371 unidades numa tela de 540 — seis vezes a largura da nave, contra o teto de
100 imposto aos elites. E ele nasce no MEIO da pista: nos quadros capturados há
inimigos voando por cima dele com a silhueta sumindo.

A medição anterior (pico de luminância a 41% do gameplay) passou por cima disso,
e o erro vale registrar: ela media BRILHO, e o que come silhueta é **área ×
contraste interno**. Um planeta escuro mas texturado destrói leitura igual.

- Teto de tamanho relativo à tela (~45% da largura), não absoluto.
- Nunca centrado na pista: corpo grande vive na borda, cortado.
- Reduzir o contraste INTERNO, não o brilho geral.
- A arte tem banding e franja roxa na borda, sinal de ampliação.

#### 6. Acabamento

- A barra AMEAÇA é uma linha nua na largura toda, enquanto o topo tem os
  módulos com moldura. Mesma gramática, ou ela lê como sobra.
- Números de dano em cinza pequeno, ilegíveis sobre fundo texturado.
- Sem telegrafia de ataque inimigo.
- Sem vinheta. O gênero usa escurecimento de borda para empurrar o olho ao
  centro.

**Cenários promovidos em 02/09/2026.** As seis superfícies atmosféricas longas
saíram do modo de teste e foram distribuídas uma vez cada nas galáxias 1–6.
Os 19 cenários anteriores também deixaram de reiniciar o rodízio; um teste fixa
que as 30 galáxias da campanha usam 30 arquivos distintos.

#### Ordem

| # | frente | esforço | ganho |
|---|---|---|---|
| 1 | Tipos por onda 1–2 → 2–4 | trivial | altíssimo ✅ |
| 2 | Presença de projétil | médio | altíssimo ✅ |
| 3 | Hitstop e faísca de impacto | baixo | altíssimo ✅ |
| 4 | Marca de perigo pela FORMA (a cor é do elemento) | baixo | alto ✅ |
| 5 | Corpo celeste na margem e sem textura | baixo | alto ✅ |
| 6 | Vinheta e estrelas dessaturadas | trivial | médio |
| 7 | Barra inferior no padrão dos módulos | baixo | médio |
| 8 | Variação dentro do tipo de inimigo | médio | médio |
| 9 | Telegrafia de ataque | alto | alto (game feel, não só arte) |

---

### Passo 5 — Som 🔴

**Não existe nenhum áudio no projeto.** Zero referências a `Audio`,
`AudioContext` ou arquivo de som.

Num jogo em que a IA pilota, o som é boa parte do retorno sensorial que sobra:
tiro, acerto, morte, drop raro, especial de chefe carregando.

**Critério de aceite**
- Sem dependência nova pesada — `AudioContext` puro, como o resto do projeto é
  Canvas 2D puro.
- Volume e mudo em Ajustes, persistidos.
- O drop de raridade alta tem som próprio: é o momento que o jogo inteiro
  constrói.

---

### Passo 6 — Onboarding 🔴

Também não existe. Um jogador novo cai numa tela com 10 abas, 27 atributos e uma
nave que voa sozinha, sem nada explicando por que ele importa.

**A pergunta que o onboarding precisa responder nos primeiros 60 segundos:** *"se
a IA pilota, o que eu faço?"* A resposta é a tese do jogo — o jogador constrói, a
IA executa — e ela precisa ser mostrada, não escrita.

**Critério de aceite**
- Os primeiros 5 setores introduzem uma decisão por vez: equipar, elemento,
  Matriz, postura.
- Nenhuma aba aparece antes de existir motivo para ela.
- Pulável, e o estado de "já vi" no save.

---

### Passo 7 — Acessibilidade 🟡

Há foco visível global, abas navegáveis por teclado, rótulos nos controles e
modais, região viva para notificações e alternativa persistente de alto
contraste. Campanha e Provação podem usar Idle ou manual (WASD/setas); o
Laboratório preserva seu seletor próprio para comparar políticas de IA.

**Critério de aceite**
- Auditoria de teclado em cada fluxo e contraste AA medido nos textos de interface.
- As cores de raridade nunca são a **única** portadora de informação — hoje o
  nome da raridade já aparece escrito, o que é meio caminho.

---

### Passo 8 — Migração de save, antes do lançamento ✅

`SAVE_VERSION = 5` normaliza campos faltantes, recursos, frota, casco ativo e
preferências; migra v3 sem perder progresso e conserva o comportamento antigo
em Idle. Save futuro segue recusado, porque o código não pode adivinhar dados
que ainda não conhece.

**Critério de aceite**
- Toda mudança de campo persistido passa por revisão de migração.
- O teste cobre v3 → v5 e as normalizações de integridade.
- Save malformado, truncado ou de versão futura **nunca** trava o boot.

---

## Decisões pendentes do Rafael

Estas **bloqueiam** trabalho e não devem ser decididas por conta própria.

| # | Decisão | Contexto |
|---|---|---|
| 1 | **Anel elemental com deriva de 5%** | `1,5 × 0,7 = 1,05`, deveria fechar em 1,0. A especificação propõe `1,25 × 0,80`. Mexer nisso move todo o combate elemental |
| 2 | **O laço ocioso trava na parede do chefe** | Ao vivo: setor 5 dos 90 aos 120 min, mortes de 20 para 31. É o cruzamento de "chefe exige farm" com "sem recuo automático". Três saídas possíveis: recuo automático, chefe opcional, ou farm dirigido |
| 3 | ✅ **O que a Loja vende** | Resolvido pela opção A: Central de Serviços |
| 4 | **Item só do elemento da nave** | Pedido em 25/08 e MEDIDO antes de implementar. Se a nave só aceitar item neutro ou do próprio elemento, o Divino fica inutilizável **78%** das vezes — e trocar o elemento invalida **88%** de um conjunto lendário, o que torna o serviço de loja um botão que ninguém aperta. A alternativa medida é restringir só **principal + escudo**, os dois slots onde o elemento já significa algo: aí o Divino fica usável em 84% e a troca custa no máximo 2 peças de 10. Falta escolher entre as duas |
| 5 | **Setor 5 depois do adensamento** | Onda mais longa é mais tempo sob fogo, e `incomingDps` é taxa fixa. A vida mínima do setor 3 caiu de 90% para 52%, e o setor 5 passou de 36% e nenhuma morte para 0% e três mortes. Compensar mexeria em `curvaDano`, que é outro sistema calibrado — decisão de quanto o começo deve doer |
| 6 | **Offline rende mais item que jogar** | Setor 10 contra 8, e **368 itens contra 44**. O caminho abstrato já modela morte e já não banca recurso; o que resta é o item. Precisa de uma corrida AO VIVO nova para comparar — os 44 são de antes das Fases 2 e 3 |

---

## Dívidas técnicas conhecidas

Medidas e registradas. Não bloqueiam, mas não somem sozinhas.

| dívida | evidência | onde resolve |
|---|---|---|
| **Setores 1 e 12 fora da faixa de ritmo** | 0,17× e 0,45× do tempo-alvo. É o regime de abertura, onde o casco vale de 99% a 43% do poder e nenhuma curva suave o descreve | curva de início — o setor 1 já estava assim antes da escada |
| **Assimetria ofensiva/defensiva** | expoente 3,07 contra 1,25 — afixos ofensivos são multiplicativos, defensivos aditivos. Já foi 3,70 × 1,10 | orçamento de item (§7) |
| **Lendário, Mítico e Divino são indistinguíveis pela régua da parede** | os três travam além do setor 300 | precisa de outra régua — provavelmente tempo de limpeza no setor 300 |
| **A galáxia 1 vem rápida demais no simulador** | 1,2 h contra a meta de ~10 h. Ao vivo é bem mais lento | o simulador corre ~2× à frente |
| **Mortes acumulam muito no fim** | 141 mortes até o setor 13 numa corrida do zero | ligado à decisão 2 |
| **Nave nua trava em onda de elite** | setor 4: 90 min, 67 mortes, 0 itens — inimigos escapam pela base e a onda é reposta com vida cheia | `WaveDirector` |
| **`sharp` com CVE de libvips** | `npm audit`. É ferramenta de build, não entra no bundle | etapa própria |

---

## Como não estragar o que já está de pé

Cinco regras que vieram de erro real, não de teoria.

1. **Meça antes de consertar, e desconfie do instrumento.** Três "defeitos"
   registrados no roadmap eram artefatos de medição, não bugs do jogo.
2. **Uma amostra por setor é ruído.** Mexer na ordem das chamadas ao RNG
   reembaralha todos os itens. Use 41 amostras.
3. **Mude uma coisa por vez.** A divisão prefixo/sufixo e a escada de raridade
   foram feitas em etapas separadas *de propósito* — juntas, seria impossível
   saber qual moveu a curva.
4. **Quando uma mudança de item derruba um teste de curva, o problema pode ser a
   curva.** `DEFESA_A` estava 55% alto havia muito tempo, escondido pela largura
   da banda; só apareceu quando o medidor ficou honesto.
5. **Toda constante nova mora em `data/balance/`.** Um número mágico dentro de um
   `if` é bug de arquitetura.
