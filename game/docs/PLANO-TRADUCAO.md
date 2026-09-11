# Plano de tradução para o inglês

11/09/2026. Plano completo para o jogo inteiro em inglês, **mantendo o
português como está**. Nada daqui foi implementado ainda: este documento é a
especificação que as sessões e os agentes seguem.

Objetivo em uma linha: **todo texto que o jogador lê existe em inglês, sem
regressão para quem joga em português, com o menor gasto de tokens possível.**

---

## 1. A medida (o tamanho do trabalho)

Contado no código em 11/09 com a heurística de `tools/lib/textos.ts` (fase 0).
É aproximado: conta alguns textos de admin que não serão traduzidos.

| Área | Textos | Únicos | Com valor dentro (`${}`) | Palavras |
|---|---:|---:|---:|---:|
| `data/` (missões, lore, naves, itens, chefes, tutoriais) | 3.298 | 3.146 | 107 | 18.734 |
| `ui/panels/` | 1.222 | 1.123 | 306 | 3.471 |
| `wiki/` | 358 | 332 | 78 | 2.909 |
| `ui/` (resto) | 702 | 623 | 165 | 2.384 |
| `app/` | 246 | 153 | 59 | 549 |
| `sim/` | 138 | 110 | 30 | 303 |
| `modes/` (texto do combate, no canvas) | 73 | 68 | 25 | 116 |
| **Total** | **~6.060** | **~5.580** | **~790** | **~28.500** |

Maiores arquivos: `data/missoes-sementes.ts` (970), `wiki/WikiApp.ts` (358),
`data/lore.ts` (267), `data/provacao-chefes.ts` (228), `ui/Shell.ts` (201, 54
com valor).

Por onde o texto sai **fora** de `h()` — cada um precisa de tratamento próprio:

| Caminho | Ocorrências |
|---|---:|
| Texto desenhado no canvas (`.text(`, `fillText`) | 29 |
| `textContent =` direto | 26 |
| `toLocaleString('pt-BR')` e afins | 12 |
| `alert` / `confirm` / `prompt` | 7 |
| `innerHTML` | 6 |
| `document.title` | 1 |
| Wiki: HTML montado em string (não usa `h()`) | o arquivo todo |

73 testes leem código-fonte; 20 asserções em 10 arquivos contêm texto em
português literal. Converter chamadas pode quebrar alguns — ver §7.

---

## 2. Arquitetura (decidida)

### O português é a chave

Não há chaves abstratas (`inventario.titulo`). O texto em português **é** a
chave do dicionário, e o dicionário diz o inglês:

```ts
// src/i18n/en/ui-base.ts
export const UI_BASE = {
  'Inventário': 'Inventory',
  'Nível atual de {nome}': 'Current level of {nome}',
};
```

Por quê: (1) texto sem tradução cai no português, nunca numa chave crua na
tela — tradução incompleta fica feia, mas não quebrada; (2) o código continua
legível em português; (3) a migração é gradual e cada lote pode ir para
produção sozinho.

### Onde a tradução acontece

- **`h()` traduz sozinho** (`ui/dom.ts`): o valor de `text`, os filhos em
  texto, `title` (vira tooltip) e os atributos `aria-label`, `placeholder` e
  `alt` passam por `tr()`. É por isso que a maior parte das ~5.000 strings
  **fixas** fica traduzida sem editar a tela.
- **Texto com valor dentro** vira molde: `t('Galáxia {n} · {nome}', { n, nome })`.
- **Texto fora de `h()`** (canvas, `textContent`, `alert`, `confirm`) chama
  `tr()`/`t()` explicitamente.

### A API (`src/i18n/index.ts`)

