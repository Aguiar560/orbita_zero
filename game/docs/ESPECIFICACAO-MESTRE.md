ESPECIFICAÇÃO MESTRE DE DESENVOLVIMENTO

## Objetivo geral

Atue como Game Designer Sênior, Systems Designer e Desenvolvedor Sênior de Jogos, considerando o projeto como um sistema integrado de longo prazo.

O objetivo desta especificação é reorganizar e expandir os sistemas atuais do jogo sem criar soluções temporárias ou incompatíveis com funcionalidades futuras.

Não é necessário implementar tudo em uma única sessão.

Antes de desenvolver, divida o trabalho em etapas por:

dependências;
impacto estrutural;
importância para o balanceamento;
risco de retrabalho;
custo de implementação.

Primeiro devem ser construídas as fundações de dados e balanceamento. Sistemas dependentes dessas fundações devem ser implementados posteriormente.

Todas as decisões, estruturas de dados, fórmulas e regras relevantes devem ficar documentadas.

# 1. PRINCÍPIOS GERAIS DO BALANCEAMENTO

O jogo é um idle/progression shooter espacial, portanto a progressão deve ser longa, controlada e satisfatória.

Não queremos inflação exagerada de números logo no início.

Atualmente existem situações como:

DPS na casa de dezenas de milhões;
vida chegando rapidamente a dezenas de milhares;
atributos muito elevados nos itens;
naves com valores altos em praticamente todos os atributos.

Isso deve ser revisto.

A progressão precisa deixar espaço matemático suficiente para aproximadamente:

300 níveis de personagem e 300 níveis por nave.

Evitar crescimento exponencial descontrolado nas primeiras etapas.

Os números devem permanecer legíveis durante uma parcela significativa da progressão.

Não utilizar números arbitrariamente grandes apenas para transmitir sensação de poder.

A sensação de evolução deve vir da combinação de:

níveis;
atributos;
tiers;
raridades;
builds;
elementos;
equipamentos;
sets;
Matriz;
evolução individual das naves;
sinergias;
desbloqueios;
conteúdo progressivamente mais difícil.

# 2. PROGRESSÃO TEMPORAL DO JOGO

Como referência inicial de pacing:

Galáxia 1: aproximadamente 10 horas para conclusão;
Galáxia 2: aproximadamente 1 dia adicional;
Galáxia 3: aproximadamente 1,5 dia adicional;
galáxias seguintes devem continuar aumentando progressivamente o tempo necessário.

Esses valores são metas iniciais de balanceamento, não números rígidos.

Criar curvas configuráveis para que possamos alterar posteriormente:

HP dos inimigos;
dano dos inimigos;
XP;
sucata;
recursos;
drop rate;
dificuldade;
progressão das fases;
progressão dos bosses;
requisitos de nível.

Não espalhar números fixos pelo código.

Sempre que possível, centralizar valores de balanceamento em arquivos/configurações próprios.

# 3. NOVO SISTEMA ELEMENTAL

Implementar seis tipos principais de dano:

Normal;
Fogo;
Raio;
Gelo;
Cósmico;
Químico.

O dano Normal deve permanecer separado do dano Elemental.

Exemplo conceitual:

Dano Total = componente físico/normal + componente elemental

Não transformar simplesmente todo dano da nave em dano elemental.

Uma nave ou equipamento poderá possuir diferentes distribuições entre esses componentes.

# 4. ATRIBUTOS ELEMENTAIS

Adicionar atributos específicos relacionados aos elementos.

Exemplos:

+% Dano Elemental;
+% Dano de Fogo;
+% Dano de Raio;
+% Dano de Gelo;
+% Dano Cósmico;
+% Dano Químico;
+% Chance Crítica Elemental;
+% Dano Crítico Elemental;
Resistência Elemental;
Resistência específica por elemento;
Penetração Elemental.

Dano crítico normal e dano crítico elemental devem poder existir separadamente.

Não é necessário que todos os itens tenham atributos elementais.

Queremos itens especializados.

Exemplos:

item focado em dano normal;
item focado em dano elemental;
item híbrido;
item defensivo;
item crítico;
item de cadência;
item focado em determinado elemento;
item focado em múltiplos projéteis;
item utilitário.

Isso deve incentivar builds diferentes.

# 5. SISTEMA DE VANTAGEM ELEMENTAL

Criar um sistema de vantagens e desvantagens entre elementos.

A ideia inicial é algo semelhante a:

Fogo > Raio > Gelo > Cósmico > Químico > Fogo

Entretanto, antes de implementar definitivamente, validar se o ciclo completo é matematicamente saudável.

O elemento Normal deve permanecer neutro ou possuir uma regra própria.

As relações elementais devem utilizar multiplicadores configuráveis.

Exemplo conceitual:

vantagem: 1.25x;
neutro: 1.00x;
desvantagem: 0.80x.

