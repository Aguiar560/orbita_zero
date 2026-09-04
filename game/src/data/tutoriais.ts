import type { PassoDoTour } from '@ui/Tour';

/**
 * Um tutorial por tela, no mesmo padrão do passeio de boas-vindas.
 *
 * ## Por que a tela ganha o próprio guia
 *
 * O passeio de entrada tem dez passos e explica onde as coisas ficam. Ele não
 * pode explicar o que cada tela FAZ — seriam cinquenta passos numa sessão em que
 * o jogador ainda não tem nível para abrir metade delas, e um passeio longo
 * demais é pulado inteiro, levando junto os três passos que importavam.
 *
 * As telas também não chegam juntas: a Matriz abre numa patente, Missões noutra.
 * Explicar a Matriz no minuto um é explicar uma aba cinza.
 *
 * ## Quando ele abre
 *
 * Na primeira vez que a tela é ABERTA, e não no instante em que ela é liberada.
 * A diferença importa: a liberação acontece no meio de uma luta, e arrastar o
 * jogador para dentro de um painel que ele não pediu é pior do que esperar ele
 * chegar lá. O aviso de "tela liberada" continua sendo o convite.
 *
 * A mesma regra cobre o caso que parece outro — tela que já nasce disponível.
 * Ela também abre pela primeira vez em algum momento, e é ali que o guia entra.
 * Uma regra, os dois casos.
 *
 * ## O tamanho de cada um
 *
 * Três a cinco passos. O critério é o mesmo do passeio de entrada: um passo só
 * existe se a falta dele deixaria o jogador parado ou fazendo a coisa errada.
 * "Aqui há uma lista" não entra; "esta lista é de onde saem as peças" entra.
 *
 * ## Alvo que não existe é PULADO
 *
 * É o `Tour` que garante isso, e é o que permite escrever um passo para uma
 * seção que só aparece com conteúdo — a lista de contatos das Missões, por
 * exemplo, que fica vazia até o primeiro chefe cair.
 */
