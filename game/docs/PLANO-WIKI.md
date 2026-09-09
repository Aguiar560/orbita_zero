# Planejamento da Wiki do Órbita Zero

## 1. Objetivo

Criar uma referência completa, pesquisável e mantida junto do jogo para três
necessidades diferentes:

1. **Ensinar o jogador** sem exigir que ele descubra sistemas por tentativa.
2. **Catalogar o conteúdo** real do jogo: naves, galáxias, itens, inimigos,
   recursos, missões e recompensas.
3. **Preservar conhecimento interno** de operação e desenvolvimento sem expor
   dados sensíveis, regras antifraude ou conteúdo ainda não lançado.

A wiki não deve ser uma cópia dos documentos atuais. `docs/` contém decisões,
histórico e especificações técnicas; a wiki será a leitura organizada e atual
do produto.

## 2. Decisão de produto

### Endereço e integração

- Wiki pública em `https://www.orbitazero.com.br/wiki/`.
- Link **WIKI** na landing page e dentro do menu de ajuda do jogo.
- Mesma identidade visual da landing page, mas com leitura mais limpa.
- Funciona sem login; páginas com progresso pessoal podem ganhar integração
  posteriormente.
- PT-BR no lançamento, com estrutura preparada para `en-US` sem duplicar ids.

Usar `/wiki` evita outro domínio, outra configuração de login e outra política
de cookies. Também concentra autoridade de busca no domínio oficial.

### Duas áreas, duas permissões

| Área | Público | Conteúdo |
|---|---|---|
| Wiki do Piloto | qualquer visitante | regras, guias, catálogos, lore e suporte |
| Manual de Comando | administradores e equipe | operação, métricas, incidentes, deploy, segurança e autoria |

O Manual de Comando não deve ser publicado como arquivos estáticos acessíveis
por URL. Ele precisa reutilizar a autorização administrativa já aplicada ao
painel Comando.

## 3. Princípios editoriais

1. **O código e os dados vencem o texto.** Números de catálogos e tabelas vêm de
   `src/data`, e fórmulas vêm de `src/sim`.
2. **Conteúdo implementado e conteúdo planejado não se misturam.** A wiki
   pública documenta apenas o que pode ser jogado na versão publicada.
3. **Spoiler é uma escolha do leitor.** Chefes, contratos especiais e narrativa
   avançada usam avisos e trechos recolhidos.
4. **Uma regra é explicada uma vez.** Outras páginas apontam para a fonte, sem
   manter cópias divergentes.
5. **Toda página responde primeiro “para que serve?”.** Fórmulas vêm depois.
6. **Sem dados pessoais.** Nunca publicar e-mail, UUID, saldo por conta,
   histórico de chat ou identificadores administrativos.
7. **Sem detalhes exploráveis.** Tetos antifraude, validação de lotes, sementes,
   limites de confiança e procedimentos internos ficam na área privada.

## 4. Arquitetura da informação pública

### 4.1 Início

- O que é Órbita Zero
- Estado atual do jogo e versão
- Como começar em cinco minutos
- Principais sistemas
- Novidades da versão
- Busca geral
- Atalhos: Naves, Galáxias, Itens, Missões e Suporte

### 4.2 Primeiros passos

- Criar conta, entrar e login com Google
- Escolha do piloto inicial
- Tutorial e primeira incursão
- Anatomia da interface
- Navegação no desktop
- Navegação no celular
- Modo IDLE e modo PILOTAR
- Posturas da IA: agressiva, evasiva e coletora
- Como salvar e continuar em outro aparelho
- Primeiros objetivos recomendados

### 4.3 Campanha e combate

- Estrutura da campanha: 30 galáxias e 300 setores
- Setores, fases, cinco ondas e chefe
- Tipos de encontro: onda, elite, patrulha e chefe
- Vida, casco, escudo e regeneração
- Dano normal e dano elemental
- Resistências, vantagens e neutralidade elemental
- Tiros, projéteis, crítico, cadência e alcance
- Movimento da IA e controle manual
- Morte, recuperação e repetição de setor
- Ganhos durante a incursão e consolidação no servidor
- Progresso offline
- Mensagens e alertas do campo de combate

