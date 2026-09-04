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
Provação), som e onboarding — e, acima de tudo, o **Passo 9: mover o jogo para o
servidor**. Ele deixou de ser opcional quando o ranking passou a valer prêmio:
hoje o save é escrito pelo cliente, então recurso, cristal, VIP, item e nave são
editáveis pelo console, e um pódio premiado em cima disso não se sustenta.

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

### Passo 9 — Autoridade do servidor 🔴

O jogo passa a ser **do servidor**. Recurso, cristal, VIP, item, nave e
progresso saem do save do navegador e viram estado que o cliente lê, mas não
escreve. O gatilho é o ranking premiado: no instante em que o primeiro colocado
ganha alguma coisa, a pergunta deixa de ser "o jogador se engana?" e passa a ser
"o jogador consegue provar que mereceu?".

#### As duas coisas diferentes que "não pode modificar" significa

Vale separar, porque o custo de cada uma é muito diferente e é fácil pagar pela
primeira achando que comprou a segunda.

| | o que impede | custo |
|---|---|---|
| **A — o jogador não EDITA o estado** | abrir o console e escrever `cristal = 999999` | médio |
| **B — o jogador não MENTE sobre o que aconteceu** | mandar "matei 400 inimigos" sem ter matado | grande |

Mover o save para o servidor resolve **A** e não encosta em **B**. Se o combate
continua rodando no cliente e ele reporta o resultado, o relatório é forjável —
só que agora com o carimbo do servidor, que é pior do que não ter carimbo
nenhum. **Prêmio exige B.**

#### Por que B é barato NESTE jogo

Órbita Zero é idle, e é isso que torna a coisa viável. Num jogo de ação o
servidor precisaria simular 60 quadros por segundo por jogador — inviável em
Worker. Aqui **o progresso é função de atributos × tempo**, e já existe a função
que faz essa conta: `applyOffline`, usada hoje para creditar ausência.

A virada, então, é conceitual antes de ser técnica:

> O servidor não simula o combate. Ele calcula o RESULTADO a partir dos
> atributos e do tempo decorrido — que é o que `applyOffline` já faz — e o
> combate no cliente vira **cosmético**: mostra bonito o que o servidor já
> decidiu.

Nada do que está na tela precisa mudar de aparência. O que muda é quem tem
razão quando os dois discordam.

#### A exceção: o modo manual

Quando o jogador pilota, a perícia dele afeta o resultado, e o servidor não tem
como verificar perícia. Só há duas saídas honestas, e é decisão do Rafael
(entrou nas decisões pendentes):

- manual **não conta** para o ranking; ou
- manual conta, mas com o rendimento **limitado ao que o idle produziria** —
  vira escolha estética, não vantagem.

Não existe terceira: qualquer ganho de manual acima do idle é ganho que o
servidor não consegue distinguir de mentira.

---

#### A ordem, e por que é esta

Cada fase é entregável sozinha e deixa o jogo funcionando. A ordem sobe da
menor superfície com o maior valor (dinheiro) para a maior superfície com o
maior custo (combate).

**Fase 1 — Fundação.** 🟡 Em andamento. Nada abaixo funciona sem isto.

1. ✅ **Conta anônima** (03/09). "Jogar sem conta" virou "Jogar agora" e cria
   uma conta de verdade no Supabase, sem pedir nada ao jogador. Resolve a
   tensão entre "estado precisa de dono" e o motivo pelo qual pular existia:
   cobrar e-mail antes de a pessoa saber se gosta do jogo troca jogadores por
   cadastros.
   - ⚠️ **Depende de uma chave no painel do Supabase:** *Authentication →
     Sign In / Providers → Allow anonymous sign-ins*. Medido em 03/09 com ela
     desligada: a rota responde `422 anonymous_provider_disabled`.
   - Com a chave desligada o jogo **não trava** — volta ao save só local — mas
     emite `console.warn` nomeando a chave. O recuo é silencioso para o
     jogador e barulhento para quem publica, porque a falha que parece sucesso
     é a mais cara que existe aqui.
   - **Falta:** vincular a conta anônima a um e-mail depois. Enquanto não
     existir, limpar o navegador perde a conta — o `refresh_token` mora no
     `localStorage` e não há outro caminho de volta.
2. 🔴 **Sair do plano gratuito do Cloudflare** — *ação do Rafael, não é código.* Não é opcional: com sincronização a
   cada 150 s, o teto de 100 mil escritas de linha por dia do D1 dá cerca de
   **170 jogadores com a aba aberta o dia inteiro** — e aba aberta o dia inteiro
   é exatamente o que um idle provoca. São US$ 5/mês de Workers e US$ 5/mês de
   D1. Descobrir esse teto com jogadores dentro é pior do que pagar antes.
3. ✅ **Livro-caixa** (03/09). `server/migrations/0005-carteira.sql` e
   `server/src/carteira.ts`. `transacoes` é append-only e é a verdade;
   `saldos` é cache reconstruível. `GET /carteira` já lê, com o mesmo balde
   em memória do placar.
   - **Idempotência:** índice único parcial em `(motivo, origem)`. Provedor de
     pagamento reenvia webhook — é o comportamento normal deles, não falha —, e
     sem isso o jogador paga uma vez e recebe três.
   - **Saldo nunca negativo:** o débito é condicional no próprio `UPDATE`
     (`WHERE quantia >= ?`) e o Worker confere `changes`. Ler-decidir-escrever
     teria uma janela entre a leitura e a escrita.
   - **Atomicidade:** lançamento e saldo entram no mesmo `batch`, que no D1 é
     transação. Sem isso existiria o instante em que o saldo mudou e o livro
     ainda não sabe — o estado que torna auditoria impossível.
   - 21 testes em `tests/carteira.test.ts`.
   - **Ainda não há rota que ESCREVE.** É de propósito: quem credita e debita é
     a Fase 2, junto com as moedas saindo do save.