Esses valores são exemplos e devem permanecer configuráveis.

Não colocar regras elementais diretamente espalhadas pelo código.

Criar uma estrutura central para a matriz de vantagens elementais.

# 6. TIERS DE ATRIBUTOS

Criar um sistema global de tiers de atributos.

Cada atributo poderá possuir aproximadamente:

Tier 1 até Tier 10.

Exemplo:

### Dano

T1 = bônus pequeno;
T2 = bônus pequeno/médio;
...
T10 = bônus extremamente elevado.

O mesmo conceito deve poder ser aplicado a:

dano;
dano elemental;
crítico;
crítico elemental;
vida;
escudo;
energia;
cadência;
velocidade;
alcance;
resistência;
regeneração;
cooldown;
quantidade de projéteis;
demais atributos futuros.

O tier possível deve considerar:

nível do item;
raridade;
categoria;
nível necessário;
região/galáxia;
conteúdo que originou o drop.

Itens de nível baixo não devem naturalmente gerar atributos T9/T10.

Itens de nível alto devem possuir acesso progressivamente maior aos tiers superiores.

# 7. PESO DOS ATRIBUTOS

Além do Tier 1–10 interno, criar uma classificação de valor/poder relativo dos atributos.

Nem todos os atributos possuem o mesmo impacto.

Por exemplo:

+1 projétil

pode ser significativamente mais poderoso do que:

+5% dano.

Portanto cada atributo precisa possuir:

peso de poder;
peso de geração;
tiers permitidos;
raridades permitidas;
nível mínimo;
chance de aparecer;
possíveis incompatibilidades.

Isso permitirá controlar o orçamento de poder de cada item.

# 8. ATRIBUTO ESPECIAL: PROJÉTEIS ADICIONAIS

Adicionar um atributo extremamente valioso:

+1 tiro/projétil;
+2 tiros/projéteis;
+3 tiros/projéteis.

Esse atributo deve ser um dos atributos mais raros do jogo, pois possui potencial multiplicativo extremamente elevado.

Não tratar:

+1 projétil

como equivalente a um pequeno aumento percentual de dano.

Criar restrições específicas.

Exemplo conceitual:

+1: raro;
+2: extremamente raro;
+3: excepcional/endgame.

Os valores definitivos devem ser definidos através do sistema de balanceamento.

Também considerar diferenças entre:

projéteis paralelos;
spread;
projéteis extras direcionados;
projéteis adicionais por disparo;
multiplicação de rajadas.

Evitar que esse atributo provoque multiplicações infinitas ou interações quebradas.

# 9. RARIDADES DOS ITENS

A progressão de raridade deverá considerar:

Comum;
Incomum;
Raro;
Épico;
Lendário;
Mítico;
Divino.

Quanto maior a raridade:

menor o drop rate;
maior o potencial de atributos;
maior o número potencial de affixes;
maior o acesso a tiers altos;
maior a chance de propriedades especiais.

Porém:

raridade alta não significa automaticamente item perfeito.

Ainda deve existir variação de rolls.

# 10. DROP RATE E ITENS EXTREMAMENTE RAROS

O drop deve proporcionar sensação real de conquista.

Itens próximos de Divino devem ser extremamente difíceis de obter.

Itens Divinos específicos podem possuir chances de drop próximas do excepcionalmente raro, principalmente quando forem:

exclusivos de bosses;
exclusivos de conteúdo avançado;
peças especiais de set;
itens build-defining.

Entretanto, evitar uma configuração matematicamente tão baixa que o item seja realisticamente impossível de obter durante a vida útil normal do jogo.

O sistema deve permitir:

drop global;
drop por galáxia;
drop por inimigo;
drop por boss;
drop por atividade;
drop exclusivo;
pity/proteção contra azar futuramente, se necessário.

Todas as probabilidades devem ser configuráveis.

# 11. BANCO DE ITENS

Criar uma estrutura de dados central para armazenar os itens.

Além dos itens atuais, preparar uma base conceitual de aproximadamente:

+50 itens por categoria.

As dez categorias existentes devem ser preservadas:

Asas / Estrutura;
Armas Principais;
Armas Secundárias;
Propulsão / Motores;
Reatores / Energia;
Sistemas de Controle;
Defesa / Escudos;
Blindagem / Casco;
Suportes / Utilitários;
Upgrades Gerais.

Essa expansão pode ser feita gradualmente, mas o modelo de dados deve suportá-la desde já.

Os itens devem variar entre:

normal;
elemental;
ofensivo;
defensivo;
crítico;
utilitário;
híbrido;
builds especializadas;
sets;
raridades Comum até Divino.

# 12. PLANILHA/BANCO DE BALANCEAMENTO DE ITENS

Preparar uma estrutura exportável para planilha contendo, entre outros:

