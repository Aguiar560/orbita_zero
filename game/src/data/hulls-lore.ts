/**
 * História e curiosidade de cada casco.
 *
 * ## Por que num arquivo separado
 *
 * `hulls.ts` é tabela de ATRIBUTOS — dano, vida, custo, setor. Misturar dois
 * parágrafos de ficção em cada entrada faria uma linha de balanceamento ficar a
 * quinze linhas de distância da seguinte, e ninguém consegue comparar números
 * que não cabem na mesma tela. Aqui a ficção mora junta e o balanceamento
 * continua legível.
 *
 * ## A regra que o teste cobra
 *
 * `tests/hulls-lore.test.ts` exige que TODO casco não-protótipo tenha as duas
 * coisas. É de propósito: "sempre que criar uma nave, criar a história junto" é
 * uma convenção, e convenção que depende de memória se perde na terceira nave.
 * Assim o build cobra.
 *
 * ## O mundo, para os 53 textos não serem 53 textos soltos
 *
 * - **Doca Vetor** — o estaleiro da própria frota. Faz o que precisa durar, não
 *   o que precisa impressionar.
 * - **Consórcio Aurora** — produção civil em massa, numeração Mk. Nave de
 *   catálogo, peça de reposição em qualquer porto.
 * - **Fundição Ignis** — antiga metalúrgica de asteroide. Vende dano e admite
 *   que o resto é problema do piloto.
 * - **Célula Falcão** — oficina de protótipo, dois cascos por vez.
 * - **Programa Prisma** — pesquisa elemental. Um casco por elemento, para
 *   provar que especializar vale mais que equilibrar.
 * - **As linhas de fronteira** — Fronteira, Expedição, Domínio e Ascensão, os
 *   quatro degraus do que se constrói longe de casa.
 */

export interface LoreDeCasco {
  /** Dois ou três períodos: de onde veio, quem fez, para que serve. */
  historia: string;
  /**
   * Um detalhe estranho e específico.
   *
   * Curiosidade não é resumo da história em outras palavras — é o fato que
   * sobra depois dela, e que o jogador repetiria para alguém.
   */
  curiosidade: string;
}

