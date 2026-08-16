# Órbita Zero — instruções do projeto

Idle/progression shooter espacial. Camada vertical de combate pilotada por IA,
progressão de longo prazo por itens, naves, Matriz e elementos.

A fonte de verdade de design é [`docs/ESPECIFICACAO-MESTRE.md`](docs/ESPECIFICACAO-MESTRE.md).
Quando este arquivo e a especificação divergirem, a especificação vence — e a
divergência deve ser corrigida aqui.

## Como rodar

```bash
npm run assets && npm run dev
```

| Comando | O quê |
|---|---|
| `npm run assets` | Fatia os packs crus de `D:\bbb\*` em `public/assets` (atlas + manifesto) |
| `npm run assets:folha -- <atlas> <prefixo> <escala>` | Folha de contato ampliada, para conferir recorte |
| `npm run assets:organizar` | Espelha arte usada/não usada em `D:\bbb\arte` por hard link |
| `npm run dev` | Vite em `localhost:5180` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | assets + typecheck + build |

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
- **Save nunca é rejeitado por ser antigo.** Campo novo nasce com padrão seguro;
  migração apara o que não existe mais. Perder progresso do jogador é o pior
  defeito possível deste projeto.
- **Dano normal e dano elemental são componentes separados.** `Dano total =
  normal + Σ elementais`. Não transformar todo o dano da nave em elemental.
- **Limites de sanidade em toda fórmula**: crítico, cadência, cooldown,
  projéteis, regeneração, resistência e multiplicadores precisam de teto. Nada
  de divisão por zero, cooldown negativo, invulnerabilidade permanente ou
  contagem absurda de entidades.
- **Nenhuma nave e nenhum atributo pode dominar todo o conteúdo.** Progressão é
  horizontal tanto quanto vertical.

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
