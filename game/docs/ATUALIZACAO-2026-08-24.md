# Atualização de desenvolvimento — 24/08/2026

Registro consolidado das entregas realizadas nesta sessão. Este arquivo é o
retrato de implementação do dia; para a direção futura, consulte
[`PLANO.md`](PLANO.md), e para a arquitetura permanente,
[`MAPA-DO-PROJETO.md`](MAPA-DO-PROJETO.md).

## Direção visual consolidada

As telas passaram a seguir a referência estabelecida pela **Provação** e pela
**Bancada de Afixos**: base quase preta, superfícies azul-marinho, linha cyan
discreta, cantos técnicos e cor saturada reservada a semântica (tipo, raridade,
perigo, estado ativo ou recompensa). Molduras não competem com o conteúdo;
brilho contínuo foi removido dos elementos secundários.

Essa gramática foi aplicada ou revisada em Missões, Baús, Loja, Códex, Craft e
Provação. A fonte e a hierarquia privilegiam título, decisão e progresso; ícones
e molduras não substituem texto nem são a única forma de comunicar estado.

## Laboratório de combate e calibração

O Laboratório deixou de ser apenas uma demonstração e se tornou ferramenta de
administração do combate.

- Catálogo visual de jogadores, inimigos e chefes; seleção por miniatura e
  rolagem posicionada automaticamente no item já escolhido.
- Prévia, no cenário, da nave do jogador e do inimigo atualmente selecionados,
  sem obrigar retorno à lista.
- Configuração independente de casco, tiros, elemento, dano, cadência,
  projéteis, movimento, sobrevivência, escudo, cenário e política de pilotagem.
- Alternância para visualizar casco do jogador sem shield.
- Editor de hitbox **para jogador e inimigo**: largura, altura, deslocamento X e
  Y, exibição da caixa em tempo real e controles rápidos durante o confronto.
- Filtro “somente não calibrados”, marca visual para caixas já revisadas e
  estado explícito de sucesso/falha ao salvar.
- O botão **Salvar** persiste na tabela versionada do jogo, não em save do
  jogador. Em desenvolvimento, o endpoint `POST /__lab/hitboxes` atualiza
  `src/data/hitbox-calibrations.json`; campanha e Laboratório passam a usar a
  mesma definição. O painel não é exposto na build publicada.
- Bateria de cenários para calibração: Elite, Enxame e Cerco; três sementes por
  cenário, com a base preparada para comparar precisão, DPS, dano recebido,
  abates e mortes.

Arquivos centrais: `src/ui/panels/LaboratorioPanel.ts`,
`src/sim/laboratorio.ts`, `src/app/LabCalibrationAdmin.ts`,
`src/data/hitbox-calibrations.ts`, `src/modes/vertical/VerticalMode.ts` e
`tests/laboratorio.test.ts`.

## Cascos, inimigos e balanceamento de confrontos

- As artes de `spaceships 2.0` foram incorporadas ao pipeline e classificadas
  como jogador, inimigo ou chefe; a nave “8” foi incluída como novo casco de
  jogador.
- As 29 artes novas de jogador foram transformadas em cascos reais. O Hangar e
  a campanha agora expõem os **49 cascos**; o desbloqueio econômico definitivo
  permanece deliberadamente para depois.
- Os novos inimigos e chefes receberam fichas, arte, elemento, famílias de tiro
  e presença em elencos de galáxia. O censo atual é de 68 inimigos e 30 chefes
  de galáxia.
- Foram executados **261 confrontos**: 29 cascos × Elite, Enxame e Cerco × três
  sementes. Vida, escudo, velocidade, escala, dano, cadência, quantidade de
  projéteis, perfuração e explosão foram ajustados.
- A revisão priorizou Artilharia, Duelista, Saturação e Suporte. O objetivo foi
  impedir uma família de tiro de dominar todos os cenários; a ficha e as
  medições estão em `CATALOGO-CASCOS.md` e nos relatórios de confrontos.

Arquivos centrais: `src/data/hulls-spaceships2.ts`,
`src/data/enemies-spaceships2.ts`, `src/data/hitbox-calibrations.ts`,
`src/data/hulls.ts` e relatórios `RELATORIO-*-CONFRONTOS*.md`.

## Missões, contatos e rastreamento

- A Central de Contratos foi reorganizada como tela de personagem: contatos à
  esquerda, dossiê/afinidade/confiança no centro e contratos à direita.
- As nove fichas passaram a carregar os retratos da pasta `Characters` por um
  atlas lazy (`characters`), em vez de blocos vazios ou imagens reaproveitadas.
  O pipeline remove o fundo branco opaco dos retratos de jogador.
- O enquadramento dos retratos foi corrigido para formato 3×4: o frame externo
  corta apenas a própria imagem e ancora a composição na base. Isso elimina
  vazamento de frames vizinhos no atlas e o “pedaço de outra imagem”.
- A escada de confiança foi redesenhada sem ícone concorrente: cada nível aberto
  é um hexágono preenchido cuja borda, preenchimento e conector usam a mesma cor
  do contato; níveis fechados usam cinza-azulado neutro.
- O card de contrato mantém a cor do **tipo de missão**, inclusive quando está
  pronto para entregar; “Entregar” não força borda verde. A confiança deixou de
  ficar comprimida em uma moldura separada.
- O rastreador da partida é deliberadamente mínimo: sem caixa, X, hover ou
  título redundante. Mostra somente nome, progresso e estado, sobre o cenário.
