# Mapa do projeto — leia isto primeiro

Ponto de entrada para quem chega no Órbita Zero, humano ou IA. Diz **o que o
jogo é**, **onde cada coisa mora**, **o que não se negocia** e **como verificar**
qualquer afirmação sem confiar em documento nenhum — inclusive neste.

| Documento | Para quê |
|---|---|
| **este** | orientação geral, arquitetura, invariantes, como medir |
| [`ATUALIZACAO-2026-08-24.md`](ATUALIZACAO-2026-08-24.md) | registro detalhado e verificável da sessão de 24/08/2026 |
| [`TELAS.md`](TELAS.md) | cada tela: o que faz, arquivo, o que lê e escreve, o que falta |
| [`SISTEMAS.md`](SISTEMAS.md) | cada sistema por dentro: fórmulas, fluxo de dados, arquivos |
| [`PLANO.md`](PLANO.md) | onde chegar, por que, e os passos ordenados |
| [`ROADMAP.md`](ROADMAP.md) | histórico do que foi feito, com as medições de cada etapa |
| [`CATALOGO-CASCOS.md`](CATALOGO-CASCOS.md) | ficha dos cascos, arquétipos, tiros e contrato para futuras naves |
| [`RELATORIO-CONFRONTOS-CASCOS.md`](RELATORIO-CONFRONTOS-CASCOS.md) | protocolo, resultados e próximos testes dos arquétipos |
| [`RELATORIO-BATERIA-CONFRONTOS.md`](RELATORIO-BATERIA-CONFRONTOS.md) | bateria final Elite, Enxame e Cerco, três sementes e decisões de balanceamento |
| [`RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md`](RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md) | 261 confrontos: todos os 29 cascos, arquétipos e famílias de tiro |
| [`BALANCEAMENTO-RECURSOS.md`](BALANCEAMENTO-RECURSOS.md) | receitas, fontes e tempos-alvo de farm dos 70 recursos |
| [`ECONOMIA-DESCARTE.md`](ECONOMIA-DESCARTE.md) | decisão entre vender por Sucata e desmontar por materiais |
| [`ARTE-UI-MISSOES.md`](ARTE-UI-MISSOES.md) | contrato de arte e estado implementado da Central de Contratos |
| [`ESPECIFICACAO-MESTRE.md`](ESPECIFICACAO-MESTRE.md) | fonte de verdade de design. Quando divergir de qualquer outro, ela vence |

Os demais (`FASE-0-*`, `ITEMIZACAO-DIAGNOSTICO`, `ARTE-UI-*`) são registros de
momento: valem como história, não como estado atual.

---

## 1. O que o jogo é

Idle/progression shooter espacial que roda no navegador. Uma nave sobe por uma
cena vertical pilotada por **IA** — o jogador não mira nem desvia. O que o
jogador faz é decidir: qual nave, quais itens, qual elemento, quais nós da
Matriz, qual contrato aceitar, qual piso da Provação enfrentar.

Isso é a decisão de design mais importante do projeto e explica quase tudo o que
segue: **como o jogador não tem reflexo no laço, todo o desafio precisa estar na
construção.** Um número mal calibrado não é uma dificuldade a mais — é a única
dificuldade, e ela some ou vira parede.

### A escala

| | |
|---|---|
| campanha | **300 setores**, 10 por galáxia, 5 ondas por setor + 1 chefe |
| nível máximo | **300** (personagem), com curva própria por nave |
| galáxias | 30, geradas por regra (`galaxyOfSector`), com 14 chaves de arte em rodízio |
| modo paralelo | **Núcleo de Provação**: 100 pisos, chefe único em cada |

### O censo de conteúdo, hoje