export const TUTORIAIS: Readonly<Record<string, readonly PassoDoTour[]>> = {
  matriz: [
    {
      titulo: 'A Matriz é onde o poder vira escolha',
      texto: 'Cada patente dá um ponto. Aplicado num nó, ele muda um atributo para sempre — e nenhum ponto volta sozinho, então a árvore é a decisão de longo prazo do jogo.',
    },
    {
      alvo: '.tree-points',
      titulo: 'Quantos pontos você tem',
      texto: 'Sobem com a patente do piloto, não com o nível da nave. Guardar pontos é legítimo: gastar num nó fraco custa a mesma coisa que gastar num forte.',
      escala: 1.1,
    },
    {
      alvo: '.tree-root',
      titulo: 'Só se avança pelo que já está aceso',
      texto: 'Um nó só aceita ponto se estiver ligado a outro que você já tem. É isso que faz um ramo distante custar o caminho inteiro até ele — e que torna a primeira direção a escolha mais cara da árvore.',
      escala: 1.01,
      folga: 6,
    },
    {
      alvo: '.tree-search',
      titulo: 'Procure pelo efeito, não pelo nome',
      texto: 'A busca filtra por atributo. Digite "crítico" ou "escudo" e a árvore acende só o que mexe naquilo — mais rápido do que caçar nó a nó.',
      escala: 1.06,
    },
    {
      alvo: '.tree-tools',
      titulo: 'Dá para recomeçar',
      texto: 'Redistribuir devolve todos os pontos de uma vez, para você montar outra coisa. É a válvula que permite experimentar sem medo de estragar a conta.',
      escala: 1.05,
    },
  ],

  missoes: [
    {
      titulo: 'Missões dão direção ao que você já faz',
      texto: 'Elas não pedem nada fora do jogo normal: derrubar, coletar, chegar a um setor. O que muda é que agora aquilo paga a mais.',
    },
    {
      alvo: '.mis-abas',
      titulo: 'Três prazos diferentes',
      texto: 'Diárias renovam todo dia, semanais dão mais e demoram mais, e as de campanha acompanham a história. Vale olhar as diárias antes de escolher onde farmar.',
      escala: 1.04,
    },
    {
      alvo: '.mis-corpo',
      titulo: 'Rastreie uma para vê-la em combate',
      texto: 'A missão rastreada aparece no canto da tela de luta, com o progresso ao vivo. Sem rastrear, você só descobre que terminou ao voltar aqui.',
      escala: 1.01,
      folga: 6,
    },
    {
      alvo: '.mis-contatos',
      titulo: 'Chefe derrotado vira aliado',
      texto: 'Cada chefe que cai entra aqui como contato, e contatos oferecem encomendas próprias. É a razão de rematar um chefe já vencido.',
      escala: 1.02,
      folga: 6,
    },
  ],

  galaxia: [
    {
      titulo: 'A Galáxia é o mapa da campanha',
      texto: 'É daqui que a nave sai para um setor. Cada galáxia tem dez setores, e o décimo guarda um chefe que amplia sua carga.',
    },
    {
      alvo: '.galaxy-command-nav',
      titulo: 'Você escolhe onde lutar',
      texto: 'Só setores já conquistados ficam abertos. Voltar a um mais fácil é estratégia, não derrota: é assim que se junta equipamento para passar da parede.',
      escala: 1.03,
    },
    {
      alvo: '.galaxy-command-hero',
      titulo: 'O planeta diz o que esperar',
      texto: 'Bioma, elemento dominante e o material-assinatura da galáxia. Levar o elemento certo vale mais que levar o item mais caro.',
      escala: 1.02,
      folga: 6,
    },
  ],

  armazem: [
    {
      titulo: 'O Armazém guarda material, não equipamento',
      texto: 'Peça fica no Inventário; minério, gás e componente ficam aqui. São coisas diferentes porque se usam de formas diferentes — material vira item na Fabricação.',
    },
    {
      alvo: '.armazem-abas',
      titulo: 'Cada família numa aba',
      texto: 'Minérios, ligas, gases, orgânicos. Procurar um gás sem as abas obrigava a rolar por tudo que não era gás.',
      escala: 1.03,
    },
    {
      alvo: '.armazem-conta',
      titulo: 'Não há limite',
      texto: 'Nem de tipos nem de quantidade: tudo que cai entra. O número aqui é quanto do catálogo você já descobriu — é coleção, não capacidade.',
      escala: 1.08,
    },
  ],

  fabricacao: [
    {
      titulo: 'Fabricar é transformar material em peça',
      texto: 'O que o Armazém acumula vira equipamento aqui. É o caminho para quem não teve sorte no drop — mais lento, e sob seu controle.',
    },
    {
      alvo: '.fab-materiais',
      titulo: 'O custo aparece antes',
      texto: 'A receita mostra o que falta em vermelho. Nada é consumido até você confirmar.',
      escala: 1.03,
    },
    {
      alvo: '.fab-grade',
      titulo: 'Fundir sobe raridade',
      texto: 'Sacrificar peças da mesma raridade produz uma acima. É o destino do que você ia desmontar — e a única forma de empurrar um item para Divino.',
      escala: 1.01,
      folga: 6,
    },
  ],

  afixos: [
    {
      titulo: 'Engenharia mexe nos afixos de uma peça',
      texto: 'A base do item não muda; o que muda são as linhas de atributo dela. Um item bom com afixos errados vale menos que um mediano bem ajustado.',
    },
    {
      alvo: '.afx-inventory',
      titulo: 'Escolha a peça primeiro',
      texto: 'Tudo aqui age sobre um item de cada vez. Favoritos ficam protegidos de qualquer operação destrutiva.',
      escala: 1.01,
      folga: 6,
    },
    {
      alvo: '.afx-balance',
      titulo: 'O custo é em recurso, e ele sobe',
      texto: 'Cada intervenção na mesma peça custa mais que a anterior. Rolar até sair perfeito é caro de propósito — a peça boa tem de competir com a próxima que cair.',
      escala: 1.05,
    },
  ],

  // O painel se chama Hangar na aba, mas o id dele e 'frota' (FleetPanel). O
  // teste pegou isto: com a chave errada o tutorial nunca abriria, e o unico
  // sintoma seria a tela nao explicar nada.
  frota: [
    {
      titulo: 'O Hangar é a sua frota',
      texto: 'Cada casco tem atributos e formato de tiro próprios, e sobe de nível separado. Trocar de nave é trocar de jogo, não fazer upgrade.',
    },
    {
      alvo: '.hangar-lista',
      titulo: 'Só a nave em campo ganha XP',
      texto: 'É o que faz desenvolver uma segunda nave custar tempo próprio. Vale escolher com intenção, e não trocar a cada item novo.',
      escala: 1.01,
      folga: 6,
    },
    {
      alvo: '.hangar-ficha',
      titulo: 'O equipamento é POR NAVE',
      texto: 'Cada casco guarda o que está montado nele. Voltar para uma nave antiga a encontra como você a deixou.',
      escala: 1.02,
      folga: 6,
    },
  ],

  provacao: [
    {
      titulo: 'A Provação é dificuldade sem progressão',
      texto: 'Andares que sobem sem fim, com modificadores que mudam a luta. Não é onde se farma — é onde se descobre até onde o seu conjunto aguenta.',
    },
    {
      alvo: '.prv-tentativas',
      titulo: 'As tentativas são contadas',
      texto: 'Elas repõem com o tempo. É o que impede repetir o mesmo andar até a sorte resolver, e o que faz cada subida valer preparação.',
      escala: 1.06,
    },
    {
      alvo: '.prv-cont',
      titulo: 'Leia os modificadores antes de entrar',
      texto: 'Escudo que não regenera, invulnerabilidade alternada, zonas de perigo. Eles são conhecidos de antemão de propósito: a Provação testa escolha, não reflexo.',
      escala: 1.04,
    },
  ],

  eventos: [
    {
      titulo: 'Eventos rendem por jogar o que você já joga',
      texto: 'Um objetivo rotativo com prazo. Ele não pede desvio de rota — acompanha o que acontece em combate.',
    },
    {
      alvo: '.evt-objective',
      titulo: 'O progresso é automático',
      texto: 'Não há o que ativar. Quando a barra enche, o resgate abre aqui.',
      escala: 1.03,
    },
    {
      alvo: '.evt-clock',
      titulo: 'E o prazo é real',
      texto: 'Terminado o relógio, o evento troca e o progresso não vai junto. Vale resgatar antes de fechar o jogo.',
      escala: 1.08,
    },
  ],

  baus: [
    {
      titulo: 'Baús são o drop guardado para depois',
      texto: 'Chegam de chefes, missões e eventos. Ficam aqui até você abrir — não expiram, e não há vantagem em correr.',
    },
    {
      alvo: '.bau-lista',
      titulo: 'O nível do baú é o SEU nível ao abrir',
      texto: 'Não o de quando ele caiu. Guardar um baú de bronze para mais tarde é uma jogada válida: o conteúdo escala com você.',
      escala: 1.02,
      folga: 6,
    },
  ],

  loja: [
    {
      titulo: 'A Central de Serviços é conversão, não vitrine',
      texto: 'Nada aqui vende poder direto. O que se compra são operações: trocar o elemento de uma peça, ampliar carga, converter uma moeda em outra.',
    },
    {
      alvo: '.loj-abas',
      titulo: 'Serviço com alvo age numa peça sua',
      texto: 'Comprar uma carga de conversão guarda um uso; aplicá-la é um segundo passo, na peça que você escolher. Comprar não muda nada sozinho.',
      escala: 1.03,
    },
    {
      alvo: '.loj-saldos',
      titulo: 'Três moedas, três origens',
      texto: 'Sucata vem de abate e desmanche, núcleos de combate, cristais de chefe. O câmbio só anda numa direção — da mais comum para a mais rara.',
      escala: 1.05,
    },
  ],

  codex: [
    {
      titulo: 'O Códex é o registro do que você já viu',
      texto: 'Chefes derrotados, cascos encontrados, itens descobertos. Ele não dá poder: serve para saber o que ainda falta caçar.',
    },
    {
      alvo: '.codex-tabs',
      titulo: 'E mostra o que existe, não só o que você tem',
      texto: 'O que ainda não apareceu fica marcado como desconhecido. É o mapa do conteúdo que sobra pela frente.',
      escala: 1.03,
    },
  ],

  ranking: [
    {
      titulo: 'O Ranking compara progresso, não tempo jogado',
      texto: 'A posição sai do que você conquistou. Jogar com a aba fechada conta igual — a ausência rende o mesmo que a presença.',
    },
    {
      alvo: '.ranking-criterio',
      titulo: 'Leia o critério da temporada',
      texto: 'Ele diz exatamente o que está sendo medido. Sem isso, subir no ranking vira tentativa e erro.',
      escala: 1.03,
    },
    {
      alvo: '.ranking-temporada',
      titulo: 'Temporadas têm fim',
      texto: 'A tabela congela no encerramento, e é sobre ela congelada que qualquer premiação se decide.',
      escala: 1.04,
    },
  ],

  inventario: [
    {
      titulo: 'O Inventário é de onde a nave se monta',
      texto: 'Esta coluna não fecha. Arraste uma peça daqui até o soquete da Anatomia, ou clique nela.',
    },
    {
      alvo: '.inv-rarity-toolbar',
      titulo: 'Filtre por raridade quando encher',
      texto: 'O espaço é limitado, ao contrário do Armazém. Quando lotar, a peça que não couber NÃO é coletada — ela fica no setor, e o jogo avisa na tela.',
      escala: 1.03,
    },
    {
      alvo: '.inv-capacity',
      titulo: 'Marque como favorito o que não pode sumir',
      texto: 'Favorito é ignorado pelo desmanche automático e por qualquer operação em lote. É a única proteção contra descartar a peça certa por engano.',
      escala: 1.01,
      folga: 6,
    },
  ],
};

/** Existe tutorial para esta tela? */
export const temTutorial = (id: string): boolean => id in TUTORIAIS;