| Função | Uso |
|---|---|
| `tr(texto)` | Tradução exata. Aceita a forma em MAIÚSCULAS de uma chave e devolve em maiúsculas. Preserva espaço nas pontas. Sem tradução, devolve o próprio texto. |
| `t(molde, valores)` | Traduz o molde e substitui `{x}`. Valor de **texto** também passa por `tr()` (nome de nave dentro da frase sai traduzido). Número entra como está. |
| `cru(texto)` | Marca um valor que **nunca** se traduz: apelido de jogador, código, número já formatado em texto. Sem isto, um jogador chamado "Raio" viraria "Lightning". |
| `tc(contexto, texto)` | Mesma palavra, sentidos diferentes. Procura primeiro a chave `contexto\|texto`. Ex.: `tc('elemento', 'Padrão')` → "Neutral", enquanto a opção de ordenação `'Padrão'` → "Default". |
| `idiomaAtual()`, `trocarIdioma(i)`, `localeAtual()` | Idioma da página; trocar grava e recarrega; `'pt-BR'`/`'en-US'` para datas e números. |

### O idioma

- Decidido **uma vez por carregamento**. Trocar recarrega a página. As tabelas
  de `data/` montam texto na importação, e recarregar é o que garante que tudo
  mudou.
- Ordem: a escolha do jogador (Ajustes → Interface; guardada neste
  navegador) → senão o navegador: nenhum idioma com `pt` → inglês.
- Fora do navegador (Worker, testes) é **sempre português**.

### O dicionário só vai para quem joga em inglês

- `src/i18n/carregar.ts` faz `import('./en')` e é aguardado em `main.ts`
  **antes** de importar o jogo ou a wiki. Quem joga em português não baixa nada.
- `src/i18n/index.ts` **não pode importar** `./en`: `data/` depende dele, e o
  Worker importa `data/`. O dicionário iria parar dentro do servidor. Há teste
  para isso.
- Um arquivo por área em `src/i18n/en/` (`ui-base`, `ui-telas`, `dados-nomes`,
  `dados-missoes`, `dados-lore`, `wiki`…), juntados em `en/index.ts`.

### O que continua como está

- O servidor não muda. Ele devolve códigos (`sem_apelido`), e o cliente já os
  converte em frase (`app/conta.ts MENSAGENS`, `compras.ts motivoLegivel`). As
  frases entram no dicionário como qualquer outra.
- Nomes dos itens saem do `baseId` (`sim/loot.ts itemName`), então traduzir não
  exige migrar save. Exceção: `item.exclusivo.nome` fica gravado no item. Casa
  por igualdade no dicionário, então funciona igual.
- `ui/nomes-proprios.ts` (proteção contra o tradutor do navegador) passa a
  rodar só quando a interface está em português num navegador estrangeiro. Em
  inglês os nomes já vêm traduzidos pelo próprio jogo.
- `ui/AvisoDeIdioma.ts` muda de texto. Em inglês vira "English version in
  progress", com um botão **Português** para o brasileiro de sistema em inglês.
  Some na fase 5, quando a cobertura fechar.

Há um rascunho desta arquitetura (núcleo `i18n/`, gancho no `h()`, seletor,
aviso e ferramenta) salvo fora do repositório. A fase 0 pode partir dele, mas
tudo precisa ser revisado e testado: ele nunca rodou.

---

## 3. Quem faz o quê (modelos)

Regra geral, da política do projeto (§49): **Opus decide e revisa, Sonnet
executa o que está especificado.** Aqui isso vira:

| Trabalho | Modelo / agente | Por quê |
|---|---|---|
| Fase 0 inteira: arquitetura, testes, ferramenta, glossário, guia de estilo, tela-modelo | **Opus** (sessão principal) | É decisão e contrato: tudo o que vem depois copia o que sair daqui. Erro aqui se multiplica por 30 lotes. |
| Converter texto com valor em molde (`t()`), canvas, `textContent`, `alert` | **Sonnet** — agente `implementer` | Refatoração local com regra fechada (§5) e exemplos. |
| Traduzir strings (dicionário) | **Sonnet** — agente `content-data-agent` | Texto é nível 1. O agente lê só a lista extraída e o glossário, nunca o código. |
| QA no navegador (telas em inglês, texto cortado, faltas em execução) | **Sonnet** — agente `tester` | Roteiro fechado (§6). |
| Revisão de fim de fase | **Opus** — agente `code-reviewer` | Lê o diff por amostragem e os números da ferramenta, não o dicionário inteiro. |
| Decisões de nome e termos ambíguos | **Opus**, com aprovação do Rafael | Ver §8. |

