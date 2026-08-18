# FASE 0 — Auditoria do modo de pisos

Relatório pedido no §79 do prompt mestre. **Nenhum código foi escrito para este
pedido ainda** — o §79 e o §85 mandam auditar e apresentar o plano antes.

---

## Resumo em uma frase

**Cerca de 60% do que o prompt pede já existe**, construído nos dois turnos
anteriores sob o nome *Abismo Estelar*; o que falta é a camada de combate, a
interface, e três sistemas de recompensa/registro. Antes de qualquer linha, há
**três decisões** que só você pode tomar — a primeira delas é o nome, porque o
pedido traz quatro nomes diferentes.

---

## 1. DECISÕES NECESSÁRIAS (§85)

### 1.1 O nome — quatro candidatos no mesmo pedido

| origem | nome |
|---|---|
| título do prompt | **NÚCLEO DA PROVAÇÃO** (com "PROVAÇÃO" no menu) |
| §1 do prompt | **NEXO DA ASCENSÃO**, ids `ascension` / `ascension_floor` |
| imagem `provacao.png` | **MODO TORRE** / **TORRE ETERNA** |
| o que já está no código | **ABISMO ESTELAR**, ids `abismo_*` |

Isto não é detalhe: o §1 pede ids estáveis, e trocar id depois de haver save
grava progresso órfão. Preciso da sua escolha antes de escrever.

**Recomendo PROVAÇÃO** — é o que o título do pedido põe no menu, é uma palavra
só, e não colide com nada no jogo. `NEXO` tem o problema de "Nexus" já ser o
nome de uma facção de missões (Lira Nexus, Comerciantes Nexus). "Torre" o §32 da
especificação proíbe explicitamente.

Se for PROVAÇÃO, os ids ficam `provacao`, `provacao_piso`, `provacao_chefe`, e
eu renomeio os `abismo_*` existentes de uma vez — hoje é barato, porque ninguém
tem save com eles.

### 1.2 A arte da imagem contradiz o §34

A `provacao.png` é **dourada e ornamentada**, estilo pergaminho/fantasia, com
molduras trabalhadas. O §34 do próprio prompt manda seguir o design system
atual: cyan `#4FC3FF`, painel `#0A1020`, fundo `#060B18` — que é o que as telas
de Galáxia, Fabricação e Missões usam hoje.

Os dois não convivem. **Recomendo seguir o §34** e usar a imagem como referência
de LAYOUT (torre vertical ao centro, detalhes do piso à direita, conceito à
esquerda), não de paleta. O dourado entra onde o §34 já o prevê: nos Guardiões
de Marco e nas recompensas especiais.

### 1.3 O que fazer com o Abismo Estelar já construído

Ele tem 100 pisos, 100 chefes, 11 modificadores, 18 especiais e 71 testes. O
prompt descreve o mesmo sistema com outro vocabulário e mais profundidade.

**Recomendo evoluir, não recomeçar.** O que existe atende os §5, §6, §13, §18,
§19 e §63 quase inteiros; recomeçar jogaria fora 71 testes que já guardam as
regras do §33 e do §35. O plano abaixo assume evolução.

---

## 2. O que já existe e é reaproveitável (§57)

### 2.1 Combate — `modes/vertical/`

| arquivo | linhas | o que traz |
|---|---|---|
| `VerticalMode.ts` | 1484 | a cena, o loop de chefe, dano, projéteis, invocação |
| `PilotAI.ts` | 323 | o piloto de IA |
| `WaveDirector.ts` | 278 | composição de ondas |
| `entities.ts` | 240 | pool de entidades |

**Achado importante: o sistema de FASES do §20 já existe.** `BossPhase` tem
`at` (fração de vida), `attack`, `fireRate`, `shots`, `bulletSpeed`, `strafe`,
`summon` e `telegraph`. `VerticalMode.updateBoss` já troca de fase por limiar de
vida, já mostra o aviso e já invoca lacaios.

Isso significa que o §20 (fases) e boa parte do §14 (invocar, projéteis
adicionais) **não precisam ser construídos** — precisam ser alimentados.

### 2.2 Dados

| arquivo | o que já resolve do prompt |
|---|---|
| `data/abismo.ts` | §5 (setores de dez), §6 (marcos), §13, §52, §63, §64 |
| `data/abismo-chefes.ts` | §18, §19 (oito arquétipos), 100 chefes sem repetição |
| `data/abismo-especiais.ts` | 18 especiais telegrafados nas 4 famílias |
| `data/bosses.ts` | `BossDef` + `BossPhase` — o formato que o combate lê |
| `data/missoes.ts` | `Requisito` de nove tipos, já usado pelo Abismo (§11) |
| `data/balance/drops.ts` | tabela de drop por regra (§58) |
| `data/recursos.ts` | 70 recursos (§59) |

### 2.3 Save, eventos e interface

- `sim/state.ts` — migração que nunca rejeita save antigo (§56, §76). Já há
  `state.abismo = { pisoMax, tentativas, vitorias }`.
- `app/Bus.ts` — event bus com 12 eventos. Falta emitir os quatro do §61.
- `Sim.registrar(fato)` — o funil de fatos das missões (§60). Missão do tipo
  "conclua o piso 20" é **linha de tabela**, não código novo.