**Fase 2 — Economia.** ✅ 03/09. Menor superfície, maior valor: é o que vira
dinheiro.

- As três moedas e o passe saem do save e viram estado do servidor. `resources`
  e `vip` viram ESPELHO; a verdade é `transacoes` + `saldos` + `assinaturas`.
- Todo movimento passa por `state.pendentes`, uma **fila de saída persistida**.
  Ela é salva porque o ganho acontece no meio do combate e a rede pode estar
  fora — sem fila, quem fecha a aba offline perde o setor que acabou de limpar,
  e perde sem sintoma, porque o número já tinha aparecido na tela.
- `POST /carteira` aplica um LOTE, tudo ou nada: a recompensa de missão entrega
  três moedas juntas, e em três chamadas a segunda pode falhar e deixar o
  jogador com um terço do prêmio.
- `POST /vip` debita e renova no servidor. `Sim.buyVip()` foi **removido** —
  manter a compra local seria manter um caminho que dá passe de graça pelo
  console.
- O save que sobe tem dinheiro e passe **arrancados** (`semODinheiro`). Campo
  que não sobe não pode ser lido de volta por engano numa migração futura.
- `motivo: compra` e `motivo: estorno` são **recusados vindos do cliente**:
  nascem do provedor de pagamento, no servidor.

*Aceite, verificado:* editar `resources` ou `vip` no console muda o que se vê e
nada mais — a sincronização seguinte traz o valor do servidor por cima, e todo
gasto é reconferido lá.

**Um defeito que esta fase revelou.** `sim/morte.ts` subtraía a multa direto de
`state.resources.sucata`, sem passar por `spend`. Com o servidor mandando, a
sincronização seguinte DEVOLVERIA a sucata que a morte cobrou, e a punição
viraria um número piscando. Corrigido: a multa entra na fila com `motivo:
'morte'`, arredondada para baixo porque o livro-caixa é INTEGER.

**O que esta fase NÃO comprou, e é importante não confundir.** O servidor ainda
ACREDITA no valor que o cliente declara ter ganhado. O que ele garante agora é
que o saldo não é editável, que gastar exige o livro concordar, que todo ganho
deixa rastro com motivo e hora, e que o ritmo é limitado. Conferir se o ganho
foi merecido é a Fase 5 — e um teto por valor **não funcionaria** antes disso:
medido em 03/09, a recompensa por setor vai de 0,06 (setor 1) a 192.201 (setor
300), **3,2 milhões de vezes**, e o número que escolheria a faixa certa é
justamente o que o cliente alega. Está documentado em `server/src/carteira.ts`
para ninguém tentar adicionar o teto achando que resolve.

**Fase 3 — Inventário.** ✅ 03/09.

**3a — a rolagem saiu do cliente. ✅**

O Worker importa `rollItem`, `resolverDrop` e `sectorIlvl` — os MESMOS
arquivos que o navegador usa. É a regra de camada nº 1 se pagando: não existe
cópia da fórmula, e um item rolado no servidor é indistinguível de um rolado
no cliente. O pacote do Worker foi de 25,6 KiB para 145 KiB (41 comprimido).

O buraco não era o gerador, era o CONTROLE sobre ele. Fechá-lo exigiu tirar do
cliente **três alavancas**, porque cada uma sozinha reabre tudo — a mesma
semente com um parâmetro diferente devolve itens diferentes:

| alavanca | como fica |
|---|---|
| semente | sorteada com `crypto.getRandomValues` e guardada em `lotes` |
| regras de drop | derivadas no servidor de `(setor, kind)` |
| sorte | travada junto da semente, na primeira chamada do setor |

**Dois defeitos que só apareceram medindo, e que eu mesmo tinha criado:**

1. *Alternar setores re-rolava de graça.* A primeira versão dava semente nova
   sempre que o setor mudava, apostando que trocar de setor custa tempo. Não
   custa: o setor é um número que o cliente declara, e alternar 60↔61 era
   re-rolagem instantânea. Agora lote novo exige **evidência de progresso** —
   um lançamento no livro-caixa posterior ao lote atual.
2. *O jogador preso num setor secava o pote.* O lote é por setor CONCLUÍDO,
   mas o drop é por abate: dez minutos morrendo no setor 3 acumularam 39 drops
   devidos contra 12 no pote. Repor sorteando de novo devolveria o re-rolar,
   então o lote **pagina**: a página seguinte continua a mesma sequência da
   mesma semente, e pedi-la de novo dá sempre o mesmo resultado.

**Rede fora não volta a rolar localmente.** Seria a saída óbvia e é o buraco
de novo — bastaria bloquear a requisição. Quando o pote está vazio o drop fica
**devendo**, e a dívida é paga na ordem quando o lote chega. Medido: 10 minutos
de combate sem servidor geraram **zero itens** e 39 dívidas.

