# Handoff para a FASE 0

Nota factual do estado do repositório no momento em que a Especificação Mestre
chegou. **Não é a auditoria** — a auditoria é entregável do `game-architect`.
Isto existe só para que ele não precise redescobrir o que estava em voo.

Data: 16/08/2026 · typecheck limpo · build passando.

## O que existe hoje, em números medidos

| Coisa | Quantidade |
|---|---|
| Atributos (`STAT_IDS`) | 28 (16 clássicos + 12 elementais) |
| Slots de equipamento | 9 |
| Raridades | 5 (Comum → Lendário) |
| Bases de item | 72 (9 slots × 8 acabamentos) |
| Afixos | 31 (19 clássicos + 12 elementais) |
| Sets | 4 |
| Cascos jogáveis | 20 |
| Inimigos | 42 |
| Chefes | 10 |
| Nós da Matriz | 177 |
| Melhorias (menu a remover, §31) | 17 |
| Itens de loja | 6 |
| Baús | 4 |
| Versão do save | 3 |

Linhas por área: `sim` 2042 · `data` 2572 · `ui` 2325 · `modes` 2156 ·
`render` 982 · `app` 310 · `core` 238 · `styles` 734 · `tools` 2420.

## Curva de dificuldade atual (medida, não estimada)

`sectorHp(s) = 34 × 1.235^(s-1)` · `sectorDamage(s) = 9 × 1.1^(s-1)` ·
`sectorBounty(s) = 7 × 1.19^(s-1)`

| Setor | HP da onda | Dano inimigo | Recompensa |
|---|---|---|---|
| 1 | 34 | 9 | 7 |
| 10 | 227 | 21 | 33 |
| 30 | 15 482 | 143 | 1 086 |
| 50 | 1 054 775 | 960 | 35 229 |
| 80 | 5,9 × 10⁸ | 16 760 | 6,5 × 10⁶ |
| 120 | 2,8 × 10¹² | 758 529 | 6,8 × 10⁹ |
| 200 | 5,9 × 10¹⁹ | 1,55 × 10⁹ | 7,6 × 10¹⁵ |
| 300 | **8,7 × 10²⁸** | 2,1 × 10¹³ | 2,7 × 10²³ |

É o dado duro por trás do §1 e do §2: a curva é exponencial pura sem nenhuma
atenuação, e não sobra espaço matemático legível para 300 níveis.

## Trabalho em voo quando a especificação chegou

O usuário decidiu **manter** o que está abaixo e tratá-lo como legado a
refatorar, não reverter.

### 1. Dois atlas novos, já no pipeline e funcionando

- `orbe` (52 sprites) — recorte de `planetas.png`: 14 planetas, 8 luas,
  5 satélites, 8 anões, 3 anéis, 3 buracos negros, 4 nebulosas, 4 cometas,
  3 trechos de cinturão. Substituiu o PlanetPack, que foi **removido do
  pipeline** (`buildPlanets` saiu; `assets.loadPlanets` e `manifest.planets`
  saíram junto).
- `combate` (80 sprites) — recorte de `sprites.png`: 6 naves de jogador,
  6 inimigas, 16 obstáculos, 20 explosões, 20 power-ups, 12 projéteis.

Ferramenta nova: `npm run assets:folha -- <atlas> <prefixo> <escala>` gera folha
de contato ampliada em `.snapshots/`, para conferir recorte a olho.

### 2. Sistema elemental protótipo — **conflita com o §3 e o §5**

Implementado antes de a especificação existir. Conflitos conhecidos:

| Ponto | Como está | O que o documento pede |
|---|---|---|
| §3 — separação | potência elemental é dobrada dentro de `stats.dano` em `resolveStats` | `Dano total = componente normal + componente elemental`, separados |
| §5 — anel | Fogo→Gelo→Cósmico→Raio→Químico→Fogo | Fogo→Raio→Gelo→Cósmico→Químico→Fogo (a validar) |
| §5 — multiplicadores | 1.5 / 0.7 / 0.75 (espelho), constantes em `data/elements.ts` | 1.25 / 1.00 / 0.80, configuráveis em matriz central |
| §4 — atributos | 12 atributos (6 potência + 6 resistência) | falta crítico elemental, penetração elemental, `%dano elemental` genérico |

