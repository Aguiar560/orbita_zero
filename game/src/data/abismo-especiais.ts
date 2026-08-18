/**
 * Os especiais dos chefes do Abismo.
 *
 * Todo chefe do Abismo tem uma BARRA DE ESPECIAL que enche durante a luta.
 * Cheia, ele dispara um golpe próprio — e é o especial, não a barra de vida,
 * que dá identidade à criatura.
 *
 * ## A regra que não se negocia: o especial é TELEGRAFADO
 *
 * A barra é visível e o golpe tem um aviso antes de sair. Um especial que
 * acerta sem aviso não é dificuldade, é imposto: o jogador perde sem ter tido o
 * que fazer, e a única lição possível é "leve mais vida". Com barra e aviso, a
 * mesma pancada vira uma decisão — parar de atirar e desviar, ou apostar em
 * matar antes que encha.
 *
 * `aviso` é o que separa as duas coisas, e por isso ele é obrigatório, não
 * opcional.
 *
 * ## Declarativo, como tudo mais
 *
 * O efeito é dado, não função. É a mesma regra que vale para afixo, para
 * objetivo de missão e para modificador de piso: assim o Node consegue simular a
 * luta sem abrir navegador, e a tela consegue explicar o golpe antes que ele
 * aconteça.
 */

/** Como o especial se desenha. A camada de combate escolhe a animação por aqui. */
export type FormaDeEspecial =
  | 'feixe'      // raio contínuo numa direção
  | 'onda'       // anel que se expande do chefe
  | 'chuva'      // projéteis caindo em área
  | 'pulso'      // explosão instantânea em volta
  | 'lanca'      // projétil único, rápido e pesado
  | 'teia'       // linhas que cobrem a tela
  | 'sopro'      // cone à frente
  | 'colapso'    // suga para o centro e detona
  | 'enxame'     // libera lacaios de uma vez
  | 'sombra';    // o chefe some e reaparece atacando

export interface EfeitoDeEspecial {
  /** Multiplicador sobre o dano normal do chefe. */
  dano?: number;
  /** Segundos em que a nave não responde a comando. */
  atordoa?: number;
  /** Fração da vida MÁXIMA do chefe que ele recupera. */
  cura?: number;
  /** Zera o escudo do jogador de uma vez. */
  quebraEscudo?: boolean;
  /** Impede a regeneração do escudo por N segundos. */
  selaEscudo?: number;
  /** Reduz a velocidade da nave por N segundos, 0..1 de corte. */
  lentidao?: number;
  lentidaoDuracao?: number;
  /** Lacaios liberados de uma vez. */
  invoca?: number;
  /** Fração da vida do chefe recuperada como ESCUDO próprio. */
  escudaSe?: number;
  /** Zera a carga de especial e recomeça mais rápido nas próximas vezes. */
  aceleraProximo?: number;
}

export interface EspecialDef {
  id: string;
  nome: string;
  /** O que acontece, em uma linha. A tela mostra isto durante o aviso. */
  descricao: string;
  forma: FormaDeEspecial;
  /**
   * Segundos de luta para a barra encher.
   *
   * Curto é pressão constante; longo é um momento único que decide a luta. É a
   * diferença entre um chefe que incomoda e um que assusta.
   */
  carga: number;
  /**
   * Segundos de telegrafia antes do golpe sair.
   *
   * OBRIGATÓRIO, e proporcional à pancada: quanto mais forte o especial, mais
   * tempo o jogador tem de ler o aviso. Um golpe que mata em um toque com meio
   * segundo de aviso é injusto; com dois, é uma prova de leitura.
   */
  aviso: number;
  efeito: EfeitoDeEspecial;
  /** Cor do aviso e do efeito, para a tela. */
  cor: string;
}

/**
 * O catálogo.
 *
 * Dezoito especiais cobrindo as quatro famílias que o pedido nomeia — atordoar,
 * dano pesado, curar e tirar escudo — mais as variações que aparecem
 * naturalmente quando se combina isso com forma e tempo de carga.
 */
