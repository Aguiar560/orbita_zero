# FASE 0 — Auditoria e Planejamento Técnico

Conduzida pelo `game-architect`, com apoio do `balance-designer` na parte
matemática, conforme §54 da Especificação Mestre.

Nenhuma alteração destrutiva foi feita durante esta auditoria. O único código
tocado foi de medição, descartado depois.

Todo número aqui foi **medido no código real**, executando o jogo. Nada é
estimativa.

---

## 1. ESTADO ATUAL

### 1.1. Mapa da arquitetura

```
src/
  core/    238 L   math (Rng mulberry32, clamp, lerp), pool, format
  render/  982 L   Assets (atlas + manifesto), Surface (canvas 2D), Parallax,
                   Particles, Anim
  sim/    2042 L   state · types · stats · progression · loot · tree · ships
                   index.ts é a fachada (750 L) que a UI e a cena consomem
  data/   2572 L   items · rarity · hulls · enemies · fleets · bosses ·
                   galaxies · elements · chests · shop · upgrades · tree ·
                   biomes · clips · orbs
  modes/  2156 L   VerticalMode (1297 L) · PilotAI · WaveDirector · entities
  ui/     2325 L   Shell · LeftRail · ItemCard · dom · 8 painéis
  app/     310 L   Game (laço de passo fixo) · Bus
tools/   2420 L   pipeline de assets (Node + sharp), fora do bundle
```

A separação de camadas **já está correta e vale preservar**: `sim/` e `data/`
não importam DOM nem canvas, `ui/` não calcula regra de jogo, `data/` é tabela.
Isso é o que torna a refatoração proposta viável — dá para simular balanceamento
sem navegador.

### 1.2. Inventário quantitativo

| Sistema | Hoje | Alvo da especificação |
|---|---|---|
| Atributos (`STAT_IDS`) | 28 | + crítico elemental, penetração, %dano elemental genérico |
| Slots de equipamento | 9 | 10 (§11 inclui "Upgrades Gerais") |
| Raridades | 5 | 7 (Comum → Divino, §9) |
| Bases de item | 72 | ~500 (§11: +50 por categoria) |
| Afixos | 31 | + tiers T1–T10 e pesos (§6, §7) |
| Sets | 4 | bônus de 2/3/4/completo (§13) |
| Cascos jogáveis | 20 | +30 (§15) |
| Inimigos | 42 | +30 arquétipos (§16) |
| Chefes | 10 | + modo de 100 pisos (§32, §33) |
| Nós da Matriz | 177 | integrar com nível de personagem (§17) |
| Nível de personagem | **não existe** | 1–300 (§17) |
| Nível de nave | **não existe** | 1–300 por nave (§17) |
| Recursos | 3 moedas globais | +3 exclusivos por galáxia (§24) |
| Versão do save | 3 | — |
| Testes automatizados | **zero** | §44, §45 |
| Controle de versão | **nenhum** | — |

### 1.3. Sistemas por área da especificação

| § | Sistema | Onde vive hoje | Situação |
|---|---|---|---|
| 3–5 | Elemental | `data/elements.ts`, `sim/stats.ts`, `sim/loot.ts`, `VerticalMode` | protótipo, conflita com §3 |
| 6–7 | Tiers e pesos de afixo | `data/items.ts` (`AFFIXES`) | **não existe** |
| 8 | Projéteis adicionais | afixo `proj_f`, peso 9 | existe, sem controle |
| 9–10 | Raridade e drop | `data/rarity.ts`, `sim/loot.ts` | 5 raridades, drop global só |
| 11–12 | Banco de itens | `data/items.ts` | 72 bases geradas por slot×tier |
| 13 | Sets | `data/items.ts` | 4 sets, bônus 2/4 |
| 14–15 | Naves | `data/hulls.ts`, `sim/ships.ts` | 20 cascos, perfil de 5 eixos |
| 16 | Inimigos | `data/enemies.ts`, `data/fleets.ts` | 42, gerados por classe×frota |
| 17 | Níveis | `state.command` (patente) | **falta personagem e nave** |
| 19–20 | Escudo visual | `VerticalMode.drawPlayer` | fixo, `barrier/1` |
| 24 | Recursos | `state.resources` (3 moedas) | sem materiais |
| 28–29 | Inventário | `ui/panels/InventoryPanel.ts` | grade 7×10, filtro só de raridade |
| 30 | Power Ups | `modes/vertical/*` | **remover** |
| 31 | Melhorias | `data/upgrades.ts` + 6 arquivos | **remover** |
| 36 | Arquitetura de dados | `data/` | boa base, falta camada de balanceamento |
| 38 | Versionamento de save | `sim/state.ts` | migração apara, nunca rejeita — correto |