ID;
nome;
categoria;
raridade;
nível mínimo;
item level;
elemento;
dano base;
dano elemental;
atributos;
tiers dos atributos;
quantidade de affixes;
peso dos affixes;
drop weight;
fonte de drop;
galáxia;
boss;
set;
valor de venda;
recursos de reciclagem;
tags;
status de implementação.

A planilha deve servir como fonte de referência de design, evitando que valores sejam definidos manualmente e sem padrão dentro do código.

# 13. SETS DE EQUIPAMENTOS

Os itens de set também devem seguir as mesmas regras de:

raridade;
tier;
nível;
drop rate;
orçamento de poder.

Sets devem incentivar builds sem obrigatoriamente tornar qualquer item fora de set inútil.

Preparar suporte para bônus como:

2 peças;
3 peças;
4 peças;
conjunto completo.

# 14. SISTEMA DE NAVES

As naves também devem utilizar um sistema controlado de atributos.

Evitar naves com valores próximos do máximo em praticamente todas as características.

Cada nave deve possuir:

vantagens;
fraquezas;
função;
identidade;
estilo de combate;
afinidade elemental quando aplicável;
possíveis sinergias;
atributos base;
curva de crescimento.

Exemplos de arquétipos:

rápida/frágil;
tanque;
crítico;
elemental;
suporte;
alta cadência;
canhão pesado;
escudo;
glass cannon;
híbrida.

# 15. BANCO DE NAVES

Criar estrutura centralizada para armazenar todas as naves.

Além das atuais, planejar aproximadamente:

30 futuras naves jogáveis.

Não é necessário implementar visualmente todas agora.

Precisamos inicialmente de:

IDs;
arquétipos;
atributos;
elemento;
crescimento;
função;
nível de desbloqueio;
galáxia relacionada;
habilidades/passivas;
tags.

# 16. NAVES INIMIGAS

Aplicar filosofia semelhante aos inimigos.

Preparar aproximadamente:

30 arquétipos/futuras naves inimigas.

Criar variedade entre:

ataque;
movimento;
defesa;
elemento;
comportamento;
tiros;
formação;
velocidade;
resistência;
habilidades.

Evitar inimigos que sejam apenas versões recoloridas uns dos outros.

# 17. NÍVEL DO PERSONAGEM E NÍVEL DAS NAVES

Implementar dois sistemas separados.

## Personagem

O personagem principal possui nível global.

Limite planejado atualmente:

nível 300.

O nível do personagem será uma das principais referências para o sistema de Matriz.

## Nave

Cada nave possui XP e nível próprios.

Exemplo:

Nave A nível 70;
Nave B nível 25;
Nave C nível 140.

Trocar de nave não transfere automaticamente o nível entre elas.

Isso cria progressão horizontal e incentiva o jogador a desenvolver uma frota.

# 18. INCENTIVO AO USO DE MÚLTIPLAS NAVES

Não queremos que exista apenas:

"uma nave é mais forte, portanto ela resolve todo o jogo."

Diferentes galáxias, inimigos e bosses devem favorecer diferentes estratégias.

Isso pode ocorrer através de:

vantagens elementais;
resistência inimiga;
mecânicas de boss;
mobilidade;
tipos de ataque;
builds;
restrições;
bônus específicos.

O objetivo é fazer o jogador pensar:

"Para esse conteúdo, outra nave funciona melhor."

e não simplesmente:

"Vou usar sempre a nave com maior DPS."

# 19. VISUAL DO ESCUDO

Adicionar uma configuração para:

Exibir/Ocultar efeito visual do escudo.

Ocultar o efeito deve alterar somente a apresentação visual.

O equipamento continua funcionando normalmente.

O jogador que preferir uma nave visualmente mais limpa poderá desligar o efeito.

# 20. ESCUDOS VISUALMENTE BASEADOS NO EQUIPAMENTO

O efeito visual do shield deve considerar o equipamento utilizado.

Variações possíveis:

formato;
geometria;
partículas;
intensidade;
animação;
cor;
composição;
efeito de impacto.

Raridades superiores podem possuir efeitos mais elaborados.

Exemplo:

Comum: shield simples;
Raro: efeito energético adicional;
Épico: padrões especiais;
Lendário: animações;
Mítico: partículas e geometria diferenciadas;
Divino: visual excepcional.

Manter legibilidade durante o combate.

# 21. ASSETS "TIROS E EXPLOSÕES"

Existe um novo PNG na pasta bbb chamado:

"tiros e explosoes"

Esse asset deve ser utilizado como referência para o novo sistema visual de elementos.

Ele contém diferentes:

tiros;
projéteis;
beams;
partículas;
explosões;
impactos;
ícones elementais.

Não utilizar simplesmente o mesmo projétil recolorido para todas as naves.

Queremos variedade.