**Por que não Haiku.** O maior custo não é traduzir (~28.500 palavras viram
~80 mil tokens de saída somando chave e valor), é ler código para converter
~790 moldes. Haiku economizaria pouco em valor absoluto e erraria no que o
jogador vê. A economia de verdade vem de **não ler o que não precisa** (§4).

---

## 4. Como gastar poucos tokens

1. **Tradutor não lê código.** Recebe a saída de
   `node tools/run-ts.mjs tools/i18n.ts --json <arquivos>` (só as strings que
   faltam, com linha) mais o glossário. Devolve um arquivo de dicionário. Nada
   de abrir `Shell.ts` para traduzir `'Inventário'`.
2. **Conversor lê só as linhas marcadas.** A ferramenta marca os moldes com
   `D` e a linha. O `implementer` usa `Read` com `offset`/`limit` em volta de
   cada uma (±6 linhas), nunca o arquivo inteiro. `Shell.ts` tem mais de 1.000
   linhas.
3. **Lotes pequenos e de contexto limpo.** Tradução: até ~400 strings ou ~3.000
   palavras por agente. Conversão: até ~60 moldes ou 3 arquivos por agente.
   Cada lote é uma chamada nova; nada de um agente arrastando 30 lotes de
   contexto.
4. **Paralelo onde não há arquivo em comum.** Lotes de tradução escrevem
   arquivos de dicionário diferentes e podem rodar juntos, em segundo plano.
   Lotes de conversão só em paralelo se os arquivos forem disjuntos.
5. **O agente devolve números, não arquivos.** O retorno segue o §51 do
   `CLAUDE.md`: arquivos alterados, contagem antes e depois da ferramenta,
   testes rodados, bloqueios. O Opus não relê o que foi escrito; confere pelos
   testes e por amostra.
6. **Verificação por máquina, não por modelo.** Os testes do §7 pegam
   placeholder quebrado, português esquecido, chave duplicada e regressão de
   cobertura sem gastar um token de revisão.
7. **Glossário curto e fixo.** Um arquivo (`src/i18n/GLOSSARIO.md`, ~150
   linhas) lido uma vez por lote. Resolver termo por termo em cada lote é o que
   mais desperdiça, e o que gera inconsistência.

---

## 5. Regras de conversão (para o `implementer`)

Toda regra tem exemplo. O que não se encaixa em nenhuma → **parar e devolver ao
Opus**, sem improvisar.

| Antes | Depois |
|---|---|
| `` text: `Galáxia ${n}` `` | `text: t('Galáxia {n}', { n })` |
| `` `${n} ${n === 1 ? 'item' : 'itens'}` `` | `t(n === 1 ? '{n} item' : '{n} itens', { n })` — as duas chaves vão para o dicionário |
| `` `${a} · ${b}` `` (só junta valores) | `t('{a} · {b}', { a, b })` |
| `` `Olá, ${apelido}` `` | `t('Olá, {apelido}', { apelido: cru(apelido) })` |
| `` `${fmt(x)} sucata` `` | `t('{x} sucata', { x: fmt(x) })` — número formatado não casa no dicionário e passa intacto |
| `` `${info.name.toUpperCase()} OBTIDO` `` | `t('{r} OBTIDO', { r: info.name.toUpperCase() })` — `tr()` resolve a forma maiúscula |
| `surface.text(`SETOR ${n}`, …)` (canvas) | `surface.text(t('SETOR {n}', { n }), …)` |
| `surface.text('VITÓRIA', …)` (canvas, fixo) | `surface.text(tr('VITÓRIA'), …)` |
| `el.textContent = 'Enviando…'` | `el.textContent = tr('Enviando…')` |
| `confirm('Apagar tudo?')` | `confirm(tr('Apagar tudo?'))` |
| `toLocaleString('pt-BR', …)` | `toLocaleString(localeAtual(), …)` |
| palavra de dois sentidos | `tc('contexto', 'Padrão')`, e a entrada `'contexto\|Padrão'` no dicionário |

Proibido: mudar ids, lógica, ordem de elementos ou classes CSS; traduzir
comentário; mexer em `server/`; reformatar código. **O literal em português
fica no código** (é a chave), e só o que está em volta dele muda.

