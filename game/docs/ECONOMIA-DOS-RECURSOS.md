# O que fazer com os 49 recursos que caem e não são gastos

**Medido em 07/09 com `npm run recursos`.** Rodar de novo depois de qualquer
mudança: os números abaixo saem do código, não deste documento.

```
70 recursos · 0 sem fonte · 49 SEM USO NENHUM · 21 fechados
```

O princípio que orienta tudo aqui: **material em reserva para conteúdo futuro é
saudável; material que CAI hoje e não tem destino hoje não é.** Os 21 recursos
planejados que ainda não caem podem esperar. Os 49 que o jogador já acumula, não.

---

## O padrão do buraco

Não é disperso — é por família inteira.

| Família | Quantos | Caem de | Fecham ciclo hoje |
|---|---|---|---|
| Gases | 10 | os 10 eventos | **nenhum** |
| Tecnologia | 10 | chefes | 2 (`nucleo_de_energia`, `fragmento_divino`) |
| Minérios/exóticos | 30 | uma galáxia cada | 4 (g1, g4, g25, g27) |
| Essências | 10 | Provação | **as 10** |
| Orgânicos | 10 | missões | 5 |

Traduzindo para a experiência: **da galáxia 2 até a 24, quase tudo que o jogador
minera é peso morto.** E o evento — conteúdo com data marcada, feito para trazer
o jogador de volta — paga exclusivamente em moeda que não compra nada.

O que já funciona é instrutivo: as essências fecham 10 de 10 porque cada uma tem
UMA operação de modulação correspondente. É o desenho a copiar.

---

## As metas já estavam escritas

`data/balance/economia-recursos.ts` declara há tempos:

```ts
receitaGalacticaMinSetores: 8,    receitaGalacticaMaxSetores: 22,
receitaTecnologicaChefes: [12, 20],
modulacaoRepeticoesDaProvacao: [1, 3],
eventoOcorrencias: 1,
```

Ou seja: o orçamento de cada sumidouro **já foi decidido**. O que nunca existiu
foram as receitas. Nada abaixo inventa número — todos saem daí cruzados com
`quantidadeDeMaterialGalactico`.

Quanto o jogador junta do minério local, por setor, e o que isso permite cobrar:

| Galáxias | Por setor | Receita de 8 setores | Receita de 22 setores |
|---|---|---|---|
| 1–5 | 6,7 | 54 | 147 |
| 6–10 | 7,7 | 62 | 169 |
| 11–15 | 8,7 | 70 | 191 |
| 26–30 | 11,7 | 94 | 257 |

---

## Proposta — quatro sumidouros, 49 recursos cobertos

### 1. A conversão elemental passa a custar o minério DAQUELE elemento

**Cobre 27 minérios órfãos. É o maior buraco e o encaixe mais natural.**

Cada galáxia já tem um elemento, e o material-assinatura dela herda esse
elemento sem precisar de tabela nova:

| Elemento | Minérios |
|---|---|
| raio | 5 — Ferrita (g1), Ródio (g14), Níquel (g16), Manganês (g20), Grafeno (g24) |
| fogo | 5 — Pirita (g2), Lítio (g9), Neodímio (g11), Escória Estelar (g21), Aço Estelar (g27) |
| gelo | 5 — Diamantita (g3), Irídio (g7), Obsidiana (g8), Zircônio (g13), Tântalo (g18) |
| químico | 5 — Titânio (g4), Cromita (g12), Molibdênio (g17), Nanofibra (g23), Nanotubo (g26) |
| cósmico | 5 — Urânio (g5), Cristal Quântico (g25), Liga Celestial (g28), Fluxo Dimensional (g29), Matéria Escura (g30) |
| padrão | 5 — Platina (g6), Cobalto (g10), Vanádio (g15), Tecnécio (g19), Fragmento de Meteoro (g22) |

A tabela acima foi **remedida em 07/09**, depois de o elemento das galáxias
passar a sair de `data/elemento-da-galaxia.ts`. Antes ela era 8/7/6/4/3/2 —
consequência do rodízio por índice, não de desenho. Agora são cinco por
elemento, e o minério raso de cada um cai numa das **seis primeiras galáxias**:
Ferrita (raio, g1), Pirita (fogo, g2), Diamantita (gelo, g3), Titânio (químico,
g4), Urânio (cósmico, g5), Platina (padrão, g6).