export const LORE_DE_CASCO: Readonly<Record<string, LoreDeCasco>> = {
  // ── Doca Vetor: o padrão da frota ────────────────────────────────────────
  void_canhao: {
    historia: 'O casco que a Doca Vetor entrega a quem chega sem nave. Foi projetado para ser consertado com o que houver a bordo — cada peça tem substituta em três outras peças do mesmo casco.',
    curiosidade: 'O manual dele tem quatro páginas. Duas são sobre o que fazer quando o canhão trava.',
  },
  void_zapper: {
    historia: 'A Doca Vetor tentou resolver enxames com cadência em vez de calibre. O arco salta entre alvos próximos, o que funciona esplendidamente contra fileiras e é um desperdício contra qualquer coisa sozinha.',
    curiosidade: 'Pilotos chamam o som do arco de "gagueira". A doca tentou abafar e desistiu: sem o ruído, ninguém percebia que a arma tinha parado.',
  },
  void_foguete: {
    historia: 'Bateria de foguetes montada sobre o chassi do VC-1, sem quase nenhuma adaptação. Ficou pesada na frente e desequilibrada, e a doca compensou com um motor de rajada em vez de refazer o casco.',
    curiosidade: 'A salva completa empurra a nave para trás. Vetores de recuo viraram manobra de fuga oficial.',
  },
  void_canhaozao: {
    historia: 'A Doca Vetor parou de fingir sutileza. É um canhão de cerco com cabine acoplada, e o motor supercarregado existe só para carregá-lo até onde ele precisa estar.',
    curiosidade: 'Entre um disparo e o seguinte cabe uma conversa inteira. Alguns pilotos usam esse intervalo para reorientar a nave — outros para respirar.',
  },

  // ── Consórcio Aurora: produção civil ─────────────────────────────────────
  aurora1: {
    historia: 'A nave mais fabricada da história do Consórcio Aurora, e a mais vendida de segunda mão. Não é boa em nada; é adequada em tudo, e há peça de reposição em qualquer porto habitado.',
    curiosidade: 'Existem mais Mk I registrados do que pilotos registrados. Ninguém sabe explicar a diferença.',
  },
  aurora2: {
    historia: 'A resposta do Consórcio às reclamações de que o Mk I "não fazia nada": asas reforçadas e um segundo canhão de íons parafusado por fora. Funcionou, e o consórcio nunca mais escondeu que é assim que ele projeta.',
    curiosidade: 'O segundo canhão é um Mk I inteiro, sem cabine. A carcaça original ainda está lá dentro.',
  },
  aurora3: {
    historia: 'Quando o Consórcio finalmente refez o casco em vez de acrescentar peças, saiu isto: um reator secundário dedicado só ao escudo. A nave ficou lenta para matar e teimosa para morrer.',
    curiosidade: 'O reator secundário foi copiado de uma bomba de água de estação criogênica. O esquema ainda traz o nome da bomba.',
  },
  aurora4: {
    historia: 'Configuração de linha de frente, encomendada por frotas que precisavam furar formações e não tinham como esperar artilharia. O Consórcio entregou perfuração e cobrou por casco reforçado que não instalou.',
    curiosidade: 'A ficha oficial lista "blindagem de linha". A blindagem é a mesma do Mk III, pintada de outra cor.',
  },
  aurora_x: {
    historia: 'Um Mk I recolhido de um universo que não existe mais, remontado com núcleos de outros três. O Consórcio nega ter participado; o número de série diz o contrário.',
    curiosidade: 'Os quatro núcleos marcam datas diferentes, e nenhuma delas é desta linha do tempo.',
  },

  // ── Fundição Ignis: dano e nada mais ─────────────────────────────────────
  ignis1: {
    historia: 'A Fundição Ignis era uma metalúrgica de asteroide antes de virar estaleiro, e o Mk I mostra: chapa grossa onde não importa, nenhuma onde importa. Ela trocou escudo por cadência e escreveu isso no contrato de venda.',
    curiosidade: 'O contrato tem uma cláusula que isenta a fundição de qualquer dano ao piloto. Ninguém nunca a contestou em juízo.',
  },
  ignis2: {
    historia: 'Canhões pirolíticos gêmeos, montados tão perto que aquecem um ao outro. A Fundição chamou isso de "sinergia térmica" e vendeu a série inteira antes de alguém medir.',
    curiosidade: 'A sinergia é real, mas ao contrário: depois de nove salvas seguidas os dois canhões param juntos.',
  },
  ignis4: {
    historia: 'Plasma instável numa bateria que a própria Fundição classifica como experimental. É o casco que mais mata por segundo do catálogo, e o que mais mata o próprio piloto.',
    curiosidade: 'A Fundição vende com uma nota: "não estacionar próximo a outras naves". A nota é maior que a ficha técnica.',
  },

  // ── Célula Falcão: os dois protótipos ────────────────────────────────────
  falcao_b: {
    historia: 'A Célula Falcão constrói dois cascos por vez, da mesma célula, com calibrações opostas — é assim que ela testa o que a calibração realmente muda. O Azul recebeu controle de inclinação real, e ficou bom em chegar às coisas.',
    curiosidade: 'Ele coleta melhor que naves feitas para coletar. A célula nunca conseguiu reproduzir isso de propósito.',
  },
  falcao_r: {
    historia: 'Mesma célula do Azul, mesma data, mesmo casco nu. A calibração rubra abriu mão do controle fino para encadear críticos, e o par virou a prova de que o chassi importa menos do que o estaleiro admitia.',
    curiosidade: 'Os dois Falcões têm números de série consecutivos. Pilotos que voam um costumam recusar o outro.',
  },

  // ── Programa Prisma: um casco por elemento ───────────────────────────────
  prisma_raio: {
    historia: 'O primeiro do Programa Prisma, feito para provar que especializar bate equilibrar. A bateria de arco em cascata dispara mais rápido do que o casco aguenta, e essa era exatamente a demonstração.',
    curiosidade: 'O relatório de aprovação tem uma linha só: "confirmado — e o casco é problema da engenharia".',
  },
  prisma_gelo: {
    historia: 'Depois do Arco, o Programa quis o oposto: um casco criogênico que aguentasse tudo e devolvesse devagar. Levou três anos e continua sendo o casco que mais sobrevive a coisas que deveriam matá-lo.',
    curiosidade: 'Ele foi testado contra o Prisma Arco. O teste durou onze minutos e nenhum dos dois caiu.',
  },
  prisma_padrao: {
    historia: 'O casco de controle do Programa: sem aposta elemental, tudo mediano, existindo só para ser a régua dos outros. Acabou sendo o preferido de quem vive de carga, por um motivo que ninguém projetou.',
    curiosidade: 'O faro dele para carga saiu de um sensor de calibração que o Programa esqueceu de remover.',
  },
  prisma_fogo: {
    historia: 'Ogivas incendiárias sobre um casco que o Programa sabia ser fino demais. Foi aprovado assim porque a cratera que ele abre é grande o bastante para justificar o risco — no papel.',
    curiosidade: 'A distância mínima de segurança do disparo é maior que o alcance de manobra da própria nave.',
  },
  prisma_cosmico: {
    historia: 'O Prisma Vazio perfura fileiras inteiras e crava crítico atrás de crítico, e o Programa nunca conseguiu explicar por quê. Os números batem; o mecanismo, não.',
    curiosidade: 'Três equipes diferentes tentaram replicar o efeito num casco novo. As três produziram naves comuns.',
  },
  prisma_quimico: {
    historia: 'Reator biocatalítico: o casco regenera sozinho e, com o tempo, começa a antecipar o comando do piloto. O Programa considera isso um efeito colateral e não uma função.',
    curiosidade: 'A antecipação melhora com o tempo de voo do MESMO piloto. Trocar de piloto zera o ganho.',
  },

  // ── Cascos de personagem ─────────────────────────────────────────────────
  nucleo_vektor: {
    historia: 'Recuperado de um estaleiro morto, sem registro de fabricação e sem defeito aparente. Faz tudo bem e nada de espetacular, o que num casco sem procedência é a coisa mais suspeita possível.',
    curiosidade: 'A unidade de navegação ainda guarda rotas para portos que não existem mais. Ela as recalcula todo dia.',
  },
  lanca_rubra: {
    historia: 'Casco de corrida de carga, convertido para combate por quem o pilotava. As chapas de blindagem foram acrescentadas depois, por fora, e ninguém teve coragem de tirar a aceleração original para compensar.',
    curiosidade: 'Ela ainda tem o suporte do cronômetro de prova no painel. O cronômetro sumiu; o suporte, não.',
  },
  baluarte_glacial: {
    historia: 'Um casco leve de doca fria, blindado por quem o pilota — camada por camada, ao longo de anos. Nenhuma das placas veio do mesmo fornecedor, e é isso que o faz absorver o que os outros desviam.',
    curiosidade: 'As placas foram instaladas em ordem de espessura crescente. A mais fina, e a mais antiga, fica exatamente sobre a cabine.',
  },
  sopro_astral: {
    historia: 'O casco responde antes do comando chegar. A frota registrou o fenômeno, mediu, confirmou e arquivou sem conclusão — a nave voa, e é o que consta.',
    curiosidade: 'A latência medida é negativa em quarenta milissegundos. O relatório usa a palavra "negativa" oito vezes, sempre entre aspas.',
  },

  // ── Linha de Fronteira (T4) ──────────────────────────────────────────────
  centuriao_atlas: {
    historia: 'O primeiro casco de escolta desenhado já para a fronteira, com motores externos que qualquer doca improvisada consegue trocar. É o padrão contra o qual a Linha de Fronteira inteira foi medida depois.',
    curiosidade: 'Os motores externos foram uma imposição orçamentária, não um projeto. Viraram a marca da linha.',
  },
  ariete_vesper: {
    historia: 'Quatro motores e massa suficiente para atravessar um bloqueio sem parar para negociar. Foi encomendado por comboios que se cansaram de esperar autorização para passar.',
    curiosidade: 'A proa é reforçada em camadas assimétricas: mais grossa à esquerda, porque as barreiras costumam abrir para esse lado.',
  },
  lamina_kheiron: {
    historia: 'Perfil estreito, reator exposto, nenhuma concessão à sobrevivência do que não seja o piloto. Foi projetado para duelo, e o estaleiro nunca fingiu que servisse para outra coisa.',
    curiosidade: 'O reator exposto é blindado só pela frente. A ficha chama isso de "compromisso de silhueta".',
  },
  peregrina_sol: {
    historia: 'Um casco longitudinal que só entrega o alcance prometido com alinhamento perfeito — e devolve muito menos quando torto. Ensina pontaria a quem a voa, ou não é voada por muito tempo.',
    curiosidade: 'Ela tem uma linha gravada no casco, de proa a popa. Serve para o piloto conferir o alinhamento a olho.',
  },
  lince_polar: {
    historia: 'Unidade compacta de reconhecimento com assistência criogênica, feita para chegar primeiro e segurar a posição até o resto alcançar. Metade do volume interno é sistema de resfriamento.',
    curiosidade: 'O casco fica frio ao toque mesmo depois de horas em combate. Docas usam isso para achá-la no escuro.',
  },
  custodio_vinte_tres: {
    historia: 'Fragata de carga convertida em escudo móvel depois que a vigésima terceira do lote foi a única a voltar de uma escolta. A conversão manteve os porões: eles são o que absorve o impacto.',
    curiosidade: 'Os porões continuam catalogados como espaço de carga. Nenhum deles pode ser usado.',
  },

  // ── Linha de Expedição (T5) ──────────────────────────────────────────────
  cerbero_azul: {
    historia: 'Três vetores de impulso mantêm a mira estável enquanto a nave desvia — é o casco que provou que evasão e precisão não precisam ser escolha. A Linha de Expedição inteira herdou esse arranjo.',
    curiosidade: 'O terceiro vetor foi acrescentado depois do primeiro voo. Sem ele, os outros dois se cancelavam em curva fechada.',
  },
  vipera_helix: {
    historia: 'Quatro casulos laterais alimentam uma bombarda de longo curso que não pode ser recarregada em voo. Cada saída é uma decisão sobre quantos tiros a missão vai exigir.',
    curiosidade: 'Os casulos são numerados na ordem em que devem ser gastos. Pilotos experientes gastam fora de ordem, de propósito.',
  },
  draco_viridiano: {
    historia: 'Casco biometálico que caça pelo ponto fraco em vez do volume. Cresce uma camada nova a cada reparo, e depois de anos nenhuma unidade se parece com outra.',
    curiosidade: 'Duas Draco da mesma leva, comparadas depois de mil horas, divergiram em 14% de massa.',
  },
  oraculo_safira: {
    historia: 'Anéis sensoriais que calculam a trajetória do alvo antes de ele manobrar. Não atira melhor que ninguém — atira antes, o que na prática é a mesma coisa.',
    curiosidade: 'Os anéis giram em sentidos opostos. Se girassem juntos, a leitura ficaria cega no eixo do giro.',
  },
  talon_ignifero: {
    historia: 'Asas cortantes e câmaras térmicas para pressão frontal que não afrouxa. Foi feito para encontros que precisam acabar depressa, e é péssimo em qualquer coisa que se arraste.',
    curiosidade: 'As câmaras térmicas precisam de doze minutos para esfriar. É por isso que ele nunca faz duas saídas seguidas.',
  },
  leviata_ferro: {
    historia: 'Uma muralha de motores e paióis que avança disparando e não sabe recuar — a ré foi removida do projeto para caber mais paiol. Quem a voa aprende a planejar a saída antes da entrada.',
    curiosidade: 'A remoção da ré está registrada como "otimização de volume". A palavra "ré" não aparece em lugar nenhum do manual.',
  },

  // ── Linha de Domínio (T6) ────────────────────────────────────────────────
  arraia_boreal: {
    historia: 'Interceptador largo com placas criogênicas dimensionadas para ACEITAR impacto em vez de evitá-lo. Inverteu o que a linha entendia por interceptação e ninguém voltou atrás.',
    curiosidade: 'As placas racham de propósito, num padrão desenhado. Casco rachado no padrão certo é considerado íntegro.',
  },
  martelo_helios: {
    historia: 'Motores e depósitos orbitam uma câmara de cerco incandescente que é, na prática, o centro estrutural da nave. Tudo o mais foi construído em volta dela, inclusive a cabine.',
    curiosidade: 'A cabine fica a nove metros da câmara. É a distância mínima em que o piso não deforma.',
  },
  navegante_nox: {
    historia: 'Sensores do Vazio e três motores dedicados a manter a frota inteira em sincronia. Sozinho ele é medíocre; é o único casco do catálogo cuja ficha assume isso.',
    curiosidade: 'Os sensores só calibram com outra nave por perto. Uma Nox isolada leva quarenta minutos para se orientar.',
  },
  quimera_verde: {
    historia: 'Blindagem viva que converte resíduo de combate em estabilidade — quanto mais longo o encontro, melhor ela fica. Foi rejeitada duas vezes antes de alguém testá-la num confronto que durasse.',
    curiosidade: 'Nos primeiros noventa segundos ela é a pior nave do tier. Depois do quarto minuto, a melhor.',
  },
  rapina_ambar: {
    historia: 'Caça de precisão sem massa sobrando entre piloto e alvo: cada grama que não servia à mira foi retirada. O que sobrou é desconfortável, e nenhum piloto de Rapina reclama disso.',
    curiosidade: 'A cabine não tem isolamento acústico. Foi retirado no corte de massa e nunca voltou.',
  },
  arca_turquesa: {
    historia: 'Nave-colônia compacta, feita para sobreviver, reparar e manter a missão viva quando o resto da frota não voltar. É o único casco do catálogo com projeto de habitação.',
    curiosidade: 'Ela carrega sementes. Ninguém no comando sabe dizer de que, nem quem as embarcou.',
  },

  // ── Linha de Ascensão e Divina (T7) ──────────────────────────────────────
  seta_quantica: {
    historia: 'O anel traseiro comprime o disparo e lança o casco junto dele — arma e propulsão são o mesmo sistema. Atirar move a nave, e essa não é uma falha que alguém pretenda corrigir.',
    curiosidade: 'Parada, ela não consegue disparar dois tiros seguidos no mesmo alvo. Em movimento, consegue.',
  },
  asa_carmim: {
    historia: 'Duas lâminas laterais abrem espaço para uma cortina de projéteis que cobre mais tela do que qualquer casco da linha. Não persegue: espera que venham.',
    curiosidade: 'As lâminas não são armas. São defletores, e o nome ficou porque ninguém acreditou nisso.',
  },
  condor_magma: {
    historia: 'Arsenal industrial compacto que se mantém estável mesmo em salvas completas — o que o Prisma Pirônio e o Martelo Hélios tentaram e não conseguiram. Levou três linhas de projeto para chegar aqui.',
    curiosidade: 'A estabilidade vem de um contrapeso de trezentos quilos que não faz mais nada além disso.',
  },
  tridente_violeta: {
    historia: 'Três emissores que compartilham alvo, energia e solução de tiro, como se fossem um só. Quando um falha, os outros dois assumem a carga e a nave não perde cadência.',
    curiosidade: 'Já houve unidade voando meses com um emissor morto sem que o piloto notasse.',
  },
  aurora_negra: {
    historia: 'Assinatura baixa, aceleração alta e descarga de curta distância — nada nela serve para combate longo. O nome é do Consórcio Aurora; o projeto, de ninguém que ele admita conhecer.',
    curiosidade: 'O casco não reflete radar nem luz. Docas a marcam com fita adesiva para não perdê-la de vista.',
  },
  eclipse_rubro: {
    historia: 'Caçador furtivo que entrega o momento do disparo à IA de bordo — o piloto escolhe o alvo, a nave escolhe o instante. É o casco que mais divide opinião no hangar.',
    curiosidade: 'O intervalo entre a mira do piloto e o tiro da nave chega a quatro segundos. Quem tenta forçar o gatilho perde o disparo.',
  },
  nemesis_alada: {
    historia: 'Canhões dorsais gêmeos que transformam a fuselagem inteira numa mira: para atirar, ela aponta o corpo. Manobra e pontaria deixaram de ser duas coisas.',
    curiosidade: 'Ela não tem torre. Girar a nave é o único jeito de mudar de alvo, e é mais rápido que qualquer torre da linha.',
  },
  vanguarda_dez: {
    historia: 'Casco modular de patrulha com sensores distribuídos no eixo central, feito para ser reconfigurado em campo sem doca. É o mais antigo projeto ainda em produção do catálogo.',
    curiosidade: 'Todas as unidades saem numeradas a partir de dez. Não existe Vanguarda um a nove, e o estaleiro não explica.',
  },
  fornalha_dezenove: {
    historia: 'Reator industrial acoplado diretamente ao tubo de lançamento, sem estágio intermediário. É a solução mais bruta da linha e, medida em dano por segundo sustentado, a que ninguém superou.',
    curiosidade: 'O tubo precisa ser trocado a cada duzentas salvas. As docas mantêm tubos sobressalentes antes de manter munição.',
  },
  horizonte_trinta: {
    historia: 'Protótipo de fronteira que equilibra pressão e leitura tática — o casco que a Linha de Ascensão usou para descobrir onde estava o limite antes de construir o Bastião.',
    curiosidade: 'Foram feitas trinta unidades. Vinte e nove viraram peça de outras naves; esta é a que sobrou inteira.',
  },
  bastiao_8: {
    historia: 'Fortaleza de quatro núcleos que absorve a linha inimiga e devolve fogo concentrado num ponto só. É o fim da escada: depois dele, o catálogo não tem mais degrau.',
    curiosidade: 'Os quatro núcleos nunca ligam juntos. O quarto só acorda quando outro falha, e nenhuma unidade registrada chegou a acordá-lo.',
  },
};

/** A ficha desta nave, se houver. */
export const loreDeCasco = (id: string): LoreDeCasco | undefined => LORE_DE_CASCO[id];