**A única coisa que mudou no jogo:** a afinidade elemental *por inimigo* saiu.
`afinidadeDoAlvo` enviesava o elemento do item pelo elemento de quem morreu, e
é a única entrada de `resolverDrop` que não se deriva do setor — aceitá-la do
cliente devolveria a alavanca das regras, e escolher o elemento do drop vale
mais que subir a raridade. Piso de raridade, bônus de nível, itens extras e
multiplicador de sorte do chefe continuam **idênticos**.

**3b — o inventário saiu do save. ✅ 03/09**

A 3a tirou o poder de escolher QUAL item cai. Faltava a outra metade: o
inventário morava no save, e save é blob que o cliente escreve — dava para não
rolar nada e simplesmente ESCREVER uma peça Divina na lista.

**A ideia que fecha isso é uma só: o item nunca sobe.** O comando `coletar`
diz QUANTOS itens de cada tipo saíram do lote, nunca QUAIS. O servidor tem a
semente e o cursor, então deriva sozinho. Nenhum byte de item viaja do cliente
para o servidor — e o que não trafega não pode ser forjado.

- `itens` guarda uid, dono, o item em JSON, e **nave/slot em coluna** — o
  vínculo precisa ser consultável e conferível, o resto não.
- Índice único em `(usuario, nave, slot)`: uma retentativa de rede não pode
  deixar a nave com dois peitorais, e o cálculo de atributos somaria os dois
  sem reclamar.
- Cursor por tipo em `lotes`, que é o que impede coletar o mesmo item duas
  vezes.
- `naveAceita` roda no servidor — o MESMO arquivo do cliente. Equipar uma arma
  Divina de fogo numa nave de gelo vale poder real, e só o cliente conferindo
  seria o mesmo que não conferir.
- O save que sobe perde `inventory`, `comandosDeItem` **e o `equipped` de cada
  nave** — este último era um furo real: `inventory` vazio não basta se a peça
  viaja dentro de `naves[id].equipped`. Nível e XP da nave continuam subindo.

*Aceite, verificado ao vivo:* o corpo do `PUT /save` sai com `inventory: []`,
`resources` zerados, `vip` zerado e nenhuma nave com equipamento — com 14
itens e 132 de sucata no espelho local.

**3c — síntese e frota. ✅ 03/09**

As duas portas que sobravam, e as duas davam poder de graça.

**A síntese** consumia dez peças e produzia uma com `rollItem` LOCAL: bastava
fundir lixo até o resultado agradar, e a peça saía legítima pelos olhos de
todo o resto do sistema — inclusive do inventário que a 3b tinha acabado de
blindar. Agora é `POST /sintetizar`. Não há re-rolagem mesmo com semente nova
a cada chamada, e o motivo é a própria mecânica: **a fusão consome as peças**,
então repetir não encontra mais os `uid`s e não existe segunda tentativa para
comparar com a primeira.

**A frota** era uma lista de ids no save, e casco é poder: cada um tem
atributos-base próprios e os melhores custam cristal. Escrever um id em
`state.fleet` entregava de graça o que a loja cobra. Agora é a tabela `frota`,
com `origem` em coluna — `piloto`, `compra` ou `semente` —, pela mesma razão
do `motivo` do livro-caixa: sem ela, "de onde saiu esta nave" não tem resposta.

Os dois caminhos locais foram **removidos**, não desativados: `Sim.fundirItens`
e `Sim.buyHull` sumiram. Caminho morto que ainda funciona pelo console é o
mesmo buraco com outro nome.

`buyHull` virou `podeComprarCasco`, que só RESPONDE. A verificação de setor e
nível continua no cliente e não é redundante: os dois são o ritmo da
progressão, e o servidor não pode conferi-los porque é o cliente que os
declara. O que ele confere é o que sabe — existência, protótipo, casco de
piloto, posse e preço. Os dois conjuntos são diferentes de propósito.

*Aceite, verificado ao vivo:* com 2 cascos e 14 itens no espelho local, o
corpo do `PUT /save` sai com `fleet: []`, `inventory: []`, recursos zerados,
VIP zerado e nenhuma nave com equipamento. `fundirItens` e `buyHull` não
existem mais no objeto.

**O que ainda falta na fase**

- O serviço de loja que TROCA o elemento de uma nave mora no save, então o
  servidor valida `naveAceita` contra o elemento de fábrica. Uma nave com
  elemento trocado é avaliada pelo antigo.
- O custo em MATERIAIS da síntese continua no cliente: `armazem` ainda é save.
  O núcleo, que é moeda, já é debitado pelo livro-caixa.
- Nível e XP de cada nave continuam no save — são a Fase 4.

**Fase 4 — Progressão.** ✅ 03/09.

Faltava o que MULTIPLICA tudo que a Fase 3 fechou: nível de piloto e de nave
(atributos-base), os nós da Matriz (modificadores diretos), o setor alcançado
(que libera conteúdo e cascos) e os materiais. Um save com `command.nivel =
300` e a Matriz cheia valia mais que qualquer item Divino injetado.

**O nível não é guardado — é derivado do XP.** Guardar os dois é guardar a
mesma informação duas vezes, e duas cópias divergem: normalmente numa
migração, em silêncio, e o sintoma aparece meses depois como "meu nível
voltou". Com só o XP, a curva responde sempre igual e não existe estado
inconsistente possível.

**Delta para o que acumula, valor inteiro para o que é escolha.** XP e
materiais sobem como diferença — mandar o total faria duas abas abertas
sobrescreverem uma à outra com o valor mais velho. A Matriz sobe inteira
porque não é acúmulo: é uma escolha que se refaz por completo a cada respec.

**A Matriz é validada de verdade**, e as três regras valem poder:

| regra | o que evita |
|---|---|
| todo nó existe | inventar um id e ganhar um modificador que não está na árvore |
| o custo cabe nos pontos do nível | listar todos os nós de uma vez |
| tudo conectado à raiz | pegar só os nós profundos, que são os melhores, sem pagar o caminho |

A ordem importa: o XP entra primeiro, o nível sai da curva, e só então a
alocação é conferida contra os pontos DESSE nível. Conferir antes recusaria a
alocação legítima de quem subiu de nível no mesmo envio.

**Três defeitos que os testes pegaram, todos meus:**

1. `custoDeNo` devolve **1** para id desconhecido, não zero — minha
   conferência era `if (!custo)`, que nunca disparava. Um id inventado passava
   por nó barato. Agora a existência é conferida por `NODE_BY_ID`.
2. `pathTo` devolve vetor vazio quando o nó JÁ está alocado — que é sempre o
   caso ao conferir uma alocação pronta. A checagem de conexão nunca
   disparava. Trocada por travessia sobre `TREE_ADJACENCY` a partir da raiz,
   usando só os nós alocados.
3. O marco do delta ficava em zero depois do boot, enquanto o espelho já tinha
   o XP do servidor — o primeiro dreno mandaria o total como ganho e **dobraria
   o XP**. O marco passou a andar junto do espelho.

*Aceite, verificado ao vivo:* com nível 8, 3.783 de XP, setor 3, 14 itens, 2
cascos, 2 materiais e 1.177 de XP de naves no espelho local, o corpo do `PUT
/save` sai com **tudo zerado**: nível 1, XP 0, setor 1, nenhum item, nenhum
casco, nenhum material, nenhuma nave com XP, recursos e VIP em zero.

**O que ainda falta**

- Materiais sobem como zero: o caminho antigo grava valor ABSOLUTO e a
  conversão para delta entra junto do Armazém no servidor.
- O serviço que troca o elemento de uma nave continua no save, então
  `naveAceita` é conferido contra o elemento de fábrica.

**Fase 5 — O tick de autoridade.** Aqui o cliente vira renderizador.

#### Levantamento de 03/09 — a fase NÃO está bloqueada

> ⚠️ **Correção.** Eu havia registrado que `Sim` não roda no Worker e que
> descontaminar `sim/` era pré-requisito. **Estava errado**, e a medição
> mostrou o contrário. O que eu tinha visto eram erros do `tsc` do servidor, e
> confundi erro de TIPO com impedimento de EXECUÇÃO.

**O que a auditoria encontrou:** quatro erros de compilação, de duas causas —
e nenhuma delas é contaminação real.

| erro | o que é de verdade |
|---|---|
| `sim/index.ts` importa `@app/Bus` | **Não é contaminação.** `Bus.ts` importa só TIPOS de `sim/` e não toca DOM. Falta o alias `@app` no `tsconfig` do servidor — uma linha. |
| `localStorage` em `sim/state.ts` (3×) | Erro de TIPO: o `lib` do Worker não tem DOM. Em execução as três chamadas estão dentro de `try/catch` e degradam sozinhas. |

**Medido, não deduzido.** Um teste rodando em ambiente sem `window`, sem
`document` e sem `localStorage` — a mesma situação do Worker — instanciou
`Sim`, rodou `applyOffline(3600)` e chamou `save()` sem estourar. Os 900
testes da suíte já provavam isso o tempo todo: eles instanciam `Sim` em Node.

**O custo de CPU, que era a dúvida de verdade:**

| tempo de jogo simulado | custo |
|---|---|
| 150 s (um ciclo de sincronização) | **2,5 ms** |
| 1 hora | 8,3 ms |
| 4 horas (recuperação de ausência) | 22,9 ms |
| 100 jogadores × 150 s | 18 ms no total — **0,18 ms cada** |

Cabe folgado até no plano gratuito. O pacote do Worker com `Sim` dentro vai a
**398 KiB / 112 KiB comprimido**, contra o teto de 1 MB do gratuito e 10 MB do
pago.

#### O trabalho real desta fase

Não é descontaminar `sim/`. É **montar um `GameState` no servidor**: hoje ele
guarda o estado em pedaços (carteira, itens, frota, progresso), e `abstractTick`
precisa do objeto inteiro.

A boa notícia é que os pedaços que faltam são os que NÃO decidem poder:

| o servidor já tem | ainda é só do cliente |
|---|---|
| `resources`, `vip`, `armazem` | `run` (setor e onda em curso) |
| `inventory` e o equipado de cada nave | `settings` (postura da IA, modo de controle) |
| `fleet`, XP e nível de cada nave | `hull` e `piloto` (nave em campo) |
| `command` (XP, nível, Matriz) | `provacao`, `missoes`, `eventos`, `codex`, `chests` |
| `universe.bestSectorEver` | `stats`, `lifetime`, `playtime` |

Ou seja: **tudo que determina PODER já é do servidor.** O que falta é contexto
de cena — onde a nave está e como ela se comporta. É por isso que a fase é
grande mas não é arriscada: nenhuma das peças que faltam entra no cálculo de
atributos.

**Os passos, em ordem**

