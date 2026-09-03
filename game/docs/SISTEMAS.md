# Sistemas

Cada sistema do Órbita Zero por dentro: a fórmula, o fluxo, os arquivos e o
porquê das decisões que parecem estranhas. Complementa
[`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md) e [`TELAS.md`](TELAS.md).

Todos os números aqui são **medidos**, não estimados. Cada um pode ser
reproduzido com os comandos da seção 5 do mapa.

---

## 0. Sistemas transversais entregues em 24/08

O registro completo das entregas de interface, calibração, arte e conteúdo
realizadas nesta sessão está em
[`ATUALIZACAO-2026-08-24.md`](ATUALIZACAO-2026-08-24.md). Esta seção conserva as
regras técnicas que atravessam mais de uma tela.

### Save e preferências — `sim/state.ts`

`SAVE_VERSION = 5`. A migração aceita versões antigas conhecidas, cria campos
ausentes e normaliza o resultado antes do jogo usá-lo. Preferências inválidas
voltam para Idle, recursos zerados não inflam o save, ids repetidos são
removidos e `pinnedMissions` é limitado a quatro missões válidas (cinco com VIP). Save malformado
ou de versão futura retorna `null` em vez de travar a inicialização.

### Rastreador de missões — `sim/missoes.ts`, `ui/Shell.ts`

O estado persistido guarda apenas ids em `settings.pinnedMissions`; o painel
resolve nome, requisito, progresso e estado a partir do catálogo e do `Sim`.
Isso evita salvar texto ou porcentagem derivados e garante que entregar,
bloquear ou remover uma missão também limpe o rastreio. IDs concluídos de saves
antigos não ocupam vagas invisíveis. O limite efetivo é quatro.

### Calibração de colisão — `sim/laboratorio.ts`, `hitbox-calibrations.ts`

Hitbox é uma caixa retangular `{ width, height, offsetX, offsetY }` por casco
ou ficha inimiga. `VerticalMode` aplica a mesma caixa ao combate e ao desenho de
depuração. O Laboratório altera valores ao vivo, mas a persistência administrativa
grava somente a tabela versionada de calibrações; não há dado de hitbox em save
do jogador. Assim uma correção é global e reproduzível em qualquer cenário.

### Modificadores mecânicos da Provação — `sim/desafio.ts`, `VerticalMode.ts`

Além dos modificadores numéricos, a cena interpreta cinco efeitos de leitura
visual e resposta mecânica: janela cíclica de invulnerabilidade, zonas
telegrafadas, clones sem recompensa, barreira frontal cíclica e ponto fraco
móvel. O catálogo limita parâmetros para que invulnerabilidade e barreira sempre
deixem janela de dano; clone não conta para progresso nem drop.

### Baús, craft e descarte

`openChest` usa a distribuição explícita do baú e ignora Sorte. Depois da
abertura, a maior raridade determina apenas apresentação (aura, cor e animação),
nunca altera o resultado já sorteado. A Bancada de Modulação troca uma linha
possível preservando identidade estrutural do item. Venda e desmanche são
destinos distintos: Sucata por venda; materiais escalados por raridade/tier/nível
por desmanche. As tabelas econômicas vivem em `data/balance/`.

---

## 1. Atributos — `sim/stats.ts`

`resolveStats(state)` é a função mais central do jogo: transforma estado em
atributos finais. A ordem importa e é esta:

```
1. casco base            HULLS[state.hull].stats
2. × nível DA NAVE       1 + (nivel - 1) × NAVE_GANHO_POR_NIVEL
3. + implícito da base   base.implicit.per × item.ilvl × fatorDaRaridade
4. + afixos do item      affix.value × fatorDaRaridade
5. + bônus de conjunto   activeSetBonuses()
6. + nós da Matriz       command.allocated
7. aplicar LIMITES       data/balance/limites.ts
```

**O nível da nave amplifica os atributos DELA, não os do equipamento.** É o que
faz desenvolver um casco valer a pena e dá sentido a manter uma frota (§18). Sem
isso o nível de nave seria um número sem efeito.

**`fatorDaRaridade = rarityInfo(item.rarity).power / RARIDADE_DE_REFERENCIA`**
(referência 4,9 = Mítico) escala o item **inteiro**, implícito e afixos.

> Antes disso, `power` era um **campo morto**: declarado na tabela, revisado, e
> nunca lido por ninguém. Um Comum e um Divino do mesmo nível tinham o mesmo
> implícito. Ligá-lo só no implícito quase não moveu nada — a parede do Comum foi
> de 32 para 28 — porque os afixos dominam. Escalar o item inteiro é o que
> produziu a escada de verdade.

### As três funções derivadas

| função | o quê |
|---|---|
| `dps(stats)` | dano por segundo, com crítico e projéteis |
| `effectiveHp(stats)` | vida efetiva: casco + escudo, com resistências |
| `powerScore(stats)` | nota de comparação de itens: **produto** `√dps × √vida` |

`powerScore` é **produto e não soma ponderada** — é o que faz um canhão de vidro
pontuar abaixo de uma nave equilibrada.

> Ele enxergava **9 de 27** atributos. Perfuração, explosão, velocidade, sorte,
> as três rendas e as cinco resistências valiam **zero**: o auto-equipar
> descartava uma peça de resistência pura como se fosse vazia. Hoje cada
> coeficiente entra ONDE o atributo age (`data/balance/orcamento.ts`).

---

## 2. Dano — `sim/dano.ts`

```
dano total = normal + Σ elementais
```

`montarPacote(stats)`: `stats.dano` é **sempre** o componente normal. Cada
potência elemental (`danoFogo`, `danoGelo`, …) acrescenta um componente daquele
elemento, do tamanho `dano × potência`. A base continua neutra e a potência
**soma por cima em vez de converter**.

Uma nave sem afixo elemental atira 100% normal — e é uma nave viável. Esse é o
ponto.

**`elementoAtivo` não entra na conta.** Uma nave que carregue potência de fogo E
de gelo dispara os dois. A arma equipada decide a aparência do tiro e qual
potência a ficha destaca, não qual componente existe.

**Dano normal não é resistível** — vai direto no escudo, no casco e na vida.
Nenhuma resistência o reduz e não existe "resistência a normal". Sem essa
imunidade o elemental dominaria sempre: quem escolhe o elemento por encontro leva
1,25 fixo contra a média de 1,01 do neutro.

**Anel elemental:** 6 elementos, cada um vence exatamente um e perde para
exatamente um.
> ⚠️ **Dívida aberta:** o anel tem deriva de 5% — `1,5 × 0,7 = 1,05`, quando
> deveria fechar em 1,0. A especificação propõe `1,25 × 0,80`. **Decisão
> pendente.**

---

## 3. Itemização — `sim/loot.ts`, `data/items.ts`, `data/balance/raridades.ts`

### O modelo

```
atributo base da NAVE
  + implícito da BASE do item   (escala com ilvl × raridade)
  + PREFIXOS                    (família ofensiva — 14 afixos)
  + SUFIXOS                     (defensiva + utilidade — 12 afixos)
     cada um com TIER de 1 a 10
```

**10 slots** · **80 bases** · **35 afixos** · **4 conjuntos** · **7 raridades**

### Prefixo e sufixo

O tipo é **derivado da família**, não um campo novo: `tipoDoAfixo(def)` mapeia
`ofensiva → prefixo` e `defensiva`/`utilidade` → `sufixo`. Como `Affix` já guarda
o `id`, **não houve migração de save**.

`pisoDeAfixos(slot, afixos)` garante um **piso** de cada natureza — não uma
divisão meio a meio:

```
1 afixo  → 0+0 (Comum: com uma linha só, garantir as duas é impossível)
2 afixos → 1+1
3+       → 2 do lado do TEMA do slot, 1 do outro
```

O resto é sorteado pelo peso da `AFINIDADE`, que é o que dá identidade aos nove
slots temáticos.

> **Duas versões foram medidas e descartadas.** Partir os afixos ao meio obriga
> um escudo Divino a carregar três linhas de dano: a `AFINIDADE` dava a uma
> blindagem 4,8 linhas defensivas em sete, e a metade forçada derrubava para 3,3.
> Medido em 41 conjuntos por setor, a sobrevivência caía até 13% enquanto o tempo
> de limpar melhorava — poder escorrendo da defesa para o ataque.

### A escada de raridade

| raridade | `power` | afixos | `tierMax` | peso | `sorteExpo` |
|---|---|---|---|---|---|
| Comum | 0,60 | 1 | 3 | 10000 | **−2,0** |
| Incomum | 1,90 | 2 | 4 | 1166 | **−0,5** |
| Raro | 2,20 | 3 | 6 | 292 | **0,5** |
| Épico | 2,70 | 4 | 7 | 42 | **1,4** |
| Lendário | 3,10 | 5 | 8 | 0,0367 | **2,0** |
| Mítico | 4,90 | 6 | 9 | 0,0132 | **1,0** |
| Divino | 7,00 | 7 | 10 | 0,00323 | **0,4** |

**Parede** (setor em que um conjunto inteiro daquela raridade trava):
Comum **24** · Incomum **40** · Raro **88** · Épico **190** · o resto além de 300.

### A Sorte — o laço de realimentação

`rollRarity`: `peso × (1 + sorte)^sorteExpo`, com `sorte` limitada a **5**
(`LIMITES.sorte.max`).

**A Sorte vem de itens. Itens raros trazem mais Sorte. Mais Sorte sorteia mais
raro.** Ninguém tinha medido esse laço. Fechando-o num ponto fixo, o jogador do
setor 200 vestia **maioria de Divino**.

O culpado era o **sentido da escada**: `sorteExpo` SUBIA até 5,2 no Divino, o que
com a Sorte no teto multiplicava seu peso por **11 mil** e o do Comum por 1. E o
teto era alcançado por volta do **setor 160** — metade do jogo colado nele.

**Baixar o teto não resolvia:** mesmo NO teto o Divino saía 1 em 42, e para
mantê-lo raro o teto teria de ser 0,5, o que é o mesmo que não ter o atributo.

A escada foi **invertida**: negativa embaixo (a Sorte faz o lixo parar de cair),
baixa em cima (no topo quase não atua).

| por sorteio | Épico | Lendário | Mítico | Divino |
|---|---|---|---|---|
| sem sorte | 1/264 | — | — | — |
| **no teto** | 1/4 | 1/1.508 | 1/37.500 | **1/300.000** |

Os pesos foram **resolvidos a partir do alvo**, não escolhidos. O alvo veio em
forma de jogadores: *"se 1000 jogadores estiverem no teto, é para uns 20 terem 1
divino"*. Medido o volume real de itens (2.358 numa passada até o setor 160, 795
por hora farmando no teto), isso vira 1 em 300 mil.

Conferido: **982 com Lendário, 213 com Mítico, 20 com Divino.**

### O conjunto que o jogador realmente veste

| setor | sorte | composição |
|---|---|---|
| 60 | 0,62 | Raro 56% · Épico 33% |
| 150 | 1,93 | Épico 89% · Raro 10% |
| 300 | 3,68 | **Épico 94%** · Lendário 1% |

**O jogo se vence com Épico.** Lendário para cima é conquista comemorada, não
degrau obrigatório.

### Tiers

`tierMax` vai de 3 (Comum) a 10 (Divino). O vetor de pesos é indexado pela
**distância até o teto**.

> **Bug pego pelos próprios testes:** o vetor estava invertido. `[4,3,2,1]` dava
> ao tier máximo o peso mais alto e ele saía na maioria das linhas — justo onde
> deveria ser conquista. Com `[1,2,3,4]`, o teto sai em 10% das linhas.

### Exclusão mútua

Afixos com `grupo` não se repetem na mesma peça. Sem isso um Divino podia rolar
`+1`, `+2` e `+3` projéteis na mesma peça e entregar seis numa linha só. Medido
antes da correção: 23 peças em 89 mil. **Empilhar entre PEÇAS continua valendo** —
o grupo impede o acúmulo dentro de uma.

---

## 4. Progressão da campanha — `data/balance/curvas.ts`

**300 setores** · 10 por galáxia · 5 ondas + 1 chefe por setor.

### Direção visual — a régua que separa cena de jogo

Seis decisões que fazem a tela dizer o que importa. Os números todos saíram de
medição no canvas, não de gosto.

#### 1. Escala unificada

O tamanho renderizado não formava hierarquia: um inimigo comum grande era MAIOR
que um elite pequeno, e a nave competia em massa com um elite.

| | antes (min/med/max) | depois | faixa |
|---|---|---|---|
| jogador | 48/74/88 | **48/58/64** | 48–64 |
| comuns | 32/59/87 | **40/54/70** | 40–70 |
| elites | 50/88/105 | **70/91/100** | 70–100 |
| chefes | 130/162/190 | intocados | 120+ |

**Remapeado, não limitado.** Cortar tudo que passa do teto comprimiria a
categoria num valor só — dez inimigos de tamanhos diferentes virariam dez do
mesmo tamanho. O remapeamento linear preserva ordem e espalhamento.

**A hitbox andou junto.** Escala e caixa são tabelas independentes, mas foram
calibradas olhando uma para a outra: a caixa foi desenhada sobre o sprite no
tamanho em que ele aparecia. Mexer só na escala descolaria a colisão da arte, e
a nave pareceria menor do que acerta — a pior injustiça num jogo de desvio.

A ferramenta é `tools/unificar-escala.ts`, e ela é reexecutável: arte nova entra,
roda de novo, a faixa se mantém.

#### 2. Cenário atrás do jogo

Aqui errei duas vezes antes de acertar, e as duas por medir a coisa errada.

Um véu global de 45% de escurecimento **não mudou quase nada**: o fundo já é
escuríssimo (luminância média 12,9 de 255), e escurecer o quase-preto não faz
efeito. O que compete pela atenção é o **pico**, não a média.

Medindo o percentil 99,9 do fundo contra o do gameplay, o cenário **já estava em
57%** — dentro da faixa de 40 a 65 —, e o véu o havia empurrado para **36%**,
abaixo dela. O fundo sumia em vez de recuar.

O competidor real era **um prop**: `planeta/infernal` a 0,78 de alfa com 297 px
de lado, contra 0,22 da nebulosa e 0,42 do anel.

| | |
|---|---|
| teto de alfa de corpo celeste | **0,65** |
| véu: luminosidade conservada | 0,82 |
| véu: saturação conservada | 0,68 |
| **pico do fundo, medido** | **41% do gameplay** |

O teto é aplicado na MONTAGEM dos props e não linha a linha, para corpo novo
nascer obedecendo.

**Armadilha de medição:** eu apagava os desenhos de gameplay mas deixava o HUD,
e o pico que atribuía ao fundo era texto de HUD.

#### 3. Três camadas de profundidade

| camada | conteúdo | velocidade |
|---|---|---|
| distante | nebulosa, estrelas pequenas | 0,25× |
| média | planetas, luas, estruturas | 0,60× |
| ambiente | poeira estelar | 1,60× |

O que cria profundidade não é a arte, é a **diferença** de velocidade: três
imagens rolando junto são três imagens sobrepostas. Com duas camadas o olho lê
"fundo e frente"; com três lê espaço.

A poeira passa **depois** do véu, porque é primeiro plano ambiental e não
cenário distante. Dentro dela o grão maior é mais rápido e mais opaco — a mesma
relação do parallax, aplicada dentro de uma camada, que é o que impede a leitura
de "folha de papel com pontos".

**Catálogo sem repetição (02/09/2026).** Os 19 conjuntos de `fundos` atendem
somente às galáxias 7–19. As seis superfícies atmosféricas longas, antes
restritas ao teste, atendem às galáxias 1–6 uma vez cada. As onze finais usam
seus backdrops determinísticos. A escolha não volta ao início da lista: nas 30
galáxias da campanha nenhum arquivo de fundo se repete, contrato coberto por
`tests/biomas-atmosfericos.test.ts`.

Baixa intensidade de propósito: 46 grãos, alfa máximo 0,34. Partícula demais
vira ruído e come a legibilidade que o véu acabou de comprar. Respeita
"reduzir efeitos".

#### 4. Padrão de arte

A regra para arte nova é **painted sci-fi sprite: bordas nítidas, detalhe
interno simplificado, iluminação vinda de cima**.

A parte enforçável já está no pipeline:

- **Sprite pequeno não é ampliado.** Reduzir é limpo, ampliar borra — o
  pipeline sempre parte de arte maior que o uso final.
- **WebP sem perda em toda arte de contorno.** O modo com perda mistura cor
  entre pixels vizinhos e borra a aresta que faz a silhueta funcionar em
  tamanho pequeno.
- **Normalização por grupo.** Detritos e ícones de elemento entram por área
  opaca ou por lado maior, não pelo tamanho do arquivo de origem — que costuma
  mentir.

O que não é enforçável — estilo de pintura, direção da luz — é briefing de arte,
e vive aqui para ser copiado no pedido.

#### 5. Integração ambiental

Poeira estelar em três faixas de velocidade dentro da própria camada, detritos
lentos passando (ver seção de Detritos) e as três camadas de parallax. Tudo em
intensidade baixa.

#### 6. HUD que não fica colado

Eram barras e texto soltos sobre o combate — e é isso que faz um HUD parecer
colado: sem moldura, o olho não separa instrumento de cena e as duas coisas
disputam.

Agora há **um módulo**, usado duas vezes: retângulo com o canto EXTERNO
chanfrado, fundo escuro, borda de 1 px e um filete na aresta que aponta para o
centro. O da direita é o mesmo espelhado — dois cantos com a mesma gramática
lêem como um instrumento só; dois desenhos diferentes leriam como duas
interfaces.

| | antigo | novo |
|---|---|---|
| cobertura da faixa superior | 7,0% | 19,4% |
| **luminância média** | **119,7** | **38,4** |
| pixels brilhantes | — | 15% (só o texto) |

Cobre **mais área** e pesa **um terço**. Presença é brilho, não área: a moldura
escura ocupa espaço vazio para separar instrumento de cena, e as marcas caíram
68% em luminosidade. O chanfro dá a leitura de "instrumento" sem custar espaço —
uma moldura completa em volta de tudo seria o painel gigante que não se quer.

### Trocar a arte de uma nave

Largue um PNG em `art-source/naves/` — em qualquer subpasta — com o nome do ID
da nave, e rode `npm run assets`. É só isso.

```
art-source/naves/inimigo/vespa_ambar.png    → substitui a arte do vespa_ambar
art-source/naves/jogador/aurora1.png        → substitui a do aurora1
```

O nome do arquivo é a única coisa que precisa estar certa. Errar o nome não
falha em silêncio: o pipeline avisa qual arquivo não achou dono e segue.

#### Por que existe um mapa gerado no meio

A ligação identidade↔arte mora em `data/`, que é TypeScript; o pipeline é
`.mjs` e roda antes de qualquer build. `npm run assets:mapa` escreve
`tools/mapa-de-sprites.json` a partir de `data/`, e o pipeline consulta esse
arquivo. O script `assets` já roda os dois na ordem certa.

A primeira versão era uma tabela escrita à mão dentro do pipeline:

```js
'vespa_ambar.png': 's2/enemy/d_5',
```

Ela funciona para duas trocas e desmorona em cem, porque exige DESCOBRIR a
chave de atlas de cada nave. E `d_5` não é descobrível — é procurável, uma de
cada vez, abrindo `spaceships2.ts` e contando índices.

Gerado e não escrito à mão porque nave nova entra em `data/` e o mapa a inclui
sozinho. Um arquivo mantido à mão envelheceria em silêncio, e o sintoma seria
uma arte que não substitui nada sem dizer por quê.

#### O censo, em 2026-08-27

| | entradas | sprites distintos |
|---|---|---|
| naves do jogador | 53 | 45 |
| inimigos | 68 | 68 |
| chefes | 30 | 30 |
| **total** | **151** | **139** |

Menos sprites que entradas significa **arte compartilhada**: `void_canhao` e
`void_zapper` usam o mesmo casco, por exemplo. Trocar essa arte muda as duas —
o que às vezes é o desejado e às vezes não, e o mapa é onde se descobre isso
antes de trocar.

Os 139 sprites vêm de **onze atlas diferentes**:

| atlas | sprites |
|---|---|
| `s2` | 75 |
| `void` | 25 |
| `ship` · `nave` · `enemy` · `hostil` | 25 |
| `prop` | 6 |
| outros | 8 |

A substituição por ID funciona para **todos**, porque ela age sobre a chave do
atlas e não sobre a pasta de origem. Isso importa: `prop` são os seis sprites
que os **trinta chefes** reaproveitam — torres e destroços, não naves.

#### Orientação

A rotação segue o PAPEL, não a pasta: nave do jogador aponta para cima, hostil
e chefe para baixo. Quase todo pack entrega a arte apontando para cima, então
só hostil e chefe giram 180°.

---

### Detritos — asteroides e lixo espacial

66 sprites em seis grupos, num atlas de 512×512 (274 KB). São **obstáculo de
cenário**, não inimigo.

#### O que eles NÃO rendem

Nada. Nem XP, nem recurso, nem item, nem abate, e não entram na contagem que
fecha a onda. Destruir um detrito não aproxima o jogador de coisa alguma.

Isso é a definição, não um esquecimento — e é por isso que `Detrito` é um TIPO
PRÓPRIO e não um inimigo com recompensa zero. Um inimigo passa por
`rewardKill`, entra em `restam`, alimenta missão e conta abate; desligar cada
uma dessas coisas com um `if` deixaria quatro lugares onde alguém poderia
esquecer. Sendo outro tipo, ele nunca chega perto desses caminhos.

**Verificado:** 26 detritos nascidos e destruídos, e nenhum dos onze campos de
estado do jogador mudou — XP, nível, sucata, núcleo, cristal, itens, itens
achados, abates, `restam`, onda e setor.

#### O que eles são

Comem projétil dos **dois lados** e machucam no encontrão. É o que os separa de
um plano de fundo: um cenário que não interfere é decoração, e a nave passaria
por ele sem nunca reparar. Comendo tiro, um asteroide entre o jogador e o alvo
vira decisão — atirar em volta, furar a pedra, ou usá-la de escudo contra quem
está atrás.

Perfuração vale contra pedra: quem pagou por atravessar fileiras não deve ser
parado pelo cenário.

| tamanho | raio | vida | velocidade | impacto |
|---|---|---|---|---|
| pequeno | 11 | 1 golpe | 1,35× | 0,25 do dano do setor |
| médio | 21 | 3 | 1,00× | 0,50 |
| grande | 38 | 8 | 0,72× | 1,00 |

Grande é lento, duro e dói; pequeno é rápido, frágil e mal arranha. É a relação
que o olho espera de massa, e é ela que faz o jogador tratar um asteroide grande
como parede e um cascalho como poeira, sem tutorial.

**O dano do encontrão vem da curva do setor**, como fração — não de um número
próprio. Uma constante fixa seria trivial no setor 200 e letal no 2; puxar da
curva faz o detrito acompanhar o jogo sem inventar uma segunda régua.

#### Os momentos

| clima | taxa | duração | total | mistura |
|---|---|---|---|---|
| esparso (repouso) | 0,35/s | permanente | — | 60/32/8 |
| **CHUVA DE METEOROS** | 5/s | 8 s | **40** | 62/30/8 |
| **CAMPO DE SUCATA** | 3,2/s | 9 s | ~29 | 40/42/18 |

Medido: a chuva de meteoros solta **exatamente 40** — 26 pequenos, 13 médios e
1 grande — com pico de **34 em tela**, e volta ao repouso sozinha.

A mistura pende para o pequeno de propósito: quarenta asteroides grandes seriam
uma parede intransponível, quarenta cascalhos são uma chuva. O punhado de
grandes é o que dá peso ao momento.

O intervalo entre momentos é sorteado entre **22 e 48 s**. Faixa larga de
propósito: um evento que chega em relógio fixo deixa de ser evento e vira fase.

#### Detalhes que valem registro

**O spawn usa acumulador fracionário.** A taxa de repouso é 0,35/s, que num
quadro de 1/60 dá 0,006 detrito — arredondar por quadro nunca soltaria nada.

**Não roda no Laboratório.** Aquela tela existe para COMPARAR fichas, e um
asteroide atravessando a medição a invalidaria sem avisar.

**Desenhados atrás dos inimigos.** Por cima esconderiam o que precisa ser
acertado; no fundo virariam textura.

**Não reaparecem pelo topo.** Um detrito que volta quebra a leitura de que a
nave está avançando pelo espaço.

**Só o grande sacode a tela.** Um cascalho tremendo a câmera daria a um detrito
o peso de um chefe.

**As pastas de origem mentem sobre o tamanho** — o "asteroide médio" vem de 50 a
313 px. O pipeline recorta ao conteúdo e normaliza por grupo, o que transforma
seis pastas desiguais em três escalas de verdade.

### Combustível — o que força a rotação de frota

Sem ele a frota é decoração: o jogador compra o casco mais forte que pode e voa
só com ele até comprar o próximo. Os outros quarenta ficam no hangar sem nunca
sair.

**A autonomia é INVERSA ao poder.** Uma nave forte que também durasse mais seria
estritamente melhor, e a rotação nunca aconteceria. Há teste percorrendo todos
os pares de cascos para garantir que mais poder nunca dá mais autonomia.

| tier | exemplo | autonomia | recarga | encher |
|---|---|---|---|---|
| T1 | Lança Rubra | 19,7 h | 4,2 h | 129 núcleos |
| T2 | Ignis Mk I | 19,1 h | 4,5 h | 318 |
| T3 | Ignis Mk II | 16,5 h | 6,0 h | 1.080 |
| T4 | Centurião Atlas | 14,3 h | 7,3 h | 1.741 |
| T5 | Víbora Helix | 9,5 h | 10,0 h | 3.155 |
| T6 | Martelo Hélios | 8,3 h | 10,7 h | 3.519 |
| T7 | Aurora Negra | 7,3 h | 11,3 h | 3.824 |

Extremos medidos: **Aurora Mk I 20,0 h** · **Bastião-8 6,0 h**.

#### Por que a escala é logarítmica

O poder dos cascos vai de 79 a 13.691 — **173×**. Numa escala linear, todos os
cascos abaixo do tier 6 cairiam praticamente no mesmo ponto da curva e teriam a
mesma autonomia. O poder cresce por tier de forma geométrica, então a autonomia
tem de ler o poder do mesmo jeito.

O poder vem de `powerScore` sobre um casco **nu** — sem item, sem nível. Uma
nave fraca bem equipada não merece o tanque de uma forte, senão o jogador
contornaria a rotação empilhando itens na primeira nave.

#### As 6 h do casco mais forte não são número redondo por acaso

São o mesmo teto de ausência diária do placar. A melhor nave do jogo carrega
**exatamente uma janela de offline**: nem mais, para não existir nave que
dispense rotação; nem menos, para o teto de ausência não ser inalcançável com a
melhor frota.

#### A recarga é a inversa da autonomia

Por um motivo diferente: se a nave forte enchesse tão rápido quanto a fraca,
bastaria ter DUAS fortes e alternar — a rotação viraria um par, não uma frota.
Com recarga lenta, é preciso gente para voar enquanto a melhor descansa.

A recarga do hangar é grátis e lenta. Pagar em núcleo é comprar TEMPO, e o preço
é proporcional ao que falta — cobrar o cheio por um tanque em 90% seria cobrar
por combustível que já está lá.

#### O tanque é uma FRAÇÃO, e ausente significa cheio

Guardar segundos amarraria o save à autonomia do dia da gravação: qualquer
ajuste na curva faria naves antigas aparecerem transbordando ou pela metade sem
ninguém ter voado. Ausente = cheio é o que faz save antigo migrar sem aterrissar
a frota de quem já jogava.

#### Um relógio só, e o que acontece ao secar

`passarTempo` roda em `patrolTick` (ao vivo) e em `abstractTick` (offline). São
os dois únicos relógios do jogo, e a nave está em campo nos dois — gastar só num
deles faria a aba fechada, ou aberta, ser de graça.

Ao secar, o comando passa sozinho para a **melhor nave que ainda tem tanque**.
Deixar o jogador parado numa nave que não decola transformaria o sistema numa
punição por estar ausente; a rotação é o objetivo, o castigo não.

Com a frota inteira em terra, **a incursão para**. Medido: `patrolTick` rendeu
0 de sucata com todas as naves abaixo do piso. Sem isso o combustível seria uma
barra decorativa.

Mas o relógio continua correndo mesmo em terra — é assim que as naves paradas
voltam a encher. Parar tudo ao secar deixaria o jogador sem saída nenhuma.

#### O piso para decolar não é zero

É 5%. Uma nave que decola com 0,5% cai em vinte segundos e devolve o jogador à
mesma tela — o piso faz "sem combustível" ser um estado que se resolve, e não um
ciclo de decolar e cair. No Hangar, "Ativar" fica desabilitado abaixo dele.

### Regra elemental — o que uma nave aceita montar

Uma nave só monta item **neutro** ou **do próprio elemento**. É o que dá
identidade tática ao casco: uma nave de gelo é uma nave de gelo, não um chassi
onde cabe o que caiu.

**Sozinha, a regra seria cruel de um jeito invisível.** A chance de um item
sair neutro CAI com a raridade — 80% no Comum, 3% no Divino —, então quanto
mais raro o achado, menor a chance de servir. Medido, um Divino serviria em 22%
das vezes: a peça mais difícil do jogo chegaria inútil quatro vezes em cinco.

Por isso ela só existe junto do serviço de conversão:

| | |
|---|---|
| caem prontos | **81,7%** |
| passam pela loja | 18,3% |
| viram lixo | **0%** |

O custo é a moeda, não a peça. E 18,3% dos drops passando por um serviço é um
sorvedouro que a economia não tinha.

#### Os dois serviços da Central

| serviço | custo | setor | o que faz |
|---|---|---|---|
| **Recalibrador de Munição** | 6 cristais | 0 | converte uma peça do inventário |
| **Reator de Assinatura** | 30 cristais | 8 | troca o elemento de uma nave |

Cinco vezes mais caro para a nave de propósito: mudar a identidade do casco é
decisão, não ajuste. Ambos cobram em cristal, a moeda mais rara — a conversão
precisa doer o bastante para o jogador preferir a peça que já veio certa,
senão o elemento do drop deixaria de significar algo.

São os únicos serviços do catálogo com **alvo**: o resto é um botão que paga e
acontece. `ShopItem.alvo` faz o painel abrir um seletor em vez de comprar —
cobrar por "trocar o elemento" sem dizer de quê e para quê seria cobrar por uma
decisão que o jogador ainda não tomou. O botão do elemento em que o alvo já
está fica desabilitado: recusar depois de cobrar seria pior que não deixar
clicar.

#### Trocar o elemento da nave NÃO desmonta o conjunto

As peças que deixaram de servir continuam instaladas até o jogador decidir.
Esvaziar o conjunto sem avisar seria a pior forma de descobrir a regra;
`pecasIncompativeis` é quem a tela consulta para mostrar o estrago.

Verificado no jogo: trocar de raio para gelo custou 30 cristais e deixou as
**8 peças montadas** onde estavam.

#### A recusa mora no modelo, e a régua obedece

Anatomia, inventário e auto-equipar são três caminhos até `equip`, que passou a
devolver `boolean`. Uma regra escrita em cada um seria a mesma regra três
vezes, com duas chances de divergir.

O **arnês de balanceamento** obedece também, e isso não é detalhe: sem mudá-lo,
ele montaria conjuntos que nenhum jogador consegue montar e toda medição de
ritmo mediria uma nave que não existe — o oposto da premissa do projeto. Ele
modela o jogador que converte na loja, porque o serviço existe e ele o usaria.

#### Elemento da nave no save

`naves[id].elemento` guarda só a EXCEÇÃO. Ausente significa "como saiu de
fábrica", e o nativo continua vindo de `hulls.ts` — save antigo migra sem tocar
em nada.

Nave de elemento `padrao` aceita só neutro. Não é caso especial: `padrao` é o
elemento dela e a regra é a mesma. É o preço de voar sem aposta elemental — em
troca, dano neutro nunca é resistido.

### Posturas do piloto de IA — três, sem meio-termo

O jogador não pilota: escolhe uma postura. Eram quatro, e a quarta não era uma
escolha — era a ausência de uma.

| postura | evade | aggression | greed | standoff | alvo |
|---|---|---|---|---|---|
| **agressivo** | 0,75 | **1,60** | 0,50 | 0,62 | perigoso |
| **evasivo** | **1,90** | 0,55 | 0,60 | 0,85 | próximo |
| **coletor** | 1,10 | 0,70 | **2,00** | 0,76 | fraco |
| ~~equilibrado~~ | ~~1,15~~ | ~~1,00~~ | ~~0,80~~ | ~~0,74~~ | ~~próximo~~ |

O equilibrado **dominava o coletor em dois dos três eixos** — mais desvio E
mais agressividade, perdendo só em coleta — e não era extremo em nenhum. Uma
opção assim não se escolhe, se aceita: nunca é a melhor, nunca é a errada, e
isso basta para absorver a decisão inteira.

As três que ficaram lideram um eixo cada e nenhuma domina outra, então escolher
custa alguma coisa: arriscar, sobreviver ou coletar.

**Padrão e migração são decisões diferentes, de propósito.** Save novo nasce
`agressivo` — é o que se espera de um jogo de nave, e o começo aguenta
(medido: 83% de vida ao fim do setor 1). Save que usava o equilibrado cai em
`evasivo`: quem já jogava não pediu para mudar de postura e pode estar com a
aba fechada agora. Migração silenciosa não pode aumentar o risco de quem não
está olhando.

O Laboratório também perdeu a opção. A ficha padronizada, que existe para
COMPARAR cascos sob a mesma postura, passou a rodar em `evasivo`.

### Densidade da onda — quantos inimigos entram

O começo do jogo estava vazio e acabava antes de começar. Medido: **o setor 1
inteiro em 4,0 segundos**, com ondas de 2 a 5 inimigos. Só por volta do setor
20 o ritmo ficava decente.

| | antes | depois |
|---|---|---|
| ondas do setor 1 | 2 · 5 · 5 · 5 · 5 · 3 | 23 · 50 · 51 · 50 · 51 · 15 |
| total do setor 1 | 25 | **240** |
| setor 1 completo | 4,0 s | **70,1 s** |
| `DENSIDADE_INICIO` | 5 | 50 |
| `DENSIDADE_FIM` | 20 | 90 |

O adensamento é de **10× no setor 1** e 4,6× no 300 — a curva sobe menos no
fim porque lá a contagem já era razoável.

### Três coisas tiveram de acompanhar, e cada uma por um motivo diferente

**A XP não pode seguir a contagem.** Ela é fixa por abate
(`grantXp(2 + bounty × 0,25)` em `rewardKill`), então dez vezes mais inimigos
seriam dez vezes mais XP — e a densidade, que é escolha de RITMO, viraria
alavanca de progressão. Agora o abate divide um ORÇAMENTO da onda:

```
grantXp((2 + bounty × 0,25) × abatesDeReferencia / unidades)
```

`abatesDeReferencia` é a contagem que a onda teria com a densidade antiga —
a curva velha ficou congelada em `densidadeParaXp` só para isto. Um divisor
constante não serviria: o adensamento não é uniforme. Verificado: a XP bruta
de um setor é **idêntica** antes e depois (setor 1: 1,424; setor 3: 3,247).

Recursos já eram invariantes — `rewardKill` usa `share = 1/unidades`.

**A pressão também é por cabeça.** Sem dividir, 10× inimigos seriam 10×
projéteis em tela: o pedido era mais alvos, não parede de tiro. `pressao` é
multiplicada por `abatesDeReferencia / unidades`, então o que a onda cospe por
segundo continua o mesmo — muda em quantas bocas. No setor 1 isso dá 0,04 por
inimigo contra 121 inimigos.

**O caminho abstrato precisou aprender a entrada.** A cena solta a onda em
levas de 4 a 8 a cada 1,1–2,4 s, e com a onda adensada é ISSO que determina a
duração no começo do jogo: no setor 1 o inimigo tem 0,2 de vida e morre
instantaneamente — o que se espera é ele chegar.

`abstractTick` matava por dano puro e limparia o setor 1 em 0,4 s contra os
70 s do jogo ao vivo. Ficar offline viraria o jeito rápido de progredir. Agora
o abate tem dois tetos: `min(dano/vidaUnitária, TAXA_DE_ENTRADA)`. As
constantes da leva saíram do `WaveDirector` para `curvas.ts` junto — número de
balanceamento não mora dentro de uma cena.

### Um bug latente que o adensamento tornou alcançável

O pool de inimigos tem teto e `spawn` devolve `null` quando enche. O director
fazia `break` e **avançava o cursor mesmo assim** — o resto do grupo sumia do
cronograma com `pending` descontado só do que nasceu, e a onda ficava devendo
inimigos que nunca viriam. Com ondas de até 240 num pool de 200 isso deixou de
ser hipotético. Agora o grupo encolhe e espera a próxima volta; o pool subiu
para 260.

### O custo, medido e não escondido

Onda mais longa é mais tempo sob fogo. `incomingDps` é uma taxa fixa (1,5
acertos/s), então o dano recebido por onda cresce com a duração:

| setor | vida mínima antes | vida mínima depois | mortes |
|---|---|---|---|
| 1 | 98% | 83% | 0 → 0 |
| 3 | 90% | 52% | 0 → 0 |
| 5 | 36% | **0%** | **0 → 3** |

Os setores 8+ já morriam antes do adensamento, na mesma medida — isso é a nave
sem equipamento da régua, não a densidade.

O setor 5 é o ponto a vigiar. Não foi compensado de propósito: mexer em
`curvaDano` para acomodar a densidade misturaria dois sistemas calibrados
separadamente, e o teste de ritmo (`golpesAteMorrer` entre 8 e 90) continua
passando — ele mede letalidade por golpe, e é cega para duração.


### A inversão que salvou tudo

```
hpDaOnda = poderEsperado(setor) × tempoAlvo(setor)
danoDoInimigo = defesaEsperada(setor) / golpesAlvo(setor)
```

A dificuldade **deriva do poder do jogador**, não o contrário. Antes disso: setor
1 trivial (0 s por onda), setor 100 impossível (5.266 s), divergência de
**131.500×** em 99 setores. Depois: 3,2×.

`poderEsperado` e `defesaEsperada` são **ajustes por mínimos quadrados** contra o
poder medido do jogador real. Cada um é o **mínimo de duas curvas**: uma lei de
potência e uma exponencial de início — porque uma lei de potência só não descreve
as duas pontas. O começo é dominado por QUANTOS slots estão preenchidos; o resto,
pela qualidade do que está neles. São dois regimes, e ignorar isso já travou o
jogo no setor 5 com 150 mortes.

| constante | valor | o quê |
|---|---|---|
| `PODER_A` · `PODER_P` · `PODER_C` | 0,0602 · 3,0655 · 3 | lei de potência ofensiva |
| `DEFESA_A` · `DEFESA_P` · `DEFESA_C` | 27,630 · 1,2515 · 1,5 | lei de potência defensiva |
| `INICIO_BASE` · `INICIO_RAZAO` | 23,1 · 1,2296 | regime de início, ofensiva |
| `INICIO_DEFESA_BASE` · `_RAZAO` | 162,1 · 1,0882 | regime de início, defensiva |

### O ritmo, medido

| setor | 12 | 50 | 120 | 220 | 300 |
|---|---|---|---|---|---|
| tempo de limpar ÷ alvo | 0,82× | 1,03× | 0,91× | 0,95× | 1,03× |
| golpes até morrer ÷ alvo | 1,02× | 0,94× | 1,07× | 1,01× | 1,01× |

> ⚠️ **Dívida aberta:** a assimetria ofensiva/defensiva persiste — expoente
> **3,07 contra 1,25**. Os afixos ofensivos são multiplicativos e os defensivos
> aditivos. Já foi pior (3,70 contra 1,10). As curvas acomodam o que sobrou;
> fechar a diferença é trabalho de orçamento de item (§7).

---

## 5. XP e nível — `data/balance/curvas.ts`, `sim/index.ts`

```
curvaXpPersonagem(n) = PERSONAGEM_XP_BASE × n^PERSONAGEM_XP_EXPO   (10 · 2,96)
curvaXpNave(n)       = NAVE_XP_BASE × n^NAVE_XP_EXPO               (60 · 1,55)
XP_GANHO_GLOBAL = 24
```

O nível acompanha o setor até ~180, e o teto de 300 chega no **setor 269**:

| setor | 10 | 30 | 60 | 100 | 140 | 180 | 220 | 260 |
|---|---|---|---|---|---|---|---|---|
| nível | 11 | 26 | 55 | 100 | 144 | 192 | 243 | 292 |

**A renda de XP deriva de `poderEsperado`** (via `bounty`). Toda vez que a curva
de poder se move, o XP precisa ser reajustado junto — foi por isso que
`XP_GANHO_GLOBAL` saltou de 4 para 24 quando `PODER_A` caiu 8,8×.

> **Não teste isso com um limite absoluto.** A versão anterior exigia que o nível
> 300 custasse menos que um número fixo de XP, e esse número precisou subir DUAS
> vezes, reprovando nas duas mudanças em que o 300 continuava alcançável. Hoje o
> teste **soma a renda real setor a setor** e verifica a propriedade.

---

## 6. Morte — `sim/morte.ts`

| o quê | quanto |
|---|---|
| XP perdido | 15% do **acumulado na faixa do nível**, não da faixa inteira |
| Sucata perdida | fração de `SUCATA_PERDIDA` do já depositado |
| Itens | **nada** |
| Carga da incursão | perdida inteira |
| Setor | volta à onda 1 do **mesmo** setor; não regride |

Com a faixa esgotada, cai de nível e cobra da faixa de baixo — sem isso o
acumulado só encolheria assintoticamente e ninguém jamais perderia nível. **O
nível 1 é o piso.** Cair de nível **devolve o último nó da Matriz**.

---

## 7. Central de Serviços — `data/shop.ts`, `sim/index.ts`

A Loja não participa de `resolveStats`. Este é o invariante central: o poder da
nave continua vindo apenas de item, craft e Matriz.

| linha | contrato |
|---|---|
| Carga | quatro concessões idempotentes de +5 espaços de item e recurso |
| Matriz | devolve os pontos já conquistados; não concede nenhum |
| Provação | soma uma tentativa sem ultrapassar o teto atual (5 ou 6 com VIP) |
| Câmbio | sucata → núcleos, com perda e cota derivada do nível de comando |
| Recalibração | troca identidade/qualidade, preservando o tier da linha |
| Baús | debita cristais e credita a cápsula escolhida no estoque |
| VIP | 500 cristais por 30 dias; renovações acumulam duração |

`shopLimit` deriva a cota, em vez de salvar um relógio ou estoque. As compras
realizadas ficam em `state.shop`; subir de nível libera operações novas até o
teto da linha.

`state.vip.expiresAt` é a única persistência da assinatura. `sim/vip.ts` deriva
do relógio o teto de tentativas (5/6), o rastreador de missões (4/5), o acesso
ao controle manual no nível 15+ e as duas automações exclusivas. O cliente não
concede pacotes de cristais: os preços são catálogo até existir checkout
validado pelo servidor.

O gate aparece em três lugares e nos três ele é **visível, não silencioso**: o
botão PILOTAR fica desabilitado com o motivo no `title`, Ajustes desenha a
opção apagada com a nota do benefício, e o guia troca a redação do passo dos
modos. Automação é diferente: `autoEquip` e `autoDispose` continuam GRAVADOS
como o jogador os deixou, e só param de surtir efeito — assim o passe expirado
não apaga a preferência, e renová-lo devolve o comportamento anterior sem
reconfiguração.

O roteiro do onboarding é, por isso, `passosDoOnboarding(manualDisponivel)` e
não mais uma constante: o guia é reabrível por Ajustes, logo ele também é lido
por quem já passou do nível 15. `tests/onboarding.test.ts` roda as regras de
estrutura nas duas redações — a variante que ninguém abre durante o
desenvolvimento é justamente a que apodrece.

`recalibrateAffix` reutiliza as regras do drop: slot, elemento, raridade mínima,
prefixo/sufixo e grupos de exclusão. Recalibrar nunca produz uma combinação que
o gerador natural recusaria.

---

## 8. Missões — `sim/missoes.ts`, `data/missoes.ts`, `data/personagens.ts`

**9 contatos**, confiança 0–5 em algarismos romanos, quatro tipos de missão.

### O funil único

```
qualquer coisa que acontece  ──▶  Sim.registrar(fato: FatoDeJogo)
                                        │
                                        └──▶ avalia os Requisito de cada missão
```

`FatoDeJogo` e `Requisito` são **uniões discriminadas**. As missões declaram o
que contam **como DADO**, não como código — e o compilador pega entrada
malformada que silenciosamente nunca dispararia.

`state.missoes` é criado **sob demanda**: uma missão nova no catálogo nasce
funcionando em save antigo, sem migração.

**Medalhas** ficam **fora** de `resources` — medalha não se gasta em loja nem
entra em fórmula de poder. Pô-la junto das três moedas obrigaria toda conta de
economia a aprender a ignorá-la.

---

## 9. Núcleo de Provação — `data/provacao*.ts`, `sim/provacao.ts`, `sim/desafio.ts`

**100 pisos**, um chefe único em cada, cor cyan, modo paralelo à campanha.

| arquivo | o quê |
|---|---|
| `data/provacao.ts` | os 100 pisos por regra, 16 modificadores, marcos a cada 10 |
| `data/provacao-chefes.ts` | 100 chefes em 10 camadas, 8 arquétipos |
| `data/provacao-especiais.ts` | 18 especiais, cada um com telegrafia (`aviso`) e `carga` |
| `sim/desafio.ts` | **a fronteira**: o único módulo que traduz piso → encontro |
| `sim/provacao.ts` | tentativas, progresso, recompensa |

### Geração determinística

O conteúdo usa **hash determinístico**, não o `Rng` compartilhado: o piso 63 é
idêntico para todo jogador. `escalaDoPiso = 1,053^(piso−1)` e
`setorEquivalente(piso) = 12 + (piso−1) × 2,9`.

### Os especiais

Cada chefe tem uma **barra de especial** que carrega e dispara. Quatro famílias:
atordoar, curar, escudo, dano. Todo especial tem **`aviso` obrigatório** —
telegrafia. Os 18 são distribuídos sem repetir dentro de uma camada.

### Tentativas

5 tentativas, uma recuperada a cada 30 min, **derivadas do relógio** e não de
tique — sobrevive a fechar a aba.

### Dois erros que valem lembrar

> **O piso 20 exigia 15.449.999 segundos.** A regeneração (1,2%/s) superava o DPS
> do jogador e o chefe era literalmente imortal — o "DPS check" que o §87 proíbe.
> Corrigido **no jogo**: a regeneração agora pausa 2,5 s após dano.

> **A progressão contava duas vezes:** `hpPool` multiplicava por `escala`
> enquanto `setorEquivalente` já avançava setores.

Os cinco modificadores mecânicos do §14 também são consumidos pelo combate:
invulnerabilidade cíclica, zonas avisadas, ecos sem recompensa, barreira cíclica
e núcleo móvel que multiplica dano. Resta arte dedicada dos 100 chefes.

---

## 10. Economia e save — `sim/state.ts`, `sim/types.ts`

### `GameState`

```
version, createdAt, savedAt, playtime
resources / lifetime          três moedas + acumulado de todos os tempos
hull, fleet, naves            casco ativo, desbloqueados, nível/XP POR nave
equipped, inventory           10 slots + a grade
cargaLiberada                 ids das concessões de espaço (15 → 70)
armazem                       material → quantidade (só o que existe)
shop, chests, codex
command                       nível, XP, allocated[], refunds
run, bar, universe
missoes, medalhas, confianca
provacao                      pisoMax, primeiraConclusao[], marcos[], tentativas
settings
```

**`cargaLiberada` é lista de ids, não contador.** Com um contador, recomprar na
loja ou rematar um chefe daria espaço de novo. O id também é o que permite ao
painel dizer de onde veio cada espaço.

**Save malformado não pode travar o boot.** A migração v5 apara o que sumiu,
preenche o que falta e normaliza frota, casco, recursos e preferências antes de
o jogo usar o estado.

### Modo de teste

`sim.setTestMode(true)` dá recursos infinitos (`materialDisponivel → Infinity`) e
libera alcance, nível e frota de forma **não destrutiva** — são getters de
leitura (`alcanceLiberado`, `nivelLiberado`, `frotaDisponivel`), não gravações no
save.

---

## 11. Testes — 468 aprovados, em 20 arquivos

| arquivo | testes | cobre |
|---|---|---|
| `balanceamento.test.ts` | 42 | curvas, raridades, ritmo, anel elemental, limites |
| `drops.test.ts` | 37 | sorteio de item, pesos, elementos |
| `provacao.test.ts` | 32 | geração dos 100 pisos |
| `provacao-progresso.test.ts` | 28 | tentativas, marcos, recompensa |
| `provacao-combate.test.ts` | 25 | especiais, modificadores, encontro |
| `tiers.test.ts` | 22 | T1–T10, distribuição, teto por raridade |
| `missoes.test.ts` | 20 | funil de fatos, requisitos, entrega |
| `fusao.test.ts` | 19 | probabilidade anunciada × real |
| `provacao-chefes.test.ts` | 19 | 100 chefes únicos, arquétipos, especiais |
| `contatos.test.ts` | 17 | confiança, escada, catálogo |
| `morte.test.ts` | 17 | perda de XP, nível, Matriz, sucata |
| `progressao.test.ts` | 17 | setores, ondas, encontros |
| `save.test.ts` | 11 | migração, save malformado |
| `afixos.test.ts` | 5 | prefixo/sufixo, piso, identidade de slot |
| `itens-novos.test.ts` | 5 | atlas e ícones |
| `arte-elemental.test.ts` | 4 | tintura elemental |
| `modo-teste.test.ts` | 3 | destravas não destrutivas |

Os testes incluem blocos de **linha de base** que fixam por escrito o quanto o
balanceamento está quebrado. **Falhar é sinal de sucesso** — quer dizer que uma
etapa mexeu nas curvas. Ao corrigir, **troque a asserção pela faixa saudável em
vez de apagar o teste**.
