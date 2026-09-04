# Roadmap — Órbita Zero

Documento **vivo**: atualizado a cada etapa concluída. É a resposta para "onde
estamos e o que vem agora".

Os dois documentos ao lado não são isto:
[`ESPECIFICACAO-MESTRE.md`](ESPECIFICACAO-MESTRE.md) é a fonte de verdade de
design, e [`FASE-0-AUDITORIA.md`](FASE-0-AUDITORIA.md) é o diagnóstico de um
momento — o ponto de partida, que não se reescreve.

**Última atualização:** 04/09/2026 · 982 testes passando · registro consolidado
de agosto em [`ATUALIZACAO-2026-08-25.md`](ATUALIZACAO-2026-08-25.md).

---

## 04/09/2026 — painel de conquista entre ondas

A transição de onda deixou de ser uma caixa opaca com borda simples e passou a
usar a linguagem do cockpit: moldura holográfica recortada, profundidade de
vidro, selo de conclusão, trilho conectado das ondas, núcleo próprio para o
chefe e contagem regressiva luminosa. O desenho é vetorial no canvas, adapta-se
à largura do palco e preserva a leitura da gameplay ao fundo.

Verificação: captura direta dos pixels do canvas em 634×840, typecheck e build
de produção concluídos; 982 testes passando.

## 04/09/2026 — Chat global e particular (implementação local)

Implementados Worker social separado, Durable Object com WebSocket, histórico
em D1 dedicado, autenticação por ticket e identidade Supabase validada. Global,
privadas por solicitação/aceite, não lidas, bloqueio, denúncia e painel de moderação
com permissões server-side/auditoria. Interface desktop/mobile independente do
loop; campos não acionam controles da nave. Nenhuma conversa entra no save.

Verificação: 962 testes da suíte; 96 verificações de integração no runtime local
Cloudflare; 25 conexões/625 entregas; browser com duas contas, XSS como texto,
logout e listeners reais de foco, em 1440×1000, 390×844 e 390×460. Build e
typecheck frontend/backend passaram; empacotamento Worker em dry-run.

**Publicado em produção.** D1 social exclusivo em ENAM, Worker/cron ativos,
moderador inicial configurado, URL de produção na Vercel e frontend `6d541f9`
implantado como `READY`. Validado no domínio canônico com conta anônima real:
ticket/WebSocket/histórico conectaram, somente leitura foi respeitada, origem
estranha recebeu 403 e token inválido recebeu 401. D1 permaneceu com zero mensagens.

Operação contínua: acompanhar custos/erros/denúncias, formalizar privacidade e
exclusão e repetir em Android/iOS físicos. Instruções em
[CHAT-OPERACAO.md](CHAT-OPERACAO.md).

## Onde estamos