- O limite de missões rastreadas subiu de 2 para **4**. A tela principal ganhou
  atalho de missão rastreada e progresso, além do acesso direto a pilotagem
  manual/Idle.
- O palco de combate passou a preencher a área disponível; a limitação lógica
  que deixava faixas pretas laterais foi removida.

Arquivos centrais: `src/ui/panels/MissoesPanel.ts`, `src/ui/dom.ts`,
`src/styles/main.css`, `src/ui/LeftRail.ts`, `src/sim/missoes.ts`,
`src/sim/state.ts` e `tools/build-assets.mjs`.

## Provação

- Foi implementado o layout de Núcleo de Provação e sua linguagem visual passou
  a servir de padrão para as telas de trabalho do jogo.
- Cinco modificadores mecânicos estão ativos no combate: invulnerabilidade
  cíclica, zonas de perigo telegrafadas, clones, barreira frontal e pontos
  fracos móveis.
- O sistema mantém 100 pisos, tentativas recuperadas por tempo, marcos e
  recompensa de primeira conclusão. A arte de chefe ainda usa seis sprites em
  rodízio: as 100 artes dedicadas continuam pendentes.

Arquivos centrais: `src/ui/panels/ProvacaoPanel.ts`,
`src/ui/ProvacaoResultado.ts`, `src/sim/provacao.ts`, `src/sim/desafio.ts` e
`src/modes/vertical/VerticalMode.ts`.

## Baús, Loja, Craft e economia

### Baús

- Quatro cápsulas com artes próprias: Bronze, Prata, Ouro e Singularidade.
- Cada uma usa probabilidades explícitas das sete raridades; Sorte afeta apenas
  drop de combate, nunca abertura de baú.
- A revelação e a luz atrás do baú usam a cor do item de **maior sinal** da
  abertura. A camada de aura foi posicionada atrás da caixa, não sobre ela.
- Sete assinaturas de raridade respeitam a preferência de reduzir efeitos.

### Loja e Bancada de Modulação

- A Loja virou Central de Serviços: capacidade de carga, Matriz, tentativa de
  Provação e câmbio com cota/perda, sem vender atributo direto.
- Cada serviço usa ícone próprio, sem reutilizar ícones de outras áreas.
- Recalibração de Prefixo/Sufixo saiu da Loja e ganhou a Bancada de Modulação,
  com operação por item e manutenção de raridade, ilvl, base, elemento,
  conjunto, tier, natureza e exclusões.

### Fabricação

- A Câmara de Síntese foi padronizada visualmente com Provação, Afixos e
  Missões. As três colunas continuam sendo Inventário, reator central e receitas,
  mas agora têm superfícies escuras, títulos técnicos discretos e uma única
  prioridade de brilho: o encaixe/ação que está pronta.
- As cores de raridade permanecem nos itens e nas receitas. Cyan é foco e
  navegação; não é mais uma moldura luminosa concorrendo com a decisão de fusão.
- As molduras artísticas antigas permanecem somente como fallback de asset. O
  layout de produção é CSS responsivo e mantém a leitura em três, duas ou uma
  coluna conforme a largura.

### Recursos e descarte

- O catálogo consolidado possui 70 recursos, incluindo fontes por galáxia,
  missão, Provação e evento. Gases não são drop genérico até o sistema de eventos
  ter regra fechada.
- O item pode ser vendido por moeda ou desmontado. A venda produz Sucata; o
  desmanche devolve materiais conforme tier e nível. A economia está registrada
  em `BALANCEAMENTO-RECURSOS.md`, `ECONOMIA-RECURSOS.md` e
  `ECONOMIA-DESCARTE.md`.

Arquivos centrais: `src/ui/panels/ChestsPanel.ts`, `src/data/chests.ts`,
`src/ui/panels/ShopPanel.ts`, `src/ui/panels/AffixCraftPanel.ts`,
`src/data/balance/recalibracao.ts`, `src/data/balance/descarte.ts`,
`src/data/recursos.ts`, `src/data/eventos.ts` e `tools/build-assets.mjs`.

## Códex, acessibilidade e persistência

- O Códex foi ampliado para chefes, inimigos comuns/elites, cascos, itens,
  recursos/fontes e relações elementais, e recebeu o mesmo padrão de moldura,
  fundo técnico e hierarquia da Provação/Afixos.
- Navegação de abas por teclado, foco visível, rótulos para leitor de tela,
  contraste alternativo e região de notificações estão disponíveis como base de
  acessibilidade. Campanha e Provação aceitam Idle ou controle manual por WASD
  e setas.
- O save está em **v5**. A migração normaliza preferências, frota, casco,
  recursos e missões rastreadas, limita a lista a quatro ids válidos e preserva
  saves antigos sem bloquear o boot. Save de versão futura continua recusado.

Arquivos centrais: `src/ui/panels/CodexPanel.ts`, `src/ui/Shell.ts`,
`src/ui/panels/SettingsPanel.ts`, `src/sim/state.ts` e `src/modes/vertical`.

## Verificação ao fechar esta atualização

Em 24/08/2026, após as alterações acima:

- `npm test -- --run`: **29 arquivos passaram; 527 testes passaram; 1 todo**.
- A documentação mantém pendências como pendências: arte dedicada para os 100
  chefes da Provação, som, onboarding, auditoria completa de teclado/contraste e
  definição final de desbloqueios de casco.
