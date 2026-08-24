# Economia de recursos — mapa mestre

> Fonte de verdade executável: `src/data/recursos.ts`  
> Revisão: 23/08/2026

## Decisão estrutural

O catálogo tem **70 materiais**, além das três moedas globais já existentes
(Sucata, Núcleos e Cristais). Não serão criadas novas moedas para representar
materiais: cada item abaixo vive no Armazém e tem uma fonte e um papel claros.

| Família | Quantidade | Fonte exclusiva/primária | Papel econômico |
|---|---:|---|---|
| Minérios e metais | 20 | Galáxias 1–20 | Base de casco, armas, motores e fusão |
| Ligas e exóticos | 10 | Galáxias 21–30 | Craft avançado e dimensional |
| Gases e plasmas | 10 | Eventos | Receitas sazonais e modificadores temporários |
| Orgânicos | 10 | Missões | Contratos, pesquisa xeno e craft biológico |
| Tecnologia | 10 | Chefes | Sistemas especiais e craft de alto nível |
| Pós e essências | 10 | Provação | Operações determinísticas de craft e fim de jogo |

Regra de ouro: conteúdo exclusivo não deve cair de inimigo comum nem aparecer
na Loja. A Loja vende serviço; o material faz o jogador voltar ao modo que o
produz.

## Recursos próprios das 30 galáxias

Todos os dez setores de uma galáxia entregam seu material-assinatura ao serem
concluídos. Isso torna o mapa uma ferramenta de farm: o jogador vê o ícone no
cabeçalho da galáxia e sabe para onde voltar.

| Galáxia | Material | Função definida | Arte | Uso hoje |
|---:|---|---|---|---|
| 1 — Berço de Vega | Ferrita | Fusão comum e estruturas básicas | 2.0 | Ativo |
| 2 — Corte de Ferro | Pirita | Revestimentos e circuitos iniciais | 2.0 | Planejado |
| 3 — Mar de Cinzas | Diamantita | Reforço de armas e precisão | 2.0 | Planejado |
| 4 — Pálio Verde | Titânio | Fusão rara e cascos resistentes | 2.0 | Ativo |
| 5 — Fenda de Rhodes | Urânio | Reatores e munição irradiada | 2.0 | Planejado |
| 6 — Coroa Quebrada | Platina | Sensores e eletrônica de precisão | 2.0 | Planejado |
| 7 — Longa Noite | Irídio | Motores resistentes a calor | 2.0 | Planejado |
| 8 — Alto Silêncio | Obsidiana | Blindagem térmica | 2.0 | Planejado |
| 9 — Véu de Âmbar | Lítio | Células de energia e escudo | 2.0 | Planejado |
| 10 — Última Página | Cobalto | Torres e propulsores magnéticos | 2.0 | Planejado |
| 11 — Forja Fria | Neodímio | Ímãs de armas, drones e motores | 2.0 | Planejado |
| 12 — Jardim de Óxido | Cromita | Proteção anticorrosiva | 2.0 | Planejado |
| 13 — Anel de Tétis | Zircônio | Cerâmica de reator | 2.0 | Planejado |
| 14 — Garganta Azul | Ródio | Catalisadores e sensores raros | 2.0 | Planejado |
| 15 — Espinha do Vazio | Vanádio | Ligas leves e cadência | 2.0 | Planejado |
| 16 — Nona Aurora | Níquel | Estruturas e baterias industriais | 2.0 | Planejado |
| 17 — Campo de Lázaro | Molibdênio | Armas de alta temperatura | 2.0 | Planejado |
| 18 — Trono Oco | Tântalo | Capacitores avançados | 2.0 | Planejado |
| 19 — Maré de Prata | Tecnécio | Sistemas experimentais | 2.0 | Planejado |
| 20 — Fim da Linha | Manganês | Ligas de impacto | 2.0 | Planejado |
| 21 — Caldeira de Asterion | Escória Estelar | Fundição estelar e dano de fogo | 2.0 | Planejado |
| 22 — Cemitério de Khepri | Fragmento de Meteoro | Blindagem e impacto cinético | 2.0 | Planejado |
| 23 — Tear de Nyx | Nanofibra | Estruturas leves | 2.0 | Planejado |
| 24 — Lâmina de Carbono | Grafeno | Escudos e dissipadores | 2.0 | Planejado |
| 25 — Prisma de Eos | Cristal Quântico | Fusão épica e recalibração | 2.0 | Ativo |
| 26 — Colmeia de Ícaro | Nanotubo | Suportes ultraleves | 2.0 | Planejado |
| 27 — Forja de Antares | Aço Estelar | Fusão lendária e chassis | 2.0 | Ativo |
| 28 — Coroa de Caelum | Liga Celestial | Componentes míticos | 2.0 | Planejado |
| 29 — Dobra de Janus | Fluxo Dimensional | Espaço e alteração de afixos | 2.0 | Planejado |
| 30 — Umbra Terminal | Matéria Escura | Projetos de fim de jogo | 2.0 | Planejado |

Sete materiais galácticos também podem vir da desmontagem, em pares por
raridade: Ferrita, Titânio, Cristal Quântico, Aço Estelar, Liga Celestial,
Fluxo Dimensional e Matéria Escura. Recursos exclusivos de Missão, Evento,
Chefe e Provação nunca são produzidos dessa forma. A fórmula completa está em
[`ECONOMIA-DESCARTE.md`](ECONOMIA-DESCARTE.md).

## Recursos exclusivos de missões

Orgânicos não caem em planetas comuns. Entram como pagamento de contratos,
cadeias de personagem e missões temáticas.