### 4.4 Progressão

- Nível do personagem e patente
- XP do personagem
- Nível e XP individual de cada nave
- Poder da nave: o que representa e o que não representa
- Progressão por galáxia
- Desbloqueios de telas
- Marcos atuais:
  - Baús no nível 6
  - Fabricação no nível 10
  - Loja no nível 14
  - Engenharia de afixos no nível 21
  - Provação no nível 30
- Matriz de Comando
- Oito ramos e 177 nós
- Alocação e reconfiguração
- Construções recomendadas, sem declarar uma construção universalmente melhor

### 4.5 Naves e Hangar

- Como liberar uma nave
- Como trocar a nave em campo
- Progressão independente por casco
- Arquétipos e famílias de tiro
- Elemento nativo e compatibilidade
- Atributos base
- Soquetes e anatomia de cada nave
- Comparação de naves
- Catálogo dos 53 cascos
- Página individual de cada casco:
  - arte e nome
  - forma de obtenção
  - requisito
  - arquétipo e tiro
  - atributos base
  - elemento
  - pontos fortes e limitações
  - soquetes
  - conteúdo em que se destaca
  - lore
  - naves relacionadas

### 4.6 Equipamentos e Inventário

- Os dez tipos de slot
- Bases de equipamento
- Nível e tier do item
- Sete raridades
- Prefixos e sufixos
- Atributos ofensivos, defensivos e utilitários
- Poder do item
- Elemento de item
- Quatro conjuntos e bônus de conjunto
- Equipar por duplo clique e por arraste
- Favoritar item
- Filtros, ordenação e comparação
- Selecionar todos conforme o filtro
- Venda, desmontagem e confirmação
- Capacidade do inventário e todas as fontes de expansão
- Inventário cheio e tratamento de excedentes
- Catálogo das 80 bases
- Catálogo dos 35 afixos
- Catálogo dos conjuntos

### 4.7 Economia, recursos e fabricação

- Sucata, núcleo e cristal
- Separação entre inventário e Armazém
- Catálogo dos 70 recursos
- Fontes de cada recurso
- Usos e sumidouros de cada recurso
- Recursos de galáxia, missão, evento, chefe e Provação
- Baús: tipos, conteúdo e probabilidades divulgáveis
- Fabricação e receitas
- Fusão e sacrifício de itens
- Engenharia de prefixos e sufixos
- Recalibração elemental
- Venda versus desmontagem
- Central de Serviços
- Módulos de carga
- Reconfiguração da Matriz
- Cargas de Provação
- Câmbio e limites de compra
- Compras, Pix, entrega e histórico
- Passe VIP: benefícios, duração e limites

### 4.8 Galáxias

- Mapa geral das 30 galáxias
- Como desbloquear e navegar
- Modificadores regionais
- Página individual por galáxia:
  - nome, número e elemento
  - setores abrangidos
  - atmosfera e lore
  - inimigos principais
  - ameaças
  - recursos exclusivos
  - missões e contato associado
  - chefe
  - recompensas e nave desbloqueável
- As informações ainda não encontradas pelo jogador aparecem sob aviso de
  spoiler; no futuro podem respeitar o progresso da conta.

### 4.9 Inimigos e chefes

- Tipos de inimigo e comportamento
- Frotas e formações
- Elementos e resistências
- Catálogo dos 68 inimigos
- Catálogo das 24 unidades de frota
- Catálogo dos 30 chefes de galáxia
- Página de chefe:
  - localização
  - fases e ataques
  - elemento e resistências
  - sinais visuais
  - preparação recomendada
  - recompensas
  - lore

### 4.10 Missões, contatos e narrativa