---

## 2. PROBLEMAS ENCONTRADOS

### 2.1. O problema central: as duas curvas divergem 12,9% por setor

Este é o achado que subordina todos os outros. Medi o DPS de um jogador **bem
equipado** (melhor de 40 rolagens por slot, sorte 0,3, melhor casco disponível)
contra a curva de inimigo, setor a setor:

| Setor | DPS jogador | HP da onda | Segundos p/ limpar | Golpes até morrer |
|---:|---:|---:|---:|---:|
| 1 | 1 070 | 34 | **0,0** | 112,7 |
| 10 | 11 304 | 227 | **0,0** | 99,2 |
| 20 | 157 681 | 1 876 | **0,0** | 51,9 |
| 30 | 733 777 | 15 482 | **0,0** | 44,0 |
| 45 | 285 466 | 367 134 | 1,3 | 13,2 |
| 60 | 2 419 720 | 8 706 216 | 3,6 | 3,7 |
| 80 | 5 082 766 | 5,9 × 10⁸ | **116,7** | 1,0 |
| 100 | 7 674 460 | 4,0 × 10¹⁰ | **5 265,7** | 0,3 |

Extraindo as taxas de crescimento por setor entre o setor 1 e o 100:

| Curva | Crescimento por setor |
|---|---|
| DPS do jogador | **1,094** |
| HP do inimigo | **1,235** |
| Vida efetiva do jogador | **1,034** |
| Dano do inimigo | **1,100** |

Divergência ofensiva: `1,235 / 1,094 = 1,129` por setor.
Em 99 setores isso compõe **163 000×**.

Divergência defensiva: `1,100 / 1,034 = 1,064` por setor.
Em 99 setores compõe **446×**.

O resultado é um jogo com três fases involuntárias:

- **Setores 1–40 — trivial.** A onda morre antes de terminar de entrar na tela.
- **Setores 45–75 — a janela jogável.** ~30 setores de jogo real.
- **Setores 80+ — impossível.** No setor 100 são 88 minutos para limpar UMA
  onda, e o jogador morre em 0,3 golpes.

Nenhuma quantidade de ajuste de item conserta isso, porque a causa não é o valor
de nenhum número: é que **as duas curvas são escritas em arquivos diferentes,
com expoentes escolhidos independentemente, e ninguém nunca calculou a razão
entre elas**. A razão é o ritmo do jogo, e hoje ela é acidente.

### 2.2. Números fora da faixa legível muito antes do fim

`sectorHp(s) = 34 × 1,235^(s-1)` chega a **8,7 × 10²⁸** no setor 300. O §1 pede
que os números permaneçam legíveis "durante uma parcela significativa da
progressão"; hoje eles saem da faixa legível por volta do setor 60.

### 2.3. `+1 projétil` vale +100% de DPS e é um afixo comum

Medido: a nave base tem 1 projétil. O afixo `proj_f` soma exatamente 1, o que
**dobra o DPS**. Ele tem peso 9 (contra peso 100 do afixo de dano bruto, que dá
+1,4 a +3,2), nível mínimo 12, e não tem tier nem restrição de raridade.

É precisamente o que o §8 proíbe: tratar `+1 projétil` como equivalente a um
pequeno aumento percentual. E como `dps()` multiplica linearmente por
`projeteis`, dois desses afixos triplicam o dano.

### 2.4. Não existe tier nem orçamento de poder de afixo

`AffixDef` tem `min`, `max`, um `weight` único e um `minIlvl` opcional. Falta
tudo que os §6 e §7 pedem: T1–T10, peso de poder separado do peso de geração,
raridades permitidas, incompatibilidades.

O efeito prático: o valor de um afixo aditivo escala por `(1 + ilvl × 0,32)`,
uma reta que não distingue "rolagem sortuda de item fraco" de "rolagem fraca de
item forte". Não há eixo de qualidade — só nível.

### 2.5. Sistema elemental protótipo conflita com o §3

Implementado antes da especificação existir. Diferenças:

| Ponto | Como está | O que o §3/§5 pede |
|---|---|---|
| Separação | potência elemental é dobrada dentro de `stats.dano` em `resolveStats` | `Dano total = normal + Σ elementais`, componentes separados |
| Anel | Fogo→Gelo→Cósmico→Raio→Químico | Fogo→Raio→Gelo→Cósmico→Químico (a validar) |
| Multiplicadores | 1,5 / 0,7 / 0,75, constantes em `data/elements.ts` | 1,25 / 1,00 / 0,80, em matriz central configurável |
| Atributos | 12 (6 potência + 6 resistência) | falta crítico elemental, penetração, %dano elemental genérico |

