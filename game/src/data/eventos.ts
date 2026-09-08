import type { Objetivo } from './missoes';

/**
 * Com que frequência um evento volta.
 *
 * Cada ritmo alimenta um sumidouro DIFERENTE, e é isso que os impede de
 * competir entre si — ver `docs/ECONOMIA-DOS-RECURSOS.md`:
 *
 * - `diario`: paga o MINÉRIO do elemento, e é o que sustenta a conversão
 *   elemental de item e de nave. Também é o que resolve a escassez de gelo,
 *   cujo minério só existe nas galáxias 12 e 18: a peça de gelo deixa de ser um
 *   muro e vira uma agenda.
 * - `semanal`: paga o GÁS, que a Engenharia consome.
 * - `mensal`: paga TECNOLOGIA de chefe, que constrói as peças exclusivas.
 */
export type RitmoDeEvento = 'diario' | 'semanal' | 'mensal';

export interface EventoDef {
  id: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  cor: string;
  ritmo: RitmoDeEvento;
  /**
   * O recurso que o evento paga.
   *
   * Chamava-se `gas` quando só havia um ritmo. O nome mentia desde o dia em
   * que o diário passou a pagar minério: um campo chamado `gas` contendo
   * "cromita" é o tipo de coisa que engana quem lê o arquivo, não o computador.
   */
  recurso: string;
  quantidade: number;
  setorMinimo: number;
  objetivo: Objetivo;
  modificador: string;
}

/**
 * Dez eventos, dez gases, nenhuma tabela genérica.
 *
 * Cada evento dura três dias; uma volta completa leva trinta. A janela é longa
 * o bastante para um idle e curta o bastante para o jogador não esperar meses
 * pelo gás da receita que quer fabricar.
 */
/**
 * Quanto dura cada ritmo.
 *
 * O diário fecha a volta em SEIS dias — um por elemento —, o semanal em dez
 * semanas e o mensal em três meses. Nenhum é múltiplo exato do outro, de
 * propósito: assim as três janelas deslizam umas sobre as outras e o jogador
 * nunca encontra a mesma combinação duas vezes seguidas.
 */
export const DURACAO_DO_RITMO: Readonly<Record<RitmoDeEvento, number>> = {
  diario: 24 * 60 * 60 * 1_000,
  semanal: 7 * 24 * 60 * 60 * 1_000,
  mensal: 30 * 24 * 60 * 60 * 1_000,
};

/** Compatibilidade: a janela semanal era a única, e valia 72h. */
export const DURACAO_EVENTO_MS = DURACAO_DO_RITMO.semanal;
export const MARCO_DOS_EVENTOS = Date.UTC(2026, 0, 5);