| | | | |
|---|---|---|---|
| slots de item | 10 | inimigos | 68 |
| bases de item | 80 | inimigos de frota | 24 |
| afixos | 35 | chefes de galáxia | 30 |
| conjuntos | 4 | chefes da Provação | 100 |
| raridades | 7 | especiais da Provação | 18 |
| cascos (naves) | 53 | modificadores da Provação | 11 |
| elementos | 6 | camadas da Provação | 10 |
| recursos | 70 | contatos de missão | 9 |
| baús | 4 | nós da Matriz | 177 (8 ramos) |
| personagens jogáveis | 4 | posturas de IA | 3 |

*(Reproduza este censo importando as tabelas de `@data/*` e contando — todas são
arrays exportados.)*

---

## 2. Arquitetura

```
src/
  core/     3 arq · matemática, RNG determinístico (mulberry32), pools, formatação
  render/   6 arq · Assets, Surface (canvas 2D), Parallax, Particles, Anim, Atlas
  sim/     16 arq · estado, atributos, progressão, loot, matriz — SEM DOM, SEM canvas
  data/    39 arq · tabelas puras + `balance/` com as curvas e limites
  modes/    4 arq · VerticalMode (cena de combate), PilotAI, WaveDirector, entities
  ui/      22 arq · Shell, LeftRail, painéis e componentes — SEM regra de jogo
  app/      4 arq · Game (laço de passo fixo), Bus, Loop e persistência admin
tools/     32 arq · pipeline de assets e o arnês de balanceamento, fora do bundle
tests/          · 570 testes passando + 1 todo (verificado em 25/08/2026)
```

**Aliases:** `@core @render @sim @data @ui @modes @app`

### As quatro regras de camada, em ordem de importância

1. **`sim/` e `data/` não conhecem DOM nem canvas.** É o que permite ao Node
   importar *o mesmo arquivo* que o navegador roda e medir balanceamento sem
   abrir aba. Não existe cópia da fórmula, e por isso a medição não pode
   divergir do jogo.
2. **`ui/` não decide regra de jogo.** Se um painel precisa calcular algo, o
   cálculo mora em `sim/`.
3. **`data/` é tabela, não lógica.** Fórmula fica em `sim/`.
4. **Balanceamento não vive espalhado.** Curvas, pesos, tiers, raridades e
   multiplicadores moram em `data/balance/`. **Um número mágico dentro de um
   `if` é bug de arquitetura**, não estilo.

### O fluxo, de cima a baixo

```
app/Game  ──passo fixo──▶  modes/VerticalMode  ──▶  render/Surface (canvas)
    │                            │
    │                            ├── PilotAI       decide o movimento da nave
    │                            └── WaveDirector  decide o que entra em cena
    │
    ├──▶ sim/Sim ─────▶ sim/stats     atributos finais (nave + itens + matriz)
    │       │           sim/loot      sorteio de item e raridade
    │       │           sim/dano      dano normal + elementais
    │       │           sim/progression  o que cada setor apresenta
    │       │           sim/missoes  · sim/provacao · sim/desafio · sim/morte
    │       │
    │       └── lê ──▶ data/balance/*  todas as curvas e limites
    │
    └──▶ app/Bus ──eventos──▶ ui/Shell ──▶ ui/panels/*
```

**O funil único de eventos.** Tudo o que "acontece" no jogo passa por
`Sim.registrar(fato)`, um `FatoDeJogo` de união discriminada. As missões
declaram o que contam como **dado**, não como código. Consequência prática: para
uma missão nova contar algo novo, adiciona-se uma variante ao tipo — e o
compilador aponta todo lugar que precisa saber dela.

---

## 3. Invariantes — o que não se negocia

Violar qualquer um destes é regressão, não escolha.

**Combate**
- Dano normal e elemental são componentes **separados**: `total = normal + Σ elementais`.
- **Dano normal não é resistível.** Nenhuma resistência o reduz, e não existe
  "resistência a normal". É essa imunidade que dá identidade ao dano neutro: ele
  nunca ganha vantagem, mas nunca é reduzido. Sem isso o elemental domina
  sempre, porque quem escolhe o elemento por encontro leva 1,25 fixo contra a
  média de 1,01.
