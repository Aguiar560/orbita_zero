# Telas

Cada tela do Órbita Zero: o que faz, onde mora, o que lê, o que escreve e o que
ainda falta. Complementa [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

**Regra de camada que vale para todas:** `ui/` **não decide regra de jogo**. Se
um painel precisa calcular, o cálculo mora em `sim/`. Painel lê `Sim` e desenha.

---

## A moldura

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  LeftRail    │   palco (canvas do combate)   │   Inventário     │
│  303 linhas  │   modes/vertical/VerticalMode │   painel FIXO    │
│              │                               │   233 linhas     │
│  nave, HP,   │   ┌───────────────────────┐   │                  │
│  escudo,     │   │  CAMADA em tela cheia │   │  nunca sai da    │
│  elemento,   │   │  (qualquer outra aba) │   │  tela, e por     │
│  postura,    │   └───────────────────────┘   │  isso não tem    │
│  recursos    │                               │  aba própria     │
└──────────────┴───────────────────────────────┴──────────────────┘
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
ordens (poder, raridade, slot, nível, melhor tier), favoritos e desmanche em
lote. A ficha de cada item vem de `ui/ItemCard.ts`.

- **Lê:** `sim.state.inventory`, `sim.state.equipped`, `sim.stats`
- **Escreve:** equipar/desequipar, favoritar, desmanchar
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

> **A fusão anunciava probabilidade errada.** Ela usava a raridade arredondada
> para baixo em vez da exata: 3% de Divino anunciado eram 10,4% reais, 3,47×
> inflado. Corrigido com o parâmetro `exata` em `rollItem`. Hoje os seis degraus
> batem dentro de 1% do anunciado — e se a rolagem falha, o resultado é a
> **raridade dos itens sacrificados**, não perda total.

- **Lê:** `state.armazem`, `state.inventory`, `data/balance/fusao.ts`
- **Escreve:** `sim.gastarMaterial()`, `sim.acquire()`, remove os sacrificados

---

## Missões — `id: 'missoes'`

`ui/panels/MissoesPanel.ts` · 533 linhas · camada · **a Central de Contratos**

O painel mais trabalhado da UI. Centrado em **personagem**, não em lista de
tarefas: **9 contatos**, cada um com retrato, galáxia, afinidade e status.

- **Escada de confiança** de 0 a 5, em algarismos romanos, dentro do card do
  contato. A confiança é do RELACIONAMENTO e vive em `state.confianca`, **fora**
  de `state.missoes`: uma missão entregue e removida do catálogo não pode apagar
  o grau que ajudou a construir.
- **Quatro tipos de missão**, com os botões de tipo **abaixo** da confiança.
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
- **Escreve:** `sim.resgatarMissao()`, `sim.entregarTudo()`

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

Os **20 cascos**. Cada nave tem **nível e XP próprios** (`state.naves`), e
**trocar não transfere** (§17): é o que dá sentido a manter uma frota em vez de
uma nave só.

- **Lê:** `HULLS`, `state.fleet`, `state.naves`, `sim.naveAtiva`
- **Escreve:** `state.hull`

---

## Baús — `id: 'baus'`

`ui/panels/ChestsPanel.ts` · 76 linhas · camada

Quatro baús, do comum ao de Singularidade.

> ⚠️ **Vão ser reformulados por inteiro.** Decisão do Rafael: os baús passam a ter
> **percentuais próprios de raridade** e **a Sorte deixa de influenciá-los** — ela
> vale só no drop de setor. Quando isso acontecer, `ChestDef.luck`, `ChestDef.floor`
> e a constante `SORTE_EFETIVA_MAX` ficam órfãos e saem juntos. **Não use os
> contratos atuais como base para nada.**

---

## Loja — `id: 'loja'`

`ui/panels/ShopPanel.ts` · 105 linhas · camada

Existe para dar destino ao recurso que sobra: sucata acumula sozinha com a
patrulha e núcleos vêm de desmanche, então sem um ralo permanente eles viram
número morto no topo da tela. **Nada aqui é exclusivo** — a loja compra tempo,
não poder que o jogo não dê de outra forma.

> ⚠️ **Será totalmente reformulada.** Mesma regra dos baús: não sirva de base.

---

## Códex — `id: 'codex'`

`ui/panels/CodexPanel.ts` · 81 linhas · camada

Registro dos chefes já derrotados (`state.codex`).

**Falta:** cobrir inimigos comuns, itens, recursos e elementos — hoje só chefes.

---

## Ajustes — `id: 'ajustes'`

`ui/panels/SettingsPanel.ts` · 128 linhas · camada · **engrenagem no topo, não aba**

Inclui a trava **repetir setor** (`settings.repetirSetor`), que faz a incursão
ficar na fase em vez de avançar — sem custar o acesso já conquistado.

Também o **modo de teste** (`sim.setTestMode`), que dá recursos infinitos e
libera alcance, nível e frota de forma **não destrutiva** (leitura, sem gravar
no save).

---

## Trilho esquerdo

`ui/LeftRail.ts` · 303 linhas

Nave ativa, vida, escudo, elemento, **postura da IA** (`AGR` / `EQU` / `EVA` /
`COL`) e as três moedas. Clicar numa célula de item abre o Inventário.

---

## O palco

`modes/vertical/VerticalMode.ts` · a cena de combate, o maior arquivo do projeto.

- **`PilotAI.ts`** decide o movimento — o jogador não pilota.
- **`WaveDirector.ts`** decide o que entra em cena.
- **`entities.ts`** as entidades da cena.

Consome os 11 efeitos de modificador da Provação: `reflexo`, `divideEm`,
`regen`, `travaEscudo` no `VerticalMode`; `vida`, `dano`, `cadencia`,
`velocidade`, `invocaCada`, `espelhaElemento`, `limiteDeTempo` no `sim/desafio.ts`.

---

## O que falta nas telas

| Tela | Falta |
|---|---|
| Baús | reforma completa: percentuais próprios, sem Sorte |
| Loja | reforma completa |
| Códex | inimigos comuns, itens, recursos, elementos |
| Provação | arte dedicada dos 100 chefes (6 sprites em rodízio hoje) |
| Combate | arte de projétil elemental (revertida; "depois nós tratamos isso") |
| Geral | nenhuma tela tem passe de acessibilidade (foco por teclado, leitor de tela) |
