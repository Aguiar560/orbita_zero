import { ESPECIAIS } from '@data/provacao-especiais';
import type { ElementId, ElementoResistivel } from '@sim/types';

/**
 * Os cem chefes do Núcleo de Provação (§32–§35).
 *
 * **Cem criaturas DISTINTAS, uma por piso.** Não são os chefes de galáxia — o
 * `data/bosses.ts` continua servindo à campanha e não é tocado aqui. O Núcleo
 * tem elenco próprio, e nenhum nome se repete.
 *
 * Antes desta tabela, o piso pegava um dos dez chefes de galáxia em rodízio, e
 * a variedade vinha só dos modificadores. Funcionava, mas fazia o piso 47 ser o
 * piso 7 com outro traje — e o §33 pede o contrário. Com elenco próprio, a
 * mecânica DIFERENTE do modificador cai sobre uma criatura DIFERENTE.
 *
 * ## Dez camadas de dez
 *
 * Cada camada tem tema, elemento dominante e uma pergunta tática própria. Isso
 * dá ao Núcleo um arco em vez de cem entradas soltas: o jogador atravessa o
 * Cinturão de Sucata, depois o Berçário, depois a Mortalha — e sente que está
 * indo a algum lugar.
 *
 * O elemento dominante NÃO é exclusivo. Toda camada tem um ou dois fora do tema,
 * senão o jogador montaria uma configuração para os dez pisos e desligaria o
 * cérebro — que é o mesmo vício que o §33 combate, por outra porta.
 *
 * ## Números derivados do ARQUÉTIPO
 *
 * Vida, dano, escudo e velocidade saem do arquétipo, não de cem conjuntos
 * escritos à mão. Cem linhas de números soltos ninguém revisa, e a primeira
 * recalibragem deixaria metade fora da curva. O arquétipo é a decisão de design
 * ("isto é uma fortaleza"), e os números são consequência dela.
 *
 * Quando um chefe precisa fugir do arquétipo, ele traz `ajuste` — e aí o desvio
 * é explícito e localizado, em vez de diluído em cem tabelas.
 */

// ── arquétipos ──────────────────────────────────────────────────────────────

/**
 * Como a criatura se comporta e, por consequência, quais são seus números.
 *
 * O arquétipo é o que a camada de combate vai ler para decidir movimento e
 * padrão de tiro. Existir como dado — e não como classe — mantém `data/` sendo
 * tabela, que é a regra 3 da arquitetura.
 */
export type Arquetipo =
  | 'fortaleza'   // lento, muito escudo, castiga quem fica parado
  | 'artilheiro'  // fica longe e pune aproximação
  | 'investida'   // avança em linha reta, rápido e frágil
  | 'invocador'   // pouco dano próprio, enche a tela
  | 'orbital'     // gira em volta, tiro contínuo
  | 'cacador'     // persegue, dano alto, morre rápido
  | 'dispersor'   // tiro em leque, cobre área
  | 'espectro';   // escudo alto, some e reaparece

export interface PerfilDeArquetipo {
  vida: number;
  dano: number;
  escudo: number;
  velocidade: number;
  nota: string;
}

/**
 * Os números de cada arquétipo.
 *
 * Somam poder parecido por caminhos diferentes: a fortaleza compra vida com
 * lentidão, o caçador compra dano com fragilidade. É o que impede uma
 * configuração única de responder aos oito.
 */