- Como aceitar, rastrear e entregar uma missão
- O progresso só começa após a aceitação
- Tipos: principal, aliado, galáxia e especial
- Objetivos: eliminação, coleta, entrega e progressão
- Cadeias e pré-requisitos
- Nove contatos
- Afinidade e níveis de confiança
- Contratos especiais e recompensa exclusiva
- Catálogo pesquisável das 499 missões
- Uma página por cadeia, com cada etapa indexada, em vez de 499 textos manuais
- Resumos sem spoiler; detalhes e desfechos ficam recolhidos

### 4.11 Provação

- O que é o Núcleo de Provação
- Requisito de acesso
- Tentativas e recuperação
- Estrutura dos 100 pisos
- Camadas e marcos
- Poder recomendado
- Modificadores e combinações
- Chefes e mecânicas especiais
- Recompensas por piso, primeira conclusão e marcos
- Ranking e registros
- Catálogo dos 100 chefes e 18 especiais, gerado a partir dos dados

### 4.12 Eventos

- Como eventos aparecem
- Duração e disponibilidade
- Objetivos e recompensas
- Recursos exclusivos
- Eventos ativos
- Arquivo de eventos encerrados
- Regras para conteúdo sazonal

### 4.13 Códex e universo

- Linha do tempo
- Facções
- Personagens jogáveis
- Contatos
- Lugares e biomas
- Tecnologia, elementos e recursos
- Entradas do Códex
- Música e catálogo sonoro
- Galeria de arte

### 4.14 Ranking e temporadas

- Temporada atual
- Categorias do ranking
- Critérios de classificação
- Regras de desempate
- Atualização dos placares
- Privacidade do apelido
- Recompensas, quando aplicável
- Histórico de temporadas

### 4.15 Comunidade e chat

- Chat global
- Conversas privadas
- Solicitações e bloqueios
- Denúncia e moderação
- Conduta da comunidade
- Privacidade e retenção
- Como obter suporte
- Canais oficiais e aviso contra perfis falsos

### 4.16 Conta, configurações e suporte

- Conta por e-mail e por Google
- Apelido obrigatório
- Sessão e segurança
- Save local e save em nuvem
- Sincronização entre aparelhos
- Sair da conta
- Apagar progresso e desconexão
- Recuperação de acesso
- Configurações de som, vídeo e interface
- Acessibilidade e alto contraste
- Desempenho e modo de qualidade
- Solução de problemas:
  - login não volta ao jogo
  - item demora para aparecer
  - save não sincroniza
  - chat não conecta
  - tela móvel não responde
  - inventário cheio
- Estado dos servidores
- Política de privacidade, termos e contato

## 5. Manual de Comando privado

### Operação

- Visão geral do painel administrativo
- Jogadores online e atividade
- Progressão, galáxias e distribuição de níveis
- Economia, saldos e fluxo de recursos
- Frota, itens e raridades
- Missões e taxas de conclusão
- Saúde dos saves e cadastros
- Ranking e temporadas
- Compras, conciliação e entrega
- Moderação do chat

### Procedimentos

- Publicação do frontend
- Publicação dos Workers
- Ordem correta: migração, validação e deploy
- Backup, restauração e reparos
- Incidente de login
- Incidente de sincronização
- Incidente de economia
- Incidente de pagamento
- Incidente de chat
- Rotação e revogação de acessos
- Atendimento e exclusão de conta

### Desenvolvimento de conteúdo

- Adicionar nave
- Adicionar galáxia
- Adicionar inimigo e chefe
- Adicionar item, afixo e conjunto
- Adicionar missão e cadeia
- Adicionar recurso e receita
- Adicionar evento
- Pipeline de arte e áudio
- Balanceamento e testes obrigatórios
- Migração de save e banco

## 6. Modelo padrão de página

Toda página de sistema terá:

1. Resumo em uma frase.
2. Onde fica no jogo.
3. Quando é desbloqueado.
4. Para que serve.
5. Como funciona, em passos.
6. Custos, entradas e saídas.
7. Regras e limites.
8. Exemplo real.
9. Dicas e erros comuns.
10. Conteúdo relacionado.
11. Versão em que foi revisada.