- **Toda fórmula tem teto** (`data/balance/limites.ts`): crítico, cadência,
  cooldown, projéteis, regeneração, resistência, multiplicadores. Nada de
  divisão por zero, cooldown negativo ou invulnerabilidade permanente.

**Progressão**
- **A nave evolui por item, craft e Matriz. Só.** Não existe sistema paralelo de
  upgrade. Já foram removidos por serem um: o menu **Melhorias** (§31) e os
  **Power Ups** de batalha (§30). Qualquer proposta de nova fonte de poder fora
  dessas três **deve ser recusada**.
- Nenhuma nave e nenhum atributo pode dominar todo o conteúdo. Progressão é
  horizontal tanto quanto vertical.

**Dados**
- **Identificadores internos são estáveis e não-visuais.** `weapon_plasma_mk3`,
  nunca `Canhão de Plasma MK.III`. Vale para itens, naves, inimigos, recursos,
  elementos, galáxias, chefes e sets.
- **Save malformado não pode travar o boot.** A migração v5 apara o que não
  existe mais, normaliza preferências e preenche o que falta. Saves antigos são
  preservados quando há migração conhecida; save de versão futura é recusado de
  modo seguro, pois o código não pode inventar campos que ainda não conhece.

**Arte**
- Os packs crus em `D:\bbb\*` são **somente leitura**. O pipeline lê de lá e
  escreve em `game/public/assets`. Nunca o contrário.
- **Nunca invente nome de sprite.** Duas vezes isso passou por typecheck e por
  centenas de testes e a tela renderizou vazia. Confira no manifesto antes de
  usar. Os prefixos reais são `aba/*` (abas), `cat/*` (os nove slots de item),
  `gem/*` (raridades), `geral/*`.

**A Loja** é a **Central de Serviços**. Sua regra arquitetural é rígida: nenhum
contrato concede atributo direto. Ela oferece carga, reconfiguração da Matriz,
tentativas e câmbio com cota. Dados em `data/shop.ts`, efeitos em `sim/index.ts`
e a tela em `ui/panels/ShopPanel.ts`.

**A Bancada de Modulação** é o craft de Prefixos e Sufixos. A tela própria vive
em `ui/panels/AffixCraftPanel.ts`, o custo em
`data/balance/recalibracao.ts` e as regras de elegibilidade/sorteio em
`sim/loot.ts`.

---

## 4. Como rodar

```bash
cd D:\bbb\game; npm run dev
```

O terminal do Rafael é **PowerShell 5.1**, que **não aceita `&&`** — use `;`.

| Comando | O quê |
|---|---|
| `npm run dev` | Vite em `localhost:5180` (porta fixa) |
| `npm run assets` | Fatia os packs crus de `D:\bbb\*` em `public/assets` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | suíte do Vitest (570 testes + 1 `todo`, conferidos em 25/08/2026) |
| `npm run build` | assets + typecheck + build |

Se mexeu em arte: `npm run assets; npm run dev`.

---

## 5. Como verificar — a régua é do Node, não do navegador

O jogo é do navegador; a medição é do Node. Como `sim/` e `data/` são TypeScript
puro, o **mesmo arquivo** que o navegador importa para jogar o Node importa para
medir.

`tools/lib/balanco.ts` tem a medição · `tools/simular.ts` é a linha de comando ·
`tools/run-ts.mjs` carrega TS em Node com os aliases do Vite.

```bash
npm run simular -- curva 1 300        # dificuldade × poder, setor a setor
npm run simular -- drops 300000       # distribuição real de raridade
npm run simular -- item 30            # dispersão de poder entre itens
npm run simular -- afixos 30 5        # valor marginal de cada afixo
npm run simular -- provacao 1 20      # os pisos da Provação
```

### Cinco armadilhas que já custaram caro