1. ✅ **Feito em 03/09.** Alias `@app` no `tsconfig` do servidor, e o
   `localStorage` trocado por uma porta (`Cofre`) que se detecta sozinha. Com
   isso o Worker importa `Sim` e os DOIS lados compilam limpos.

   A detecção alcança `localStorage` por `globalThis`, e não pelo nome, para o
   `lib` do Worker continuar SEM DOM — é essa checagem que vai avisar da
   próxima vez que alguém puser navegador dentro de `sim/`.

   Entrou junto um teste de guarda (`sim-sem-dom.test.ts`) que varre `sim/` e
   `data/` atrás de globais de navegador e de import em valor vindo de `ui/`,
   `render/` ou `modes/`. **Ele achou duas coisas que eu não tinha visto:** um
   falso positivo meu (`sanear.ts` menciona `localStorage` num COMENTÁRIO — o
   teste passou a ignorar comentários) e uma violação real, `data/clips.ts`
   importando `@render/Anim`, que puxa `new Image()`. Esta última fica como
   exceção declarada: medido, nada em `sim/` importa `clips.ts`, então ela
   nunca entra no grafo do Worker — e há um teste separado que quebra no dia em
   que entrar.
2. ✅ **Feito em 03/09.** `run`, `hull` e a postura sobem junto do pedido de
   ausência. Nenhum dos três decide poder — são contexto de cena.
3. ✅ **Feito para a AUSÊNCIA em 03/09.** O servidor monta um `GameState` a
   partir das oito tabelas, roda `applyOffline` e grava os deltas.
4. 🔴 **Falta para o jogo AO VIVO, e a medição de 03/09 mostrou POR QUÊ.**
   A ausência já não é reportada; o ganho de quem está com a aba aberta ainda
   é. Duas tentativas de fechar isso foram medidas e as duas falharam — o
   detalhe está abaixo, porque é o que impede a próxima pessoa de repetir.

#### Por que o passo 4 não foi entregue (medido em 03/09)

Havia dois desenhos plausíveis, e a medição derrubou os dois.

**Tentativa 1 — o servidor SUBSTITUI o ganho ao vivo pelo `abstractTick`.**
Não serve: os dois modelos discordam em SINAL, não só em magnitude. Medido no
setor 3, mesma janela de 5 minutos e mesmo ponto de partida:

| | sucata | XP |
|---|---|---|
| cena ao vivo | **−21** | **+955** |
| `applyOffline` | +209 | +98 |
| `abstractTick` cru | +177 | −26 |

A causa apareceu ao olhar a carga: ao vivo o jogador **morre** antes de fechar
o setor e perde os 365 de carga acumulada (1 morte em 180 s), enquanto o
modelo abstrato não mata ninguém na mesma janela. É a divergência que o
comentário de `abstractTick` já registrava — só que hoje ela está invertida:
a CENA é mais dura que o modelo.

Substituir daria ao jogador +209 de sucata onde ele hoje perde 21, e 98 de XP
onde ele ganha 955. Não é proteção, é mudança de economia.

**Tentativa 2 — o servidor LIMITA o ganho declarado por um teto físico.**

A ideia era boa e não depende do modelo divergente: não se mata quem não
entrou, e `TAXA_DE_ENTRADA` (3,43 inimigos/s) é teto de projeto do próprio
jogo. A primeira amostra animava — no setor 3, o jogador honesto usava 35% do
teto de abates, folga de 2,8×.

Varrer mais setores derrubou a fórmula `TAXA_DE_ENTRADA × sectorBounty × 12`:

| setor | XP honesto em 90 s | teto proposto | folga |
|---|---|---|---|
| 1 | 673 | 223 | **0,3×** |
| 3 | 390 | 509 | 1,3× |
| 8 | 565 | 5.604 | 9,9× |
| 15 | −1.193 | 31.093 | — |

**No setor 1 o teto fica TRÊS VEZES ABAIXO do ganho honesto** — ele recusaria
todo jogador novo, em silêncio, no primeiro minuto de jogo. E a folga varia de
0,3× a 9,9× em quinze setores, porque `sectorBounty` cresce exponencialmente
enquanto o XP do começo vem de DENSIDADE, não de recompensa por abate.

Foi por pouco: a amostra do setor 3, sozinha, dizia que a fórmula servia.

#### A calibração foi feita, e ela parou noutro lugar (03/09)

Entrou `npm run simular -- ganho <de> <ate> <passo>`, que mede o que o jogador
REALMENTE recebe: roda `abstractTick` com o build representativo de cada setor
— o mesmo que `curva` usa, de `balanco.ts` — e conta XP por segundo, setores
limpos e mortes.

O resultado impede o teto, mas por um motivo diferente do esperado:

| setor | xp/s | setores limpos | mortes em 300 s | a onda mataria em |
|---|---|---|---|---|
| 1 | 0,06 | 0 | 0 | 3 707 s |
| 5 | 0,17 | 0 | 9 | 814 s |
| 13 | 1,92 | 0 | 6 | nunca |
| 21 | 2,30 | 0 | 7 | nunca |
| 25 | 0,00 | 0 | **18** | nunca |
| 29 | 0,00 | 0 | **25** | nunca |

**Zero setores limpos em toda a faixa de 1 a 29**, e as mortes sobem de 0 para
25 enquanto a onda comum nunca mata. O ganho por segundo varia 98× e é
ruidoso entre setores vizinhos, porque ele não mede habilidade nem
equipamento: mede se aquela semente passou do chefe.

**Isto não é um defeito novo — é a decisão pendente nº 2 vista pela régua.**
"O laço ocioso trava na parede do chefe" já estava registrada com medição ao
vivo (setor 5, dos 90 aos 120 min, mortes de 20 para 31). O que muda é que
agora ela é reprodutível em Node, ao longo da curva, por quem não a escreveu.