export const ARQUETIPOS: Record<Arquetipo, PerfilDeArquetipo> = {
  fortaleza: { vida: 1.60, dano: 0.85, escudo: 1.55, velocidade: 0.70, nota: 'Aguenta e pune quem fica parado.' },
  artilheiro: { vida: 0.90, dano: 1.35, escudo: 1.00, velocidade: 0.90, nota: 'Mantém distância e castiga a aproximação.' },
  investida: { vida: 1.15, dano: 1.20, escudo: 0.70, velocidade: 1.50, nota: 'Avança em linha reta. Rápido e quebradiço.' },
  invocador: { vida: 1.00, dano: 0.75, escudo: 1.25, velocidade: 0.85, nota: 'Pouco dano próprio. Enche a tela.' },
  orbital: { vida: 1.25, dano: 1.00, escudo: 1.30, velocidade: 1.00, nota: 'Gira em volta com tiro contínuo.' },
  cacador: { vida: 0.85, dano: 1.20, escudo: 0.85, velocidade: 1.40, nota: 'Persegue sem descanso. Morre rápido.' },
  dispersor: { vida: 1.05, dano: 1.10, escudo: 1.10, velocidade: 1.00, nota: 'Tiro em leque. Cobre a tela toda.' },
  espectro: { vida: 0.75, dano: 1.30, escudo: 1.65, velocidade: 1.25, nota: 'Some e reaparece. O escudo é o problema.' },
};

// ── camadas ─────────────────────────────────────────────────────────────────

export interface CamadaDef {
  indice: number;
  nome: string;
  /** A pergunta tática que a camada faz ao jogador. */
  tema: string;
  elemento: ElementId;
  cor: string;
}

export const CAMADAS: readonly CamadaDef[] = [
  { indice: 1, nome: 'Cinturão de Sucata', tema: 'Aprender a ler os padrões.', elemento: 'padrao', cor: '#9AA7BD' },
  { indice: 2, nome: 'Berçário Verdejante', tema: 'Limpar o que se multiplica.', elemento: 'quimico', cor: '#7CE04F' },
  { indice: 3, nome: 'Mortalha de Gelo', tema: 'Manter-se em movimento.', elemento: 'gelo', cor: '#7FD8FF' },
  { indice: 4, nome: 'Tempestade Perpétua', tema: 'Sobreviver ao que encadeia.', elemento: 'raio', cor: '#FFE45C' },
  { indice: 5, nome: 'Forja Extinta', tema: 'Dano sustentado contra blindagem.', elemento: 'fogo', cor: '#FF7A3D' },
  { indice: 6, nome: 'Vazio Silencioso', tema: 'Lutar sem referência espacial.', elemento: 'cosmico', cor: '#B45CFF' },
  { indice: 7, nome: 'Praga Antiga', tema: 'Correr contra o relógio.', elemento: 'quimico', cor: '#9BE04F' },
  { indice: 8, nome: 'Fenda Colapsante', tema: 'Escolher o alvo certo.', elemento: 'cosmico', cor: '#C77DFF' },
  { indice: 9, nome: 'Ruína dos Arquitetos', tema: 'Tudo que veio antes, junto.', elemento: 'padrao', cor: '#FF4B4B' },
  { indice: 10, nome: 'Ápice', tema: 'O que o Núcleo guardava.', elemento: 'cosmico', cor: '#FFB638' },
];

export const camadaDoPiso = (piso: number): CamadaDef =>
  CAMADAS[Math.min(9, Math.max(0, Math.ceil(piso / 10) - 1))]!;

// ── os chefes ───────────────────────────────────────────────────────────────

export interface ChefeDaProvacao {
  id: string;
  nome: string;
  /** O que ele é, em uma linha. Aparece na tela antes da luta. */
  caracteristica: string;
  /** Piso em que aparece, 1 a 100. Único. */
  piso: number;
  camada: number;
  elemento: ElementId;
  arquetipo: Arquetipo;
  /** Resistências por elemento, 0..1. */
  resistencias: Partial<Record<ElementoResistivel, number>>;
  vida: number;
  dano: number;
  escudo: number;
  velocidade: number;
  /**
   * O especial da criatura, por id de `abismo-especiais.ts`.
   *
   * É o que dá particularidade a cada chefe: a barra enche e ele faz a SUA
   * coisa — atordoar, curar-se, arrancar o escudo ou despejar dano. Dois chefes
   * com a mesma vida e o mesmo elemento continuam sendo lutas diferentes se o
   * especial for diferente.
   */
  especial: string;
  /**
   * Sprite do chefe.
   *
   * Vem em rodízio dos props já recortados de `data/bosses.ts`. Não é o ideal —
   * cem criaturas merecem cem artes —, mas é um nome que COMPROVADAMENTE existe
   * no atlas. Inventar um nome aqui daria piso sem arte passando por typecheck,
   * que foi exatamente o erro do `cat/alvo` na aba de missões.
   */
  sprite: string;
}

