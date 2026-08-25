# Telas

Cada tela do Órbita Zero: o que faz, onde mora, o que lê, o que escreve e o que
ainda falta. Complementa [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

**Regra de camada que vale para todas:** `ui/` **não decide regra de jogo**. Se
um painel precisa calcular, o cálculo mora em `sim/`. Painel lê `Sim` e desenha.

---

## Ícones das abas

As treze abas usam arte própria em `assets-static/ui/menu/*.webp`, publicada
por `tools/optimize-menu-icons.mjs` a partir de `art-source/ui/menu/*.png`.

O otimizador **apara antes de redimensionar**: as artes chegaram de 179×205 a
378×378 com o objeto em posições diferentes, e sem o `trim` cada uma ocuparia
uma fração distinta dos 22px da aba. O `threshold: 12` existe porque o halo de
alfa quase-zero em volta não é aparado por um corte no zero absoluto.

O `Panel` aceita `iconUrl` (arte) e `icon` (sprite do atlas). Quando há
`iconUrl`, o `Shell` monta `img.tab-art`; senão, `spriteIcon`. O `icon`
continua declarado como reserva.

Os estados são por **opacidade**, não por brilho: 0,74 inativo · 0,95 hover ·
1 ativo com halo. Medido, um lift de brilho estourava 4% dos pixels da arte
nova — ela já é clara (luminância média 43 contra 16 do fundo da barra).

---

## A gramática de painel

Todas as camadas usam a MESMA moldura, o mesmo fundo e o mesmo título de seção,
definidos uma vez no fim de `src/styles/main.css`:

| token | valor |
|---|---|
| `--painel-linha` | `rgba(107, 139, 159, .24)` |
| `--painel-raio` | `7px` |
| `--painel-padding` | `12px` |
| `--painel-fundo` | `linear-gradient(180deg, #070d14e6, #04090fEB)` |
| `--painel-filete` | `rgba(85, 189, 220, .55)` |

As classes são `.painel-corpo` (grade de três colunas), `.painel-col` (a
moldura, com `.rola` para rolagem própria) e `.painel-secao` (Chakra Petch
600/10,5px, espaçamento 1,5px, `#abc0cb`, filete à esquerda por `box-shadow:
inset` e traço inferior).

> **Como se chegou aqui.** Baús, Loja, Bancada e Provação convergiram para essa
> linguagem cada um com a própria cópia das regras. Missões tinha borda de outra
> cor, sem raio e sem fundo, com título 700/9px em `#86dfff`; Galáxia não tinha
> moldura nenhuma. Medido nos estilos COMPUTADOS de todas as seis, hoje a
> assinatura é idêntica. `--afx-line` do craft de afixos, que destoava por um fio
> (`.23` contra `.24`), passou a apontar para o token.

---

## A moldura

```
┌──────────────┬────────────────────────────────┬──────────────────┐
│  LeftRail    │  palco (canvas do combate)     │   Inventário     │
│  263 linhas  │  modes/vertical/VerticalMode   │   painel FIXO    │
│              │            ┌──┬──────────────┐ │   233 linhas     │
│  nave, HP,   │            │┤ │  Anatomia    │ │                  │
│  escudo,     │  ┌─────────┴──┤  SOBREPOSTA  │ │  nunca sai da    │
│  elemento,   │  │ CAMADA em  │  translúcida │ │  tela, e por     │
│  postura,    │  │ tela cheia └──────────────┘ │  isso não tem    │
│  recursos    │  │ (z-index: 60)              │ │  aba própria     │
└──────────────┴────────────────────────────────┴──────────────────┘
                             ▲ ┤ = alça, abre e fecha
   ▲ abas: Galáxia · Armazém · Fabricação · Missões · Provação ·
           Matriz · Hangar · Baús · Loja · Códex   (+ ⚙ Ajustes)
```

**`ui/Shell.ts`** (398 linhas) monta tudo. Dois pontos que confundem quem chega:

- **O painel ativo é reconstruído inteiro a ~5 Hz**, sem diffing. É deliberado:
  são listas pequenas, e diffing custaria mais em complexidade do que economiza
  em quadro.
- **O Inventário é o `painelFixo`** — mora na coluna direita e é pulado ao
  montar as abas (`buildTabs`). Todo o resto tem `overlay = true` e abre como
  **camada em tela cheia**, porque o trilho de ~350 px basta para uma lista e não
  basta para um painel de trabalho.

Abrir por código: `bus.emit('panel:open', { id })`.

---

## Inventário — `id: 'inventario'`

`ui/panels/InventoryPanel.ts` · 233 linhas · **painel fixo, sem aba**

Grade de peças com filtro por raridade (7 botões), filtro por elemento, cinco
ordens (poder, raridade, slot, nível, melhor tier), favoritos, venda e
desmontagem em lote. A ficha antecipa os dois retornos e vem de `ui/ItemCard.ts`.

- **Lê:** `sim.state.inventory`, `sim.state.equipped`, `sim.stats`
- **Escreve:** equipar/desequipar, favoritar, vender por Sucata, desmontar por materiais
- **Capacidade:** 15 espaços no começo, até 70 por conquista (`cargaLiberada`)

**`ui/ItemCard.ts`** (184 linhas) desenha a ficha: nome colorido por raridade,
implícito da base, elemento, conjunto, e os afixos **agrupados em Prefixos e
Sufixos** com etiqueta de tier (`T1`…`T10`). O rótulo do grupo só aparece quando
existem os dois — numa peça comum, de uma linha só, "Prefixos" sozinho é ruído.

> A ordem do array **não** serve para agrupar: o sorteio preenche os pisos das
> duas naturezas antes do resto, então as linhas chegam intercaladas. O tipo se
> lê de `tipoDoAfixo(AFFIX_BY_ID.get(a.id))`.

---

## Galáxia — `id: 'galaxia'`

`ui/panels/GalaxyPanel.ts` · 175 linhas · camada

Mapa de mundo. Cada galáxia é uma janela de **dez fases** sobre a progressão de
setores que já existe — **não há estado novo salvo**, só uma forma de ler e
navegar `run.sector`. Permite voltar a qualquer fase já vencida, para farmar um
chefe específico.

- **Lê:** `run.sector`, `universe.bestSector`, `describeGalaxy()`, `galaxyPhases()`
- **Escreve:** `sim.jumpSector()`

---

## Armazém — `id: 'armazem'`

`ui/panels/ArmazemPanel.ts` · 99 linhas · camada

Os **70 recursos**, separados do Inventário. A separação não é de arrumação, é
de natureza: um equipamento é uma escolha que compete por espaço com outro; um
material é um acúmulo que só existe para virar outra coisa. Misturados, uma
corrida boa de mineração comeria o espaço das peças.

O save guarda só o que o jogador **tem** — material zerado é removido, não
guardado como `0`, senão o save cresceria com o catálogo.

- **Lê:** `state.armazem`, `RECURSOS`, `sim.resourceSlots`
- **Escreve:** nada diretamente (a Fabricação consome)

---

## Fabricação — `id: 'fabricacao'`

`ui/panels/FabricacaoPanel.ts` · 417 linhas · camada

Três colunas próprias — foi este painel que motivou o modelo de camada. Cobre
**fabricar** (gastar material por item) e **fundir** (§26): sacrificar peças para
subir raridade.

Ao fabricar, abre um **segundo modal por cima** mostrando o item que saiu.

**Padrão visual (24/08/2026).** A Fabricação usa o **kit compartilhado** de
Provação, Baús e Bancada de Afixos: mesma moldura externa e barra superior,
mesmas superfícies escuras, títulos de seção com linha cyan discreta e cards de
lista com borda lateral semântica. Não há moldura exclusiva nem linguagem visual
paralela. A cor de raridade existe nos itens e receitas; cyan continua reservado
para foco/ação. O reator é conteúdo do painel central, não uma nova marca visual.

As laterais organizam itens, filtros e materiais à esquerda e receitas à direita;
o centro mostra componentes, alvo e ação de síntese dentro do mesmo painel de
trabalho usado pelo craft. Assim a tela pertence ao mesmo sistema, mas preserva
a decisão específica de fundir itens.

> **A fusão anunciava probabilidade errada.** Ela usava a raridade arredondada
> para baixo em vez da exata: 3% de Divino anunciado eram 10,4% reais, 3,47×
> inflado. Corrigido com o parâmetro `exata` em `rollItem`. Hoje os seis degraus
> batem dentro de 1% do anunciado — e se a rolagem falha, o resultado é a
> **raridade dos itens sacrificados**, não perda total.

- **Lê:** `state.armazem`, `state.inventory`, `data/balance/fusao.ts`
- **Escreve:** `sim.gastarMaterial()`, `sim.acquire()`, remove os sacrificados

---

## Afixos — `id: 'afixos'`

`ui/panels/AffixCraftPanel.ts` · camada em três colunas

A **Bancada de Modulação** separa o craft de equipamento da Loja. Inventário à
esquerda, item com Prefixos/Sufixos no centro e protocolo de craft à direita.

- Seleciona uma linha específica e mostra seu tier e natureza.
- Expõe a quantidade e os nomes dos destinos compatíveis antes da decisão.
- Preserva raridade, ilvl, base, elemento, conjunto, tier e Prefixo/Sufixo.
- Nunca duplica identidade nem viola grupos de exclusão do gerador natural.
- Mostra comparação “antes/agora” depois da operação.

- **Lê:** `state.inventory`, `recalibrationCandidates()` e saldo de núcleos
- **Escreve:** `sim.recalibrateItemAffix()`

---

## Missões — `id: 'missoes'`

`ui/panels/MissoesPanel.ts` · camada · **a Central de Contratos**

O painel mais trabalhado da UI. Centrado em **personagem**, não em lista de
tarefas: **9 contatos**, cada um com retrato, galáxia, afinidade e status.

- **Escada de confiança** de 0 a 5, em algarismos romanos, dentro do card do
  contato. A confiança é do RELACIONAMENTO e vive em `state.confianca`, **fora**
  de `state.missoes`: uma missão entregue e removida do catálogo não pode apagar
  o grau que ajudou a construir.
- **Quatro tipos de missão**, com os botões de tipo **abaixo** da confiança.
- **Quatro rastreios simultâneos**. O HUD do combate mostra só nome, progresso e
  estado: sem caixa, título, botão X ou hover que desvie atenção do jogo.
- Os 9 contatos usam o atlas lazy `characters`, gerado a partir de `Characters`.
  O frame 3×4 ancora o retrato no rodapé e isola a área interna exata do atlas;
  isso impede que a miniatura capture pixels do frame seguinte.
- A confiança é uma sequência de hexágonos preenchidos. Borda, miolo e conexão
  seguem uma única cor do contato; os níveis ainda fechados são neutros.
- **Requisitos declarativos:** `Requisito` é uma união discriminada, então o
  compilador pega entrada malformada que silenciosamente nunca dispararia.
- Missão especial com moldura amarela; rede de aliados em roxo. Ambas usam a
  **borda de prata padrão tingida**, não uma borda própria.

> **Sem rolagem lateral**, e o tamanho não muda ao trocar de aba interna. Isso
> custou várias rodadas: `.mis-centro` era `display:grid` **sem
> `grid-template-columns`**, e a coluna implícita `auto` dimensionou pelo
> conteúdo (952 px dentro de 564). `min-width: 0` no pai não resolve —
> é preciso `minmax(0, 1fr)`.

> **Colisão de nome de classe.** `.mis-ficha` servia ao dossiê do personagem *e*
> à pílula de recompensa; o `inline-flex` da pílula venceu e esmagou o retrato
> para 2 px. A pílula virou `.mis-pilula`.

- **Lê:** `sim.contatos`, `sim.missoes`, `sim.missoesProntas`, `state.confianca`
- **Escreve:** `sim.resgatarMissao()`, `sim.entregarTudo()`,
  `state.settings.pinnedMissions`

---

## Provação — `id: 'provacao'`

`ui/panels/ProvacaoPanel.ts` · 319 linhas · camada · cor **cyan**

O Núcleo de Provação: **100 pisos**, um chefe único em cada. Torre de piso
único, com **tentativas limitadas por período** (5 tentativas, uma a cada 30 min,
recuperadas pelo relógio e não por tique).

- A cada 10 pisos o andar muda de cara — são os **marcos**, escritos à mão.
- O piso é **recalculado por regra** a cada abertura. O save guarda **progresso,
  não conteúdo**: salvar os cem pisos gerados seria salvar o que o código refaz
  de graça e que ficaria velho no primeiro ajuste de balanceamento.
- `primeiraConclusao` e `marcos` são **listas de piso**, não booleanos: recarregar,
  morrer ou fechar o modal não pode pagar a recompensa de primeira conclusão de
  novo (§74).

**`ui/ProvacaoResultado.ts`** (139 linhas) é a tela de vitória — o "sentimento de
vitória ao derrotar cada andar" que o pedido exige.

- **Lê:** `sim.pisosDaProvacao`, `sim.estadoDoPisoDaProvacao()`, `sim.provacaoTentativas`
- **Escreve:** `sim.iniciarPisoDaProvacao()`, `concluir…`, `falhar…`

**Falta:** arte dedicada para os 100 chefes (hoje 6 sprites em rodízio).

---

## Matriz — `id: 'matriz'`

`ui/panels/TreePanel.ts` · 591 linhas · camada · **o maior painel**

Árvore de 177 nós em 8 ramos, com pan/zoom. Pontos vêm do nível de personagem.
Aceita alocar nó a nó ou por **rota** (`allocateRoute`), e tem refazes contados
em `command.refunds`.

> Perder nível **devolve o último nó alocado**, na ordem inversa da construção —
> é o que mantém conectado o que sobra.

- **Lê:** `TREE_NODES`, `TREE_EDGES`, `command.allocated`, `sim.matrixPoints`
- **Escreve:** `allocateNode`, `allocateRoute`, `deallocateNode`, `respecMatrix`

---

## Hangar — `id: 'frota'`

`ui/panels/FleetPanel.ts` · 115 linhas · camada

Os **49 cascos**. Cada nave tem **nível e XP próprios** (`state.naves`), e
**trocar não transfere** (§17): é o que dá sentido a manter uma frota em vez de
uma nave só.

Os 29 cascos Spaceships 2.0 estão liberados diretamente em campanhas novas e
existentes. O sistema definitivo de desbloqueio será desenhado depois.

- **Lê:** `HULLS`, `state.fleet`, `state.naves`, `sim.naveAtiva`
- **Escreve:** `state.hull`

---

## Baús — `id: 'baus'`

`ui/panels/ChestsPanel.ts` · camada · composição em três colunas

Quatro cápsulas — Bronze, Prata, Ouro e Singularidade — com arte dedicada. A
seleção fica à esquerda, a abertura no centro e as probabilidades/itens
extraídos à direita, repetindo a gramática visual da Provação sem repetir neon
em toda moldura.

- Cada cápsula tem sete percentuais explícitos que somam 100%.
- Sorte vale apenas para drop de combate e não entra em `openChest`.
- A maior raridade extraída escolhe a assinatura da abertura; os sete graus têm
  animações próprias e respeitam “Reduzir efeitos”.
- Assets: `assets-static/ui/baus/chests`, preservados pelo pipeline.
- Divino na Singularidade: 0,0008% por item (1 em 125 mil).

---

Ao abrir uma cápsula, passar o mouse por um item mostra a **ficha completa** —
implícito, prefixos, sufixos com tier e a comparação com o equipado. O cartão
mora no `body`, não dentro do painel: `.bau-col` é `overflow: hidden` e o
cortaria na borda. Vira para a esquerda quando não cabe à direita.

## Loja — `id: 'loja'`

`ui/panels/ShopPanel.ts` · camada em três colunas

Virou **Central de Serviços**. Catálogo à esquerda, operação em foco no centro e
leitura da transação à direita — a mesma gramática da Provação e dos Baús.

- **Logística:** quatro módulos de carga, com concessões idempotentes reais.
- **Sistemas:** reconfiguração da Matriz e uma tentativa da Provação.
- **Câmbio controlado:** sucata → núcleos e núcleos → cristais, com perda e cota
  crescente por nível.

Sorte, XP, cura, renda e cápsulas não são vendidos aqui. A tela reserva cor para
moeda/serviço e mantém fundos escuros, seguindo a decisão de neon na borda.

---

## Códex — `id: 'codex'`

`ui/panels/CodexPanel.ts` · camada · seis arquivos internos

Arquivo completo da campanha: resumo e cobertura; chefes, inimigos comuns e
elites; 49 cascos com ficha; 80 bases de item; 70 recursos com função e fonte;
e os seis elementos com vantagem e resistência. Conteúdo ainda não encontrado
permanece visível como registro bloqueado, sem esconder que ele existe.

Usa a mesma gramática da Provação e da Bancada de Afixos: moldura externa e
fundo técnico dedicados, títulos 9-slice, abas hexagonais, slots de arte,
cantos chanfrados e neon reservado a bordas/estado ativo. A aba escolhida
persiste enquanto o combate atualiza a interface.

O conteúdo foi normalizado em seis arquivos: chefes, inimigos comuns/elites,
cascos, itens, recursos/fontes e elementos. A navegação mantém a mesma moldura
contida das telas de trabalho; cor de raridade e elemento acompanha texto e
ícone, nunca aparece como único sinal.

---

## Laboratório — `id: 'laboratorio'`

`ui/panels/LaboratorioPanel.ts` · camada · sandbox sem recompensas

Permite combinar qualquer arte de jogador, inimigo, tiro, elemento, movimento e
ficha numérica. Sete presets carregam representantes dos arquétipos contra o
mesmo protocolo, permitindo comparar DPS, precisão, abates, dano e mortes.

O editor expõe os 49 cascos, 68 inimigos e 30 chefes individualmente e usa
caixas retangulares reais com largura, altura e deslocamento X/Y. Durante o
combate os oito botões da barra inferior ajustam a caixa ao vivo. **Gravar no
código** chama um endpoint exclusivo do `vite dev`, atualiza
`data/hitbox-calibrations.json` e a campanha passa a usar exatamente a mesma
colisão em todos os saves. O painel mostra o que já foi calibrado, filtra as
pendências e confirma sucesso ou falha. Em build publicado o Laboratório não é
exposto; ele é uma ferramenta administrativa, não uma tela do jogador.

---

## Ajustes — `id: 'ajustes'`

`ui/panels/SettingsPanel.ts` · 128 linhas · camada · **engrenagem no topo, não aba**

Inclui a trava **repetir setor** (`settings.repetirSetor`), que faz a incursão
ficar na fase em vez de avançar — sem custar o acesso já conquistado.

Também o **modo de teste** (`sim.setTestMode`), que dá recursos infinitos e
libera alcance, nível e frota de forma **não destrutiva** (leitura, sem gravar
no save).

Também centraliza preferências persistidas de acessibilidade e comando: alto
contraste, redução de efeitos e escolha entre Idle e pilotagem manual por WASD
ou setas. Foco visível, atalhos de teclado, rótulos acessíveis e notificações
para leitor de tela pertencem ao Shell, mas obedecem a estas preferências.

---

## Coluna de anatomia

`ui/Anatomia.ts` · 193 linhas · a quarta trilha do layout

O "boneco" da nave: dez soquetes em duas colunas ao redor de um chassi, na ordem
ANATÔMICA — armas na proa (`principal`, `secundaria`), asas e escudo no meio,
motor e utilitários na popa. É o que faz achar o slot sem ler o rótulo.
`upgrade` fica na ponta de propósito: é o único sem lugar no corpo da nave.

**Tem seletor de nave** porque o equipamento é POR CASCO (save v7,
`naves[id].equipped`). Sem ele não haveria onde montar o conjunto de uma nave
fora de campo. O rótulo mostra a lotação: `Aurora Mk I · 1/10`.

Passar o mouse num soquete cheio abre a ficha do item; clicar desequipa.

### Sobreposta, e não uma trilha

Equipar é arrastar do inventário para o boneco. Distância entre os dois é atrito
puro, e uma camada em tela cheia (como as outras abas) esconderia justamente o
inventário. Dentro da coluna do inventário também não coube: medido, ocuparia
290 dos 668px e os itens à vista cairiam de **35 para 15**.

Foi uma **quarta trilha de grid** por uma versão, e não deu certo por dois
motivos que só aparecem medindo:

1. Trilha de grid é retângulo de altura cheia. O cartão tem ~357px de conteúdo,
   então 311px ficavam reservados sem nada dentro.
2. A largura saía do PALCO. Com 300px numa janela de 1280 o campo lógico batia
   **exatamente** no piso de 480 (`fitView` deriva a largura da proporção), e a
   coluna precisava encolher para 250 só para caber.

Hoje ela mora na **mesma célula do palco** (`grid-area: 1 / 2`), ancorada no
alto à direita — encostada no inventário, que é de onde os itens vêm.

| | Trilha (antes) | Sobreposta (hoje) |
|---|---|---|
| palco aberta / fechada | 384 / 634 | **634 / 634** |
| campo lógico em 1280 | 552 | 908 |
| espaço reservado e vazio | 250 × 311 | nenhum |
| abrir e fechar | evento de layout | não toca no layout |

Como uma das quatro filhas passou a ter posição explícita, **todas** precisam
ter: com auto-placement, a célula já ocupada empurraria `.center` para a coluna
3 e jogaria o inventário para uma segunda linha.

O que se paga agora é COBERTURA, não largura: em 1280 o cartão de 250px tapa
39% da largura do palco e 53% da altura. É por isso que ele continua encolhendo
de 300 para 250 abaixo de 1400px, e some abaixo de 1180.

### O cartão é translúcido e tem a altura do conteúdo

Tem combate acontecendo atrás, e enterrá-lo sob uma chapa opaca faria a anatomia
parecer uma tela em vez de um painel: o fundo é `rgba(7,13,20,.74)` com
`backdrop-filter: blur(7px)`. O `blur` não é enfeite — sem ele, sprite claro
passando atrás de rótulo claro apaga o texto.

A altura é a do conteúdo (~357px): 262 de soquete mais cabeçalho e seletor.
Esticar não mostrava mais nada, só espalhava os mesmos elementos, e o boneco
perdia a leitura de peça única que faz um paperdoll funcionar.

A moldura e o fundo moram no `.anat-corpo`; o `<aside>` é só a âncora e não
pinta nada. Ele tem `pointer-events: none` para não roubar clique do palco na
área que não é cartão. A alça fica no TOPO, colada na quina.

### O recuo do topo não é um número de pixels

O canto superior direito do campo já é do HUD: "SETOR n" e o rótulo da onda.
Lendo os pixels do canvas, a onda acaba em **y=30** com o palco em 668px — e a
alça ficava em y=22..86, cruzando o texto.

Um recuo fixo não serve. `VIEW.h` é fixo em 960 e o canvas ocupa a altura toda
do palco, então a escala é `altura / 960`: **o HUD desce junto com a janela**.
Medido, 40px dariam 20px de folga em 720 e apenas **4px** em 1080.

Por isso o recuo está nas mesmas unidades lógicas em que o HUD é desenhado —
`calc((100vh - 52px) * 60 / 960)`, contra as 43 onde a onda acaba. Os dois
crescem juntos, então a folga é sempre `altura × 17 / 960`: 22px em 720, 28px
em 1080.

O `100vh - 52px` é a altura do palco (a barra de cima é a única coisa acima
dele, e não há nada abaixo) — verificado nas duas alturas. Se a barra mudar de
altura, este número muda junto.

Lateralmente o cartão fica **colado na parede**, sem margem: encostado no
inventário, que é de onde os itens vêm.

**Nave em campo não tem rodapé:** o quadro já acende com `.em-campo`, e um
rótulo repetindo isso custava uma linha do cartão. Só a nave guardada ganha
rodapé — "Levar esta nave a campo" — porque aí há uma ação a oferecer.

O `overflow: hidden` também mora no cartão. No `<aside>` ele cortava a alça, que
fica fora da caixa por definição — medido, a alça caía em x=638 com a coluna
começando em 652, e quem respondia ao clique era o painel atrás dela.

Clicar a alça **repinta na hora**, sem esperar o laço: o `update` é amostrado a
0,2s e um clique é entrada direta.

---

## Trilho esquerdo

`ui/LeftRail.ts` · 263 linhas

**Equipamento e conjuntos saíram daqui** e moram só na coluna de anatomia. Com o
conjunto sendo por nave, o trilho mostraria sempre o da nave em campo enquanto a
anatomia mostra a que se está montando — duas leituras divergentes do mesmo dado
na mesma tela.

As missões rastreadas **não** moram aqui: elas vivem sobre o campo de combate
(`.mission-hud`, em `Shell`), e só lá. Havia cópia nos dois lugares, e duas
listas do mesmo conteúdo na mesma tela competem pelo olhar sem acrescentar nada.

Nave ativa, vida, escudo, elemento, **postura da IA** (`AGR` / `EQU` / `EVA` /
`COL`) e as três moedas. Clicar numa célula de item abre o Inventário.

Também reúne o acesso imediato a **Pilotar / Idle** e aos contratos rastreados,
para que o jogador não precise abrir Ajustes ou a Central de Contratos durante a
campanha.

---

## O palco

`modes/vertical/VerticalMode.ts` · a cena de combate, o maior arquivo do projeto.

- **`PilotAI.ts`** decide o movimento — o jogador não pilota.
- **`WaveDirector.ts`** decide o que entra em cena.
- **`entities.ts`** as entidades da cena.

Consome os 16 efeitos de modificador da Provação. Além dos números e especiais,
`VerticalMode` desenha e executa invulnerabilidade cíclica, zonas telegrafadas,
clones, barreira frontal e pontos fracos móveis.

---

## O que falta nas telas

| Tela | Falta |
|---|---|
| Baús | ✅ reforma concluída: percentuais próprios, sem Sorte, assets e animações |
| Loja | ✅ Central de Serviços concluída; logística, sistemas e câmbio |
| Afixos | ✅ Bancada própria com Prefixos/Sufixos, pool, custo e resultado |
| Códex | ✅ seis arquivos completos; revisar somente ao entrar conteúdo novo |
| Provação | arte dedicada dos 100 chefes (6 sprites em rodízio hoje) |
| Combate | arte de projétil elemental (revertida; "depois nós tratamos isso") |
| Geral | auditoria final de teclado e contraste AA por fluxo (base pronta: foco visível, rótulos, alto contraste e navegação de abas) |