**A reconciliação que custou a maior parte do trabalho.** `curva` diz
"trivial" e "30 a 40 golpes até morrer" nos mesmos setores em que a simulação
conta nove mortes em cinco minutos. As duas réguas estão certas e medem coisas
diferentes: **`curva` mede a ONDA, e quem mata é o CHEFE.** A coluna
`morte.na.onda` existe para isso — quando ela diz `nunca` e `mortes` diz nove,
a leitura é imediata.

#### O que falta para o passo 4, concretamente

Um teto por valor precisa de uma expectativa de ganho ESTÁVEL por setor. Hoje
não existe: o ganho é dominado por passar ou não do chefe, e no build
representativo ele não passa em lugar nenhum. Calibrar um teto sobre isso
produziria o mesmo erro das duas tentativas anteriores, com mais trabalho.

**A decisão nº 2 foi tomada em 03/09: o jogo AVISA, o jogador recua.**

A medição abaixo é do que aconteceria COM o recuo, e ela vale como estimativa
do que o jogador ganha ao aceitar a oferta — não como comportamento do jogo,
que não recua sozinho.

| setor | | setores limpos | mortes | xp/s |
|---|---|---|---|---|
| 5 | sem recuo | 0 | 112 | 0,04 |
| 5 | **com recuo** | **31** | **6** | 0,10 |
| 15 | sem recuo | 32 | 1 | 6,88 |
| 15 | **com recuo** | **52** | 1 | 7,13 |
| 25 | sem recuo | 0 | 225 | 0,00 |
| 25 | **com recuo** | **31** | **21** | 9,83 |

O setor 25 sem recuar passa uma hora inteira em 225 mortes, zero setores
concluídos e zero XP. É esse número que a oferta existe para o jogador
conhecer: num idle, isso acontece com a aba fechada, e ele só descobriria no
dia seguinte — como "o jogo não rendeu nada".

Insistir continua sendo escolha legítima, e o cartão diz isso: o jogador pode
estar a um item de passar, e ninguém sabe disso melhor que ele.

**O que ainda falta para o teto do passo 4.** A curva melhorou muito mas
continua ruidosa: o ganho por segundo vai de 0,10 a 9,83 nos três pontos
medidos, e o setor 5 rende menos que o 15 e o 25 porque a nave passa a hora
inteira farmando degraus baixos. Uma expectativa ESTÁVEL por setor ainda
precisa de uma varredura completa de 1 a 300 com a janela longa — que agora é
possível, e antes não era, porque o número era zero em quase toda a curva.

O caminho seguro, quando for a hora: **medir antes de impedir.** O servidor
passa a REGISTRAR quando o ganho declarado passaria do teto, sem clipar nada,
e a decisão de ligar a recusa vem dos dados de jogadores reais. Um teto que
nunca disparou em produção é um teto que se pode ligar com confiança; um teto
calibrado em laboratório é o que recusa o jogador novo na segunda-feira.

**E vale dizer o que já está protegido**, para a fase não parecer aberta: o
caminho mais lucrativo — ficar fora e voltar — é calculado pelo servidor desde
o passo 3, com o relógio dele. O ganho ao vivo passa por ritmo, deixa rastro
no livro-caixa e tem teto de sanidade. O que falta é a conferência de VALOR,
não a de existência.

#### O que o passo 3 entregou (03/09)

Era o maior buraco que sobrava depois da Fase 4, e a medição registrada neste
mesmo documento diz o tamanho: **offline rendia 368 itens contra 44** do jogo
ao vivo no mesmo trecho — e o cliente calculava sozinho quanto tinha ganhado.

**A peça central: o cliente não diz quanto tempo ficou fora.** A ausência sai
da diferença entre agora e o último carimbo que o servidor gravou
(`progresso.atualizado_em`). Alegar dez horas depois de cinco minutos não
funciona porque não existe campo onde mentir — verificado ao vivo: o corpo do
pedido tem `hull`, `setor`, `onda` e `postura`, e nada mais.

**Não há recuo para o cálculo local, e é deliberado.** Calcular no cliente
quando o servidor não responde devolveria o buraco inteiro: bastaria bloquear
a requisição. E não é preciso — o carimbo só anda quando o servidor CREDITA,
então a tentativa que falha não perde nada. Quem ficou sem rede recebe
atrasado, não recebe a menos.

**Os dois aparos que o contexto do cliente recebe**, porque são os únicos
campos abusáveis:

| campo | aparo |
|---|---|
| `hull` | precisa estar na frota do servidor, senão cai no primeiro casco |
| `setor` | não passa do `melhor_setor` já alcançado |

O segundo vale mais que todos os outros juntos: a recompensa por setor vai de
0,06 (setor 1) a 192.201 (setor 300), então alegar o fim da campanha para
simular a ausência seria o exploit mais barato do jogo.

**Como a montagem é segura.** O `GameState` parte de `createState()` e recebe
por cima o que o servidor sabe. Montar à mão os 31 campos significaria
escrever um valor plausível para cada um que falta — e errar um em silêncio,
com a simulação divergindo do jogo por um motivo que ninguém encontraria.

**Teto de 12 horas por crédito.** Não é anti-trapaça, é custo: cada hora
simulada são ~8 ms de CPU, e sem teto uma conta parada por um mês pediria
quase seis segundos de Worker numa requisição só.