export const EVENTOS: readonly EventoDef[] = [
  { id: 'corrida_propulsores', nome: 'Corrida de Propulsores', subtitulo: 'ÓRBITA RÁPIDA', cor: '#57d9ff', ritmo: 'semanal', recurso: 'gas_helio_3', quantidade: 45, setorMinimo: 10, modificador: '+12% velocidade inimiga · +18% núcleos', objetivo: { fato: 'abate', alvo: 140, texto: 'Abater 140 inimigos' }, descricao: 'Coletores de Hélio-3 abrem somente enquanto as pistas orbitais estão energizadas.' },
  { id: 'colapso_fusao', nome: 'Colapso de Fusão', subtitulo: 'CONTENÇÃO', cor: '#8ac7ff', ritmo: 'semanal', recurso: 'deuterio', quantidade: 40, setorMinimo: 20, modificador: 'Chefes +15% vida · caixas com carga térmica', objetivo: { fato: 'setor', alvo: 8, filtro: { setorMin: 20 }, texto: 'Concluir 8 setores 20+' }, descricao: 'Reatores instáveis liberam deutério antes que a contenção seja restaurada.' },
  { id: 'tempestade_ionica', nome: 'Tempestade Iônica', subtitulo: 'SINAL FRAGMENTADO', cor: '#b58cff', ritmo: 'semanal', recurso: 'xenonio', quantidade: 36, setorMinimo: 30, modificador: 'Sensores -20% · dano de raio +15%', objetivo: { fato: 'chefe', alvo: 4, filtro: { setorMin: 30 }, texto: 'Derrotar 4 chefes no setor 30+' }, descricao: 'A ionização concentra Xenônio nos poços gravitacionais dos comandantes.' },
  { id: 'cerco_inerte', nome: 'Cerco Inerte', subtitulo: 'LINHA DE BLOQUEIO', cor: '#a8c2d4', ritmo: 'semanal', recurso: 'argonio', quantidade: 42, setorMinimo: 40, modificador: 'Blindagem inimiga +18% · perfuração +1', objetivo: { fato: 'item', alvo: 18, filtro: { raridadeMin: 2 }, texto: 'Obter 18 itens Raros ou melhores' }, descricao: 'A frota de bloqueio usa Argônio puro para selar compartimentos de combate.' },
  { id: 'festival_sinal', nome: 'Festival do Sinal', subtitulo: 'FREQUÊNCIA ABERTA', cor: '#ff65d8', ritmo: 'semanal', recurso: 'neonio', quantidade: 38, setorMinimo: 50, modificador: '+25% cápsulas de baú', objetivo: { fato: 'bau', alvo: 10, texto: 'Abrir 10 baús' }, descricao: 'Balizas de néon marcam rotas temporárias entre mercadores e caçadores.' },
  { id: 'quarentena_vermelha', nome: 'Quarentena Vermelha', subtitulo: 'RISCO RADIOLÓGICO', cor: '#ff5570', ritmo: 'semanal', recurso: 'radonio', quantidade: 34, setorMinimo: 60, modificador: 'Dano químico +20% · cura -15%', objetivo: { fato: 'abate', alvo: 120, filtro: { elemento: 'quimico', setorMin: 60 }, texto: 'Abater 120 inimigos químicos no setor 60+' }, descricao: 'A quarentena é a única janela segura para encapsular Radônio.' },
  { id: 'nascimento_estrela', nome: 'Nascimento de Estrela', subtitulo: 'IGNIÇÃO', cor: '#ffd06a', ritmo: 'semanal', recurso: 'plasma_estelar', quantidade: 30, setorMinimo: 75, modificador: 'Dano de fogo +18% · escudos -10%', objetivo: { fato: 'abate', alvo: 150, filtro: { elemento: 'fogo', setorMin: 75 }, texto: 'Abater 150 inimigos de fogo no setor 75+' }, descricao: 'Uma protoestrela expulsa plasma utilizável por apenas três dias.' },
  { id: 'inverno_vazio', nome: 'Inverno do Vazio', subtitulo: 'ZERO PROFUNDO', cor: '#78efff', ritmo: 'semanal', recurso: 'criogas', quantidade: 30, setorMinimo: 90, modificador: 'Cadência -12% · resistência ao gelo +20%', objetivo: { fato: 'abate', alvo: 150, filtro: { elemento: 'gelo', setorMin: 90 }, texto: 'Abater 150 inimigos de gelo no setor 90+' }, descricao: 'Frentes criogênicas condensam um combustível que evapora fora do ciclo.' },
  { id: 'erupcao_orbital', nome: 'Erupção Orbital', subtitulo: 'CALDEIRA ABERTA', cor: '#ff7d43', ritmo: 'semanal', recurso: 'gas_vulcanico', quantidade: 26, setorMinimo: 120, modificador: 'Explosões +22% área · casco inimigo +12%', objetivo: { fato: 'chefe', alvo: 5, filtro: { setorMin: 120 }, texto: 'Derrotar 5 chefes no setor 120+' }, descricao: 'Gigantes vulcânicos ventilam gases de forja durante o alinhamento orbital.' },
  { id: 'anomalia_exotica', nome: 'Anomalia Exótica', subtitulo: 'LEIS INSTÁVEIS', cor: '#d68cff', ritmo: 'semanal', recurso: 'gas_exotico', quantidade: 18, setorMinimo: 160, modificador: 'Afixos +1 tier efetivo · inimigos aleatórios', objetivo: { fato: 'fusao', alvo: 3, filtro: { subiu: true }, texto: 'Concluir 3 fusões que subam de raridade' }, descricao: 'Matéria gasosa impossível emerge quando uma síntese força as leis locais.' },
  // ── DIÁRIOS · um por elemento, 24h cada, volta completa em seis dias ──────
  //
  // Pagam o minério RASO do elemento: o diário existe para DESTRAVAR a
  // conversão elemental, não para adiantar conteúdo profundo. Sem ele, uma peça
  // de gelo antes da galáxia 12 era impossível — a cromita só cai lá.
  //
  // ## Os alvos são MEDIDOS, e a primeira versão estava errada
  //
  // Eles nasceram com 60, que é um quarto de um setor: uma passada de galáxia
  // mata de 3.400 a 5.100 inimigos. Medido em 07/09 percorrendo os encontros
  // reais, numa galáxia que tem o elemento morrem de 100 a 145 dele por setor —
  // então DOIS setores são 200 a 290, e é esse o esforço que um diário pede.
  //
  // O `setorMinimo` também era 1 para todos, e isso tornava o diário de gelo
  // IMPOSSÍVEL: gelo só aparece em quantidade a partir da galáxia 3, e fogo a
  // partir da 2. Agora cada um abre onde o alvo dele existe.
  //
  // Gelo e raio continuam escassos DE PROPÓSITO — dez e catorze galáxias em
  // trinta. A descrição avisa: a janela abre, mas é preciso ir onde eles estão.
  { id: 'pulso_termico', nome: 'Pulso Térmico', subtitulo: 'JANELA DE FOGO', cor: '#ff7a42', ritmo: 'diario', recurso: 'ferrita', quantidade: 24, setorMinimo: 11, modificador: 'Inimigos de fogo +10% dano · minério de fogo aflorado', objetivo: { fato: 'abate', alvo: 200, filtro: { elemento: 'fogo' }, texto: 'Abater 200 inimigos de fogo' }, descricao: 'A crosta de Vega racha por doze horas e devolve ferrita à superfície. Depois fecha.' },
  { id: 'frente_glacial', nome: 'Frente Glacial', subtitulo: 'JANELA DE GELO', cor: '#7fd8ed', ritmo: 'diario', recurso: 'cromita', quantidade: 20, setorMinimo: 21, modificador: 'Escudos inimigos +15% · veios de cromita expostos', objetivo: { fato: 'abate', alvo: 200, filtro: { elemento: 'gelo' }, texto: 'Abater 200 inimigos de gelo' }, descricao: 'A cromita só existe em duas galáxias, e os inimigos de gelo em dez. Hoje a janela abre — mas você ainda precisa ir onde eles estão.' },
  { id: 'descarga_maior', nome: 'Descarga Maior', subtitulo: 'JANELA DE RAIO', cor: '#54cfff', ritmo: 'diario', recurso: 'litio', quantidade: 22, setorMinimo: 1, modificador: 'Dano de raio +18% · condutores saturados', objetivo: { fato: 'abate', alvo: 200, filtro: { elemento: 'raio' }, texto: 'Abater 200 inimigos de raio' }, descricao: 'Enquanto a tempestade dura, o lítio aflora nas linhas de descarga. Raio é raro: catorze galáxias em trinta.' },
  { id: 'mare_corrosiva', nome: 'Maré Corrosiva', subtitulo: 'JANELA QUÍMICA', cor: '#62d7a4', ritmo: 'diario', recurso: 'uranio', quantidade: 22, setorMinimo: 1, modificador: 'Corrosão contínua no casco · depósitos instáveis', objetivo: { fato: 'abate', alvo: 290, filtro: { elemento: 'quimico' }, texto: 'Abater 290 inimigos químicos' }, descricao: 'O que corrói a nave também dissolve a rocha que prende o urânio.' },
  { id: 'dobra_curta', nome: 'Dobra Curta', subtitulo: 'JANELA CÓSMICA', cor: '#b58cff', ritmo: 'diario', recurso: 'diamantita', quantidade: 20, setorMinimo: 1, modificador: 'Inimigos cósmicos surgem fora de posição · pressão elevada', objetivo: { fato: 'abate', alvo: 220, filtro: { elemento: 'cosmico' }, texto: 'Abater 220 inimigos cósmicos' }, descricao: 'A dobra comprime uma galáxia inteira por um dia. A diamantita vem junto.' },
  { id: 'silencio_balistico', nome: 'Silêncio Balístico', subtitulo: 'JANELA NEUTRA', cor: '#b8c4cf', ritmo: 'diario', recurso: 'iridio', quantidade: 22, setorMinimo: 1, modificador: 'Sem vantagem elemental · dano normal +12%', objetivo: { fato: 'abate', alvo: 210, filtro: { elemento: 'padrao' }, texto: 'Abater 210 inimigos sem elemento' }, descricao: 'Nada resiste, nada favorece. Só massa contra massa — e o irídio que sobra dela.' },

  // ── MENSAIS · tecnologia de chefe, 30 dias, volta em noventa ──────────────
  //
  // É a fonte dos 8 materiais tecnológicos que caíam de chefe sem ter onde ser
  // gastos. Três eventos, e não dez: conteúdo de fim de campanha visto duas
  // vezes no mesmo mês perde o peso de acontecimento.
  { id: 'convocacao_de_guerra', nome: 'Convocação de Guerra', subtitulo: 'CICLO LONGO', cor: '#ffb638', ritmo: 'mensal', recurso: 'micro_reator', quantidade: 14, setorMinimo: 40, modificador: 'Chefes +20% vida · escolta dobrada', objetivo: { fato: 'chefe', alvo: 14, filtro: { setorMin: 40 }, texto: 'Derrotar 14 chefes no setor 40 ou além' }, descricao: 'Quatorze comandantes respondem à mesma frequência. Quem calar todos leva os reatores.' },
  { id: 'linha_de_montagem', nome: 'Linha de Montagem', subtitulo: 'CICLO LONGO', cor: '#8ac7ff', ritmo: 'mensal', recurso: 'matriz_neural', quantidade: 10, setorMinimo: 70, modificador: 'Frotas coordenadas · reforço adaptativo', objetivo: { fato: 'chefe', alvo: 18, filtro: { setorMin: 70 }, texto: 'Derrotar 18 chefes no setor 70 ou além' }, descricao: 'Eles aprendem entre uma onda e outra. As matrizes que os ensinam são o prêmio.' },
  { id: 'colheita_de_singularidade', nome: 'Colheita de Singularidade', subtitulo: 'CICLO LONGO', cor: '#a978ff', ritmo: 'mensal', recurso: 'fragmento_de_singularidade', quantidade: 8, setorMinimo: 120, modificador: 'Gravidade instável · chefes com fase extra', objetivo: { fato: 'chefe', alvo: 20, filtro: { setorMin: 120 }, texto: 'Derrotar 20 chefes no setor 120 ou além' }, descricao: 'O que sobra quando um comandante colapsa sobre o próprio núcleo.' },
];

