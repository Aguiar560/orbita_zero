# Atualização de desenvolvimento — 25/08/2026

Registro consolidado do dia. Este arquivo é o retrato de implementação; para a
direção futura consulte [`PLANO.md`](PLANO.md), para as telas
[`TELAS.md`](TELAS.md), para os sistemas por dentro [`SISTEMAS.md`](SISTEMAS.md)
e para a arquitetura permanente [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

**Estado ao fechar:** 571 testes (570 + 1 `todo`) em 33 arquivos · build limpo ·
save **v9** · 53 cascos · 4 personagens jogáveis.

O dia teve cinco frentes: **equipamento por nave e a coluna de anatomia**,
**escolha de personagem**, **ajustes em abas**, **densidade das ondas** e
**posturas de IA**. Quatro versões de save (6 → 9) e três sistemas novos.

---

## 1. Equipamento por nave, e a coluna de anatomia

### O equipamento passou a ser por casco (save v7)

Era um conjunto único no topo do estado. Virou `naves[id].equipped`: cada casco
carrega o próprio. É o que faz manter uma frota significar alguma coisa — antes,
trocar de nave levava o equipamento junto e a frota era só uma ficha diferente.

A migração leva o conjunto antigo para a nave em uso e apaga o campo do topo.
Verificado behaviour-neutral: as quatro medições de ritmo são idênticas antes e
depois.

Um defeito no caminho, dos silenciosos: `equipamentoDe` devolve `?? {}` quando a
nave não tem registro — um objeto **fora do estado**. A régua escrevia nele e
perdia o conjunto inteiro; o setor 170 saltou de 29s para 7.995s. Separado em
`equipamentoDe` (leitura) e `naveDe` (escrita, que cria o registro).

### A coluna de anatomia

Dez soquetes ao redor de um chassi, na ordem anatômica — armas na proa, asas e
escudo no meio, motor e utilitários na popa. Tem seletor de nave porque o
equipamento é por casco: sem ele não haveria onde montar o conjunto de uma nave
fora de campo.

Equipamento e conjuntos **saíram do trilho esquerdo**. Com o conjunto sendo por
nave, o trilho mostraria o da nave em campo enquanto a anatomia mostra a que se
está montando — duas leituras divergentes do mesmo dado na mesma tela.

Ela nasceu como quarta trilha de grid e **não deu certo**, por dois motivos que
só aparecem medindo:

1. Trilha de grid é retângulo de altura cheia. O cartão tem 357px de conteúdo;
   os outros 311 ficavam reservados sem nada dentro.
2. A largura saía do PALCO. Com 300px numa janela de 1280 o campo lógico batia
   **exatamente** no piso de 480.

| | trilha | sobreposta |
|---|---|---|
| palco aberta / fechada | 384 / 634 | **634 / 634** |
| campo lógico em 1280 | 552 | **908** |
| reservado e vazio | 250 × 311 | nenhum |
| abrir e fechar | evento de layout | não toca no layout |

### Quatro defeitos de layout, e o terceiro é o interessante

**A alça não era clicável.** Fica fora da caixa por definição, e o
`overflow: hidden` estava no `<aside>`. Medido: a alça em x=638 com a coluna
começando em 652, e quem respondia ao clique era o painel atrás.

**`#app` declarava `grid-template-rows` e não declarava colunas.** A trilha
implícita era `auto`, que dimensiona pelo conteúdo — bastou o canvas ficar mais
largo que a tela por um instante para a raiz travar em 1.350px numa janela de
1.280 e não voltar. **Terceira vez** que essa armadilha aparece, depois dos
174px de rolagem em Missões e da coluna do meio da Galáxia.

**O palco não sabia que tinha mudado de tamanho.** Só recalculava em `resize` da
janela, e abrir a coluna não é resize. Ganhou um `ResizeObserver`.

**A alça cruzava o HUD da onda.** Lendo os pixels do canvas: "SETOR 5" em
y=10..17, "Onda 6" em y=26..30, alça em y=22..86. O recuo **não** virou um
número de pixels: `VIEW.h` é fixo em 960 e o canvas ocupa a altura toda, então
a escala é `altura / 960` e o HUD desce junto com a janela. Medido, 40px fixos
dariam 20px de folga em 720 e **4px em 1080**. O recuo ficou nas mesmas unidades
lógicas do HUD.

---

## 2. Escolha de personagem (save v8)

Quatro personagens na primeira tela — nome, raça, galáxia, descrição — e o que
pesa é só a nave de partida.

| | raça | casco | elemento | dps | vida ef. | nota |
|---|---|---|---|---|---|---|
| VEKTOR-9 | Sintético | Núcleo Vektor | Raio | 22,1 | 215 | 87,27 |
| DARIN KOSS | Humano | Lança Rubra | Fogo | 25,2 | 193 | 88,30 |
| SORA VEY | Humana | Baluarte Glacial | Gelo | 18,8 | 251 | 87,08 |
| NHARU | Ser cósmico | Sopro Astral | Cósmico | 22,7 | 193 | 86,93 |

**1,58% de dispersão** na nota com 34% de diferença em dps e 30% em vida
efetiva. Os stats foram RESOLVIDOS para isso, por bisseção sobre `powerScore`,
não escritos à mão.

Raça e origem não tocam em número nenhum, e isso é decisão: o `CLAUDE.md` proíbe
fonte de poder fora de item, craft e Matriz — bônus de piloto seria a quarta.

O casco do personagem é **1,10×** o genérico. Se empatasse, o jogador trocaria
pelo Aurora no primeiro minuto e a escolha morreria ali. O teto veio de medição:
com 1,15× o setor 1 dava **90,8 golpes** de sobrevivência contra o teto de 90 do
§2, e a régua reprovava a introdução por mansa demais.

### Três defeitos que a verificação pegou

**A tela dizia que uma escolha era pior.** Com só DANO e RESISTÊNCIA o Sopro
Astral aparecia **dominado** — mesma vida efetiva da Lança Rubra e menos dano —
porque a vantagem dele é velocidade, que `powerScore` conta como esquiva e
`effectiveHp` não mostra. Com o terceiro eixo, ninguém é dominado:

```
VEKTOR-9    DANO=60%  RESISTÊNCIA=49%  VELOCIDADE=18%
DARIN KOSS  DANO=100% RESISTÊNCIA=18%  VELOCIDADE=18%
SORA VEY    DANO=18%  RESISTÊNCIA=100% VELOCIDADE=18%
NHARU       DANO=68%  RESISTÊNCIA=18%  VELOCIDADE=100%
```

**Fechar a aba na tela escolhia por você.** `pagehide` grava `piloto: ''`, e a
migração promovia string vazia ao padrão. Ausente e vazio são casos diferentes:
ausente é save de antes da tela e recebe o padrão; vazio é escolha não concluída
e traz a tela de volta.

**Os retratos vinham vazios.** O atlas `characters` é `lazy` no manifesto e a
tela roda antes de qualquer painel abrir. `mostrar()` passou a aguardá-lo.

### Arte: eram duas naves, não quatro

`ship/aurora_a..d` são a MESMA nave azul em quatro variações e `ship/ignis_a..d`
a mesma vermelha — foram escolhidas pelo id, não pela arte. Uma folha de contato
dos 17 sprites disponíveis resolveu, e os cascos que já usavam as silhuetas
distintas cobriam exatamente os quatro elementos necessários.

No caminho, o casco **errado** foi trocado: `replace` pega a primeira ocorrência,
e `aurora1` tem o mesmo bloco de arte do `nucleo_vektor` e vem antes no arquivo.
Nenhum teste pegou — nenhum afirma o sprite de um casco. Quem pegou foi a
leitura do DOM.

O retrato da Nharu vinha com fundo opaco; arte crua atualizada e pipeline
reprocessado (35,5% de pixels transparentes, cantos em alfa 0, conferido sobre
vermelho e sobre branco).

---

## 3. Ajustes em cinco abas (save v9)

Era uma página com seis seções empilhadas. O custo aparecia na hora de PROCURAR.

| Aba | O quê |
|---|---|
| **Jogabilidade** | piloto · bolha de escudo · repetir fase · automação · teto offline |
| **Vídeo** | reduzir efeitos · tremor de tela · números de dano · alto contraste |
| **Áudio** | volumes — **inertes**, ver abaixo |
| **Dados** | resumo da partida · exportar/importar · apagar |
| **Teste** | modo de teste · velocidade · saltos · concessões |

Ordem por frequência de uso. Teste em último também por ser destrutivo de
percepção. A aba visível mora na instância, não no save: é onde o jogador
estava, não uma preferência.

**Dois ajustes novos.** A bolha de escudo já tinha interruptor, mas só dentro do
Laboratório — agora vale para o jogo todo (medido: 365 pixels azuis e brilho
46,0 ligado, contra 74 e 20,9 desligado). O tremor de tela ficou separado de
"reduzir efeitos" porque atinge gente diferente: efeito pesa na MÁQUINA, tremor
pesa em quem sente enjoo de movimento (verificado forçando `shake = 20`: 5.346
desligado contra 122.803 ligado, 23× maior).

**A aba de Áudio diz que não funciona.** O jogo não tem som — nenhum `Audio`,
`AudioContext` ou arquivo, confirmado por busca. Esconder a aba faria o jogador
procurar volume onde não há; mostrar controles mudos o faria mexer achando que
ajustou. Os sliders ficam `disabled`, um aviso âmbar explica, e os valores são
persistidos para quando o som existir.

**Duas configurações mortas na auditoria:** `barVisible` (declarada,
inicializada, migrada, nunca lida — sobra da faixa horizontal removida) foi
apagada; `muted` (também nunca lida) ficou, mas dentro do grupo de áudio.

---

## 4. Ondas dez vezes mais cheias

O começo do jogo estava vazio e acabava antes de começar. Medido: **o setor 1
inteiro em 4,0 segundos**, com ondas de 2 a 5 inimigos.

| | antes | depois |
|---|---|---|
| ondas do setor 1 | 2 · 5 · 5 · 5 · 5 · 3 | 23 · 50 · 51 · 50 · 51 · 15 |
| total do setor 1 | 25 | **240** |
| setor 1 completo | 4,0 s | **70,1 s** |
| `DENSIDADE_INICIO` | 5 | 50 |
| `DENSIDADE_FIM` | 20 | 90 |

10× no setor 1 e 4,6× no 300. No jogo: 121 inimigos na onda 1, tela enchendo de
4 para 26 ao longo de vinte segundos.

**Três coisas tiveram de acompanhar**, cada uma por um motivo diferente:

- **A XP não pode seguir a contagem.** É fixa por abate, então 10× inimigos
  seriam 10× XP. Agora o abate divide um ORÇAMENTO da onda; a curva antiga ficou
  congelada em `densidadeParaXp` como referência. Verificado: XP bruta idêntica
  (setor 1: 1,424; setor 3: 3,247).
- **A pressão também é por cabeça.** Sem dividir, 10× inimigos seriam 10×
  projéteis. O que a onda cospe por segundo continua o mesmo.
- **O caminho abstrato precisou aprender a entrada.** Limparia o setor 1 em 0,4s
  contra os 70s ao vivo — ficar offline viraria o jeito rápido de progredir.

**Um bug latente virou alcançável:** o pool tem teto e `spawn` devolve `null`
quando enche, mas o director avançava o cursor mesmo assim — o resto do grupo
sumia do cronograma e a onda ficava devendo inimigos que nunca viriam.

**O custo, que não foi escondido:** a vida mínima do setor 3 caiu de 90% para
52%, e o setor 5 passou de 36% e nenhuma morte para **0% e três mortes**. Fica
como ponto a vigiar — mexer em `curvaDano` para acomodar densidade misturaria
dois sistemas calibrados separadamente.

---

## 5. Três posturas de IA

|  | evade | aggression | greed | standoff |
|---|---|---|---|---|
| **agressivo** | 0,75 | **1,60** | 0,50 | 0,62 |
| **evasivo** | **1,90** | 0,55 | 0,60 | 0,85 |
| **coletor** | 1,10 | 0,70 | **2,00** | 0,76 |
| ~~equilibrado~~ | ~~1,15~~ | ~~1,00~~ | ~~0,80~~ | ~~0,74~~ |

O equilibrado **dominava o coletor em dois dos três eixos** e não era extremo em
nenhum. Uma opção assim não se escolhe, se aceita.

Padrão e migração são decisões diferentes: save novo nasce `agressivo` (é o que
se espera de um jogo de nave, e o começo aguenta — 83% de vida ao fim do setor
1); save que usava o equilibrado cai em `evasivo`, porque migração silenciosa não
pode aumentar o risco de quem está com a aba fechada.

A faixa dos botões ainda declarava `repeat(4, 1fr)` — 59px de buraco no fim.
Trocada por `grid-auto-flow: column`, que cria uma trilha por filho.

---

## Arquivos novos

| Arquivo | O quê |
|---|---|
| `src/data/pilotos.ts` | Os quatro personagens jogáveis |
| `src/ui/Anatomia.ts` | A coluna do "boneco" da nave |
| `src/ui/EscolhaDePiloto.ts` | A primeira tela |
| `tests/pilotos.test.ts` | Equilíbrio dos quatro e migração da escolha |
| `tests/equipamento-por-nave.test.ts` | Separação de conjuntos entre cascos |
| `tests/ajustes.test.ts` | Migração de preferências e limites de volume |
| `tools/optimize-anatomia-icons.mjs` | Recorte e WebP dos ícones da anatomia |
| `art-source/ui/anatomia/*` | 13 peças de arte da HUD de anatomia |

## Versões de save

| Versão | O quê |
|---|---|
| **7** | `naves[id].equipped` — equipamento por casco |
| **8** | `piloto` — o personagem escolhido |
| **9** | `mostrarEscudo`, `tremorDeTela`, volumes; `barVisible` removido |

## O que ficou aberto

- **Restrição elemental de itens.** Medido e não implementado: se a nave só
  aceitar item neutro ou do próprio elemento, o Divino fica inutilizável **78%**
  das vezes e trocar o elemento invalida 88% de um conjunto lendário. A
  alternativa medida — restringir só **principal + escudo** — deixa o Divino
  usável em 84% e a troca custando no máximo 2 peças. Decisão pendente.
- **Setor 5** depois do adensamento (ver acima).
- **Arte do slot secundário** da anatomia — o único dos dez que não veio; some
  sozinha em vez de virar ícone quebrado.
- **Pressão por inimigo em 0,04** no setor 1: o total está certo, mas um inimigo
  que quase nunca atira pode parecer quebrado. A vigiar.
