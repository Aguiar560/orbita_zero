# Órbita Zero — instruções do projeto

Idle/progression shooter espacial. Camada vertical de combate pilotada por IA,
progressão de longo prazo por itens, naves, Matriz e elementos.

> ## 👉 Começando agora? Leia [`docs/MAPA-DO-PROJETO.md`](docs/MAPA-DO-PROJETO.md).
>
> Ele orienta em uma página: o que o jogo é, onde cada coisa mora, os
> invariantes que não se negociam, e **como medir qualquer afirmação sem
> confiar em documento nenhum**.

| Documento | O quê |
|---|---|
| [`docs/MAPA-DO-PROJETO.md`](docs/MAPA-DO-PROJETO.md) | **Entrada.** Arquitetura, invariantes, censo, como rodar e como medir |
| [`docs/TELAS.md`](docs/TELAS.md) | Cada tela: o que faz, arquivo, o que lê e escreve, o que falta |
| [`docs/SISTEMAS.md`](docs/SISTEMAS.md) | Cada sistema por dentro: fórmulas, fluxo de dados, decisões |
| [`docs/PLANO.md`](docs/PLANO.md) | **Para onde vamos.** Passos ordenados, critérios de aceite, decisões pendentes |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Histórico do que foi feito, com a medição de cada etapa |
| [`docs/ESPECIFICACAO-MESTRE.md`](docs/ESPECIFICACAO-MESTRE.md) | Fonte de verdade de design |
| [`docs/SEGURANCA-E-CONTA.md`](docs/SEGURANCA-E-CONTA.md) | Auditoria de segurança e a arquitetura de login/servidor |

Registros de momento, que valem como história e **não** como estado atual:
[`FASE-0-AUDITORIA`](docs/FASE-0-AUDITORIA.md) ·
[`HANDOFF-FASE-0`](docs/HANDOFF-FASE-0.md) ·
[`FASE-0-NEXO`](docs/FASE-0-NEXO.md) ·
[`ITEMIZACAO-DIAGNOSTICO`](docs/ITEMIZACAO-DIAGNOSTICO.md) ·
[`ATUALIZACAO-2026-08-25`](docs/ATUALIZACAO-2026-08-25.md) ·
[`ARTE-UI-*`](docs/).

Quando este arquivo e a especificação divergirem, a especificação vence — e a
divergência deve ser corrigida aqui.

**Ao concluir uma etapa:** atualize o `ROADMAP.md` (o que foi feito, com a
medição) e o `PLANO.md` (o que deixou de faltar). Se a mudança alterou uma tela
ou um sistema, atualize `TELAS.md` ou `SISTEMAS.md` junto — são eles que outra
IA lê para não reinventar o que já existe.

## Como rodar

```bash
cd D:\bbb\game; npm run dev
```

⚠️ O terminal é **PowerShell 5.1**, que **não aceita `&&`** — use `;`.
Se mexeu em arte: `npm run assets; npm run dev`.

| Comando | O quê |
|---|---|
| `npm run assets` | Fatia os packs crus de `D:\bbb\*` em `public/assets` (atlas + manifesto) |
| `npm run assets:folha -- <atlas> <prefixo> <escala>` | Folha de contato ampliada, para conferir recorte |
| `npm run assets:organizar` | Espelha arte usada/não usada em `D:\bbb\arte` por hard link |
| `npm run dev` | Vite em `localhost:5180` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | assets + typecheck + build |
| `npm test` | suíte do Vitest |
| `npm run simular -- curva 1 300` | dificuldade × poder, setor a setor |
| `npm run simular -- drops 200000` | distribuição real de raridade |
| `npm run simular -- item 30` | dispersão de poder entre itens do mesmo nível |
| `npm run simular -- afixos 30 5` | valor marginal de cada afixo, para o orçamento do §7 |

Os packs crus em `D:\bbb\*` são **somente leitura**. O pipeline nunca escreve neles.

## Arquitetura

```
src/
  core/     matemática, RNG determinístico (mulberry32), pools, formatação
  render/   Assets, Surface (canvas 2D), Parallax, Particles, Anim
  sim/      estado, atributos, progressão, loot, matriz — SEM DOM, SEM canvas
  data/     tabelas puras: itens, afixos, raridades, cascos, inimigos, chefes,
            elementos, galáxias, baús, biomas
  modes/    VerticalMode (cena de combate), PilotAI, WaveDirector
  ui/       Shell, LeftRail, painéis — SEM regra de jogo
  app/      Game (loop de passo fixo), Bus
tools/      pipeline de assets (Node + sharp), fora do bundle
```