**O que falta, e é o passo 4.** O ganho de quem está jogando AO VIVO ainda
sobe declarado. A diferença é que agora o caminho mais lucrativo — ficar fora
e voltar — passou a ser o mais protegido, e a máquina para fechar o resto já
existe: é a mesma montagem de estado, chamada num ritmo diferente.

**O que continua fora do alcance, e é honesto dizer:** o jogador ainda escolhe
quando fechar a aba. Um cliente adulterado pode reportar tempo decorrido maior
do que o real — mas o servidor tem carimbo próprio, então isso vira uma
conferência de relógio, não de conteúdo. É um problema muito menor que o de
hoje.

- O servidor calcula, por intervalo, o que aconteceu: abates, perdas, itens,
  recursos, XP — a partir dos atributos guardados e do tempo decorrido.
- O cliente **prevê** o resultado para desenhar sem esperar a rede (é o que
  torna o jogo jogável), e **corrige** quando o servidor responde. Previsão
  otimista com reconciliação é o padrão; o cliente estar errado por um segundo
  é normal e invisível.
- O progresso offline passa a ser calculado pelo servidor, que já tem os
  carimbos de tempo. Some junto o problema atual de o cliente decidir quanto
  ganhou enquanto esteve fora.

*Aceite:* um cliente adulterado que reporta mil abates recebe exatamente o mesmo
que um cliente honesto no mesmo intervalo, porque ninguém pergunta a ele.

**Fase 6 — Ranking premiado.** Só aqui o prêmio pode ser anunciado.

- **Temporadas** com início, fim e congelamento — prêmio precisa de um instante
  em que a tabela para de mexer.
- **Anti-multiconta**: um prêmio por pessoa, não por conta. Sem isso, o pódio
  inteiro é a mesma pessoa.
- **Auditoria**: para os primeiros colocados, o livro-caixa e o histórico de
  ticks precisam reconstruir o progresso deles do zero. Se não reconstrói, não
  premia.
- **Detecção de anomalia** sobre o que sobrar — o `conferir()` de `placar.ts` já
  é a semente disso.

*Aceite:* dado o histórico do servidor, dá para responder "como o primeiro
colocado chegou lá" sem depender de nada que o cliente disse.

---

#### O que decide sozinho quanto trabalho isto dá

**Zerar os saves no corte, ou migrar?** Migrar significa escrever a conversão de
cada campo e defender cada um contra o valor inflado — e há a armadilha que já
nos mordeu na idade da conta: um snapshot tirado do que o cliente manda deixa
qualquer um se preparar antes. Se for para migrar, o snapshot sai do que **já
está gravado** no D1, num instante fixo, decidido pelo servidor.

A regra deste repositório já autoriza o caminho curto: *"durante o
desenvolvimento, compatibilidade entre versões NÃO é restrição — o esquema muda
muito e o save é zerado junto, de propósito"*. Com testadores e sem prêmio ainda
valendo, **zerar no corte economiza semanas** e elimina uma classe inteira de
brecha. Entra nas decisões pendentes.

#### O que NÃO muda

Vale dizer para dimensionar o susto: `sim/` e `data/` são TypeScript puro sem
DOM — é a regra de camada nº 1 deste projeto, e ela foi escrita justamente para
isto. **O mesmo código de atributos, loot, dano e progressão roda no Worker sem
alteração.** Não há fórmula para reescrever nem risco de o servidor e o cliente
discordarem de regra: é o mesmo arquivo.

O que muda é onde ele roda e quem acredita no resultado.

---

## Decisões pendentes do Rafael

Estas **bloqueiam** trabalho e não devem ser decididas por conta própria.

| # | Decisão | Contexto |
|---|---|---|
| 1 | ✅ **Resolvido no código, de outro jeito** — conferido em 04/09. A especificação propunha `1,25 × 0,80`; o código fez `DESVANTAGEM = 1 / VANTAGEM`, então o produto é 1,000 POR CONSTRUÇÃO e mexer na vantagem não reabre a deriva. A vantagem segue 1,5 de propósito: com 1,25 acertar o elemento valeria 56% em vez de 114%, e a ida e volta do anel deixaria de ser a decisão que faz trocar de nave. De quebra, errar o elemento ficou 4,8% mais caro (0,700 → 0,667). Ver `data/balance/elemental.ts` |
| 2 | ✅ **O jogo OFERECE recuar; quem recua é o jogador** — decidido em 03/09. Três quedas seguidas no mesmo setor abrem um cartão com "Recuar para o N−1" e "Ficar aqui", uma vez por visita. O estado NÃO muda sem alguém pedir. A primeira versão recuava sozinha e estava errada pelo mesmo motivo que `completeEncounter` não avança sozinho: mover a fase por conta própria tira do jogador a decisão que a trava de fase existe para dar |
| 3 | ✅ **O que a Loja vende** | Resolvido pela opção A: Central de Serviços |
| 4 | ✅ **Restrito em TODOS os slots** — decidido em 04/09, e já era o comportamento: `naveAceita` não tem exceção de slot. A medição de 25/08 dizia que isso deixa o Divino inutilizável em 78% das vezes, mas ela supunha que a peça errada é perdida — e não é: a loja converte o elemento do ITEM e o da NAVE. Com conversão disponível, a restrição vira decisão de custo, não de descarte. Guardado por `tests/elemento-da-nave.test.ts` |
| 5 | ✅ **O começo continua difícil** — decidido em 04/09. Nada a fazer: `curvaDano` fica como está. Fica o registro do que o adensamento causou, para ninguém tratar como regressão — vida mínima do setor 3 de 90% para 52%, e o setor 5 de 36% e nenhuma morte para 0% e três mortes |
| 7 | ✅ **Zerar os saves no corte** — decidido em 03/09. Elimina a conversão campo a campo, a defesa contra valor inflado e uma classe inteira de brecha. A regra do repositório já autoriza zerar durante o desenvolvimento |
| 8 | ✅ **Manual pontua igual** — decidido em 03/09: o modo de controle não entra na conta. É mais simples que as duas opções oferecidas e coerente com a Fase 5: se o servidor calcula o resultado a partir de atributos × tempo, o modo deixa de ser variável. **A consequência a aceitar:** pilotar bem não rende mais que deixar a IA — manual vira preferência, não vantagem |
| 9 | ✅ **Anunciar o prêmio só depois da Fase 6** — decidido em 03/09. Anunciar antes convida exatamente quem sabe quebrar o que ainda não está protegido |
| 6 | ✅ **A ausência NÃO solta item** — decidido em 04/09, e já era o comportamento. O histórico explica por que não se tenta calibrar: o caminho abstrato chegou a entregar 1.822 itens em duas horas contra 44 do jogo ao vivo (41×), e mesmo calibrado ficava em 368 contra 44. O item é a recompensa de ESTAR LÁ — ele cai numa cápsula que a nave precisa coletar. A ausência paga progresso: XP e recursos. Guardado por `tests/offline-online.test.ts` |

