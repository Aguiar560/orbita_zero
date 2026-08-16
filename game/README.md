# Órbita Zero

Idle de naves espaciais. A tela é dividida em três colunas:

- **Cockpit (esquerda)** — casco e escudo ao vivo, os nove componentes
  equipados, conjuntos ativos, leitura de combate, política do piloto e o
  rendimento da patrulha. É o estado que importa a cada segundo, sempre à vista.
- **Campanha (centro)** — a cena de combate, em retrato, contra ondas, elites e
  chefes. **Quem pilota é uma IA**; o jogador atua pelo loadout, pelas melhorias,
  pela matriz de passivas e pela política de pilotagem.
- **Painéis (direita)** — nove abas: nave, inventário, matriz, melhorias,
  hangar, baús, universo, códex e ajustes.

A **patrulha** continua rendendo sucata em segundo plano — virou uma renda
passiva lida no cockpit, sem cena própria, para liberar a tela inteira para o
combate.

---

## Como rodar

```bash
npm install
```

```bash
npm run assets
```

```bash
npm run dev
```

`npm run assets` lê os packs de arte **fora do projeto** (`../Jogando`,
`../parallax`, `../PNG_Animations`, …) e gera `public/assets/`. Os packs
originais nunca são modificados. Rode-o de novo sempre que a arte-fonte mudar;
`npm run build` já o executa antes de empacotar.

---

## Arquitetura

```
game/
├── tools/                 Pipeline de assets (Node + sharp), fora do bundle
│   ├── build-assets.mjs   Recorta, remove matte, empacota atlas, redimensiona
│   ├── espaco.slices.mjs  Mapa de recortes da folha-mestre `Espaço.png`
│   └── lib/               imaging (unmatte/trim/blit) + packer (skyline)
│
├── public/assets/         GERADO — atlas, parallax, planetas, manifest.json
│
└── src/
    ├── core/              Puro, sem DOM: math/RNG, pool, formatação de números
    ├── render/            Canvas 2D: Assets, Atlas, Surface, Anim, Parallax,
    │                      Particles. Não conhece regras de jogo.
    ├── sim/               A simulação. Dona do GameState e única porta de
    │                      escrita. Não conhece canvas nem DOM.
    ├── data/              Tabelas puras: cascos, inimigos, chefes, afixos,
    │                      melhorias, universos, biomas, baús, clipes
    ├── modes/
    │   └── vertical/      Camada de combate + PilotAI + WaveDirector
    ├── ui/                Interface em DOM (Shell + painéis)
    └── app/               Game (orquestrador), Loop, Bus, boot
```

A regra de dependência é de fora para dentro: `modes` e `ui` dependem de `sim`,
`sim` depende de `data` e `core`, e `render`/`core` não dependem de nada do
jogo. Isso é o que permite rodar a progressão inteira sem tela — como faz o
progresso offline.

### Decisões que valem explicação

**Uma simulação, dois caminhos.** A camada vertical roda ao vivo quando a aba
está visível e cai para `Sim.abstractTick()` quando não está. Os dois usam o
mesmo `Encounter` e a mesma condição de vitória: **o pool de vida do encontro
zera**. Ao vivo, cada golpe debita o pool (`applyDamage`); no abstrato, debita-se
`dps × tempo`. Por isso o ritmo de progresso não muda por causa de onde o
jogador está olhando.

**Progresso é creditado por dano, não por abate.** Se fosse por abate, o dano
em inimigos que escapam pela base sumiria e a barra ficaria parada enquanto o
jogador atira. Inimigos que escapam são repostos pelo `WaveDirector` até o pool
ser realmente cortado — sem isso, uma nave fraca demais para matar qualquer
coisa avançaria de setor só esperando a onda passar.

**Loot é físico.** `Sim.rollDrops()` rola o item no abate mas NÃO o entrega; a
cena materializa uma cápsula com o ícone e a cor da raridade, e o item só entra
no inventário quando a IA alcança a cápsula. Separar a rolagem da entrega é o
que permite um drop ser realmente perdido. O caminho abstrato (offline) entrega
direto, já que lá não existem cápsulas para coletar.

**O piloto de IA é um campo de forças.** `PilotAI` soma quatro vetores — desvio
de projéteis, posicionamento de tiro, coleta e limites de tela — e devolve uma
direção. O desvio usa *aproximação mínima* (quando e a que distância a bala vai
passar), não distância instantânea: repelir pela distância atual faria a nave
fugir de balas que já passaram e ignorar a que vai acertar em meio segundo. O
atributo `iaSkill` controla horizonte de previsão, raio de percepção, ruído do
comando e frequência de decisão (8 Hz no piloto cru, 60 Hz no treinado) — por
isso investir em pilotagem é visível na tela.

**Atributos somam multiplicadores, não os empilham.** A fórmula é
`(base + Σadd) × (1 + Σmul)`. Multiplicadores empilhados explodem cedo e
transformam qualquer item novo em "ou é o melhor de todos, ou é lixo".