Páginas de catálogo acrescentam obtenção, atributos, arte, elemento, raridade,
recompensas e referências cruzadas. Conteúdo não obtível recebe selo
**Ainda não disponível**, nunca descrição como se estivesse lançado.

## 7. Fonte de verdade e automação

### Conteúdo gerado

Um gerador de wiki deve importar diretamente:

| Assunto | Fonte principal |
|---|---|
| galáxias | `src/data/galaxies.ts` |
| naves | `src/data/hulls.ts`, `hulls-spaceships2.ts`, `hulls-lore.ts` |
| itens e afixos | `src/data/items.ts`, `src/data/rarity.ts` |
| recursos | `src/data/recursos.ts`, `src/data/balance/economia-recursos.ts` |
| inimigos | `src/data/enemies.ts`, `enemies-spaceships2.ts` |
| chefes | `src/data/bosses.ts`, `src/data/provacao-chefes.ts` |
| missões | `src/data/missoes.ts`, `missoes-cadeias.ts` |
| contatos | `src/data/personagens.ts`, `balance/contatos.ts` |
| pilotos | `src/data/pilotos.ts` |
| Provação | `src/data/provacao.ts`, `provacao-especiais.ts` |
| loja | `src/data/shop.ts` |
| desbloqueios | `src/data/screen-unlocks.ts` |
| Matriz | `src/data/tree.ts` |
| eventos | `src/data/eventos.ts` |
| baús | `src/data/chests.ts` |

Descrições editoriais ficam separadas em conteúdo da wiki, referenciando ids
estáveis. O build combina os dois. Não copiar tabelas numéricas para Markdown.

### Validações automáticas

O build da wiki deve falhar quando:

- um id referenciado não existe;
- uma entrada pública não tem nome ou descrição;
- o total publicado diverge das tabelas;
- há link interno quebrado;
- uma imagem obrigatória não existe no manifesto;
- uma página não informa revisão/versão;
- conteúdo marcado como privado entra no pacote público.

Também deve gerar índice de busca, `sitemap.xml`, metadados sociais e páginas
404 úteis.

## 8. Busca e navegação

- Busca tolerante a acentos e pequenas diferenças de escrita.
- Pesquisa por nome visível, id, categoria, elemento e origem.
- Filtros por raridade, elemento, galáxia, slot, missão e obtenção.
- Navegação lateral por categoria no desktop.
- Sumário recolhível e busca fixa no celular.
- Breadcrumbs em todas as páginas.
- Links cruzados: recurso → fontes e usos; chefe → galáxia e recompensas; nave
  → obtenção e itens compatíveis; missão → contato e pré-requisitos.
- Comando rápido para copiar link direto de uma seção.

## 9. Direção visual

- Visual do cockpit e da landing page, sem sacrificar leitura.
- Fundo escuro, ciano para navegação e amarelo para destaques.
- Vermelho reservado a perigo, bloqueio e alertas.
- Cards para catálogos; texto corrido para guias.
- Imagens WebP e carregamento preguiçoso.
- Tabelas responsivas que viram cartões no celular.
- Contraste AA, foco visível e navegação completa por teclado.
- Nada de tooltip nativo do navegador; explicações usam o componente do jogo.

## 10. Métricas da wiki

Medir somente o necessário:

- páginas mais acessadas;
- buscas mais frequentes;
- buscas sem resultado;
- artigos que antecedem abertura de suporte;
- dispositivo e desempenho agregados;
- links quebrados e erros de carregamento.

Não associar leitura de artigo a saldo, inventário ou histórico individual do
jogador. Consultas sem resultado devem orientar o próximo conteúdo editorial.

## 11. Etapas de implementação

### Fase 0 — Inventário e contrato

