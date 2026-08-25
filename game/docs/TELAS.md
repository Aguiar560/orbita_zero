# Telas

Cada tela do Órbita Zero: o que faz, onde mora, o que lê, o que escreve e o que
ainda falta. Complementa [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

**Regra de camada que vale para todas:** `ui/` **não decide regra de jogo**. Se
um painel precisa calcular, o cálculo mora em `sim/`. Painel lê `Sim` e desenha.

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

## Trilho esquerdo

`ui/LeftRail.ts` · 303 linhas

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