**Saves migram, nunca são rejeitados.** `migrate()` preenche campos ausentes em
vez de recusar o arquivo: num idle, invalidar um save custa dias de progresso ao
jogador. Só um save de versão *futura* é recusado.

---

## Progressão

| Camada | Ganho | Uso |
|---|---|---|
| Patrulha | **Sucata** | melhorias comuns |
| Campanha | **Núcleos** | melhorias avançadas, desmanche |
| Chefes/baús | **Cristais** | cascos e baús da loja |
| Ascensão | **Éter** | nós de Legado, permanentes |
| Combate | **XP de comando** | pontos da Matriz |

### Matriz de Comando (árvore de passivas)

Uma matriz radial de ~180 nós no estilo Path of Exile: oito ramificações
(Artilharia, Cadência, Precisão, Perfuração, Blindagem, Defletor, Vetor,
Prospecção) saindo de um núcleo central, com cachos de nós menores em volta de
cada notável e **três anéis** que atravessam todas as ramificações.

Os anéis são o que torna a matriz uma árvore de *rotas* e não oito listas
paralelas: vale a pena desviar para um notável vizinho, e esse desvio custa
pontos. Cada patente de comando (XP de combate) concede um ponto.

- **Menores** — um atributo pequeno; são a "estrada" entre notáveis.
- **Notáveis** — pacote forte com identidade (Calibre Maior, Campo Harmônico…).
- **Nós-chave** — no fim de cada ramificação, transformadores e com preço:
  *Sobrecarga Terminal* (+120% dano, −40% cadência), *Barreira Perpétua*
  (+200% regeneração, −40% casco), *Fome de Relíquias* (+120% sorte, −30% dano
  e casco)…

Regras: um nó só pode ser alocado se encostar em algo já alocado; devolver um nó
só é permitido se o resto continuar ligado ao centro. Clicar num nó distante
aloca a **rota inteira** de uma vez (a menor, via busca em largura a partir da
fronteira). O painel é canvas com pan, zoom ancorado no cursor, busca e tooltip.

### Itens

Nove categorias × oito níveis de acabamento = **72 bases**, cada uma com ícone
próprio recortado de `Itens.png`. A base sorteada é limitada às três faixas mais
altas disponíveis no nível de item, então avançar de setor muda visivelmente o
que cai. Cinco raridades e **quatro conjuntos** (Vanguarda, Sobrevivente,
Aniquilador, Tecno Ancestral) com bônus em 2 e 4 peças — cada conjunto cobre
cinco slots, então vesti-lo inteiro custa metade dos encaixes.

- **Setor** = 5 ondas + 1 encontro final. A cada 10 setores, um **chefe** com
  fases próprias (padrão de tiro, invocação e aviso de transição).
- **Universo** é o prestígio. Requer o setor `30 + 12·índice`. Reinicia setores,
  recursos, melhorias e equipamento; preserva Éter, nós de Legado, hangar,
  códex e itens marcados como favoritos. Cada universo sorteia modificadores
  (mais vida inimiga, projéteis mais rápidos, mais sorte…) de forma estável a
  partir da semente.
- **Itens** têm 6 slots, 6 raridades e afixos rolados por nível de item.
  Auto-equipar compara o **ganho de poder real** (resolve os atributos com e sem
  o item), não uma heurística de raridade.

---

## Assets

Toda a arte vem dos packs em `D:\bbb`. O pipeline:

1. Recorta a folha-mestre `Jogando/Espaço.png` (naves, inimigos, tiros,
   explosões, obstáculos, power-ups, HUD e a coluna de nebulosa do fundo).
   As caixas em `espaco.slices.mjs` são folgadas de propósito — o auto-trim
   acha o conteúdo real.
2. Recorta `Jogando/Itens.png` — 72 ícones de componente, 9 placas de upgrade
   (que viram os nós da matriz), glifos de slot, hexágonos de raridade e os
   ícones dos conjuntos. As colunas **não** são uniformes (a moldura cresce com
   a raridade, de 60 a 88 px); as bordas em `itens.slices.mjs` foram medidas por
   detecção de coluna. Cada célula é recuada 9 px para descartar a moldura
   colorida: gravá-la no sprite travaria cada ícone a uma raridade só.
3. Fatia as folhas arcade (`*-0001.png`) — naves, inimigos, chefes, projéteis,
   bônus, asteroides, minas, barreiras e explosões. Várias não são grades
   regulares (os quadros de explosão crescem, os asteroides vêm em três
   tamanhos), então `rowComponents()` detecta cada sprite por coluna vazia
   dentro da sua faixa.
4. **Remove a matte** desfazendo a composição sobre o fundo azul-escuro das
   folhas (`src = (out − bg·(1−a)) / a`). Sem esse passo os sprites ficariam com
   halo escuro nas bordas quando desenhados sobre o espaço.
5. Empacota em atlas por skyline: `espaco`, `itens`, `arcade`, `fleet`
   (SpaceRage), `hull` (naves de perfil) e `drone`.