Regras de camada, em ordem de importância:

1. `sim/` e `data/` não conhecem DOM nem canvas. É o que permite simular
   balanceamento sem abrir o navegador.
2. `ui/` não decide regra de jogo. Se um painel precisa calcular algo, o cálculo
   mora em `sim/`.
3. `data/` é tabela, não lógica. Fórmula fica em `sim/`.
4. Aliases: `@core @render @sim @data @ui @modes @app`.

## Restrições que não se negociam

- **Balanceamento não vive espalhado pelo código.** Curvas, pesos, tiers,
  raridades e multiplicadores elementais moram em módulos de configuração
  próprios. Um número mágico dentro de um `if` é bug de arquitetura.
- **Identificadores internos são estáveis e não-visuais.** `weapon_plasma_mk3`,
  nunca `Canhão de Plasma MK.III`. Vale para itens, naves, inimigos, recursos,
  elementos, galáxias, chefes e sets.
- **Save malformado não pode travar o boot.** Migração apara o que não existe
  mais e preenche o que falta. *Durante o desenvolvimento*, compatibilidade
  entre versões NÃO é restrição: o esquema muda muito e o save é zerado junto,
  de propósito. Isso volta a valer antes do lançamento — e aí o
  `save-migration-reviewer`, hoje dormente, entra em cena.
- **Dano normal e dano elemental são componentes separados.** `Dano total =
  normal + Σ elementais`. Não transformar todo o dano da nave em elemental.
- **Dano normal não é resistível.** Vai direto no escudo, no casco e na vida:
  nenhuma resistência o reduz, e não existe atributo de "resistência a normal".
  É essa imunidade a mitigação que dá identidade ao dano neutro — ele nunca
  ganha vantagem, mas também nunca é reduzido. Sem isso o elemental dominaria
  sempre, porque quem escolhe o elemento por encontro leva 1,25 fixo em vez da
  média de 1,01.
- **Limites de sanidade em toda fórmula**: crítico, cadência, cooldown,
  projéteis, regeneração, resistência e multiplicadores precisam de teto. Nada
  de divisão por zero, cooldown negativo, invulnerabilidade permanente ou
  contagem absurda de entidades.
- **Nenhuma nave e nenhum atributo pode dominar todo o conteúdo.** Progressão é
  horizontal tanto quanto vertical.
- **Casco novo entra com HISTÓRIA e CURIOSIDADE.** Ficam em
  `data/hulls-lore.ts`, e `tests/hulls-lore.test.ts` quebra o build se faltar.
  A regra é testada e não combinada porque convenção que depende de memória se
  perde na terceira nave — e um catálogo com metade das naves mudas é pior que
  um sem nenhuma.
- **Dinheiro e assinatura NÃO moram no save.** `resources` e `vip` em
  `GameState` são ESPELHO do servidor desde a Fase 2 do Passo 9; a verdade está
  em `transacoes`, `saldos` e `assinaturas` no D1. Todo movimento entra em
  `state.pendentes` e sobe pela fila — nunca escreva `state.resources` direto,
  porque a próxima sincronização apaga a escrita e a punição (ou o prêmio) some
  sem sintoma. Foi exatamente o defeito encontrado em `sim/morte.ts`. O save que
  sobe para a nuvem tem esses campos ARRANCADOS (`semODinheiro`), para não
  existirem duas verdades no mesmo servidor.
- **A nave evolui por item, craft e Matriz. Só.** Não existe sistema paralelo de
  upgrade. Já foram removidos por serem um: o menu **Melhorias** (§31) e os
  **Power Ups** de batalha (§30). Qualquer proposta de nova fonte de poder fora
  dessas três deve ser recusada. A **Loja** ainda existe mas será **totalmente
  reformulada** — não a use como base para nada nem trate seus contratos atuais
  como decisão de design.

## Política de modelos (§49 da especificação)

Opus pensa, decide, planeja e revisa. Sonnet executa o que já está especificado.

