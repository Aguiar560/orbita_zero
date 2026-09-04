import { h, clear } from './dom';

/**
 * O passeio guiado: foco no que está sendo explicado, desfoque no resto.
 *
 * ## Como o recorte funciona, e por que não é um clone
 *
 * A saída óbvia seria copiar o elemento explicado para dentro da camada escura.
 * Ela quebra em tudo que importa aqui: o palco é um `<canvas>` (a cópia sai em
 * branco), os ícones vêm de atlas por `background-position`, e um clone para de
 * animar — a nave congelaria no meio do passeio.
 *
 * Em vez disso a camada tem um BURACO. `clip-path` com `evenodd` desenha o
 * retângulo da tela inteira e, dentro dele, o retângulo do alvo; a regra de
 * paridade faz o miolo não ser pintado. O elemento aparece por ali, ao vivo,
 * sem ninguém tocar nele — e como não há camada em cima, também não há desfoque
 * naquele pedaço.
 *
 * ## Por que o zoom é `transform` e não largura
 *
 * `transform: scale` não reflui: o elemento cresce sem empurrar vizinho nenhum
 * e sem a interface se remontar. Mudar tamanho de verdade faria o painel inteiro
 * dançar a cada passo, e o alvo mudaria de lugar enquanto a seta aponta para ele.
 *
 * ## O que acontece quando o alvo não existe
 *
 * O passo é PULADO, e o passeio continua. Um roteiro que aponta para um botão
 * que ainda não foi desbloqueado é o caso normal, não a exceção — e travar o
 * onboarding num alvo ausente seria trancar o jogador do lado de fora do jogo.
 */

export interface PassoDoTour {
  /** Seletor CSS do que destacar. Vazio = passo sem alvo, centralizado. */
  alvo?: string;
  titulo: string;
  texto: string;
  /** Quanto ampliar o alvo. 1 = sem zoom. */
  escala?: number;
  /** Painel a abrir antes do passo. */
  abrirPainel?: string;
  /**
   * Parte da interface que precisa estar ABERTA para o passo fazer sentido.
   *
   * A Anatomia recolhe, e recolhida ela e um talo de poucos pixels: o recorte
   * fica do tamanho de nada e o balao explica algo que o jogador nao ve. Quem
   * abre e o hospedeiro, que devolve ao estado anterior no fim do passeio.
   */
  exige?: 'anatomia';
  /** Margem extra em volta do buraco, em pixels. */
  folga?: number;
}

/** Espaço entre o buraco e o balão. */
const RESPIRO = 14;
/** Largura do balão. Fixa: um balão que muda de largura a cada passo salta. */
const LARGURA_DO_BALAO = 330;

export interface OpcoesDoTour {
  passos: readonly PassoDoTour[];
  /** Chamado ao abrir um painel que o passo pede. */
  aoAbrirPainel?: (id: string) => void;
  /** Abre uma parte recolhida da interface. Devolve o estado anterior. */
  aoExigir?: (o_que: 'anatomia') => void;
  /**
   * O rotulo do ultimo botao.
   *
   * O passeio de entrada fecha com "Comecar a jogar", que e verdade: ele roda
   * antes da primeira partida. Um tutorial de tela roda com o jogo em andamento
   * ha horas, e ali a mesma frase mente. Padrao neutro, e quem tem motivo troca.
   */
  rotuloFinal?: string;

  /** Chamado ao terminar ou pular. `completo` diz qual dos dois. */
  aoFechar?: (completo: boolean) => void;
}

export class Tour {
  private raiz: HTMLElement | null = null;
  private camada!: HTMLElement;
  private balao!: HTMLElement;
  private indice = 0;
  private alvoAtual: HTMLElement | null = null;
  private observador: ResizeObserver | null = null;
  private readonly opcoes: OpcoesDoTour;
  private aoRedimensionar = (): void => { this.posicionar(); };
  private aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.fechar(false);
    if (e.key === 'ArrowRight' || e.key === 'Enter') this.ir(1);
    if (e.key === 'ArrowLeft') this.ir(-1);
  };

  constructor(opcoes: OpcoesDoTour) {
    this.opcoes = opcoes;
  }