Por exemplo, duas naves de Fogo podem utilizar projéteis completamente diferentes.

O mesmo vale para inimigos.

A escolha deve considerar:

nave;
arma;
elemento;
raridade/equipamento quando necessário;
tipo de ataque.

# 22. FEEDBACK VISUAL DOS ELEMENTOS

Utilizar partículas e efeitos do asset para:

disparo;
trajetória;
impacto;
crítico;
destruição;
ataques especiais.

Cada elemento deve possuir identidade visual clara.

O jogador deve conseguir reconhecer rapidamente:

Fogo;
Raio;
Gelo;
Cósmico;
Químico;
Normal.

Sem depender exclusivamente da cor.

# 23. ASSET "NOVOS ITENS"

Também existe na pasta bbb:

"novos itens"

Esse PNG contém novos itens e referências até a raridade:

Divino.

Utilizar esses assets para ampliar a itemização.

Não interpretar apenas a borda como raridade.

Cada item deve possuir sua própria:

identidade;
função;
atributos;
tier;
raridade;
drop weight;
nível;
possíveis sinergias.

# 24. SISTEMA DE RECURSOS

Criar futuramente recursos específicos de cada galáxia.

Como referência:

aproximadamente 3 recursos exclusivos por galáxia.

Exemplo conceitual:

Galáxia A:

recurso A1;
recurso A2;
recurso A3.

Galáxia B:

recurso B1;
recurso B2;
recurso B3.

Esses recursos serão utilizados em:

crafting;
evolução;
fabricação;
conversões;
atividades futuras.

Isso deve criar motivos para jogadores avançados retornarem às galáxias anteriores.

# 25. FORJA ESPACIAL / SISTEMA DE CRAFTING

Futuramente implementar um sistema semelhante a uma forja, porém não utilizar simplesmente o nome "Forja".

Criar posteriormente um nome adequado ao universo espacial/tecnológico do jogo.

Possíveis conceitos:

Núcleo de Síntese;
Reator de Transmutação;
Complexo de Engenharia;
Laboratório de Fusão;
Matriz de Fabricação.

O sistema deverá utilizar:

recursos;
sucata;
itens;
materiais especiais.

# 26. SACRIFÍCIO / FUSÃO DE ITENS

Permitir utilizar itens inferiores como matéria-prima.

Exemplo conceitual:

10 itens Comuns → chance de gerar item superior.

Isso NÃO significa obrigatoriamente:

10 comuns = 1 raro garantido.

Criar tabelas configuráveis considerando:

quantidade;
raridade;
nível;
categoria;
recursos adicionais;
chance de sucesso;
possíveis resultados.

O objetivo é dar utilidade aos drops inferiores mesmo no endgame.

# 27. MISSÕES

Preparar arquitetura para um futuro sistema de missões.

Categorias iniciais:

### Eliminação

matar X inimigos;
matar determinado inimigo;
matar bosses;
eliminar inimigos de determinado elemento.

### Coleta

coletar X recursos;
obter determinado material.

### Entrega

entregar recursos;
entregar itens;
entregar componentes.

### Progressão

concluir fases;
concluir galáxias;
atingir níveis;
evoluir naves.

Recompensas possíveis:

sucata;
recursos;
itens;
medalhas;
XP;
recompensas especiais.

# 28. INVENTÁRIO

Melhorar o sistema de filtros.

O jogador deve conseguir visualizar especificamente:

asas;
armas principais;
armas secundárias;
motores;
reatores;
controle;
escudos;
blindagem;
utilitários;
upgrades;
sets;
raridades;
elementos.

Também deve ser possível ordenar por:

nível;
raridade;
poder;
recente;
categoria.

# 29. SEPARAÇÃO ENTRE ITENS E RECURSOS

Não colocar recursos comuns de crafting misturados aos equipamentos.

Criar separação semelhante ao menu principal:

### Inventário de Itens

Equipamentos utilizáveis.

### Arquivo/Armazém de Recursos

Materiais, recursos planetários, componentes de crafting etc.

Isso melhora organização e escalabilidade.

# 30. REMOÇÃO DO SISTEMA DE POWER UPS

O sistema atual de Power Ups que dropam durante as batalhas deve ser removido.

Não queremos que melhorias temporárias aleatórias sejam uma das principais fontes de poder.

O poder da nave deve vir principalmente de:

itemização;
Matriz;
nível;
nave;
builds;
sinergias.

Remover dependências de Power Ups existentes sem quebrar outros sistemas.

# 31. REMOÇÃO DO MENU/SISTEMA "MELHORIAS"

O sistema/menu atual chamado:

Melhorias

também deverá ser removido.

Não criar um terceiro sistema paralelo de evolução.

A progressão deverá ser concentrada principalmente em:

Itemização + Matriz + níveis + sistemas futuros claramente integrados.

Antes da remoção, verificar referências/dependências para evitar código órfão ou erros.