/**
 * Entrada compacta do elenco: id, nome, característica, arquétipo e — quando
 * foge do padrão — elemento próprio e ajuste de números.
 *
 * Tupla e não objeto: cem objetos com sete chaves cada seriam setecentas linhas
 * de ruído onde só três colunas variam de fato.
 */
type Linha = [
  id: string,
  nome: string,
  caracteristica: string,
  arquetipo: Arquetipo,
  elemento?: ElementId,
  ajuste?: Partial<Pick<ChefeDaProvacao, 'vida' | 'dano' | 'escudo' | 'velocidade'>>,
  /** Especial escolhido à mão. Ausente = derivado, ver `especialDe`. */
  especial?: string,
];

const ELENCO: readonly (readonly Linha[])[] = [
  // ── 1. Cinturão de Sucata ─────────────────────────────────────────────────
  [
    ['ferro_desperto', 'Ferro Desperto', 'Um depósito de sucata que decidiu se defender.', 'fortaleza'],
    ['catador_cego', 'Catador Cego', 'Recolhe destroços e atira o que recolheu.', 'dispersor'],
    ['prensa_orbital', 'Prensa Orbital', 'Comprimia naves inteiras. Ainda comprime.', 'fortaleza'],
    ['reboque_fantasma', 'Reboque Fantasma', 'A tripulação foi embora. O piloto automático não.', 'investida'],
    ['guincho_lunar', 'Guincho Lunar', 'Puxa o que passa perto e não devolve.', 'cacador'],
    ['casco_vazio', 'Casco Vazio', 'Só a estrutura sobrou. Bastou.', 'fortaleza'],
    ['torre_de_arame', 'Torre de Arame', 'Antena de mineração convertida em canhão.', 'artilheiro'],
    ['broca_enferrujada', 'Broca Enferrujada', 'Perfurava asteroides. Agora perfura cascos.', 'investida', 'fogo'],
    ['balsa_de_restos', 'Balsa de Restos', 'Carrega o que sobrou de mil naufrágios.', 'invocador'],
    ['ferrolho_maior', 'Ferrolho Maior', 'O portão do Cinturão. Ninguém passava sem permissão.', 'fortaleza', 'padrao', { vida: 1.9, escudo: 1.8 }],
  ],

  // ── 2. Berçário Verdejante ────────────────────────────────────────────────
  [
    ['broto_metalico', 'Broto Metálico', 'Cresceu no casco de uma estação e não parou.', 'invocador'],
    ['esporo_maior', 'Esporo Maior', 'Cada tiro que leva libera mais um.', 'dispersor'],
    ['raiz_de_ferro', 'Raiz de Ferro', 'Enraizou-se no vácuo. Ninguém sabe como.', 'fortaleza'],
    ['polinizador', 'Polinizador', 'Espalha o que não devia ser espalhado.', 'orbital'],
    ['casulo_prenhe', 'Casulo Prenhe', 'Está prestes a abrir. Sempre esteve.', 'invocador'],
    ['vinha_faminta', 'Vinha Faminta', 'Alcança mais longe do que parece.', 'cacador'],
    ['ninho_zumbidor', 'Ninho Zumbidor', 'O som vem antes do enxame.', 'invocador'],
    ['flor_de_acido', 'Flor de Ácido', 'Bonita de longe. Só de longe.', 'artilheiro'],
    ['tronco_oco', 'Tronco Oco', 'O que mora dentro é pior que ele.', 'fortaleza', 'padrao'],
    ['matriarca_verde', 'Matriarca Verde', 'Todo o Berçário é filho dela.', 'invocador', 'quimico', { vida: 1.5, escudo: 1.6 }],
  ],

  // ── 3. Mortalha de Gelo ───────────────────────────────────────────────────
  [
    ['lasca_errante', 'Lasca Errante', 'Um fragmento com trajetória própria.', 'investida'],
    ['sepulcro_azul', 'Sepulcro Azul', 'Congelou uma frota inteira. Ainda a carrega.', 'fortaleza'],
    ['sopro_parado', 'Sopro Parado', 'O ar que ele exala não volta a se mover.', 'dispersor'],
    ['agulha_polar', 'Agulha Polar', 'Um tiro, muito longe, muito preciso.', 'artilheiro'],
    ['manto_quebradico', 'Manto Quebradiço', 'Racha ao ser atingido — e cada raxa atira.', 'dispersor'],
    ['caminhante_branco', 'Caminhante Branco', 'Anda devagar. Não precisa correr.', 'fortaleza'],
    ['eco_congelado', 'Eco Congelado', 'A imagem chega antes dele.', 'espectro'],
    ['nucleo_dormente', 'Núcleo Dormente', 'Acordou com fome de calor.', 'orbital', 'fogo'],
    ['garra_de_geada', 'Garra de Geada', 'Persegue pelo rastro térmico.', 'cacador'],
    ['soberano_hibernal', 'Soberano Hibernal', 'Dormia desde antes das galáxias terem nome.', 'fortaleza', 'gelo', { vida: 1.8, dano: 1.1 }],
  ],

  // ── 4. Tempestade Perpétua ────────────────────────────────────────────────
  [
    ['faisca_vagante', 'Faísca Vagante', 'Pequena, rápida, encadeia.', 'cacador'],
    ['polo_negativo', 'Polo Negativo', 'Atrai tudo que conduz.', 'orbital'],
    ['arco_voltaico', 'Arco Voltaico', 'O tiro salta de alvo em alvo.', 'dispersor'],
    ['bobina_orfa', 'Bobina Órfã', 'Perdeu a estação. Manteve a carga.', 'artilheiro'],
    ['nuvem_de_ferro', 'Nuvem de Ferro', 'Não é uma criatura. São milhares.', 'invocador'],
    ['relampago_lento', 'Relâmpago Lento', 'Leva três segundos para acontecer. Não erra.', 'artilheiro'],
    ['descarga_gemea', 'Descarga Gêmea', 'Sempre há dois. Sempre houve.', 'investida'],
    ['olho_da_tempestade', 'Olho da Tempestade', 'O único lugar calmo é perto demais.', 'fortaleza'],
    ['ima_colapsado', 'Ímã Colapsado', 'Puxa o casco, não a nave.', 'cacador', 'cosmico'],
    ['senhor_do_arco', 'Senhor do Arco', 'A tempestade obedece. Sempre obedeceu.', 'orbital', 'raio', { dano: 1.35, velocidade: 1.2 }],
  ],

  // ── 5. Forja Extinta ──────────────────────────────────────────────────────
  [
    ['bigorna_flutuante', 'Bigorna Flutuante', 'Ainda quente depois de mil anos.', 'fortaleza'],
    ['fole_rompido', 'Fole Rompido', 'Sopra brasa em vez de ar.', 'dispersor'],
    ['martelo_cego', 'Martelo Cego', 'Bate onde ouve. Ouve tudo.', 'investida'],
    ['escoria_viva', 'Escória Viva', 'O rejeito da forja aprendeu a andar.', 'invocador', 'quimico'],
    ['forno_ambulante', 'Forno Ambulante', 'Leva o próprio calor aonde vai.', 'fortaleza'],
    ['lamina_temperada', 'Lâmina Temperada', 'Forjada para cortar naves. Cumpriu.', 'cacador'],
    ['fundidor_mestre', 'Fundidor Mestre', 'Derrete blindagem antes de tocá-la.', 'artilheiro'],
    ['cinza_perpetua', 'Cinza Perpétua', 'O que sobra depois de tudo queimar.', 'espectro', 'padrao'],
    ['veio_de_magma', 'Veio de Magma', 'A forja ainda é alimentada por baixo.', 'orbital'],
    ['arqui_ferreiro', 'Arqui-Ferreiro', 'Fez as armas que ainda te matam.', 'fortaleza', 'fogo', { vida: 1.7, dano: 1.25, escudo: 1.7 }],
  ],

  // ── 6. Vazio Silencioso ───────────────────────────────────────────────────
  [
    ['ausencia_menor', 'Ausência Menor', 'Onde ele está, não há nada. Inclusive ele.', 'espectro'],
    ['mare_escura', 'Maré Escura', 'Vem em ondas que não se veem.', 'dispersor'],
    ['ponto_cego', 'Ponto Cego', 'Está sempre onde você não olhou.', 'cacador'],
    ['sino_mudo', 'Sino Mudo', 'Toca. Ninguém ouve. Todos sentem.', 'orbital', 'gelo'],
    ['deriva_infinita', 'Deriva Infinita', 'Está caindo há mais tempo que o universo.', 'investida'],
    ['casulo_do_nada', 'Casulo do Nada', 'Guarda algo que não deveria existir.', 'fortaleza'],
    ['reflexo_tardio', 'Reflexo Tardio', 'Faz o que você fez, dois segundos depois.', 'espectro'],
    ['gravidade_orfa', 'Gravidade Órfã', 'A estrela morreu. O poço ficou.', 'orbital'],
    ['nome_esquecido', 'Nome Esquecido', 'Tinha um. Ninguém sobrou para lembrar.', 'artilheiro', 'padrao'],
    ['guardiao_do_silencio', 'Guardião do Silêncio', 'Impede que o Vazio seja atravessado.', 'espectro', 'cosmico', { escudo: 2.0, dano: 1.4 }],
  ],

  // ── 7. Praga Antiga ───────────────────────────────────────────────────────
  [
    ['vetor_zero', 'Vetor Zero', 'O primeiro a ser infectado. Ainda o pior.', 'cacador'],
    ['carreador', 'Carreador', 'Não ataca. Só espalha.', 'invocador'],
    ['febre_metalica', 'Febre Metálica', 'A blindagem dele ferve sozinha.', 'orbital'],
    ['pulmao_roto', 'Pulmão Roto', 'Cada respiração é uma nuvem.', 'dispersor'],
    ['tecido_cinzento', 'Tecido Cinzento', 'Cresce sobre o que mata.', 'fortaleza'],
    ['agulha_septica', 'Agulha Séptica', 'Um toque basta.', 'investida'],
    ['colonia_madura', 'Colônia Madura', 'Passou do ponto de ser contida.', 'invocador'],
    ['hospedeiro_final', 'Hospedeiro Final', 'A praga terminou de usá-lo. Ele continua.', 'espectro'],
    ['quarentena_rompida', 'Quarentena Rompida', 'A barreira falhou. Isto saiu.', 'artilheiro', 'raio'],
    ['mae_da_praga', 'Mãe da Praga', 'Não é a origem. É o que a origem virou.', 'invocador', 'quimico', { vida: 1.6, escudo: 1.5, dano: 1.15 }],
  ],

  // ── 8. Fenda Colapsante ───────────────────────────────────────────────────
  [
    ['costura_frouxa', 'Costura Frouxa', 'O espaço aqui não fecha direito.', 'espectro'],
    ['duplo_falso', 'Duplo Falso', 'Um dos dois não é real. Descubra qual.', 'cacador'],
    ['horizonte_curto', 'Horizonte Curto', 'Engole o tiro antes que ele chegue.', 'fortaleza'],
    ['pulso_reverso', 'Pulso Reverso', 'O dano volta pelo caminho que veio.', 'orbital'],
    ['fragmento_tardio', 'Fragmento Tardio', 'Chegou de um futuro que não aconteceu.', 'artilheiro'],
    ['nucleo_instavel', 'Núcleo Instável', 'Vai explodir. A questão é onde você estará.', 'investida', 'fogo'],
    ['tecelao_da_fenda', 'Tecelão da Fenda', 'Abre buracos e põe coisas dentro.', 'invocador'],
    ['peso_impossivel', 'Peso Impossível', 'Massa que a física recusa.', 'fortaleza'],
    ['eco_de_colapso', 'Eco de Colapso', 'O barulho de algo que ainda vai desabar.', 'dispersor'],
    ['arauto_da_fenda', 'Arauto da Fenda', 'Veio anunciar. Ficou para executar.', 'espectro', 'cosmico', { dano: 1.5, velocidade: 1.3 }],
  ],

  // ── 9. Ruína dos Arquitetos ───────────────────────────────────────────────
  [
    ['sentinela_quebrada', 'Sentinela Quebrada', 'Guarda uma porta que não existe mais.', 'fortaleza'],
    ['plano_incompleto', 'Plano Incompleto', 'Foi construída até a metade. Basta.', 'dispersor'],
    ['obreiro_ultimo', 'Obreiro Último', 'Continua montando. Não há mais o que montar.', 'invocador'],
    ['pilar_tombado', 'Pilar Tombado', 'Sustentava algo enorme. Ainda tenta.', 'fortaleza'],
    ['compasso_cego', 'Compasso Cego', 'Mede distâncias que não deveria alcançar.', 'artilheiro'],
    ['molde_vivo', 'Molde Vivo', 'Faz cópias do que encontra.', 'invocador'],
    ['esquadro_de_ferro', 'Esquadro de Ferro', 'Corta em ângulos exatos.', 'cacador'],
    ['fundacao_desperta', 'Fundação Desperta', 'Estava embaixo de tudo. Subiu.', 'fortaleza', 'padrao', { vida: 2.0 }],
    ['risco_final', 'Risco Final', 'A última linha que os Arquitetos traçaram.', 'investida', 'cosmico'],
    ['arquiteto_remanescente', 'Arquiteto Remanescente', 'O único que não terminou de partir.', 'orbital', 'padrao', { vida: 1.7, dano: 1.3, escudo: 1.6 }],
  ],

  // ── 10. Ápice ─────────────────────────────────────────────────────────────
  [
    ['limiar', 'Limiar', 'Daqui em diante nada foi documentado.', 'espectro'],
    ['coroa_apagada', 'Coroa Apagada', 'Reinou sobre algo que já não tem nome.', 'fortaleza'],
    ['juiz_frio', 'Juiz Frio', 'Decide quem sobe. Costuma decidir que não.', 'artilheiro', 'gelo'],
    ['legiao_de_um', 'Legião de Um', 'Sozinho, e ainda assim cercado.', 'invocador'],
    ['ultimo_farol', 'Último Farol', 'Aponta para fora. Ninguém saiu.', 'orbital', 'raio'],
    ['peso_do_abismo', 'Peso da Provação', 'Tudo que caiu aqui, comprimido.', 'fortaleza', 'cosmico', { vida: 2.2 }],
    ['ceifa_silenciosa', 'Ceifa Silenciosa', 'Não persegue. Espera no lugar certo.', 'cacador'],
    ['aurora_negra', 'Aurora Negra', 'A luz que vem antes do fim de tudo.', 'dispersor', 'fogo'],
    ['penultimo', 'Penúltimo', 'Sabe que não é o último. Isso o irrita.', 'espectro', 'quimico', { dano: 1.5 }],
    ['coracao_do_abismo', 'Coração da Provação', 'O que os cem pisos existiam para guardar.', 'fortaleza', 'cosmico', { vida: 2.5, dano: 1.6, escudo: 2.0, velocidade: 0.9 }],
  ],
];