Medido: **72,4% dos itens saem neutros**, então os 12 afixos elementais só
aparecem em pouco mais de um quarto do loot.

### 2.6. Distribuição de raridade não comporta Comum→Divino

Medida em 200 000 rolagens com sorte 0:

| Raridade | Real | 1 em |
|---|---:|---:|
| Comum | 68,22% | 1 |
| Incomum | 23,38% | 4 |
| Raro | 6,64% | 15 |
| Épico | 1,48% | 67 |
| Lendário | 0,28% | **356** |

O topo atual sai a cada 356 drops. O §10 quer que os itens próximos de Divino
sejam "extremamente difíceis de obter". Faltam dois degraus e a cauda precisa
ser muito mais longa.

Além disso o drop é **global**: `dropChance(kind, luck)` só distingue onda /
elite / chefe. Não existe drop por galáxia, por inimigo, por atividade nem
exclusivo, que o §10 pede.

### 2.7. Não existe nível de personagem nem de nave

Só existe `state.command.level` (patente), que dá pontos de Matriz. O §17 pede
dois sistemas separados, ambos até 300, com XP próprio por nave e sem
transferência entre elas.

Isso é fundação: sem ele, o §18 (incentivo a múltiplas naves) não tem como
existir, porque não há investimento a preservar em cada nave.

### 2.8. Constantes de balanceamento espalhadas

| Onde | O quê |
|---|---|
| `sim/progression.ts` | `34 × 1,235^s`, `9 × 1,1^s`, `7 × 1,19^s`, `WAVES_PER_SECTOR = 5` |
| `sim/tree.ts` | custo de nó `140 × 1,155^n` |
| `sim/index.ts` | XP de patrulha `120 × 1,24^n` |
| `data/upgrades.ts` | `growth` por entrada, 17 vezes |
| `data/shop.ts` | custos e crescimento por entrada |
| `sim/stats.ts` | teto de sincronia `0,4`, bônus `level × 0,011` |
| `sim/loot.ts` | escala de afixo `1 + ilvl × 0,32`, `dropChance` |

O §2 e o §36 pedem centralização. Hoje alterar o ritmo do jogo exige editar sete
arquivos e torcer para não esquecer nenhum.

### 2.9. Progressão de cascos não é monotônica nem compensada

Medido: setor 30 com `void_foguete` dá 733 777 de DPS; setor 45 com `aurora4`
dá 285 466. O "melhor casco disponível" piora ao avançar. Não há orçamento de
poder por casco, então tier é rótulo, não garantia.

### 2.10. Equipamento domina completamente a base da nave

Medido: casco inicial sem item = 24,2 de DPS. Com nove itens ilvl 1 sem
seleção = 83 (×3,4). Com seleção de melhor-de-40 = 1 070 (×44).

A nave é ~2% do poder do jogador. O §14 quer que cada nave tenha identidade e
função; hoje a escolha de casco é quase irrelevante diante do equipamento.

### 2.11. Riscos de processo

1. **Sem controle de versão.** `D:\bbb\game` não é repositório git. Para o
   tamanho de refactor descrito, é o maior risco isolado — não há como desfazer
   uma etapa que dê errado.
2. **Sem nenhum teste automatizado nem test runner.** Os §44 e §45 exigem
   validação de combate, itemização, progressão e simulação de milhares de
   drops.
3. **Remover Melhorias (§31) destrói investimento do jogador.** `state.upgrades`
   é persistido e o jogador gastou sucata e núcleos ali. Remover sem reembolso é
   perda de progresso.

---

## 3. ARQUITETURA PROPOSTA

### 3.1. Princípio central: pacing é configuração, não consequência

A causa raiz do §2.1 é definir a curva do inimigo em valor absoluto. A proposta
inverte a dependência:

```
poderEsperado(s)   — curva-alvo de DPS do jogador bem equipado no setor s
tempoAlvo(s)       — quantos segundos uma onda DEVE durar no setor s
hpDaOnda(s)        = poderEsperado(s) × tempoAlvo(s)

ehpEsperado(s)     — curva-alvo de vida efetiva do jogador
golpesAlvo(s)      — quantos golpes o jogador DEVE aguentar no setor s
danoInimigo(s)     = ehpEsperado(s) / golpesAlvo(s)
```