> **Entrando agora no projeto?** Leia [`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md)
> primeiro. Este arquivo é o HISTÓRICO, com a medição de cada etapa; o que falta
> fazer está em [`PLANO.md`](PLANO.md), as telas em [`TELAS.md`](TELAS.md) e os
> sistemas por dentro em [`SISTEMAS.md`](SISTEMAS.md).

```
Etapa 0  ██████████  concluída — rede de segurança
Fase 1   ██████████  concluída — fundação de dados
Fase 1B  ██████████  concluída — morte, progresso e permanência
Fase 2   ██████████  concluída — combate elemental
Fase 3   ██████████  concluída — itemização
Fase 4   ██████████  concluída — progressão, XP e curvas
Fase 5   ███████░░░  em andamento — conteúdo
```

**Próxima:** arte própria para os chefes da Provação, som e onboarding. A
Provação agora tem os cinco modificadores mecânicos; acessibilidade base,
controles Idle/manual e migração de save **v5** estão implementados. Antes de
novo conteúdo, manter uma rodada curta de QA visual nos retratos de Missões e
na escada de confiança em resoluções reais. Tudo detalhado em [`PLANO.md`](PLANO.md).

### Entrega de 03/09/2026 — Loja e Passe VIP

- A Loja passou a ter quatro áreas: Serviços, Baús, Cristais e VIP. O Refino de
  Cristal foi removido; cristais não podem mais ser fabricados a partir de
  núcleos.
- A compra de cápsulas saiu da tela de abertura e foi centralizada na Loja, com
  escolha explícita entre Prata, Ouro e Singularidade. O baú comprado entra no
  estoque e continua sendo aberto na Câmara de Aquisição.
- Cinco pacotes de cristais foram preparados entre R$ 4,90 e R$ 99,90. Os
  botões permanecem bloqueados e dizem “Em breve” até a integração do provedor
  de pagamento; nenhum crédito fictício é concedido pelo cliente.
- O Passe VIP custa **500 cristais**, equivalente ao pacote de R$ 24,90, dura
  30 dias e acumula renovações. Ele libera seis tentativas na Provação, cinco
  missões rastreadas, auto-equipar, venda automática por raridade e pilotagem
  manual depois do nível 15. Até o nível 14, manual continua livre para todos.
- O save subiu para v11 e guarda apenas a expiração do passe. Limites e acesso
  são derivados desse timestamp, inclusive depois de fechar o jogo.
- Verificação: typecheck, build de produção e 788 testes passando; QA visual em
  desktop e fluxo móvel de uma coluna.

**Revisão de 03/09/2026.** Auditoria das seis entregas acumuladas: typecheck,
build (`486 kB` JS / `266 kB` CSS), `npm audit --omit=dev` sem
vulnerabilidades, e boot real em `localhost:5180` sem erro de console. Medido
no jogo: save `v11`, migração de um save `v10` sem `vip` preenche o campo
sem perder `autoEquip`/`autoDispose`; os nove alvos do onboarding continuam
resolvendo depois da reestruturação do trilho em `.rail-module`; e as
fronteiras do passe conferem nos dois sentidos (nível 14 livre, 15 bloqueado,
VIP expirado bloqueia de novo).

Um defeito encontrado e corrigido: o passo do guia sobre os modos de pilotagem
era texto fixo e prometia "PILOTAR passa a nave para você" a todo mundo. Como o
guia é reabrível por Ajustes, um jogador de nível 15+ sem VIP o relia apontando
para um botão desligado. `PASSOS_DO_ONBOARDING` virou
`passosDoOnboarding(manualDisponivel)`, com `Tour` seguindo sem conhecer o
`Sim`. 802 testes passando — os 14 do onboarding passaram a rodar nas duas
redações, mais três sobre a redação em si.

### Entrega de 02/09/2026 — cenários, síntese, Provação e Missões

- As seis superfícies atmosféricas longas saíram do teste e entraram nas
  galáxias 1–6. Junto do fim do rodízio dos cenários anteriores, a campanha
  passou a usar **30 arquivos de fundo distintos em 30 galáxias**.
- A Câmara de Fabricação mantém uma única moldura externa e recebeu um reator
  de síntese com arte própria e transparência real. As colunas internas usam
  apenas divisões discretas; os indicadores percentuais continuam SVG e não
  desenham fundo retangular.
- Os dez encaixes aceitam arrastar e soltar, inclusive substituição de uma peça
  antes da fusão; clique continua disponível e favoritos permanecem protegidos.
- Os retratos dos chefes da Provação ganharam contraste e presença; o rastreador
  de Missões passou a ignorar IDs já entregues e preserva quatro vagas reais,
  inclusive ao carregar saves antigos.
- Os oito arquétipos de chefe da Provação agora comandam trajetórias próprias:
  fortaleza, artilheiro, investida, invocador, orbital, caçador, dispersor e
  espectro deixaram de compartilhar a mesma oscilação da campanha.
- A interface móvel deixou de comprimir as três colunas de desktop. Nave,
  combate e carga agora são superfícies alternáveis por uma barra inferior;
  as telas de trabalho usam fluxo vertical e rolagem própria em 390×844.
- Os dois trilhos permanentes receberam acabamento de cabine: o cockpit passou
  a agrupar telemetria e piloto em módulos chanfrados; o inventário virou uma
  baia de carga com console de triagem, ocupação visível e células mecânicas.
  A ornamentação fica nas bordas para preservar contraste e área útil.
- O boot passou a buscar os atlas obrigatórios em paralelo. O maior atlas foi
  otimizado de 8,35 MB para 3,43 MB sem alterar suas dimensões ou transparência,
  reduzindo em 4,9 MB o primeiro carregamento. A precedência dos atlas segue o
  manifesto, impedindo IDs históricos duplicados de trocar sprites conforme a
  ordem da rede.
- Verificação: typecheck, build de produção e 782 testes passando; QA visual em
  390×844 e 1280×720.

### Consolidação de 25/08/2026

Registro completo em [`ATUALIZACAO-2026-08-25.md`](ATUALIZACAO-2026-08-25.md).
Cinco frentes, três sistemas novos e três versões de save (7, 8, 9).

**Equipamento por nave (v7).** Cada casco carrega o próprio conjunto
(`naves[id].equipped`), que é o que faz manter uma frota significar alguma
coisa. Migração verificada behaviour-neutral: as quatro medições de ritmo são
idênticas antes e depois.

**Coluna de anatomia.** Dez soquetes ao redor do chassi, sobreposta ao palco.
Nasceu como quarta trilha de grid e voltou atrás: trilha é retângulo de altura
cheia, e o cartão só usa 357 dos 668px. Sobreposta, o palco deixou de pagar
largura — campo lógico de 552 para **908** em 1280.

**Escolha de personagem (v8).** Quatro pilotos com nave própria, **1,58% de
dispersão** de poder e 34% de diferença em dps. Os stats foram resolvidos por
bisseção sobre `powerScore`, não escritos à mão.

**Ajustes em cinco abas (v9).** Jogabilidade · Vídeo · Áudio · Dados · Teste.
Dois ajustes novos (bolha de escudo e tremor de tela, ambos verificados em
pixels) e duas configurações mortas encontradas na auditoria.

**Ondas 10× mais cheias.** O setor 1 ia de 4,0s a 70,1s, de 25 para **240**
inimigos, com a XP **exatamente** preservada por um orçamento de onda. Um bug
latente do pool virou alcançável e foi corrigido junto.

**Três posturas de IA.** O equilibrado saiu: dominava o coletor em dois dos
três eixos e não era extremo em nenhum.

---

### Consolidação de 24/08/2026

- Laboratório promovido a ferramenta administrativa de calibração: hitbox e
  escala ao vivo para jogador/inimigo, filtro de pendências, confirmação de
  gravação no código e cenários Elite/Enxame/Cerco.
- 29 cascos novos balanceados e liberados; 261 confrontos medidos; Hangar com
  49 cascos, bestiário com 68 inimigos e Códex ampliado.
- Baús, Loja, Bancada de Modulação, recursos/desmanche e Códex receberam
  acabamento e regras próprias; a assinatura do baú segue o item de maior
  raridade.
- Missões passaram a ter quatro rastreios, HUD minimalista, atalhos de missão e
  pilotagem na tela principal, retratos pelo atlas `Characters` e confiança
  preenchida na cor do contato.
- A gramática visual da Provação/Afixos foi adotada como padrão: neon é estado,
  não decoração.



---

## Etapa 0 — Rede de segurança ✅

Bloqueava todas as outras: sem controle de versão e sem forma de medir, qualquer
mudança de balanceamento seria fé.

| # | Tarefa | Onde |
|---|---|---|
| 0.1 | ✅ Repositório, `.gitignore` de lista branca, `.gitattributes` | `276369c` |
| 0.2 | ✅ Vitest com testes de determinismo, limites, raridade, saves | `c456541` |
| 0.3 | ✅ Arnês de simulação em Node — `tools/lib/balanco.ts`, `tools/simular.ts` | `c456541` |

---

## Fase 1 — Fundação de dados

| # | Tarefa | Estado |
|---|---|---|
| 1.1 | Tetos de sanidade do §40 em `data/balance/limites.ts` | ✅ `f6cbac6` |
| 1.2 | Curvas centralizadas em `data/balance/curvas.ts` | ✅ `f6cbac6` |
| 1.3 | Inverter a dependência: `hpDaOnda = poderEsperado × tempoAlvo` | ✅ `72c849e` |
| 1.4 | Calibrar por simulação, com corrida do zero como prova | ✅ `72c849e` |
| — | Densidade e pressão como eixos de dificuldade (§16) | ✅ `82b4347` |
| 1.5 | Sete raridades, Comum → Divino (§9) | ✅ |
| 1.6 | ✅ Tiers de atributo T1–T10 (§6) | `data/balance/tiers.ts` |
| 1.7 | Orçamento e peso de atributos (§7) | ✅ |
| 1.8 | Nível de personagem 1–300 (§17) | ✅ com a 1B.3 |
| 1.9 | Nível de nave 1–300, sem transferência (§17, §18) | ✅ com a 1B.3 |
| 1.10 | ✅ Save v5 + migração definitiva — preferências, frota, casco, recursos e missões rastreadas normalizados | `sim/state.ts` |

### Fora do plano, feito no caminho

Duas remoções que a especificação pedia e que não dependiam de mais nada:

| Tarefa | Onde |
|---|---|
| Remover o menu Melhorias (§31) | `dc6ec0b` |
| Remover os Power Ups de batalha (§30) e tornar o dano normal irresistível | `857c2cc` |

### 1.6 — Tiers de afixo T1–T10 ✅

`tierMax` existia na tabela de raridades desde a Fase 1 e **nunca era lido pelo
gerador** — só um teste conferia que a coluna era monótona. A magnitude de uma
linha vinha de duas fontes ao mesmo tempo: uma rolagem uniforme dentro da faixa
do afixo, multiplicada pelo `power` da raridade. Nenhuma das duas aparecia na
ficha, então dois Épicos com "+Dano" podiam diferir 3× sem nada explicando por quê.

| O quê | Onde |
|---|---|
| Escada de magnitude, portões por ilvl, janela de tiers | `data/balance/tiers.ts` |
| `rollAffix` sorteia tier; `power` sai de cena | `sim/loot.ts` |
| `Affix.tier` opcional — saves antigos não quebram | `sim/types.ts` |
| Etiqueta `T4` na ficha, coluna alinhada | `ui/ItemCard.ts` |

**A decisão que estruturou tudo:** o tier **substitui** `power` como controle de
magnitude da raridade. Deixar os dois multiplicando faria a raridade contar duas
vezes e um Divino T10 sairia 7× acima do que a curva de poder pressupõe. A
raridade continua mandando em três eixos — quantas linhas, até onde elas sobem
(`tierMax`) e a chance de conjunto —, mas a magnitude POR LINHA é do tier.

A escada é geométrica de 1,0 a 7,0, de propósito a **mesma** que o `power` das
sete raridades percorria. Assim o teto do jogo não se move: o que muda é que
chegar nele passa a ser uma rolagem.

**A janela de 4 tiers** é o que impede o fim do jogo de continuar soltando T1.
Sem ela um item de ilvl 270 sortearia entre dez tiers e quase sempre cairia num
baixo — itens de nível alto ficariam piores que os de nível médio.

> **Bug pego pelos próprios testes:** o vetor de pesos estava invertido. Ele é
> indexado pela distância até o TETO, então `[4,3,2,1]` dava ao tier máximo o
> peso mais alto e ele saía na maioria das linhas — justo onde deveria ser
> conquista. Com `[1,2,3,4]`, o teto sai em 10% das linhas.

**Recalibragem.** Tornar o topo uma rolagem enfraqueceu o jogador médio, e a
primeira medição acusou o setor 295 como IMPOSSÍVEL (7,1 golpes contra o piso de
10). Remedido com `npm run simular -- ajustar`:

| | antes | depois |
|---|---|---|
| `PODER_A` · `PODER_P` · `PODER_C` | 2,118 · 2,7626 · 1,5 | 1,022 · 2,7999 · 2,5 |
| `DEFESA_A` · `DEFESA_P` · `DEFESA_C` | 81,525 · 1,2485 · 0,5 | 48,121 · 1,2757 · 1,5 |
| divergência ofensiva em 299 setores | 19× | **6,7×** |
| divergência defensiva | — | **4,2×** |
| setores fora da faixa | 1 (IMPOSSÍVEL) | **0** |

O coeficiente caiu pela metade e o expoente quase não se moveu (2,7626 →
2,7999): a FORMA da curva não mudou, só a altura. R² 0,9939 e 0,9907.

Verificado no navegador: as etiquetas saem como `T4 +146 Dano`, `T5 +116 Dano`,
`T3 +667 Escudo`. Os 331 afixos do save antigo, sem o campo, renderizam sem
etiqueta e sem erro — que é o contrato do `tier?` opcional.

**Dívida que esta etapa NÃO resolveu.** A dispersão dentro da mesma raridade
(§7) subiu de 135× para 570× na medição, mas o número está contaminado: o piso é
~0 porque `powerScore` é cego a vários atributos, e a razão máx/mín amplifica
isso. Consertar a métrica é pré-requisito da **1.7**, senão o orçamento de poder
será calibrado contra um medidor quebrado.

### 1.7 — Orçamento e peso de atributos ✅

**O medidor foi consertado e ele achou um buraco maior que o orçamento.**

`powerScore` enxergava 9 dos 27 atributos. Perfuração, explosão, velocidade,
sorte, as três rendas e as cinco resistências valiam **zero** na comparação de
itens — o auto-equipar descartava uma peça de resistência pura como se fosse
vazia, e a dispersão do §7 media a cegueira do medidor, não a dos itens.

Agora cada coeficiente entra ONDE o atributo age (`data/balance/orcamento.ts`):
perfuração e explosão no dano contra a onda, velocidade e resistência na
sobrevivência, sorte e renda num fator próprio. A forma continua sendo PRODUTO
(`√dps × √vida`) e não soma ponderada — é o que faz um canhão de vidro pontuar
abaixo de uma nave equilibrada.

> **Nove afixos estavam mortos.** Os seis `pot_*` (potência elemental) e as três
> rendas eram `kind: 'mul'` sobre atributos de base zero. A conta era
> `(0 + 0) × (1 + 0,26) = 0`: nada alimenta o lado `add` desses atributos — nem
> casco, nem conjunto, nem matriz. Eles rolavam, apareciam na ficha como "+18%
> de dano de fogo" e não faziam **nada**. Todos são consumidos como `1 + x`, ou
> seja, já são a fração: viraram `add`. As três rendas entraram junto em
> `ATRIBUTOS_FRACIONARIOS`, senão passariam a escalar com o nível de item e
> "+6% de sucata" viraria +580% no fim do jogo.
>
> Medido depois: os elementais foram de 6,7 (idêntico a não ter afixo) para 23.

Novo comando de medição: `npm run simular -- afixos <ilvl> <tier>` dá o valor
marginal de cada afixo isolado. É o instrumento que faltava para o orçamento
existir.

| medida | antes | depois |
|---|---|---|
| atributos que a nota enxerga | 9 de 27 | **27 de 27** |
| afixos inertes | 9 | **0** |
| piso da dispersão por raridade | 0,0 (falso) | 2,2 |
| divergência da curva | 6,7× | **5,8×** |

Nenhum setor fora da faixa, então **não** foi preciso recalibrar as curvas.

#### O medidor mentiu de novo — e o diagnóstico virou do avesso

A primeira leitura ("afixo bruto escala com ilvl, fracionário não; a diversidade
morre") estava **errada**. Era artefato de medir um afixo isolado sobre uma nave
**nua**: afixo multiplicativo vale em proporção à base que multiplica, então
`+15% de dano crítico` sobre dps quase zero parecia lixo.

Refeita a medição contra uma nave **montada no nível** — que é o contexto em que
a escolha acontece —, tudo inverte:

| afixo | nave nua | nave montada |
|---|---|---|
| `dano_f` | 22,96× a mediana | **1,67×** |
| `pot_fogo` | 1,41× | **4,84×** |
| `crit_d` | 0,50× | **2,47×** |

**A causa real são CANAIS.** O dano tem três canais de multiplicação — `add
dano`, `mul dano` e a potência elemental — e o valor de uma linha depende de
quão cheio já está o canal que ela alimenta. `mul dano` acumula com casco,
conjuntos e matriz num somatório grande, então mais 63% ali muda pouco. A
potência elemental **não recebe de mais ninguém**: cada ponto quase dobra o dano
sozinho. Ao consertar os seis `pot_*` na primeira metade, eu os tornei os
afixos mais fortes do jogo sem perceber.

Faixa de `pot_*` de 0,07–0,26 para **0,02–0,08**. Medido depois: 4,84× → **1,67×**,
o mesmo que `dano_f`. Dispersão no fim do jogo 38,5× → **23,1×**, e o núcleo dos
afixos (fora contagem e utilidade) fica entre 0,7× e 2,7× — cerca de 4×, faixa
saudável. Curva conferida: 6,3×, zero setores fora da faixa.

#### O que fica registrado e não foi mexido

**Quatro afixos morrem no fim do jogo por saturação de teto.** Numa nave montada
no ilvl 270, `cadencia_p`, `crit_c`, `expl_f` e `sorte_f` dão ganho **zero**: a
nave já está em cadência 20, crítico 95%, explosão 260 e sorte 5, que são os
tetos do §40. Um Divino de sete linhas pode rolar quatro linhas mortas.

Não é bug de fórmula — os tetos são deliberados. É problema de *experiência de
drop*, e a correção mexe em teto ou em elegibilidade de afixo por nível. Fica
para a Fase 3 (orçamento de item), com o número já medido.

Os afixos de **contagem** (`proj_f` 4,28×, `perf_f`, `expl_f`) ficam acima da
faixa de propósito: pesos 9 contra 100 do `dano_f`. A raridade já os precifica.

---

## Fase 1B — Morte, progresso e permanência

Bloco pedido em 16/08/2026. Muda a natureza do jogo: hoje morrer custa pouco e o
setor avança sozinho; a intenção é que morrer doa e que o avanço venha de matar.

Vem **antes da Fase 2** porque redefine o que o combate significa — implementar
dano elemental sobre um sistema de progresso que vai mudar é retrabalho certo.

### 1B.1 — Progresso por ABATE, não por dano ✅

Hoje o encontro é um poço de vida que drena a cada golpe: `applyDamage` credita
o dano ao `hpPool`, e quando o poço zera a onda acaba **com inimigos ainda
vivos na tela**. Fica estranho, e é o que o pedido aponta.

O modelo de poço existe por um motivo que não pode ser perdido: antes dele, os
inimigos que escapavam pela base da tela limpavam a onda de graça. A substituição
precisa resolver os dois lados — o avanço vem de abate, e quem escapa não conta.

> **Evidência do problema, medida.** Setor 4, onda de elite: o poço marcava
> 435 de 970 enquanto as três naves em tela estavam com vida cheia. Os inimigos
> desciam e saíam pela base, o diretor repunha a onda inteira, e o jogador de
> nave nua (24 de dano por segundo) nunca fechava a conta — 90 minutos, 67
> mortes, zero itens coletados.

**Como ficou.** `run.hp/hpMax` viraram `run.restam/unidades`, e o crédito saiu de
`applyDamage` para `killEnemy`. O caminho abstrato converte dano por segundo em
abates por segundo, para os dois medirem a mesma coisa. Quem escapa pela base
volta para a fila do diretor **com a vida que lhe restava**.

Essa última parte não estava no plano e é o que faz a peça funcionar: na
primeira tentativa o fugitivo voltava curado, e isso apagava o trabalho do
jogador. Medido: cinco minutos na onda de elite do setor 3 com **zero abates e
35 escapes**, `restam` congelado em 2 de 2. Um casco que não cai numa passagem
também não cai na seguinte, e o encontro nunca terminava.

Verificado depois: com o disparo desarmado, 104 inimigos escaparam em 60
segundos e o progresso ficou em zero — escapar não é atalho. E `restam` chega a
zero sempre com a tela limpa.

> **Efeito colateral no ritmo.** A corrida do zero passou de setor 10 em 40
> minutos para **setor 7 em 60 minutos**. Vai na direção da meta do §2 (dez
> horas por galáxia) sem que ninguém tenha mexido em curva — o jogador agora
> paga pelos inimigos que deixa passar.

### 1B.2 — Recursos só ao concluir o SETOR ✅

Sucata, núcleos e cristais de combate deixaram de ser creditados por onda. Ficam
em `run.carga` e só entram no banco quando o setor inteiro cai; morrer no meio
perde tudo o que está lá.

A renda de PATRULHA continua indo direto para o banco: ela é a camada ociosa e
não faz parte da incursão, então não faz sentido pô-la em risco.

A carga aparece no cockpit, com quantas ondas faltam para garanti-la. Perder só
é risco se o jogador souber o tamanho do que está em jogo antes de morrer —
escondida, seria surpresa.

Medido: morrer com 5.360 de sucata e 1.127 núcleos na carga zerou os dois e
deixou o banco intacto.

### 1B.3 — Morte muito punitiva ✅

Puxou junto as tarefas **1.8 e 1.9**: a perda incide sobre a faixa de XP entre
um nível e o próximo, então os níveis precisavam existir primeiro.

**Níveis.** `command.level` virou `command.nivel` e passou a ser o nível de
personagem do §17 — patente e nível sempre foram a mesma coisa, e separá-los
criaria dois eixos idênticos. Cada nave ganhou `nivel`/`xp` próprios em
`state.naves`, sem transferência: trocar de casco recomeça a progressão dele, e
é isso que dá sentido a manter uma frota. O nível da nave amplifica os atributos
DELA, não os do equipamento.

As curvas viraram **polinomiais**. Com a exponencial antiga o nível 300 custaria
7 × 10²⁰ de XP e o teto do §17 seria decorativo.

**Verificado numa corrida do zero de duas horas:** setor 8, 24 mortes, nível 6
de personagem e 9 de nave, 44 itens, dano por segundo de 24 a 596. A sucata
recuou entre os minutos 100 e 120 — é o imposto da morte aparecendo.

> O risco do empate **não se materializou**. Voltar à onda 1 funcionou desta vez
> porque o terreno mudou: com progresso por abate e itens acumulando, o jogador
> recupera o setor mais rápido do que a morte o atrasa.

**Nível 6 em duas horas é o desenho, não um problema.** Confirmado em 16/08/2026:
a progressão é para ser lenta, e o nível 300 é para custar **semanas de jogo**.
Isso reclassifica a pendência que estava anotada aqui — o ritmo lento deixa de
ser dívida e vira critério de aceite: qualquer mudança que faça o nível subir
rápido está errada, mesmo que pareça mais gostosa nas primeiras horas.

Pendência de calibragem que continua de pé: o caminho abstrato (janela fechada)
ainda não modela morte, então render mais que jogar ficou pior agora que morrer
custa caro.

### 1B.3 — o pedido original

| Perda | Detalhe |
|---|---|
| Progresso do setor | Volta para a onda 1 e refaz o setor inteiro |
| XP do personagem | −15% do acumulado **dentro da faixa do nível atual** |
| XP da nave | idem, na faixa do nível da nave |
| Nível | Se o XP cair abaixo do piso do nível, **desce de nível** e continua perdendo na faixa anterior |
| Matriz | Ao perder nível, o **último ponto alocado** é devolvido |
| Carga da incursão | Todos os recursos coletados no setor são perdidos |
| Sucata em banco | Perde uma parcela do que já estava guardado |
| Itens | **Não se perdem** — o que caiu, caiu |

Exemplo dado, que vira o teste: nível 10 começa em 1000 de XP e o 11 exige
1400. Com 1200 de total, o acumulado na faixa é 200, e a morte tira 30 (15% de
200). Se o total chegar a 1000 ou menos, cai para o nível 9 e as perdas
seguintes passam a incidir sobre a faixa de 9 → 10.

Confirmado em 16/08/2026: **15%** nas duas quedas, inclusive após perder nível.

> ⚠️ **Risco conhecido.** Voltar à onda 1 do setor foi tentado e removido no
> commit `72c849e`: com as ondas dimensionadas por tempo, a regressão criava
> empate — o piloto avançava e recuava no mesmo ritmo e passava quarenta
> minutos no mesmo setor. Só volta a funcionar se a curva de dificuldade e a
> aquisição de itens estiverem calibradas para o jogador **vencer** o setor na
> maioria das tentativas. Precisa de simulação antes de fechar.

### 1B.4 — Chefes de verdade ✅

O chefe deve exigir farm dos setores anteriores — item e nível — em vez de cair
na primeira tentativa. Valia 3,5 ondas comuns (`CHEFE_ONDAS`), pouco para um
marco de galáxia.

| O quê | Onde |
|---|---|
| `CHEFE_ONDAS` 3,5 → 5 | `data/balance/curvas.ts` |
| `CHEFE_EXIGENCIA` = 1,6 — multiplica vida **e** dano do chefe | `data/balance/curvas.ts` |
| Trava de fase: `settings.repetirSetor` | `sim/types.ts`, `sim/index.ts` |
| Botão da trava no mapa de fases e nos ajustes | `ui/panels/GalaxyPanel.ts`, `SettingsPanel.ts` |

`CHEFE_EXIGENCIA` multiplica os dois eixos de propósito: só vida faria uma luta
longa, só dano faria uma loteria. Juntos, exigem equipamento para aguentar e
para derrubar.

**A trava foi o que faltava para o pedido ser honesto.** Medindo uma corrida do
zero, o jogador empacou no setor 10 — 62 mortes, dps caindo de 420 para 398 em
dez minutos. Travar no chefe e voltar a farmar é o desenho pretendido, mas num
jogo ocioso quem joga é o laço: sem a trava, farmar exigiria voltar ao mapa e
reclicar a fase a cada volta. Ligada, a incursão refaz a mesma fase ao vencê-la.
O que a vitória rende não muda — recompensa, XP, drops e a liberação do setor
seguinte continuam iguais; ela segura só o ponteiro da incursão.

Decidido junto: a morte **não** regride o setor sozinha, e não existe recuo
automático. Escolher onde jogar é do jogador.

### 1B.5 — Aba em segundo plano não é ausência ✅

Feito. A aba oculta continua simulando; ausência é só janela fechada.

`requestAnimationFrame` congela em segundo plano, então não bastava deixar de
parar o laço — foi preciso um segundo relógio. O avanço é calculado pelo relógio
de PAREDE decorrido e não pelo número de chamadas, então o estrangulamento que o
navegador aplica a `setInterval` não atrasa o jogo: um tick que demorou um
segundo processa um segundo de simulação.

Medido: três segundos ocultos produziram três segundos de jogo, sem desvio.

---

## Fase 2 — Combate

Depende da Fase 1: sem tiers e sem orçamento de poder, o dano elemental não tem
como ser dimensionado.

| # | Tarefa |
|---|---|
| 2.1 | ✅ `DamagePacket` — normal e elemental separados (§3) |
| 2.2 | ✅ Combate refatorado para o pacote |
| 2.3 | ✅ Matriz configurável em `data/balance/elemental.ts` |
| 2.4 | ✅ Dois críticos, rolados à parte |
| 2.5 | ✅ Penetração com teto de 0,8 |
| 2.6 | ✅ Pipeline de `tiros e explosoes.png` — atlas `elemental`, 117 sprites |
| 2.7 | ✅ Projéteis, impactos e explosões por elemento (§22) |

---

## Fase 3 — Itemização

| # | Tarefa |
|---|---|
| 3.1 | ✅ Pipeline de `novos itens.png` — atlas `itens-novos`, 140 ícones |
| 3.2 | ✅ Afinidade de slot: cada categoria puxa a própria família de afixo |
| 3.3 | ✅ `calibre` por afixo, medido — dispersão 22,1× → 10,0× |
| 3.4 | ✅ Três degraus de projétil, com portão de raridade e exclusão mútua |
| 3.5 | ✅ Drop por REGRA — casa por padrão, aceita conteúdo futuro sem cadastro |
| 3.6 | ✅ Upgrades Gerais como SLOT — décima categoria, com implícito multiplicativo |
| 3.7 | ✅ Carga 15 → 70 por conquista, filtro por elemento e favoritos, cinco ordens |
| 3.8 | ✅ Armazém, e os 70 recursos de `Recursos.png` com origem por planeta, chefe, torre e missão |
| 3.9 | ✅ Prefixo e sufixo: dois pools com piso garantido, e o ajuste da defesa que isso destapou |
| 3.10 | ✅ A Sorte deixa de fabricar o topo — e o jogo inteiro foi reajustado contra o jogador de verdade |

---

### 3.9 — Prefixos e sufixos, e o ajuste de defesa que eles destaparam ✅

O pedido: *"as naves tem seus atributos bases, os itens vao ter seus atributos em
cima da base da nave, afixos e sufixos, tiers dentro de cada sufixo e afixo"*.

**Nenhum campo novo no item, e nenhuma migração de save.** `Affix` já guarda o
`id`; o tipo se lê da tabela (`tipoDoAfixo`), derivado da família que já
existia — ofensiva vira prefixo, defensiva e utilidade viram sufixo, 14 contra
12. Dois campos dizendo a mesma coisa acabariam discordando um dia.

**Três desenhos, e os dois primeiros a medição reprovou.**

| desenho | setor 120 | 170 | 220 | 300 |
|---|---|---|---|---|
| antes da divisão | 10,03 | 8,57 | 7,00 | 6,10 |
| metade a metade | 9,54 | 7,50 | 6,67 | 5,30 |
| ímpar pela afinidade do slot | 9,82 | 8,12 | 7,07 | 5,86 |
| **piso pelo tema do slot** | **9,98** | **8,09** | **7,20** | **5,82** |

Golpes até morrer, mediana de 41 conjuntos por setor. Partir os afixos ao meio
obriga um escudo Divino a carregar três linhas de dano: a `AFINIDADE` dava a uma
blindagem 4,8 linhas defensivas em sete e a metade forçada derrubava para 3,3.
Sobrevivência caindo até 13% enquanto o tempo de limpar melhorava — poder
escorrendo da defesa para o ataque, exatamente o que a afinidade existe para
impedir.

O que ficou: o lado do TEMA do slot ganha piso 2, o outro ganha 1, e o resto
continua sorteado pelo peso. A garantia que o pedido quer — nenhuma peça sai de
uma natureza só — sem apagar a identidade dos nove slots.

> **A medição de 5 amostras não servia.** O teste de regime reprovava em dois
> setores por uma mudança de balanço nulo: mexer na ORDEM das chamadas ao RNG
> reembaralha todos os itens, e com 5 amostras o mesmo setor 300 deu 5,3, 5,7 e
> 5,9 golpes em três variantes de poder idêntico. Subiu para 41, ao custo de
> menos de um segundo.

#### E aí apareceu o buraco de verdade

Com a régua boa, a razão entre o que o jogador aguenta e o que a curva pretende
**decaía ao longo do jogo**: 0,71 · 0,69 · 0,67 · 0,57 nos setores 120, 170, 220
e 300. Não era o setor 300 sendo especial — era a defesa perdendo terreno o jogo
inteiro, e o 300 sendo onde cruzava o piso de 0,6 que o teste tolera.

`defesaEsperada` é um AJUSTE do que o jogador realmente tem, e o dano do inimigo
é derivado dele. Refazendo o ajuste por mínimos quadrados em 14 setores:

| | antes | medido | depois |
|---|---|---|---|
| `DEFESA_A` | 42,902 | **27,6** | 27,630 |
| `DEFESA_P` | 1,2541 | 1,2515 | 1,2515 |

O coeficiente estava **55% alto**: o inimigo vinha batendo com força calibrada
contra uma defesa que o jogador não tinha. A banda larga do teste (0,6 a 1,6)
escondeu o erro por completo.

**E não era desta etapa.** A mesma medição na versão anterior à divisão ajusta em
27,076 — a divisão prefixo/sufixo é neutra, até 2% melhor. Os 55% já estavam lá.

| razão golpes/alvo | 120 | 170 | 220 | 300 |
|---|---|---|---|---|
| antes | 0,71 | 0,69 | 0,67 | 0,57 |
| **depois** | **1,12** | **1,08** | **1,05** | **0,90** |

Na ficha, prefixos e sufixos saem em grupos rotulados — a ordem do array não
serve, porque o sorteio preenche os dois pisos antes do resto e as linhas chegam
intercaladas. O rótulo só aparece quando existem os dois: numa peça comum, de uma
linha só, "Prefixos" sozinho é ruído.

Cinco testes novos em `tests/afixos.test.ts`. 451 passando.

---

### 3.10 — A Sorte era um laço de realimentação ✅

**A pergunta era de balanceamento e a resposta era um defeito estrutural.**

A Sorte vem de itens. Itens de raridade alta trazem mais Sorte. Mais Sorte
sorteia raridade mais alta. Ninguém tinha medido esse laço fechado. Fechando-o
num ponto fixo, o conjunto EQUIPADO ficava assim:

| setor | antes | depois |
|---|---|---|
| 60 | Épic 42% · Lend 37% · Míti 10% · Divi 2% | Raro 56% · **Épic 33%** |
| 150 | Lend 6% · Míti 53% · **Divi 41%** | Raro 10% · **Épic 89%** |
| 300 | Lend 2% · Míti 41% · **Divi 57%** | **Épic 94%** · Lend 1% |

O jogador do setor 200 vestia **maioria de Divino**. O culpado: `sorteExpo`
SUBIA com a raridade, até 5,2 no Divino. Com a Sorte no teto (fator 6), o peso
do Divino era multiplicado por **11 mil**; o do Comum, por 1. E o teto de 5 era
alcançado por volta do **setor 160**, ou seja metade do jogo colado nele.

**Baixar o teto não resolvia.** Mesmo NO teto, o Divino saía 1 em 42; para
mantê-lo raro o teto teria de ser 0,5, o que é o mesmo que não ter o atributo. O
valor do teto nunca foi o problema — o sentido da escada era.

#### A escada invertida

Expoente **negativo embaixo**, **baixo em cima**: a Sorte limpa o chão e ajuda
até o Lendário; no topo quase não atua.

| | Comum | Incomum | Raro | Épico | Lendário | Mítico | Divino |
|---|---|---|---|---|---|---|---|
| `sorteExpo` antes | 0 | 1 | 2 | 3 | 4 | 4,6 | 5,2 |
| `sorteExpo` depois | **−2,0** | **−0,5** | **0,5** | **1,4** | **2,0** | **1,0** | **0,4** |
| peso antes | 10000 | 3400 | 960 | 220 | 40 | 5 | 0,4 |
| peso depois | 10000 | **1166** | **292** | **42** | **0,0367** | **0,0132** | **0,00323** |

Os pesos foram **resolvidos**, não escolhidos. O alvo veio do Rafael em forma de
jogadores: *"se 1000 jogadores estiverem no teto, é para uns 20 terem 1
divino"*. Medido o volume real de itens — 2.358 numa passada até o setor 160,
795 por hora farmando no teto — o alvo vira 1 em 300 mil por sorteio.

| por sorteio | Épico | Lendário | Mítico | Divino |
|---|---|---|---|---|
| antes, no teto | 1/4 | 1/4 | 1/10 | **1/42** |
| depois, sem sorte | 1/264 | — | — | — |
| depois, no teto | 1/4 | 1/1.508 | 1/37.500 | **1/300.000** |

Conferido em 1000 jogadores: 982 com Lendário, 213 com Mítico, **20 com Divino**.
A última linha foi medida no jogo rodando, pelo `rollRarity` real.

O Lendário ficou com expoente 2,0 e não 1,2 — o que o torna inalcançável sem
Sorte. Escolha do Rafael, explícita: *"o jogo é para ser dificil mesmo e ser
jogado muitas vezes, a conquista de lendario para cima é para ser vitoriosa,
comemorada"*.

#### O medidor mentia há muito tempo

`equiparMelhor` sorteava com `luck = 0.3` **cravado no código**, em todos os 300
setores. O laço da Sorte simplesmente não existia para o medidor — ele modelava
um jogador que nunca houve, em ponto nenhum da curva. Agora resolve o ponto fixo
por setor (`sorteDoSetor`, memorizado), e a Sorte medida vai de 0,00 no setor 1
a 3,68 no 300.

Com o jogador honesto no lugar, **todas as curvas estavam erradas** — e o erro
não era da mudança de hoje, era do medidor:

| | antes | depois |
|---|---|---|
| `PODER_A` · `PODER_P` | 0,527 · 2,9279 | **0,0602** · **3,0655** |
| `INICIO_BASE` · `INICIO_RAZAO` | 24 · 1,42 | **23,1** · **1,2296** |
| `INICIO_DEFESA_BASE` · `_RAZAO` | 227 · 1,1 | **162,1** · **1,0882** |
| `PERSONAGEM_XP_EXPO` | 2,88 | **2,96** |
| `XP_GANHO_GLOBAL` | 4 | **24** |

O XP subiu junto porque a recompensa deriva de `poderEsperado`: com o poder
caindo 8,8×, o nível 300 deixou de ser alcançável. Reajustado, o nível volta a
acompanhar o setor (10→11, 100→100, 180→192) e o teto chega no **setor 269** —
o que o Rafael pediu em `4.x` ("chegar ali em 270").

Ritmo final, os dois eixos contra o alvo do próprio setor:

| setor | 12 | 50 | 120 | 220 | 300 |
|---|---|---|---|---|---|
| tempo de limpar | 0,82× | 1,03× | 0,91× | 0,95× | 1,03× |
| golpes até morrer | 1,02× | 0,94× | 1,07× | 1,01× | 1,01× |

**Decisão de desenho registrada:** os baús vão ser reformulados por inteiro e
passarão a ter **percentuais próprios de raridade**, sem consultar a Sorte do
jogador. Quando isso acontecer, `ChestDef.luck`, `ChestDef.floor` e o
`SORTE_EFETIVA_MAX` ficam órfãos e saem juntos.

---

### Escada de aquisição dos cascos ✅

Os 29 cascos Spaceships 2.0 entraram como **arte em teste**: `tier 4`,
`cost 0`, `requiresSector 0`. Grátis e equipáveis no setor 1.

**O que a medição achou.** No setor 1, nível 1, save novo: 29 cascos tier 4
equipáveis, o melhor com nota **918 contra 85** do inicial. A consequência não
era o jogo quebrar — a curva sobe rápido, e uma `bastiao_8` nua limpava até o
setor 15 contra o 6 da inicial. Era a escada MORRER:

| casco | tier | setor | custo | nota | |
|---|---|---|---|---|---|
| void_canhao | T1 | 0 | 0 | 85 | obsoleto |
| void_zapper | T3 | 14 | 90 | 367 | obsoleto |
| falcao_b | T4 | 34 | 320 | 497 | obsoleto |
| **prisma_cosmico** | T5 | 44 | 860 | 1405 | primeiro sobrevivente |

**14 dos 20 cascos legados obsoletos desde o minuto zero** — tudo do setor 0 ao
34, incluindo compras de até 420 núcleos. E o buraco simétrico: a espinha legada
termina no setor 70, e os outros 230 setores não ganhavam nave nenhuma.

#### A régua também estava quebrada

`cascoDoSetor` ordenava por `b.tier - a.tier` e pegava o primeiro — entre tiers
iguais, decidia pela ordem do array. **`aurora_x` (nota 4.264, setor 70) nunca
era escolhido**, porque `void_canhaozao` (1.830, setor 48) é T6 e vinha antes. A
régua mediu por muito tempo uma nave 2,3× mais fraca que a disponível do setor 70
em diante. Agora escolhe por NOTA: tier é rótulo, poder é medida.

Consertá-la expôs o que ela escondia: quatro cascos legados fora de família.
`aurora_x` entregava **5,46× o dano da curva** e dominava do setor 60 ao 194.
Os quatro foram normalizados por medição (projéteis, cadência e perfuração para
a faixa dos arquétipos), cada um resolvido por busca binária até ~1,25×. Medido
depois: 1,27× · 1,23× · 1,44× · 0,76×. Nenhum casco legado ficou fora de família.

#### O desenho

Um casco a cada ~9 setores, do 36 ao 288, com escala contínua tirada de
`poderEsperado` e `defesaEsperada` — as mesmas curvas que a dificuldade usa. É o
que garante que uma futura recalibração da dificuldade arraste a escada junto,
em vez de deixá-la para trás em silêncio.

| linha | tier | setores | custo em núcleos |
|---|---|---|---|
| Fronteira | T4 | 36–81 | 650 – 3.720 |
| Expedição | T5 | 90–135 | 4.820 – 11.710 |
| Domínio | T6 | 144–189 | 13.500 – 24.970 |
| Ascensão | **T7** | 198–243 | 27.670 – 43.540 |
| **Divina** | **T7** | 252–288 | 47.210 – 64.080 |

Dentro de uma linha a escolha é de ESTILO (arquétipo, elemento, arma) — a
intenção original dos 29, preservada. Ao longo da escada é de PROGRESSO.

#### Quatro tentativas medidas, três descartadas

| tentativa | resultado |
|---|---|
| cinco degraus, escala única | erro do ajuste **0,21 → 2,24**: saltos que nenhuma curva suave segue |
| escalar TODOS os atributos | nota respondia a `f³`; estouraria tetos e apagaria o arquétipo |
| escalar ataque e defesa igual | golpes 3,52× no setor 260 — o jogo cresce 352× no ataque e só 11,5× na defesa |
| **escala contínua, dois eixos** | **2 setores fora de banda, ambos na abertura** |

> **No fim do jogo o `dano` do casco quase não conta.** Medido no setor 70,
> baixar o dano de um casco de 62 para 26 move a razão de 4,02× para 3,57×: os
> itens dominam o termo aditivo, e quem manda são os MULTIPLICADORES. Por isso o
> papel do casco tarde é defesa e identidade, não dano bruto — e por isso o
> expoente de dano é bem menor que o de defesa.

> **A escada precisou de um piso.** Sem ele os três primeiros postos nasciam
> mortos: `centuriao_atlas` (setor 36) marcava 433 contra 497 do `falcao_b` já
> disponível. Um casco pago que nasce pior do que o que o jogador já tem é
> conteúdo morto.

Ritmo final, 21 conjuntos por setor: **de 12 setores fora de banda para 2**,
ambos no regime de abertura (1 e 12), onde o casco vale de 99% a 43% do poder
total. O setor 1 já estava fora antes desta etapa.

#### O custo era decoração

A primeira versão cobrava 0,64 núcleos por ponto de nota, a razão que a espinha
legada praticava. Medido depois: a renda de núcleos cresce muito mais rápido que
a nota, e o casco mais caro (64.080) saía por **0,03% da renda acumulada** até o
setor dele. O único portão real era o setor.

Agora o custo é fração da renda da JANELA — o que o jogador ganha entre um casco
e o seguinte. Medido, a renda de núcleos de um setor é exatamente **8,91 ×**
`curvaRecompensa`, e a razão se mantém idêntica do setor 36 ao 288. Com 35%, os
preços ficam entre **17% e 35%** da janela: dá para ter o próximo casco OU
refinar o que já se tem, não os dois.

`SAVE_VERSION` 6: a migração devolve os cascos que o estado provisório dava de
graça, removendo só o que **não poderia** ter sido adquirido — casco da escada
acima do maior setor alcançado. Verificado: save antigo no setor 1 fica com 20
naves; no setor 150, com 33.

---

## Fase 4 — Progressão

Integração da Matriz com o nível de personagem, curvas de XP calibradas,
requisitos de nível, e o balanceamento das galáxias contra as metas de tempo do
§2 (~10 h por galáxia).

### O que já foi feito

**O caminho abstrato parou de inundar de item.** A contagem de abates vinha de
`hpPool / bounty`, resquício de quando o progresso era medido em dano: até 40
rolagens numa onda de doze inimigos. Agora é uma por inimigo real, com perda de
coleta (`COLETA_ABSTRATA`). Medido: 1.822 itens em 2 h → 368.

### O simulador estava mentindo, e agora não está

A nota antiga dizia "galáxia 1 em 40 minutos, rápido demais". Remedido, o sinal
INVERTEU: **38,7 horas e 3.088 mortes**. Três mil mortes não é um jogador lento,
é um modelo quebrado — e o diagnóstico levou três tentativas.

| tentativa | galáxia 1 | mortes |
|---|---|---|
| como estava | 38,7 h | 3.088 |
| vida por desgaste, no lugar do corte binário | 38,2 h | 2.638 |
| + decisão de farmar quando é impossível | — | 179 em 6 h |
| + desistir depois de três derrotas | **1,2 h** | **3** |

A causa não era sobrevivência: era que **o simulador não sabia farmar**. Preso
no chefe do setor 10 — janela de 19 s contra 49 s para derrubá-lo — ele repetia
a mesma derrota para sempre. As ondas comuns do mesmo setor levavam 7 s e davam
120 s de folga; o problema era só o chefe, exatamente como a 1B.4 pretendia.

Ao vivo isso é o desenho: travar no chefe e voltar a farmar. Só que quem faz
isso é o humano, clicando no mapa — e a simulação não tinha como expressar essa
escolha.

### O ritmo agora, medido

| galáxia | horas | mortes | nível |
|---|---|---|---|
| 1 | 1,2 | 3 | 10 |
| 2 | 6,5 | 246 | 34 |
| 3 | 16,5 | 978 | 70 |
| 4 | 25,0 | 1.713 | 138 |

A meta do §2 é ~10 h por galáxia. A galáxia 1 vem rápida demais (1,2 h) e a
curva ACELERA na direção certa — 5,3 h, depois 10 h, depois 8,5 h. O trecho
inicial é que está curto.

### A Matriz saturava no nível 177

Eram 177 nós custando 1 ponto cada, e o nível máximo entrega 300 pontos. Do
nível 178 ao 300, subir de nível não fazia **nada** pela Matriz — 123 níveis sem
efeito, num jogo em que chegar ao 300 é para custar semanas.

`custoDoNo` deriva o custo da DISTÂNCIA ao centro, em três faixas: 1, 2 e 3
pontos. Derivado e não escrito nó a nó porque a matriz é gerada, e uma coluna de
custo à mão envelheceria no primeiro nó novo.

Custo total: **297 pontos** contra os 300 do nível máximo. O último nó cai
praticamente no último nível.

### A corrida ao vivo, e o que ela achou

Medida com a MESMA semente do simulador (777), duas horas de jogo:

| | ao vivo | abstrato |
|---|---|---|
| setor em 2 h | **5** | 10 |
| mortes | 31 | ~45 |
| nível | 6 | 6 |
| itens | 44 | ~368 |

O simulador continua ~2× à frente em setor e ~8× em item. **Mas o achado
importante não é a diferença: é que o jogo AO VIVO empaca do mesmo jeito.**
Entre 90 e 120 minutos ele não saiu do setor 5 — as mortes foram de 20 para 31 e
o setor ficou parado.

É a consequência direta de duas decisões que se cruzam, e as duas foram
deliberadas:

- o chefe exige farm dos setores anteriores (1B.4);
- não existe recuo automático — escolher onde jogar é do jogador.

Juntas, elas significam que **o laço ocioso, deixado sozinho, trava**. Quem
destrava é o humano: clicando numa fase anterior no mapa, ou ligando a trava de
fase para farmar. O simulador precisou aprender a fazer isso justamente porque
um humano faz.

Isso é uma pergunta de design, não um bug, e não é minha para responder: um
idle que exige atenção a cada parede é uma escolha legítima — mas é uma escolha.
As saídas possíveis, sem mexer no que já foi decidido:

1. Deixar como está. Bater na parede é o sinal de "vá farmar", e a trava de
   fase já existe para isso.
2. A trava de fase LIGAR SOZINHA depois de N derrotas, sem mover o jogador —
   ele continua onde está, mas para de perder tempo repetindo o chefe.
3. Um aviso na HUD quando o encontro estiver claramente fora de alcance,
   apontando para o mapa.

Só depois disso vale mexer nas metas de tempo do §2.

---

## A cara da interface

Passe sci-fi aplicado POR TOKEN, não painel a painel: brilho, corte de canto e
espessura de moldura vêm de variáveis, então mudar o tom do jogo inteiro é mexer
em cinco linhas em vez de caçar cor em quarenta seletores.

Três decisões, cada uma com um porquê:

- **Canto chanfrado** por `clip-path`. Retângulo puro lê como formulário; o
  chanfro lê como painel de máquina. Não custa layout.
- **Neon na BORDA, não no fundo.** Fundo brilhante come contraste do texto, e
  este é um jogo lido o tempo todo, com número em cima de número.
- **Varredura sutil** — duas linhas por 4 px, quase invisíveis, que dão textura
  de tela em vez de papel.

Os modais ficaram mais transparentes: o fundo escurece 55% em vez de 82% e
desfoca mais. Ver o combate continuar atrás É informação — o jogo é ocioso, e
abrir uma tela não pausa nada.

## A forma da interface, decidida em 17/08/2026

Painel de nave, não navegador de abas:

- **combate no centro**, sempre;
- **equipamento e ficha à esquerda**, sempre;
- **inventário à direita**, sempre — ele não é uma tela que se visita, é o que
  se consulta a cada drop;
- **menus na barra de cima**, e cada um abre como CAMADA por cima da tela.

A camada existe porque o trilho tem ~350 px: basta para uma lista, não para um
painel de trabalho. Tentei antes alargar a coluna e esbarrei numa briga de
cascata que não consegui explicar; a camada não depende da grade do layout, o
que faz o problema deixar de existir em vez de ser contornado.

## Fase 5 — Conteúdo

### 3.9 / §26 — Sacrifício e fusão de itens ✅

O problema que resolve: no fim do jogo um drop Comum é lixo. Ocupa um dos 15 a
70 espaços do inventário e o único destino é desmanchar. Com fusão, dez viram
uma tentativa.

**Não é conversão garantida** — o §26 é explícito que dez Comuns não são um
Raro. Cada receita tem chance de sucesso, e falhar CONSOME os itens e o custo.
Sem risco, fundir seria uma conversão com um passo a mais: o jogador faria a
conta uma vez e nunca mais pensaria no assunto.

**Sempre dez itens**, do Comum ao Divino — inclusive dez Míticos para um
Divino. A quantidade fixa torna a escada legível: a regra se aprende uma vez e
vale em todo degrau. O que varia é a CHANCE e o CUSTO.

A chance de SUBIR despenca: 72%, 48%, **30%**, **15%**, **7%** e **3%**.

Esse é o número que a tela mostra, e não o campo `chance` do dado. Os dois
divergem nos degraus com consolação — 40% de sucesso com 25% de peso para a
mesma raridade dá 30% de subir de fato. Anunciar o campo cru seria mentir por
omissão: o jogador não aposta em "não falhar", aposta em subir de raridade.

Os quatro primeiros degraus têm consolação — peso para sair a mesma raridade —,
o que faz uma fusão bem-sucedida ser boa notícia sem ser garantia. Os dois
últimos não têm: com 7% e 3%, dividir o sucesso outra vez tornaria o número
ANUNCIADO uma mentira.

Medido, o caminho puro por fusão da base ao topo:

| degrau | chance efetiva | peças de entrada |
|---|---|---|
| Comum → Incomum | 72% | 14 |
| Incomum → Raro | 48% | 21 |
| Raro → Épico | 29% | 35 |
| Épico → Lendário | 16% | 62 |
| Lendário → Mítico | 7% | 143 |
| Mítico → Divino | 3% | 333 |

Acumulado da base ao topo: **30 bilhões de Comuns** — número absurdo, e sem
importância prática. Ninguém sobe a escada inteira: a fusão do topo se alimenta
de Míticos que CAEM, e dez deles saem em cerca de 29 mil drops. É esse o número
real do endgame, e a escada de baixo serve para reciclar lixo, não para chegar
ao Divino.

O nível do item gerado é a MÉDIA dos que entraram, não o maior: com o maior,
fundir nove lixos de nível 1 com um bom de 270 devolveria um item de 270 por
quase nada.

Favorito nunca entra. Fundir é destrutivo, e a marca existe para proteger disso.

O sistema se chama **Fabricação** (§25 pede um nome que não seja "Forja").

**A câmara de síntese**, em três colunas: inventário à esquerda, anel no meio,
tipos de fabricação à direita — aberta como CAMADA por cima da tela.

O trilho tem ~350 px: basta para uma lista, não para três colunas. A primeira
tentativa foi alargar a coluna direita, e ela esbarrou numa briga de cascata com
as media queries que não consegui explicar — a regra estava na folha, a media
casava, a classe estava no pai, e mesmo assim adicionar e remover a classe não
mudava o `grid-template-columns` computado. A camada não depende da grade do
layout, então some com o problema em vez de contorná-lo.

Medido: a caixa abre em 1180 px e o anel em 460, contra 348 e 107 no trilho.

O jogador escolhe as peças UMA A UMA. Duas versões anteriores selecionavam
sozinhas as piores, o que era cômodo e errado: fundir é destrutivo e
irreversível, e escolher o que se perde é a decisão inteira. Automatizar isso é
automatizar a única coisa que o painel existe para o jogador fazer. O atalho
"encher com as piores" continua existindo — o que saiu foi a obrigação.

Clicar ou arrastar uma peça a põe no anel; clicar o encaixe a devolve. Peça que
não serve à receita fica VISÍVEL e apagada, em vez de sumir: esconder faria o
jogador achar que ela desapareceu, e ver o que não serve ensina a regra.

Os encaixes são posicionados em PORCENTAGEM, então o anel acompanha a largura da
coluna sem medida em pixels nem recálculo no resize.

Verificado no jogo: dez Comuns viram uma peça, e a ferrita desce de 5.000 para
4.810.


### §27 — Missões ✅

**O §27 pede ARQUITETURA**, não um punhado de missões. O que decide o desenho é
recusar o caminho óbvio: cada categoria pendurada onde seu evento acontece —
"matar" no abate, "coletar" no drop, "concluir fase" no avanço de setor. Isso
resolve as quatro categorias de hoje e cobra caro na quinta, porque cada ponto
do `sim` passaria a saber que missões existem.

Em vez disso, **um funil só**: o jogo reporta fatos em `Sim.registrar`, e cada
missão declara — como DADO — qual fato conta e sob que filtro. Missão nova é
linha de tabela. Dez tipos de fato ligados: abate, chefe, recurso, moeda, item,
setor, galáxia, nível, fusão e baú.

O preço é reportar fatos que ninguém consome ainda. É barato: um objeto por
evento, descartado no mesmo quadro quando nenhuma missão ativa se importa.

Recompensas cobrem tudo que o §27 lista — moedas, materiais, XP, medalhas,
itens, baús — e mais a **concessão de carga**, que o registro do §28 previa como
fonte `missao` desde a 3.7 e não tinha quem concedesse.

Decisões que ficaram no código:

- **Medalha é contador próprio**, fora de `resources`. Não se gasta em loja nem
  entra em fórmula de poder; junto das três moedas, toda conta de economia teria
  de aprender a ignorá-la.
- **Missão oculta não acumula.** Sem isso, uma missão liberada no setor 25
  nasceria completa com o que o jogador fez antes de ela existir.
- **A checagem da entrega vem antes do pagamento.** Sem isso, entregar sem
  material deixaria o jogador sem o material e sem a recompensa.
- **Progresso criado sob demanda**, não semeado no save: missão nova nasce
  funcionando em save antigo, sem migração.

O ícone da aba expôs uma armadilha: `cat/*` são os nove slots de item, e o
`cat/alvo` que inventei não existia — a aba nasceu sem arte, e só o navegador
contou. Ficou com `aba/melhorias`, órfão desde que o menu Melhorias saiu (§31).

20 testes novos. Verificado no jogo: 9 missões visíveis, "Linha de Suprimento"
ficou pronta ao guardar 500 de ferrita, e o resgate pagou 5.000 de sucata.

### §27 — a Central de Contratos ✅

A tela de missões foi reescrita a partir de um mockup: três colunas, três abas,
contatos com retrato e escada de confiança I–V, quatro tipos visuais e o
contrato especial com recompensa exclusiva.

**O eixo é o PERSONAGEM, não a lista de contratos.** Uma lista plana é mais
fácil de escrever e responde à pergunta errada: o jogador não quer saber quais
missões existem, quer saber com quem está progredindo.

O chefe derrotado vira ALIADO — derivado de `data/bosses.ts` e desbloqueado pelo
CÓDEX, que já registrava quem caiu. Nenhum estado novo: save antigo com chefes
derrotados já traz os contatos, sem migração.

`requerSetor` e `requer` viraram `requisitos[]`, uma união de nove tipos
resolvida num ponto só. A UI interpreta, não decide (§42).

40 peças de arte recortadas de `missoes 3.png` por detecção, e as recompensas
viraram ícone com o valor no canto.

Duas armadilhas que custaram turnos e ficaram registradas: `cat/*` são os nove
slots de item, e o `cat/alvo` que inventei nasceu sem arte passando por
typecheck e por 324 testes; e **`filter: none` num filho NÃO desfaz o filtro do
pai** — filtro CSS aplica ao elemento e a toda a subárvore como um grupo, então
o tingimento teve de ir para um `::before` para os ícones manterem a cor real.

---

### §32–§35 — o Abismo Estelar ✅ (arquitetura)

O modo de chefes do fim de jogo. O §32 proíbe o nome "torre";
"Singularidade" e "Convergência" já estavam em uso (baú de topo e receita de
fusão), e repetir nome entre sistemas confunde mais do que economiza.

**O problema que decide o desenho:** há dez chefes e cem pisos. Sem cuidado o
piso 47 é o piso 7 com mais vida — exatamente o que o §33 manda evitar.

A saída são MODIFICADORES: onze efeitos que mudam COMO a luta funciona, não
quanto ela demora. Regenerador exige dano sustentado; refletor exige ler a barra
antes da rajada; enxame exige limpar antes de focar.

Os pisos são GERADOS por regra, não escritos à mão — cem entradas seriam mil
linhas que ninguém revisa e que divergem no primeiro ajuste de curva. O sorteio
é determinístico por número do piso: o piso 63 é o mesmo para todo jogador e em
toda sessão, senão não há como conversar sobre ele nem testá-lo.

Os pisos MARCO, de dez em dez, fogem do sorteio e furam o teto de peso de
propósito — é onde o modo ganha cara própria, e um pico dentro da média não
seria pico.

Medido nas dez voltas do Núcleo Ferrugem: nenhum, `veloz`, `enxame`,
`enxame+veloz`, `blindado+fragmentador`, `veloz+pressa`, `regenerador+enxame`,
`veloz+blindado+enxame`, `enxame+sufocante`, `enxame+regenerador`. Dez lutas
diferentes com a mesma criatura.

A escala de vida sobe 166× em cem pisos — contida de propósito, porque a
dificuldade tem de vir da mecânica.

Os requisitos (§34) reaproveitam o `Requisito` das missões: mesma união, mesmo
resolvedor. Um segundo sistema com as mesmas variantes seria a duplicação que o
§50 proíbe, e assim todo requisito novo das missões o Abismo herda.

A recompensa (§35) tem curva por LINHA: sucata segue a escala, cristal só a cada
cinco pisos, medalha só nos marcos, raridade em degraus, exclusivo só do piso 20
em diante. O peso dos modificadores entra na conta — dois pisos da mesma
profundidade pagam diferente se um for mais difícil.

32 testes. **Falta a camada de combate ler os efeitos e a tela do modo.**

---

### Reforma dos Baús ✅

As quatro cápsulas deixaram de multiplicar a Sorte do jogador. Cada uma agora
declara os sete percentuais de raridade diretamente em `data/chests.ts`; a
abertura sorteia dessa tabela e passa a raridade exata ao gerador de item.
`ChestDef.floor`, `ChestDef.luck` e `SORTE_EFETIVA_MAX` saíram juntos.

O topo continua conquista: mesmo a Singularidade entrega Divino em 0,0008% —
**1 em 125 mil por item**. Medido com 200 mil sorteios por cápsula; os valores
observados ficaram dentro de 1% absoluto dos anunciados.

A tela virou **Câmara de Aquisição**, com a mesma gramática da Provação: escolha
à esquerda, objeto em foco no centro e informação decisiva à direita. Quatro
assets autorais compartilham a mesma geometria e evoluem material e núcleo de
Bronze a Singularidade. Cada uma das sete raridades tem assinatura animada
própria, de varredura discreta a halo divino, respeitando redução de efeitos.

---

### Reforma da Loja ✅

A Loja virou **Central de Serviços** e deixou de ser uma árvore de melhorias
disfarçada. Sorte, XP, cura e multiplicadores de renda foram removidos do
catálogo e do resolvedor de atributos; um teste falha se algum contrato voltar
a conceder poder direto.

O catálogo agora compra tempo e flexibilidade: quatro módulos de carga,
reconfiguração da Matriz, recarga de tentativa da Provação e duas conversões de
moeda com perda. O câmbio não é infinito: cada linha possui cota que cresce com
o nível de comando. Craft de equipamento não pertence mais a este domínio.

A expansão de carga também corrigiu uma falha antiga: a compra incrementava o
contador da Loja, mas nunca concedia os espaços. Os quatro ids idempotentes
agora são registrados, e compras antigas são reconciliadas sem duplicação.

A tela segue a gramática da Provação e dos Baús: catálogo à esquerda, terminal
no centro e leitura da transação à direita. Testes dedicados cobrem seus
invariantes sem misturar as regras da Bancada.

---

### Bancada de Modulação ✅

A recalibração de linhas saiu da Loja e virou uma tela de craft própria,
**Afixos**. A composição usa três áreas: inventário elegível, item central com
Prefixos e Sufixos separados, e protocolo de operação com custo, risco e pool
possível.

A referência conceitual é o craft de ARPG aplicado diretamente ao item: a
operação diz o que muda, o que fica travado e mantém o resultado aleatório. A
interface não copia outra tela. A remodulação preserva raridade, ilvl, base,
elemento, conjunto, tier e natureza da linha; slot, raridade mínima, elemento e
grupos de exclusão continuam filtrando os destinos.

As regras foram movidas para `data/balance/recalibracao.ts`; a visualização do
pool reutiliza `recalibrationCandidates`, a mesma função consumida pelo sorteio,
para a UI nunca prometer uma identidade impossível. Testes próprios cobrem
compatibilidade, preservação estrutural e recusa sem recurso.

---

### Mapa econômico dos 70 recursos ✅

Os recursos deixaram de ter origens genéricas por família. As 30 galáxias têm
um material-assinatura cada; orgânicos são exclusivos de missões, gases de
eventos, tecnologias de chefes e essências da Provação. O mapa, o Armazém e os
drops já leem a mesma fonte de verdade em `data/recursos.ts`.

A pasta **Recursos 2.0** foi auditada: 42 artes com alfa são finais e já vencem
no pipeline; 28 recortes antigos continuam marcados como provisórios. A lista
de todos os materiais, função, origem, estado e prioridades está em
[`ECONOMIA-RECURSOS.md`](ECONOMIA-RECURSOS.md).

---

### Venda e desmontagem de equipamentos ✅

O descarte único foi separado em duas decisões: **vender** paga somente Sucata;
**desmontar** paga somente materiais galácticos conforme raridade, ilvl, tier da
base e qualidade dos afixos. Favoritos são protegidos, o cartão antecipa ambos
os retornos, as ações em lote são separadas e a automação permite escolher o
destino. A auditoria e as medianas estão em
[`ECONOMIA-DESCARTE.md`](ECONOMIA-DESCARTE.md).

---

### Ainda na Fase 5

> **Corrigido em 23/08/2026.** Este bloco dizia que faltavam "a camada de combate
> do Abismo (ler os efeitos dos modificadores) e a tela do modo". Auditado: os
> **11 modificadores são todos consumidos** — `reflexo`, `divideEm`, `regen` e
> `travaEscudo` no `VerticalMode`; `vida`, `dano`, `cadencia`, `velocidade`,
> `invocaCada`, `espelhaElemento` e `limiteDeTempo` no `sim/desafio.ts` — e a
> tela existe (`ui/panels/ProvacaoPanel.ts`, 319 linhas). O nome também mudou:
> "Abismo Estelar" virou **Núcleo de Provação**.

Os **5 modificadores mecânicos** do §14 foram concluídos: invulnerabilidade,
zonas de perigo, clones, barreira frontal e pontos fracos. Resta a arte dedicada
dos 100 chefes. A expansão do Códex foi concluída. O conteúdo de campanha em
volume já fechou seus dois maiores buracos: há 30 chefes de galáxia e 68
inimigos distribuídos em 30 elencos; galáxias vizinhas não compartilham a
maioria das unidades. O Hangar também passou de 20 para 49 cascos: as 29 artes
Spaceships 2.0 têm arquétipo, calibração, elemento e tiro próprios.

O Laboratório também ganhou hitbox retangular de jogador, inimigo e chefe
(largura, altura e deslocamento), ajuste ao vivo e filtros de calibração. Ele é
uma ferramenta administrativa disponível somente no servidor local: **Gravar
no código** atualiza `data/hitbox-calibrations.json`, nunca o save do jogador.
Sete presets padronizados produziram a primeira comparação real dos arquétipos,
registrada em [`RELATORIO-CONFRONTOS-CASCOS.md`](RELATORIO-CONFRONTOS-CASCOS.md).

**Calibração fechada em 24/08/2026.** As 49 fichas de casco, 68 fichas inimigas
e 30 fichas de chefe agora possuem hitbox e escala visual canônicas. O filtro
“Não calibrados” e os indicadores de revisão leem diretamente essa tabela. O
Laboratório ganhou os protocolos Elite, Enxame e Cerco, cada um com três
sementes reproduzíveis. A bateria final executou 63 confrontos no motor real e
está registrada em
[`RELATORIO-BATERIA-CONFRONTOS.md`](RELATORIO-BATERIA-CONFRONTOS.md), com os
ajustes aplicados a Artilharia, Saturação, Baluarte e Duelista.

**Cascos liberados e Códex expandido em 24/08/2026.** A bateria cresceu para
261 execuções (29 cascos × três cenários × três sementes). Os sete arquétipos e
as seis famílias receberam custos mecânicos próprios; Duelista lidera o alvo
único, Assalto o enxame, e Saturador cobre enxame/cerco sem vencer Elite. Nenhuma
família domina tudo. Os 29 cascos foram removidos do estado de calibração e
adicionados à frota inicial e à migração de saves. O Códex agora cobre chefes,
inimigos comuns, elites, cascos, bases de item, recursos com fonte e as relações
elementais. Relatório completo:
[`RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md`](RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md).

---

## 04/09/2026 — coleta, vocabulário, tutoriais e o teto que mede

Uma sessão longa, com duas correções de MEDIÇÃO que importam mais que o
código: em duas ocasiões um número registrado como verdade estava errado, e
nas duas o erro era a grandeza medida, não a conta.

### Item que não cabe não é coletado

`rollDrops` tirava a peça do lote e entregava; `stash` descobria que o
Inventário estava cheio e a jogava fora. O lote tem cursor e não volta atrás,
então o jogador GASTAVA uma peça para receber nada — e a única diferença
visível era a cápsula que nunca apareceu.

Agora `rollDrops` espia antes de consumir. Medido no navegador com o
Inventário lotado: **0 entregues, 0 consumidos do lote, 0 comandos ao
servidor**. Com espaço, 3 e 3. Entrou junto a mensagem "Inventário Cheio!" no
meio da tela — vermelha, sem moldura e sem fundo, porque é um estado
momentâneo e não uma decisão a tomar.

### Coleta líquida no servidor

A mesma economia do outro lado. Medido: caem ~186 itens por hora, ~8 por ciclo
de 150 s, e o inventário NÃO cresce — o descarte automático some com quase
todos. O servidor inseria 8 linhas e apagava 8 por ciclo para o inventário
terminar igual: **~16 das ~33 escritas do ciclo**, metade do custo de D1 do
jogo inteiro, gasta para não guardar nada.

O servidor resolve sozinho porque já DERIVA o que a coleta produziu e já
recebe a lista de descarte: a interseção é o que nasceu e morreu no mesmo
lote. Protocolo e cliente não mudaram.

### O Armazém passou a ser ilimitado

Ele aceitava 15 TIPOS de material num catálogo de **70**, e o tipo que não
coubesse era perdido em SILÊNCIO — `guardarMaterial` devolvia 0 e quase nenhum
dos sete pontos que o chamam olhava o retorno. A decisão que o teto pretendia
criar nem podia existir: não há como desistir de um tipo para abrir espaço a
outro sem jogar fora o que já se tem.

Saiu com ele o que o teto causava: desmontar podia devolver `null` sem
explicação, e o descarte automático VENDIA em vez de desmontar "como
proteção", ignorando o que o jogador escolheu. Medido: **70 de 70 tipos
aceitos, zero recusados**. Quem limita é o Inventário.

### Sem sessão não se entra

`Login` resolvia com `null` quando o cadastro anônimo falhava, e deixava jogar
só com o save do navegador. O argumento valia enquanto o loot rolava no
cliente. Depois da Fase 3 o lote vem do servidor: **`garantirLote` desiste sem
token e nenhum item cai, nunca** — enquanto abate, XP e recurso seguem
entrando, então nada parece quebrado. A dívida de drop não cobre o caso: teto
de 100, só em memória, morre com a aba.

`mostrar` devolve `Promise<Sessao>`, sem `| null` — o tipo é a regra. Ninguém
precisa dar e-mail: a conta anônima entra com um clique. O que a porta cobra é
uma SESSÃO, não um cadastro.

### O jogo não tem "fase": tem onda e setor

A palavra estava na tela com TRÊS sentidos, dois no mesmo painel: "FASE
CONCLUÍDA" para um setor, "fase N" para a posição do setor na galáxia, e
"Próxima fase" para o setor seguinte. Mais treze comentários internos que
diziam "trava de fase" quando queriam dizer setor.

Três nomes de conteúdo ficam por decisão do Rafael — **Agulha de Fase**,
**Salto de Fase** e **Barreira de Fase** —, onde a palavra é sabor de física e
não unidade de progressão.

### O painel de conclusão presta contas

Era o mesmo painel para onda e setor: três linhas e uma contagem. Virou dois.
A onda limpa é passagem, com trilha de seis marcas. O **setor concluído** é o
único momento em que a carga retida vira saldo, e até aqui o número aparecia
somado no HUD sem ninguém ver de onde veio — agora mostra tempo, XP, carga,
materiais, itens, baús, abates, chefes e quedas, só o que não é zero. A espera
do setor dobrou para 10 s; a da onda continua em 5 s.

### Fase 5, passo 4 — o servidor MEDE, e não impede

**A correção de medição que destravou o passo.** Estava registrado que "no
setor 1 o teto fica três vezes ABAIXO do ganho honesto", e era esse número que
travava tudo. Aquilo foi medido em **XP** — e o livro-caixa não registra XP,
registra sucata, núcleo e cristal. Refeita em MOEDA:

| setor | moeda/s honesta | teto de registro/s | uso |
|---|---|---|---|
| 1 | 1,83 | 24,8 | 7,4% |
| 21 | 102,3 | 9.464,7 | 1,1% |
| 85 | 20.004 | 1.198.203 | 1,7% |
| 180 | 1.140.871 | 15.358.643 | **7,4%** |
| 300 | 1.601.305 | 79.077.022 | 2,0% |

Pior caso **7,4% em toda a faixa de 1 a 300** — folga de 13×. A fórmula nunca
esteve errada; estava sendo comparada com a grandeza errada.

Entrou `server/src/teto.ts` (importa `TAXA_DE_ENTRADA` e `sectorBounty` do
próprio jogo, sem cópia) e a tabela `excedentes`. Só o excedente é gravado,
com margem de 10×, então quem joga normal não gera uma linha. **A tabela ficar
vazia é o resultado esperado.**

### O teto do plano gratuito estava ~17× otimista

O `PLANO` dizia "cerca de 170 jogadores com a aba aberta o dia inteiro". Isso
supunha ~1 escrita por sincronização, verdade quando só o save subia. Com o
livro-caixa, o inventário e a progressão escrevendo junto são ~33 por ciclo:
**~5 jogadores**, não 170. Com a coleta líquida, ~10 em 24 h ou ~122 no perfil
de 2 h/dia.

### Um tutorial por tela

Catorze telas ganharam guia próprio, no mesmo motor do passeio de entrada —
furo no escuro, zoom no alvo, três a cinco passos. Abre na primeira vez que a
tela é ABERTA (não ao ser liberada: a liberação acontece no meio de uma luta),
e um "?" no cabeçalho comum da camada reabre.

**Dois defeitos meus no caminho.** O tutorial do Hangar foi escrito sob a
chave `hangar`, mas o id do painel é `frota` — o teste pegou na primeira
execução. E o gatilho, posto em `abrirCamada`, disparava a cada REDESENHO:
`renderPanel` roda no laço do jogo, então os balões empilhavam e fechar um
deixava a camada escura dos outros. Duas guardas: o `Shell` só dispara na
troca de tela, o `Game` recusa um segundo passeio.

### O histórico de migrações do D1 estava perdido

`d1_migrations` vazia com sete migrações já aplicadas. Sem histórico, o
`migrations apply` tentava reaplicar desde a 0002 — que é `ALTER TABLE ADD
COLUMN`, não é idempotente — falhava com "duplicate column name" e parava ali.
Por isso `itens`, `progresso` e `excedentes` nunca nasceram, e `/inventario`
respondia 500 (que o navegador relata como erro de CORS, porque resposta 500
não carrega o cabeçalho).

Reparado com `server/reparos/registrar-migracoes-ja-aplicadas.sql`. Verificado
depois: 10 registradas, as cinco tabelas criadas, `lotes` com as colunas
`usados_*`, e `/inventario`, `/progresso`, `/carteira` e `/lote` respondendo
**200**.

---

## Dívidas conhecidas

Coisas medidas e registradas. **A lista viva, com as decisões pendentes do
Rafael, está em [`PLANO.md`](PLANO.md)** — a tabela abaixo é o registro
histórico, incluindo o que já foi resolvido e o que se revelou artefato de
medição.

| O quê | Evidência | Onde resolve |
|---|---|---|
| **A galáxia 1 vem rápida demais no simulador** | 1,2 h contra a meta de ~10 h; as seguintes em 5,3 h, 10 h e 8,5 h. Ao vivo é bem mais lento: setor 5 em 2 h | Fase 4 — o simulador ainda corre ~2× à frente |
| **O laço ocioso trava sozinho na parede do chefe** | ao vivo, setor 5 dos 90 aos 120 min, mortes de 20 para 31. Cruzamento de "chefe exige farm" (1B.4) com "sem recuo automático" | **decisão de design pendente** — três saídas listadas na Fase 4 |
| **Itemização torta na origem** | ofensiva 3,07 contra defensiva 1,25, agora medidas contra o jogador real | Fase 3 — a assimetria persiste, mas as duas curvas estão ajustadas |
| **Dispersão de 135× entre itens da mesma raridade** | a métrica comparava SLOTS diferentes; por slot é 1,7× a 2,0× | ✅ era artefato de medição, não defeito |
| **O jogador aguenta 1,09× a 1,50× os golpes que a curva pretende** | o sinal virou: com 41 amostras por setor a razão CAÍA (0,71 → 0,57), e a causa era `DEFESA_A` 55% alto | ✅ resolvido em `3.9` — refeito o ajuste, razão em 1,12 a 0,90 |
| **`powerScore` é cego para vários atributos** | itens utilitários pontuam 0 e o auto-equipar erra | ✅ resolvido em `1.7` — 27 de 27 atributos |
| **Anel elemental com deriva de 5%** | 1,5 × 0,7 = 1,05; a especificação propõe 1,25 × 0,80 | Fase 2 · decisão pendente |
| **Mortes acumulam muito no fim** | 141 mortes até o setor 13 numa corrida do zero | Fase 4 |
| **Nave nua trava em onda de elite** | setor 4: 90 min, 67 mortes, 0 itens — inimigos escapam pela base e a onda é reposta com vida cheia | Fase 1B.1 |
| **Offline ainda rende mais itens que jogar** | remedido na Fase 4: setor 10 contra 8 e **368 itens contra 44**. Era 1.822 antes da correção. O caminho abstrato JÁ modela morte (133 contra 24) e já não banca recurso nenhum — o que resta é só o item | Fase 4 — precisa de uma corrida AO VIVO nova para comparar; os 44 são de antes da Fase 2 e da Fase 3 |
| **Escala de afixo fracionário** | crítico, sorte e sincronia escalavam com ilvl; sorte chegava a 3699% e o baú soltava Divino em metade dos itens | ✅ resolvido em `1.5` |
| **`sharp` com CVE de libvips** | `npm audit`; é ferramenta de build, não entra no bundle | etapa própria |

---

## Como verificar cada etapa

Os critérios de aceite completos estão no §6 da auditoria. Os comandos:

```bash
npm test                              # 48 testes
npm run simular -- curva 1 300        # dificuldade × poder, setor a setor
npm run simular -- ondas 40 42        # composição e variedade das ondas
npm run simular -- drops 200000       # distribuição real de raridade
npm run simular -- item 30            # dispersão de poder entre itens
npm run simular -- ajustar            # remede o poder e reajusta os expoentes
```

O último é o mais importante depois de qualquer mudança em afixos, cascos ou
Matriz: os expoentes em `curvas.ts` **descrevem** o jogo, e se o jogo mudar e
eles não, o ritmo desanda em silêncio.