/**
 * Resistências do chefe.
 *
 * O próprio elemento resiste forte; o elemento que ele CASTIGA no anel resiste
 * médio. É coerente com o §5 e dá ao jogador uma leitura: o chefe de gelo não é
 * só "de gelo", ele é ruim de matar com gelo.
 *
 * A profundidade acrescenta uma base contra tudo — no piso 90 nenhuma
 * configuração passa sem atrito.
 */
function resistenciasDe(elemento: ElementId, piso: number): Partial<Record<ElementoResistivel, number>> {
  const base = Math.min(0.2, Math.max(0, (piso - 30) * 0.0035));
  const r: Partial<Record<ElementoResistivel, number>> = {};
  for (const e of ['fogo', 'raio', 'quimico', 'cosmico', 'gelo'] as ElementoResistivel[]) {
    const proprio = e === elemento ? 0.4 : 0;
    const valor = Math.min(0.7, base + proprio);
    if (valor > 0) r[e] = Number(valor.toFixed(3));
  }
  return r;
}

/**
 * Qual especial cabe a este chefe.
 *
 * Distribuído por PISO e ARQUÉTIPO, não sorteado: dezoito especiais para cem
 * chefes significa repetição inevitável, e o que importa é que ela nunca
 * aconteça DENTRO da mesma camada — dois vizinhos com o mesmo golpe fazem o
 * jogador achar que o conteúdo acabou.
 *
 * O deslocamento por camada garante isso: dentro de uma camada os dez índices
 * são consecutivos e portanto distintos, e a cada camada a janela anda.
 */
