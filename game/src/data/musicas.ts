/**
 * As trilhas de fundo.
 *
 * ## Tabela, e não varredura de pasta
 *
 * O jogo é servido como arquivos estáticos: não há como listar um diretório em
 * tempo de execução. E mesmo que houvesse, o título e o artista não estão no
 * nome do arquivo — `dj-ariss-gamia.mp3` não sabe dizer "Gamia".
 *
 * ## Por que o `id` não é o nome do arquivo
 *
 * Pela mesma regra que vale para item, casco e recurso: identificador é estável
 * e não-visual. O id vai para o save (`settings.musicaAtual`), e renomear um
 * arquivo — ou trocar de formato — não pode apagar a escolha de quem já jogava.
 */
export interface MusicaDef {
  /** Id estável. Vai para o save; nunca reaproveitar um id retirado. */
  id: string;
  titulo: string;
  artista: string;
  /** Caminho a partir da raiz servida. */
  arquivo: string;
}

export const MUSICAS: readonly MusicaDef[] = [
  {
    id: 'ariss_long_way_home',
    titulo: 'Long Way Home',
    artista: 'DJ Ariss',
    arquivo: 'assets/musica/dj-ariss-long-way-home.mp3',
  },
  {
    id: 'ariss_gamia',
    titulo: 'Gamia',
    artista: 'DJ Ariss',
    arquivo: 'assets/musica/dj-ariss-gamia.mp3',
  },
  {
    id: 'ariss_submarine_pop',
    titulo: 'Submarine Pop',
    artista: 'DJ Ariss',
    arquivo: 'assets/musica/dj-ariss-submarine-pop.mp3',
  },
];

export const MUSICA_POR_ID = new Map(MUSICAS.map((m) => [m.id, m]));

/** A faixa seguinte, circulando. Devolve a primeira se o id não existir. */
export function proximaMusica(id: string | undefined): MusicaDef {
  const i = MUSICAS.findIndex((m) => m.id === id);
  return MUSICAS[(i + 1) % MUSICAS.length] ?? MUSICAS[0]!;
}

/** A faixa anterior, circulando. */
export function musicaAnterior(id: string | undefined): MusicaDef {
  const i = MUSICAS.findIndex((m) => m.id === id);
  const anterior = i <= 0 ? MUSICAS.length - 1 : i - 1;
  return MUSICAS[anterior] ?? MUSICAS[0]!;
}

/**
 * A faixa com que cada galáxia COMEÇA.
 *
 * ## Por que o resto (`%`) e não um campo por galáxia
 *
 * São 30 galáxias e três faixas. Uma tabela `galáxia → faixa` teria 27 linhas
 * repetindo as mesmas três, e cada trilha nova obrigaria a reescrever todas.
 * O resto dá o mesmo resultado, acompanha o catálogo sozinho, e é determinístico
 * — a mesma galáxia soa igual em toda visita, o que é o ponto de amarrar música
 * a lugar.
 *
 * ## O que ela NÃO faz
 *
 * Não sobrepõe a escolha do jogador enquanto ele está na galáxia. Ela é o
 * ESTADO INICIAL de cada uma: entrou numa galáxia nova, a trilha muda; trocou de
 * faixa à mão depois disso, a escolha dele vale até a galáxia mudar de novo.
 * Uma música que volta sozinha ao que o jogo quer, três segundos depois de o
 * jogador escolher outra, é pior que não ter escolha nenhuma.
 */
export function musicaDaGalaxia(index: number): MusicaDef {
  const i = Math.max(0, Math.floor(index)) % MUSICAS.length;
  return MUSICAS[i] ?? MUSICAS[0]!;
}