# 32. CONTEÚDO ENDGAME DE BOSSES

Futuramente implementar um modo de progressão composto exclusivamente por bosses.

Conceitualmente funciona como uma torre:

Piso 1 → Boss 1;
Piso 2 → Boss 2;
Piso 3 → Boss 3;
etc.

Porém não utilizar o nome "Torre".

Criar nome coerente com o universo espacial.

Possíveis conceitos:

Abismo Estelar;
Nexo de Ascensão;
Fenda do Infinito;
Protocolo Ômega;
Singularidade;
Convergência Astral.

O nome definitivo poderá ser escolhido posteriormente.

# 33. 100 NÍVEIS DE BOSSES

Planejamento inicial:

100 níveis/pisos.

A dificuldade deve crescer progressivamente.

Cada nível poderá aumentar:

HP;
dano;
resistência;
velocidade;
complexidade;
quantidade de habilidades;
modificadores;
mecânicas especiais.

Evitar que seja simplesmente:

mesmo boss + mais HP.

Introduzir mudanças mecânicas progressivamente.

# 34. REQUISITOS DE ACESSO AO ENDGAME

Cada nível desse modo deverá possuir requisitos.

Principalmente:

nível mínimo do personagem.

Também poderemos futuramente considerar:

nível da nave;
progresso de galáxia;
boss anterior derrotado;
recursos/chaves especiais.

Essas condições devem ser configuráveis.

# 35. RECOMPENSAS DO MODO DE BOSSES

Os níveis poderão conceder:

sucata;
recursos;
itens;
recursos exclusivos;
itens exclusivos;
cosméticos futuramente;
materiais de crafting;
medalhas.

Quanto maior o nível:

maior dificuldade → maior potencial de recompensa.

Porém evitar simplesmente aumentar todas as recompensas linearmente.

Itens exclusivos devem possuir tabelas próprias de drop.

# 36. ARQUITETURA DE DADOS

Evitar hardcode.

Separar lógica de jogo dos dados de balanceamento.

Idealmente criar estruturas independentes para:

ItemDefinitions
AffixDefinitions
AffixTiers
RarityDefinitions
DropTables
ElementDefinitions
ElementInteractions
ShipDefinitions
EnemyDefinitions
GalaxyDefinitions
ResourceDefinitions
MissionDefinitions
BossDefinitions
ProgressionCurves
SetDefinitions

Os nomes reais podem seguir a arquitetura atual do projeto.

O importante é preservar essa separação conceitual.

# 37. IDENTIFICADORES

Não utilizar nomes visuais como identificadores internos permanentes.

Exemplo:

Preferir:

weapon_plasma_mk3

em vez de depender diretamente de:

Canhão de Plasma MK.III

Assim podemos futuramente alterar:

tradução;
nome;
descrição;

sem quebrar referências.

Aplicar o mesmo princípio a:

itens;
naves;
inimigos;
recursos;
elementos;
galáxias;
bosses;
sets.

# 38. VERSIONAMENTO DOS DADOS

Como o jogo ainda sofrerá diversas alterações de balanceamento, preparar os dados pensando em versões futuras.

Evitar estruturas que tornem saves antigos inutilizáveis quando:

atributos forem adicionados;
itens forem rebalanceados;
tiers forem alterados;
novos elementos surgirem;
novas raridades forem adicionadas.

Quando possível, utilizar valores padrão seguros para campos novos.

# 39. TELEMETRIA PREPARADA PARA BALANCEAMENTO

Preparar arquitetura para futuramente conseguirmos analisar dados como:

tempo para concluir galáxia;
DPS médio;
mortes;
boss que bloqueia progressão;
raridade média equipada;
quantidade de drops;
tempo para encontrar Lendário/Mítico/Divino;
naves mais utilizadas;
elementos mais utilizados;
itens mais utilizados;
builds dominantes.

Não é necessário implementar infraestrutura online agora, mas evitar arquiteturas que impeçam esse tipo de análise posteriormente.

# 40. REGRAS DE SEGURANÇA DO BALANCEAMENTO

Ao implementar fórmulas, adicionar limites razoáveis quando necessário.

Especialmente para:

crítico;
velocidade de ataque;
cooldown;
projéteis adicionais;
regeneração;
resistência;
redução de dano;
multiplicadores elementais.

Precisamos evitar combinações que possam gerar:

divisão por zero;
cooldown negativo;
dano infinito;
invulnerabilidade permanente;
multiplicações recursivas;
quantidade absurda de projéteis;
travamentos por excesso de entidades.

# 41. ORDEM RECOMENDADA DE IMPLEMENTAÇÃO

Não implementar todos os sistemas simultaneamente.

### FASE 1 — Fundação

Primeiro:

auditar sistemas atuais;
documentar atributos existentes;
centralizar configurações;
criar raridades;
criar tiers de atributos;
criar orçamento/peso de atributos;
criar sistema elemental;
criar estrutura de itens;
criar estrutura de naves;
definir curvas 1–300.

### FASE 2 — Combate

Depois:

dano Normal × Elemental;
crítico Normal × Elemental;
resistências;
vantagem elemental;
projéteis elementais;
impactos;
explosões;
tiros inimigos;
integração com equipamentos.

### FASE 3 — Itemização

Implementar:

novos affixes;
tiers;
raridades até Divino;
+projéteis;
drop weights;
sets;
novos itens;
filtros de inventário.

### FASE 4 — Progressão

Implementar:

nível do personagem;
XP individual das naves;
curvas de XP;
integração da Matriz;
requisitos de nível;
balanceamento das galáxias.

### FASE 5 — Conteúdo

Depois:

novas naves;
novos inimigos;
novos bosses;
recursos;
crafting;
missões;
modo de bosses.

# 42. PRIORIDADE IMEDIATA

Antes de implementar sistemas secundários, quero que seja produzida uma auditoria do estado atual do projeto.

Identifique:

arquivos envolvidos;
sistemas atuais;
atributos existentes;
estrutura de itens;
estrutura de naves;
sistema de dano;
sistema de drop;
inventário;
Matriz;
Power Ups;
sistema Melhorias;
progressão;
saves;
dependências entre sistemas.

Depois apresente um plano de implementação.

Não começar alterando dezenas de arquivos sem antes compreender a arquitetura atual.

# 43. REGRA PARA ALTERAÇÕES

Para cada etapa:

analisar o código atual;
identificar dependências;
propor a alteração;
definir estruturas de dados;
implementar;
validar;
testar compatibilidade;
documentar;
somente então avançar.

Quando uma alteração impactar save, balanceamento ou arquitetura, destacar isso antes da implementação.

# 44. TESTES OBRIGATÓRIOS

Criar testes ou verificações apropriadas para sistemas críticos.

Principalmente:

### Combate

Validar:

dano normal;
dano elemental;
crítico;
crítico elemental;
resistência;
vantagem/desvantagem;
múltiplos projéteis.

### Itemização

Validar:

geração de atributos;
tiers permitidos;
raridade;
nível;
drop rate;
affixes incompatíveis.

### Progressão

Validar:

XP;
nível máximo;
crescimento;
desbloqueios.

### Inventário

Validar:

filtros;
ordenação;
equipamentos;
recursos.

# 45. SIMULAÇÃO DE BALANCEAMENTO

Antes de considerar o balanceamento concluído, criar simulações automatizadas sempre que possível.

Simular, por exemplo:

jogador nível 1;
nível 25;
nível 50;
nível 100;
nível 150;
nível 200;
nível 250;
nível 300.

Comparar:

DPS;
vida;
escudo;
tempo médio para matar inimigos;
tempo médio para bosses;
velocidade de progressão;
qualidade média dos equipamentos.

Também simular milhares de drops para validar se as raridades reais correspondem às probabilidades planejadas.

# 46. ECONOMIA

A economia precisa ser balanceada junto da progressão.

Considerar:

sucata recebida;
custo de sistemas;
valor dos itens;
crafting;
reciclagem;
recursos;
progressão offline/idle.

Evitar que o jogador acumule quantidades praticamente infinitas de moedas sem função.

Criar sinks econômicos suficientes para acompanhar a geração de recursos.

# 47. FILOSOFIA DE DESIGN

O jogo deve priorizar:

progressão longa + variedade de builds + caça por itens + evolução de frota + escolhas estratégicas.

Queremos evitar:

equipar automaticamente o item com maior número de DPS e ignorar todo o restante.

Uma decisão interessante deve poder existir entre:

mais dano;
mais crítico;
elemento melhor;
mais projéteis;
melhor sobrevivência;
melhor set;
melhor sinergia com a nave;
melhor matchup contra determinado conteúdo.

# 48. REGRA FINAL PARA A IA

Não tente implementar tudo imediatamente.

Primeiro compreenda o projeto e estabeleça as fundações.

Quando houver conflito entre uma implementação rápida e uma arquitetura escalável, priorize a arquitetura escalável, desde que isso não gere complexidade desnecessária.

Não invente números definitivos sem justificativa.

Não espalhe constantes de balanceamento pelo código.

Não duplique sistemas que já possuem responsabilidade equivalente.

Não remova sistemas sem verificar dependências.

Não transforme todos os itens em versões linearmente superiores uns dos outros.

Não transforme todas as naves em versões linearmente superiores umas das outras.

Não permita que um único atributo domine toda a itemização.

Não permita que uma única nave domine todo o conteúdo.

Não faça alterações massivas sem validar cada etapa.

# PRIMEIRA TAREFA