`sim/` e `data/` podem importar `src/i18n/index.ts`: ele não conhece DOM. No
Worker, `t()` devolve português.

---

## 6. Guia de estilo e glossário (para o `content-data-agent`)

**Guia de estilo** (vai no topo de `GLOSSARIO.md`):

- Inglês americano. Tom de cockpit militar: curto, direto, sem floreio.
- Botões e rótulos: no máximo ~20% mais longos que o português. Se não couber,
  escolher a palavra mais curta, não abreviar com ponto.
- MAIÚSCULAS no português → MAIÚSCULAS no inglês. Título com inicial maiúscula
  segue a regra do inglês (Title Case em título de tela, frase normal no resto).
- Placeholders `{x}` idênticos e na posição que o inglês pede.
- Símbolos, emoji, `·`, `×`, `→`, números e unidades ficam como estão.
- Termo do glossário é obrigatório. Termo que não está nele e se repete →
  anotar no retorno para o Opus decidir; não inventar.
- Lore e missões: preservar o tom e as falas entre aspas; é narrativa, não
  manual.

**Glossário-semente** (a fase 0 completa e o Rafael aprova antes da fase 1):

| Português | Inglês | | Português | Inglês |
|---|---|---|---|---|
| Sucata | Scrap | | Setor | Sector |
| Núcleo (moeda) | Core | | Onda | Wave |
| Cristal | Crystal | | Chefe | Boss |
| Casco | Hull | | Galáxia | Galaxy |
| Piloto | Pilot | | Afixo / Prefixo / Sufixo | Affix / Prefix / Suffix |
| Matriz | Matrix | | Modulação | Modulation |
| Fabricação | Fabrication | | Engenharia | Engineering |
| Armazém | Storage | | Códex | Codex |
| Provação | Trial | | Baú | Chest |
| Missões | Missions | | Contrato | Contract |
| Confiança | Trust | | Marco | Milestone |
| Ajustes | Settings | | Loja | Shop |
| Desmontar | Salvage | | Vender | Sell |
| Chave de acesso | Access Key | | Passe VIP | VIP Pass |
| Escudo | Shield | | Dano | Damage |
| Crítico | Critical | | Sorte | Luck |
| Combustível | Fuel | | Sincronia | Sync |
| Carga (a bordo) | Cargo | | Ranking | Leaderboard |

Raridades: Comum → Common · Incomum → Uncommon · Raro → Rare · Épico → Epic ·
Lendário → Legendary · Mítico → Mythic · Divino → Divine.

Elementos: Padrão → Neutral (`tc('elemento', …)`) · Fogo → Fire · Gelo → Ice ·
Cósmico → Cosmic · Raio → Lightning · Químico → Chemical.

