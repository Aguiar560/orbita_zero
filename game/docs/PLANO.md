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
Provação, 24.500 linhas de TypeScript e 452 testes.

**O que falta:** conteúdo em volume, dois sistemas para reformar, seis
modificadores, e o trabalho que separa "funciona" de "é um jogo" — som,
onboarding, acessibilidade, migração de save.

---

## Estado por área

| área | estado | onde |
|---|---|---|
| Combate elemental | ✅ estável | `modes/vertical`, `sim/dano.ts` |
| Itemização | ✅ estável | `sim/loot.ts`, `data/balance/raridades.ts` |
| Curvas e ritmo | ✅ estável, medido | `data/balance/curvas.ts` |
| XP e nível | ✅ estável | `curvas.ts`, `sim/index.ts` |
| Morte | ✅ estável | `sim/morte.ts` |
| Missões | ✅ estável | `sim/missoes.ts` |
| Provação | 🟡 funciona; faltam 6 modificadores e arte | `data/provacao*.ts` |
| Matriz | ✅ estável | `sim/tree.ts`, `data/tree.ts` |
| **Baús** | 🔴 **a reformar por inteiro** | `data/chests.ts` |
| **Loja** | 🔴 **a reformar por inteiro** | `data/shop.ts` |
| Códex | 🟡 só chefes | `ui/panels/CodexPanel.ts` |
| Conteúdo por galáxia | 🔴 volume insuficiente | `data/enemies.ts`, `hulls.ts`, `bosses.ts` |
| **Som** | 🔴 **não existe** | — |
| **Onboarding** | 🔴 **não existe** | — |
| **Acessibilidade** | 🔴 **não existe** | — |
| Migração de save | 🟡 desligada de propósito no dev | `sim/state.ts` (`SAVE_VERSION = 3`) |

---

## Os passos, em ordem

A ordem não é arbitrária. Cada bloco depende do anterior estar **medido e
estável**, senão fica impossível saber qual mudança moveu a curva.

---

### Passo 1 — Reformar os baús 🔴

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

---

### Passo 2 — Reformar a Loja 🔴

Hoje ela existe como ralo de recurso: sucata acumula sozinha com a patrulha,
núcleos vêm de desmanche, e sem um destino permanente eles viram número morto.

**A restrição que não muda:** *"nada aqui é exclusivo — a loja compra tempo, não
poder que o jogo não dê de outra forma"*. Uma loja que venda poder viraria a
**quarta fonte de progressão**, e o invariante diz que existem três: item, craft
e Matriz.

**Precisa de decisão do Rafael antes de codar:** o que a loja vende. Sugestões a
apresentar, não a implementar por conta:
- conveniência (espaço de carga, refazes da Matriz, tentativas de Provação)
- conversão entre moedas, com perda
- reroll de afixo dentro do mesmo item (poder que o craft já dá, comprando tempo)

**Critério de aceite**
- Nenhum item da loja concede atributo que o jogo não conceda por item, craft ou
  Matriz.
- Um teste que **falhe** se algum contrato de loja adicionar poder direto.

---

### Passo 3 — Os 6 modificadores mecânicos da Provação 🟡

Os 11 modificadores atuais são **numéricos** (vida, dano, cadência, regeneração,
reflexo, divisão…) e todos já são consumidos pelo combate. Os que faltam, do §14,
são **mecânicos** e mexem na cena:

| modificador | o quê |
|---|---|
| invulnerabilidade | janelas em que o chefe não recebe dano |
| zonas de perigo | áreas da arena que ferem |
| clones | cópias que precisam ser distinguidas |
| barreira frontal | só é ferido por trás ou pelos lados |
| pontos fracos | alvos menores que multiplicam dano |

**Por que depois dos baús e da loja:** estes tocam `VerticalMode`, o maior
arquivo do projeto, e a `PilotAI` — que **precisa aprender a lidar com eles**. Um
modificador que a IA não sabe enfrentar é uma parede, não um desafio.

**Critério de aceite**
- Cada modificador tem telegrafia visível, como os 18 especiais já têm (`aviso`).
- A `PilotAI` reage a cada um: um teste que a coloque contra o modificador e
  verifique que o tempo de limpeza fica dentro da faixa do piso.
- **Nenhum vira DPS check** (§87): nenhum piso pode ser matematicamente
  invencível. Já aconteceu — o piso 20 exigia 15.449.999 segundos porque a
  regeneração superava o DPS.

---

### Passo 4 — Conteúdo em volume 🔴

É onde o `content-data-agent` trabalha, **a partir de schema aprovado**.

| o quê | hoje | alvo |
|---|---|---|
| inimigos | 42 | o bastante para 30 galáxias não se repetirem |
| chefes de galáxia | 10 | 30, um por galáxia |
| cascos | 20 | revisar se 20 bastam para 300 setores |
| arte dos chefes da Provação | 6 sprites em rodízio | 100 |
| Códex | só chefes | inimigos, itens, recursos, elementos |

**Critério de aceite**
- Ids estáveis e não-visuais em tudo (`weapon_plasma_mk3`, nunca o nome bonito).
- Nenhum sprite inventado: **conferir no manifesto**. Isso já passou por
  typecheck e por 324 testes duas vezes e a tela renderizou vazia.
- A galáxia N e a N+1 não compartilham a maioria dos inimigos.

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

### Passo 7 — Acessibilidade 🔴

Nenhuma tela tem passe de acessibilidade: sem navegação por teclado, sem foco
visível consistente, sem rótulo para leitor de tela, sem verificação de contraste.

**Critério de aceite**
- Toda ação alcançável por teclado.
- Contraste AA nos textos de interface.
- As cores de raridade nunca são a **única** portadora de informação — hoje o
  nome da raridade já aparece escrito, o que é meio caminho.

---

### Passo 8 — Migração de save, antes do lançamento 🟡

**Hoje, de propósito, a compatibilidade entre versões não é restrição:** o esquema
muda muito e o save é zerado junto. `SAVE_VERSION = 3` e a carga rejeita save de
versão maior.

Isso **volta a valer antes do lançamento** — e aí o `save-migration-reviewer`,
hoje dormente, entra em cena.

**Critério de aceite**
- Toda mudança de campo persistido passa por revisão de migração.
- Um save de cada versão anterior carrega sem erro e sem perder progresso.
- Save malformado, truncado ou de versão futura **nunca** trava o boot.

---

## Decisões pendentes do Rafael

Estas **bloqueiam** trabalho e não devem ser decididas por conta própria.

| # | Decisão | Contexto |
|---|---|---|
| 1 | **Anel elemental com deriva de 5%** | `1,5 × 0,7 = 1,05`, deveria fechar em 1,0. A especificação propõe `1,25 × 0,80`. Mexer nisso move todo o combate elemental |
| 2 | **O laço ocioso trava na parede do chefe** | Ao vivo: setor 5 dos 90 aos 120 min, mortes de 20 para 31. É o cruzamento de "chefe exige farm" com "sem recuo automático". Três saídas possíveis: recuo automático, chefe opcional, ou farm dirigido |
| 3 | **O que a Loja vende** | Passo 2 |
| 4 | **Offline rende mais item que jogar** | Setor 10 contra 8, e **368 itens contra 44**. O caminho abstrato já modela morte e já não banca recurso; o que resta é o item. Precisa de uma corrida AO VIVO nova para comparar — os 44 são de antes das Fases 2 e 3 |

---

## Dívidas técnicas conhecidas

Medidas e registradas. Não bloqueiam, mas não somem sozinhas.

| dívida | evidência | onde resolve |
|---|---|---|
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