Neste momento, não implemente todos os itens desta especificação de uma vez.

Comece exclusivamente pela FASE 0 — Auditoria e Planejamento Técnico.

Entregue:

mapa da arquitetura atual relacionada aos sistemas desta especificação;
arquivos que precisarão ser alterados;
sistemas que podem ser reutilizados;
sistemas que precisam ser refatorados;
sistemas que precisam ser removidos;
dependências e riscos;
possíveis impactos nos saves;
proposta de modelo de dados;
proposta inicial das fórmulas de combate;
proposta da curva de progressão até nível 300;
proposta do sistema de tiers T1–T10;
proposta de raridades Comum → Divino;
proposta da matriz elemental;
plano de implementação dividido em pequenas etapas.

Não faça alterações destrutivas durante essa auditoria.

Ao terminar, apresente claramente:

### ESTADO ATUAL
O que existe hoje.

### PROBLEMAS ENCONTRADOS
Problemas arquiteturais, de balanceamento ou dependências.

### ARQUITETURA PROPOSTA
Como os sistemas devem ficar.

### MIGRAÇÃO
Como sair do sistema atual para o novo sem quebrar saves ou funcionalidades.

### ROADMAP
Qual deve ser a ordem das implementações.

### CRITÉRIOS DE ACEITE
Como saberemos objetivamente que cada etapa está funcionando.

Depois disso, aguarde a aprovação da próxima fase antes de realizar alterações estruturais grandes.