`usarCargaNoItem` e `usarCargaNaNave` já existem e já convertem elemento. Hoje
custam uma **carga de serviço comprada na Loja** — e a Loja vai ser reformulada
inteira, então essa dependência é dívida de qualquer forma.

Proposta de custo, ancorada na tabela acima:

- **converter um ITEM**: ~1,5 setor do minério do elemento alvo → **10 a 18
  unidades**, conforme a galáxia de onde o minério vem. É operação rotineira, e
  precisa custar pouco.
- **converter uma NAVE**: a faixa baixa da receita galáctica → **54 a 94
  unidades**. É decisão estratégica e rara; deve doer.

**A trava que existia aqui morreu em 07/09.** Este parágrafo pedia decisão sobre
o minério de gelo existir só nas galáxias 12 e 18, o que tornava impossível
converter para gelo antes da 12. Com o elemento das galáxias reescrito, o
minério raso de **todos os seis** elementos cai nas seis primeiras galáxias — a
conversão para qualquer elemento fica disponível cedo, e a escada de custo
continua sendo o nível da peça.

A alternativa que eu havia listado — qualquer minério servir a qualquer elemento
com penalidade de 3× — fica descartada de vez: ela transformaria seis materiais
distintos num só com nomes diferentes, e agora nem resolve problema nenhum.

### 2. Os gases viram o combustível da recalibração

**Cobre os 10 gases.**

`recalibrationCost` cobra **só núcleos** hoje. Somar um custo em gás dá destino
à família inteira e amarra o evento a uma melhoria permanente de peça — sem
inventar sistema novo, que a regra do projeto proíbe.

O alvo escrito é `eventoOcorrencias: 1`: uma receita de evento deve custar **uma
ocorrência**. Os eventos pagam de 36 a 45 unidades, então cada recalibração
custaria **3 a 5 unidades de gás**, dando ~10 recalibrações por evento.

Qual gás? O do elemento da peça, se seguirmos o item 1 — ou o gás do evento
ativo, o que faz o evento da semana valer mais enquanto está no ar. **A segunda
opção é mais forte**: dá urgência ao evento sem precisar de recompensa maior.

### 3. A tecnologia de chefe vira item exclusivo

**Cobre os 8 tecnológicos órfãos.**

`data/balance/drops.ts` já tem o campo `exclusivos`, vazio, com o comentário
dizendo que existe justamente para cadastrar o primeiro exclusivo ser mudança de
DADO e não de motor. E `ITEM_SETS` já tem quatro conjuntos de cinco slots.

Um material de chefe → uma peça exclusiva, ao custo escrito de **12 a 20
chefes**. São 8 peças novas, e elas dão à Fabricação uma razão para existir
depois que o jogador tem equipamento bom: hoje ela só sobe raridade.

### 4. Os orgânicos órfãos entram nos conjuntos

**Cobre os 5 orgânicos restantes.**

Os outros 5 já fecham ciclo entre missões da mesma cadeia — o desenho existe e
funciona. Os 5 órfãos (`tecido_vorg`, `nucleo_organico`, `pele_quantica`,
`cristal_vivo`, `polpa_nebular`) pedem o mesmo tratamento: virar custo de
fabricação de peça de CONJUNTO, que é o conteúdo que os 4 `ITEM_SETS` já
descrevem e que nada hoje permite montar de propósito.

---

## O que isto NÃO propõe, e por quê

- **Nenhum sistema novo de poder.** A regra do projeto é explícita: a nave
  evolui por item, craft e Matriz, e só. Todos os quatro sumidouros acima são
  craft ou serviço sobre item existente.
- **Nada na Loja.** Ela vai ser reformulada inteira; apoiar economia nova nela
  seria construir sobre o que vai ser demolido.
- **Nenhuma receita para os 21 recursos que ainda não caem.** Reserva para
  conteúdo futuro é saudável — o problema é o que cai hoje e não tem destino.