- `ui/Shell.ts` — modal em camada, `overlay = true`, Esc/X/backdrop (§48, §49).
- `ItemCard.ts`, `spriteIcon`, o sistema de pílulas de recompensa (§40).

---

## 3. Lacunas reais — o que o prompt pede e não existe

Ordenado por risco, não por ordem no prompt.

### 3.1 A camada de combate não lê nada do modo (risco ALTO)

`efeitosDoPiso` devolve `vida`, `dano`, `regen`, `reflexo`, `resistencia`,
`invocaCada`, `divideEm`, `limiteDeTempo`, `travaEscudo`, `espelhaElemento` — e
**ninguém consome**. O mesmo vale para os 18 especiais e a barra de carga.

É o maior item do trabalho e o único que toca `VerticalMode`, que é o arquivo
mais sensível do projeto (1484 linhas, roda a 60 fps).

### 3.2 Recompensa em três camadas (§21, §22, §23) — risco ALTO

Hoje há uma recompensa por piso. O prompt pede três: primeira conclusão,
repetição (menor) e marco. E o §74 chama de **teste crítico** garantir que
recarregar, morrer ou fechar o modal não pague a primeira conclusão duas vezes.

Isso muda o save: `firstClearClaimed` precisa existir.

### 3.3 Registros e estados (§10, §27) — risco MÉDIO

Faltam `MASTERED`, `floorRecords` (tempo, nave, dano causado/recebido, data) e
`bossRecords`. O §55 lista o formato; o §28 pede que a arquitetura não impeça
ranking futuro.

### 3.4 A interface inteira (§34–§51) — risco MÉDIO

Não existe painel. É trabalho grande mas conhecido: as telas de Missões e
Fabricação deram o padrão de modal em três colunas.

### 3.5 Recursos próprios do modo (§24) — risco BAIXO

Dois a quatro recursos novos em `data/recursos.ts`. Barato.

### 3.6 Modificadores mecânicos que faltam (§14)

Dos quinze listados, tenho equivalente para nove. Faltam: **invulnerabilidade
temporária**, **alternar elemento**, **zonas perigosas na arena**, **clones**,
**barreira frontal** e **pontos fracos**. Os três últimos exigem trabalho de
combate, não de tabela.

---

## 4. Riscos

| risco | por quê | mitigação |
|---|---|---|
| **`VerticalMode` é o arquivo mais caro de errar** | 1484 linhas, 60 fps, o jogo inteiro passa por ele | Efeitos entram por um objeto único lido no início do encontro, não por `if` espalhado |
| **Pagar a primeira conclusão duas vezes** | o §74 chama de crítico; save + reload + morte são três caminhos | `firstClearClaimed` gravado ANTES de entregar, e teste que simula os três caminhos |
| **Trocar id depois de haver save** | progresso órfão, sem volta | Decidir o nome AGORA (item 1.1) |
| **Cem pisos mal balanceados de uma vez** | o §84 avisa explicitamente | Fases 1–10 primeiro, medir, só então expandir |
| **A build universal sobreviver** | §16 e §89 são o coração do pedido | O simulador do Node precisa medir isso, não o olho |

---

## 5. Arquitetura proposta

```
data/
  provacao.ts            pisos, setores, marcos, curvas        (evolui abismo.ts)
  provacao-chefes.ts     os 100                                (evolui abismo-chefes.ts)
  provacao-especiais.ts  os 18 + os que faltarem               (evolui abismo-especiais.ts)
  provacao-modificadores.ts   separado dos pisos — o §54 pede banco próprio
  provacao-recompensas.ts     três camadas (§21-23)
sim/
  provacao.ts            estado, desbloqueio, resgate, registros
modes/vertical/
  ProvacaoEncounter.ts   traduz piso → encontro; ÚNICO ponto que toca o combate
ui/panels/
  ProvacaoPanel.ts       o modal
```

A regra que organiza: **`VerticalMode` não aprende o vocabulário da Provação.**
Ele recebe um encontro já montado, com os efeitos resolvidos num objeto. É a
mesma decisão do funil de fatos das missões, e pelo mesmo motivo — o dia em que
houver um segundo modo, `VerticalMode` não precisa saber dele.

---

## 6. Plano por fases (§80–§84)

| fase | o quê | entrega |
|---|---|---|
| **1** | Renomear para o nome escolhido; modificadores em banco próprio (§54); recompensa em três camadas; save + migração; eventos do §61 | Modelo completo, testado, sem UI |
| **2** | Pisos 1–10 ligados ao combate: efeitos, barra de especial, telegrafia | O modo jogável até o Guardião do piso 10 |
| **3** | A interface, seguindo o layout da imagem e a paleta do §34 | Tela completa |
| **4** | Balanceamento 1–10 medido no simulador do Node | Números com evidência |
| **5** | 11–100, dez a dez | Conteúdo |

Cada fase entrega o relatório do §90.

---

## 7. O que eu recomendo decidir agora

1. **O nome.** Recomendo PROVAÇÃO.
2. **A paleta.** Recomendo o §34 (cyan), com a imagem como layout.
3. **Evoluir o Abismo** em vez de recomeçar.

Com essas três respostas eu começo pela Fase 1.
