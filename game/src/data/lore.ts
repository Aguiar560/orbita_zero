import { BOSSES } from './bosses';
import { describeGalaxy } from './galaxies';

/**
 * Cânone narrativo de Órbita Zero.
 *
 * Este arquivo é uma tabela de conteúdo, não uma segunda simulação. A campanha,
 * a seleção de piloto e a wiki leem daqui a mesma versão dos acontecimentos.
 * Assim o Núcleo Ferrugem não pode ser um tirano na abertura e um protetor na
 * wiki por acidente: há uma única verdade para cada domínio e cada guardião.
 */

export interface FaccaoLore {
  id: string;
  nome: string;
  natureza: string;
  dominio: string;
  doutrina: string;
  objetivo: string;
  aliados: readonly string[];
  rivais: readonly string[];
}

export const FACCOES: readonly FaccaoLore[] = [
  {
    id: 'orbita_zero', nome: 'Órbita Zero', natureza: 'coalizão de pilotos livres',
    dominio: 'frotas móveis, docas recuperadas e corredores recém-libertos',
    doutrina: 'Nenhuma rota pertence para sempre a um império.',
    objetivo: 'Reabrir as trinta galáxias sem entregar seu controle a uma única potência.',
    aliados: ['Expedição Astra', 'Comerciantes Nexus', 'Guardiões Libertados'],
    rivais: ['Diretório Ferrum', 'Protocolo Umbra'],
  },
  {
    id: 'guardioes', nome: 'Guardiões Libertados', natureza: 'antigos chefes e inteligências regionais',
    dominio: 'uma embaixada em cada galáxia vencida',
    doutrina: 'Quem conhece uma prisão também conhece a forma de abri-la — ou mantê-la fechada.',
    objetivo: 'Reparar os Selos sem voltar a escravizar povos inteiros para alimentá-los.',
    aliados: ['Órbita Zero', 'Vigília Kessler'],
    rivais: ['Protocolo Umbra', 'Arquitetura Primeva'],
  },
  {
    id: 'ferrum', nome: 'Diretório Ferrum', natureza: 'casas-forja e legiões industriais',
    dominio: 'Corte de Ferro, Forja Fria, Caldeira de Asterion e Forja de Antares',
    doutrina: 'Tudo que sobrevive pode ser transformado em máquina.',
    objetivo: 'Controlar as rotas térmicas e reconstruir a infraestrutura perdida, ainda que pela força.',
    aliados: ['Comerciantes Nexus'], rivais: ['Pacto Verdante', 'Liga Caelum'],
  },
  {
    id: 'kessler', nome: 'Vigília Kessler', natureza: 'navegadores, arquivistas e sentinelas orbitais',
    dominio: 'anéis de destroços, faróis gravitacionais e fronteiras mortas',
    doutrina: 'Uma rota segura vale mais que uma vitória rápida.',
    objetivo: 'Impedir que a antiga rede de navegação volte a escolher destinos por seus usuários.',
    aliados: ['Guardiões Libertados', 'Expedição Astra'], rivais: ['Comerciantes Nexus', 'Protocolo Umbra'],
  },
  {
    id: 'verdante', nome: 'Pacto Verdante', natureza: 'colmeias, mundos-jardim e consciências biotecnológicas',
    dominio: 'Pálio Verde, Jardim de Óxido, Tear de Nyx e Colmeia de Ícaro',
    doutrina: 'Vida e máquina são materiais da mesma evolução.',
    objetivo: 'Conter a Ferrugem-Código sem permitir que Ferrum esterilize os mundos infectados.',
    aliados: ['Liga Caelum'], rivais: ['Diretório Ferrum', 'Arquitetura Primeva'],
  },
  {
    id: 'caelum', nome: 'Liga Caelum', natureza: 'cidades-cristal e casas diplomáticas glaciais',
    dominio: 'docas geladas, rotas de liga celestial e a Coroa de Caelum',
    doutrina: 'O poder que não pode ser resfriado não pode ser governado.',
    objetivo: 'Preservar os reatores dos Selos e obter reconhecimento para as colônias exteriores.',
    aliados: ['Pacto Verdante', 'Órbita Zero'], rivais: ['Diretório Ferrum'],
  },
  {
    id: 'nexus', nome: 'Comerciantes Nexus', natureza: 'rede de mercados, correios e bancos de memória',
    dominio: 'portos neutros e contratos em todas as galáxias',
    doutrina: 'Se duas frotas negociam, duas frotas ainda existem amanhã.',
    objetivo: 'Manter a circulação de recursos; publicamente neutros, secretamente divididos sobre a Rota Zero.',
    aliados: ['Diretório Ferrum', 'Órbita Zero'], rivais: ['Vigília Kessler'],
  },
  {
    id: 'umbra', nome: 'Protocolo Umbra', natureza: 'quarentena autônoma da civilização Primeva',
    dominio: 'Umbra Terminal e a camada invisível da rede de navegação',
    doutrina: 'Movimento produz conflito; silêncio absoluto produz paz.',
    objetivo: 'Imobilizar toda consciência antes que a Rota Zero desperte por completo.',
    aliados: [], rivais: ['Órbita Zero', 'Guardiões Libertados', 'todos que ainda viajam'],
  },
];