---

## Ordem sugerida

1. **Conversão elemental** — maior buraco (27 materiais), mecânica já existe,
   tira a dependência da Loja.
2. **Gases na recalibração** — família inteira, uma fórmula só.
3. **Exclusivos de chefe** — mais trabalho, porque exige cadastrar 8 itens.
4. **Orgânicos nos conjuntos** — o menor, e o que mais depende de decisão de
   design sobre conjuntos.

---

# Adendo — a cadência dos eventos (decidida por Rafael, 07/09)

Os eventos passam a ter **três ritmos**: diário, semanal e mensal. Os diários
ligados a elemento. E entra um **evento diário de coleta por sequência de
login**.

Hoje existe um ritmo só: `DURACAO_EVENTO_MS = 72h`, dez eventos girando a partir
de `MARCO_DOS_EVENTOS`, uma volta completa em trinta dias.

## Por que isto melhora a proposta acima, e não só a complica

O item 1 tinha uma trava dura: o minério de gelo só existia nas galáxias 12 e
18, então converter uma peça para gelo antes da 12 era impossível. **A reescrita
dos elementos das galáxias em 07/09 já desfez isso** — o gelo começa na galáxia
3, como todo elemento começa numa das seis primeiras.

O evento diário elemental continua valendo, e por um motivo que sobrevive à
correção: cada diário paga o minério RASO do elemento que ele pede, num volume
que a mineração normal levaria dias para juntar. A escassez vira AGENDA, que é o
que um jogo idle sabe cobrar, e não bloqueio.

Isso também remove a necessidade da penalidade de 3× que eu tinha listado como
alternativa. Ela transformaria seis materiais distintos num só com nomes
diferentes; a agenda não.

## Desenho proposto

| Ritmo | Duração | Quantos | Paga em | Alimenta |
|---|---|---|---|---|
| **Diário** | 24 h | 6, um por elemento | minério daquele elemento | conversão elemental (item 1) |
| **Semanal** | 7 dias | os 10 atuais | gás | recalibração (item 2) |
| **Mensal** | 30 dias | 1, rotativo | tecnologia de chefe | exclusivos (item 3) |

O diário elemental gira em seis dias e fecha a semana; o semanal cobre a volta
de dez semanas; o mensal dá ao jogador de fim de campanha uma razão para voltar.
Cada ritmo alimenta um sumidouro diferente — nenhum compete com o outro.

## A sequência de login precisa de uma decisão de princípio

`economia-recursos.ts` afirma, em letras grandes:

> **O abate é a ÚNICA porta.** Todo recurso de jogo nasce aqui, e nada mais gera
> recurso.

E o arquivo conta que **duas fontes já foram fechadas** para chegar a isso: a
cápsula de moeda (que respondia por 57–62% de todo o núcleo e sucata) e a
patrulha (renda de fundo sem cena e sem decisão do jogador).

Uma recompensa por sequência de login é, por definição, recurso nascendo fora do
abate — a terceira fonte, com o mesmo formato das duas que foram removidas. Não
estou dizendo que não deve existir: estou dizendo que **é uma mudança de
invariante e precisa ser decidida como tal**, não introduzida de lado.

Duas formas de fazer, e elas não são equivalentes:

**A — a sequência dá ACESSO, não recurso.** O dia 7 abre uma incursão especial,
com o elemento do dia, que paga o minério pelo abate normal. A porta continua
sendo o abate; a sequência decide o que fica aberto. Não mexe no invariante, e a
recompensa continua sendo proporcional a jogar.

**B — a sequência paga direto.** Mais simples de fazer e mais imediato para o
jogador. Mas reabre exatamente o buraco que a cápsula e a patrulha abriam: renda
que não passa por decisão nenhuma, e que cresce sozinha com o calendário em vez
de com a habilidade.

**Recomendo A.** Ela entrega a mesma sensação — "voltei sete dias seguidos e
ganhei algo" — sem transformar o calendário numa fonte de economia paralela. E o
custo de implementação é parecido, porque a incursão especial reusa o modificador
que os eventos já sabem aplicar.
