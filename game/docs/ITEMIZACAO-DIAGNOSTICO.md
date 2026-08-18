# Itemização — diagnóstico

Levantamento pedido em "reveja todo o sistema de itemização". **Nada foi
alterado no jogo** além do que já está commitado: a mudança que eu testei
desbalanceou a campanha e foi revertida. O que segue é o que a medição mostrou.

---

## 1. O achado central: um campo morto

`data/balance/raridades.ts` declara, desde sempre, um campo `power`:

| raridade | power | afixos | tierMax |
|---|---|---|---|
| Comum | 1,0 | 1 | 3 |
| Incomum | 1,3 | 2 | 4 |
| Raro | 1,75 | 3 | 6 |
| Épico | 2,4 | 4 | 7 |
| Lendário | 3,4 | 5 | 8 |
| Mítico | 4,9 | 6 | 9 |
| Divino | 7,0 | 7 | 10 |

**`power` nunca é lido por ninguém.** `grep` no `src/` inteiro não encontra uma
única leitura. Uma dimensão de design declarada, revisada e ignorada.

E o implícito da base — que é o que domina o poder de um item — escala **só com
o nível**:

```ts
acc[base.implicit.kind][base.implicit.stat] += base.implicit.per * item.ilvl;
```

Um Comum e um Divino do mesmo nível têm **o mesmo implícito**. A raridade só
muda quantos afixos vêm por cima, e eles somam pouco perto do implícito.

---

## 2. A consequência, medida

Conjunto INTEIRO de cada raridade, procurando o setor em que sai da faixa
saudável (6–50 s para limpar, 8–30 golpes até morrer):

| raridade | trava no setor |
|---|---|
| Comum | **180** |
| Incomum | 230 |
| Raro | 280 |
| Épico | >300 |
| Lendário | >300 |
| Mítico | >300 |
| Divino | >300 |

Um conjunto só de **Comuns leva ao setor 180**. E as quatro raridades do topo
são indistinguíveis: nenhuma trava dentro do jogo que existe.

A intenção declarada é outra: um conjunto de Comuns não deveria passar do chefe
10, nem da galáxia 2.

---

## 3. O que acontece ao ligar o campo

Testei `implicit × power`, normalizado para que uma raridade de referência valha
1,0. Com o **Mítico** como referência:

| raridade | trava no setor |
|---|---|
| Comum | 26 |
| Incomum | 28 |
| Raro | 68 |
| Épico | 134 |
| Lendário | 284 |
| Mítico / Divino | >300 |

**Uma escada de verdade aparece.** Ainda não é a desejada — Comum deveria travar
por volta de 10 a 20, e Épico por volta de 200 —, mas a forma está certa.

### Por que foi revertido

A curva do inimigo foi calibrada contra o jogador ANTIGO. Enfraquecendo tudo
abaixo do Mítico, **cinco setores saíram de banda** — o 80 passou a 61,9 s
contra o teto de 50. O teste de linha de base pegou.

Entregar a escada sem retunar a curva do inimigo trocaria um problema por outro.

---

## 4. O que a mudança exige, em ordem

1. **Ligar `power` no implícito**, normalizado por uma raridade de referência.
2. **Retunar `sectorHp` e `sectorDamage`** contra o novo jogador — é o passo que
   falta, e o que o teste de linha de base vai medir.
3. **Reajustar `equiparMelhor`** no simulador: hoje ele sorteia e pega o melhor,
   o que a partir de certo setor entrega Lendários. Com a escada valendo, o
   modelo precisa refletir a raridade que o jogador REALMENTE tem em cada ponto.
4. **Afastar Comum de Incomum**: 26 e 28 estão colados, porque `power` 1,0 e 1,3
   são vizinhos demais. A escada de `power` precisa ser revista junto.

---

## 5. Prefixos e sufixos ✅ (feito em `3.9`)

Feito **sem campo novo no item e sem migração de save**: `Affix` já guarda o
`id`, então o tipo se lê da tabela. Ofensiva vira prefixo, defensiva e utilidade
viram sufixo — 14 contra 12.

O que a medição descartou pelo caminho está registrado na `3.9` do ROADMAP:
partir os afixos ao meio custava até 13% de sobrevivência, porque forçava três
linhas de dano num escudo. Ficou um PISO que pende para o tema do slot, e o
resto continua sorteado pelo peso da afinidade.

O refazer do ajuste de `DEFESA_A` que isso destapou — 55% alto, e **anterior a
esta etapa** — está lá também.

---

## 6. Recomendação

Cumprida, na ordem proposta. A escada de raridade saiu primeiro (Comum 0,60 ·
Incomum 1,90 · Raro 2,20 · Épico 2,70 · Lendário 3,10 · Mítico 4,90 · Divino
7,00, travando em 24 / 40 / 88 / 190), a divisão prefixo/sufixo depois.

Fica em aberto o que a régua da "parede" não consegue separar: Lendário, Mítico
e Divino travam todos além do setor 300. Distinguir os três precisa de outra
medida — provavelmente tempo de limpeza no setor 300, e não o setor da parede.