Com isso o ritmo do jogo passa a ser **escrito em segundos e em golpes** — que é
a linguagem em que o §2 descreve as metas — e a magnitude dos números vira
consequência auditável, não acidente.

### 3.2. Curva de poder até o setor 300

Crescimento com **taxa decrescente**: punchy no início, legível no fim.

```
r(s)  = r∞ + (r₀ − r∞) · e^(−s/k)
poderEsperado(s) = D₀ · Π r(i)
```

| Parâmetro | Valor inicial | Justificativa |
|---|---|---|
| `D₀` | 80 | DPS medido do casco inicial com nove itens ilvl 1 sem seleção |
| `r₀` | 1,30 | saltos visíveis dentro da galáxia 1 (×13,8 por galáxia) |
| `r∞` | 1,085 | faz `hpDaOnda(300)` cair em ~7 × 10¹⁸ — legível com sufixo |
| `k` | 60 | a transição cobre as galáxias 1–10 |

`tempoAlvo(s) = t₀ + (t₁ − t₀)·(1 − e^(−s/k_t))` com `t₀ = 8s`, `t₁ = 45s`,
`k_t = 90`.

Resultado projetado:

| Setor | Poder esperado | Tempo-alvo | HP da onda | Legibilidade |
|---:|---:|---:|---:|---|
| 1 | 80 | 8 s | 640 | 640 |
| 10 | 900 | 11 s | 9 900 | 9,9K |
| 30 | 65 840 | 18,5 s | 1,2 × 10⁶ | 1,2M |
| 100 | 1,9 × 10⁹ | 32,8 s | 6,1 × 10¹⁰ | 61B |
| 300 | 1,6 × 10¹⁷ | 45 s | 7,3 × 10¹⁸ | 7,3 Qi |

Compare com a curva atual: **0 s → 5 266 s**. A proposta vai de **8 s → 45 s**.

> **Separação importante.** `tempoAlvo` governa a *sensação de combate*. O
> relógio de parede do §2 (galáxia 1 ≈ 10 h) é governado pela **curva de
> aquisição** — XP, drops, moeda —, que determina quanto tempo o jogador leva
> para *alcançar* `poderEsperado(s)`. São dois botões independentes, e hoje eles
> estão confundidos num só.

### 3.3. Fórmula de combate (§3, §4)

Componentes separados, como o §3 exige:

```
// A arma define a DISTRIBUIÇÃO do seu dano base
arma.distribuicao = { normal: 0.6, fogo: 0.4 }   // soma 1

danoNormal = base × distribuicao.normal
           × (1 + Σ%danoNormal + Σ%danoGlobal)
           × critNormal

danoElem[e] = base × distribuicao[e]
            × (1 + Σ%danoElemental + Σ%dano_e + Σ%danoGlobal)
            × critElemental
            × MATRIZ[e][elementoDoAlvo]
            × (1 − clamp(res_e − pen_e, −1.00, +0.80))

danoTotal = danoNormal + Σ_e danoElem[e]
```

Consequências de projeto:

- Crítico normal e crítico elemental são atributos **separados**, como o §4 pede,
  e rolam independentemente no mesmo golpe.
- O dano **Normal nunca é resistido e nunca tem vantagem**. É a identidade dele:
  confiabilidade. Isso resolve um problema real do §5 discutido em 3.4.
- Um item pode ser puramente normal, puramente elemental ou híbrido — que é o
  que o §4 pede quando fala em itens especializados.

Limites de sanidade obrigatórios (§40):

| Grandeza | Piso | Teto |
|---|---|---|
| Chance de crítico (cada tipo) | 0 | 0,95 |
| Resistência elemental | −1,00 | +0,80 |
| Redução de dano físico | — | 0,80 |
| Cadência | 0,2/s | 20/s |
| Projéteis por disparo | 1 | 12 |
| Regeneração | 0 | 25%/s da vida máxima |
| Produto de multiplicadores elementais | — | 4,0 |

### 3.4. Matriz elemental (§5) — validação

O §5 pede validação antes de fixar. **O ciclo proposto é saudável, com uma
ressalva importante.**

Anel: `Fogo > Raio > Gelo > Cósmico > Químico > Fogo`

Propriedades verificadas:

1. **Simétrico.** Cada elemento vence exatamente 1, perde para exatamente 1 e é
   neutro contra 2. Nenhum elemento é estruturalmente melhor.
2. **Recíproco.** `1,25 × 0,80 = 1,000` exatamente. Não há deriva aritmética em
   pares espelhados.