| Material | Onde dropa | Função | Arte | Estado |
|---|---|---|---|---|
| Biogel | Medicina do Vácuo I | Reparo biológico e entregas | 2.0 | Drop ativo |
| Esporo Alienígena | Medicina do Vácuo II | Pesquisa de fauna | 2.0 | Drop ativo |
| Tecido Vorg | Contrafogo/Vorg | Armaduras flexíveis | 2.0 | Drop ativo |
| Núcleo Orgânico | Medicina do Vácuo III | Drones vivos | 2.0 | Drop ativo |
| Essência Xeno | O Outro Lado I | Recalibração orgânica | 2.0 | Drop ativo |
| Pele Quântica | Missões de item raro | Escudos adaptativos | 2.0 | Drop ativo |
| Cristal Vivo | O Outro Lado II | Autorregeneração | 2.0 | Drop ativo |
| Alga Estelar | Jardins sem Sol I | Combustível biológico | 2.0 | Drop ativo |
| Néctar Estelar | Jardins sem Sol II | Catalisador de confiança | 2.0 | Drop ativo |
| Polpa Nebular | Jardins sem Sol III | Projetos nebulosos | 2.0 | Drop ativo |

## Recursos exclusivos de eventos

Os eventos usam uma rotação determinística de **72 horas**. Cada ocorrência
possui objetivo, requisito de setor, progresso salvo e um único gás para
resgatar. Gases não aparecem em nenhuma tabela genérica de planeta ou inimigo.

| Material | Evento/tema previsto | Função | Arte |
|---|---|---|---|
| Gás Hélio-3 | Corrida de Propulsores | Receitas de velocidade | 2.0 |
| Deutério | Colapso de Fusão | Energia e fusão | 2.0 |
| Xenônio | Tempestade Iônica | Lasers e íons | 2.0 |
| Argônio | Cerco Inerte | Blindagem | 2.0 |
| Neônio | Festival do Sinal | Sinalização e velocidade | 2.0 |
| Radônio | Quarentena Vermelha | Dano radioativo | 2.0 |
| Plasma Estelar | Nascimento de Estrela | Energia estelar | 2.0 |
| Criogás | Inverno do Vazio | Gelo e controle | 2.0 |
| Gás Vulcânico | Erupção Orbital | Fogo e explosão | 2.0 |
| Gás Exótico | Anomalia sazonal | Coringa de receita especial | 2.0 |

## Recursos exclusivos de chefes

Cada chefe recebe por hash estável um destes dez componentes e sempre derruba
o mesmo. Repetir um chefe, portanto, é uma decisão de farm e não um sorteio
cego.

| Material | Função | Arte | Uso hoje |
|---|---|---|---|
| Núcleo de Energia | Sistemas de energia e fusão mítica | 2.0 | Ativo |
| Micro Reator | Motores e potência | 2.0 | Planejado |
| Célula Quântica | Escudos quânticos | 2.0 | Planejado |
| Fragmento de Singularidade | Craft dimensional | 2.0 | Planejado |
| Matriz Neural | IA e drones | 2.0 | Planejado |
| Artefato Alien | Projetos alienígenas e códex | 2.0 | Planejado |
| Runa Estelar | Afixos especiais | 2.0 | Planejado |
| Lente Gravitacional | Armas gravitacionais | 2.0 | Planejado |
| Protótipo | Equipamento exclusivo de chefe | 2.0 | Planejado |
| Fragmento Divino | Fusão divina | 2.0 | Ativo |

## Recursos exclusivos da Provação

A Provação entrega essências em degraus: Pó Lunar nos pisos iniciais; um novo
par a cada vinte pisos; Essência Primordial somente a partir do piso 95.

| Material | Pisos | Operação de craft definida | Arte | Uso hoje |
|---|---:|---|---|---|
| Pó Lunar | 1–19 | Remoldar linha | 2.0 | Ativo |
| Rolha de Asteroide | 20–39 | Ancorar propriedade | 2.0 | Ativo |
| Areia Estelar | 20–39 | Lapidar valor | 2.0 | Ativo |
| Cinzas Cósmicas | 40–59 | Dissolver linha | 2.0 | Ativo |
| Crista Meteórica | 40–59 | Imprimir prefixo | 2.0 | Ativo |
| Sangue de Estrela | 60–79 | Ascender tier | 2.0 | Ativo |
| Lágrima Galáctica | 60–79 | Imprimir sufixo | 2.0 | Ativo |
| Átomo Raro | 80–94 | Transpor polaridade | 2.0 | Ativo |
| Fragmento Temporal | 80–100 | Eco temporal | 2.0 | Ativo |
| Essência Primordial | 95–100 | Aperfeiçoamento primordial | 2.0 | Ativo |

## Auditoria das artes

As **70 imagens de `Recursos 2.0` estão finalizadas**. Todas passaram pela
auditoria de PNG, resolução e canal alfa; a folha visual de conferência fica em
`.qa/recursos-2.0-contact-sheet.png`. O atlas exporta os ícones com lado máximo
de 160 px, sem alterar as fontes de alta resolução.

## O que já funciona e o que falta

### Funciona agora

- 30 materiais-assinatura ligados deterministicamente às 30 galáxias.
- Material da galáxia exibido no mapa com ícone.
- Dez tecnologias distribuídas deterministicamente entre chefes.
- Dez essências distribuídas pelas faixas da Provação.
- Tecido Vorg e Pele Quântica entregues por missões existentes.
- Armazém mostra fonte, função, disponibilidade e estado da arte.
- 42 artes 2.0 entram no atlas sem processamento destrutivo.

### Estado desta etapa

Os seis itens planejados foram implementados. Custos, quantidades e tempos-alvo
estão detalhados em [`BALANCEAMENTO-RECURSOS.md`](BALANCEAMENTO-RECURSOS.md).