export const ESPECIAIS: readonly EspecialDef[] = [
  // ── dano pesado ───────────────────────────────────────────────────────────
  {
    id: 'lanca_perfurante', nome: 'Lança Perfurante',
    descricao: 'Um projétil único, lento de carregar e devastador.',
    forma: 'lanca', carga: 14, aviso: 1.6, cor: '#FF7A3D',
    efeito: { dano: 4.5 },
  },
  {
    id: 'sopro_incandescente', nome: 'Sopro Incandescente',
    descricao: 'Um cone de fogo à frente. Saia do caminho.',
    forma: 'sopro', carga: 11, aviso: 1.2, cor: '#FF7A3D',
    efeito: { dano: 2.8, selaEscudo: 3 },
  },
  {
    id: 'chuva_de_estilhacos', nome: 'Chuva de Estilhaços',
    descricao: 'Cobre a tela de projéteis por alguns segundos.',
    forma: 'chuva', carga: 13, aviso: 1.4, cor: '#9AA7BD',
    efeito: { dano: 1.8 },
  },
  {
    id: 'feixe_de_corte', nome: 'Feixe de Corte',
    descricao: 'Um raio contínuo que varre a área.',
    forma: 'feixe', carga: 15, aviso: 1.8, cor: '#FFE45C',
    efeito: { dano: 3.2 },
  },
  {
    id: 'colapso_gravitacional', nome: 'Colapso Gravitacional',
    descricao: 'Puxa tudo para o centro e detona.',
    forma: 'colapso', carga: 18, aviso: 2.2, cor: '#B45CFF',
    efeito: { dano: 5.0, lentidao: 0.5, lentidaoDuracao: 2 },
  },

  // ── atordoamento ──────────────────────────────────────────────────────────
  {
    id: 'pulso_paralisante', nome: 'Pulso Paralisante',
    descricao: 'Trava os controles por um instante.',
    forma: 'pulso', carga: 12, aviso: 1.0, cor: '#FFE45C',
    efeito: { atordoa: 1.2, dano: 0.8 },
  },
  {
    id: 'teia_estatica', nome: 'Teia Estática',
    descricao: 'Linhas de carga que prendem a nave onde ela estiver.',
    forma: 'teia', carga: 16, aviso: 1.5, cor: '#FFE45C',
    efeito: { atordoa: 1.8, lentidao: 0.4, lentidaoDuracao: 3 },
  },
  {
    id: 'silencio_absoluto', nome: 'Silêncio Absoluto',
    descricao: 'Dois segundos sem controle. Escolha bem onde estar.',
    forma: 'onda', carga: 20, aviso: 2.0, cor: '#C77DFF',
    efeito: { atordoa: 2.2, dano: 1.5 },
  },
  {
    id: 'geada_travante', nome: 'Geada Travante',
    descricao: 'Congela o movimento sem interromper o tiro.',
    forma: 'onda', carga: 13, aviso: 1.2, cor: '#7FD8FF',
    efeito: { lentidao: 0.75, lentidaoDuracao: 4, dano: 1.2 },
  },

  // ── cura e proteção ───────────────────────────────────────────────────────
  {
    id: 'regeneracao_forcada', nome: 'Regeneração Forçada',
    descricao: 'Recupera um quinto da vida de uma vez.',
    forma: 'pulso', carga: 17, aviso: 1.4, cor: '#7CE04F',
    efeito: { cura: 0.2 },
  },
  {
    id: 'drenagem_vital', nome: 'Drenagem Vital',
    descricao: 'Tira vida da nave e cura a si mesmo com ela.',
    forma: 'feixe', carga: 15, aviso: 1.6, cor: '#9BE04F',
    efeito: { dano: 2.0, cura: 0.12 },
  },
  {
    id: 'casca_de_vazio', nome: 'Casca de Vazio',
    descricao: 'Ergue um escudo próprio que precisa ser quebrado antes.',
    forma: 'pulso', carga: 16, aviso: 1.2, cor: '#B45CFF',
    efeito: { escudaSe: 0.35 },
  },
  {
    id: 'rebrota', nome: 'Rebrota',
    descricao: 'Cura e libera lacaios ao mesmo tempo.',
    forma: 'enxame', carga: 18, aviso: 1.5, cor: '#7CE04F',
    efeito: { cura: 0.12, invoca: 6 },
  },

  // ── contra o escudo ───────────────────────────────────────────────────────
  {
    id: 'ruptura_de_barreira', nome: 'Ruptura de Barreira',
    descricao: 'Zera o seu escudo de uma vez.',
    forma: 'onda', carga: 14, aviso: 1.3, cor: '#4FC3FF',
    efeito: { quebraEscudo: true, dano: 1.0 },
  },
  {
    id: 'selo_corrosivo', nome: 'Selo Corrosivo',
    descricao: 'Impede a regeneração do escudo por seis segundos.',
    forma: 'sopro', carga: 12, aviso: 1.1, cor: '#9BE04F',
    efeito: { selaEscudo: 6, dano: 1.4 },
  },
  {
    id: 'dissipacao', nome: 'Dissipação',
    descricao: 'Quebra o escudo e sela a regeneração junto.',
    forma: 'colapso', carga: 19, aviso: 2.0, cor: '#C77DFF',
    efeito: { quebraEscudo: true, selaEscudo: 5, dano: 2.2 },
  },

  // ── enxame e mobilidade ───────────────────────────────────────────────────
  {
    id: 'desova', nome: 'Desova',
    descricao: 'Libera uma leva inteira de lacaios de uma vez.',
    forma: 'enxame', carga: 13, aviso: 1.2, cor: '#7CE04F',
    efeito: { invoca: 10 },
  },
  {
    id: 'salto_predador', nome: 'Salto Predador',
    descricao: 'Some e reaparece em cima da nave, atacando.',
    forma: 'sombra', carga: 11, aviso: 0.9, cor: '#FF4B4B',
    efeito: { dano: 3.0, aceleraProximo: 0.75 },
  },
];

export const ESPECIAL_POR_ID = new Map(ESPECIAIS.map((e) => [e.id, e]));

/**
 * Famílias, para a tela agrupar e para o teste conferir cobertura.
 *
 * Derivadas do EFEITO e não de um campo próprio: um campo `familia` escrito à
 * mão pode discordar do que o especial faz, e aí a tela mentiria. Aqui a família
 * é consequência.
 */
export function familiaDoEspecial(e: EspecialDef): 'atordoa' | 'cura' | 'escudo' | 'dano' {
  if (e.efeito.atordoa || e.efeito.lentidao) return 'atordoa';
  if (e.efeito.cura || e.efeito.escudaSe) return 'cura';
  if (e.efeito.quebraEscudo || e.efeito.selaEscudo) return 'escudo';
  return 'dano';
}