/**
   * Os passos deste passeio, decididos UMA vez.
   *
   * Era um getter que refiltrava a lista a cada acesso, e isso é veneno com um
   * índice: `posicionar()` roda três vezes por passo (agora, no próximo quadro
   * e 90ms depois, porque um painel recém-aberto ainda não tem posição), e se a
   * lista encolhesse entre duas chamadas o mesmo índice passaria a apontar para
   * OUTRO passo.
   *
   * Foi medido acontecendo: no passo 2 o balão ia parar no centro da tela, em
   * cima do que devia estar explicando, com `lado` de um cálculo que nunca
   * chegou a valer.
   */
  private lista: PassoDoTour[] = [];

  comecar(raiz: HTMLElement): void {
    if (this.raiz) return;
    this.raiz = raiz;
    this.indice = 0;
    // Alvo que não existe agora não vai existir no meio do passeio, e um passo
    // apontando para o nada trava o onboarding — que é trancar o jogador do
    // lado de fora do jogo.
    this.lista = this.opcoes.passos.filter((p) => !p.alvo || document.querySelector(p.alvo));

    this.camada = h('.tour-camada', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Guia do jogo' });
    this.balao = h('.tour-balao');
    raiz.append(this.camada, this.balao);

    window.addEventListener('resize', this.aoRedimensionar);
    window.addEventListener('keydown', this.aoTeclar);

    this.desenhar();
  }

  private ir(delta: number): void {
    const proximo = this.indice + delta;
    if (proximo < 0) return;
    if (proximo >= this.lista.length) { this.fechar(true); return; }
    this.indice = proximo;
    this.desenhar();
  }

  private desenhar(): void {
    const passo = this.lista[this.indice];
    if (!passo) { this.fechar(true); return; }

    if (passo.abrirPainel) this.opcoes.aoAbrirPainel?.(passo.abrirPainel);
    if (passo.exige) this.opcoes.aoExigir?.(passo.exige);

    // O zoom do passo anterior sai antes de o próximo entrar: dois alvos
    // ampliados ao mesmo tempo é o defeito clássico deste tipo de tela.
    this.limparZoom();

    this.alvoAtual = passo.alvo ? document.querySelector<HTMLElement>(passo.alvo) : null;
    if (this.alvoAtual && (passo.escala ?? 1) !== 1) {
      this.alvoAtual.classList.add('tour-alvo');
      this.alvoAtual.style.setProperty('--tour-escala', String(passo.escala));
    }

    const total = this.lista.length;
    clear(this.balao).append(
      h('.tour-passo-conta', { text: `${this.indice + 1} de ${total}` }),
      h('h2.tour-titulo', { text: passo.titulo }),
      h('p.tour-texto', { text: passo.texto }),
      h('.tour-acoes', {},
        h('button.tour-pular', {
          text: 'Pular guia',
          onclick: () => this.fechar(false),
        }),
        h('.tour-navegar', {},
          ...(this.indice > 0
            ? [h('button.tour-btn', { text: 'Voltar', onclick: () => this.ir(-1) })]
            : []),
          h('button.tour-btn.tour-principal', {
            text: this.indice === total - 1 ? (this.opcoes.rotuloFinal ?? 'Entendi') : 'Próximo',
            onclick: () => this.ir(1),
          }),
        ),
      ),
    );

    this.posicionar();
    this.observarAlvo();
  }

  /**
   * Segue o alvo enquanto ele se mexe.
   *
   * Antes eram três chamadas cronometradas (agora, no próximo quadro, e 90ms
   * depois) — um palpite sobre quanto a interface demora a assentar. E o palpite
   * estava errado: a Anatomia ABRE DESLIZANDO em 260ms, então o recorte era
   * calculado sobre uma coluna ainda fechada e ficava do tamanho de um talo.
   *
   * `ResizeObserver` não adivinha: ele avisa a cada mudança de caixa, e o
   * recorte acompanha a coluna abrindo em vez de tentar prever o fim dela.
   */
  private observarAlvo(): void {
    this.observador?.disconnect();
    const passo = this.lista[this.indice];
    const alvo = passo?.alvo ? document.querySelector<HTMLElement>(passo.alvo) : null;
    if (!alvo) return;

    // Traz o alvo a vista antes de recortar. O trilho da esquerda ROLA, e numa
    // janela baixa os botoes de modo ficam abaixo da dobra — o buraco sairia
    // fora da tela e o passo destacaria o vazio.
    //
    // `block: nearest` e nao `center`: mexer o minimo evita empurrar o resto da
    // interface so para centralizar algo que ja estava quase visivel. E sem
    // `smooth`, que brigaria com o observador logo abaixo.
    alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    this.observador = new ResizeObserver(() => this.posicionar());
    this.observador.observe(alvo);
    // O alvo pode mudar de LUGAR sem mudar de tamanho — um painel vizinho que
    // abre, por exemplo —, e disso o observador não sabe.
    requestAnimationFrame(() => this.posicionar());
  }

  /**
   * Recorta o buraco e encosta o balão nele.
   *
   * O retângulo vem do alvo já COM o zoom aplicado (`getBoundingClientRect`
   * devolve a caixa transformada), senão o buraco ficaria menor que o elemento
   * ampliado e cortaria as bordas dele.
   */
  private posicionar(): void {
    if (!this.raiz) return;
    const passo = this.lista[this.indice];
    if (!passo) return;

    const alvo = passo.alvo ? document.querySelector<HTMLElement>(passo.alvo) : null;
    const L = window.innerWidth;
    const A = window.innerHeight;

    if (!alvo) {
      // Passo sem alvo: a tela toda escurece e o balão fica no centro.
      this.camada.style.clipPath = '';
      this.balao.style.left = `${(L - LARGURA_DO_BALAO) / 2}px`;
      this.balao.style.top = `${A / 2 - 120}px`;
      // Sem isto o `lado` de um passo anterior fica no dataset e a seta do CSS
      // aponta para um alvo que não está mais ali.
      delete this.balao.dataset.lado;
      return;
    }

    const folga = passo.folga ?? 8;
    const r = alvo.getBoundingClientRect();
    const x = Math.max(0, r.left - folga);
    const y = Math.max(0, r.top - folga);
    const l = Math.min(L - x, r.width + folga * 2);
    const a = Math.min(A - y, r.height + folga * 2);
    const raio = Math.min(14, l / 2, a / 2);

    // `evenodd`: o contorno de fora é a tela, o de dentro é o alvo. A paridade
    // deixa o miolo sem pintura — é o buraco.
    this.camada.style.clipPath =
      `path(evenodd, "M0 0 H${L} V${A} H0 Z `
      + `M${x + raio} ${y} H${x + l - raio} A${raio} ${raio} 0 0 1 ${x + l} ${y + raio} `
      + `V${y + a - raio} A${raio} ${raio} 0 0 1 ${x + l - raio} ${y + a} `
      + `H${x + raio} A${raio} ${raio} 0 0 1 ${x} ${y + a - raio} `
      + `V${y + raio} A${raio} ${raio} 0 0 1 ${x + raio} ${y} Z")`;

    this.posicionarBalao(x, y, l, a, L, A);
  }

  /**
   * O balão vai para o lado com espaço, preferindo abaixo.
   *
   * A ordem não é estética: um balão que cobre o próprio alvo torna o passo
   * inútil, e um que sai da tela é pior ainda.
   */
  private posicionarBalao(x: number, y: number, l: number, a: number, L: number, A: number): void {
    const alt = this.balao.offsetHeight || 190;
    const lado = (() => {
      if (A - (y + a) > alt + RESPIRO * 2) return 'abaixo';
      if (y > alt + RESPIRO * 2) return 'acima';
      if (L - (x + l) > LARGURA_DO_BALAO + RESPIRO * 2) return 'direita';
      if (x > LARGURA_DO_BALAO + RESPIRO * 2) return 'esquerda';
      return 'abaixo';
    })();

    let bx: number;
    let by: number;
    if (lado === 'abaixo' || lado === 'acima') {
      bx = x + l / 2 - LARGURA_DO_BALAO / 2;
      by = lado === 'abaixo' ? y + a + RESPIRO : y - alt - RESPIRO;
    } else {
      bx = lado === 'direita' ? x + l + RESPIRO : x - LARGURA_DO_BALAO - RESPIRO;
      by = y + a / 2 - alt / 2;
    }

    // Encostar nas bordas é melhor que vazar: um balão meio fora da tela perde
    // justamente o fim do texto.
    this.balao.style.left = `${Math.max(12, Math.min(L - LARGURA_DO_BALAO - 12, bx))}px`;
    this.balao.style.top = `${Math.max(12, Math.min(A - alt - 12, by))}px`;
    this.balao.dataset.lado = lado;
  }

  private limparZoom(): void {
    if (!this.alvoAtual) return;
    this.alvoAtual.classList.remove('tour-alvo');
    this.alvoAtual.style.removeProperty('--tour-escala');
    this.alvoAtual = null;
  }

  private fechar(completo: boolean): void {
    if (!this.raiz) return;
    this.observador?.disconnect();
    this.observador = null;
    this.limparZoom();
    window.removeEventListener('resize', this.aoRedimensionar);
    window.removeEventListener('keydown', this.aoTeclar);
    this.camada.remove();
    this.balao.remove();
    this.raiz = null;
    this.opcoes.aoFechar?.(completo);
  }
}