---

## Offline e online rendem o mesmo (04/09)

**A regra, decidida em 04/09:** offline e online não diferem em GANHO. O que
difere é que a ausência não avança de setor — a nave fica onde o jogador a
deixou, e parar num setor que ela não vence tem de custar. A responsabilidade
é do jogador: parar onde consegue passar.

### Dois defeitos que impediam isso

**1. O caminho abstrato não pagava pelos abates.** `rewardKill` paga XP e
carga, e é chamada só pela cena. `abstractTick` descontava `run.restam` na mão
e seguia — então quem repetia um setor com a aba fechada, sem conseguir
fechá-lo, não recebia NADA, enquanto o mesmo jogador com a aba aberta subia de
nível matando. O pagamento virou `premiarAbates(abates, fracao)`, com os dois
caminhos chamando a mesma função.

**2. O abstrato matava rápido demais.** Corrigido o item 1, ele passou a
render **2,2× o do jogo ao vivo** — o que inverte o incentivo e recria a
preocupação da decisão nº 6. A causa: `dano ÷ vida média` é o TETO teórico,
que supõe todo tiro acertando, ninguém escapando pela borda e nenhum tempo de
voo.

### A medição que deu o número

Mesma janela de 400 s, mesmo build esperado de cada setor, contando abates:

| setor | cena | abstrato | razão |
|---|---|---|---|
| 1 | 451 | 1356 | 0,333 |
| 5 | 466 | 1350 | 0,345 |
| 11 | 840 | 1371 | 0,612 |
| 21 | 662 | 1345 | 0,492 |
| 31 | 463 | 1366 | 0,339 |
| 51 | 771 | 1366 | 0,564 |

O abstrato fica praticamente CONSTANTE — preso no teto de entrada — e a cena
oscila sem tendência. Por isso a correção é um número e não uma curva:
`EFICIENCIA_DA_CENA = 0,45`, a média das seis amostras.

**Depois da correção:** a razão de abates caiu de 2,2× para **1,11× em média**
(0,76 a 1,50 pelos seis setores).

### `OFFLINE_EFFICIENCY` foi de 0,6 para 1

Ela existia com o comentário "o offline rende menos que jogar ativamente — de
propósito". A regra nova diz o contrário, então o desconto saiu. A constante
fica no código: é o lugar de quem um dia quiser desestimular a aba fechada, e
o histórico explica saves antigos que renderam menos.

### Um teste que afirmava algo falso

`progressao.test.ts` tinha um caso chamado *"o caminho abstrato limpa o
encontro no tempo que o jogo ao vivo levaria"*. Ele comparava o abstrato com a
FÓRMULA — a mesma que o abstrato usa. Verificação circular: nunca olhou a cena.

Medido no navegador, nave nua no setor 1, exatamente a montagem do teste: a
**cena leva 142,1 s** para virar a onda, contra os 35,3 s da fórmula. Quatro
vezes mais. O teste passou a comparar com o teto dividido pela eficiência, e o
comentário registra que a referência ao vivo é uma medição datada — quando a
cena mudar, ele não vai perceber sozinho.

### Duas coisas que pareciam pendência e são REGRA (04/09)

**A XP líquida diverge entre os dois modos, e está certo.** Os ABATES batem; o
saldo difere porque a multa de morte cobra 15% do acumulado, e as duas
trajetórias caem em momentos diferentes. Morreu, perdeu XP — é assim que tem
de ser.

**Missão não conta com a aba fechada.** O caminho abstrato PAGA o abate mas
não registra o fato dele; quem registra é `rewardKill`, chamada só pela cena.

Essa segunda parece defeito, e é por isso que virou teste
(`tests/offline-online.test.ts`): depois da regra de ganho igual, a pergunta
natural é "se o ganho é o mesmo, por que a missão não seria?" — e acrescentar
o registro no abstrato é UMA LINHA. O efeito seria missão de "derrube N
inimigos" se cumprindo sozinha durante a noite.

O teste guarda as três fronteiras: ganho igual, ausência não avança de setor,
missão só no jogo aberto.

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
