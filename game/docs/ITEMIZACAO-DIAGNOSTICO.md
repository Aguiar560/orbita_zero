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

## 5. Prefixos e sufixos — ainda não existem

A estrutura pedida — atributo base da nave, item somando por cima, **prefixo e
sufixo separados**, com tier dentro de cada um — não é o que está implementado.

Hoje há **uma lista só** de `affixes`, cada um com `tier` de 1 a 10. Não existe
distinção entre prefixo e sufixo, nem limite por família.

Isso é uma mudança de MODELO, não de número, e toca:

- `Item.affixes` e o save (item antigo não tem a divisão);
- `rollItem`, que hoje sorteia N linhas de um pool único;
- a exibição no `ItemCard`;
- a fusão, que gera itens;
- os testes de tier e de exclusão mútua.

Vale fazer **depois** dos quatro passos acima: mexer nas duas coisas ao mesmo
tempo tornaria impossível saber qual delas moveu a curva.

---

## 6. Recomendação

Fazer na ordem: primeiro a escada de raridade com a retuna da curva (passos 1 a
4), medindo a cada passo; depois a divisão prefixo/sufixo.

O primeiro bloco é o que resolve o problema que o Rafael descreveu — "um conjunto
de Comuns não deveria passar do chefe 10". O segundo é profundidade de
itemização, e depende do primeiro estar estável para ser medido.