3. **Valor esperado contra distribuição uniforme de inimigos:**
   `(1,25 + 0,80 + 1,00 + 1,00 + 1,00) / 5 = 1,01`. Praticamente neutro.
4. **Normal:** 1,00 sempre, nos dois sentidos. Valor esperado 1,00.

**A ressalva.** O §18 quer que o jogador troque de nave conforme o conteúdo. Se
ele *puder escolher* o elemento por encontro, o multiplicador efetivo dele deixa
de ser a média 1,01 e vira o máximo **1,25**. Nesse cenário o dano elemental
domina o Normal permanentemente, e o §3 (Normal como componente legítimo) morre.

Correção proposta: **dano Normal ignora resistência elemental por completo.**
Como os inimigos terão resistências elementais próprias, o Normal compra
previsibilidade — 1,00 garantido contra qualquer alvo — enquanto o elemental
oscila entre 0,80 e 1,25 mais o efeito das resistências. Isso dá ao Normal uma
identidade real em vez de um bônus numérico compensatório.

Tabela final (linha = atacante, coluna = defensor):

| | Fogo | Raio | Gelo | Cósmico | Químico | Normal |
|---|---|---|---|---|---|---|
| **Fogo** | 1,00 | **1,25** | 1,00 | 1,00 | **0,80** | 1,00 |
| **Raio** | **0,80** | 1,00 | **1,25** | 1,00 | 1,00 | 1,00 |
| **Gelo** | 1,00 | **0,80** | 1,00 | **1,25** | 1,00 | 1,00 |
| **Cósmico** | 1,00 | 1,00 | **0,80** | 1,00 | **1,25** | 1,00 |
| **Químico** | **1,25** | 1,00 | 1,00 | **0,80** | 1,00 | 1,00 |
| **Normal** | 1,00 | 1,00 | 1,00 | 1,00 | 1,00 | 1,00 |

Os três valores (1,25 / 1,00 / 0,80) ficam em constantes configuráveis, e a
matriz inteira é gerada a partir da declaração do anel — não escrita à mão —
para que mudar o anel não exija reescrever 36 células.

### 3.5. Tiers de atributo T1–T10 (§6)

```
valor(t) = valorBase × g^(t−1)        g ≈ 1,34   →   T10 / T1 ≈ 15,9×
```

Disponibilidade em duas travas independentes:

```
tierMax = min( tetoPorNivel(ilvl), tetoPorRaridade(raridade) ) + bônusDaFonte
```

| Raridade | Teto de tier | Afixos |
|---|---:|---:|
| Comum | 3 | 1 |
| Incomum | 4 | 2 |
| Raro | 6 | 3 |
| Épico | 7 | 4 |
| Lendário | 8 | 5 |
| Mítico | 9 | 6 |
| Divino | 10 | 7 |

`tetoPorNivel(ilvl) = 1 + floor(ilvl / 30)` — cobre T1 a T10 ao longo dos 300
níveis. `bônusDaFonte` permite que chefe e conteúdo avançado abram um tier acima
do normal, atendendo ao §10.

O **sorteio** dentro dos tiers permitidos é enviesado para baixo
(`peso(t) ∝ 1/t²`), para que T10 continue raro mesmo quando liberado. Sem isso,
todo item de alto nível sairia no teto e o tier viraria decoração.

### 3.6. Raridades Comum → Divino (§9)

Cores retiradas de `novos itens.png`, que já traz as sete.

| Raridade | Peso | Frequência | Afixos | Tier máx |
|---|---:|---:|---:|---:|
| Comum | 10 000 | 68,4% | 1 | 3 |
| Incomum | 3 400 | 23,2% | 2 | 4 |
| Raro | 960 | 6,6% | 3 | 6 |
| Épico | 220 | 1,50% | 4 | 7 |
| Lendário | 40 | 0,27% | 5 | 8 |
| Mítico | 5 | 0,034% | 6 | 9 |
| Divino | 0,4 | 0,0027% | 7 | 10 |

Divino sai ~**1 em 36 500** drops com sorte zero. Como `rollRarity` já multiplica
o peso por `sorte^raridade`, investir em sorte encurta muito essa cauda no
endgame — que é exatamente o equilíbrio que o §10 descreve entre "sensação real
de conquista" e "não impossível na vida útil do jogo".

### 3.7. Peso e orçamento de atributos (§7, §8)

Cada afixo ganha ficha própria:

```ts
interface AffixDef {
  id: string;
  stat: StatId;
  kind: 'add' | 'mul';
  pesoDePoder: number;      // quanto de orçamento consome
  pesoDeGeracao: number;    // chance de aparecer
  tiersPermitidos: [number, number];
  raridadesPermitidas: Rarity[];
  nivelMinimo: number;
  incompativeis?: string[];
  element?: ElementId;
}
```

O item recebe um **orçamento de poder** derivado de nível e raridade; cada afixo
consome parte dele. É o que impede o caso medido em 2.3.

Tratamento específico de `+N projéteis`, medido em **+100% de DPS por unidade**:

| Afixo | Raridade mínima | Tier | Peso de geração |
|---|---|---|---|
| +1 projétil | Épico | T7 | muito baixo |
| +2 projéteis | Mítico | T9 | extremamente baixo |
| +3 projéteis | Divino | T10 | excepcional |

Consome **todo** o orçamento de poder do slot em que aparece, teto global de 12
projéteis, e só pode existir em `principal` e `secundaria`.

### 3.8. Curva de XP 1–300 (§17)

Dois sistemas separados, como o §17 pede.

**Personagem** — nível global, alimenta a Matriz:
```
xpParaNivel(n) = X₀ · n^p          p ≈ 2,2
```
Forma polinomial de propósito: uma exponencial faria os últimos níveis
inalcançáveis, e o §17 quer 300 níveis atingíveis.

**Nave** — XP e nível próprios, sem transferência entre naves:
```
xpParaNivelDaNave(n) = Y₀ · n^p_nave     p_nave ≈ 2,0
```
Mais rasa que a do personagem de propósito: subir a *segunda* nave precisa ser
viável, senão o §18 não acontece. Cada nível de nave dá um incremento pequeno
nos atributos base dela, o que também ataca o problema 2.10 — a nave volta a ser
uma parcela relevante do poder.

`X₀`, `Y₀` e os expoentes finais saem da **simulação** do §45, contra as metas de
tempo do §2. Não os fixo aqui: seriam números sem justificativa.

### 3.9. Modelo de dados (§36)

```
src/data/
  balance/
    curvas.ts        poderEsperado, ehpEsperado, tempoAlvo, golpesAlvo,
                     xpParaNivel — todas as ProgressionCurves
    raridades.ts     RarityDefinitions (peso, afixos, teto de tier, cor)
    tiers.ts         AffixTiers (g, tetoPorNivel, viés de sorteio)
    pesos.ts         orçamento de poder por nível/raridade
    elementos.ts     ElementDefinitions + declaração do anel
    limites.ts       todos os tetos e pisos de sanidade do §40
  drops/
    tabelas.ts       DropTables: global, por galáxia, por inimigo, por chefe,
                     por atividade, exclusivo
  itens/
    bases.ts         ItemDefinitions (10 categorias)
    afixos.ts        AffixDefinitions
    sets.ts          SetDefinitions
  naves.ts           ShipDefinitions
  inimigos.ts        EnemyDefinitions
  chefes.ts          BossDefinitions
  galaxias.ts        GalaxyDefinitions
  recursos.ts        ResourceDefinitions
  missoes.ts         MissionDefinitions
```

`sim/` continua sendo o único lugar com fórmula. `data/balance/` é tabela pura,
sem lógica, e é o **único** lugar onde constante de balanceamento pode existir.

### 3.10. Exportação para planilha (§12)

Um script `tools/export-balance.mjs` que varre as definições e emite CSV com as
colunas do §12. Como `data/` não tem dependência de DOM, o script roda em Node
direto sobre os módulos, sem duplicar tabela.

---

## 4. MIGRAÇÃO

### 4.1. Save v3 → v4

| Mudança | Estratégia |
|---|---|
| `level`, `xp` do personagem | novos, padrão `1` / `0`; derivar nível inicial de `command.level` para não zerar quem já jogou |
| `naves: Record<id, {xp, level}>` | novo, padrão nível 1 para cada casco em `fleet` |
| `upgrades` removido (§31) | **reembolsar**: converter o gasto acumulado em sucata/núcleos e creditar; manter o campo no save por uma versão, ignorado, para permitir rollback |
| Afixo ganha `tier` | itens antigos: derivar o tier por busca reversa do valor na tabela nova; se não bater, `tier: 1` e manter o valor |
| Item ganha `distribuicao` | itens antigos: `{ normal: 1 }` — o item vira puramente normal, que é o comportamento pré-elemental |
| Item ganha `element` | já existe no protótipo; ausente → `padrao` |
| Raridades 5 → 7 | os índices 0–4 não mudam de significado; Mítico e Divino entram como 5 e 6 |
| `materiais: Record<string, number>` | novo, padrão `{}` |
| Curvas rebalanceadas | `run.sector` preservado; ver 4.2 |