export interface JanelaDeEvento {
  def: EventoDef;
  ciclo: number;
  chave: string;
  inicio: number;
  fim: number;
}

/** Os eventos de um ritmo, na ordem em que giram. */
export const eventosDoRitmo = (ritmo: RitmoDeEvento): readonly EventoDef[] =>
  EVENTOS.filter((e) => e.ritmo === ritmo);

/**
 * A janela ATIVA de um ritmo.
 *
 * O ciclo é contado a partir do mesmo marco para os três, então o diário, o
 * semanal e o mensal viram no mesmo instante quando as contas coincidem — e
 * isso é bom: o jogador aprende UM horário, não três.
 */
export function janelaDoRitmo(ritmo: RitmoDeEvento, agora = Date.now()): JanelaDeEvento | null {
  const lista = eventosDoRitmo(ritmo);
  if (!lista.length) return null;

  const duracao = DURACAO_DO_RITMO[ritmo];
  const ciclo = Math.floor((agora - MARCO_DOS_EVENTOS) / duracao);
  const indice = ((ciclo % lista.length) + lista.length) % lista.length;
  const inicio = MARCO_DOS_EVENTOS + ciclo * duracao;
  const def = lista[indice]!;
  return { def, ciclo, chave: `${def.id}:${ciclo}`, inicio, fim: inicio + duracao };
}

/** As três janelas ativas agora, do ritmo mais curto ao mais longo. */
export function janelasAtivas(agora = Date.now()): JanelaDeEvento[] {
  return (['diario', 'semanal', 'mensal'] as const)
    .map((r) => janelaDoRitmo(r, agora))
    .filter((j): j is JanelaDeEvento => j !== null);
}

/**
 * A janela semanal. Mantido para quem só conhecia um evento por vez.
 *
 * Não devolve "o evento ativo" mais — devolve o SEMANAL ativo. Quem quer os
 * três chama `janelasAtivas`.
 */
export function eventoNoInstante(agora = Date.now()): JanelaDeEvento {
  return janelaDoRitmo('semanal', agora)!;
}
