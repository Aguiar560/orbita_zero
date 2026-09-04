# Telas

Cada tela do Órbita Zero: o que faz, onde mora, o que lê, o que escreve e o que
ainda falta. Complementa [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

**Regra de camada que vale para todas:** `ui/` **não decide regra de jogo**. Se
um painel precisa calcular, o cálculo mora em `sim/`. Painel lê `Sim` e desenha.

---

## Comunicações — chat global e particular

`src/ui/ChatPanel.ts` + `src/styles/chat.css`, com rede em `src/app/ChatClient.ts`.
Botão CHAT abre painel recolhível sobre o desktop ou tela própria no celular.
Não participa dos re-renders de 5 Hz do Shell e não usa estado econômico/Sim.

Global, privadas por solicitação/aceite, busca de apelido de quem já acessou o
chat, não lidas, histórico anterior, ajustes de novas solicitações, bloqueio e
denúncia pelo nome do autor. Moderação aparece apenas se autorizada pelo Worker;
o servidor também verifica cada ação. Mensagens são sempre `textContent`.

Contas anônimas só leem global; conta vinculada com apelido pode escrever. Sem
paywall VIP. Campo de texto não aciona WASD/espaço; o combate não pausa.

Status: publicado no domínio canônico; Worker/D1/cron ativos e validação real de
conta anônima concluída. Ativação/limites/retenção/testes e rollback em
[CHAT-OPERACAO.md](CHAT-OPERACAO.md).

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

## O tutorial de cada tela

`src/data/tutoriais.ts` guarda um guia por tela; o motor é o mesmo do passeio
de entrada (`src/ui/Tour.ts`): furo de `clip-path` no escuro, `transform:
scale` no alvo, balão ao lado. Catorze telas têm o seu — todas menos **Ajustes**
(a própria tela já é texto explicativo, e é de onde os guias se reabrem) e
**Laboratório** (ferramenta interna, só para conta administrativa).

| aspecto | regra |
|---|---|
| quando abre | na primeira vez que a tela é **aberta** |
| onde se reabre | botão `?` no `.camada-topo`, ao lado do `✕` |
| o que lembra | `settings.guiasVistos`, lista de ids de tela |
| tamanho | 3 a 5 passos; o primeiro nunca tem alvo |

**Abrir, e não liberar.** A liberação de uma tela acontece no meio de uma
luta, e puxar o jogador para dentro de um painel que ele não pediu é pior do
que esperar ele chegar lá — o aviso "tela liberada" já é o convite. A mesma
regra cobre a tela que já nasce disponível: ela também é aberta pela primeira
vez em algum momento. Uma regra, os dois casos.

**O gatilho é na TROCA de tela, nunca no redesenho.** `renderPanel` roda no
laço do jogo a cada quadro em que o estado mudou, e `abrirCamada` vem junto:
disparar ali sem condição abria um `Tour` novo a cada redesenho, empilhando
balões que deixavam a tela presa no escuro. Há duas guardas — o `Shell` compara
com o `dataset.tela` anterior, e o `Game` recusa abrir com outro passeio em
cena (esta também cobre o `?` clicado duas vezes).

`tests/tutoriais.test.ts` quebra o build se uma tela nova ficar sem guia, ou
se um guia apontar para um id que não existe — foi assim que se descobriu que
o painel chamado "Hangar" tem id `frota`.

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

## Escolha de personagem — a primeira tela

`ui/EscolhaDePiloto.ts` · `data/pilotos.ts` · aparece **uma vez** por save

Quatro personagens em cartões lado a lado. Cada um tem nome, **raça**, galáxia
de origem, uma descrição curta — e uma **nave de partida**, que é a única coisa
que pesa em número nenhum.

| | raça | casco | elemento | forma |
|---|---|---|---|---|
| VEKTOR-9 | Sintético | Núcleo Vektor | Raio | equilibrado |
| DARIN KOSS | Humano | Lança Rubra | Fogo | agressivo |
| SORA VEY | Humana | Baluarte Glacial | Gelo | resistente |
| NHARU | Ser cósmico | Sopro Astral | Cósmico | ágil |

### A escolha não pode ser uma armadilha, e isso é medido

Os quatro cascos têm a MESMA nota de `powerScore` — **1,58% de dispersão** —
com formas bem diferentes: dps de 18,8 a 25,2 e vida efetiva de 193 a 251.
`tests/pilotos.test.ts` exige dispersão abaixo de 3% E diferença acima de 20%
nos dois eixos: um teste segura o equilíbrio, o outro impede que "equilibrar"
vire "achatar".

A escolha **converge**: todo casco comprável continua aberto a todos, e o
piloto não dá atributo nenhum. Por volta do primeiro casco de loja ela deixou de
ser restrição e virou preferência. A tela diz isso em texto, de propósito — sem
essa linha o jogador cauteloso escolhe o equilibrado "para não errar", que é
exatamente a decisão sem graça que a tela existe para evitar.

Por que não dá bônus: o `CLAUDE.md` proíbe fonte de poder fora de item, craft e
Matriz. Um bônus de piloto seria a quarta.

### O casco do personagem é 1,10× o genérico, e o número veio de medição

Se empatasse com o Aurora Mk I, o jogador trocaria no primeiro minuto e a
escolha morreria ali. Mas o teto não é gosto: com **1,15×** o setor 1 dava
**90,8 golpes** de sobrevivência contra o teto de 90 do §2, e a régua reprovava
a introdução por mansa demais. Em 1,10× dá 87,7.

### As três barras existem por um defeito que a medição pegou

Com só DANO e RESISTÊNCIA, o Sopro Astral aparecia **dominado** — mesma vida
efetiva da Lança Rubra e menos dano — porque a vantagem dele é velocidade, que
`powerScore` conta como esquiva e `effectiveHp` não mostra. A tela dizia que uma
das quatro escolhas era pior, e não era.

Com VELOCIDADE à vista, ninguém é dominado e cada um é o melhor em algo:

```
VEKTOR-9    DANO=60%  RESISTÊNCIA=49%  VELOCIDADE=18%
DARIN KOSS  DANO=100% RESISTÊNCIA=18%  VELOCIDADE=18%
SORA VEY    DANO=18%  RESISTÊNCIA=100% VELOCIDADE=18%
NHARU       DANO=68%  RESISTÊNCIA=18%  VELOCIDADE=100%
```

As barras saem de `powerScore`/`dps`/`effectiveHp` sobre um estado real, e são
normalizadas ENTRE os quatro — contra uma escala absoluta ficariam quase iguais
e a tela não diria nada. Números escritos à mão aqui virariam mentira no
primeiro ajuste de balanceamento, e ninguém repara numa tela que só aparece uma
vez.

### O atlas dos retratos é `lazy`, e esta tela espera por ele

`characters` fica fora do boot no manifesto — só a Central de Missões costumava
precisar dele. Esta tela roda ANTES de qualquer painel abrir, então os quatro
retratos saíam como molduras vazias: o jogador escolhia entre quatro retângulos.

`mostrar()` faz `await assets.loadAtlas('characters')` antes de montar. Esperar,
e não re-renderizar ao carregar como o painel de missões faz, porque aqui não há
nada útil para mostrar enquanto isso — a piscada de moldura vazia seria pior que
o meio segundo. Falha no carregamento não trava o boot: sem retrato a tela ainda
diz nome, raça, nave e barras.

### Save: `piloto`, versão 8

Ausente e vazio são **casos diferentes**, e confundi-los escolhia pelo jogador:

- **campo ausente** — save de antes da tela existir. Recebe o padrão; quem já
  jogou não pode ser parado agora para escolher.
- **campo vazio** — save novo com a escolha não concluída. Fechar a aba com a
  tela aberta grava isso, porque `pagehide` salva. A tela volta.

Enquanto não há escolha, **nenhum** casco de personagem entra na frota — nem o
do padrão, senão o jogador terminaria a escolha com a nave de outro no hangar.

Os quatro cascos não são compráveis (`Hull.piloto`) e os dos outros três nem
aparecem no Hangar: seriam uma fileira permanente de bloqueado sem chave.

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

### A grade mostra o SETOR, não a posição na galáxia

Mostrava 1..10 em toda galáxia. A galáxia 2 tinha uma "fase 1" que era o setor
11 — e o jogador via **1** na grade, **11** na HUD do combate e **11** no placar.
Três números para a mesma coisa, e nenhum errado sozinho.

Agora:

| galáxia | grade |
|---|---|
| 1 | 1 … 10 |
| 2 | 11 … 20 |
| 3 | 21 … 30 |
| 5 | 41 … 50 |

O chefe também mostra o número. Ele já se distingue por três outras marcas —
arte maior, borda na cor da galáxia e o nome embaixo —, e trocar o número por
"CHEFE" custava a única informação que a célula não repete em outro lugar.

### Escolher a fase fecha o mapa

O mapa é camada em tela cheia. Clicar numa fase já saltava para ela, mas a
camada continuava aberta **por cima do combate que o próprio clique acabou de
começar** — e o jogador tinha de fechá-la para ver o que pediu.


---

## Armazém — `id: 'armazem'`

`ui/panels/ArmazemPanel.ts` · 99 linhas · camada

Os **70 recursos**, separados do Inventário. A separação não é de arrumação, é
de natureza: um equipamento é uma escolha que compete por espaço com outro; um
material é um acúmulo que só existe para virar outra coisa. Misturados, uma
corrida boa de mineração comeria o espaço das peças.

O save guarda só o que o jogador **tem** — material zerado é removido, não
guardado como `0`, senão o save cresceria com o catálogo.

O Armazém **não tem teto**: nem em tipos nem em quantidade. Já teve — 15 tipos
de um catálogo de 70, crescendo por concessão —, e o tipo que não coubesse era
perdido em silêncio, porque quase nenhum dos sete pontos que guardam material
olhava o retorno zero. A decisão que o teto pretendia criar também não existia:
não há como desistir de um tipo para abrir espaço a outro sem jogar fora o que
já se tem. **Quem limita é o Inventário**, e ele guarda item, não recurso.

O contador da barra mudou junto: era `guardados / capacidade`, em vermelho ao
encostar no teto; virou `N de 70 tipos descobertos`, que é progresso de coleção.

- **Lê:** `state.armazem`, `RECURSOS`
- **Escreve:** nada diretamente (a Fabricação consome)

---

## Fabricação — `id: 'fabricacao'`

`ui/panels/FabricacaoPanel.ts` · camada

Três colunas próprias — foi este painel que motivou o modelo de camada. Cobre
**fabricar** (gastar material por item) e **fundir** (§26): sacrificar peças para
subir raridade.

Ao fabricar, abre um **segundo modal por cima** mostrando o item que saiu.

**Padrão visual (02/09/2026).** A Fabricação mantém somente a moldura externa e
a hierarquia das demais telas; as três colunas usam divisões técnicas discretas,
sem carcaças internas. O centro possui um reator ilustrado próprio, com alfa real. A arte é
só a máquina: os dez encaixes, os itens e a chance continuam em DOM para
preservar nitidez, acessibilidade e interação. A cor de raridade existe nos
itens e receitas; cyan continua reservado para foco/ação.

As laterais organizam itens, filtros e materiais à esquerda e receitas à direita;
o centro mostra componentes, alvo e ação de síntese dentro do mesmo painel de
trabalho usado pelo craft. Assim a tela pertence ao mesmo sistema, mas preserva
a decisão específica de fundir itens. Os oito filtros de raridade ocupam uma
grade 4×2, com nomes completos e área de clique consistente.

Item elegível pode ser **clicado ou arrastado** para qualquer encaixe. Soltar
sobre um encaixe ocupado substitui a peça e devolve a anterior ao inventário;
o uid é removido da posição antiga antes de entrar, então o gesto nunca duplica
equipamento. Favoritos e raridades incompatíveis não iniciam o arraste. Os
anéis de chance são SVG transparente — a receita selecionada é marcada pela
borda lateral, sem um retângulo atrás da porcentagem.

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
  estado: sem caixa, título, botão X ou hover que desvie atenção do jogo. IDs de
  missões já entregues são descartados antes de contar as vagas, inclusive em
  saves antigos; o cabeçalho explicita `RASTREADAS n/4`.
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
- Retratos de chefe usam brilho, saturação e contraste próprios tanto na torre
  quanto no detalhe; não herdam mais o tratamento apagado de estado inativo.
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

`ui/panels/FleetPanel.ts` · **lista + ficha**

Era uma grade de cartões de 376×381, um por casco. Medido com 49 deles:
**4.413px de rolagem contra 648 de tela — 6,8 telas.** Com os 50+ que o catálogo
vai ter, comparar duas naves significaria rolar, memorizar e rolar de volta.

| | grade de cartões | lista + ficha |
|---|---|---|
| naves por tela | ~1,7 | **12** |
| rolagem (catálogo) | 6,8 telas | **4,2** |
| rolagem (só as minhas) | 6,8 telas | **1,0** |
| rolagem (um tier) | 6,8 telas | **1,0** |

A lista compacta cabe muitas naves por tela e a ficha fica parada ao lado, no
mesmo lugar sempre: trocar de nave troca só o painel direito. É a mesma
gramática que a Central de Serviços já usa, e a familiaridade vale mais aqui do
que qualquer invenção.

### Filtros, que é o que faz a lista caber

Chips por **tier** e um alternador **catálogo / só as minhas**. Sozinha, a lista
ainda daria 4,2 telas para 49 naves; com filtro cai para 1,0 nos dois casos que
o jogador realmente usa — escolher entre as suas, ou olhar um tier específico.

O alternador mostra a CONTAGEM (`Catálogo · 49` / `Só as minhas · 2`), porque a
diferença entre os dois modos é justamente quantas naves existem em cada.

### Duas armadilhas encontradas por medição

**O corte responsivo estava em 1100px e produzia o oposto do pretendido.** Numa
janela de 966 o painel tem 775px — a ficha lado a lado ficaria com 481, que
cabe — mas a media query empilhava mesmo assim e deixava a lista com 190px de
altura: **três naves por tela e 13,4 telas de rolagem**, pior que a grade que o
painel veio substituir. O corte foi para 900, e quando empilha a lista fica com
300px, não 190.

**A ficha revelava o nome de casco selado.** A lista mostra
"Registro do setor 198" para o que ainda não foi alcançado, mas a ficha ao lado
dizia "Seta Quântica" — bastava clicar para furar o sigilo. Agora ela diz
"Registro selado", esconde o sprite em silhueta e troca a ficha técnica pelo
setor que a abre.

### Linha, ficha e o que cada uma carrega

A **linha** tem o mínimo para escolher: sprite, nome, tier, elemento e ESTADO.
O estado é o que a grade não dava de relance — com 49 cartões era preciso ler
cada um para saber qual estava em uso, qual tinha combustível e qual dava para
comprar. Naves que o jogador tem mostram barra de tanque; as à venda mostram o
preço, porque numa nave à venda a barra não diz nada (ela sai da loja cheia).

A **ficha** tem tudo o mais: arte grande, arquétipo, nota, barras de eixo,
combustível com autonomia e custo de reabastecer, e a ação — Ativar, comprar,
ou o setor que falta.

Casco bloqueado continua **legível**, só apagado. O catálogo existe para o
jogador saber o que perseguir, e o que ele não consegue ler não persegue.

### Registro: história e curiosidade de cada casco

Os 53 cascos têm ficha própria em `data/hulls-lore.ts` — dois períodos de
história e uma curiosidade. Elas aparecem no FIM da ficha, depois da ação.

A ordem importa e foi corrigida por medição: com a lore no meio, o botão de
Ativar ficava abaixo de seis linhas de prosa. Quem abre o Hangar para trocar de
nave não deve passar por dois parágrafos até achar o botão — a lore é o que se
lê depois de decidir, não o que decide.

História e curiosidade têm **pesos visuais diferentes**: a primeira é parágrafo
corrido, a segunda é uma linha destacada com filete. Com o mesmo tratamento a
curiosidade pareceria continuação do parágrafo, e ela existe justamente por ser
o fato que SOBRA — o que o jogador repetiria para alguém.

Casco selado não mostra lore: a história de uma nave que o jogador ainda não
pode ver é exatamente o que o selo do registro guarda.

**A regra é testada.** `tests/hulls-lore.test.ts` exige lore para todo casco
jogável, recusa texto vazio, recusa lore órfã de casco apagado, recusa
curiosidade que só repete a história e recusa texto duplicado entre cascos.
"Sempre que criar uma nave, criar a história junto" é convenção, e convenção
que depende de memória se perde na terceira nave.

### Combustível

`Ativar` fica desabilitado abaixo do piso de 5% — deixar ativar e a nave cair no
primeiro segundo devolveria o jogador à mesma tela. `Reabastecer` só aparece com
tanque incompleto: um botão que não faz nada é convite a clicar e não entender.

Detalhes do sistema em [`SISTEMAS.md`](SISTEMAS.md).

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

`ui/panels/ShopPanel.ts` · quatro áreas em uma camada

Virou **Órbita Market**. A navegação separa Serviços, Baús, Cristais e VIP para
que moedas do jogo, compra futura em dinheiro real e assinatura não pareçam a
mesma transação.

- **Logística:** quatro módulos de carga, com concessões idempotentes reais.
- **Sistemas:** reconfiguração da Matriz e uma tentativa da Provação.
- **Câmbio controlado:** apenas sucata → núcleos, com perda e cota crescente.
- **Baús:** escolha e compra de Prata, Ouro ou Singularidade; a abertura e as
  probabilidades continuam na Câmara de Aquisição.
- **Cristais:** cinco pacotes com preço em reais, visíveis e desabilitados até o
  checkout existir.
- **VIP:** passe de 30 dias por 500 cristais, estado e cinco benefícios legíveis.

Sorte, XP, cura e renda não são vendidos aqui. A tela reserva cor para moeda,
serviço e VIP, mantendo fundos escuros e neon nas bordas.

---

## Ranking — `id: 'ranking'`

`ui/panels/RankingPanel.ts` · `sim/ranking.ts` · `data/temporadas.ts`

Placares **sazonais** e **mundiais**. Cinco seções, uma por eixo de progresso:

| seção | mede | detalhe |
|---|---|---|
| **Provação** | maior andar VENCIDO | chegar sem vencer não conta |
| **Galáxia** | setor mais distante alcançado | recuar para farmar não custa posição |
| **Personagem** | nível de comando | empate desfeito pelo XP dentro do nível |
| **Naves** | nível de cada casco | **filtro por nave**, só as da frota |
| **Missões** | contratos entregues | aceita ou em andamento não conta |

A regra de cada placar mora em `sim/ranking.ts`, não na tela: "melhor setor" é
`bestSectorEver` e não `run.sector`, e uma tela que decidisse isso sozinha
divergiria do que o servidor for pontuar.

### A temporada e o relógio de Brasília

Temporadas de **28 dias**, ancoradas em 01/09/2026 00:00 de Brasília. Vinte e
oito e não um mês de calendário: mês tem 28, 30 ou 31 dias, e uma temporada de
fevereiro valeria 10% menos que uma de março. Num placar de progressão, tempo
É pontuação.

O fuso é fixo em **UTC−3**, sem consultar o relógio da máquina. Uma temporada
que virasse no fuso de cada um teria fim diferente para cada jogador, e o
último dia — que é quando o placar decide — valeria mais para uns. O Brasil não
usa horário de verão desde 2019; se voltar, `data/temporadas.ts` é o único
lugar a mexer.

Um defeito pego na verificação: a conta regressiva da pré-temporada apontava
para o FIM da temporada 1 em vez do começo — medido a 7 dias da âncora, a tela
dizia "começa em 34d". `temporadaEm` devolve a temporada 1 também antes da
âncora, então contar sempre até `fim` estava errado por construção.

### A lista tem pilotos FICTÍCIOS, e a tela diz isso

**Placar mundial precisa de back-end, e ele não existe**: o jogo não tem conta,
não tem save em nuvem e não tem para onde enviar marca nenhuma.

Uma lista vazia, porém, não deixa julgar espaçamento, truncamento de nome,
alinhamento de número nem o destaque da própria linha — coisas que só aparecem
com a lista cheia. Então `sim/ranking-demo.ts` gera doze linhas de exemplo.

O risco de dado falso num placar é o jogador se comparar com gente que não
existe e decidir o que jogar com base nisso. Três travas contra isso:

1. **`DEMO_ATIVA` desliga tudo numa linha.** É o interruptor a virar quando o
   servidor entrar — e antes de qualquer build pública. Há teste cobrando que a
   chave continue existindo.
2. **Um selo âmbar colado na lista** diz que os pilotos não existem. Colado, e
   não no rodapé do painel: longe das linhas viraria letra miúda que ninguém
   liga ao que está vendo.
3. **Os nomes são indicativos de voo inventados** (`Corvo Sigma`, `Vega Ômega`),
   sem parecer conta de pessoa real.

É **determinístico**, semeado por placar + casco + número da temporada. O painel
reconstrói a ~5 Hz; com números novos a cada quadro a lista tremeria e não
daria para avaliar nada. A lista muda quando a temporada vira, que é o que o
placar de verdade vai fazer.

A posição do jogador sai da distância entre a marca dele e o teto do placar.
É conta de fachada, mas **monótona**: marca maior sempre dá posição melhor —
há teste para isso, porque a demonstração pode ser falsa nos números e não
pode ser falsa na direção.

| placar | teto de exemplo | sua posição hoje |
|---|---|---|
| Provação | 100 | #2317 (sem andar vencido) |
| Galáxia | 300 | #2165 (setor 2) |
| Personagem | 300 | #1761 (nível 18) |
| Naves | 60 | **#745** (nível 36) |
| Missões | 140 | #2217 (nenhuma entregue) |

Dois defeitos pegos na verificação: **"Lupus Sigma" saía em 1º e em 10º** na
primeira lista gerada — num placar, nome repetido não lê como coincidência, lê
como a mesma conta contada duas vezes. E a linha do jogador nascia **abaixo da
dobra**, dentro do container de rolagem: era preciso rolar para se encontrar,
justamente na linha que ele abriu a tela para ver. Ela saiu da rolagem e ganhou
bloco próprio, como em todo placar de verdade.

**Falta o ícone da aba.** Usa `geral/b_4` do atlas por enquanto; as outras
treze abas têm arte própria em `assets-static/ui/menu/`.

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

`ui/panels/SettingsPanel.ts` · **cinco abas**

Era uma página só com seis seções empilhadas. O custo aparecia na hora de
PROCURAR: quem queria desligar o tremor de tela passava por automação, descarte
e modo de teste no caminho.

A ordem é por FREQUÊNCIA de uso, não por importância. Teste fica por último
também por ser destrutivo de percepção — ele muda o jogo inteiro, e não deve ser
a primeira coisa que alguém encontra.

| Aba | O quê |
|---|---|
| **Jogabilidade** | piloto idle/manual · bolha de escudo · repetir fase · auto-equipar · descarte automático e destino · teto offline |
| **Vídeo** | reduzir efeitos · tremor de tela · números de dano · alto contraste · nota sobre enquadramento |
| **Áudio** | volume geral, música e efeitos · silenciar — **todos inertes**, ver abaixo |
| **Dados** | resumo da partida · exportar/importar · apagar progresso |
| **Teste** | modo de teste · velocidade · saltar setor · conceder itens/baús/XP |

A aba visível mora na INSTÂNCIA do painel, não no save: é onde o jogador estava,
não uma preferência. Reabrir Ajustes numa aba que ele viu há dois dias seria
lembrar da coisa errada.

### Dois ajustes novos, e por que estão separados

**Bolha de escudo** (`mostrarEscudo`) — fica em Jogabilidade e não em Vídeo. Ela
comunica a carga pela opacidade, mas COBRE o casco, e quem pilota no manual
perde a nave de vista exatamente quando o escudo está cheio, que é quando se
avança. O Laboratório já tinha este interruptor (`showPlayerShieldVisual`) e
continua mandando lá dentro: ele existe para comparar fichas sem a bolha
atrapalhar, e não deve depender do gosto do jogador na campanha.

Medido no canvas, numa janela de 68px ao redor da nave com o escudo cheio:

| | pixels azuis | brilho médio |
|---|---|---|
| ligado | 365 | 46,0 |
| desligado | 74 | 20,9 |

**Tremor de tela** (`tremorDeTela`) — separado de "reduzir efeitos" porque
atinge gente diferente: efeito pesa na MÁQUINA, tremor pesa em quem sente enjoo
de movimento. Juntos, alguém teria de desligar partícula para parar de passar
mal.

Verificado forçando `shake = 20` e comparando a assinatura por coluna de uma
faixa do canvas contra um quadro sem tremor: **5.346 com o tremor desligado**
contra **122.803 com ele ligado** — 23× maior. O resíduo dos 5.346 é o jogo se
mexendo entre quadros, não a tela.

### A aba de Áudio diz que não funciona

**O jogo não tem som.** Não existe `Audio`, `AudioContext` nem arquivo de áudio
no projeto — foi confirmado por busca, não suposto.

Havia duas saídas ruins: esconder a aba, e o jogador procurar volume onde não
há; ou mostrar controles mudos, e ele mexer achando que ajustou. A terceira é
dizer. Os `<input type=range>` ficam `disabled`, um aviso âmbar (não vermelho —
não é erro, é ausência declarada) explica, e os valores são persistidos para o
dia em que o som existir. Aí a aba perde o aviso e nada mais muda.

### Duas configurações mortas encontradas na auditoria

- `barVisible` — declarada, inicializada, migrada, **nunca lida**. Sobra da
  faixa horizontal removida. Apagada.
- `muted` — declarada e migrada, nunca lida. Mantida, mas agora dentro do grupo
  de áudio, onde ao menos tem para onde crescer.

### Save: versão 9

`mostrarEscudo` e `tremorDeTela` nascem **ligados**, e save antigo os ganha
ligados. É o caso que `tests/ajustes.test.ts` protege: ajuste é a única parte do
jogo em que estar errado não dá erro — um campo que volta ao padrão só desfaz,
sem avisar, o que o jogador pediu.

Volumes são presos em 0..1 na carga. Não é preciosismo: quando o áudio existir,
um multiplicador negativo ou acima de 1 vira estouro de amplitude, e descobrir
isso com alto-falante é caro.


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

Entre ondas, a pausa de conquista usa uma moldura holográfica desenhada no
próprio canvas: vidro translúcido, cantos recortados, selo de protocolo, trilho
conectado das ondas e núcleo losangular para o chefe. A cor acompanha o tipo do
encontro (onda, elite ou chefe), e a contagem regressiva combina número, barra
luminosa e cursor — continua legível mesmo quando um dos sinais passa despercebido.
O fundo permanece visível sob uma vinheta, porque a transição é parte do combate,
não um modal que tira o jogador da cena.

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