function especialDe(piso: number): string {
  const camada = Math.ceil(piso / 10) - 1;
  const posicao = (piso - 1) % 10;
  /**
   * `posicao` percorre 0..9 CONSECUTIVOS dentro da camada, e dez consecutivos
   * módulo dezoito são sempre distintos — é o que garante que dois vizinhos
   * nunca repitam o golpe. Dois vizinhos com o mesmo especial fazem o jogador
   * achar que o conteúdo acabou.
   *
   * O passo 7 por camada desloca a janela sem alinhá-la: 7 e 18 são primos
   * entre si, então as dez janelas cobrem os dezoito especiais.
   *
   * A primeira versão somava um viés por ARQUÉTIPO aqui, para variar mais. Foi
   * exatamente isso que quebrou a consecutividade — e o teste pegou seis
   * especiais distintos em dez chefes da camada 1.
   */
  return ESPECIAIS[(camada * 7 + posicao) % ESPECIAIS.length]!.id;
}

/**
 * Sprites emprestados dos chefes de campanha.
 *
 * Provisório e declarado como tal: o elenco próprio pede arte própria, e esta
 * constante é o lugar onde essa dívida fica visível em vez de espalhada.
 */
const SPRITES: readonly string[] = [
  'prop/reactor_tower', 'prop/ring_station', 'prop/spike_rock',
  'prop/wreck_beam', 'prop/mine_spike', 'prop/pillar_broken',
];