6. Redimensiona o parallax para 220 px de altura, copia as seis camadas
   tileáveis de 320 px do céu e sobe os planetas do PlanetPack com
   vizinho-mais-próximo.

Resultado: ~3,2 MB de assets e ~137 kB de JS.

---

## Frotas

O bestiário vem do pack **Foozle Void**: três frotas (Kla'ed, Nairan, Nautolan)
× oito classes (batedor, caça, bombardeiro, fragata, torpedeiro, suporte,
cruzador, encouraçado) = **24 inimigos**, gerados em `src/data/fleets.ts` a
partir de duas tabelas pequenas — a CLASSE define comportamento e forma, a FROTA
define tempero e faixa de setor. Escrever os 24 à mão seria repetitivo e fácil
de dessincronizar.

Cada nave é montada em camadas em tempo de desenho: escape atrás do casco, arma
e escudo por cima. Isso permite piscar só o casco no dano, animar a arma apenas
quando o disparo está próximo e pulsar só o escudo dos elites. A morte usa a
animação de destruição própria daquele modelo, não uma explosão genérica.

A nave do jogador segue a mesma ideia e ainda **troca de arte conforme o dano**
(quatro estados de casco) — dá para ver a nave se despedaçando sem olhar a barra.

## Modo de teste

Em **Ajustes → Modo de teste**: recursos e pontos de matriz infinitos, hangar
inteiro liberado, nave indestrutível, velocidade de 1× a 8×, salto de setor,
loot e baús instantâneos. O save continua o mesmo — é um interruptor, não um
perfil separado.

A velocidade multiplica repetindo o passo fixo por quadro, e não esticando `dt`:
a IA e a detecção de colisão dependem de um passo constante para não falhar.

## Inventário da arte

```bash
npm run assets:organizar
```

Gera `D:\bbb\arte\` — uma **árvore paralela de hard links** que separa a arte
por categoria e por uso:

```
arte/
├── usado/         arte que o pipeline realmente abriu
│   ├── 00-folhas-mestre/        08-itens/
│   ├── 01-naves-jogador/        09-coletaveis/
│   ├── 02-naves-inimigas/       10-cenario/
│   ├── 03-chefes/               11-planetas/
│   ├── 04-projeteis/            12-fundos/
│   ├── 05-explosoes/            13-interface/
│   ├── 06-motores-e-rastros/    14-personagens/
│   ├── 07-escudos/              15-parallax/
│   └── 99-outros/
├── nao-usado/     mesma divisão, para o que nenhum sprite consome
├── INVENTARIO.md  relatório com totais por categoria e sobras por pack
└── inventario.json
```

Duas decisões que valem explicação:

**A lista de "em uso" é medida, não adivinhada.** O pipeline registra cada
arquivo que abre (`lib/imaging.mjs` → `readPaths`) e grava em
`.assets/lidos.json`. A auditoria só cruza essa lista com o que existe nas
pastas. Tentar inferir pelo nome erraria toda vez que a lógica de seleção
mudasse.

**São hard links, não cópias.** A arte crua soma ~293 MB; copiar dobraria isso
sem motivo, e link simbólico no Windows exige privilégio de administrador. Com
hard link o mesmo arquivo aparece nos dois lugares ocupando espaço uma vez só.
Os originais continuam nos packs — é de lá que o pipeline lê —, então **apagar
algo em `arte/` não apaga o original** e não quebra o build.

Estado atual: **752 arquivos em uso (73 MB) · 1206 sem uso (220 MB)**. O grosso
das sobras é PSD, licença e variantes de tile que nunca entraram no jogo.

## Ferramenta de desenvolvimento

Em `vite dev`, `POST /__snap` grava um quadro do canvas em `.snapshots/`.
Com `window.oz.debugStep(frames)` dá para avançar o jogo de forma determinística
e capturar um quadro específico — útil porque a camada de render é canvas puro e
não dá para inspecionar pelo DOM.

```js
oz.debugStep(600);                        // 10 s de jogo
oz.debugSim.state.run.sector;             // estado da simulação
```

---

## Ajustes de balanceamento

Tudo o que define ritmo está concentrado e comentado:

- `src/sim/progression.ts` — curvas de vida (`1.235^setor`), dano
  (`1.105^setor`) e recompensa por setor.
- `src/data/upgrades.ts` — custo base e fator geométrico de cada melhoria.
- `src/data/universes.ts` — dificuldade/recompensa por universo e a fórmula de
  Éter.
- `src/data/enemies.ts` / `bosses.ts` — arquétipos, padrões e fases.
- `src/data/tree.ts` — ramificações da matriz, notáveis, nós-chave e geometria
  (raios da espinha, posição dos anéis, tamanho dos cachos).
- `src/sim/tree.ts` — curva de XP por patente e regras de alocação.
- `src/data/items.ts` — bases por slot, implícitos, afixos e conjuntos.