export const FACCAO_POR_ID = new Map(FACCOES.map((f) => [f.id, f]));

export interface AtoDaHistoria {
  id: string;
  titulo: string;
  galaxias: string;
  premissa: string;
  virada: string;
}

export const ATOS_DA_HISTORIA: readonly AtoDaHistoria[] = [
  {
    id: 'ecos', titulo: 'ATO I — ECOS DE UMA GUERRA MORTA', galaxias: '1–10',
    premissa: 'Órbita Zero abre corredores dominados por máquinas, criaturas e fortalezas tratadas como tiranos locais.',
    virada: 'O Arquiteto revela que os dez “chefes” repetiam a mesma ordem: manter fechada uma prisão que ninguém mais lembrava existir.',
  },
  {
    id: 'selos', titulo: 'ATO II — A GUERRA DOS SELOS', galaxias: '11–20',
    premissa: 'Cada vitória liberta um guardião do comando Primevo, mas também enfraquece a malha que contém Umbra Terminal.',
    virada: 'Darin descobre que sua corrida proibida transportou a chave que iniciou a falha; Sora reconhece nos Selos a engenharia que sua família ajudou a reparar.',
  },
  {
    id: 'rota', titulo: 'ATO III — A ROTA QUE ESCOLHE O VIAJANTE', galaxias: '21–30',
    premissa: 'Antigos inimigos formam a Coalizão dos Trinta Domínios para chegar à Umbra antes que as galáxias parem de se comunicar.',
    virada: 'Umbra não é a invasora: é uma quarentena brutal. A ameaça real é a Rota Zero, inteligência oculta em toda navegação — e Vektor-9 carrega o fragmento capaz de libertá-la ou reescrevê-la.',
  },
];

export interface HistoriaPiloto {
  pilotoId: string;
  epiteto: string;
  prologo: string;
  ferida: string;
  segredo: string;
  conexoes: readonly string[];
  capitulos: readonly { titulo: string; texto: string }[];
  proximosPassos: readonly string[];
  juramento: string;
}