Arquivos tocados: `sim/types.ts` (ELEMENT_IDS, 12 StatId novos, `Item.element`),
`data/elements.ts` (novo), `sim/stats.ts` (`activeElement`, `defenseElement`,
`resistance`), `sim/loot.ts` (`rollElement`, afixos elementais não escalam com
ilvl), `data/items.ts` (12 afixos gerados), `data/hulls.ts` (campo `element` +
6 cascos novos da linha Prisma), `data/enemies.ts` (campo `element` +
6 corsários), `data/fleets.ts` (elemento por frota e desvio por classe),
`data/bosses.ts` (campo `element`), `data/galaxies.ts` (elemento por galáxia),
`modes/vertical/VerticalMode.ts` (confronto no acerto, elemento no projétil),
`modes/vertical/entities.ts` (`Bullet.element`), e a UI (`ItemCard`, `LeftRail`,
`InventoryPanel`, `GalaxyPanel`).

### 3. Perfil e nota de nave — antecipa o §14 parcialmente

`sim/ships.ts` resume os 28 atributos em 5 eixos (ataque, defesa, mobilidade,
alcance, sincronia), normalizados em escala logarítmica contra a frota inteira,
mais uma nota 0–100 e uma patente D→S+. Aparece no Hangar e no cockpit.

Não cobre o §17 (nível de nave próprio) nem a curva de crescimento por nave.

### 4. Céu das fases reconstruído

`buildSkyProps` agora sorteia por **família** de corpo celeste, não por lista
plana, e as alturas iniciais já entram na tela. O corpo principal da fase é o
mesmo sprite que o mapa de galáxias mostra.

## Assets novos ainda NÃO integrados

Os dois PNGs que a especificação cita existem em `D:\bbb\` e ainda não passaram
pelo pipeline:

- **`tiros e explosoes.png`** (§21, §22) — 1536×1024. Grade de 6 elementos
  (Fogo, Raio, Gelo, Cósmico, Químico, Normal) × 8 categorias: tiros do jogador,
  tiros de inimigo, tiros carregados, beams, efeitos de disparo, explosões,
  partículas e ícones de elemento. É exatamente o vocabulário visual que o §22
  pede, e **torna obsoletos** os 12 projéteis que hoje saem de `sprites.png`.
- **`novos itens.png`** (§23) — 1213×1295. 10 categorias × 7 raridades ×
  2 variantes = 140 ícones. As categorias batem uma a uma com as do §11,
  incluindo "Upgrades Gerais" como décima; as raridades vão de Comum a Divino,
  cobrindo o §9.

## Riscos que valem menção antes de qualquer refactor

1. **O projeto não está sob controle de versão.** `D:\bbb\game` não é repositório
   git. Para um refactor do tamanho que a especificação descreve, isso é o maior
   risco isolado: não há como voltar atrás.
2. **Não existe nenhum teste automatizado nem test runner.** Os §44 e §45 pedem
   validação de combate, itemização, progressão e simulação de milhares de
   drops. Hoje toda verificação é manual, via navegador.
3. **Constantes de balanceamento espalhadas** por pelo menos
   `sim/progression.ts`, `sim/tree.ts` (`140 × 1.155^n`), `sim/index.ts`
   (`120 × 1.24^n`), `data/upgrades.ts` (crescimento por entrada) e
   `data/shop.ts`.
4. **Não existe nível de personagem nem nível de nave.** Só `command.level`
   (patente), que alimenta a Matriz. O §17 pede dois sistemas separados, ambos
   até 300.
5. **Superfície de remoção do §30 (Power Ups)**: `modes/vertical/entities.ts`
   (`PickupKind`, `buffDamage`, `buffRate`, pool de coletáveis),
   `modes/vertical/VerticalMode.ts` (spawn, coleta, desenho, buffs no disparo),
   `data/clips.ts` e `data/shop.ts` (ícones), `sim/index.ts`.
6. **Superfície de remoção do §31 (Melhorias)**: `data/upgrades.ts` inteiro,
   `ui/panels/UpgradesPanel.ts`, `ui/Shell.ts` (aba), `sim/index.ts` (compra e
   custo), `sim/stats.ts` (agregação), `sim/state.ts` e `sim/types.ts` (campo
   `upgrades` persistido — **mexer nisso é mudança de save**).