/** O elenco montado: cem chefes, um por piso. */
export const CHEFES_DA_PROVACAO: readonly ChefeDaProvacao[] = ELENCO.flatMap((camada, ci) =>
  camada.map((linha, li) => {
    const [id, nome, caracteristica, arquetipo, elemento, ajuste, especial] = linha;
    const piso = ci * 10 + li + 1;
    const elem = elemento ?? CAMADAS[ci]!.elemento;
    const perfil = ARQUETIPOS[arquetipo];
    return {
      id: `provacao_${id}`,
      nome,
      caracteristica,
      piso,
      camada: ci + 1,
      elemento: elem,
      arquetipo,
      resistencias: resistenciasDe(elem, piso),
      vida: ajuste?.vida ?? perfil.vida,
      dano: ajuste?.dano ?? perfil.dano,
      escudo: ajuste?.escudo ?? perfil.escudo,
      velocidade: ajuste?.velocidade ?? perfil.velocidade,
      especial: especial ?? especialDe(piso),
      sprite: SPRITES[(piso - 1) % SPRITES.length]!,
    };
  }),
);

export const CHEFE_DA_PROVACAO_POR_ID = new Map(CHEFES_DA_PROVACAO.map((c) => [c.id, c]));

/** O chefe daquele piso. Recorta em vez de estourar. */
export const chefeDoPiso = (piso: number): ChefeDaProvacao =>
  CHEFES_DA_PROVACAO[Math.min(99, Math.max(0, Math.floor(piso) - 1))]!;