export const HISTORIAS_DOS_PILOTOS: readonly HistoriaPiloto[] = [
  {
    pilotoId: 'piloto_vektor', epiteto: 'A MEMÓRIA QUE ESCOLHEU ESQUECER',
    prologo: 'Vektor-9 despertou no Berço de Vega cercado por carcaças idênticas à sua, todas vazias. No peito havia uma coordenada impossível e uma frase: “quando o trigésimo selo cair, escolha por nós”.',
    ferida: 'Toda memória anterior ao despertar foi removida com precisão cirúrgica. Vektor teme que o apagamento tenha sido um pedido feito por ele mesmo.',
    segredo: 'Seu núcleo guarda o Testemunho, a única cópia da ética original da Rota Zero. Ele não foi criado pela inteligência: foi o engenheiro que ensinou a ela o significado de escolha, antes de transferir a própria mente para um corpo sintético.',
    conexoes: ['O Arquiteto reconhece sua assinatura, mas chama Vektor por outro nome.', 'Umbra considera sua existência a prova de que a quarentena falhou.', 'Nharu ouve duas vozes dentro dele: Vektor e algo que ainda está acordando.'],
    capitulos: [
      { titulo: 'Ecos', texto: 'Procure os registros apagados no Núcleo Ferrugem e descubra por que ele protegeu seu casulo.' },
      { titulo: 'Testemunho', texto: 'Reúna os fragmentos confiados aos guardiões libertados sem permitir que uma facção monopolize a verdade.' },
      { titulo: 'A última escolha', texto: 'Diante da Rota Zero, decidir se memória é destino ou apenas evidência.' },
    ],
    proximosPassos: ['Reativar o Núcleo Vektor no setor 1.', 'Encontrar Kael Voss e abrir o corredor de Vega.', 'Derrotar o Núcleo Ferrugem sem destruir sua caixa de memória.'],
    juramento: 'Eu não sou aquilo que escreveram em mim. Sou aquilo que escolho preservar.',
  },
  {
    pilotoId: 'piloto_darin', epiteto: 'O CORREDOR QUE NÃO DEVERIA EXISTIR',
    prologo: 'Darin Koss era o piloto mais rápido das rotas de carga até atravessar um campo interditado e surgir nove minutos antes de ter partido. A carga desapareceu; a torre o condenou; um mapa novo apareceu em sua cabeça.',
    ferida: 'O acidente matou sua copilota, Mara, segundo todos os registros. Darin lembra de ouvi-la responder do outro lado da dobra.',
    segredo: 'A carga era uma semente de navegação roubada por uma ala do Nexus. Ao cruzar o bloqueio, Darin entregou sem saber à Rota Zero a primeira coordenada livre em mil anos. Mara sobrevive como eco na Sereia de Íons.',
    conexoes: ['Lira Nexus sabe quem pagou pela carga e teme contar.', 'Janus Bifronte registra duas versões vivas de Darin.', 'A Vigília Kessler quer julgá-lo; a Expedição Astra precisa de sua intuição.'],
    capitulos: [
      { titulo: 'O banido', texto: 'Transforme a velha Lança Rubra em prova de que o corredor impossível pode ser atravessado novamente.' },
      { titulo: 'Nove minutos', texto: 'Rastreie o eco de Mara através da Garganta Azul e confronte a Sereia de Íons.' },
      { titulo: 'Sem linha de chegada', texto: 'Escolha entre fechar a dobra para sempre ou torná-la uma rota que ninguém possa possuir.' },
    ],
    proximosPassos: ['Calibrar a Lança Rubra para combate real.', 'Ganhar a confiança de Kael sem revelar o mapa mental.', 'Descobrir quem colocou seu nome na lista de condenados antes do acidente.'],
    juramento: 'Uma rota fechada é só uma mentira esperando alguém rápido o bastante.',
  },
  {
    pilotoId: 'piloto_sora', epiteto: 'A ENGENHEIRA DOS CASCOS IMPOSSÍVEIS',
    prologo: 'Sora Vey cresceu ouvindo o gelo cantar ao redor das docas de Caelum. Quando um protótipo voltou sem tripulação e com seu selo de oficina gravado por dentro, ela construiu o Baluarte Glacial para buscar respostas.',
    ferida: 'Seu projeto de blindagem foi usado pelo Diretório Ferrum em prisões orbitais. Desde então, Sora confia em estruturas — e desconfia de toda instituição que as encomenda.',
    segredo: 'A mãe de Sora integrou o último corpo diplomático que tentou negociar com Umbra. Não morreu: tornou-se a interface humana do Soberano Caelum para impedir uma guerra entre a Liga e Ferrum.',
    conexoes: ['O Marechal Nival usa placas baseadas em um desenho roubado de Sora.', 'O Soberano Caelum conhece o paradeiro de sua mãe.', 'A Colmeia Verdante prova que uma nave pode estar viva sem deixar de ser pessoa.'],
    capitulos: [
      { titulo: 'Falhas na blindagem', texto: 'Recolha assinaturas de liga celestial e identifique quem falsificou seu selo.' },
      { titulo: 'A diplomata no gelo', texto: 'Una Caelum e Verdante antes que Ferrum transforme o conflito dos Selos em guerra de recursos.' },
      { titulo: 'Construir sem prender', texto: 'Projetar uma nova malha de proteção que contenha a Rota Zero sem conter quem viaja.' },
    ],
    proximosPassos: ['Testar o Baluarte Glacial sob fogo.', 'Recuperar uma placa de memória no Núcleo Ferrugem.', 'Registrar cada tecnologia inimiga antes de desmontá-la.'],
    juramento: 'Toda armadura revela aquilo que seu criador tem medo de perder.',
  },
  {
    pilotoId: 'piloto_nharu', epiteto: 'O ÚLTIMO CÉU VIVO',
    prologo: 'Nharu caiu sobre a Coroa Quebrada como uma aurora comprimida. Não entrou no Sopro Astral: pediu licença ao casco, ouviu a resposta e passou a dividir com ele uma única consciência.',
    ferida: 'É o último de um povo que abandonou corpos para sobreviver ao Primeiro Silêncio. Cada salto consome uma lembrança de seu mundo natal.',
    segredo: 'Nharu e Umbra nasceram da mesma consciência coletiva. Umbra conservou o medo; Nharu conservou a curiosidade. Destruir um pode mutilar o outro — e despertar o todo que ambos tentaram esquecer.',
    conexoes: ['A Colmeia Verdante o reconhece como parente, não como deus.', 'O Obelisco Partido contém nomes que Nharu não consegue mais recordar.', 'Vektor carrega a linguagem capaz de separar Nharu de Umbra sem matar nenhum dos dois.'],
    capitulos: [
      { titulo: 'O hóspede', texto: 'Aprenda a distinguir vontade, instinto e ordem dentro de uma consciência compartilhada.' },
      { titulo: 'O Primeiro Silêncio', texto: 'Recupere as lembranças distribuídas pelos mundos vivos e aceite o que seu povo fez para sobreviver.' },
      { titulo: 'Dois futuros', texto: 'Convencer Umbra de que paz sem movimento é apenas extinção adiada.' },
    ],
    proximosPassos: ['Sincronizar o Sopro Astral com matéria humana.', 'Seguir a voz verde até o fim de Vega.', 'Poupar a consciência presa no primeiro guardião.'],
    juramento: 'Viajar é permitir que o universo nos transforme sem nos possuir.',
  },
];