Regra que não muda: **`loadFromStorage` nunca rejeita um save por ser antigo.**
Ele apara o que não existe mais e preenche o que falta com padrão seguro.

### 4.2. O problema do rebalanceamento retroativo

Trocar `sectorHp` muda o significado de "estar no setor 40". Um jogador que
parou lá vai encontrar um jogo diferente do que deixou.

Três opções, em ordem de preferência:

1. **Recalibrar o setor pela potência.** Na migração, medir o poder real do
   jogador e reposicioná-lo no setor onde a nova curva dá o mesmo tempo-alvo.
   Preserva a *experiência*, não o número.
2. Preservar o número do setor e aceitar um degrau de dificuldade.
3. Congelar a curva antiga para saves antigos. Rejeitada: cria dois jogos.

Recomendo a **1**, com aviso ao jogador na primeira carga.

### 4.3. Ordem de segurança

Antes de qualquer mudança de save: **`git init` e commit do estado atual**. É a
única forma de desfazer uma migração que se revele errada.

---

## 5. ROADMAP

Cada etapa é pequena, tem critério de aceite e passa pelo `code-reviewer` antes
de fechar. Nada de "implementar a Fase 1 inteira".

### Etapa 0 — Rede de segurança *(bloqueia todas as outras)*

| # | Tarefa | Agente |
|---|---|---|
| 0.1 | `git init`, `.gitignore`, commit do estado atual | implementer |
| 0.2 | Test runner (`vitest`) + primeiro teste de fumaça | implementer |
| 0.3 | Arnês de simulação: rodar `sim/` puro em Node, sem navegador | implementer |

### Fase 1 — Fundação de dados

| # | Tarefa | Agente |
|---|---|---|
| 1.1 | `data/balance/limites.ts` — todos os tetos do §40, aplicados em `resolveStats` | implementer |
| 1.2 | `data/balance/curvas.ts` — mover as 7 constantes espalhadas, sem mudar valor | implementer |
| 1.3 | Inverter a dependência: `hpDaOnda = poderEsperado × tempoAlvo` | balance-designer + implementer |
| 1.4 | Calibrar `r₀`, `r∞`, `k`, `t₀`, `t₁` por simulação | balance-designer |
| 1.5 | `data/balance/raridades.ts` — 7 raridades | implementer |
| 1.6 | `data/balance/tiers.ts` — T1–T10 | balance-designer + implementer |
| 1.7 | `data/balance/pesos.ts` — orçamento de poder | balance-designer |
| 1.8 | Nível de personagem 1–300 | implementer |
| 1.9 | Nível de nave 1–300 | implementer |
| 1.10 | Save v4 + migração | save-migration-reviewer + implementer |

### Fase 2 — Combate

| # | Tarefa |
|---|---|
| 2.1 | `DamagePacket` — separar normal de elemental (§3) |
| 2.2 | Refatorar o protótipo elemental para o novo modelo |
| 2.3 | Matriz elemental gerada a partir do anel, configurável |
| 2.4 | Crítico normal × crítico elemental separados |
| 2.5 | Resistência e penetração elemental |
| 2.6 | Pipeline de `tiros e explosoes.png` |
| 2.7 | Projéteis, impactos e explosões por elemento |
| 2.8 | Remover Power Ups (§30) |

### Fase 3 — Itemização

| # | Tarefa |
|---|---|
| 3.1 | Pipeline de `novos itens.png` — 10 categorias × 7 raridades |
| 3.2 | `AffixDef` com tier, pesos e restrições |
| 3.3 | Gerador de item com orçamento de poder |
| 3.4 | `+N projéteis` com as novas restrições |
| 3.5 | Tabelas de drop por galáxia / inimigo / chefe / exclusivo |
| 3.6 | Décima categoria (Upgrades Gerais) |
| 3.7 | Filtros e ordenação do inventário (§28) |
| 3.8 | Separar itens de recursos (§29) |
| 3.9 | Remover Melhorias (§31), com reembolso |

### Fase 4 — Progressão

Integração da Matriz com o nível de personagem, curvas de XP calibradas,
requisitos de nível, balanceamento das galáxias contra as metas do §2.

### Fase 5 — Conteúdo

Naves, inimigos, chefes, recursos por galáxia, crafting, missões, modo de
chefes. É aqui que o `content-data-agent` trabalha em volume.

---

## 6. CRITÉRIOS DE ACEITE

### Etapa 0