- Congelar esta arquitetura da informação.
- Definir campos públicos e privados por tipo de dado.
- Criar registro de versão da wiki.
- Criar teste de censo para todos os catálogos.

**Entrega:** esquema editorial, mapa de URLs e matriz fonte → página.

### Fase 1 — Fundação navegável

- Rota `/wiki/`.
- Layout, menu, breadcrumbs, busca e responsividade.
- Página inicial, Primeiros Passos e índice de sistemas.
- SEO, sitemap, 404 e metadados.

**Entrega:** wiki utilizável com 8 a 12 páginas essenciais.

### Fase 2 — Sistemas centrais

- Combate, progressão, inventário, anatomia, elementos, economia, fabricação,
  Hangar, Matriz, missões e conta.
- Capturas reais das telas em desktop e celular.
- Fluxogramas apenas para sincronização, itemização e progressão.

**Entrega:** 30 a 45 páginas editoriais cobrindo todas as telas jogáveis.

### Fase 3 — Catálogos automáticos

- Gerador a partir de `src/data`.
- Naves, galáxias, itens, afixos, recursos, inimigos, chefes e Provação.
- Filtros e referências cruzadas.

**Entrega:** centenas de entradas pesquisáveis sem manutenção manual de números.

### Fase 4 — Narrativa e comunidade

- Personagens, contatos, cadeias de missão, Códex, eventos e temporadas.
- Sistema de spoiler.
- Chat, conduta, moderação e suporte.

**Entrega:** universo e sistemas sociais documentados.

### Fase 5 — Manual de Comando

- Área protegida por conta administrativa.
- Runbooks, métricas, pagamentos, moderação e incidentes.
- Links contextuais a partir do painel Comando.

**Entrega:** operação do jogo deixa de depender de memória ou conversa antiga.

### Fase 6 — Governança contínua

- Checklist de documentação em toda funcionalidade nova.
- Testes no CI.
- Histórico de versões.
- Revisão editorial periódica.
- Relatório de páginas desatualizadas.

**Entrega:** wiki acompanha cada release sem mutirão posterior.

## 12. Prioridade editorial inicial

Ordem recomendada para gerar valor cedo:

1. Primeiros passos e interface móvel.
2. Inventário, anatomia, equipar, vender e desmontar.
3. Naves, elementos e poder.
4. Campanha, galáxias e progressão.
5. Recursos, fabricação, Engenharia e Loja.
6. Missões e contatos.
7. Provação, ranking e eventos.
8. Conta, sincronização e solução de problemas.
9. Catálogos completos.
10. Manual privado de operação.

## 13. Critérios de aceite

A primeira versão completa só está pronta quando:

- todas as telas do menu têm uma página;
- todos os desbloqueios têm requisito e explicação;
- todas as moedas e recursos têm fonte e uso;
- todos os cascos, galáxias, chefes, slots, raridades e conjuntos aparecem na
  busca;
- todas as missões podem ser encontradas pelo nome e pela cadeia;
- nenhum conteúdo planejado aparece como disponível;
- nenhuma informação privada ou antifraude está no build público;
- não há links ou imagens quebrados;
- busca, menu e tabelas funcionam no celular;
- login, jogo e chat não são afetados pela rota `/wiki`;
- o censo gerado coincide com as tabelas do jogo;
- cada página informa a versão da última revisão.

## 14. Escopo estimado

- **Páginas editoriais:** aproximadamente 45 a 60.
- **Entradas geradas:** centenas, cobrindo o catálogo completo.
- **Modelos de página:** sistema, guia, nave, galáxia, item, recurso, inimigo,
  chefe, missão/cadeia, personagem e artigo de suporte.
- **Primeiro marco publicável:** Fundação + Primeiros Passos + sistemas centrais.
- **Marco de completude:** catálogos gerados, narrativa, suporte e Manual de
  Comando privado.

O trabalho deve ser entregue por fases pequenas e publicáveis. A wiki não deve
esperar todas as centenas de entradas para começar a ajudar jogadores.