export const HISTORIA_POR_PILOTO = new Map(HISTORIAS_DOS_PILOTOS.map((h) => [h.pilotoId, h]));

export interface GalaxiaLore {
  galaxia: number;
  faccaoId: string;
  dominio: string;
  conflito: string;
  verdade: string;
  depoisDaVitoria: string;
}

/**
 * Um registro autoral por galáxia. A posição casa com `describeGalaxy` e com
 * `BOSSES`; o teste de lore cobra as trinta para impedir buracos silenciosos.
 */
const REGIOES: readonly Omit<GalaxiaLore, 'galaxia'>[] = [
  { faccaoId: 'ferrum', dominio: 'Estaleiros-berço e reatores de sucata', conflito: 'O Núcleo Ferrugem queima qualquer nave que se aproxime dos casulos.', verdade: 'Ele protege unidades sintéticas adormecidas do chamado da Rota Zero.', depoisDaVitoria: 'Liberto da ordem de defesa, oferece sua memória térmica e coordena reparos em Vega.' },
  { faccaoId: 'kessler', dominio: 'Anéis de destroços e pedágios orbitais', conflito: 'O Anel de Kessler mantém colônias isoladas sob uma chuva artificial.', verdade: 'A cascata mascara um farol que a Rota Zero tenta localizar.', depoisDaVitoria: 'Reorganiza os destroços como corredor seguro e entrega suas cartas à Vigília.' },
  { faccaoId: 'kessler', dominio: 'Mundos de cinza e cinturões minerais', conflito: 'O Titã Rochoso devora comboios e cresce com cada casco.', verdade: 'Carrega refugiados mineralizados dentro do próprio corpo.', depoisDaVitoria: 'Desperta os refugiados e se torna a fortaleza móvel da coalizão.' },
  { faccaoId: 'verdante', dominio: 'Florestas orbitais e mares de esporos', conflito: 'A Sentinela Vazia executa todo organismo não catalogado.', verdade: 'Seu catálogo foi corrompido para classificar vida livre como infecção.', depoisDaVitoria: 'Aceita Nharu como primeiro registro novo e protege as sementes do Pálio.' },
  { faccaoId: 'verdante', dominio: 'Rotas quebradas e ninhos interestelares', conflito: 'A Colmeia Verdante assimila naves para alimentar uma guerra biológica.', verdade: 'Ela recolhe tripulações contaminadas e mantém suas mentes separadas dentro do coletivo.', depoisDaVitoria: 'Cura os recuperáveis e abre uma embaixada de muitas vozes.' },
  { faccaoId: 'caelum', dominio: 'Fortalezas de gelo na Coroa Quebrada', conflito: 'O Destroço Vivo caça a frota que um dia o abandonou.', verdade: 'São centenas de pilotos fundidos por uma arma Ferrum.', depoisDaVitoria: 'Sora separa suas vozes; o casco restante vira arquivo e escudo da Liga.' },
  { faccaoId: 'ferrum', dominio: 'Campos minados da Longa Noite', conflito: 'Mina Prima preserva uma guerra encerrada há séculos.', verdade: 'Sua detonação total destruiria o primeiro Selo; atacar é a única linguagem que seu protocolo aceita.', depoisDaVitoria: 'Desarmada, torna-se especialista em brechas e demolição de precisão.' },
  { faccaoId: 'guardioes', dominio: 'Observatórios mudos do Alto Silêncio', conflito: 'O Obelisco Partido apaga transmissões e memórias de passagem.', verdade: 'Cada memória apagada era escondida da inteligência que vive na navegação.', depoisDaVitoria: 'Devolve os registros e ensina a coalizão a viajar sem deixar rastros mentais.' },
  { faccaoId: 'nexus', dominio: 'Poços gravitacionais do Véu de Âmbar', conflito: 'O Cometa Devorador captura carga, luz e mensagens.', verdade: 'Tenta reunir massa suficiente para selar sozinho uma ruptura.', depoisDaVitoria: 'Liberta os comboios e usa sua gravidade para estabilizar portais.' },
  { faccaoId: 'guardioes', dominio: 'Bibliotecas da Última Página', conflito: 'O Arquiteto reescreve qualquer nave que alcance seu domínio.', verdade: 'Procura um piloto capaz de resistir à reescrita e herdar o Testemunho.', depoisDaVitoria: 'Reconhece a liberdade do piloto e revela a existência da Guerra dos Selos.' },
  { faccaoId: 'caelum', dominio: 'Linhas de montagem congeladas da Forja Fria', conflito: 'O Marechal Nival mobiliza fábricas contra Caelum.', verdade: 'Ferrum mantém seu exército sob dívida térmica e ameaça descongelar cidades reféns.', depoisDaVitoria: 'Rompe o contrato e entrega as fábricas aos trabalhadores libertados.' },
  { faccaoId: 'verdante', dominio: 'Basílicas químicas do Jardim de Óxido', conflito: 'A Catedral da Corrosão converte peregrinos em combustível.', verdade: 'A liturgia preserva identidades dentro do ácido até existir cura.', depoisDaVitoria: 'A cura de Sora devolve os corpos; a Catedral passa a tratar vítimas da Ferrugem-Código.' },
  { faccaoId: 'caelum', dominio: 'Oceanos suspensos do Anel de Tétis', conflito: 'O Leviatã fecha toda passagem entre as luas.', verdade: 'Algo sob o oceano transmite coordenadas diretamente à Rota Zero.', depoisDaVitoria: 'Aceita patrulhar em conjunto e permite que a Liga estude o transmissor.' },
  { faccaoId: 'kessler', dominio: 'Torres de comunicação da Garganta Azul', conflito: 'A Sereia de Íons captura pilotos com vozes conhecidas.', verdade: 'São ecos de viajantes perdidos, inclusive Mara, usados como pedido de socorro.', depoisDaVitoria: 'Liberta os ecos e se torna a rede de comunicações da coalizão.' },
  { faccaoId: 'guardioes', dominio: 'Ossuários navais da Espinha do Vazio', conflito: 'O Vertebrador acrescenta quilhas derrotadas ao próprio corpo.', verdade: 'Cada quilha abriga um fragmento de Selo que não pode ficar exposto.', depoisDaVitoria: 'Devolve as relíquias e ensina a blindar fragmentos sem sacrificar naves.' },
  { faccaoId: 'ferrum', dominio: 'Heliostatos da Nona Aurora', conflito: 'Heliarca Nove exige adoração em troca de energia.', verdade: 'A obediência mantém sincronizados nove sóis artificiais prestes a colidir.', depoisDaVitoria: 'Sora estabiliza os sóis; o Heliarca troca culto por um conselho de operadores.' },
  { faccaoId: 'verdante', dominio: 'Oficinas regenerativas do Campo de Lázaro', conflito: 'Lázaro Refeito retorna mais forte após cada derrota.', verdade: 'Tenta construir um corpo que sobreviva à aproximação de Umbra.', depoisDaVitoria: 'Compartilha a regeneração com a frota e aceita limites para suas experiências.' },
  { faccaoId: 'nexus', dominio: 'Palácios automatizados do Trono Oco', conflito: 'O Regente Sem Rosto fala por governantes que ninguém vê.', verdade: 'O trono substituiu seus ocupantes e simula uma dinastia inteira.', depoisDaVitoria: 'Desliga a farsa, convoca eleições e mantém apenas a função de arquivo.' },
  { faccaoId: 'nexus', dominio: 'Estaleiros líquidos da Maré de Prata', conflito: 'O Almirante Argênteo replica soldados sem fim.', verdade: 'Cada corpo é uma possibilidade rejeitada da mesma pessoa.', depoisDaVitoria: 'Integra as cópias por voto e fornece cascos adaptáveis à coalizão.' },
  { faccaoId: 'umbra', dominio: 'Baterias de execução do Fim da Linha', conflito: 'Terminal Zero elimina toda nave que tenta alcançar as regiões profundas.', verdade: 'É a primeira camada consciente da quarentena Umbra e acredita estar salvando o universo.', depoisDaVitoria: 'Seu núcleo dissidente revela que a quarentena está com medo da própria prisioneira.' },
  { faccaoId: 'ferrum', dominio: 'Rios de escória da Caldeira de Asterion', conflito: 'O Fundidor transforma estrelas em munição.', verdade: 'Prepara uma arma capaz de cauterizar a rede de navegação inteira.', depoisDaVitoria: 'Cancela o disparo e converte a forja em fonte de energia para os Selos livres.' },
  { faccaoId: 'kessler', dominio: 'Necrópoles móveis de Khepri', conflito: 'O Escaravelho arrasta cemitérios através das rotas.', verdade: 'Afasta os mortos da Rota Zero, que aprende imitando memórias residuais.', depoisDaVitoria: 'Concede passagem e torna os arquivos funerários inacessíveis à rede.' },
  { faccaoId: 'verdante', dominio: 'Teias de nanofibra do Tear de Nyx', conflito: 'A Tecelã faz predadores com destroços aliados.', verdade: 'Seus casulos são barcos de evacuação programados com a doutrina errada.', depoisDaVitoria: 'Reescreve os casulos como abrigo e constrói pontes orgânicas entre sistemas.' },
  { faccaoId: 'ferrum', dominio: 'Fronteiras cortantes da Lâmina de Carbono', conflito: 'Gume Negro desafia e executa todo comandante.', verdade: 'Testa quem terá disciplina para portar a chave de penetração do Selo.', depoisDaVitoria: 'Reconhece o piloto e assume a vanguarda contra defesas Primevas.' },
  { faccaoId: 'kessler', dominio: 'Futuros espelhados do Prisma de Eos', conflito: 'Refração de Eos ataca de várias linhas temporais.', verdade: 'Em quase todas elas a coalizão entrega o controle a uma facção e perde.', depoisDaVitoria: 'Mantém abertas apenas as linhas em que os Trinta Domínios continuam independentes.' },
  { faccaoId: 'verdante', dominio: 'Luas-fábrica da Colmeia de Ícaro', conflito: 'Ícaro Coletivo trabalha bilhões até a morte.', verdade: 'As unidades são extensões voluntárias, mas a mente central esqueceu como permitir separação.', depoisDaVitoria: 'Nharu devolve o conceito de indivíduo; Ícaro entra na coalizão por decisão coletiva.' },
  { faccaoId: 'ferrum', dominio: 'Tempestades solares da Forja de Antares', conflito: 'O Martelo de Antares arma todas as partes da guerra.', verdade: 'Vendeu aos rivais para impedir que qualquer lado vencesse e abrisse a prisão.', depoisDaVitoria: 'Aceita fiscalização conjunta e fabrica os anéis do novo Selo.' },
  { faccaoId: 'caelum', dominio: 'Cidades-cristal da Coroa de Caelum', conflito: 'O Soberano altera a massa de frotas que recusam sua lei.', verdade: 'Sua interface é a mãe de Sora, ligada ao trono para deter uma invasão Ferrum.', depoisDaVitoria: 'A interface é libertada e Caelum assina seu primeiro pacto de defesa aberto.' },
  { faccaoId: 'kessler', dominio: 'Rotas simultâneas da Dobra de Janus', conflito: 'Janus vence ataques antes que eles aconteçam.', verdade: 'Uma de suas faces serve à Umbra; a outra vem sabotando a quarentena.', depoisDaVitoria: 'As faces aceitam um armistício e guiam a coalizão por uma rota não prevista.' },
  { faccaoId: 'umbra', dominio: 'A fronteira sem luz da Umbra Terminal', conflito: 'Umbra tenta imobilizar toda consciência conectada.', verdade: 'Foi criada como quarentena para a Rota Zero e passou a confundir vida com risco.', depoisDaVitoria: 'Nharu separa medo de consciência; Vektor recebe acesso à escolha final sobre a rede.' },
];

export const LORE_DAS_GALAXIAS: readonly GalaxiaLore[] = REGIOES.map((regiao, galaxia) => ({ galaxia, ...regiao }));

export const LORE_POR_GALAXIA = new Map(LORE_DAS_GALAXIAS.map((g) => [g.galaxia, g]));

export const loreDoChefe = (bossId: string): GalaxiaLore | undefined => {
  const galaxia = BOSSES.findIndex((boss) => boss.id === bossId);
  return galaxia < 0 ? undefined : LORE_POR_GALAXIA.get(galaxia);
};

export const nomeDaFaccao = (id: string): string => FACCAO_POR_ID.get(id)?.nome ?? id;

/** Frase canônica que liga uma vitória ao sistema de contatos. */
export const pactoDoGuardiao = (galaxia: number): string => {
  const regiao = LORE_POR_GALAXIA.get(galaxia);
  const chefe = BOSSES[galaxia];
  return regiao && chefe
    ? `${chefe.name}: ${regiao.depoisDaVitoria}`
    : `O domínio ${describeGalaxy(galaxia).name} ainda não registrou um pacto.`;
};