| Nível | O quê | Modelo |
|---|---|---|
| 1 — Simples | textos, tooltips, ajuste visual, cadastro de dados | Sonnet |
| 2 — Moderado | UI, filtros, integrações pequenas, testes, refactor local | Sonnet, escala se surgir impacto arquitetural |
| 3 — Complexo | mecânica nova, mudança de combate, integração entre sistemas | Opus planeja · Sonnet executa · Opus revisa |
| 4 — Crítico | arquitetura, saves, progressão global, economia, gerador de itens, drop, fórmulas de dano, sistema elemental, bancos centrais, migrações | Opus |

Fluxo padrão: **Opus (análise) → Opus (arquitetura + critérios de aceite) →
Sonnet (implementação) → Sonnet (testes) → Opus (revisão) → documentação**.

Não delegar ao Sonnet tarefa cuja arquitetura ainda não esteja definida. Se o
Sonnet encontrar decisão arquitetural não prevista, conflito entre sistemas,
mudança de save, fórmula global ou risco de regressão: **registrar o bloqueio e
devolver ao Opus**, nunca improvisar.

A política é regra de projeto, não garantia técnica: a ferramenta não troca de
modelo sozinha.

## Agentes

Definidos em `.claude/agents/`. Cada um tem escopo, modelo preferencial e regra
de escalonamento próprios.

| Agente | Modelo | Papel |
|---|---|---|
| `game-architect` | Opus | Coordenador técnico: audita, mapeia dependências, define modelo de dados e critérios de aceite, decompõe features |
| `balance-designer` | Opus | Curvas 1–300, HP/dano, orçamento de itens, tiers T1–T10, raridades, drop weights, economia, simulações |
| `implementer` | Sonnet | Executa tarefas já especificadas |
| `code-reviewer` | Opus | Revisa mudanças importantes antes de fechar |
| `tester` | Sonnet | Testes e verificações de combate, itens, XP, saves, drops |
| `content-data-agent` | Sonnet | Expansão massiva orientada a dados a partir de schema aprovado |
| `save-migration-reviewer` | Opus | Versionamento e migração de saves |

Não deixar dois agentes editando os mesmos arquivos críticos ao mesmo tempo. O
`game-architect` decompõe o trabalho para evitar conflito.

## Handoff (§51)

Toda delegação informa: objetivo · arquivos relevantes · arquitetura aprovada ·
o que pode e o que não pode mudar · dependências · critérios de aceite · testes
esperados · riscos conhecidos.

Todo retorno informa: arquivos alterados · resumo · testes executados e
resultados · decisões tomadas · bloqueios · riscos restantes.

## Verificação

### Balanceamento — em Node, sem navegador

O jogo é do navegador; a régua é do Node. `sim/` e `data/` são TypeScript puro,
sem DOM e sem canvas, então o **mesmo arquivo** que o navegador importa para
jogar o Node importa para medir — não existe cópia da fórmula, e por isso a
medição não pode divergir do jogo real.

`tools/lib/balanco.ts` tem a medição, `tools/simular.ts` é a linha de comando, e
`tools/run-ts.mjs` carrega TypeScript em Node com os aliases do Vite (o Vitest 4
deixou de publicar o binário `vite-node`, e a API do próprio Vite resolve isso
em dez linhas sem pacote novo).

Existe porque os critérios de aceite não cabem no navegador: 200 000 rolagens
travam a aba, e 300 medições de setor precisam ser reprodutíveis por alguém que
não seja quem as escreveu.

Os testes em `tests/` incluem um bloco **linha de base** que fixa por escrito o
quanto o balanceamento está quebrado hoje. Ele falhar é sinal de sucesso: quer
dizer que a Fase 1 mexeu nas curvas. Ao corrigir, troque a asserção pela faixa
saudável em vez de apagar o teste.

### Render — no navegador

O painel de navegador do ambiente não compõe quadros, então screenshot direto do
jogo não funciona. Existe um caminho próprio:

- `POST /__snap` (middleware só de dev, em `vite.config.ts`) grava um quadro do
  canvas em `.snapshots/`.
- `window.oz.debugStep(n)` avança `n` quadros de forma determinística.
- `window.oz.debugSim` expõe o `Sim` para inspeção e para `setTestMode`/`jumpSector`.

É esse par que permite conferir render e rodar simulação de progressão de 15–20
minutos sem depender de olho humano no meio.

## Estilo

- Comentários e identificadores de domínio em **português**.
- Comentário explica **por que**, não o que — e principalmente por que a
  alternativa óbvia não serviu.
- Sem dependência nova sem motivo forte. O jogo é TypeScript + Canvas 2D puro,
  sem engine.