**Nomes próprios** (decisão do §8): galáxias, chefes e naves de nome
descritivo são traduzidos ("Coroa Quebrada" → "Broken Crown", "Núcleo
Ferrugem" → "Rust Core"). Ficam como estão: a marca **Órbita Zero** e os nomes
que já são código ou estrangeiros ("Vetor VC-1", "Aurora Mk III", "Kla'ed").

---

## 7. O que impede erro (testes, fase 0)

`tests/traducao.test.ts`, rodando na suíte normal:

1. **Placeholders iguais.** Todo `{x}` da chave existe no valor, e vice-versa.
2. **Sem português esquecido.** Valor em inglês sem letra acentuada do
   português (`ã õ ç á é í ó ú â ê ô`). Lista de exceção só para nomes que
   ficam, como Órbita Zero.
3. **Sem valor copiado.** Valor igual à chave só com exceção explícita
   (`'Hangar'`, `'{a} · {b}'`).
4. **Sem conflito entre arquivos.** A mesma chave em dois arquivos de área com
   valores diferentes quebra o teste. Dentro de um arquivo, o TypeScript já
   recusa chave repetida.
5. **Glossário respeitado.** Chave com um termo do glossário → valor com o
   termo inglês correspondente, salvo exceção anotada.
6. **Catraca de cobertura.** Uma lista `CONCLUIDOS` de arquivos-fonte: para
   cada um, a ferramenta tem que achar **zero** textos sem entrada e zero moldes
   sem `t()`. Arquivo entra na lista quando termina e nunca mais sai. É isso que
   impede uma tela traduzida de voltar a ter português depois de uma
   funcionalidade nova.
7. **Português intacto.** Com o dicionário vazio, `tr(x) === x` e o DOM de
   `h()` sai idêntico ao de hoje.
8. **O Worker não carrega o dicionário.** `src/i18n/index.ts` não importa
   `./en`.

Em execução, só em desenvolvimento: `window.oz.traducoesFaltando()` devolve
toda string que `tr()` recebeu, não achou e tinha cara de português. É o que
pega o que a heurística estática não vê: texto montado em `sim/`, mensagem que
vem de outro lugar. O `tester` joga as telas em inglês, chama isso e manda a
lista para o próximo lote de tradução.

Os testes que leem código e quebrarem com a conversão são atualizados
**mantendo a intenção** da asserção. Nunca apagados.

Portões de toda entrega (o agente roda antes de devolver): `npm run typecheck`
· `npx vitest run` · a ferramenta mostrando a contagem caindo · para o que toca
o combate, uma olhada pelo `/__snap`.

---

## 8. Decisões do Rafael (antes da fase 1)

1. **Traduzir os nomes das galáxias, chefes e naves descritivas?**
   Recomendado: sim (ver §6). Em inglês, "Coroa Quebrada" é som, não sentido.
2. **Aprovar o glossário** da fase 0: uns 10 minutos de leitura, e ele trava a
   consistência dos 30 lotes seguintes.
3. **Imagens com texto em português embutido** (`public/assets/landing/`:
   `galaxias.png`, `naves.png`, `o-jogo.png`, `comunidade.png`, usadas na wiki)
   e capturas com a interface em português (`tela.webp`, `elementos.webp`,
   `fabricacao.webp`, usadas na capa). Na versão em inglês: novas capturas pelo
   `/__snap` com a interface em inglês (fácil), e as quatro montagens refeitas
   ou escondidas em inglês (refazer exige a ferramenta de imagem).
4. **Revisão humana da lore?** Opcional. O tom da narrativa é onde a tradução de
   máquina mais perde. Um leitor fluente em uma tarde basta.

---

## 9. Fases

Cada fase vai para produção sozinha: a tradução parcial cai no português, e o
aviso diz que está em andamento. Commit e push por lote.

### Fase 0 · Fundação — Opus, 1 sessão

- `src/i18n/` (`index.ts`, `idioma.ts`, `carregar.ts`, `en/`), gancho em
  `ui/dom.ts`, `main.ts` aguardando `carregarIdioma()`.
- Seletor em Ajustes → Interface e na capa (`Landing.ts`). Aviso novo.
- `tools/lib/textos.ts` + `tools/i18n.ts` (resumo, `--json`, e grupos de
  arquivos por fase em `tools/i18n-grupos.ts`).
- `tests/traducao.test.ts` (§7) e o coletor de faltas em desenvolvimento.
- `GLOSSARIO.md` completo (termos que aparecem 3+ vezes na extração).
- **Tela-modelo:** `SettingsPanel.ts` e `Landing.ts` inteiros, feitos pelo Opus.
  São o exemplo que os agentes copiam.
- Regra nova no `CLAUDE.md`: texto novo que o jogador lê nasce com a entrada em
  inglês, e o teste da catraca cobra.

**Aceite:** quem joga em português recebe exatamente o jogo de hoje, sem baixar
o dicionário. A troca de idioma funciona e recarrega. As duas telas-modelo
estão 100% em inglês. Suíte verde.

### Fase 1 · A primeira hora — Sonnet executa, Opus revisa (~0,5 sessão de Opus)

Arquivos: `ui/` Landing, Login, IdentidadeObrigatoria, EscolhaDePiloto, Shell,
LeftRail, Tour, TooltipDoJogo, ItemCard, FichaDeItem, Anatomia, elementos,
recursos, AvisoDeVersao, TransmissaoDaCampanha · `ui/panels/` Inventory,
Galaxy · `modes/vertical/VerticalMode.ts` (canvas) · `app/` mensagens de conta,
compra e recusa · `sim/` mensagens para o jogador · `data/`: nomes (raridades,
elementos, bases de item, afixos e rótulos de atributo, cascos, chefes,
galáxias, recursos), `tutoriais.ts`, `onboarding.ts`, `screen-unlocks.ts`.

Ordem: (a) `implementer` converte moldes, ~3 lotes; (b) `content-data-agent`
traduz, ~4 lotes em paralelo; (c) `tester` joga do zero em inglês até o setor
12 e devolve faltas e textos cortados; (d) um lote de acerto; (e) `code-reviewer`.

**Aceite:** um jogador novo vai da capa ao primeiro chefe sem ver português, fora
os títulos das missões. Arquivos da fase na `CONCLUIDOS`.

### Fase 2 · As outras telas — Sonnet executa, Opus revisa (~0,5 sessão)

`ui/panels/` Missoes (a interface; objetivos e recompensas, que são moldes),
Fabricacao, AffixCraft (Engenharia), Provacao, Tree (Matriz), Fleet (Hangar),
Chests, Shop, Codex, Ranking, Eventos, Armazem · `ui/ChatPanel.ts`,
`PerfilMenu.ts` e o resto de `ui/` · o resto de `app/` e `sim/` · rótulos curtos
de `data/` (`tree.ts`, `chests.ts`, `eventos.ts` nomes, `chaves-de-acesso.ts`).
Datas e números com `localeAtual()`. ~4 lotes de conversão e ~4 de tradução.

**Aceite:** toda tela não-admin sem português, exceto conteúdo narrativo.

### Fase 3 · Conteúdo — Sonnet traduz, Opus confere o tom (~0,5 sessão)

`missoes-sementes.ts` (970), `missoes.ts`, `missoes-cadeias.ts`, `lore.ts`,
`hulls-lore.ts`, `provacao-chefes.ts`, descrições de `bosses.ts`, identidade
das galáxias, descrições de `recursos.ts`, `eventos.ts`, `clips.ts`. ~18.700
palavras, ~7 lotes em paralelo, só dicionário, sem código. O Opus lê uma
amostra de ~30 entradas por arquivo contra o guia de estilo; o resto é
coberto pelos testes. Revisão humana opcional (§8).

**Aceite:** missões e lore em inglês; catraca inclui os arquivos de dados.

### Fase 4 · Wiki e imagens — Sonnet executa, Opus revisa (~0,5 sessão)

`wiki/WikiApp.ts`: os artigos são dados (`titulo`, `corpo`, `dica`) e passam
por `tr()` na montagem; o HTML escrito à mão vira `t()`. Capturas novas em
inglês pelo `/__snap`. As quatro montagens conforme a decisão 3 do §8. Texto de
carregamento do `index.html` ("Iniciando sistemas…") vai para o boot em JS.

### Fase 5 · Fechamento — Opus (~0,25 sessão)

Cobertura 100% fora do admin → o aviso de "em andamento" sai. QA final pelo
`tester`. `ROADMAP`, `PLANO`, `TELAS` e a wiki atualizados.

### Fora do escopo

Painéis de admin (`AdminDashboardPanel`, `LaboratorioPanel`,
`app/LabCalibrationAdmin.ts`, `app/painel-admin.ts`), logs de console,
`render/` e `core/` (texto de desenvolvedor), o Worker, mensagens de jogadores
no chat, apelidos, e os recados do comando (texto livre do operador; um
`--en` no `tools/recado.mjs` pode vir depois).

---

## 10. Custo esperado

Estimativa, não medida. "Sessão" = uma sessão longa de Opus como as de
10–11/09, com compactação.

| Fase | Opus | Lotes de Sonnet |
|---|---:|---:|
| 0 · Fundação | 1 sessão | — |
| 1 · Primeira hora | ~0,5 | ~8 |
| 2 · Outras telas | ~0,5 | ~8 |
| 3 · Conteúdo | ~0,5 | ~7 |
| 4 · Wiki e imagens | ~0,5 | ~4 |
| 5 · Fechamento | ~0,25 | ~1 |
| **Total** | **~3–3,5 sessões** | **~28 lotes** |

Deixar a história das missões para depois tira ~1.100 strings (~5.800
palavras) da fase 3, e o jogo continua jogável em inglês, porque objetivos e
recompensas são moldes da fase 2.

Depois de pronto, o custo contínuo é a regra da casa: texto novo nasce em dois
idiomas. Estimado em 10–15% a mais em cada funcionalidade com texto.

---

## 11. Modelos de pedido para os agentes

Copiar, preencher os `<…>`, mandar. Seguem o handoff do §51.

**Tradução (`content-data-agent`, Sonnet):**

> Objetivo: traduzir para inglês as strings abaixo e gravar em
> `src/i18n/en/<area>.ts` (criar se não existir; registrar em `en/index.ts`).
> Leia **só** `src/i18n/GLOSSARIO.md` e a lista abaixo; não abra código-fonte.
> Lista: saída de `node tools/run-ts.mjs tools/i18n.ts --json <arquivos>`.
> Pode: criar e editar arquivos em `src/i18n/en/`. Não pode: tocar em qualquer
> outro arquivo. Regras: guia de estilo e glossário do `GLOSSARIO.md`,
> placeholders idênticos, MAIÚSCULAS preservadas. Termo repetido fora do
> glossário: anote, não invente. Aceite: `npx vitest run tests/traducao.test.ts`
> verde e a ferramenta mostrando zero faltas estáticas nos arquivos do lote.
> Devolva: arquivo gravado, quantas entradas, termos anotados, resultado dos
> testes. Não cole o dicionário no retorno.

**Conversão (`implementer`, Sonnet):**

> Objetivo: converter os textos com valor (marcados `D`) em `<arquivos>` para
> `t()`/`tr()`/`cru()`/`tc()` conforme a tabela do §5 de
> `docs/PLANO-TRADUCAO.md`, e os caminhos fora de `h()` (canvas,
> `textContent`, `alert`, `confirm`, `toLocaleString('pt-BR')`). Linhas: saída de
> `node tools/run-ts.mjs tools/i18n.ts <arquivos>`. Leia só em volta de cada
> linha (`Read` com `offset`/`limit`). Pode: editar esses arquivos e testes que
> leem esses arquivos (mantendo a intenção). Não pode: mudar lógica, ids,
> classes, `server/`; nem traduzir (o dicionário é de outro lote). Caso fora das
> regras: pare e devolva ao Opus. Aceite: `npm run typecheck`, `npx vitest run`
> verdes; a ferramenta mostrando zero `D` nesses arquivos. Devolva: arquivos,
> contagem antes e depois, as chaves novas criadas (para o lote de tradução),
> bloqueios.

**QA (`tester`, Sonnet):**

> Com o servidor de desenvolvimento, `localStorage['oz.idioma.v1']='en'`,
> recarregar e jogar: capa → conta → apelido → piloto → setor 1 a 12 → cada
> painel da fase <n>. Em cada tela: (1) `window.oz.traducoesFaltando()`;
> (2) texto cortado: elementos com `scrollWidth > clientWidth` e texto dentro;
> (3) um `/__snap` do combate. Devolva: a lista de faltas deduplicada, as telas
> com corte, e os caminhos das capturas. Não corrija nada.

---

## 12. Riscos conhecidos

- **Texto com valor que a heurística não pega** (montado em `sim/`, vindo de
  outro módulo). Mitigação: o coletor em execução do §7 e o QA por tela.
- **Mesma palavra, sentido diferente** ("Padrão", "Casco", "Raio").
  Mitigação: `tc()` e o tradutor anotando ambiguidade em vez de escolher.
- **Largura:** inglês costuma ser mais curto que português, mas um rótulo pode
  crescer. O QA mede o texto cortado por máquina.
- **Outra sessão mexendo nos mesmos arquivos.** Mitigação: `git status` antes
  de cada lote, commit por lote, só os próprios trechos no stage, e os lotes de
  conversão feitos longe de funcionalidade em andamento no mesmo arquivo.
- **Deriva do dicionário:** chave que ninguém mais usa depois que o texto
  português mudou. A ferramenta ganha um modo `--orfas` na fase 5; entrada órfã
  não quebra nada, só pesa.