1. **Uma amostra por setor é ruído, não sinal.** Mexer na ORDEM das chamadas ao
   RNG reembaralha todos os itens. O mesmo setor 300 já deu 5,3, 5,7 e 5,9
   golpes em três variantes cujo poder real era idêntico. Os testes de ritmo
   usam **41 amostras** por setor por causa disso.
2. **O medidor mente mais que o jogo.** Três "defeitos" registrados no roadmap
   eram artefatos de medição: a dispersão de 135× comparava slots diferentes;
   três afixos "mortos" foram medidos contra uma nave de dano neutro; o viés de
   "1,09× a 1,50×" tinha sinal invertido. **Antes de consertar um número,
   verifique se o instrumento está certo.**
3. **A Sorte é um laço fechado.** Ela vem dos itens e volta a decidir a raridade
   dos próximos. Qualquer medição de raridade que fixe a Sorte modela um jogador
   que não existe. Use `sorteDoSetor()`, que resolve o ponto fixo.
4. **Escreva scripts `.ts` em `tools/`, não `node -e`.** Aspas e acentos são
   destruídos pelo shell; isso já quebrou `tools/simular.ts` inteiro ao inserir
   uma crase dentro de um template literal.
5. **Corrija a asserção, não apague o teste.** Se um teste de linha de base
   falhar depois de uma melhoria, troque a asserção pela faixa saudável.

### Render — no navegador

O painel do ambiente não compõe quadros, então screenshot direto não funciona.
Existe um caminho próprio:

- `POST /__snap` (middleware só de dev) grava um quadro do canvas em `.snapshots/`.
- `window.oz.debugStep(n)` avança `n` quadros de forma determinística.
- `window.oz.debugSim` expõe o `Sim` para inspeção, `setTestMode` e `jumpSector`.

Para conferir DOM (fichas, painéis), importe o módulo direto no console:
`await import('/src/ui/ItemCard.ts')` e monte o fragmento num `div` solto.

---

## 6. Estilo

- Comentários e identificadores de domínio em **português**.
- Comentário explica **por que**, não o quê — e principalmente **por que a
  alternativa óbvia não serviu**. Os comentários deste projeto carregam medições
  e tentativas descartadas; é isso que impede alguém de refazer o erro.
- Sem dependência nova sem motivo forte. TypeScript + Canvas 2D puro, sem engine.

---

## 7. Política de modelos (§49)

Opus pensa, decide, planeja e revisa. Sonnet executa o que já está especificado.

| Nível | O quê | Modelo |
|---|---|---|
| 1 — Simples | textos, tooltips, ajuste visual, cadastro de dados | Sonnet |
| 2 — Moderado | UI, filtros, integrações pequenas, testes, refactor local | Sonnet |
| 3 — Complexo | mecânica nova, mudança de combate, integração entre sistemas | Opus planeja · Sonnet executa · Opus revisa |
| 4 — Crítico | arquitetura, saves, progressão global, economia, gerador de itens, drop, fórmulas de dano, sistema elemental, migrações | Opus |

Fluxo padrão: **Opus (análise) → Opus (arquitetura + critérios de aceite) →
Sonnet (implementação) → Sonnet (testes) → Opus (revisão) → documentação**.

Se o Sonnet encontrar decisão arquitetural não prevista, conflito entre sistemas,
mudança de save, fórmula global ou risco de regressão: **registrar o bloqueio e
devolver ao Opus**, nunca improvisar.

Agentes em `.claude/agents/`: `game-architect`, `balance-designer`,
`implementer`, `code-reviewer`, `tester`, `content-data-agent`,
`save-migration-reviewer`. Não deixar dois agentes editando os mesmos arquivos
críticos ao mesmo tempo.

### Handoff (§51)

Toda delegação informa: objetivo · arquivos relevantes · arquitetura aprovada ·
o que pode e o que não pode mudar · dependências · critérios de aceite · testes
esperados · riscos conhecidos.

Todo retorno informa: arquivos alterados · resumo · testes executados e
resultados · decisões tomadas · bloqueios · riscos restantes.