- `git log` mostra o commit inicial; `git status` limpo.
- `npm test` roda e passa.
- Uma simulação de progressão roda em Node puro, sem navegador.

### Fase 1

- **1.1** — Nenhuma combinação de itens produz crítico > 95%, cadência > 20/s,
  resistência > 80%, regeneração > 25%/s ou mais de 12 projéteis. Teste com
  equipamento máximo em todos os slots.
- **1.2** — `grep` por constante de balanceamento fora de `data/balance/` não
  retorna nada. O comportamento do jogo é **idêntico** ao anterior (mesma
  semente ⇒ mesmo resultado).
- **1.3 + 1.4** — Tempo para limpar uma onda fica entre **6 s e 50 s** em todos
  os setores de 1 a 300. Golpes até morrer fica entre **8 e 30**. Verificado por
  simulação nos setores 1, 10, 30, 60, 100, 150, 200, 250, 300.
- **1.5** — 200 000 rolagens produzem cada raridade dentro de ±5% da tabela.
  Divino aparece entre 1/30 000 e 1/45 000.
- **1.6** — Item de ilvl 10 nunca gera T9 ou T10. Item Divino de ilvl 300 pode
  gerar T10. A distribuição de tier é enviesada para baixo.
- **1.7** — Dois itens da mesma raridade e nível têm poder total dentro de ±25%,
  independentemente de quais afixos rolaram.
- **1.8 + 1.9** — Nível 300 é atingível; a curva não tem degrau. Trocar de nave
  não transfere nível.
- **1.10** — Um save v3 real carrega em v4 sem perda: recursos, itens, cascos,
  Matriz e setor preservados. O reembolso das Melhorias credita o valor gasto.

### Fase 2

- Dano total = normal + Σ elementais, verificável golpe a golpe no log.
- Uma arma 100% normal não é afetada por resistência elemental nenhuma.
- Vantagem elemental produz exatamente 1,25× e desvantagem 0,80×.
- Crítico normal e elemental podem ocorrer no mesmo golpe, independentemente.
- Os seis elementos são distinguíveis na tela **sem depender só da cor** (§22).

### Fase 3

- Cada uma das 10 categorias tem itens em todas as 7 raridades.
- `+1 projétil` não aparece abaixo de Épico. `+3` só em Divino.
- Simulação de 100 000 drops de um chefe específico produz o item exclusivo dele
  na taxa configurada.
- O inventário filtra por categoria, raridade, elemento e set, e ordena por
  nível, raridade, poder, recente e categoria.
- Recursos de crafting não aparecem no inventário de equipamentos.

---

## 7. RESPOSTA DIRETA AOS ITENS DA "PRIMEIRA TAREFA"

| Pedido | Onde está |
|---|---|
| Mapa da arquitetura atual | §1.1, §1.3 |
| Arquivos que precisarão ser alterados | §1.3, §5 (por etapa) |
| Sistemas reutilizáveis | §1.1 — camadas, pipeline de assets, RNG semeado, laço de passo fixo, migração de save, Matriz, arnês de snapshot |
| Sistemas a refatorar | elemental (§2.5), loot e afixos (§2.4), progressão (§2.1), cascos (§2.9) |
| Sistemas a remover | Power Ups (§2, tabela 1.3), Melhorias (§2.11.3) |
| Dependências e riscos | §2.11, §4.2 |
| Impactos nos saves | §4 |
| Modelo de dados | §3.9 |
| Fórmulas de combate | §3.3 |
| Curva até nível 300 | §3.2, §3.8 |
| Tiers T1–T10 | §3.5 |
| Raridades Comum → Divino | §3.6 |
| Matriz elemental | §3.4, **com a validação que o §5 pediu** |
| Plano em pequenas etapas | §5 |

---

## 8. O QUE PRECISA DE DECISÃO SUA ANTES DA FASE 1

1. **`git init` agora?** Recomendo fortemente, antes de qualquer coisa.
2. **Reembolso das Melhorias** — devolver sucata/núcleos, ou converter em pontos
   de Matriz? A segunda opção preserva mais a sensação de investimento.
3. **Recalibrar o setor do save existente** (§4.2, opção 1) ou aceitar o degrau?
4. **Décima categoria "Upgrades Gerais"** — o §11 a lista como categoria de item
   e o §31 manda remover o *menu* Melhorias. Confirmo que são coisas diferentes:
   uma categoria de equipamento nova, não o sistema removido.
5. **Anel elemental** — confirma a correção proposta em §3.4 (Normal ignora
   resistência elemental) como identidade do dano Normal?