# 49. POLÍTICA DE MODELOS E ORQUESTRAÇÃO DE AGENTES
## Objetivo
O projeto deve utilizar uma estratégia de orquestração de modelos e agentes especializados para maximizar a qualidade das decisões estruturais e evitar desperdício de capacidade em tarefas simples ou repetitivas. Regra central: Opus deve pensar, decidir, planejar e revisar; Sonnet deve executar tarefas bem especificadas quando não houver risco arquitetural relevante.
## 49.1. Uso obrigatório do Opus
Utilizar Opus em arquitetura, planejamento, game design, systems design, balanceamento, fórmulas, progressão, economia, análise de dependências, grandes refactors, migração de saves, bugs complexos e revisão de implementações importantes. Também é obrigatório quando a tarefa afetar múltiplos sistemas, interfaces centrais, serialização, banco de dados, itemização, sistema elemental, affixes, tiers, raridades, drop rates, Matriz, XP, naves, bosses ou compatibilidade com saves.
## 49.2. Uso recomendado do Sonnet
Utilizar Sonnet para código cuja arquitetura já esteja definida, componentes isolados, UI, filtros, CRUD, mapeamento de assets, arquivos de dados, cadastro de itens/naves/inimigos, testes, documentação, tooltips, correções simples, pequenas refatorações locais e tarefas repetitivas. Sonnet não deve improvisar decisões estruturais; deve escalar ambiguidades ou impactos centrais para Opus.
## 49.3. Classificação de complexidade
Nível 1 — Simples: textos, tooltips, pequenos ajustes visuais e cadastro de dados. Sonnet.
Nível 2 — Moderado: UI, filtros, integrações pequenas, testes e refactors locais. Sonnet, escalando para Opus se surgir impacto arquitetural.
Nível 3 — Complexo: novas mecânicas, alterações significativas de combate e integrações entre sistemas. Opus analisa e planeja; Sonnet pode executar unidades bem especificadas; Opus revisa.
Nível 4 — Crítico: arquitetura, saves, progressão global, economia, item generator, drop system, fórmulas de dano, sistema elemental, bancos centrais, migrações e grandes refactors. Opus.
## 49.4. Fluxo padrão
OPUS (análise) → OPUS (arquitetura e critérios de aceite) → SONNET (implementação delegável) → SONNET (testes locais) → OPUS (code review e integração) → testes → documentação → próxima etapa. Não delegar ao Sonnet uma tarefa cuja arquitetura ainda não esteja definida.
## 49.5. Regra de escalonamento
Se Sonnet encontrar decisão arquitetural não prevista, conflito entre sistemas, mudança em save, fórmula global, dependência circular, comportamento ambíguo ou risco importante de regressão, não deve improvisar. Deve registrar o bloqueio e devolver a decisão ao Opus responsável.
## 49.6. Regra de custo
Não utilizar Opus apenas porque é mais poderoso. Tarefas sem risco arquitetural devem preferencialmente ir para Sonnet. Entretanto, nunca economizar modelo em decisões que possam gerar retrabalho estrutural. Prioridade: correção > arquitetura > manutenibilidade > custo de tokens.
# 50. CRIAÇÃO DE AGENTES ESPECIALIZADOS
Criar agentes separados no ambiente de desenvolvimento, com responsabilidades explícitas, escopo limitado, modelo preferencial e regras de handoff. Os nomes podem ser adaptados ao formato suportado pela ferramenta.
## 50.1. game-architect — Opus
Coordenador técnico principal. Audita o projeto, mapeia dependências, define interfaces e modelos de dados, analisa impactos em saves, planeja refactors, cria critérios de aceite, decompõe features e decide o que pode ser delegado. Não deve realizar grandes implementações antes de compreender o código existente.
## 50.2. balance-designer — Opus
Responsável por curvas de XP 1–300, progressão das galáxias, HP/dano, item budgets, affix tiers T1–T10, raridades, drop weights, elementos, crítico, projéteis adicionais, economia, crafting, bosses e simulações. Toda alteração matemática relevante deve ser configurável e justificada.
## 50.3. implementer — Sonnet
Executa tarefas já especificadas: classes, componentes, UI, filtros, assets, configurações, conteúdo, integrações pequenas e refactors locais. Não pode alterar arquitetura central por iniciativa própria; descobriu decisão não prevista, escala ao game-architect.
## 50.4. code-reviewer — Opus
Revisa alterações importantes. Verifica aderência à arquitetura, duplicação, hardcode, regressões, performance, segurança de saves, edge cases, compatibilidade, abstrações, clareza, impacto no balanceamento e critérios de aceite. Deve procurar problemas ativamente.
## 50.5. tester — Sonnet
Cria e executa testes unitários e de integração; valida combate, geração de itens, filtros, XP, saves, migrações, drops, casos extremos e regressões. Falhas estruturais devem ser documentadas com passos de reprodução, esperado e atual.
## 50.6. content-data-agent — Sonnet
Responsável pela expansão massiva orientada por dados: itens, naves, inimigos, bosses, recursos, missões e sets a partir de schemas aprovados. Valida IDs, duplicatas e convenções; não cria campos estruturais novos sem autorização.
## 50.7. save-migration-reviewer — Opus
Agente recomendado para versionamento e migração de saves. Revisa defaults seguros, compatibilidade retroativa, integridade de IDs persistentes e prevenção de perda de progresso.
# 51. PROTOCOLO DE HANDOFF ENTRE AGENTES
Toda delegação deve informar: objetivo, arquivos relevantes, arquitetura aprovada, o que pode e não pode ser alterado, dependências, critérios de aceite, testes esperados e riscos conhecidos.
O executor deve retornar: arquivos alterados, resumo das mudanças, testes realizados, resultados, decisões tomadas, dúvidas/bloqueios e riscos restantes.
# 52. REGRAS DE CONFIGURAÇÃO DOS AGENTES
Cada agente deve possuir nome estável, função, modelo preferencial, responsabilidades, limites de atuação, condições de escalonamento, formato de saída e critérios de conclusão.
Não permitir que vários agentes alterem simultaneamente os mesmos arquivos críticos sem coordenação. O game-architect deve decompor o trabalho para reduzir conflitos.
Para tarefas estruturais, iniciar explicitamente o coordenador em Opus quando a ferramenta permitir seleção de modelo. A política textual de roteamento é uma regra do projeto e não deve ser tratada como garantia técnica de troca automática de modelo.
# 53. ARQUIVOS RECOMENDADOS PARA O PROJETO
Manter uma instrução principal do projeto, por exemplo CLAUDE.md quando aplicável, contendo política de modelos, arquitetura, restrições e fluxo de desenvolvimento.
Manter configurações separadas para game-architect, balance-designer, implementer, code-reviewer, tester, content-data-agent e save-migration-reviewer quando o ambiente suportar subagentes.
# 54. FLUXO OBRIGATÓRIO PARA A FASE ATUAL
A FASE 0 — Auditoria e Planejamento Técnico deve ser conduzida por Opus, preferencialmente pelo game-architect, com apoio do balance-designer nas análises matemáticas.
Agentes Sonnet podem auxiliar em inventário de arquivos, documentação, buscas e tarefas mecânicas, mas não devem decidir a arquitetura.
Após a auditoria, o game-architect deve produzir o roadmap e decompor a Fase 1 em tarefas pequenas. Somente tarefas com arquitetura e critérios de aceite definidos devem ser entregues ao implementer.
Toda mudança estrutural relevante concluída deve passar pelo code-reviewer antes de ser marcada como finalizada.
# 55. REGRA FINAL DE ORQUESTRAÇÃO
Antes de cada tarefa, responder internamente: esta tarefa exige decisão arquitetural ou apenas execução de uma decisão já aprovada? Se exige decisão arquitetural: Opus. Se a arquitetura está definida e a tarefa é execução: Sonnet. Se Sonnet descobrir complexidade estrutural: escalar para Opus. Se Sonnet implementar uma mudança importante: Opus revisa.
O objetivo não é usar o modelo mais caro o tempo todo, mas usar o modelo correto para cada responsabilidade, reduzindo retrabalho e preservando a coerência do projeto.